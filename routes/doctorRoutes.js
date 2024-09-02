const express = require('express');
const validateToken = require('../middlewares/validateTokenHandler');
const {
  addDoctor,
  getAvailableSlots,
  getAppointments
} = require('../controllers/doctorController');

const router = express.Router();

// @route   POST /api/doctor/addDoctor
// @desc    Add a new doctor
// @access  Private (admin only)
router.post('/addDoctor', validateToken, addDoctor);

// @route   GET /api/doctor/getAppointments
// @desc    Get all appointments
// @access  Private
router.get('/getAppointments', validateToken, getAppointments);

// @route   GET /api/doctor/availableSlots
// @desc    Get available slots for a specific doctor on a given date
// @access  Public
// router.get('/availableSlots', getAvailableSlots);

module.exports = router;
