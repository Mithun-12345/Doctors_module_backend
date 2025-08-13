const express = require("express");
const validateToken = require("../middlewares/validateTokenHandler");
const {createFeedback,editFeedback,viewFeedback } = require("../controllers/docterfeedbackController")

const router = express.Router();


router.post("/createfeedback",validateToken,createFeedback);
router.put("/editFeedback",validateToken,editFeedback);
router.get("/viewfeedback",validateToken,viewFeedback);

module.exports = router;