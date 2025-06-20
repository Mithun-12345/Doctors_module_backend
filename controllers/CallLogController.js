const Patient = require('../models/patientModel');
const Appointment = require('../models/appointmentModel');
const Message = require('../models/messageModel');
const Doctor = require('../models/doctorModel');
const ChronicForm=require('../models/chronicModel');
const FirstForm=require('../models/patientModel');
const MedicalDetails = require('../models/patientDetails');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const Admin = require('../models/Admin'); // your Admin mongoose model

const twilio = require('twilio');

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const client = new twilio(accountSid, authToken);

exports.sendMessage = async (req, res) => {
  try {
    console.log("Sending message...");

    const messageText = "This is the message text to the user."; // Define the message text
    const patientId = req.params.id; // Extract the patient ID from the request parameters
    const patient = await Patient.findById(patientId); // Find the patient by ID
    // Find the patient details by patientId
    const patientDetails = await MedicalDetails.findOne({ patientId });

    if (!patientDetails) {
      return res.status(404).json({ message: 'Patient details not found' });
    }

    // console.log(patientDetails.phone); // Log the phone number for debugging

    // Send a message via Twilio
    // await client.messages.create({
    //   body: messageText,
    //   to: patient.phone,
    //   from: process.env.TWILIO_PHONE_NUMBER, // Use Twilio phone number from environment variables
    // });

    // Update the patient's messageSent status and timestamp in patientDetails
    patientDetails.messageSent.status = true;
    patientDetails.messageSent.timeStamp = new Date(); // Set the current timestamp

    // Save the updated patientDetails
    const updatedPatientDetails = await patientDetails.save();

    // Return the updated patientDetails
    res.status(200).json(updatedPatientDetails);
  } catch (error) {
    console.error('Error sending message:', error); // Log the error for debugging
    res.status(500).json({ message: 'Error sending message', error: error.message }); // Return the error message
  }
};

exports.sendFirstFormMessage = async (req, res) => {
  try {
    const { to, message, patientId } = req.body;

    // Send SMS using Twilio
    // const twilioResponse = await client.messages.create({
    //   body: message,
    //   from: process.env.TWILIO_PHONE_NUMBER,
    //   to: to
    // });

    // Update patient's messageSent status and timestamp
    const updatedPatient = await MedicalDetails.findByIdAndUpdate(
      patientId,
      {
        $set: {
          'messageSent.status': true,
          'messageSent.timeStamp': new Date()
        }
      },
      { new: true }
    );

    if (!updatedPatient) {
      return res.status(404).json({
        success: false,
        error: 'Patient not found'
      });
    }

    res.json({
      success: true,
      messageId: twilioResponse.sid,
      messageSent: updatedPatient.messageSent
    });

  } catch (error) {
    console.error('Error sending message or updating patient:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to send message or update patient'
    });
  }
};

exports.verifyAppointmentbooking = async (req, res) => {
    try {
        const { userId } = req.params;

        // Check for the patient and retrieve the appointmentFixed status
        const patient = await Patient.findOne({ _id: userId });

        if (patient) {
            return res.status(200).json({ appointmentFixed: patient.appointmentFixed });
        } else {
            return res.status(404).json({ message: 'Patient not found' });
        }
    } catch (error) {
        console.error(error);
        return res.status(500).json({ message: 'Server error' });
    }
};
// Bug here
exports.getFollowUpStatus = async (req, res) => {
    const patientId = req.params.patientId;

    try {
        // Check if the patient has messaged the doctor (i.e., if the patientId exists in the sender field as a string)
        const messageExists = await Message.exists({ sender: patientId });
        
        // Fetch patient details by patientId
        const patient = await Patient.findById(patientId); 

        if (!patient) {
            return res.status(404).json({ message: 'Patient not found' });
        }

        // Check the patient's appointment status
        const appointment = patient.appointmentFixed;

        let followUpStatus;

        // Return appropriate follow-up status based on the messaging and appointment status
        if (messageExists) {
            followUpStatus = 'Follow up-Q';
        } else if (appointment === "No") {
            followUpStatus = 'Follow up-C';
        } else {
            followUpStatus = 'Follow up-PC';
        }

        // Send back the follow-up status as the response
        res.json({ followUpStatus });

    } catch (error) {
        console.error('Error retrieving follow-up status:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

exports.incrementCallCount = async (req, res) => {
    const { patientId } = req.params;
    
    try {
        // Find patient by ID and increment callCount
        const patient = await Patient.findByIdAndUpdate(
            patientId,
            { $inc: { callCount: 1 } }, // Increment callCount by 1
            { new: true }
        );
        
        if (!patient) {
            return res.status(404).json({ message: 'Patient not found' });
        }

        res.json({ message: 'Call count incremented successfully', patient });
    } catch (error) {
        console.error('Error incrementing call count:', error.message);
        res.status(500).json({ message: 'Server error' });
    }
};

exports.updateEnquiryStatus = async (req, res) => {
  const { patientId } = req.params; // Extract patient ID from the request parameters
  const { enquiryStatus } = req.body; // Extract the enquiry status from the request body

  console.log("Endpoint reached for updating enquiry status...");
  console.log("Received enquiryStatus:", enquiryStatus);

  try {
    // Find the patient details by patientId
    const patientDetails = await MedicalDetails.findOne({ patientId });

    if (!patientDetails) {
      return res.status(404).json({ message: 'Patient details not found' });
    }

    // Update the enquiryStatus field in the patientDetails collection
    patientDetails.enquiryStatus = enquiryStatus;

    // Save the updated document
    await patientDetails.save();

    res.status(200).json({
      message: 'Enquiry status updated successfully',
      patientDetails,
    });
  } catch (error) {
    console.error('Error updating enquiry status:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};

exports.login = async (req, res) => {
  const { phoneNumber, password } = req.body;

  if (!phoneNumber || !password) {
    return res.status(400).json({ message: 'Phone number and password are required.' });
  }

  // Phone number format validation (server-side too)
  const phoneRegex = /^[0-9]{10}$/;
  if (!phoneRegex.test(phoneNumber)) {
    return res.status(400).json({ message: 'Invalid phone number format.' });
  }

  try {
    const admin = await Admin.findOne({ phone: phoneNumber });

    if (!admin) {
      return res.status(401).json({ message: 'Invalid phone number or password.' });
    }

    const passwordMatch = await bcrypt.compare(password, admin.password);

    if (!passwordMatch) {
      return res.status(401).json({ message: 'Invalid phone number or password.' });
    }

    const accessToken = jwt.sign(
      { 
        user: { 
          userId: admin._id,
          phone: admin.phone,
          userType: 'admin',
        } 
      },
      process.env.ACCESS_TOKEN_SECRET,
      { expiresIn: "50m" }
    );
    
    res.json({ accessToken });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

//Top table of 5
exports.getPatientStats = async (req, res) => {
try {
    const today = new Date();
    const startOfDay = new Date(today.setHours(0, 0, 0, 0));
    const endOfDay = new Date(today.setHours(23, 59, 59, 999));
  
    // console.log('Start of day:', startOfDay);
    // console.log('End of day:', endOfDay);
  
      // Counting total, chronic, acute, and today's new patients
    const totalPatients = await Patient.countDocuments();
    const chronicPatients = await Patient.countDocuments({ diseaseType: 'Chronic' });
    const acutePatients = await Patient.countDocuments({ diseaseType: 'Acute' });
  
      // New patients added today
    const newPatientsToday = await Patient.countDocuments({
        date: {
          $gte: startOfDay,
          $lt: endOfDay
        }
      });
  
      // Pending calls and medical records
      const pendingCallsFromApp = await Patient.countDocuments({ callFromApp: 'pending' });
      const pendingMedicalRecords = await Patient.countDocuments({ medicalRecords: 'pending' });
  
      // Optional debugging: sample patients or today's patients
      const samplePatients = await Patient.find().limit(5); // For debugging, if needed
      const todaysPatients = await Patient.find({
        date: {
          $gte: startOfDay,
          $lt: endOfDay
        }
      }).limit(5);
  
      // Responding with patient stats
      res.json({
        totalPatients,
        chronicPatients,
        acutePatients,
        newPatientsToday,
        pendingCallsFromApp,
        pendingMedicalRecords
      });
    } catch (error) {
      console.error('Server Error:', error);
      res.status(500).json({ message: 'Server Error', error: error.toString() });
    }
};

const PatientDetails = require('../models/patientDetails');

exports.listPatients = async (req, res) => {
  try {
    // Fetch all patients and populate their medical details
    const patients = await Patient.aggregate([
      {
        $lookup: {
          from: "patientdetails", // Make sure this matches the collection name in MongoDB
          localField: "_id",
          foreignField: "patientId",
          as: "medicalDetails",
        },
      },
    ]);

    const formattedPatients = patients.map(patient => ({
      ...patient,
      medicalDetails: patient.medicalDetails.length > 0 ? patient.medicalDetails[0] : null,
    }));
    // console.log(formattedPatients);
    res.json(formattedPatients);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const asyncHandler = require("express-async-handler");
exports.updateDiseaseType = asyncHandler(async (req, res) => {
  const { patientId } = req.params; // Extract patient ID from request parameters
  const { diseaseType } = req.body; // Get the disease type from request body
  const user = req.user; // Assuming `req.user` contains authenticated user data

  // console.log("Received request body:", patientId, diseaseType, user);

  try {
    // Find the patient's medical details by patientId
    const patientDetails = await MedicalDetails.findOne({ patientId });
    if (!patientDetails) {
      return res.status(404).json({ success: false, error: "Patient details not found" });
    }

    // Update the diseaseType and editedby fields
    patientDetails.diseaseType = {
      ...patientDetails.diseaseType,
      ...diseaseType, // Merge incoming diseaseType with existing data
      editedby: user.phone, // Set editedby to the current user's phone
    };

    // Save the updated patient details
    const updatedPatientDetails = await patientDetails.save();
    // console.log("Updated patient details:", updatedPatientDetails);
    res.status(200).json({
      success: true,
      medicalDetails: updatedPatientDetails,
    });
  } catch (error) {
    console.error("Error updating disease type:", error);
    res.status(500).json({ success: false, error: "Server error" });
  }
});

  exports.patientProfile = async (req, res) => {
    try {
      const patientId = req.params.id;
      // Check if the patientId exists in the ChronicForm model
      const chronicForm = await ChronicForm.findOne({ phone: patientId });
      
      if (chronicForm) {
        // If a chronic form is found for this patient ID
        //console.log(`Chronic form found for patient: ${patientId}`);
        return res.json({ message: 'Yes' });
      } else {
        // If no chronic form is found for this patient ID
        //console.log(`No chronic form found for patient: ${patientId}`);
        return res.json({ message: 'No' });
      }
      
    } catch (error) {
      console.error('Error in patientProfile:', error);
      return res.status(500).json({ 
        message: 'Error checking patient profile', 
        error: error.message 
      });
    }
  };


  exports.updateComment = async (req, res) => {
    try {
      const { comment } = req.body;
      const patientId = req.params.patientId;
  
      const updatedPatient = await Patient.findByIdAndUpdate(
        patientId,
        { $set: { comments: comment } },
        { new: true }
      );
  
      if (!updatedPatient) {
        return res.status(404).json({ message: 'Patient not found' });
      }
  
      res.status(200).json({
        message: 'Comment updated successfully',
        patient: updatedPatient
      });
    } catch (error) {
      console.error('Error updating comment:', error);
      res.status(500).json({ message: 'Error updating comment', error: error.message });
    }
  };


  exports.commentController = async (req, res) => {
    try {
      const { patientId } = req.params; // Extract the patient ID from the request parameters
      const { text } = req.body; // Extract the comment text from the request body
  
      // console.log(patientId, text);
  
      if (!text) {
        return res.status(400).json({ message: 'Comment text is required' });
      }
  
      // Find the patient details by patientId
      const patientDetails = await MedicalDetails.findOne({ patientId });
  
      if (!patientDetails) {
        return res.status(404).json({ message: 'Patient details not found' });
      }
  
      // Ensure patientDetails.comments is initialized as an array
      if (!Array.isArray(patientDetails.comments)) {
        patientDetails.comments = [];
      }
  
      // Add the comment to the comments array
      patientDetails.comments.push({
        text, // Use the provided comment text
        createdAt: new Date(), // Set the current timestamp
      });
  
      // Save the updated patient details
      const updatedPatientDetails = await patientDetails.save();
  
      // Respond with success and the updated patient details
      res.status(200).json({ success: true, patientDetails: updatedPatientDetails });
    } catch (error) {
      console.error('Error adding comment:', error); // Log the error for debugging
      res.status(500).json({ message: 'Internal server error' }); // Return a generic error response
    }
  };  

// Helper function for validating admin input
const validateAdminInput = ({ fullName, email, phone, password }) => {
  const errors = {};

  if (!fullName || fullName.length < 3) {
    errors.fullName = 'Full name must be at least 3 characters.';
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!email || !emailRegex.test(email)) {
    errors.email = 'Valid email address is required.';
  }

  const phoneRegex = /^[0-9]{10}$/;
  if (!phone || !phoneRegex.test(phone)) {
    errors.phone = 'Phone number must be exactly 10 digits.';
  }

  if (!password || password.length < 6) {
    errors.password = 'Password must be at least 6 characters.';
  }

  return errors;
};

// @desc   Register a new admin
// @route  POST /api/admin/register
// @access Public (later you can restrict it)
exports.registerAdmin = async (req, res) => {
  const { fullName, email, phone, password } = req.body;

  // 1. Validate input
  const validationErrors = validateAdminInput({ fullName, email, phone, password });
  if (Object.keys(validationErrors).length > 0) {
    return res.status(400).json({ errors: validationErrors });
  }

  try {
    // 2. Check if admin already exists (by email or phone)
    const existingAdmin = await Admin.findOne({ $or: [{ email }, { phone }] });
    if (existingAdmin) {
      return res.status(409).json({ message: 'Admin with this email or phone already exists.' });
    }

    // 3. Hash the password
    const hashedPassword = await bcrypt.hash(password, 10);

    // 4. Save admin
    const newAdmin = new Admin({
      fullName,
      email: email.toLowerCase(),
      phone,
      password: hashedPassword,
    });

    await newAdmin.save();

    res.status(201).json({ message: 'Admin registered successfully!' });
  } catch (error) {
    console.error('Admin registration error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};
