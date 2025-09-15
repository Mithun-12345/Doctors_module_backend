// File: routes/textRoutes.js

const express = require("express");
const router = express.Router();
const textController = require("../controllers/geminiTextService");

// This route will handle requests to polish text
router.post("/polish-text", textController.polishText);

module.exports = router;