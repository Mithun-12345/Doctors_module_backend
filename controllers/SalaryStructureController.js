const SalaryStructure = require("../models/SalaryStructureModel");

// Save salary structure
exports.saveSalaryStructure = async (req, res) => {
  try {
    const formData = req.body;

    // Validate required fields
    if (!formData.employeeId || !formData.baseSalary || !formData.grossSalary || !formData.netSalary || !formData.totalAllowances || !formData.totalDeductions) {
      return res.status(400).json({ message: "Missing required fields." });
    }

    // Create and save a new salary structure document
    const newSalaryStructure = new SalaryStructure(formData);
    await newSalaryStructure.save();

    res.status(201).json({
      message: "Salary structure saved successfully.",
      salaryStructure: newSalaryStructure,
    });
  } catch (error) {
    console.error("Error saving salary structure:", error);
    res.status(500).json({ message: "Server error. Could not save data." });
  }
};
