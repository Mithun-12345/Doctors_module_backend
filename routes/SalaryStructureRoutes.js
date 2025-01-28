const express = require("express");
const { saveSalaryStructure,getSalaryStructures,getDoctorDetailsById ,updateSalaryStructure,deleteSalaryStructure } = require("../controllers/SalaryStructureController");

const router = express.Router();

// POST route to save salary structure
router.post("/save", saveSalaryStructure);
router.get("/fetch",getSalaryStructures);
router.get("/retrive/:employeeID",getDoctorDetailsById);
router.put("/update",updateSalaryStructure);
router.delete("/delete/:employeeID",deleteSalaryStructure);


module.exports = router;