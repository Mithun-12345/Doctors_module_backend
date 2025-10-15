const express = require("express");
const mongoose = require("mongoose");
const {
  sendForm,
  patientDetails,
  sendChronicForm,
  bookAppointment,
  deleteAppointment,
  editAppointmentOnce,
  // updateAppointment,
  // getAppointmentsByDate,
  // getAppointmentById,
  // cancelAppointment,
  checkAvailableSlots,
  getAppointment,
  updateAppointment,
  getUserAppointments,
  updateFollowUpStatus,
  updateFollowPatientCall,
  referFriend,
  addFamily,
  getFamilyMembers,
  fetchProfile,
  finalizeAppointment,
  uploadProfilePicture,
  updateProfile,
  getPayments,
  validateCoupon,
  fetchFamilyDetails,
  markProductReceived,
  getPrescriptionsGroupedByPrescriptionId,
  getPrescriptionsGroupedByWeekAndDay,
  savePatientNotification,
  getPatientMedicationSummary,
  updateReminderOffset,
  getTodaysAppointmentsForPatient,
  createDoctorAppointmentInitialSetup,
  appointmentBookingTimeSlot,
  patientAppointmentDates,
  getPendingPaymentsByPatient,
  getAllPaymentsByPatient,
  getPaymentsByPatient,
  getAllAppointmentsForPatientDashboard,
  getBookedAppointmentsByDate,
  getTotalPatients,
  fetchPatientPendingPaymentsToDashboard,
  getPatientReferrals,
  getCompletedPaymentsCount,
  getPastAppointmentsCount,
  getTotalAppointmentsCount,
  getPatientById,
  rescheduleAppointment,
  getAppointmentCountsBasedOnClassification,
  getPatientStatistics,
  getNotInterestedAppointmentCounts,
  getNotInterestedPatientCountsTotal,
  getDashboardStatistics,
  getAllAppointmentCountsByStagePerfect,
  updatePatientAddress,
} = require("../controllers/patientController");
const {
  upload,
  handleMulterError,
} = require("../middlewares/uploadMiddleware");

const {
  pendingAppointment,
  pendingCoupons,
  upComingAppointment,
  transactionHistory,
  pendingTransactions,
  referFriendUI,
  appointments,
  getPatientPayments,
  } = require("../controllers/UIController");

const validateToken = require("../middlewares/validateTokenHandler");

const router = express.Router();
router.get("/appointments/total/count", validateToken, getTotalAppointmentsCount);
router.patch("/sort-classification", getAppointmentCountsBasedOnClassification );
router.get("/sort-total-lost", getNotInterestedPatientCountsTotal );
router.get("/perfect-sort-stage", getAllAppointmentCountsByStagePerfect );
router.patch("/sort-lost-patients", getNotInterestedAppointmentCounts);
router.get("/dashboard-statistics", getDashboardStatistics);
router.get("/classified-total-count",getPatientStatistics);
router.get("/appointments/past", validateToken, getPastAppointmentsCount);
router.get("/payments/count", validateToken, getCompletedPaymentsCount);
router.post("/sendRegForm", sendForm);
router.post("/sendChronicForm", validateToken, sendChronicForm);
router.get("/details", validateToken, patientDetails);
router.get("/payments", validateToken, getPayments);
router.get("/payments-pending-dashboard", validateToken,fetchPatientPendingPaymentsToDashboard);
router.post(
  "/uploadProfilePicture",
  validateToken,
  upload.single("profilePhoto"),
  handleMulterError,
  uploadProfilePicture
);
router.post("/bookAppointment", validateToken, bookAppointment);
router.post("/deleteAppointment/:appointmentId",validateToken,  deleteAppointment);
router.put("/editAppointment/:appointmentId",validateToken, editAppointmentOnce);

router.post("/createDoctorAppointmentInitialSetup",validateToken,createDoctorAppointmentInitialSetup);
router.post("/appointmentBookingTimeSlot",validateToken,appointmentBookingTimeSlot);
router.get("/patientAppointmentDates/:id",validateToken,patientAppointmentDates);
router.get(
  "/pending-payments/:patientId", getPendingPaymentsByPatient
);
router.get("/:patientId/payments",getAllPaymentsByPatient);
router.get("/referrals-dashboard", validateToken, getPatientReferrals);
router.patch('/:id/address', updatePatientAddress);



router.get("/show-all-payments/:patientId", getPaymentsByPatient);
router.get("/total-no-patients",getTotalPatients);

router.put("/updateProfile", validateToken, updateProfile);
router.post("/finalizeAppointment", validateToken, finalizeAppointment);
// router.patch("/updateAppointment/:id", validateToken, updateAppointment);
// router.get("/appointments", validateToken, getAppointmentsByDate);
// router.get("/appointment/:id", validateToken, getAppointmentById);
// router.delete("/appointment/:id", validateToken, cancelAppointment);
router.post("/checkSlots", validateToken, checkAvailableSlots);

router.get("/getUserAppointments", validateToken, getUserAppointments);
router.get("/appointment/:appointmentId", validateToken, getAppointment);
router.patch("/appointment/:appointmentId", validateToken, updateAppointment);
router.put("/updateFollowUp/:patientId", updateFollowUpStatus);
router.put("/updateFollowPatientCall/:patientId", updateFollowPatientCall);
router.post("/referFriend", validateToken, referFriend);
router.get("/validateCoupon", validateCoupon);
router.post("/addFamily", validateToken, addFamily);
router.get("/fetchFamilyDetails", fetchFamilyDetails);
router.get("/getFamilyMembers", validateToken, getFamilyMembers);
router.patch(
  "/prescriptions/:prescriptionId/receive",
  validateToken,
  markProductReceived
);
router.get('/:patientId/todays-appointments', async (req, res) => {
  try {
    const { patientId } = req.params;

    // Best Practice: Validate the ID format before querying the database
    if (!mongoose.Types.ObjectId.isValid(patientId)) {
      return res.status(400).json({ message: "Invalid Patient ID format." });
    }

    // Now, call your function with ONLY the patientId string
    const appointments = await getTodaysAppointmentsForPatient(patientId);

    // Send the successful response back to the client
    res.status(200).json(appointments);

  } catch (error) {
    console.error("Error in GET /patient/:patientId/today route:", error);
    res.status(500).json({ message: "Server error while fetching appointments." });
  }
});
const familyMemberController = require("../controllers/patientController");
const { validate } = require("../models/patientModel");
router.get("/familyMembers", validateToken, familyMemberController.getFamily);
router.get("/familyMembers/search", familyMemberController.searchFamilyMembers);
router.get("/familyMembers/filter", familyMemberController.filterFamilyMembers);
router.get(
  "/familyMembers/:memberId",
  familyMemberController.getFamilyMemberDetails
);
router.put(
  "/familyMembers/:memberId/access",
  familyMemberController.updateFamilyMemberAccess
);
router.post("/familyMembers", familyMemberController.addFamilyMember);
router.delete(
  "/familyMembers/:memberId",
  familyMemberController.removeFamilyMember
);

router.get("/profile", validateToken, fetchProfile);
router.get("/:patientId/appointments-for-dashboard", getAllAppointmentsForPatientDashboard);
router.get("/pendingAppointments", validateToken, pendingAppointment);
router.get("/pendingCoupons", validateToken, pendingCoupons);
router.get("/upComingAppointment", validateToken, upComingAppointment);
router.get("/transactionHistory", validateToken, transactionHistory);
router.get("/pendingTransactions", validateToken, pendingTransactions);
router.get("/referrals", validateToken, referFriendUI);
router.get("/", validateToken, appointments);
router.get("/patientPayments", validateToken, getPatientPayments);
router.post("/storenotifications/:patientId",validateToken, savePatientNotification);
router.patch("/offset/:patientId", updateReminderOffset);   
router.get('/prescriptions/grouped/:patientId', getPrescriptionsGroupedByPrescriptionId); 
router.get(
  "/medication-summary/:patientId",validateToken,  getPatientMedicationSummary);
router.get('/prescriptions/week-view/:patientId', validateToken,getPrescriptionsGroupedByWeekAndDay);
router.get('/getAppointedDocs',validateToken,familyMemberController.getAppointedDocs),
router.get('/patientById/:id', familyMemberController.getPatientById);
router.post("/appointments-by-date", getBookedAppointmentsByDate);
router.patch("/:appointmentId/reschedule", validateToken, rescheduleAppointment);

module.exports = router;
