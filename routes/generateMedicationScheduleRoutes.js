const express = require("express");
const router = express.Router();
const {
  getTodaysMedicationSchedule,
  updateMedicationStatus,
  getMedicationForDailyIntake,
  notifyDoctorOfMissedDoses
} = require('../controllers/generateMedicationSchedule');

router.get("/schedule/today/:patientId", getTodaysMedicationSchedule);
router.patch("/schedule/status/:patientId", updateMedicationStatus);
router.get("/schedule/daily/:patientId", getMedicationForDailyIntake);
// ✅ Updated doctor notification route (corrected to use doctorId)
router.get('/schedule/notify-doctor/:doctorId', notifyDoctorOfMissedDoses);

module.exports = router;

