const mongoose = require("mongoose");

const salaryStructureSchema = new mongoose.Schema({
  employeeId: { type: String, required: true },
  baseSalary: { type: Number, required: true },
  allowances: {
    transportAllowance: { type: Number, default: 0 },
    houseRentAllowance: { type: Number, default: 0 },
  },
  totalAllowances: { type: Number, required: true },
  deductions: {
    providentFund: { type: Number, default: 0 },
    gratuity: { type: Number, default: 0 },
    professionalTax: { type: Number, default: 0 },
  },
  totalDeductions: { type: Number, required: true },
  grossSalary: { type: Number, required: true },
  netSalary: { type: Number, required: true },
  
  
});

module.exports = mongoose.model("SalaryStructure", salaryStructureSchema);
  
