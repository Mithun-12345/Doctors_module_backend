const express = require("express");
const { getEmployeeDetails, addSalaryRecord } = require("../controllers/payrollController");

const router = express.Router();

// Route to fetch employee details
router.get("/employee/:employeeId", getEmployeeDetails);

// Route to add payroll record
router.post("/payroll", addSalaryRecord);

module.exports = router;