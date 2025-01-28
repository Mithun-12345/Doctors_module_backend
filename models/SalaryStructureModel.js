const mongoose = require("mongoose");

// Schema for Allowances
const AllowanceSchema = new mongoose.Schema({
  name: { type: String, required: true }, // Name of the allowance (e.g., House Rent Allowance)
  value: { type: Number, required: true }, // Value in ₹
});

// Schema for Deductions
const DeductionSchema = new mongoose.Schema({
  name: { type: String, required: true }, // Name of the deduction (e.g., Tax)
  value: { type: Number, required: true }, // Percentage (e.g., 10 for 10%)
});

// Main Salary Structure Schema
const SalaryStructureSchema = new mongoose.Schema({
  employeeID: { type: String, required: true }, // Employee ID
  name: { type: String, required: true },
  baseSalary: { type: Number, required: true }, // Base salary in ₹
  allowances: [AllowanceSchema], // Array of allowances
  deductions: [DeductionSchema], // Array of deductions
  grossSalary: { type: Number, required: true }, // Gross salary in ₹
  netSalary: { type: Number, required: true }, // Net salary in ₹
  totalAllowances: { type: Number, required: true }, // Total allowances in ₹
  totalDeductions: { type: Number, required: true }, // Total deductions in ₹
});

// Model creation
const SalaryStructure = mongoose.model("SalaryStructure", SalaryStructureSchema);

module.exports = SalaryStructure;
