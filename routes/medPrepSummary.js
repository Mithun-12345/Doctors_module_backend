const express = require('express');
const router = express.Router();
const { upload } = require('../middlewares/uploadMiddleware');
const validateToken = require("../middlewares/validateTokenHandler");
const {
  initializeMedicinePreparation,
  updatePreWeight,
  updatePostWeight,
  getLeakagesAboveThreshold,
  getAllLeakagesDetected,
  getAllMedPrepSummaryData,
  uploadPreparationVideo,
  getPackagingMaterials,
  getAllMedicinePreparationSummaries,
  getRawMaterialByDispenseQuantity,
  updateRawMaterialDispenseQuantity,
  getNonBottlePackagingMaterials,
  updateRawMaterialQuantityByAmount,
  updateMedicinePrepared,
  uploadPreparationPhoto ,
  logWastage,
  addInstructionsToMedicine,
  updateInstructionStatus,
  getPatientAddressFromPrescription,
  addPackagingDetails,
  updateMasterInstructions,
  getAllMasterInstructions,
  setMedicineExpiryDate,
  updateShipmentStatus,
  getFollowUpAppointmentsPrescriptions
} = require('../controllers/medPrepSummary');


// POST to initialize medicine preparation
router.post('/init', initializeMedicinePreparation);
router.patch("/update-preweight", updatePreWeight);
router.patch("/update-postweight", updatePostWeight);
router.get('/leakages/detected', getAllLeakagesDetected);
router.get('/leakages/above-threshold', getLeakagesAboveThreshold);
router.patch('/summary', getAllMedPrepSummaryData );
router.post('/upload-preparation-video', upload.single('video'), uploadPreparationVideo);
router.get('/packaging', getPackagingMaterials );
router.get('/medicine-preparation-summaries', getAllMedicinePreparationSummaries);
router.get('/dispense-check', getRawMaterialByDispenseQuantity);
router.get('/non-bottle-packing',  getNonBottlePackagingMaterials);
router.patch('/dispense', updateRawMaterialDispenseQuantity);
router.patch('/non-bottle-packing-amount',updateRawMaterialQuantityByAmount);
router.patch('/update-medicine-prepared',updateMedicinePrepared);
router.post('/log-wastage',logWastage);
router.post("/upload-preparation-photo", upload.single("photo"), uploadPreparationPhoto);
router.post('/add-instructions', addInstructionsToMedicine);
router.patch('/update-instructions', updateInstructionStatus);
router.get('/:prescriptionId/patient-address', getPatientAddressFromPrescription);
router.post('/add-packaging', upload.single('packedImage'), addPackagingDetails);
router.patch('/update-instructions-settings', updateMasterInstructions);
router.get('/get-all-instructions', getAllMasterInstructions);
router.patch('/set-expiry', setMedicineExpiryDate);
router.patch('/:prescriptionId/update-shipment-status', updateShipmentStatus);
router.get('/follow-up-mp', getFollowUpAppointmentsPrescriptions);

module.exports = router;
