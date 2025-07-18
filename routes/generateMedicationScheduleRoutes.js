const express = require('express');
const router = express.Router();
const generateMedicationSchedule = require('../controllers/generateMedicationSchedule');

router.get('/schedule/:prescriptionId', generateMedicationSchedule);

module.exports = router;
