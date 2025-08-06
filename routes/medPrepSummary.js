const express = require('express');
const router = express.Router();
const validateToken = require("../middlewares/validateTokenHandler");
const {
  initializeMedicinePreparation
} = require('../controllers/medPrepSummary');

// POST to initialize medicine preparation
router.post('/init', initializeMedicinePreparation);

module.exports = router;
