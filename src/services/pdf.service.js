// src/services/pdf.service.js
const puppeteer = require('puppeteer');
const logger =require('../utils/logger');

// --- Singleton and Semaphore Logic ---
const MAX_CONCURRENT_PDFS = 5;
let browserInstance = null;
let activeJobs = 0;
const jobQueue = [];
// ---

/**
 * Initializes the singleton browser instance.
 * This is called automatically when the first PDF is requested.
 */
const initializeBrowser = async () => {
  if (browserInstance) return; // Already initialized

  logger.info('Initializing headless browser for PDF generation...');
  try {
    browserInstance = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'], // Recommended for server environments
    });
    logger.info('Headless browser initialized successfully.');
  } catch (error) {
    logger.error(error, 'Failed to initialize headless browser');
    throw error;
  }
};

/**
 * Closes the singleton browser instance.
 * This should be called on application shutdown.
 */
const closeBrowser = async () => {
  if (browserInstance) {
    logger.info('Closing headless browser...');
    await browserInstance.close();
    browserInstance = null;
    logger.info('Headless browser closed.');
  }
};

/**
 * The internal function that actually does the PDF conversion.
 * @param {string} htmlString
 * @returns {Promise<Buffer>}
 */
const _runPdfTask = async (htmlString) => {
  let page = null;
  try {
    page = await browserInstance.newPage();
    await page.setContent(htmlString, {
      waitUntil: 'networkidle0',
    });

    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: {
        top: '20px',
        right: '20px',
        bottom: '20px',
        left: '20px',
      },
    });
    
    return pdfBuffer;
  } finally {
    // Ensure the page is always closed to free up resources
    if (page) {
      await page.close();
    }
  }
};

/**
 * Processes the next job in the queue if a slot is available.
 */
const _processPdfQueue = () => {
  if (activeJobs >= MAX_CONCURRENT_PDFS || jobQueue.length === 0) {
    return; // All slots are busy, or queue is empty
  }

  activeJobs++;
  const { htmlString, resolve, reject } = jobQueue.shift();
  
  _runPdfTask(htmlString)
    .then(resolve)
    .catch(reject)
    .finally(() => {
      // This job is done, free up the slot and process the next
      activeJobs--;
      _processPdfQueue();
    });
};

/**
 * Public-facing function to request a PDF.
 * It initializes the browser, then adds the request to a queue
 * which is processed by the semaphore.
 * @param {string} htmlString - The full HTML document to render
 * @returns {Promise<Buffer>} - A buffer containing the PDF file
 */
const generatePdfBuffer = async (htmlString) => {
  // Ensure the browser is running before queueing the job
  await initializeBrowser();
  
  return new Promise((resolve, reject) => {
    // Add this job to the queue
    jobQueue.push({ htmlString, resolve, reject });
    // Try to process the queue
    _processPdfQueue();
  });
};

module.exports = {
  generatePdfBuffer,
  closeBrowser,
};