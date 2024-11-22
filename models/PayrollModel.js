const mongoose = require('mongoose');
const SalarySchema = new mongoose.Schema(
    {
      employeeId: { type: String, required: true},
      fullName: { type: String, required: true },
      baseSalary: { type: Number, required: true },
      totalAllowances: { type: Number, required: true },
      bonus: { type: Number, default: 0 },
      totalDeductions: { type: Number, default: 0 },
      grossPay: { type: Number, required: true },
      netPay: { type: Number, required: true },
      paymentMode: { type: String, default: "Bank Transfer" },
      paymentDate: { type: Date, required: true },
    },
    { timestamps: true }
  );
  
  module.exports = mongoose.model("Salary", SalarySchema);
  