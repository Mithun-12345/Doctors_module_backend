const express = require("express");
const validateToken = require("../middlewares/validateTokenHandler");
const {
  addDoctor,
  getAvailableSlots,
  getAppointments,
  redirectAppointment,
  doctorDetails,
  getAssistantDoctors,
  getUserRole,
  getDoctorFollow,
  getDoctorById,
  getSettings,
  updateSettings
} = require("../controllers/doctorController");

const { googleAuth, googleCallback } = require("../controllers/googleController");
const { zoomAuth, zoomCallback } = require("../controllers/zoomController");

const router = express.Router();

router.get("/google/authorize", googleAuth);
router.get("/google/callback", googleCallback);

router.get("/zoom/authorize", zoomAuth);
router.get("/zoom/callback", zoomCallback);

// @route   POST /api/doctor/addDoctor
// @desc    Add a new doctor
// @access  Private (admin only)
router.post("/addDoctor", validateToken, addDoctor);

// @route   GET /api/doctor/getAppointments
// @desc    Get all appointments
// @access  Private
router.get("/getAppointments", validateToken, getAppointments);

// @route   GET /api/doctor/availableSlots
// @desc    Get available slots for a specific doctor on a given date
// @access  Public
// router.get('/availableSlots', getAvailableSlots);

router.post("/redirectAppointment", validateToken, redirectAppointment);
router.get('/getAssistantDoctors', validateToken, getAssistantDoctors);
router.get('/getUserRole', validateToken, getUserRole);
router.get('/details', validateToken, doctorDetails);
router.get('/getDoctorFollow', validateToken, getDoctorFollow);
router.get('/byId/:id',validateToken, getDoctorById);
router.get('/getsettings',  validateToken,getSettings);
router.put('/updatesettings',  validateToken,updateSettings);


module.exports = router;
