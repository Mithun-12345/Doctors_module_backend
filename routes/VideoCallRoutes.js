const express = require("express");
const router = express.Router();
const { zoomAuthorize, zoomCallback, googleAuthorize, googleCallback, generateSignature } = require("../controllers/videoCallAuthController");
const validateToken = require("../middlewares/validateTokenHandler"); // Assuming your validator function is in middleware folder

// Zoom OAuth Authorization Route (Protected)
router.get("/zoom/authorize", validateToken, zoomAuthorize);

// Zoom OAuth Callback Route (Protected)
router.get("/zoom/callback", zoomCallback);

// Google OAuth Authorization Route (Protected)
router.get("/google/authorize", validateToken, googleAuthorize);

// Google OAuth Callback Route (Protected)
router.get("/google/callback", googleCallback);

router.post('/signature', validateToken, generateSignature);
module.exports = router;
