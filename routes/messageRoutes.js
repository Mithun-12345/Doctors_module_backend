const express = require("express");
const router = express.Router();
const { getMessagesBetweenUsers } = require("../controllers/messageController");

router.get("/chat-history", getMessagesBetweenUsers);

module.exports = router;