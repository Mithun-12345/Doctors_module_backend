const express = require('express');
const router = express.Router();
const allocationController = require('../controllers/AssignTasksController');

// Get all doctors
router.get('/doctors', allocationController.getDoctors);

router.get('/allocations', allocationController.getAllocations);

router.post('/allocations', allocationController.saveAllocations);

router.delete('/allocations', allocationController.resetAllocations);
module.exports = router;