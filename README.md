
# ResumeAI Backend

A robust backend service for asynchronously processing, optimizing, and re-rendering PDF resumes using a Node.js worker-queue architecture and the Gemini LLM.

---

## 🚀 Core Features

* **Asynchronous Job Processing:** Built with a separate **Web** and **Worker** process to handle long-running AI tasks without blocking the API.
* **Two-Pass Architecture:** Implements a robust "Parse -> Optimize" flow to ensure accurate diffing and data integrity.
    * **Pass 1 (Parse):** Extracts raw text and structures it into a standardized JSON format (Source of Truth).
    * **Pass 2 (Optimize):** Applies user instructions to the parsed data to generate the final optimized version.
* **Diff Viewer Support:** Stores both "Original" and "Optimized" JSONs to enable a side-by-side comparison UI.
* **ATS Scoring:** Automatically calculates a keyword match score (pre and post-optimization) and identifies missing keywords from the job description.
* **PDF Parsing:** Extracts raw text and hyperlinks from uploaded PDF resumes using `pdfjs-dist`.
* **AI-Powered Optimization:** Uses the Gemini API to analyze resume text against user instructions, following a "chunk-and-merge" logic for robust JSON generation.
* **Stateless & Scalable:** Leverages **S3** for file storage (original PDF, extracted text), allowing both Web and Worker processes to be scaled independently.
* **Dynamic Rendering:** Generates **HTML previews** and final **PDF downloads** from the structured JSON data using Puppeteer for high-fidelity output.
* **Robust Validation:** Employs `zod` for strict, schema-based validation of all incoming API requests.
* **Resilient LLM Calls:** Includes logic to rotate Gemini API keys on rate-limit (429) errors and retry on JSON parse failures.

---

## 🏛️ Architecture Overview

This project runs as two distinct processes from the same codebase, orchestrated by a MongoDB database.

1.  **`WEB` Process (`npm run dev`):** A stateless Express.js server.
    * Handles all HTTP requests (file uploads, status checks).
    * Validates input using `zod`.
    * Uploads the raw PDF to S3.
    * Creates `Run` and `Process` documents in MongoDB to queue the job.
    * **Does not** perform any heavy processing.

2.  **`WORKER` Process (`npm run worker`):** A background job processor.
    * Polls the `processes` collection in MongoDB for `pending` jobs.
    * Leases a job, downloads the PDF from S3, and parses the text using the `ParserService`.
    * **Pass 1:** Calls `LLMService` to structure raw text into `original_json` and calculates baseline ATS score.
    * **Pass 2:** Calls `LLMService` to optimize content into `final_json` and calculates final ATS score.
    * Saves both JSONs to a `Resume` document.
    * Updates the job status to `completed` or `failed`.

### 🔄 Data Flow

1.  User `POST /api/v1/runs` with a PDF to the **WEB** server.
2.  **WEB** server uploads the PDF to S3, creates a `Run` job in MongoDB, and responds *immediately* with a `runId`.
3.  **WORKER** process finds the `pending` job, downloads the PDF from S3.
4.  **WORKER** runs **Pass 1** (Parse) -> **Pass 2** (Optimize).
5.  User's frontend polls `GET /api/v1/runs/:runId/status`.
6.  Once status is `completed`, the user can:
    *   Fetch the diff data via `GET /.../diff`.
    *   Fetch the preview via `GET /.../preview-html`.
    *   Download the PDF via `POST /.../render-pdf`.

---

## 🛠️ Tech Stack

* **Backend:** Node.js, Express.js
* **Database:** MongoDB (with Mongoose)
* **File Storage:** AWS S3
* **PDF Parsing:** `pdfjs-dist`
* **PDF Generation:** Puppeteer
* **Validation:** Zod
* **Job Queue:** Implemented via MongoDB (`process.model.js`)
* **Logging:** Pino
* **Environment:** dotenv

---

## 🚀 Getting Started

### Prerequisites

* [Node.js](https://nodejs.org/en/) (v18.x or later)
* [npm](https://www.npmjs.com/)
* [MongoDB](https://www.mongodb.com/try/download/community) (local or Atlas)
* [AWS S3 Bucket](https://aws.amazon.com/s3/) and credentials

### 1. Installation

1.  Clone the repository:
    ```bash
    git clone https://github.com/YatharthDixit/ai-resume-backend.git
    cd ai-resume-backend
    ```

2.  Install dependencies:
    ```bash
    npm install
    ```
    *(Note: Your `package.json` should include `pdfjs-dist` instead of `pdf-parse`)*.

### 2. Environment Configuration

1.  Copy the example environment file:
    ```bash
    cp .env.example .env
    ```

2.  Open `.env` and fill in all the required values (MongoDB URI, S3 credentials, Gemini API keys).

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
LLM_MODEL="gemini-1.5-flash"
LLM_TIMEOUT_MS=60000
```

### 3. Running the Application

This project requires **two terminals** to run in development.

**In Terminal 1, run the WEB server:**

```bash
npm run dev
```

> This starts the Express API server on the port specified in your `.env` (e.g., `http://localhost:8080`).

**In Terminal 2, run the WORKER process:**

```bash
npm run worker
```

> This starts the background worker, which will begin polling MongoDB for jobs.

-----

## 🗺️ API Endpoints

All routes are prefixed with `/api/v1`.

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/runs` | Creates a new resume optimization job. Requires `multipart/form-data` with a `file` and `instruction_text`. |
| `GET` | `/runs/:runId/status` | Polls for the status of a job. Returns `status`, `step`, and `progress`. |
| `GET` | `/runs/:runId/diff` | Returns `original` and `optimized` JSONs + ATS scores for the Diff Viewer. |
| `GET` | `/runs/:runId/preview-html` | Returns the raw HTML preview of the optimized resume. |
| `POST` | `/runs/:runId/render-pdf` | Generates and returns the final, optimized resume as a PDF file download. |

-----

## 📂 Project Structure

```
/resumeai-backend/
├─ package.json
├─ .env
├─ .env.example
└─ /src
   ├─ server.js            # WEB entry point (Express)
   ├─ worker-manager.js    # WORKER entry point (Job polling)
   │
   ├─ /api                 # Express routing
   │  ├─ routes.js
   │  ├─ runs.controller.js
   │  ├─ runs.routes.js
   │  └─ runs.validation.js  # Zod schemas
   │
   ├─ /config
   │  ├─ index.js          # Loads .env config
   │  └─ db.js             # Mongoose connection
   │
   ├─ /models              # Mongoose schemas
   │  ├─ run.model.js
   │  ├─ process.model.js  # The job queue model
   │  └─ resume.model.js   # Stores original_json, final_json, atsScore
   │
   ├─ /services            # Core business logic
   │  ├─ parser.service.js   # pdfjs-dist logic
   │  ├─ storage.service.js  # S3 wrapper
   │  ├─ llm.service.js      # Gemini API client
   │  ├─ generation.service.js # Two-Pass logic (Parse & Optimize)
   │  ├─ ats.service.js      # Keyword scoring logic
   │  ├─ renderer.service.js # HTML/PDF generation
   │  └─ process.service.js  # Job leasing logic
   │
   ├─ /middleware
   │  ├─ errorHandler.js
   │  ├─ asyncHandler.js
   │  └─ validate.js
   │
   ├─ /utils
   │  ├─ logger.js         # Pino logger
   │  ├─ ApiError.js
   │  └─ constants.js
   │
   └─ /libs
      ├─ promptBuilder.js  # buildChunkPrompt(), buildParsePrompt()
      └─ llmSchemas.js     # JSON_SCHEMA_CHUNKS
```

