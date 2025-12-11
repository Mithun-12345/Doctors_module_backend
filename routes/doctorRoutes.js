const express = require("express");
const validateToken = require("../middlewares/validateTokenHandler");
// const {createAppointmentTimings} = require("../controllers/doctorAppointmentSettingsController");
const Message = require('../models/messageModel'); // Or whatever the path to your file is

const {
  addDoctor,
  getAvailableSlots,
  getAppointments,
  redirectAppointment,
  getDoctorAppointments,
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
  getPaymentsByDoctor,
  getAllDoctorPaymentsTotal,
  getTodaysAppointments,
  getAppointedPatients,
  getAppointmentWithTimedata,
  consultationNotes,
  chatPatientWithDoctorAndIsReadCount,
  secondFormDetails,
  getTotalAppointmentsForDoctor,
  getTodaysAppointmentCount,
  markShipmentAsLost,
  markAppointmentAsNoShow,
  allowPhoneCalls, 
  incrementCallCount,
  markDoctorAttendance,
  getDoctorAttendanceReport,
  getFollowUpCallList,
  updateFollowUpCallStatus,
  updateFollowUpCall,
  addFollowUpCall,
  incrementCallCountByOne,
  getPrescriptionFollowUpReport,
  getPatientCallReport,
  logWelcomeCallAttempt, 
  rescheduleWelcomeCall,
  getNewPatientDashboard,
  updateWelcomeCallStatus,
  getPatientCallLogs,
  getPatientHistoryForNewDash,
  getPrescriptionsByAppointmentForNewDash,
  updatePrescriptionSpecificStatus,
  getPrescriptionRemindersForNewDash,
  getActiveRemindersByAppointment,
  closePrescriptionsByAppointment
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
router.get("/show-all-payments-doctor/:doctorId", getPaymentsByDoctor);
// GET /api/reminders/appointment/:appointmentId/active
router.get('/appointment/:appointmentId/active', getActiveRemindersByAppointment);
// GET /api/prescriptions/appointment/:appointmentId
router.get('/appointment/:appointmentId', getPrescriptionsByAppointmentForNewDash);
// PUT /api/prescriptions/close-all/:appointmentId
router.put('/close-all/:appointmentId', closePrescriptionsByAppointment);
router.get("/zoom/authorize", zoomAuth);
router.get("/zoom/callback", zoomCallback);
router.get("/show-every-payment", getAllDoctorPaymentsTotal);
router.get('/follow-up-calls', getFollowUpCallList);
router.patch('/update-follow-up-call-status/:appointmentId', updateFollowUpCallStatus);
router.post("/todays-appointments",validateToken,getTodaysAppointments);
router.patch('/update-follow-up-call', updateFollowUpCall);
// PUT /api/prescriptions/status/:prescriptionId
router.put('/status/:prescriptionId', updatePrescriptionSpecificStatus);
// GET /api/reminders/prescription/:prescriptionId
router.get('/prescription-new-dash/:prescriptionId', getPrescriptionRemindersForNewDash);
router.post('/add-follow-up', addFollowUpCall);
router.get('/history/:patientId', getPatientHistoryForNewDash);
router.patch('/:patientId/allow-calls',validateToken, allowPhoneCalls);
router.patch('/increment-call-count-by-one', incrementCallCountByOne);
// GET method since we are just retrieving data
router.get("/reports/prescription-follow-ups", getPrescriptionFollowUpReport);
router.get('/patient-calls', getPatientCallReport);
router.get('/dashboard/new-patients', getNewPatientDashboard);

// 3. Define the route to increment the call count
router.patch('/:patientId/increment-call',validateToken, incrementCallCount);
router.post('/:doctorId/attendance', validateToken, markDoctorAttendance);
router.post('/log-call-attempt', logWelcomeCallAttempt);
router.post('/reschedule-welcome', rescheduleWelcomeCall);
router.put('/update-status', updateWelcomeCallStatus);
router.get('/:patientId/logs', getPatientCallLogs);

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
router.get("/appointments",validateToken, getDoctorAppointments);
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
router.patch('/:prescriptionId/mark-lost',validateToken,markShipmentAsLost);
router.patch(
  '/prescriptions/:prescriptionId/tracking', 
  upload.single('shipmentImage'), 
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
router.get('/getAppointedPatients',validateToken,getAppointedPatients)
router.get('/getAppointmentWithTimedata',validateToken,getAppointmentWithTimedata);
router.post('/consultationNotes', validateToken, consultationNotes)
router.get('/secondFormDetails', validateToken, secondFormDetails);
// patient id's . whose are chat with doctor
router.get("/chatPatientWithDoctorAndIsReadCount",validateToken,chatPatientWithDoctorAndIsReadCount);
router.get("/appointments/total-count", validateToken, getTotalAppointmentsForDoctor);
router.get("/appointments/today/count", validateToken, getTodaysAppointmentCount);
router.patch("/:appointmentId/no-show", validateToken,  markAppointmentAsNoShow);
router.get('/attendance-report', getDoctorAttendanceReport);



module.exports = router;
