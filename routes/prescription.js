const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const Medicine = require('../models/Medicine');
const RawMaterial = require('../models/RawMaterial');
const Prescription = require('../models/Prescription');
const auth = require('../middlewares/validateTokenHandler');
// const prescriptionController = require('../controllers/PrescriptionController');
const { 
  getPrescriptionByAppointmentId, 
  getMyPrescribedAppointments, 
  getPrescribedAppointments, 
  getPrescriptionById, 
  updatePaymentStatus
} = require('../controllers/PrescriptionController');

router.get('/appointment/:appointmentId', auth, getPrescriptionByAppointmentId);
router.get('/prescription', auth, getMyPrescribedAppointments);

router.get('/prescribed-appointments/:userId', auth, getPrescribedAppointments);
router.get('/getById/:prescriptionId', auth, getPrescriptionById);
router.patch('/:prescriptionId/payment', auth, updatePaymentStatus);


// Get all medicines
router.get('/medicines', auth, async (req, res) => {
  try {
    const medicines = await Medicine.find().sort({ name: 1 });
    res.json(medicines);
  } catch (err) {
    console.error('Error fetching medicines:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Add new medicine
router.post('/medicines', auth, async (req, res) => {
  try {
    const { name } = req.body;
    
    // Check if medicine already exists
    let medicine = await Medicine.findOne({ name: { $regex: new RegExp(`^${name}$`, 'i') } });
    
    if (medicine) {
      return res.status(400).json({ message: 'Medicine already exists' });
    }
    
    // Create new medicine
    medicine = new Medicine({ name });
    await medicine.save();
    
    res.status(201).json(medicine);
  } catch (err) {
    console.error('Error adding medicine:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Get all raw materials
router.get('/rawMaterials', auth, async (req, res) => {
  try {
    console.log("Rawmaterials api");
    const rawMaterials = await RawMaterial.find().sort({ name: 1 });
    res.json(rawMaterials);
  } catch (err) {
    console.error('Error fetching raw materials:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Add new raw material
router.post('/rawMaterials', auth, async (req, res) => {
  try {
    const { name } = req.body;
    
    // Check if raw material already exists
    let rawMaterial = await RawMaterial.findOne({ name: { $regex: new RegExp(`^${name}$`, 'i') } });
    
    if (rawMaterial) {
      return res.status(400).json({ message: 'Raw material already exists' });
    }
    
    // Create new raw material
    rawMaterial = new RawMaterial({ name });
    await rawMaterial.save();
    
    res.status(201).json(rawMaterial);
  } catch (err) {
    console.error('Error adding raw material:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Create new prescription
router.post('/create', auth, async (req, res) => {
  try {
    const {
      patientId,
      doctorId,
      appointmentId,
      prescriptionItems,
      followUpDays,
      medicineCharges,
      shippingCharges,
      notes
    } = req.body;

    if (!prescriptionItems || prescriptionItems.length === 0) {
      return res.status(400).json({ message: 'At least one prescription item is required' });
    }

    const prescription = new Prescription({
      patientId,
      doctorId,
      appointmentId,
      prescriptionItems,
      followUpDays,
      medicineCharges,
      shippingCharges,
      notes
    });

    await prescription.save();

    const RawMaterial = require('../models/RawMaterial');

    for (const item of prescriptionItems) {
      if (item.rawMaterialDetails && item.rawMaterialDetails.length > 0) {
        for (const rawMaterial of item.rawMaterialDetails) {
          const inventoryItem = await RawMaterial.findById(rawMaterial._id);
          if (!inventoryItem) throw new Error(`Raw material ${rawMaterial.name} not found in inventory`);

          if (inventoryItem.quantity < rawMaterial.quantity) {
            throw new Error(`Insufficient quantity for ${rawMaterial.name}. Available: ${inventoryItem.quantity} ${inventoryItem.unit}, Required: ${rawMaterial.quantity} ${rawMaterial.unit}`);
          }

          inventoryItem.quantity -= rawMaterial.quantity;
          inventoryItem.updatedAt = Date.now();
          await inventoryItem.save();
        }
      }
    }

    if (appointmentId) {
      const Appointment = require('../models/appointmentModel');
      await Appointment.findByIdAndUpdate(appointmentId, {
        prescriptionCreated: true,
        updatedAt: Date.now()
      });
    }

    res.status(201).json({
      message: 'Prescription created successfully and inventory updated',
      prescription
    });
  } catch (err) {
    console.error('Error creating prescription:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Get all prescriptions for a patient
router.get('/patient/:patientId', auth, async (req, res) => {
  try {
    const prescriptions = await Prescription.find({ 
      patientId: req.params.patientId 
    }).sort({ createdAt: -1 });
    
    res.json(prescriptions);
  } catch (err) {
    console.error('Error fetching patient prescriptions:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Get all prescriptions by a doctor
router.get('/doctor/:doctorId', auth, async (req, res) => {
  try {
    const prescriptions = await Prescription.find({ 
      doctorId: req.params.doctorId 
    }).sort({ createdAt: -1 });
    
    res.json(prescriptions);
  } catch (err) {
    console.error('Error fetching doctor prescriptions:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

module.exports = router;
