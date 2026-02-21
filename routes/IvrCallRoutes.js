const express = require("express");
const router = express.Router();
const IvrCallController = require("../controllers/IvrCallController");



router.post("/call-patient", IvrCallController.callPatient);

router.all("/check-patient", IvrCallController.checkPatient);


module.exports = router;
