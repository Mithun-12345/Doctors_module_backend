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
  getFeedbackSummary,
  getOverallClinicAnalytics,
  getAppointmentChartData,
  getDebitCreditChartData,
  getVendorAnalytics,
  getOrderFrequencyChart,
  createFeedbackQuestions,
  getFeedbackQuestions,
  updateFeedbackQuestion,
  deleteFeedbackQuestion,
  submitFeedbackResponse,
  bulkUpdateFeedbackQuestions,
   getListPendingPayments
} = require("../controllers/dashboardAnalyticsController");
const {
  upload,
  handleMulterError,
} = require("../middlewares/uploadMiddleware");
const router = express.Router();

const validateToken = require("../middlewares/validateTokenHandler");

// CREATE: Add one or more new questions
router.patch('/create-questions', validateToken, createFeedbackQuestions);
router.get('/pending-payments-list', getListPendingPayments);


// READ: Get all questions (can filter by category)
router.get('/display-questions', validateToken, getFeedbackQuestions);

// UPDATE: Update a specific question by its ID
router.patch('/update-questions/:id', validateToken, updateFeedbackQuestion);
router.post('/feedback-response', validateToken, submitFeedbackResponse);
router.patch('/questions/bulk-update', validateToken, bulkUpdateFeedbackQuestions);



// DELETE: Delete a specific question by its ID
router.delete('/delete-questions/:id', validateToken, deleteFeedbackQuestion);
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
router.patch('/messenger-summary', getMessageSummary);
router.post('/rate', validateToken, addFeedback);
router.patch('/rate-summary',getFeedbackSummary);
router.get('/attendance-summary', getDoctorAttendanceSummary);
router.patch('/overall-summary', getOverallClinicAnalytics);
router.patch('/appointment-chart', getAppointmentChartData);
router.patch('/dc-chart-data', getDebitCreditChartData);
router.patch('/vendor-summary', getVendorAnalytics);
router.patch('/order-frequency-chart', getOrderFrequencyChart);
module.exports = router;