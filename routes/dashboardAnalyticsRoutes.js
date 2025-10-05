const express = require("express");
const mongoose = require("mongoose");
const {
  getPatientEntryCounts,
  getPatientStatusCounts,
  getPendingPaymentsSummary,
  getDebitCreditSummary,
  calculateOverallTatAnalytics,
  getMedicinePreparationStatus
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




module.exports = router;