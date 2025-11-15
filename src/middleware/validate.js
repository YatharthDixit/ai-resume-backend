// src/middleware/validate.js
const { StatusCodes } = require('http-status-codes');
const ApiError = require('../utils/ApiError');

// This middleware generator takes a Zod schema
const validate = (schema) => (req, res, next) => {
  try {
    // We only parse req.body for this project's needs
    schema.parse(req.body);
    next();
  } catch (error) {
    // 'error.errors' is an array of Zod issues
    const errorMessage = error.errors.map((e) => e.message).join(', ');
    next(new ApiError(StatusCodes.BAD_REQUEST, errorMessage));
  }
};

module.exports = validate;