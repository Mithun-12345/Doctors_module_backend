const express = require("express");
const router = express.Router();
const IvrCallController = require("../controllers/IvrCallController");

router.post("/webhook", IvrCallController.afterCallWebhook);

module.exports = router;