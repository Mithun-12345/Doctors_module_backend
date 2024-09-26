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
  getUserAppointments
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
router.post("/checkSlots", validateToken, checkAvailableSlots);
router.get("/getUserAppointments", validateToken, getUserAppointments);

module.exports = router;
