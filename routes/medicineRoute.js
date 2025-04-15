const express = require('express');
const router = express.Router();
const medicineController = require('../controllers/medicineController');

// router
//   .route('/')
//   .get(medicineController.getAllMedicines)
//   .post(medicineController.addMedicine);

// router
//   .route('/:id')
//   .get(medicineController.getMedicine)
//   .put(medicineController.updateMedicine)
//   .delete(medicineController.deleteMedicine);

module.exports = router;