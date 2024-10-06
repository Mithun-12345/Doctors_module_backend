const express = require('express');
const router = express.Router();
const allocationController = require('../controllers/AssignTasksController');

// Get all doctors
router.get('/doctors', allocationController.getDoctors);

// Get current allocations
router.get('/allocations', allocationController.getAllocations);

// Save allocations
router.post('/allocations', allocationController.saveAllocations);

module.exports = router;