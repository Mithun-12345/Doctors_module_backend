const express = require("express");
const router = express.Router();
const controller = require("../controllers/consumptionController");

router.get("/:form", controller.getOptionsByForm);
router.post("/", controller.addOption);

module.exports = router;
