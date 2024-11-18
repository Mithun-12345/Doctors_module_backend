const express = require('express');
const router = express.Router();
const allocationController = require('../controllers/AssignTasksController');

// Get all doctors
router.get('/doctors', allocationController.getDoctors);

router.get('/allocations', allocationController.getAllocations);

router.post('/allocations', allocationController.saveAllocations);

router.delete('/allocations', allocationController.resetAllocations);

router.get('/allocations-with-doctors', allocationController.getAllocationsWithDoctors);

const IndividualAllocation = require('../models/IndividualAllocation');
const validateToken = require('../middlewares/validateTokenHandler');
router.post('/individual-allocation', async (req, res) => {
    try {
      const { patientId, doctorId } = req.body;
      console.log(patientId, doctorId);
      // Create or update individual allocation
      const allocation = await IndividualAllocation.findOneAndUpdate(
        { patientId },
        { doctorId },
        { upsert: true, new: true }
      ).populate('doctorId');
      
      res.json({ success: true, doctor: allocation.doctorId });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

router.get('/special/:doctorId', 
  // validateToken,
  allocationController.getDoctorSpecialAllocations
);
module.exports = router;