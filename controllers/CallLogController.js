const Patient = require('../models/patientModel');
const Appointment = require('../models/appointmentModel');
const Message = require('../models/messageModel');
const Doctor = require('../models/doctorModel');
const ChronicForm=require('../models/chronicModel');
const FirstForm=require('../models/patientModel');

const twilio = require('twilio');

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const client = new twilio(accountSid, authToken);

exports.sendMessage = async (req, res) => {
    try {
        console.log("Message sent");
        const messageText = "This is the message text to the user."; // Define the message text here
        const patientId = req.params.id; // Get the patient ID from the request parameters
        const patient = await Patient.findById(patientId); // Find the patient by ID
        console.log(patient.phone); // Use console.log instead of window.alert

        if (!patient) {
            return res.status(404).json({ message: 'Patient not found' });
        }

        await client.messages.create({
            body: messageText,
            to: patient.phone,
            from: process.env.TWILIO_PHONE_NUMBER // Use the Twilio phone number from environment variables
        });

        // Update the patient's message status and timestamp
        const updatedPatient = await Patient.findByIdAndUpdate(
            patientId,
            {
                $set: {
                    'messageSent.status': true,
                    'messageSent.timeStamp': new Date() // Use new Date() for a proper timestamp
                }
            },
            { new: true }
        );

        // Return the updated patient data
        res.status(200).json(updatedPatient);
    } catch (error) {
        console.error('Error sending message:', error); // Log the error for debugging
        res.status(500).json({ message: 'Error sending message', error: error.message }); // Return error message
    }
};

exports.sendFirstFormMessage = async (req, res) => {
  try {
    const { to, message, patientId } = req.body;

    // Send SMS using Twilio
    const twilioResponse = await client.messages.create({
      body: message,
      from: process.env.TWILIO_PHONE_NUMBER,
      to: to
    });

    // Update patient's messageSent status and timestamp
    const updatedPatient = await Patient.findByIdAndUpdate(
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
    const { patientId } = req.params;
    const { enquiryStatus } = req.body;
    console.log("End point reached......uodate");
    console.log(enquiryStatus);
    try {
      const patient = await Patient.findById(patientId);
  
      if (!patient) {
        return res.status(404).json({ message: 'Patient not found' });
      }
  
      patient.enquiryStatus = enquiryStatus;
      await patient.save();
  
      res.status(200).json({ message: 'Enquiry status updated successfully', patient });
    } catch (error) {
      console.error('Error updating enquiry status:', error);
      res.status(500).json({ message: 'Internal Server Error' });
    }
};

const Admin = require('../models/Admin');
const jwt = require('jsonwebtoken');
exports.login = async (req, res) => {
  const { phoneNumber, password, role } = req.body;
  let user;

  try {
    console.log(`Role: ${role}`);
    console.log(`Phone Number: ${phoneNumber}`);

    // Find user based on role
    if (role === 'admin') {
      user = await Admin.findOne({ phone: phoneNumber });
    } else if (role === 'admin-doctor') {
      user = await Doctor.findOne({ phone: phoneNumber });
    } else {
      user = await Doctor.findOne({ phone: phoneNumber });
    } 

    console.log(`User Found: ${user}`);

    if (!user) {
      return res.status(400).json({ message: 'User not found' });
    }

    // Validate password (you might want to hash and compare using bcrypt or another library)
    // Assuming you have a valid user, generate a JWT token
    const payload = { userId: user._id, phone: user.phone, role: user.role };
    console.log('JWT Payload:', payload);

    const accessToken = jwt.sign(
      payload,
      process.env.ACCESS_TOKEN_SECRET,
      { expiresIn: '24h' }
    );

    res.json({ accessToken });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

//Top table of 5
exports.getPatientStats = async (req, res) => {
try {
    const today = new Date();
    const startOfDay = new Date(today.setHours(0, 0, 0, 0));
    const endOfDay = new Date(today.setHours(23, 59, 59, 999));
  
    console.log('Start of day:', startOfDay);
    console.log('End of day:', endOfDay);
  
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

exports.listPatients = async (req, res) => {
    try {
      const patients = await Patient.find();
      res.json(patients);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  };

const asyncHandler = require("express-async-handler");
exports.updateDiseaseType = asyncHandler(async (req, res) => {
  const { patientId } = req.params; // Extract patient ID from request parameters
  const { diseaseType } = req.body; // Get the disease type from request body
  const user = req.user;
  console.log("Received request body:", patientId, diseaseType, user);
  try {
      // Find the patient by ID
      const patient = await Patient.findById(patientId);
      if (!patient) {
          return res.status(404).json({ success: false, error: "Patient not found" });
      }

      // Update the disease type and editedBy fields
      patient.diseaseType = diseaseType; // Update diseaseType
      patient.diseaseType.editedby = user.phone; // Set the editor as the current user

      // Save the updated patient
      const updatedPatient = await patient.save();

      res.status(200).json({
          success: true,
          patient: updatedPatient,
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
      const { patientId } = req.params;
      const { text } = req.body;  // Changed from textMessage to text
      
      console.log(patientId, text);
      
      if (!text) {
        return res.status(400).json({ message: 'Comment text is required' });
      }
      
      const patient = await Patient.findById(patientId);
      if (!patient) {
        return res.status(404).json({ message: 'Patient not found' });
      }
      
      // Ensure patient.comments is initialized as an array
      if (!Array.isArray(patient.comments)) {
        patient.comments = [];
      }
      
      // Add the comment
      patient.comments.push({
        text,  // Using text directly
        createdAt: new Date()
      });
      
      await patient.save();
      
      res.status(200).json({ success: true, patient });
    } catch (error) {
      console.error('Error adding comment:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  };
  


// // Generate TwiML Response
// exports.getTwimlResponse = (req, res) => {
//   const twiml = new twilio.twiml.VoiceResponse();
//   twiml.dial().number(req.query.to); // Connects the call to the 'to' number
//   res.type("text/xml");
//   res.send(twiml.toString());
// };

// // Make a call
// exports.makeCall = (req, res) => {
//   const { to } = req.body; // The number to call from the request body
//   const formattedPhone = `+91${to}`; // Format phone number
//   const twimlUrl = `https://f844-121-200-55-162.ngrok-free.app/twiml?to=${encodeURIComponent(
//     formattedPhone
//   )}`;

//   client.calls
//     .create({
//       url: twimlUrl, // Point to the TwiML endpoint
//       to: "+916382786758", // Assistant doctor's number
//       from: process.env.TWILIO_PHONE_NUMBER, // Your Twilio number
//     })
//     .then((call) => res.status(200).send(call.sid))
//     .catch((error) => res.status(500).send(error));
// };
