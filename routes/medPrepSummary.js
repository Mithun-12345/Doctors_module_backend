const express = require('express');
const router = express.Router();
const validateToken = require("../middlewares/validateTokenHandler");
const {
  initializeMedicinePreparation,
  updatePreWeight,
  updatePostWeight,
  getLeakagesAboveThreshold,
  getAllLeakagesDetected,
  getAllMedPrepSummaryData 
} = require('../controllers/medPrepSummary');

// POST to initialize medicine preparation
router.post('/init', initializeMedicinePreparation);
router.patch("/update-preweight", updatePreWeight);
router.patch("/update-postweight", updatePostWeight);
router.get('/leakages/detected', getAllLeakagesDetected);
router.get('/leakages/above-threshold', getLeakagesAboveThreshold);
router.get('/summary', getAllMedPrepSummaryData );
module.exports = router;
