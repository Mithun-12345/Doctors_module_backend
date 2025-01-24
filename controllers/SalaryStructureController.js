const SalaryStructure = require("../models/SalaryStructureModel");

// Save salary structure
exports.saveSalaryStructure = async (req, res) => {
  try {
    const formData = req.body;

    if (!formData.employeeID|| !formData.baseSalary || !formData.grossSalary || !formData.netSalary) {
      return res.status(400).json({ message: "Missing required fields." });
    }

    // Create or update the salary structure
    const updatedSalaryStructure = await SalaryStructure.findOneAndUpdate(
      { employeeID: formData.employeeID}, // Filter by employeeID
      formData, // Update with new data
      { new: true, upsert: true } // Return updated document, create if not exists
    );

    res.status(201).json({
      message: "Salary structure saved or updated successfully.",
      salaryStructure: updatedSalaryStructure,
    });
  } catch (error) {
    console.error("Error saving/updating salary structure:", error);
    res.status(500).json({ message: "Server error. Could not save/update data." });
  }
};

exports.getSalaryStructures = async (req, res) => {
  try {
    const salaryStructures = await SalaryStructure.find();
    res.status(200).json(salaryStructures);
  } catch (error) {
    console.error('Error fetching salary structures', error);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.getDoctorDetailsById = async (req, res) => {
  try {
    const { employeeID} = req.params; // Extract the employee ID from the request parameters
  
        const salaryDetails = await SalaryStructure.findOne({ employeeID});
        console.log('Employee ID:', employeeID);
        console.log('Salary Details:', salaryDetails);
        if (!salaryDetails) {
            return res.status(404).json({ error: 'Salary details not found' });
        }
        res.status(200).json(salaryDetails);
    } catch (error) {
        console.error('Error retrieving salary details:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
  }

  exports.updateSalaryStructure = async (req, res) => {
    try {
      const { employeeID} = req.body;  // Get the salary structure ID from the request parameters
      const updatedData = req.body;    // Get the updated data from the request body
  
      // Ensure the salaryID is valid (if using ObjectId or another ID format)
      const updatedSalary = await  SalaryStructure.findOneAndUpdate(
        { employeeID},              // Find salary by the unique salaryID
        updatedData,                    // Data to update
        { new: true, runValidators: true } // Return the updated salary and validate the data
      );
  
      // Check if the salary structure is found
      if (!updatedSalary) {
        return res.status(404).json({ error: 'Salary structure not found' });
      }
  
      // Successfully updated
      res.status(200).json({ message: 'Salary structure updated successfully', salary: updatedSalary });
    } catch (error) {
      console.error('Error updating salary structure:', error);
      res.status(500).json({ error: 'Failed to update salary structure' });
    }
  };

 // In EmployeeController.js
exports.deleteSalaryStructure = async (req, res) => {
  try {
    const { employeeID} = req.params;
    const deletedEmployee = await SalaryStructure.findOneAndDelete({ employeeID});

    if (!deletedEmployee) {
      return res.status(404).json({ error: 'Employee not found' });
    }

    res.status(200).json({ message: 'Employee deleted successfully' });
  } catch (error) {
    console.error('Error deleting employee:', error);
    res.status(500).json({ error: 'Failed to delete employee' });
  }
};
