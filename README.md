Here is the complete technical documentation for your Resume Optimizer project.

This architecture is built to be a robust, scalable, and maintainable system, even for a-MVP. It integrates your script's "chunk-and-merge" logic directly into a formal backend with a separate job queue.

-----

### 1\. 🏛️ Project Architecture & Data Flow

This system is split into two main components that run from the **same codebase** but as **different processes**:

1.  **WEB Process (`ROLE=web`):** A stateless Express.js API server. Its only job is to handle fast HTTP requests (like uploading the file and checking status). It does **not** do any heavy lifting (like parsing or calling Gemini).
2.  **WORKER Process (`ROLE=worker`):** A background process. Its only job is to poll the MongoDB `processes` collection for work. It does all the heavy lifting: parsing PDFs, calling the Gemini API, and generating the final JSON.

This separation is critical. It means a 1-minute PDF parsing job on the `WORKER` will not block the `WEB` server, which can continue to serve status updates to the user.

#### 🔄 Core Data Flow:

1.  **Upload:** User sends a `POST /api/v1/runs` request with the PDF and instructions to the `WEB` server.
2.  **Triage:** The `WEB` server:
      * Validates the request (using `zod`).
      * Uploads the raw PDF to an **S3 bucket** (this is *required* for a stateless architecture).
      * Creates a `Run` document (with a new `runId`).
      * Creates a `Process` document (e.g., `step: 'parse', status: 'pending'`).
      * Responds **immediately** with the `runId`.
3.  **Job Pickup (Worker):** The `WORKER` process is polling the `processes` collection. It finds the `pending` job and atomically "leases" it.
4.  **Parse Step (Worker):**
      * The worker downloads the PDF from S3.
      * Uses `pdf-parse` to get the raw text.
      * Saves this raw text back to S3 (e.g., `public/runId/extracted_text.txt`).
      * Updates the `Process` doc: `step: 'generate', status: 'running'`.
5.  **Generate Step (Worker):**
      * The worker downloads the raw text from S3.
      * It loops through your `JSON_SCHEMA_CHUNKS`.
      * For each chunk, it calls the `LLMService` (which rotates Gemini keys).
      * It merges all JSON results into one `final_json` object.
      * It saves this `final_json` to a new `Resume` document.
      * It updates the `Process` doc: `status: 'completed'`.
6.  **Preview (User):**
      * The frontend, which has been polling `GET /api/v1/runs/:runId/status`, sees `completed`.
      * It then calls `GET /api/v1/runs/:runId/preview-html`.
      * The `WEB` server fetches the `final_json`, runs it through your `generateHtml` function, and returns a plain HTML string. The frontend renders this in a preview pane.

-----

### 2\. 📦 Package.json (Dependencies)

Here are the exact packages I recommend for this architecture.

```json
{
  "name": "resumeai-backend",
  "version": "1.0.0",
  "main": "src/server.js",
  "scripts": {
    "start": "node src/server.js",
    "dev": "pino-colada | nodemon src/server.js",
    "worker": "node src/worker-manager.js"
  },
  "dependencies": {
    "@aws-sdk/client-s3": "^3.592.0",
    "axios": "^1.7.2",
    "cors": "^2.8.5",
    "dayjs": "^1.11.11",
    "dotenv": "^16.4.5",
    "express": "^4.19.2",
    "helmet": "^7.1.0",
    "http-status-codes": "^2.3.0",
    "mongoose": "^8.4.3",
    "multer": "1.4.5-lts.1",
    "nanoid": "^3.3.7",
    "pdf-parse": "^1.1.1",
    "pino": "^9.2.0",
    "puppeteer": "^22.12.0",
    "zod": "^3.23.8",
    "zod-express-middleware": "^1.4.0"
  },
  "devDependencies": {
    "nodemon": "^3.1.4",
    "pino-colada": "^2.1.0"
  }
}
```

  * **`express` / `cors` / `helmet`:** Standard web server stack.
  * **`mongoose`:** The best ODM for MongoDB.
  * **`dotenv`:** Manages environment variables.
  * **`zod` / `zod-express-middleware`:** Modern, powerful validation for API requests.
  * **`pino`:** High-performance JSON logger.
  * **`pino-colada`:** Makes pino logs readable in development.
  * **`axios`:** Robust HTTP client for calling the Gemini API.
  * **`@aws-sdk/client-s3`:** AWS S3 client for file storage.
  * **`multer`:** Handles `multipart/form-data` (file uploads) in memory.
  * **`pdf-parse`:** A lightweight, excellent library for extracting raw text from PDF buffers.
  * **`puppeteer`:** The full-browser engine needed to render high-fidelity PDFs from your HTML.
  * **`nanoid` (v3):** Generates short, secure, URL-friendly unique IDs (like `runId`).
  * **`dayjs`:** Lightweight date/time library for lease management.
  * **`http-status-codes`:** Provides readable constants for HTTP statuses (e.g., `StatusCodes.CREATED`).

-----

### 3\. 📂 File & Directory Structure

This structure separates concerns clearly.

```
/resumeai-backend/
├─ package.json
├─ .env
├─ .env.example
├─ .gitignore
└─ /src
   ├─ server.js            # WEB entry point: Starts Express server
   ├─ worker-manager.js    # WORKER entry point: Starts the worker loop
   │
   ├─ /api                 # All API-related files
   │  ├─ routes.js         # Main router (combines all other routes)
   │  ├─ runs.controller.js  # Controller for /runs routes
   │  ├─ runs.routes.js    # Defines /runs endpoints and links to controller
   │  └─ runs.validation.js  # Zod schemas for validating /runs requests
   │
   ├─ /config
   │  ├─ index.js          # Loads and exports all env vars (from config/index.js)
   │  └─ db.js             # Mongoose connection logic
   │
   ├─ /models              # Mongoose schemas
   │  ├─ run.model.js
   │  ├─ process.model.js
   │  └─ resume.model.js
   │
   ├─ /services            # The "brains" of the application
   │  ├─ parser.service.js   # Logic for pdf-parse
   │  ├─ storage.service.js  # Wrapper for S3 (upload, download, delete)
   │  ├─ llm.service.js      # Gemini API client, key rotation
   │  ├─ generation.service.js # Orchestrates the chunk-loop-merge logic
   │  ├─ renderer.service.js # generateHtml and generatePdf logic
   │  └─ process.service.js  # Logic to lease, update, and fail process docs
   │
   ├─ /middleware
   │  ├─ errorHandler.js   # Global error handler
   │  ├─ asyncHandler.js   # Wraps async controllers to catch errors
   │  └─ validate.js       # Middleware that uses Zod schemas
   │
   ├─ /utils
   │  ├─ logger.js         # Pino logger configuration
   │  ├─ ApiError.js       # Custom error class
   │  └─ constants.js      # Enums, retention times, etc.
   │
   └─ /libs
      ├─ promptBuilder.js  # Your buildChunkPrompt function
      └─ llmSchemas.js     # Your JSON_SCHEMA_CHUNKS object
```

-----

### 4\. 🗃️ MongoDB Models (Mongoose Schemas)

These are the three core collections you'll need.

#### `run.model.js`

*Tracks the high-level job request.*

```javascript
const mongoose = require('mongoose');

const runSchema = new mongoose.Schema(
  {
    // Public-facing ID (e.g., 'run_gYqC14F-P')
    runId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    // Original file info
    originalPdfKey: {
      type: String,
      required: true,
    },
    originalFilename: {
      type: String,
      required: true,
    },
    // Raw text file info
    extractedTextKey: {
      type: String,
    },
    // User instructions
    instruction_text: {
      type: String,
    },
    // Quick-access status (synced from process.model)
    status: {
      type: String,
      enum: ['pending', 'running', 'completed', 'failed'],
      default: 'pending',
      index: true,
    },
    // When this run and its files should be auto-deleted
    retention_until: {
      type: Date,
      required: true,
      index: true,
    },
  },
  { timestamps: true } // Adds createdAt, updatedAt
);

module.exports = mongoose.model('Run', runSchema);
```

#### `process.model.js`

*The "job queue" doc. Tracks the worker's state.*

```javascript
const mongoose = require('mongoose');

const processSchema = new mongoose.Schema(
  {
    runId: {
      type: String,
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ['pending', 'running', 'completed', 'failed', 'cancelled'],
      default: 'pending',
      index: true,
    },
    step: {
      type: String,
      enum: ['parse', 'generate'],
      default: 'parse',
    },
    attempt: {
      type: Number,
      default: 1,
    },
    lastError: {
      message: String,
      stack: String,
    },
    // --- Worker Leasing ---
    assigned_worker: {
      type: String, // A unique ID for the worker process
      index: true,
    },
    leased_until: {
      type: Date,
      index: true,
    },
    // --- Progress Tracking ---
    meta: {
      chunks_total: { type: Number, default: 5 }, // Set based on llmSchemas.js
      chunks_completed: { type: Number, default: 0 },
      chunk_errors: [String], // Log errors for specific chunks
    },
  },
  { timestamps: true }
);

// This is the most important index for the worker query
processSchema.index({
  status: 1,
  leased_until: 1,
  attempt: 1,
});

module.exports = mongoose.model('Process', processSchema);
```

#### `resume.model.js`

*Stores the final output.*

```javascript
const mongoose = require('mongoose');

const resumeSchema = new mongoose.Schema(
  {
    runId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    // The final, merged JSON from the GenerationService
    final_json: {
      type: Object,
      required: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Resume', resumeSchema);
```

-----

### 5\. 🗺️ API Routes & Contracts

All routes will be prefixed with `/api/v1`.

#### `POST /runs`

  * **Purpose:** The main endpoint to create a new optimization job.
  * **Request:** `Content-Type: multipart/form-data`
      * `file`: The PDF file (max 5MB).
      * `instruction_text`: String (max 1000 chars).
  * **Validation (`runs.validation.js`):**
      * Uses `multer` to ensure `file` exists and is a PDF.
      * Uses `zod` to validate `instruction_text`.
  * **Response (202 Created):**
    ```json
    {
      "success": true,
      "data": {
        "runId": "run_gYqC14F-P",
        "status": "pending",
        "message": "Your resume is being processed."
      }
    }
    ```

#### `GET /runs/:runId/status`

  * **Purpose:** The main polling endpoint for the frontend.
  * **Request Params:** `runId` (e.g., `run_gYqC14F-P`)
  * **Response (200 OK):**
    ```json
    {
      "success": true,
      "data": {
        "runId": "run_gYqC14F-P",
        "status": "running", // 'pending', 'running', 'completed', 'failed'
        "step": "generate", // 'parse', 'generate'
        "progress": {
          "total_chunks": 5,
          "completed_chunks": 2
        },
        "error": null // or "Failed to parse PDF."
      }
    }
    ```

#### `GET /runs/:runId/preview-html`

  * **Purpose:** Fetches the generated HTML preview for the right-side pane.
  * **Request Params:** `runId`
  * **Response (200 OK):**
      * `Content-Type: text/html`
      * **Body:** A raw HTML string (e.g., `<!DOCTYPE html>...`).

#### `POST /runs/:runId/render-pdf`

  * **Purpose:** Triggers the download of the final, generated PDF.
  * **Request Params:** `runId`
  * **Response (200 OK):**
      * `Content-Type: application/pdf`
      * `Content-Disposition: attachment; filename="optimized-resume.pdf"`
      * **Body:** The binary PDF stream.

-----

### 6\. 🛠️ Core Services & Logic

This is the "how" for each service.

  * **`storage.service.js`**

      * Wraps the S3 client.
      * `async upload(fileBuffer, key, mimetype)`: Uploads a buffer to S3.
      * `async download(key)`: Downloads an object from S3 and returns it as a Buffer.
      * `async getSignedUrl(key)`: (Optional) Generates a temporary URL to view the original PDF.

  * **`parser.service.js`**

      * `async extractText(pdfBuffer)`:
          * Takes a `Buffer` (from `storage.service.download`).
          * Calls `await pdf(pdfBuffer)`.
          * Returns the `data.text` string.

  * **`llm.service.js`**

      * `const keys = config.llmApiKeys;`
      * `let keyIndex = 0;`
      * `async generateChunk(prompt)`:
          * Implements the key rotation logic we discussed.
          * It will try `keyIndex`, and if it gets a 429 error, it will increment `keyIndex` and try again with the next key.
          * Uses `axios` to call the Gemini API.
          * Returns the parsed JSON object from the response.

  * **`generation.service.js`**

      * `async runGeneration(process)`:
          * This is the main orchestrator.
          * `const schemas = require('../libs/llmSchemas').JSON_SCHEMA_CHUNKS;`
          * `const rawText = await storage.download(run.extractedTextKey);`
          * `let final_json = {};`
          * `for (const key of Object.keys(schemas))`
              * `const prompt = buildChunkPrompt(rawText, ...);`
              * `try { const chunk = await llm.generateChunk(prompt); Object.assign(final_json, chunk); } catch (e) { ... }`
              * `await process.updateOne({ ... 'meta.chunks_completed': ... });`
          * `await Resume.create({ runId: process.runId, final_json });`

  * **`renderer.service.js`**

      * `generateHtmlString(jsonData)`:
          * This is a **direct copy-paste** of your `generateHtml` function from `script.js`.
      * `async generatePdfStream(htmlString)`:
          * `const browser = await puppeteer.launch();`
          * `const page = await browser.newPage();`
          * `await page.setContent(htmlString);`
          * `const pdfStream = await page.pdf({ format: 'A4' });`
          * `await browser.close();`
          * Returns the `pdfStream`.

-----

### 7\. 🚦 Middleware

  * **`validate.js`:** A function that takes a `zod` schema. It runs `schema.parse(req)`, and if it fails, it passes the formatted error to the global error handler.
  * **`errorHandler.js`:** A global error handler (`(err, req, res, next)`). It logs the error and sends a standardized JSON error response, so you don't leak stack traces.
  * **`asyncHandler.js`:** A simple wrapper `(fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);`. You will wrap all your async controller functions in this.

-----

### 8\. 📄 Common Files & Utilities

  * **`utils/constants.js`**
      * `PROCESS_STEPS = { PARSE: 'parse', GENERATE: 'generate' }`
      * `PROCESS_STATUS = { PENDING: 'pending', RUNNING: 'running', ... }`
      * `LEASE_TTL_MS = 90 * 1000` (90 seconds)
      * `MAX_ATTEMPTS = 3`
  * **`config/index.js`**
      * Loads all variables from `.env` and validates them.
      * Parses `LLM_API_KEYS` from a comma-separated string into an array.
  * **`libs/llmSchemas.js`:** Exports `JSON_SCHEMA_CHUNKS`.
  * **`libs/promptBuilder.js`:** Exports `buildChunkPrompt`.
  * **`utils/logger.js`:** Configures and exports the `pino` logger.

-----

### 9\. 🔒 Environment Variables (`.env.example`)

This is the complete list of secrets and configs your application will need.

```ini
# ------------------------------
# Server Configuration
# ------------------------------
NODE_ENV=development
PORT=8080

# ------------------------------
# Database
# ------------------------------
MONGODB_URI="mongodb://localhost:27017/resumeai"

# ------------------------------
# File Storage (AWS S3)
# ------------------------------
AWS_BUCKET_NAME="your-s3-bucket-name"
AWS_REGION="us-east-1"
AWS_ACCESS_KEY_ID="YOUR_AWS_KEY"
AWS_SECRET_ACCESS_KEY="YOUR_AWS_SECRET"

# ------------------------------
# Worker & Job Queue
# ------------------------------
# How long a worker can hold a job before it's considered "failed"
LEASE_TTL_MS=90000
# How often the worker polls for new jobs
WORKER_POLL_INTERVAL_MS=5000
# How long to keep files and DB records before auto-deletion
DEFAULT_RETENTION_HOURS=24

# ------------------------------
# LLM API (Gemini)
# ------------------------------
# A comma-separated list of your free API keys
LLM_API_KEYS="key-one,key-two,key-three"
LLM_MODEL="gemini-1.5-flash" # Your script used '2.5-flash', I'll use '1.5-flash' as it's more common
LLM_TIMEOUT_MS=60000
```