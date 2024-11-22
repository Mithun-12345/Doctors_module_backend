const SalaryStructure = require("../models/SalaryStructureModel");
const Salary = require("../models/PayrollModel"); // Updated to use the Salary model

// Fetch employee details by Employee ID
exports.getEmployeeDetails = async (req, res) => {
  const { employeeId } = req.params;
  try {
    const employee = await SalaryStructure.findOne({ employeeId });
    if (!employee) {
      return res.status(404).json({ message: "Employee not found" });
    }
    res.status(200).json(employee);
  } catch (error) {
    res.status(500).json({ message: "Server error", error });
  }
};

// Add a salary record
exports.addSalaryRecord = async (req, res) => {
  const formData = req.body;
  const baseSalary = parseFloat(formData.baseSalary) || 0; // Default to 0 if invalid
  const totalAllowances = parseFloat(formData.totalAllowances) || 0;
  const bonus = parseFloat(formData.bonus) || 0;
  const totalDeductions = parseFloat(formData.totalDeductions) || 0;

  // Calculate Gross Pay and Net Pay
  const grossPay = baseSalary + totalAllowances + bonus;
  const netPay = grossPay - totalDeductions;

  // Add grossPay and netPay to the formData object
  formData.grossPay = grossPay;
  formData.netPay = netPay;

  try {
    // Create a new salary record with the calculated gross and net pay
    const newSalary = new Salary(formData);
    await newSalary.save();
    res.status(201).json({ message: "Salary record added successfully", salary: newSalary });
  } catch (error) {
    console.error("Error adding salary record:", error);
    res.status(500).json({ message: "Server error", error });
  }
};
