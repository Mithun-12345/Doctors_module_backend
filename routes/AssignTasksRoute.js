const express = require('express');
const router = express.Router();
const allocationController = require('../controllers/AssignTasksController');

// Get all doctors
router.get('/doctors', allocationController.getDoctors);

// Get current allocations
router.get('/allocations', allocationController.getAllocations);

// Save allocations
router.post('/allocations', allocationController.saveAllocations);

router.delete('/allocations', allocationController.resetAllocations);

router.get('/permissions', allocationController.getPermissions);
router.post('/permissions', allocationController.updatePermission);
module.exports = router;