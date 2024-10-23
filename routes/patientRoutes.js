const express = require("express");
const {
  sendForm,
  patientDetails,
  sendChronicForm,
  bookAppointment,
  // updateAppointment,
  // getAppointmentsByDate,
  // getAppointmentById,
  // cancelAppointment,
  checkAvailableSlots,
  getUserAppointments,
  updateFollowUpStatus,
  updateFollowPatientCall,
  referFriend,
} = require("../controllers/patientController");
const validateToken = require("../middlewares/validateTokenHandler");

const router = express.Router();

router.post("/sendRegForm", sendForm);
router.post("/sendChronicForm", validateToken, sendChronicForm);
router.get("/details", validateToken, patientDetails);
router.post("/bookAppointment", validateToken, bookAppointment);
// router.patch("/updateAppointment/:id", validateToken, updateAppointment);
// router.get("/appointments", validateToken, getAppointmentsByDate);
// router.get("/appointment/:id", validateToken, getAppointmentById);
// router.delete("/appointment/:id", validateToken, cancelAppointment);
router.get("/checkSlots", validateToken, checkAvailableSlots);
router.get("/getUserAppointments", validateToken, getUserAppointments);
router.put("/updateFollowUp/:patientId", updateFollowUpStatus);
router.put("/updateFollowPatientCall/:patientId", updateFollowPatientCall);
router.post("/referFriend", validateToken, referFriend);

module.exports = router;
