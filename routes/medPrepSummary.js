const express = require('express');
const router = express.Router();
const controller = require('../controllers/medPrepSummary');
const validateToken = require("../middlewares/validateTokenHandler");
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage() });

router.post('/summary', validateToken, controller.createSummary);
router.get('/summary/:summaryId', validateToken, controller.getSummaryById);
router.get('/summaries/patient/:patientId', validateToken, controller.getSummariesByPatient);

// save the recorded video 

router.patch('/summary/recordVideo',upload.single('video'), controller.saveRecordedVideo);

module.exports = router;
