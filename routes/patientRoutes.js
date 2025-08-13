const express = require("express");
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
  updateReminderOffset
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

router.post("/sendRegForm", sendForm);
router.post("/sendChronicForm", validateToken, sendChronicForm);
router.get("/details", validateToken, patientDetails);
router.get("/payments", validateToken, getPayments);
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
  "/medication-summary/:patientId",validateToken,
  getPatientMedicationSummary
);
router.get('/prescriptions/week-view/:patientId', validateToken,getPrescriptionsGroupedByWeekAndDay);

module.exports = router;
