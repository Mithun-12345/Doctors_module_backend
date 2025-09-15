// File: services/aiService.js

const axios = require("axios");
require("dotenv").config();

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
// NEW - Correct model name
const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${GEMINI_API_KEY}`;
/**
 * Takes a piece of text and uses the Gemini API to make it more sharp and formal.
 * @param {string} originalText The text to be improved.
 * @returns {Promise<string>} The polished, formal text.
 */
async function sharpenText(originalText) {
  if (!GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY is not set in the environment variables.");
  }

  const prompt = `You are an expert editor. Rewrite the following text to be more sharp, professional, and formal, while preserving the original meaning. Return only the rewritten text.

Original Text: "${originalText}"

Rewritten Text:`;

  try {
    const response = await axios.post(
      API_URL,
      {
        contents: [{ parts: [{ text: prompt }] }],
      },
      {
        headers: { "Content-Type": "application/json" },
      }
    );

    const sharpenedText = response.data.candidates[0].content.parts[0].text;
    return sharpenedText.trim();
  } catch (error) {
    console.error("Error calling Gemini API:", error.response?.data || error.message);
    // Re-throw the error to be handled by the controller
    throw new Error("Failed to sharpen text using AI.");
  }
}

// Export the function so other files can use it
module.exports = {
  sharpenText,
};