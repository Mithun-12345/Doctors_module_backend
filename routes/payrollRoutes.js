const express = require("express");
const { getEmployeeDetails, addSalaryRecord,generatePayslip,getPayslipHistory } = require("../controllers/payrollController.js");

const router = express.Router();

// Route to fetch employee details
router.get("/employee/:employeeID", getEmployeeDetails);

// Route to add payroll record
router.post("/payroll", addSalaryRecord);

router.get("/generate/:employeeID", generatePayslip);

router.get("/history",getPayslipHistory)



module.exports = router;