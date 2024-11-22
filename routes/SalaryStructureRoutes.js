const express = require("express");
const { saveSalaryStructure } = require("../controllers/SalaryStructureController");

const router = express.Router();

// POST route to save salary structure
router.post("/save", saveSalaryStructure);

module.exports = router;