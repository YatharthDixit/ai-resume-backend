// src/api/routes.js
const express = require('express');
const runsRoutes = require('./runs.routes');

const router = express.Router();

// Health check endpoint
router.get('/health', (req, res) => {
  res.status(200).send({ status: 'OK', role: process.env.ROLE || 'unknown' });
});

// Mount all /runs routes at /api/v1/runs
router.use('/runs', runsRoutes);

module.exports = router;