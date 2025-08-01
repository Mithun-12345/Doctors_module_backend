const express = require('express');
const router = express.Router();
const medicineController = require('../controllers/medicineController');
const rawMaterialController = require('../controllers/rawMaterialController');
const validateToken = require('../middlewares/validateTokenHandler');
const { upload, handleMulterError } = require('../middlewares/uploadMiddleware');
const AmendmentHistory = require('../models/AmendmentHistory');

// Raw Material routes
router.get('/raw-materials',  rawMaterialController.getAllRawMaterials);
router.get('/raw-materials/:id',  rawMaterialController.getRawMaterial);
router.post(
  '/raw-materials',
  upload.single('productImage'),     // <- attaches Multer
  handleMulterError,         // <- optional error handler
  rawMaterialController.createRawMaterial
);
router.put('/raw-materials/:id',  rawMaterialController.updateRawMaterial);
router.delete('/raw-materials/:id',  rawMaterialController.deleteRawMaterial);
router.get('/medicines', medicineController.getAllMedicines);
router.post('/medicines', medicineController.createMedicine);
router.post('/medicines/calculate-price', medicineController.calculatePrice);
router.get('/medicines/:id', medicineController.getMedicine);
router.put('/medicines/:id', medicineController.updateMedicine);
router.delete('/medicines/:id', medicineController.deleteMedicine);
router.post(
  '/:id/reduce', 
  validateToken, 
  rawMaterialController.reduceQuantity
);
router.get("/barcode/:barcode",rawMaterialController.getRawMaterialByBarcode);
// for threshold
router.get('/threshold',rawMaterialController.thresholdcalculator);

// particular raw material 
router.get('/particularRawmaterial',rawMaterialController.particularRawmaterial);

// amendment log editor
router.patch('/amendmentLogEdit',rawMaterialController.ammendmentlogupdation);

// get all the updated values where ammendent = true 

router.get('/getupdateddocument',rawMaterialController.getAllUpdateddocument);
router.get('/fetchAllAmendmentHistories', rawMaterialController.fetchAllAmendmentHistories);
router.get('/usage-status', rawMaterialController.getUsedAndUnusedRawMaterials);
router.get('/unused/barcode/:barcode', rawMaterialController.getUnusedRawMaterialByBarcode);
router.put('/status-flags/:barcode', rawMaterialController.updateRawMaterialStatusFlags);





module.exports = router;