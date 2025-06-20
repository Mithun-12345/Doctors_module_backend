const express = require('express');
const router = express.Router();
const {
  createPrescription,
  getPatientPrescriptions,
  getPrescriptionById,
  updatePrescription,
  closePrescription,
  getMedicines,
  getRawMaterials,
  getDoctorPrescriptions,
  getPrescriptionStats,
  postMedicine,
  updateCloseComment
} = require('../controllers/PrescriptionControl');
const authMiddleware = require('../middlewares/validateTokenHandler');

// Apply auth middleware to all routes
router.use(authMiddleware);

// Prescription CRUD routes
router.post('/create', createPrescription);
router.get('/patient/:patientId', getPatientPrescriptions);
router.get('/prescription/:prescriptionId', getPrescriptionById);
router.put('/prescription/:prescriptionId', updatePrescription);
router.patch('/prescription/:prescriptionId/close', closePrescription);

// Doctor's prescriptions
router.get('/doctor/prescriptions', getDoctorPrescriptions);
router.get('/doctor/stats', getPrescriptionStats);

// Reference data routes
router.get('/medicines', getMedicines);
router.get('/rawMaterials', getRawMaterials);

router.post("/medicines", postMedicine);
// Update close comment
router.patch('/:prescriptionId/closeComment', updateCloseComment);
module.exports = router;