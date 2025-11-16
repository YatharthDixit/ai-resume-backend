// src/services/parser.service.js
const pdfjs = require('pdfjs-dist');
const logger = require('../utils/logger');
const ApiError = require('../utils/ApiError');
const { StatusCodes } = require('http-status-codes');

/* pdf.js-dist needs a "worker" file. For a simple backend script,
  we can point it to the in-memory version that's bundled.
  This avoids a "Setting up fake worker" warning.
*/
pdfjs.GlobalWorkerOptions.workerSrc = 'pdfjs-dist/build/pdf.worker.js';

/**
 * Extracts raw text AND link annotations from a PDF buffer.
 * @param {Buffer} pdfBuffer - The buffer containing the PDF file
 * @returns {Promise<string>} The extracted text with links appended
 */
const extractText = async (pdfBuffer) => {
  try {
    // Convert the Node.js Buffer to a Uint8Array, as required by pdfjs-dist
    const uint8Array = new Uint8Array(pdfBuffer);

    // Pass the Uint8Array to getDocument
    const doc = await pdfjs.getDocument({ data: uint8Array }).promise;
    let fullText = '';
    const allLinks = [];

    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      
      // 1. Get Text Content
      const textContent = await page.getTextContent();
      const pageText = textContent.items.map(item => item.str).join(' ');
      fullText += pageText + '\n'; // Add newline between pages

      // 2. Get Link Annotations
      const annotations = await page.getAnnotations();
      annotations
        .filter(ann => ann.subtype === 'Link' && ann.url) // Find links with a URL
        .forEach(ann => {
          allLinks.push(ann.url);
        });
    }

    // De-duplicate any links found
    const uniqueLinks = [...new Set(allLinks)];
    
    logger.info(`PDF text extraction successful. Found ${uniqueLinks.length} links.`);

    // Append links to the bottom of the text.
    // This ensures the LLM sees them as part of the context.
    if (uniqueLinks.length > 0) {
      const linkSection = `\n\n--- Extracted Links ---\n${uniqueLinks.join('\n')}\n`;
      return fullText + linkSection;
    }

    return fullText;

  } catch (error) {
    logger.error(error, 'Failed to parse PDF with pdfjs-dist');
    throw new ApiError(
      StatusCodes.INTERNAL_SERVER_ERROR,
      'Failed to parse PDF file.'
    );
  }
};

module.exports = {
  extractText,
};