const express = require('express');
const { addEmployee, getAllEmployees, getEmployeeById,updateEmployee,deleteEmployee,getDoctorProfile, generateEmployeeId } = require('../controllers/employeeController');
const validateToken = require("../middlewares/validateTokenHandler");
const router = express.Router();

// Route to add an employee
router.post('/add', addEmployee);

router.get("/generate-employee-id", generateEmployeeId); // Generate Employee ID

// Route to fetch all employees
router.get('/all',  getAllEmployees);

// Route to fetch an employee by ID
router.get('/getEmployeeById/:employeeID', getEmployeeById);

// Route to update an employee by ID
router.put('/updateEmployee/:employeeID', updateEmployee);

// Route to delete an employee by ID
router.delete('/delete/:employeeID', deleteEmployee);

router.get("/profile",validateToken, getDoctorProfile);
module.exports = router;
