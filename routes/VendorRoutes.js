const express = require('express');
const router = express.Router();
const vendorController = require('../controllers/vendorController');
// const { validateVendorInput } = require('../middleware/validate');
const validateToken = require('../middlewares/validateTokenHandler');

// Vendor routes
// router.route('/vendors')
//   .get(vendorController.getAllVendors)
//   .post(validateVendorInput, vendorController.createVendor);

// router.route('/vendors/:id')
//   .get(vendorController.getVendor)
//   .patch(validateVendorInput, vendorController.updateVendor)
//   .delete(vendorController.deleteVendor);

// router.get("/zoom/authorize", validateToken, zoomAuthorize);
router.get("/vendors", validateToken, vendorController.getAllVendors);
router.post("/vendors", validateToken, vendorController.createVendor);
router.patch("/vendors", validateToken, vendorController.updateVendor);
// router.get("/vendors/:id", validateToken, vendorController.updateVendor);
router.delete("/vendors", validateToken, vendorController.deleteVendor);

module.exports = router;