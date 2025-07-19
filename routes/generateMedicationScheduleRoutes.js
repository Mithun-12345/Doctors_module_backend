const express = require("express");
const router = express.Router();
const {
  getTodaysMedicationSchedule,
  updateMedicationStatus,
  notifyDoctorOfMissedDoses,
} = require("../controllers/generateMedicationSchedule");

router.get("/schedule/today/:patientId", getTodaysMedicationSchedule);
router.patch("/schedule/status/:patientId", updateMedicationStatus);

router.get("/schedule/notify-doctor/:doctorId", notifyDoctorOfMissedDoses);

module.exports = router;
