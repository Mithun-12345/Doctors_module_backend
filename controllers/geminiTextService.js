const aiService = require("../services/geminiservice");

/**
 * API endpoint to receive text and return a polished version.
 */
exports.polishText = async (req, res) => {
  try {
    const { text } = req.body;

    if (!text || typeof text !== 'string') {
      return res.status(400).json({ message: "Text input is required." });
    }

    // Call the service to do the heavy lifting
    const improvedText = await aiService.sharpenText(text);

    return res.status(200).json({
      originalText: text,
      improvedText: improvedText,
    });
  } catch (error) {
    // The service will throw an error if the API call fails
    return res.status(500).json({ message: "An error occurred", error: error.message });
  }
};