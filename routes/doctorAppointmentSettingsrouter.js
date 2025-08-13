const express = require("express");
const router = express.Router();

const {createAppointmentTimings} = require("../controllers/doctorAppointmentSettingsController");

router.post("/createAppointmentTimingsAndPrice",createAppointmentTimings);

module.exports = router;