const express = require('express');
const router = express.Router();
const validateToken = require("../middlewares/validateTokenHandler");
const {
  initializeMedicinePreparation,
  updatePreWeight,
  updatePostWeight
} = require('../controllers/medPrepSummary');

// POST to initialize medicine preparation
router.post('/init', initializeMedicinePreparation);
router.patch("/update-preweight", updatePreWeight);
router.patch("/update-postweight", updatePostWeight);

module.exports = router;
