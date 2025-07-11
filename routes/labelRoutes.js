const express = require("express");
const router = express.Router();
const labelController = require("../controllers/labelController");

router.get("/labels", labelController.getLabels);
router.post("/labels", labelController.addLabel);

module.exports = router;
