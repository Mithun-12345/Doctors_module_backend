const express = require("express");
const router = express.Router();
const {
  getTodaysMedicationSchedule,
  updateMedicationStatus,
  getMedicationForDailyIntake,
  notifyDoctorOfMissedDoses,
  getMedicationStockStatus
} = require('../controllers/generateMedicationSchedule');

router.get("/schedule/today/:patientId", getTodaysMedicationSchedule);
router.patch("/schedule/status/:patientId", updateMedicationStatus);
router.get("/schedule/daily/:patientId", getMedicationForDailyIntake);
router.get('/schedule/notify-doctor/:doctorId', notifyDoctorOfMissedDoses);
router.get('/medication-stock/:patientId', getMedicationStockStatus);

module.exports = router;

