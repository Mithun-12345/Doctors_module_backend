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
  logWastage
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


module.exports = router;
