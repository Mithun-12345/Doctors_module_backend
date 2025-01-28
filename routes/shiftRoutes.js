const express = require("express");
const router = express.Router();
const { saveShifts, getShifts, getShiftDetails, getDoctors, addShiftSettings } = require("../controllers/ShiftController.js");

// Route to save or update shifts
router.post("/saveshift", saveShifts);

// Route to get all shifts
router.get("/getshift", getShifts);

// Route to get shifts for leave
router.get("/getShiftDetails", getShiftDetails);

// Route to fetch all doctors
router.get('/getdoctors', getDoctors);

// Route to add shift settings
router.post('/addshift', addShiftSettings);
module.exports = router;
