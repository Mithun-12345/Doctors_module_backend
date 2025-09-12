const Employee = require('../models/doctorModel'); // Import the employee model
const multer = require('multer');
const fs = require('fs');
const path = require("path");
// Configure Multer for multiple PDF uploads

// Set the correct path for your 'uploads' folder
const uploadDir = path.join(__dirname, '../uploads'); // Make sure this is pointing to the correct path

// Check if the uploads folder exists, if not, create it
// if (!fs.existsSync(uploadDir)) {
//   fs.mkdirSync(uploadDir, { recursive: true }); // Create the folder if it doesn't exist
// }

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    // Use the absolute path for the 'uploads' directory
    cb(null, uploadDir); // Ensure no extra subfolders are included in the path
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, file.fieldname + '-' + uniqueSuffix + ext); // Use a unique filename
  },
});

// Multer configuration with file size limit and allowed file types
const upload = multer({
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB size limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype === "application/pdf" || file.mimetype.startsWith("image/")) {
      cb(null, true); // Accept the file
    } else {
      cb(new Error("Only PDF and image files are allowed!"), false);
    }
  },
  storage: storage,
});
// Controller to Add Employee
exports.addEmployee = (req, res) => {
  upload.fields([
    { name: "documents", maxCount: 5 },
    { name: "digitalSignature", maxCount: 1 },
  ])(req, res, async function (err) {
    // 1. Handle Multer File Upload Errors
    if (err) {
      console.error("File upload error:", err.message);
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ error: `File is too large. Maximum size is 10MB.` });
      }
      return res.status(400).json({ error: `File upload error: ${err.message}` });
    }

    // 2. Check for the presence of employeeData
    if (!req.body.employeeData) {
      return res.status(400).json({ error: "employeeData is missing in the request body" });
    }

    let employeeData;
    // 3. Handle JSON Parsing Errors
    try {
      employeeData = JSON.parse(req.body.employeeData);
    } catch (parseError) {
      console.error("JSON Parsing Error:", parseError.message);
      return res.status(400).json({ error: "Invalid format for employeeData. It must be a valid JSON string." });
    }

    // Main logic block
    try {
      // Handle uploaded documents
      const uploadedDocuments = req.files["documents"]?.map((file) => ({
        fileName: file.originalname,
        filePath: file.path,
        fileSize: file.size,
      }));

      // Handle digital signature
      const digitalSignature = req.files["digitalSignature"]?.[0];

      // Add files to employeeData
      employeeData.documents = uploadedDocuments || [];
      if (digitalSignature) {
        employeeData.digitalSignature = {
          fileName: digitalSignature.originalname,
          filePath: digitalSignature.path,
          fileSize: digitalSignature.size,
        };
      }
      
      console.log("details:", employeeData);

      // Save employee to database
      const newEmployee = new Employee(employeeData);
      await newEmployee.save();

      res.status(201).json({
        message: "Employee added successfully!",
        employee: newEmployee,
      });
      
    } catch (error) {
      console.error("Error saving employee:", error); // Log the full error for debugging

      // 4. Handle Mongoose Validation Errors (e.g., required fields missing)
      if (error.name === 'ValidationError') {
        let validationErrors = {};
        for (let field in error.errors) {
          validationErrors[field] = error.errors[field].message;
        }
        return res.status(400).json({ 
          error: "Validation failed. Please check your input.",
          details: validationErrors 
        });
      }

      // 5. Handle Mongoose Duplicate Key Errors (for unique fields)
      if (error.code === 11000) {
        const field = Object.keys(error.keyValue)[0];
        const value = error.keyValue[field];
        return res.status(409).json({ // 409 Conflict is appropriate here
          error: `An employee with this ${field} ('${value}') already exists.`,
        });
      }

      // 6. Generic Catch-All for any other server errors
      res.status(500).json({ error: "Failed to add employee due to an unexpected server error." });
    }
  });
};
exports.generateEmployeeId = async (req, res) => {
  try {
    // Fetch the most recently created employee
    const lastEmployee = await Employee.findOne().sort({ createdAt: -1 });

    // Handle case where no employees exist
    const lastId = lastEmployee?.employeeID || "EMP-00000";

    // Extract the numeric part of the ID
    const numericPart = lastId.split("-")[1]; // "00000"
    const nextNumber = isNaN(parseInt(numericPart)) ? 1 : parseInt(numericPart) + 1; // Fallback to 1 if NaN

    // Generate the new Employee ID
    const newEmployeeID = `EMP-${String(nextNumber).padStart(5, "0")}`; // e.g., "EMP-00001"

    res.status(200).json({ success: true, employeeID: newEmployeeID });
  } catch (error) {
    console.error("Error generating Employee ID:", error);
    res.status(500).json({ success: false, message: "Failed to generate Employee ID" });
  }
};


// Controller to add a new employee
// exports.addEmployee = async (req, res) => {
//   try {
//     const {
//       // Personal Details
//       name,
//       dateOfBirth,
//       gender,
//       maritalStatus,
//       nationality,
//       phone,
//       secondaryContact,
//       personalEmail,
//       currentAddress,
//       permanentAddress,
//       emergencyContactName,
//       emergencyContactRelationship,
//       emergencyContactNumber,

//       // Job Details
//       employeeID,
//       role,
//       department,
//       dateOfJoining,
//       employmentType,
//       workLocation,
//       reportingManager,
//       workShift,

//       // Compensation Details
//       basicSalary,
//       allowances,
//       deductions,
//       bankAccountNumber,
//       bankName,
//       ifscCode,
//       paymentFrequency,
//       pfNumber,
//       esiNumber,
//       taxDeductionPreferences,

//       // System Access
//       usernameSystemAccess,
//       temporaryPassword,
//       accessLevel,
//     //   digitalSignature,

//       // Educational Background
//       highestQualification,
//       specialization,
//       yearOfGraduation,

//       // Work Experience
//       previousEmployer,
//       previousDuration,
//       previousJobRole,
//       totalExperience,

//       // Additional Details
//       certifications,
//       medicalRegistrationNumber,
//     //   documents,
//     } = req.body;

//     // Create a new employee document
//     const newEmployee = new Employee({
//       name,
//       dateOfBirth,
//       gender,
//       maritalStatus,
//       nationality,
//       phone,
//       secondaryContact,
//       personalEmail,
//       currentAddress,
//       permanentAddress,
//       emergencyContactName,
//       emergencyContactRelationship,
//       emergencyContactNumber,
//       employeeID,
//       role,
//       department,
//       dateOfJoining,
//       employmentType,
//       workLocation,
//       reportingManager,
//       workShift,
//       basicSalary,
//       allowances,
//       deductions,
//       bankAccountNumber,
//       bankName,
//       ifscCode,
//       paymentFrequency,
//       pfNumber,
//       esiNumber,
//       taxDeductionPreferences,
//       usernameSystemAccess,
//       temporaryPassword,
//       accessLevel,
//     //   digitalSignature,
//       highestQualification,
//       specialization,
//       yearOfGraduation,
//       previousEmployer,
//       previousDuration,
//       previousJobRole,
//       totalExperience,
//       certifications,
//       medicalRegistrationNumber,
//     //   documents,
//     });

//     // Save the employee to the database
//     await newEmployee.save();

//     res.status(201).json({
//       message: 'Employee added successfully',
//       employee: newEmployee,
//     });
//   } catch (error) {
//     console.error('Error adding employee:', error);
//     res.status(500).json({ error: 'Failed to add employee' });
//   }
// };

// Controller to fetch all employees
exports.getAllEmployees = async (req, res) => {
  try {
    const employees = await Employee.find(); // Fetch all employee documents from the database
    res.status(200).json(employees);
  } catch (error) {
    console.error('Error fetching employees:', error);
    res.status(500).json({ error: 'Failed to fetch employees' });
  }
};

// Controller to fetch a specific employee by ID
exports.getEmployeeById = async (req, res) => {
  try {
    const { employeeID } = req.params; // Extract the employee ID from the request parameters
    // Fetch employee details with the shift populated
    const employee = await Employee.findOne({ employeeID })
      .populate("workShift") // Populate the workShift with Shift details
      .exec();

    if (!employee) {
      return res.status(404).json({ error: 'Employee not found' });
    }

    res.status(200).json(employee);
  } catch (error) {
    console.error('Error fetching employee by ID:', error);
    res.status(500).json({ error: 'Failed to fetch employee' });
  }
};

exports.updateEmployee = async (req, res) => {
  try {
    const { employeeID } = req.params; // Get the employee ID from the request parameters
    const updatedData = req.body; // Get the updated data from the request body

    // Ensure the employeeID is a valid ObjectId (or whatever ID format you're using)
    // Find and update the employee using the employeeID (assuming employeeID is unique in the Employee schema)
    const updatedEmployee = await Employee.findOneAndUpdate(
      { employeeID }, // Find employee by the unique employeeID
      updatedData,     // Data to update
      { new: true, runValidators: true } // Return the updated employee and validate the data
    );

    // Check if employee is found
    if (!updatedEmployee) {
      return res.status(404).json({ error: 'Employee not found' });
    }

    // Successfully updated
    res.status(200).json({ message: 'Employee updated successfully', employee: updatedEmployee });
  } catch (error) {
    console.error('Error updating employee:', error);
    res.status(500).json({ error: 'Failed to update employee' });
  }
};


exports.deleteEmployee = async (req, res) => {
  try {
    const { employeeID } = req.params; // Get the employee ID from the request parameters

    const deletedEmployee = await Employee.findOneAndDelete({employeeID}); // Delete employee by ID

    if (!deletedEmployee) {
      return res.status(404).json({ error: 'Employee not found' });
    }

    res.status(200).json({ message: 'Employee deleted successfully' });
  } catch (error) {
    console.error('Error deleting employee:', error);
    res.status(500).json({ error: 'Failed to delete employee' });
  }
};

// Fetch logged-in doctor's profile
exports.getDoctorProfile = async (req, res) => {
  const doctorId = req.user.id; // Assume the doctor ID is in the token payload
  const doctor = await Employee.findById(doctorId).select("name employeeID");

  if (!doctor) {
    return res.status(404).json({ message: "Doctor not found" });
  }

  res.status(200).json({
    name: doctor.name,
    employeeID: doctor.employeeID,
   
  });
};