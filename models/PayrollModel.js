const mongoose = require('mongoose');
const AllowanceSchema = new mongoose.Schema({
  name: { type: String, required: true }, // Name of the allowance (e.g., House Rent Allowance)
  value: { type: Number, required: true ,default: 0}, // Value in ₹
});

// Schema for Deductions
const DeductionSchema = new mongoose.Schema({
  name: { type: String, required: true }, // Name of the deduction (e.g., Tax)
  value: { type: Number, required: true ,default: 0}, // Percentage (e.g., 10 for 10%)
});
const SalarySchema = new mongoose.Schema(
    {
      employeeID: { type: String, required: true},
      name: { type: String, required: true },
      baseSalary: { type: Number, required: true },
      allowances: [AllowanceSchema], // Array of allowances
      deductions: [DeductionSchema], // Array of deductions
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
  
  const Salary = mongoose.model("Salary", SalarySchema);

module.exports = Salary;
