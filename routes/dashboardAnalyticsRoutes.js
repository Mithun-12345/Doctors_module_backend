const express = require("express");
const mongoose = require("mongoose");
const {
  getPatientEntryCounts,
  getPatientStatusCounts,
  getPendingPaymentsSummary,
  getDebitCreditSummary,
  calculateOverallTatAnalytics,
  getMedicinePreparationStatus,
  getAppointmentSummaryForDay,
  getShipmentSummary,
  getPatientAdherenceSummary,
  getRawMaterialStockSummary,
  getMessageSummary,
  addFeedback,
  getDoctorAttendanceSummary,
  getFeedbackSummary
} = require("../controllers/dashboardAnalyticsController");
const {
  upload,
  handleMulterError,
} = require("../middlewares/uploadMiddleware");
const router = express.Router();

const validateToken = require("../middlewares/validateTokenHandler");

router.patch('/entry-counts', getPatientEntryCounts);
router.patch('/status-counts', getPatientStatusCounts);
router.get('/pending-payments', getPendingPaymentsSummary);
router.patch('/debit-credit-summary', getDebitCreditSummary);
router.patch('/TAT',calculateOverallTatAnalytics);
router.patch('/preparation-status', getMedicinePreparationStatus);
router.patch('/appointment-summary-by-date', getAppointmentSummaryForDay);
router.patch('/adherence-summary', getPatientAdherenceSummary);
router.patch('/shipment-summary',getShipmentSummary);
router.patch('/stock-summary', getRawMaterialStockSummary);
router.post('/summary', getMessageSummary);
router.post('/rate', validateToken, addFeedback);
router.get('/rate-summary', validateToken, getFeedbackSummary);
router.get('/attendance-summary', getDoctorAttendanceSummary);



module.exports = router;