const express = require('express');
const router = express.Router();
const {
  getTodaysMedicationSchedule,
  updateMedicationStatus,
  notifyDoctorIfPatientMissesDoses
} = require('../controllers/generatemedicationSchedule');

// Existing routes
router.get('/schedule/today/:patientId', getTodaysMedicationSchedule);
router.patch('/schedule/status/:patientId', updateMedicationStatus);

// ✅ ADD THIS LINE:
router.get('/schedule/notify-doctor/:patientId', notifyDoctorIfPatientMissesDoses);

module.exports = router;
