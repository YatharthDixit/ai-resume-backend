// src/services/ats.service.js
const logger = require('../utils/logger');

/**
 * Calculates a simple keyword match score between the resume text and the job description.
 * @param {string} resumeText - The full text extracted from the resume.
 * @param {string} jobDescription - The job description text provided by the user.
 * @returns {object} { score, missingKeywords }
 */
const calculateScore = (resumeText, jobDescription) => {
    if (!jobDescription || !resumeText) {
        return { score: 0, missingKeywords: [] };
    }

    // 1. Tokenize and clean the texts
    const cleanText = (text) =>
        text
            .toLowerCase()
            .replace(/[^\w\s]/g, '') // Remove punctuation
            .split(/\s+/)
            .filter((word) => word.length > 3); // Filter out short words

    const resumeTokens = new Set(cleanText(resumeText));
    const jdTokens = cleanText(jobDescription);

    // 2. Extract potential keywords from JD (simple frequency analysis)
    const frequencyMap = {};
    jdTokens.forEach((token) => {
        frequencyMap[token] = (frequencyMap[token] || 0) + 1;
    });

    // Filter top keywords (appearing more than once, or just top N unique)
    // For MVP, let's take the top 20 most frequent words from the JD
    const sortedKeywords = Object.entries(frequencyMap)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 20)
        .map(([word]) => word);

    // 3. Check for matches
    const missingKeywords = [];
    let matchCount = 0;

    sortedKeywords.forEach((keyword) => {
        if (resumeTokens.has(keyword)) {
            matchCount++;
        } else {
            missingKeywords.push(keyword);
        }
    });

    // 4. Calculate Score
    const score = Math.round((matchCount / sortedKeywords.length) * 100) || 0;

    return {
        score,
        missingKeywords,
    };
};

module.exports = {
    calculateScore,
};
