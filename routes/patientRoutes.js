const express = require("express");
const {
  sendForm,
  patientDetails,
  sendChronicForm,
  bookAppointment,
} = require("../controllers/patientController");
const validateToken = require("../middlewares/validateTokenHandler");

const router = express.Router();

router.post("/sendRegForm", sendForm);
router.post("/sendChronicForm", validateToken, sendChronicForm);
router.get("/details", validateToken, patientDetails);
router.post("/bookAppointment", validateToken, bookAppointment);

module.exports = router;
