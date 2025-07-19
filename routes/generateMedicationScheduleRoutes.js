const express = require("express");
const router = express.Router();
const {
  getTodaysMedicationSchedule,
  updateMedicationStatus,
<<<<<<< HEAD
  notifyDoctorOfMissedDoses
} = require('../controllers/generateMedicationSchedule');
=======
  notifyDoctorOfMissedDoses,
} = require("../controllers/generateMedicationSchedule");
>>>>>>> 803c76dd000e088097487941aaa90f9bfb1a4959

router.get("/schedule/today/:patientId", getTodaysMedicationSchedule);
router.patch("/schedule/status/:patientId", updateMedicationStatus);

<<<<<<< HEAD
// ✅ Updated doctor notification route (corrected to use doctorId)
router.get('/schedule/notify-doctor/:doctorId', notifyDoctorOfMissedDoses);
=======
router.get("/schedule/notify-doctor/:doctorId", notifyDoctorOfMissedDoses);
>>>>>>> 803c76dd000e088097487941aaa90f9bfb1a4959

module.exports = router;

