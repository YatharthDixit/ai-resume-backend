// src/server.js
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { StatusCodes } = require('http-status-codes');
const config = require('./config');
const db = require('./config/db');
const logger = require('./utils/logger');
const apiRoutes = require('./api/routes');
const ApiError = require('./utils/ApiError');
const errorHandler = require('./middleware/errorHandler');

// Only run if ROLE is 'web'
if (config.role !== 'web') {
  logger.info(`Process ROLE is '${config.role}'. Web server will not start.`);
  process.exit(0);
}

logger.info('Starting WEB process...');
const app = express();

// --- Database Connection ---
db.connect();

// --- Core Middleware ---
app.use(helmet()); // Basic security headers
const corsOptions = {
  origin: process.env.NODE_ENV === 'production'
    ? (process.env.FRONTEND_URL || 'http://localhost:3000')
    : '*',
  credentials: true,
  optionsSuccessStatus: 200
};
app.use(cors(corsOptions)); // Enable Cross-Origin Resource Sharing
app.use(express.json()); // Parse JSON bodies
app.use(express.urlencoded({ extended: true })); // Parse URL-encoded bodies

// --- API Routes ---
app.use('/api/v1', apiRoutes);

// --- Not Found Handler ---
app.use((req, res, next) => {
  next(new ApiError(StatusCodes.NOT_FOUND, 'API endpoint not found'));
});

// --- Global Error Handler ---
// This MUST be the last middleware
app.use(errorHandler);

// --- Start Server ---
app.listen(config.port, () => {
  logger.info(`WEB Server listening on port ${config.port}`);
});