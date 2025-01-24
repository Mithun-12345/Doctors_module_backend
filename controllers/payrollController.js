const SalaryStructure = require("../models/SalaryStructureModel");
const Salary = require("../models/PayrollModel"); // Updated to use the Salary model
const Doctor = require("../models/doctorModel");
const Payslip = require("../models/payslip")
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
// Fetch employee details by Employee ID
exports.getEmployeeDetails = async (req, res) => {
  const { employeeID} = req.params;
  try {
    const employee = await SalaryStructure.findOne({ employeeID});
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

exports.generatePayslip = async (req, res) => {
  try {
    const { employeeID } = req.params;

    // Fetch employee details
    const employee = await Doctor.findOne({ employeeID: String(employeeID) });
    if (!employee) {
      return res.status(404).json({ message: 'Employee not found' });
    }

    const salary = await Salary.findOne({ employeeID });
    if (!salary) {
      return res.status(404).json({ message: 'No salary records found for this employee' });
    }

    const payslipDetails = {
      employeeID: employee.employeeID,
      name: employee.name,
      dateOfJoining: employee.dateOfJoining,
      department: employee.department,
      baseSalary: salary.baseSalary,
      bonus: salary.bonus,
      allowances: salary.allowances.map((allowance) => ({
        name: allowance.name,
        value: allowance.value,
      })),
      deductions: salary.deductions.map((deduction) => ({
        name: deduction.name,
        value: deduction.value,
      })),
      grossPay: salary.grossPay,
      totalDeduction: salary.totalDeductions,
      netPay: salary.netPay,
      payPeriod: salary.paymentDate,
      earnings: [
        { description: 'Base Salary', amount: salary.baseSalary },
        { description: 'Bonus', amount: salary.bonus },
        ...salary.allowances.map((allowance) => ({
          description: allowance.name,
          amount: allowance.value,
        })),
      ],
    };
    // const payslip = new Payslip(payslipDetails);
    // await payslip.save();
    const uploadsPath = path.join(__dirname, '../uploads');
    if (!fs.existsSync(uploadsPath)) {
      fs.mkdirSync(uploadsPath, { recursive: true });
    }

    const doc = new PDFDocument();
    const fileName = `payslip_${employeeID}.pdf`;
    const filePath = path.join(uploadsPath, fileName);
    const writeStream = fs.createWriteStream(filePath);
    doc.pipe(writeStream);

 // Function to format date
const formatDate = (date) => {
  if (!date) return 'N/A';
  return new Date(date).toLocaleDateString('en-GB'); // Format DD/MM/YYYY
};
// Define colors
const headerColor = '#000000'; // Blue for headers
const subHeaderColor = '#000000'; // Green for subheaders
const textColor = '#000000'; // Black for main text
const dividerColor = '#CCCCCC'; // Grey for dividers
const highlightColor = '#000000'; // Orange for highlights (e.g., Net Pay)

const renderTableRow = (doc, description, amount, x, y) => {
  // Render a single row in the table with description and amount
  doc
    .fontSize(10)
    .font('Helvetica')
    .text(description, x, y, { width: descriptionColumnWidth })
    .text(`₹${amount}`, x + descriptionColumnWidth + 20, y, { width: amountColumnWidth, align: 'right' });
};
 // Define the column widths
 const descriptionColumnWidth = 300; // Adjust as per your layout
 const amountColumnWidth = 150; // Adjust as per your layout
 const tableRowGap = 20; // Gap between rows in the table
// Payslip Header
doc
  .fontSize(22)
  .font('Helvetica-Bold')
  .fillColor(headerColor)
  .text('Payslip', { align: 'center' })
  .moveDown(0.5);

// Company Details
doc
  .fontSize(12)
  .font('Helvetica-Bold')
  .fillColor(subHeaderColor)
  .text('Company Name: Consult Homeopathy', { align: 'center' });
doc
  .fontSize(10)
  .font('Helvetica')
  .fillColor(textColor)
  .text('Address: 123 Main Street, City, Country', { align: 'center' })
  .moveDown(1.5);

// Employee Details Section (Left and Right Columns)
const leftColumnX = 50; 
const rightColumnX = 400;
let currentY = doc.y;

doc
  .fontSize(10)
  .font('Helvetica')
  .fillColor(textColor)
  .text(`Date of Joining: ${formatDate(payslipDetails.dateOfJoining)}`, leftColumnX, currentY)
  .moveDown(0.2);
doc.text(`Pay Period: ${formatDate(payslipDetails.payPeriod)}`, leftColumnX, doc.y).moveDown(0.2);
doc.text(`Total Working Days: 26`, leftColumnX, doc.y).moveDown(0.2);
doc.text(`Department: ${payslipDetails.department}`, leftColumnX, doc.y).moveDown(1);

doc
  .text(`Employee Name: ${payslipDetails.name}`, rightColumnX, currentY)
  .moveDown(0.2);
doc.text(`Designation: Assistant Doctor`, rightColumnX, doc.y).moveDown(0.2);
doc.text(`Total Worked Days: 24`, rightColumnX, doc.y).moveDown(1);

// Adjust space below employee details to prevent overlap
currentY = doc.y + 10; // Add extra space between sections

// Divider Line
doc
  .moveTo(50, currentY)
  .lineTo(550, currentY)
  .stroke(dividerColor)
  .moveDown(1);
  currentY = doc.y + 10; // Add extra space between sections

doc
.moveDown(2)
  .fontSize(10)
  .font('Helvetica-Bold')
  .fillColor(headerColor)
  .text('Earnings', leftColumnX, doc.y, { width: descriptionColumnWidth })
  .text('Amount', leftColumnX + descriptionColumnWidth + 20, doc.y, { width: amountColumnWidth, align: 'right' })
  .moveDown(0.5);

// Render Earnings Rows
const earnings = [
  { description: 'Base Salary', amount: payslipDetails.baseSalary },
  { description: 'Bonus', amount: payslipDetails.bonus },
  ...payslipDetails.allowances.map((allowance) => ({
    description: allowance.name,
    amount: allowance.value,
  })),
];

earnings.forEach((earning) => {
  renderTableRow(doc, earning.description, earning.amount, leftColumnX, doc.y);
  currentY = doc.y + tableRowGap;
});

// Gross Pay
doc
  .moveDown(2)
  .fontSize(12)
  .font('Helvetica-Bold')
  .fillColor(highlightColor)
  .text('Gross Pay', leftColumnX, currentY, { width: descriptionColumnWidth })
  .text(`₹${payslipDetails.grossPay}`, leftColumnX + descriptionColumnWidth + 20, currentY, { width: amountColumnWidth, align: 'right' });

// Deductions Table Header
currentY = doc.y + 10;
doc
  .moveDown(2)
  .fontSize(10)
  .font('Helvetica-Bold')
  .fillColor(headerColor)
  .text('Deduction', leftColumnX, doc.y, { width: descriptionColumnWidth})
  .text('Amount', leftColumnX +descriptionColumnWidth + 20, doc.y, { width: amountColumnWidth, align: 'right' })
  .moveDown(0.5);

// Render Deductions Rows
const deductions = payslipDetails.deductions.map((deduction) => ({
  description: deduction.name,
  amount: deduction.value,
}));

deductions.forEach((deduction) => {
  renderTableRow(doc, deduction.description, deduction.amount, leftColumnX, doc.y);
  currentY = doc.y + tableRowGap;
});

// Total Deductions
doc
  .moveDown(1)
  .font('Helvetica-Bold')
  .fillColor(headerColor)
  .text('Total Deductions', leftColumnX, currentY, { width: descriptionColumnWidth })
  .text(`₹${payslipDetails.totalDeduction}`, leftColumnX + descriptionColumnWidth + 20, currentY, { width: amountColumnWidth, align: 'right' });

// Net Pay Section
doc
  .moveDown(2)
  .fontSize(12)
  .font('Helvetica-Bold')
  .fillColor(highlightColor)
  .text('Net Pay', leftColumnX, doc.y, { width: descriptionColumnWidth })
  .text(`₹${payslipDetails.netPay}`, leftColumnX + descriptionColumnWidth + 20, doc.y, { width:amountColumnWidth, align: 'right' });

doc.end();



    writeStream.on('finish', () => {
      res.download(filePath,` Payslip_${employeeID}.pdf`, (err) => {
        if (err) {
          console.error(err);
          res.status(500).send('Error sending payslip');
        }
      });
    });
  } catch (error) {
    console.error('Error:', error.message);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};



exports.getPayslipHistory = async (req, res) => {
  try {
    const payroll = await Payslip.find();
    res.status(200).json(payroll.map((item) => ({
      ...item._doc, // Include other fields
      pdfUrl: `/uploads/payslip_${item.employeeID}.pdf` // Example file path
    })));
  } catch (error) {
    console.error('Error fetching payslips:', error);
    res.status(500).json({ message: 'Server error' });
  }
};




