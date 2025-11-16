// src/services/parser.service.js
const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');
const ApiError = require('../utils/ApiError');
const { StatusCodes } = require('http-status-codes');

let pdfjs;
try {
  // try the legacy Node-friendly build first
  pdfjs = require('pdfjs-dist/legacy/build/pdf.js');
} catch (e1) {
  try {
    // try the regular package (may be ESM default exported)
    pdfjs = require('pdfjs-dist');
  } catch (e2) {
    // final fallback: show instructive error
    throw new Error(
      'pdfjs-dist not found. Install with `npm install pdfjs-dist` and retry.'
    );
  }
}

// handle ESM default export shape
if (pdfjs && pdfjs.default) pdfjs = pdfjs.default;

/**
 * Extracts raw text AND link annotations from a PDF buffer.
 * Runs pdfjs without a worker (disableWorker: true) for Node backends.
 */
const extractText = async (pdfBuffer) => {
  try {
    const uint8Array = new Uint8Array(pdfBuffer);

    // IMPORTANT: disableWorker prevents pdfjs from trying to load a worker file
    const loadingTask = pdfjs.getDocument({ data: uint8Array, disableWorker: true });
    const doc = await loadingTask.promise;

    let fullText = '';
    const allLinks = [];

    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items.map((item) => item.str || '').join(' ');
      fullText += pageText + '\n';

      const annotations = await page.getAnnotations();
      annotations.forEach((ann) => {
        // robust link extraction: url, unsafeUrl, action.uri, dest fallback
        const url =
          ann.url ||
          ann.unsafeUrl ||
          (ann.action && (ann.action.uri || ann.action.url)) ||
          null;
        if (url) allLinks.push(url);
        else if (ann.dest) allLinks.push(`(internal dest) ${String(ann.dest)}`);
      });
    }

    const uniqueLinks = [...new Set(allLinks)];
    logger.info(`PDF text extraction successful. Found ${uniqueLinks.length} links.`);

    if (uniqueLinks.length > 0) {
      const linkSection = `\n\n--- Extracted Links ---\n${uniqueLinks.join('\n')}\n`;
      return fullText + linkSection;
    }

    return fullText;
  } catch (error) {
    logger.error(error, 'Failed to parse PDF with pdfjs-dist');
    throw new ApiError(StatusCodes.INTERNAL_SERVER_ERROR, 'Failed to parse PDF file.');
  }
};

module.exports = { extractText };
