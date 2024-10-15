const express = require('express');
const router = express.Router();
const formController = require('../controllers/formController');

router.post('/first-form', formController.createPatient);
router.post('/predict', formController.predict);
module.exports = router;