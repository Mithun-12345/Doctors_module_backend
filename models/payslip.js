const mongoose = require('mongoose');

const PayslipSchema = new mongoose.Schema({
  employeeID: { type: String, required: true },
  name: { type: String, required: true },
  dateOfJoining: { type: Date, required: true },
  department: { type: String, required: true },
//   totalWorkedDays: { type: Number, required: true },
//   totalWorkingDays: { type: Number, required: true },
  allowances: [
    {
      name: { type: String, required: true },
      value: { type: Number, required: true },
    },
  ],
  deductions: [
    {
      name: { type: String, required: true },
      value: { type: Number, required: true },
    },
  ],
  grossPay: { type: Number, required: true },
 
  totalDeduction: { type: Number, required: true },
  netPay: { type: Number, required: true },
  payPeriod: { type: Date, required: true },
  earnings: [
    {
      name: { type: String, required: true },
      value: { type: Number, required: true },
    },
  ], 
});

const Payslip= mongoose.model("Payslip", PayslipSchema);

module.exports = Payslip;
