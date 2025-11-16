// src/services/renderer.service.js
const logger = require('../utils/logger');

/**
 * Escapes special HTML characters to prevent XSS
 */
function htmlEscape(str) {
  if (typeof str !== 'string' || !str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Builds the contact info line from the structured object
 * @param {object} contact - The contactInfo object
 * @returns {string} - HTML string for the contact info
 */
function buildContactHtml(contact = {}) {
  const parts = [];
  if (contact.location) {
    parts.push(`<span>${htmlEscape(contact.location)}</span>`);
  }
  if (contact.phone) {
    parts.push(`<span>${htmlEscape(contact.phone)}</span>`);
  }
  if (contact.email) {
    parts.push(
      `<a href="mailto:${htmlEscape(contact.email)}">${htmlEscape(
        contact.email
      )}</a>`
    );
  }
  if (contact.linkedin) {
    // Clean up URL for display
    const linkedInUser = contact.linkedin
      .replace(/https?:\/\/(www\.)?linkedin\.com\/in\//, '')
      .replace(/\/$/, '');
    parts.push(
      `<a href="${htmlEscape(
        contact.linkedin
      )}" target="_blank">linkedin.com/in/${htmlEscape(linkedInUser)}</a>`
    );
  }
  return parts.join(' &bull; ');
}

/**
 * Takes the JSON data and generates a full, self-contained HTML file.
 * (This is your function from script.js)
 * @param {object} data - The resume JSON object
 * @returns {string} - A full HTML document as a string
 */
function generateHtmlString(data) {
  logger.info(`[${data.runId || 'preview'}] Starting to build HTML...`);

  const name = htmlEscape(data.name || '');
  const contactInfo = buildContactHtml(data.contactInfo);

  const objective = htmlEscape(data.objective || '');
  const objectiveSection = objective
    ? `
    <section class="section">
      <h2>Objective</h2>
      <div class="objective-text">${objective}</div>
    </section>
  `
    : '';

  const eduEntries = (data.education || [])
    .map(
      (edu) => `
    <div class="entry">
      <div class="entry-header">
        <span class="entry-title">${htmlEscape(edu.degree)}</span>
        <span class="entry-date">${htmlEscape(
          (edu.details || []).find((d) => d.includes('20')) || ''
        )}</span>
      </div>
      <div class="entry-subtitle">${htmlEscape(edu.school)}</div>
      <div class="entry-details">
        ${(edu.details || [])
          .filter((d) => !d.includes('20'))
          .map((d) => `<span>${htmlEscape(d)}</span>`)
          .join(' &bull; ')}
      </div>
    </div>
  `
    )
    .join('');

  // --- Build Experience Entries ---
  const expEntries = (data.experience || [])
    .map(
      (exp) => {
        const titleText = htmlEscape(exp.role);
        const title = exp.primaryLinkUrl
          ? `<a href="${htmlEscape(
              exp.primaryLinkUrl
            )}" target="_blank" class="entry-title-link">${titleText}</a>`
          : titleText;

        return `
    <div class="entry">
      <div class="entry-header">
        <span class="entry-title">${title}</span>
        <span class="entry-date">${htmlEscape(exp.date)}</span>
      </div>
      <div class="entry-subtitle">${htmlEscape(exp.company)}</div>
      <ul>
        ${(exp.bullets || []).map((b) => `<li>${htmlEscape(b)}</li>`).join('\n')}
      </ul>
      ${
        // Render secondary links
        exp.links && exp.links.length > 0
          ? `<div class="entry-links">
              ${exp.links
                .map(
                  (link) =>
                    `<a href="${htmlEscape(
                      link.url
                    )}" target="_blank">${htmlEscape(link.text)}</a>`
                )
                .join(' &bull; ')}
            </div>`
          : ''
      }
    </div>
  `;
      }
    )
    .join('');

  // --- Build Project Entries ---
  const projEntries = (data.projects || [])
    .map(
      (proj) => {
        const titleText = htmlEscape(proj.name);
        const title = proj.primaryLinkUrl
          ? `<a href="${htmlEscape(
              proj.primaryLinkUrl
            )}" target="_blank" class="entry-title-link">${titleText}</a>`
          : titleText;

        return `
    <div class="entry">
      <div class="entry-header">
        <span class="entry-title">${title}</span>
      </div>
      ${
        proj.description
          ? `<div class="entry-subtitle">${htmlEscape(proj.description)}</div>`
          : ''
      }
      <ul>
        ${(proj.bullets || []).map((b) => `<li>${htmlEscape(b)}</li>`).join('\n')}
      </ul>
      ${
        // Render secondary links
        proj.links && proj.links.length > 0
          ? `<div class="entry-links">
              ${proj.links
                .map(
                  (link) =>
                    `<a href="${htmlEscape(
                      link.url
                    )}" target="_blank">${htmlEscape(link.text)}</a>`
                )
                .join(' &bull; ')}
            </div>`
          : ''
      }
    </div>
  `;
      }
    )
    .join('');

  // --- Build Skills ---
  const skills = data.skills || {};
  const skillsEntry = `
    <div class="skills-grid">
      <b>Languages:</b>    <span>${htmlEscape(skills.languages)}</span>
      <b>Technologies:</b> <span>${htmlEscape(skills.technologies)}</span>
    </div>
  `;

  // --- Build Certifications ---
  const certEntries = (data.certifications || [])
    .map((cert) => `<li>${htmlEscape(cert)}</li>`)
    .join('\n');
  const certSection =
    data.certifications && data.certifications.length > 0
      ? `
    <section class="section">
      <h2>Certifications</h2>
      <ul>${certEntries}</ul>
    </section>
  `
      : '';

  // --- Build Activities ---
  const activityEntries = (data.activities || [])
    .map((act) => `<li>${htmlEscape(act)}</li>`)
    .join('\n');
  const activitySection =
    data.activities && data.activities.length > 0
      ? `
    <section class="section">
      <h2>Extra-Curricular Activities</h2>
      <ul>${activityEntries}</ul>
    </section>
  `
      : '';

  logger.info(`[${data.runId || 'preview'}] HTML components built.`);

  // --- Assemble Full HTML Document ---
  return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Resume - ${name}</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
            line-height: 1.5;
            max-width: 800px; /* A4-ish width */
            margin: 0 auto;
            padding: 30px;
            color: #333;
            background-color: #fff;
        }
        h1, h2 {
            margin: 0;
            padding: 0;
            font-weight: 600;
        }
        a {
            color: #0d6efd;
            text-decoration: none;
        }
        a:hover {
            text-decoration: underline;
        }
        
        /* --- HEADER --- */
        .header {
            text-align: center;
            padding-bottom: 15px;
            border-bottom: 2px solid #000;
            margin-bottom: 15px;
        }
        .header h1 {
            font-size: 32px;
            font-weight: 700;
            letter-spacing: 1px;
            margin-bottom: 5px;
        }
        .header .contact-info {
            font-size: 14px;
            color: #555;
        }
        .header .contact-info a {
            color: #555;
            font-weight: 500;
        }
        .header .contact-info a:hover {
            color: #0d6efd;
        }

        /* --- SECTION --- */
        .section {
            margin-top: 20px;
        }
        .section h2 {
            font-size: 18px;
            text-transform: uppercase;
            letter-spacing: 1px;
            border-bottom: 1px solid #ccc;
            padding-bottom: 3px;
            margin-bottom: 10px;
        }

        /* --- Objective --- */
        .objective-text {
            font-size: 15px;
            font-style: italic;
            color: #444;
        }

        /* --- ENTRY (for Edu, Exp, Proj) --- */
        .entry {
            margin-top: 15px;
        }
        .entry:first-child {
            margin-top: 0;
        }
        .entry-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 2px;
        }
        .entry-title {
            font-size: 16px;
            font-weight: 700;
        }
        .entry-title-link {
            color: #333; /* Make title link black like normal text */
            text-decoration: none;
        }
        .entry-title-link:hover {
            color: #0d6efd; /* On hover, change to blue */
            text-decoration: underline;
        }
        .entry-date {
            font-size: 15px;
            font-weight: 600;
            color: #444;
        }
        .entry-subtitle {
            font-size: 15px;
            font-style: italic;
            color: #555;
            margin-bottom: 5px;
        }
        .entry-details {
            font-size: 14px;
            color: #444;
        }

        /* --- LISTS --- */
        ul {
            margin: 5px 0 0 0;
            padding-left: 20px;
        }
        li {
            margin-bottom: 5px;
        }
        
        /* --- SKILLS --- */
        .skills-grid {
            display: grid;
            grid-template-columns: 140px 1fr;
            gap: 8px;
        }
        .skills-grid b {
            font-weight: 600;
        }

        /* --- STYLES FOR LINKS --- */
        .entry-links {
            margin-top: 8px;
            font-size: 14px;
        }
        .entry-links a {
            color: #0d6efd; /* Standard blue link color */
            text-decoration: none;
            font-weight: 600;
        }
        .entry-links a:hover {
            text-decoration: underline;
        }
        /* Use pseudo-elements for bullet separators */
        .entry-links a:not(:last-child)::after {
            content: ' \\2022 '; /* Unicode for bullet */
            text-decoration: none;
            color: #555;
            padding: 0 0.5em;
        }
    </style>
</head>
<body>

    <header class="header">
        <h1>${name}</h1>
        <div class="