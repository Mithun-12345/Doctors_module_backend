const express = require('express');
const router = express.Router();
const medicineController = require('../controllers/medicineController');
const rawMaterialController = require('../controllers/rawMaterialController');
const validateToken = require('../middlewares/validateTokenHandler');
// Raw Material routes
router.get('/raw-materials',  rawMaterialController.getAllRawMaterials);
router.get('/raw-materials/:id',  rawMaterialController.getRawMaterial);
router.post('/raw-materials',  rawMaterialController.createRawMaterial);
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

module.exports = router;