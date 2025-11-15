// src/api/runs.routes.js
const express = require('express');
const multer = require('multer');
const { StatusCodes } = require('http-status-codes');
const runsController = require('./runs.controller');
const validate = require('../middleware/validate');
const { createRunSchema } = require('./runs.validation');
const asyncHandler = require('../middleware/asyncHandler');
const ApiError = require('../utils/ApiError');
const router = express.Router();

// Configure Multer for in-memory storage and file filtering
const upload = multer({
  storage: multer.memoryStorage(), // Keeps file as a buffer in req.file.buffer
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter(req, file, cb) {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new ApiError(StatusCodes.BAD_REQUEST, 'Only PDF files are allowed.'));
    }
  },
});

// POST /api/v1/runs
router.post(
  '/',
  upload.single('file'), // 'file' is the form-data key
  validate(createRunSchema), // Validates req.body.instruction_text
  asyncHandler(runsController.createRun) // Runs the controller
);

// GET /api/v1/runs/:runId/status
router.get(
  '/:runId/status',
  asyncHandler(runsController.getRunStatus)
);

// GET /api/v1/runs/:runId/preview-html
router.get(
  '/:runId/preview-html',
  asyncHandler(runsController.getPreviewHtml)
);

module.exports = router;