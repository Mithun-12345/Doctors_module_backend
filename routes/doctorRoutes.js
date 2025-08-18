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
  getDoctorByFollow,
  getDoctorById,
  getSettings,
  updateSettings,
  getAllAppointments,
  getAllAppointmentsWithPatientData,
  submitNotes,
  fetchProfile,
  updateProfile,
  uploadProfilePicture,
  getDeliveryStatusByPatient,
  updateTrackingId,
  getDoctorPatientMedicationSummary,
  startPrescription,
} = require("../controllers/doctorController");
const {
  upload,
  handleMulterError,
} = require("../middlewares/uploadMiddleware");

const {
  googleAuth,
  googleCallback,
} = require("../controllers/googleController");
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
router.get("/getAssistantDoctors", validateToken, getAssistantDoctors);
router.get("/getUserRole", validateToken, getUserRole);
router.get("/details", validateToken, doctorDetails);
router.get("/getDoctorFollow", validateToken, getDoctorFollow);
router.get("/byId/:id", validateToken, getDoctorById);
router.get("/getsettings", validateToken, getSettings);
router.put("/updatesettings", validateToken, updateSettings);
router.get("/getAllAppointments", validateToken, getAllAppointments);
router.get(
  "/getAllAppointmentsWithPatientData",
  getAllAppointmentsWithPatientData
);
router.post("/notes", validateToken, submitNotes);

router.get("/profile", validateToken, fetchProfile);
router.post(
  "/uploadProfilePicture",
  validateToken,
  upload.single("profilePhoto"),
  handleMulterError,
  uploadProfilePicture
);
router.get(
  "/prescriptions/delivery-status/:patientId",
  getDeliveryStatusByPatient
);

router.put("/updateProfile", validateToken, updateProfile);
router.patch(
  "/prescriptions/:prescriptionId/start",
  startPrescription
);
router.patch(
  "/prescriptions/:prescriptionId/tracking", 
   updateTrackingId
);
router.get("/medications/summary/:doctorId", getDoctorPatientMedicationSummary);

router.get("/profile", validateToken, fetchProfile);
router.post(
  "/uploadProfilePicture",
  validateToken,
  upload.single("profilePhoto"),
  handleMulterError,
  uploadProfilePicture
);
router.put("/updateProfile", validateToken, updateProfile);
router.get("/doctor/me", validateToken, getDoctorByFollow);

module.exports = router;
