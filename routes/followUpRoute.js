const express = require("express");
const router = express.Router();

// Import the controller function
const { updateFollowUpSettings } = require("../controllers/followUpSettingsController"); 

// THE ROUTE
// We use PUT because we are updating global settings
router.put("/follow-up", updateFollowUpSettings);

module.exports = router;