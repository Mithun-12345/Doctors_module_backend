const Employee = require('../models/EmployeeModel'); // Import the employee model

// Controller to add a new employee
exports.addEmployee = async (req, res) => {
  try {
    const {
      // Personal Details
      fullName,
      dateOfBirth,
      gender,
      maritalStatus,
      nationality,
      primaryContact,
      secondaryContact,
      personalEmail,
      currentAddress,
      permanentAddress,
      emergencyContactName,
      emergencyContactRelationship,
      emergencyContactNumber,

      // Job Details
      employeeID,
      jobTitle,
      department,
      dateOfJoining,
      employmentType,
      workLocation,
      reportingManager,
      workShift,

      // Compensation Details
      basicSalary,
      allowances,
      deductions,
      bankAccountNumber,
      bankName,
      ifscCode,
      paymentFrequency,
      pfNumber,
      esiNumber,
      taxDeductionPreferences,

      // System Access
      usernameSystemAccess,
      temporaryPassword,
      accessLevel,
    //   digitalSignature,

      // Educational Background
      highestQualification,
      specialization,
      yearOfGraduation,

      // Work Experience
      previousEmployer,
      previousDuration,
      previousJobRole,
      totalExperience,

      // Additional Details
      certifications,
      medicalRegistrationNumber,
    //   documents,
    } = req.body;

    // Create a new employee document
    const newEmployee = new Employee({
      fullName,
      dateOfBirth,
      gender,
      maritalStatus,
      nationality,
      primaryContact,
      secondaryContact,
      personalEmail,
      currentAddress,
      permanentAddress,
      emergencyContactName,
      emergencyContactRelationship,
      emergencyContactNumber,
      employeeID,
      jobTitle,
      department,
      dateOfJoining,
      employmentType,
      workLocation,
      reportingManager,
      workShift,
      basicSalary,
      allowances,
      deductions,
      bankAccountNumber,
      bankName,
      ifscCode,
      paymentFrequency,
      pfNumber,
      esiNumber,
      taxDeductionPreferences,
      usernameSystemAccess,
      temporaryPassword,
      accessLevel,
    //   digitalSignature,
      highestQualification,
      specialization,
      yearOfGraduation,
      previousEmployer,
      previousDuration,
      previousJobRole,
      totalExperience,
      certifications,
      medicalRegistrationNumber,
    //   documents,
    });

    // Save the employee to the database
    await newEmployee.save();

    res.status(201).json({
      message: 'Employee added successfully',
      employee: newEmployee,
    });
  } catch (error) {
    console.error('Error adding employee:', error);
    res.status(500).json({ error: 'Failed to add employee' });
  }
};
