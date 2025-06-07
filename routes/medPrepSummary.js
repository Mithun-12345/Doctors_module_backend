const express = require('express');
const router = express.Router();
const controller = require('../controllers/medPrepSummary');
const validateToken = require("../middlewares/validateTokenHandler");

router.post('/summary', validateToken, controller.createSummary);
router.get('/summary/:summaryId', validateToken, controller.getSummaryById);
router.get('/summaries/patient/:patientId', validateToken, controller.getSummariesByPatient);

module.exports = router;
