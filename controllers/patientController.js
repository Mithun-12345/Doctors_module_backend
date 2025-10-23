const asyncHandler = require("express-async-handler");
const axios = require("axios");
const Patient = require("../models/patientModel");
const MedicalDetails = require("../models/patientDetails");
const PatientDetails = require("../models/patientDetails");
const ChronicPatient = require("../models/chronicModel");
const Payment = require("../models/Payment");
const FamilyLink = require("../models/FamilyLink");
const Appointment = require("../models/appointmentModel");
const Referral = require("../models/referralModel");
require("dotenv").config({ path: "./config/.env" });
const Doctor = require("../models/doctorModel");
const moment = require("moment");
const momentIST = require("moment-timezone");
const twilio = require("twilio");
const fs = require("fs");
const crypto = require("crypto");
const { google } = require("googleapis");
const { createGoogleMeet } = require("./Gmeet");
const cloudinary = require("cloudinary").v2;
const Notification = require("../models/notificationHub");
// patientController.js
const UserGoogleTokens = require("../models/UserTokenSchema");
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const client = new twilio(accountSid, authToken);
const bcrypt = require("bcrypt");
const Prescription = require('../models/Prescription');
const mongoose = require("mongoose");
const PatientNotification = require("../models/PatientNotification");
const NotificationReminderSettings = require('../models/NotificationReminderSettings');
const admin = require("../configs/firebase");
const {pushnotificationModel} = require("../models/pushNotificationModel");
const Message = require('../models/messageModel'); // Or whatever the path to your file is

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const GOOGLE_REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI;

const ZOOM_CLIENT_ID = process.env.ZOOM_CLIENT_ID;
const ZOOM_CLIENT_SECRET = process.env.ZOOM_CLIENT_SECRET;
const ZOOM_REDIRECT_URI = process.env.ZOOM_REDIRECT_URI;

const oauth2Client = new google.auth.OAuth2(
  GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET,
  GOOGLE_REDIRECT_URI
);

const refreshGoogleToken = async (doctor) => {
  try {
    const { tokens } = await oauth2Client.refreshToken(
      doctor.googleRefreshToken
    );
    return tokens.access_token;
  } catch (error) {
    console.error("Error refreshing Google token:", error);
    throw new Error("Failed to refresh Google token");
  }
};

// Step 2: Handle OAuth callback and get access token
exports.handleGoogleCallback = async (req, res) => {
  const { code } = req.query;

  try {
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    // Save the tokens (e.g., in the database) for the user
    const accessToken = tokens.access_token;
    const refreshToken = tokens.refresh_token;

    // Use the access token to create a Google Meet link
    const meetLink = await createGoogleMeet(
      accessToken,
      appointmentDate,
      timeSlot,
      patient,
      doctor
    );

    res.status(200).json({ meetLink });
  } catch (error) {
    console.error("Error during Google OAuth callback:", error);
    res.status(500).json({ error: "Failed to authenticate with Google" });
  }
};

//Initial Form
exports.sendForm = asyncHandler(async (req, res) => {
  // const { name, age, phone, email, gender, diseaseName, diseaseType } =
  //   req.body;
  const {
    consultingFor,
    name,
    age,
    phone,
    whatsappNumber,
    email,
    gender,
    diseaseName,
    diseaseType, // This will now be an object from the frontend
    currentLocation,
    patientEntry,
    symptomNotKnown,
    password,
  } = req.body;

  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(password, salt);

  const { referralCode, familyToken } = req.query; // Get the referral code from query params
  console.log("Received request body:", req.query);
  // Check if referral code is provided
  let friendDetails = null;
  if (referralCode) {
    // Find the referral record by the referral code
    const referral = await Referral.findOne({ code: referralCode });

    if (referral) {
      // Fetch the referred friend's phone number from the referral document
      friendDetails = {
        name: referral.referredFriendName,
        phone: referral.referredFriendPhone,
      };
    }
  }

  const familyLink = await FamilyLink.findOne({ token: familyToken });

  let familyDetails = null;
  let familyGender;
  if (familyToken && familyLink) {
    if (
      familyLink.relationship == "Father" ||
      familyLink.relationship == "Son" ||
      familyLink.relationship == "Father-in-law"
    ) {
      familyGender = "Male";
    } else {
      familyGender = "Female";
    }
    const familyDetails = {
      name: familyLink.name,
      phone: familyLink.phone,
      gender: familyGender,
    };
    console.log(familyDetails);
  }

  // Check if the patient with the given phone already exists
  const existingPatient = await Patient.findOne({ phone });

  if (existingPatient) {
    return res.status(400).json({
      success: false,
      message: "Patient with this mobile number already exists",
    });
  }

  let processedDiseaseType = {
    name: "",
    edit: false,
  };

  // If diseaseType is provided and is an object
  if (diseaseType && typeof diseaseType === "object") {
    processedDiseaseType = {
      name: diseaseType.name || "",
      edit: diseaseType.edit || false,
    };
  }

  const basicDetails = new Patient({
    name,
    age,
    phone,
    whatsappNumber,
    email,
    gender,
    patientEntry,
    currentLocation,
    password: hashedPassword,
  });

  if (referralCode) {
    basicDetails.coupon = referralCode;
  }

  const saveBasic = await basicDetails.save();

  const medicalDetails = new MedicalDetails({
    patientId: saveBasic._id,
    consultingFor,
    // name,
    // age,
    // phone,
    // whatsappNumber,
    // email,
    // gender,
    diseaseName,
    diseaseType: processedDiseaseType,
    // currentLocation,
    // patientEntry,
    symptomNotKnown,
  });

  // Find if the phone number is already registered

  const saveMedical = await medicalDetails.save();

  // Create a new patient document
  // const patientDocument = new Patient({
  //   name,
  //   age,
  //   phone,
  //   email,
  //   gender,
  //   diseaseName,
  //   diseaseType,
  // });

  // await patientDocument.save();

  if (familyToken && familyLink) {
    const senderId = familyLink.userId;
    await Patient.findByIdAndUpdate(senderId, {
      $push: {
        familyMembers: {
          memberId: basicDetails._id, // Add patient ID as memberId
          IndividulAccess: true, // Set IndividulAccess to true
          relationship: familyLink.relationship, // Include relationship role
          name: name, // Store the family member's name here
        },
      },
    });
  }

  res.status(201).json({
    message: "Patient data saved successfully",
    patient: basicDetails,
  });
});

//Patient Profile
// exports.patientDetails = asyncHandler(async (req, res) => {
//   console.log("Patient Details endpoint reached");
//   const phone = req.user.phone;
//   if (!phone) {
//     return res.status(400).json({ message: "Phone number not available" });
//   }

//   // Fetch the patient
//   const patient = await Patient.findOne({ phone });

//   if (!patient) {
//     return res.status(404).json({ message: "Patient not found" });
//   }

//   const patientDetails = await PatientDetails.findOne({
//     patientId: patient._id,
//   });

//   co
// });

exports.patientDetails = asyncHandler(async (req, res) => {
  console.log("Patient Details endpoint reached");

  const phone = req.user.phone;
  if (!phone) {
    return res.status(400).json({ message: "Phone number not available" });
  }
  // Fetch the patient
  const patient = await Patient.findOne({ phone });
  if (!patient) {
    return res.status(404).json({ message: "Patient not found" });
  }

  // Fetch patient details
  const patientDetails = await PatientDetails.findOne({
    patientId: patient._id,
  });
  if (!patientDetails) {
    return res.status(404).json({ message: "Patient details not found" });
  }

  // Fetch medical details
  const medicalDetails = await MedicalDetails.findOne({
    patientId: patient._id,
  });
  if (!medicalDetails) {
    return res.status(404).json({ message: "Medical details not found" });
  }

  // Determine if the patient has a chronic condition
  const isChronic = medicalDetails.diseaseType?.name === "Chronic";

  // Response
  res.status(200).json({
    patientId: patient._id,
    phone: patient.phone,
    consultingFor: medicalDetails.consultingFor,
    diseaseName: medicalDetails.diseaseName,
    diseaseType: medicalDetails.diseaseType,
    isChronic,
  });
});

//Chronic Form
exports.sendChronicForm = asyncHandler(async (req, res) => {
  const {
    dob,
    weight,
    height,
    occupation,
    country,
    state,
    city,
    complaint,
    symptoms,
    associatedDisease,
    allopathy,
    diseaseHistory,
    surgeryHistory,
    allergies,
    bodyType,
  } = req.body;

  console.log("Endpoint reached");

  const phone = req.user.phone;

  // Check if the patient with the provided phone number exists
  const existingPatient = await Patient.findOne({ phone });
  if (!existingPatient) {
    return res.status(404).json({ message: "Patient not found" });
  }

  // Ensure the patient is classified as chronic
  if (existingPatient.diseaseType.name.toLowerCase() !== "chronic") {
    return res.json({ message: "Patient isn't chronic!" });
  }

  // Create a new chronic patient document
  const chronicPatientDocument = new ChronicPatient({
    phone,
    dob,
    weight,
    height,
    occupation,
    country,
    state,
    city,
    complaint,
    symptoms,
    associatedDisease,
    allopathy,
    diseaseHistory,
    surgeryHistory,
    allergies,
    bodyType,
  });

  // Save the chronic patient document to the "chronics" collection in the database
  await chronicPatientDocument.save();

  // Send a success response
  res.status(201).json({
    success: true,
    message: "Data saved successfully",
    patient: chronicPatientDocument,
  });
});


// Check Available Slots
exports.checkAvailableSlots = asyncHandler(async (req, res) => {
  const { appointmentDate } = req.body;
  const phone = req.user.phone;

  const patient = await Patient.findOne({ phone });
  if (!patient) {
    return res.status(404).json({ message: "Patient not found" });
  }

  const medicalDetails = await MedicalDetails.findOne({
    patientId: patient._id,
  });
  if (!medicalDetails) {
    return res.status(404).json({ message: "Medical details not found" });
  }

  const diseaseType = medicalDetails.diseaseType.name.toLowerCase();

  const timeSlots = [
    "10:00",
    "11:00",
    "12:00",
    "13:00",
    "14:00",
    "15:00",
    "16:00",
    "17:00",
  ];
  const appointments = await Appointment.find({ appointmentDate });

  const isMorningSlot = (slot) => timeSlots.indexOf(slot) < 4;

  const availableSlots = timeSlots.filter((slot) => {
    const isBooked = appointments.some((appt) => appt.timeSlot === slot);
    if (isBooked) return false;

    if (diseaseType === "chronic") {
      const chronicBookingInMorning = appointments.some(
        (appt) => appt.isChronic && isMorningSlot(appt.timeSlot)
      );
      const chronicBookingInAfternoon = appointments.some(
        (appt) => appt.isChronic && !isMorningSlot(appt.timeSlot)
      );

      if (
        (chronicBookingInMorning && isMorningSlot(slot)) ||
        (chronicBookingInAfternoon && !isMorningSlot(slot))
      ) {
        return false;
      }
    }

    return true;
  });

  res.status(200).json({ availableSlots });
});

const addEventToGoogleCalendar = async (doctorId, appointment) => {
  try {
    // Only select the fields we need for calendar integration
    const doctor = await Doctor.findById(doctorId)
      .select("googleAccessToken googleRefreshToken name email")
      .lean(); // Use lean() to get a plain JavaScript object without Mongoose validation

    if (!doctor) {
      throw new Error("Doctor not found");
    }

    // Check if the doctor has the necessary tokens
    // if (!doctor.googleAccessToken || !doctor.googleRefreshToken) {
    if (!doctor.googleAccessToken) {
      throw new Error("Doctor does not have Google OAuth tokens");
    }

    // Use the tokens to set the credentials for googleClient
    oauth2Client.setCredentials({
      access_token: doctor.googleAccessToken,
      refresh_token: doctor.googleRefreshToken,
    });

    // Set up Google Calendar API
    const calendar = google.calendar({ version: "v3", auth: oauth2Client });

    // Prepare event details
    const event = {
      summary: `Appointment with ${appointment.patientName}`,
      description: `Consultation for ${
        appointment.reason || "General Consultation"
      }`,
      start: {
        dateTime: `${appointment.appointmentDate}T${appointment.timeSlot}:00`,
        timeZone: "Asia/Kolkata",
      },
      end: {
        dateTime: `${appointment.appointmentDate}T${String(
          parseInt(appointment.timeSlot.split(":")[0]) + 1
        ).padStart(2, "0")}:00:00`,
        timeZone: "Asia/Kolkata",
      },
      conferenceData: {
        createRequest: {
          requestId: `appointment-${appointment._id || Date.now()}`,
          conferenceSolutionKey: { type: "hangoutsMeet" },
        },
      },
      attendees: [{ email: appointment.patientEmail }],
    };

    try {
      // Insert the event into the doctor's Google Calendar
      const calendarEvent = await calendar.events.insert({
        calendarId: "primary",
        resource: event,
        conferenceDataVersion: 1,
      });

      // If token was refreshed, update it in the database
      if (calendarEvent.config && calendarEvent.config.headers) {
        const newAccessToken =
          calendarEvent.config.headers.Authorization.split(" ")[1];
        if (newAccessToken !== doctor.googleAccessToken) {
          await Doctor.findByIdAndUpdate(doctorId, {
            googleAccessToken: newAccessToken,
          });
        }
      }

      return {
        id: calendarEvent.data.id,
        meetLink: calendarEvent.data.hangoutLink,
        start: calendarEvent.data.start,
        end: calendarEvent.data.end,
      };
    } catch (error) {
      if (
        error.message.includes("invalid_token") ||
        error.message.includes("Invalid Credentials")
      ) {
        // Token expired, try to refresh
        const { tokens } = await oauth2Client.refreshToken(
          doctor.googleRefreshToken
        );

        // Update the doctor's access token
        await Doctor.findByIdAndUpdate(doctorId, {
          googleAccessToken: tokens.access_token,
        });

        // Retry with new token
        oauth2Client.setCredentials({
          access_token: tokens.access_token,
          refresh_token: doctor.googleRefreshToken,
        });

        const calendarEvent = await calendar.events.insert({
          calendarId: "primary",
          resource: event,
          conferenceDataVersion: 1,
        });

        return {
          id: calendarEvent.data.id,
          meetLink: calendarEvent.data.hangoutLink,
          start: calendarEvent.data.start,
          end: calendarEvent.data.end,
        };
      }
      throw error;
    }
  } catch (error) {
    console.error("Failed to add event to Google Calendar:", error);
    throw new Error("Could not add event to Google Calendar.");
  }
};

const refreshZoomToken = async (doctor) => {
  try {
    console.log("Inside!");
    const response = await axios.post("https://zoom.us/oauth/token", null, {
      params: {
        grant_type: "refresh_token",
        refresh_token: doctor.zoomRefreshToken,
      },
      headers: {
        Authorization: `Basic ${Buffer.from(
          `${ZOOM_CLIENT_ID}:${ZOOM_CLIENT_SECRET}`
        ).toString("base64")}`,
      },
    });

    const { access_token, refresh_token } = response.data;
    console.log("yuhh! Zoom Access Token:", access_token);
    console.log("Zoom Refresh Token:", refresh_token);
    // Save the new tokens in the doctor's database
    doctor.zoomAccessToken = access_token;
    doctor.zoomRefreshToken = refresh_token;
    await doctor.save();

    return access_token;
  } catch (error) {
    console.error("Failed to refresh Zoom token:", error);
    throw new Error("Zoom token refresh failed");
  }
};

//zoom function
const addAppointmentToCalendar = async (doctorId, appointment) => {
  try {
    const doctor = await Doctor.findById(doctorId);
    if (!doctor) throw new Error("Doctor not found");

    if (!doctor.zoomAccessToken) {
      throw new Error("Doctor is missing Zoom access token");
    }

    let accessToken = doctor.zoomAccessToken;
    try {
      await axios.get("https://api.zoom.us/v2/users/me", {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
    } catch (error) {
      console.log("Zoom token expired, refreshing...");
      accessToken = await refreshZoomToken(doctor);
    }

    const startTime = new Date(
      `${appointment.appointmentDate}T${appointment.timeSlot}:00`
    );
    const isoStartTime = startTime.toISOString();

    const meetingDetails = {
      topic: `Appointment with ${appointment.patientName}`,
      type: 2, // Scheduled meeting
      start_time: isoStartTime,
      duration: 60,
      timezone: "Asia/Kolkata",
      settings: {
        host_video: true,
        participant_video: true,
        join_before_host: true,
        waiting_room: true, // Enable waiting room for better control
        mute_upon_entry: true, // Participants are muted when they join
        approval_type: 0, // No registration required
        registration_type: 1,
        audio: "both", // Allow both computer and phone audio
        enforce_login: false,
        auto_recording: "none",
        // alternative_hosts: doctor.personalEmail,
        meeting_authentication: false,
        screen_share: false, // Only host can share screen
        whiteboard: false, // Disable whiteboard access for participants
        allow_multiple_devices: false, // Prevent login from multiple devices
        allow_participants_to_rename: false, // Prevent participants from renaming themselves
        allow_participants_chat: false, // Disable chat for participants
        allow_file_transfer: false, // Disable file transfer
        allow_live_streaming: false, // Disable live streaming
        allow_participants_unmute: false, // Prevent participants from unmuting themselves
        allow_participants_reactions: false, // Disable reactions
      },
    };
    // Add more detailed error logging
    try {
      const zoomResponse = await axios.post(
        "https://api.zoom.us/v2/users/me/meetings",
        meetingDetails,
        {
          headers: {
            Authorization: `Bearer ${doctor.zoomAccessToken}`,
            "Content-Type": "application/json",
            Accept: "application/json",
          },
        }
      );

      const zoomLink = zoomResponse.data.join_url;
      console.log("Zoom Link:", zoomLink);
      // Rest of your calendar code...
      // oauth2Client.setCredentials({
      //   access_token: process.env.GOOGLE_ACCESS_TOKEN,
      //   refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
      // });

      // const calendar = google.calendar({ version: "v3", auth: oauth2Client });

      // const event = {
      //   summary: `Appointment with ${appointment.patientName}`,
      //   description: `Consultation\nZoom Link: ${zoomLink}`,
      //   start: {
      //     dateTime: isoStartTime,
      //     timeZone: "Asia/Kolkata",
      //   },
      //   end: {
      //     dateTime: new Date(startTime.getTime() + 60 * 60000).toISOString(), // Add 60 minutes
      //     timeZone: "Asia/Kolkata",
      //   },
      //   attendees: [{ email: appointment.patientEmail }],
      // };

      // const calendarEvent = await calendar.events.insert({
      //   calendarId: "primary",
      //   resource: event,
      // });

      return {
        // googleEventId: calendarEvent.data.id,
        zoomLink,
      };
    } catch (zoomError) {
      console.error("Zoom API Error Details:", {
        status: zoomError.response?.status,
        statusText: zoomError.response?.statusText,
        data: zoomError.response?.data,
      });
      throw new Error(
        `Zoom meeting creation failed: ${
          zoomError.response?.data?.message || zoomError.message
        }`
      );
    }
  } catch (error) {
    console.error("Failed to add appointment to calendar:", error.message);
    throw error; // Throw the actual error instead of a generic one
  }
};

exports.finalizeAppointment = asyncHandler(async (req, res) => {
  const { appointmentId, paymentId } = req.body;

  // Find the draft appointment
  const appointment = await Appointment.findById(appointmentId);

  if (!appointment || appointment.status !== "draft") {
    return res.status(404).json({ message: "Draft appointment not found" });
  }

  // Find the patient
  const phone = req.user.phone;
  const user = await Patient.findOne({ phone });
  if (!user) return res.status(404).json({ message: "Patient not found" });

  const doctorId = "67bc3391654d85340a8ce713"; // Get from configuration
  const doctor = await Doctor.findById(doctorId);
  if (!doctor) {
    return res.status(404).json({ message: "Doctor not found" });
  }

  // Ensure the appointment belongs to this user
  if (appointment.patient.toString() !== user._id.toString()) {
    return res
      .status(403)
      .json({ message: "Not authorized to finalize this appointment" });
  }

  try {
    // Verify the appointment is still available (double check)
    const timeSlots = [
      "10:00",
      "11:00",
      "12:00",
      "13:00",
      "14:00",
      "15:00",
      "16:00",
      "17:00",
    ];
    const isMorningSlot = (slot) => timeSlots.indexOf(slot) < 4;

    // Check for conflicting appointments again (in case something was booked between draft and finalize)
    const conflictingAppointments = await Appointment.find({
      appointmentDate: appointment.appointmentDate,
      status: "confirmed",
      _id: { $ne: appointment._id }, // Exclude current appointment
    });

    if (appointment.isChronic) {
      const chronicBookingInMorning = conflictingAppointments.some(
        (appt) => appt.isChronic && isMorningSlot(appt.timeSlot)
      );
      const chronicBookingInAfternoon = conflictingAppointments.some(
        (appt) => appt.isChronic && !isMorningSlot(appt.timeSlot)
      );

      if (
        (isMorningSlot(appointment.timeSlot) && chronicBookingInMorning) ||
        (!isMorningSlot(appointment.timeSlot) && chronicBookingInAfternoon)
      ) {
        return res.status(400).json({
          message:
            "The selected time slot is no longer available for chronic patients",
        });
      }
    } else {
      const isSlotBooked = conflictingAppointments.some(
        (appt) => appt.timeSlot === appointment.timeSlot
      );

      if (isSlotBooked) {
        return res
          .status(400)
          .json({ message: "Time slot is no longer available" });
      }
    }

    // Apply referral logic
    const previousAppointments = await Appointment.find({
      patient: user._id,
      status: "confirmed",
    });

    const couponCode = user.coupon;
    if (previousAppointments.length === 0 && couponCode) {
      const referral = await Referral.findOne({
        code: couponCode,
        isUsed: false,
      });
      if (referral) {
        referral.firstAppointmentDone = true;
        await referral.save();
      }
    }

    // Auto-apply coupon logic for referrer
    let appliedCoupon = null;
    const referrerCoupons = await Referral.find({
      referrerId: user._id,
      isUsed: false,
      firstAppointmentDone: true,
    });

    if (referrerCoupons.length > 0) {
      appliedCoupon = referrerCoupons[0];
      appliedCoupon.isUsed = true; // Mark the coupon as used
      await appliedCoupon.save();
      console.log(
        `Coupon ${appliedCoupon.code} automatically applied for referrer ${user.name}.`
      );
    }

    // Format the date to YYYY-MM-DD format
    const formatDateForCalendar = (dateString) => {
      const date = new Date(dateString);
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const day = String(date.getDate()).padStart(2, "0");

      return `${year}-${month}-${day}`;
    };

    // Generate meeting link
    let calendarEvent;
    const formattedDate = formatDateForCalendar(appointment.appointmentDate);

    if (doctor.videoPlatform === "googleMeet") {
      calendarEvent = await addEventToGoogleCalendar(doctorId, {
        _id: appointment._id,
        patientName: user.name,
        patientEmail: user.email,
        appointmentDate: formattedDate,
        timeSlot: appointment.timeSlot,
        reason: appointment.reason,
      });

      if (calendarEvent && calendarEvent.meetLink) {
        appointment.meetLink = calendarEvent.meetLink;
      }
    } else if (doctor.videoPlatform === "zoom") {
      calendarEvent = await addAppointmentToCalendar(doctor, {
        patient: user._id,
        patientName: user.name,
        patientEmail: user.email,
        appointmentDate: formattedDate,
        timeSlot: appointment.timeSlot,
      });

      if (calendarEvent && calendarEvent.zoomLink) {
        appointment.meetLink = calendarEvent.zoomLink;
      }
    } else {
      return res
        .status(400)
        .json({ message: "Invalid calendar type in doctor's preferences." });
    }

    // Update appointment status and add payment details
    appointment.status = "confirmed";
    appointment.paymentId = paymentId;

    // Update patient follow-up status
    user.follow = "Consultation";
    await user.save();

    // Save the updated appointment
    await appointment.save();

    res.status(200).json({
      success: true,
      message: "Appointment finalized successfully",
      calendarEvent,
      appointment,
      appliedCoupon: appliedCoupon ? appliedCoupon.code : null,
    });
  } catch (error) {
    // If an error occurs, revert coupon status if applied
    if (appliedCoupon) {
      appliedCoupon.isUsed = false;
      await appliedCoupon.save();
    }

    // If referral was applied, revert it
    if (
      previousAppointments &&
      previousAppointments.length === 0 &&
      couponCode
    ) {
      const referral = await Referral.findOne({
        code: couponCode,
        isUsed: false,
      });
      if (referral) {
        referral.firstAppointmentDone = false;
        await referral.save();
      }
    }

    console.error("Failed to finalize appointment:", error);
    res.status(500).json({
      message: "Failed to finalize appointment",
      error: error.message,
    });
  }
});

const {DoctorPrefinedAppointmentDetails} = require("../models/doctorPrefinedSettings");
// const {ClinicOperationHours} = require("../models/consultationMessengerSettings");
// doctor appointment setup 

exports.createDoctorAppointmentInitialSetup = asyncHandler(async (req,res)=>{
  const doctorId = req.user._id;
  const {consultationTime } = req.body;
  try{

    if(!consultationTime || consultationTime <= 0){
      return res.json({message : "invalid data"});
    }
    const startHour = 10; // 10 am 
    const endHour = 17; // 5pm
    const totalMinutes = (endHour - startHour) * 60;
  
    const totalAppointments = Math.floor(totalMinutes / consultationTime);

    const data ={
      doctorId : doctorId,
      consultationTime : consultationTime,
      totalslotPerday : totalAppointments
    };

    const result = await DoctorPrefinedAppointmentDetails.create(data);
    if(!result){
      return res.status(404).json({message : "not inserted"});
    }
    console.log("inserted successfully");
    return res.json({message : "inserted successfully",result : result});

  }
  catch(error){
    console.log("error occured",error);
    return res.status(500).json({message : error});
  }
});


// patent appointment dates 

exports.patientAppointmentDates = asyncHandler(async (req,res) =>{

  const {id } = req.params;

  const appointments = await Appointment.find({patient : new mongoose.Types.ObjectId(id) });
  console.log("All appointmens : ",appointments );

  const appointmentDates = appointments.map(app => app.appointmentDate);
  if(!appointmentDates){
    return res.json({success: false , appointmentDates : appointmentDates });
  }

  const pastRecentAppointment = getMostRecentAppointment(appointmentDates);
  console.log("appointment date : ",pastRecentAppointment);

  const matchedAppointment = findAppointmentsByDate(appointments,pastRecentAppointment);

  return res.json({ message : true , lastAppointmentDocument : matchedAppointment});

});


exports.bookAppointment = asyncHandler(async (req, res) => {
  const phone = req.user.phone;
  const {
    appointmentDate,
    timeSlot,
    consultingFor,
    consultingReason,
    symptom,
  } = req.body;
  
  const doctorId = "67bc3391654d85340a8ce713"; // should be changed

  try {
    const user = await Patient.findOne({ phone });
    if (!user) {
      return res.status(400).json({ success: false, message: "Patient not found" });
    }
        // --- NEW LOGIC ADDED HERE ---
    // Check if the patient has completed their first cycle.
    // If so, update their status to "Existing" for this and future appointments.
    if (user.firstCycleCompleted === true) {
      user.newExisting = "Existing";
      await user.save();
    }
    const medicalDetails = await MedicalDetails.findOne({ patientId: user._id });
    if (!medicalDetails) {
      return res.status(400).json({ success: false, message: "Medical details not found" });
    }
    medicalDetails.follow = "Consultation";
    await medicalDetails.save();

    const doctor = await Doctor.findById(doctorId);
    if (!doctor || doctor.role !== "admin-doctor") {
      return res.status(400).json({ success: false, message: "Doctor not found" });
    }
    
    const timeSlots = [
      "10:00", "11:00", "12:00", "13:00",
      "14:00", "15:00", "16:00", "17:00",
    ];

    const currentDate = new Date();
    const appointmentDateObj = new Date(appointmentDate);
    const oneMonthLater = new Date();
    oneMonthLater.setMonth(currentDate.getMonth() + 1);

    if (appointmentDateObj < currentDate || appointmentDateObj > oneMonthLater) {
      return res.status(400).json({ success: false, message: "Invalid appointment date" });
    }

    const isChronic = medicalDetails.diseaseType.name.toLowerCase() === "chronic";
    const isMorningSlot = (slot) => timeSlots.indexOf(slot) < 4;

    const existingAppointments = await Appointment.find({
      appointmentDate,
      status: { $in: ["reserved", "confirmed"] },
      expiresAt: { $gt: new Date() },
    });

    if (isChronic) {
      const chronicBookingInMorning = existingAppointments.some(
        (appt) => appt.isChronic && isMorningSlot(appt.timeSlot)
      );
      const chronicBookingInAfternoon = existingAppointments.some(
        (appt) => appt.isChronic && !isMorningSlot(appt.timeSlot)
      );
      if (
        (isMorningSlot(timeSlot) && chronicBookingInMorning) ||
        (!isMorningSlot(timeSlot) && chronicBookingInAfternoon)
      ) {
        return res.status(400).json({
          success: false,
          message: "The selected time slot is not available for chronic patients",
        });
      }
    } else {
      const isSlotBooked = existingAppointments.some(
        (appt) => appt.timeSlot === timeSlot
      );
      if (isSlotBooked) {
        return res.status(400).json({ success: false, message: "Time slot is not available" });
      }
    }

    // ... (rest of your referral logic) ...
    
    const newAppointment = new Appointment({
      patient: user._id,
      patientEmail: user.email,
      patientName: user.name,
      consultingFor: consultingFor,
      classification: consultingReason, // consultingReason maps to classification
      diseaseName: symptom,           // symptom maps to diseaseName
      doctor: doctor._id,
      doctorName: doctor.name,
      follow:"Consultation",
      appointmentDate,
      timeSlot,
      isChronic,
      status: "reserved",
      isPaid: false,
      payment: 500,
      reservedAt: new Date(),
      expiresAt: new Date(Date.now() + 7 * 60 * 1000),
    });

    const savedAppointment = await newAppointment.save();

    const appointmentFullDate = new Date(`${appointmentDate}T${timeSlot}`);
    const istFormatter = new Intl.DateTimeFormat('en-IN', {
      timeZone: 'Asia/Kolkata',
      dateStyle: 'long',
      timeStyle: 'short'
    });
    const formattedDateTime = istFormatter.format(appointmentFullDate);

    await Notification.create({
      recipient: user._id,
      message: `Your appointment with ${doctor.name} for ${appointmentDate} at ${timeSlot} is reserved.`,
      type: "APPOINTMENT_RESERVED",
      link: `/appointments/${savedAppointment._id}`,
    });

    // =================================================================
    // --- NEW PUSH NOTIFICATION LOGIC ADDED HERE ---
    // =================================================================
    try {
      // 1. Find the patient's FCM token from your push notification collection
      const pushInfo = await pushnotificationModel.findOne({ patientId: user._id });

      // 2. If the patient has a token, send them a push notification
      if (pushInfo && pushInfo.token) {
        const message = {
          notification: {
            title: "Appointment Reserved!",
            body: `Your appointment with ${doctor.name} on ${appointmentDate} at ${timeSlot} is reserved.`,
          },
          token: pushInfo.token,
        };

        await admin.messaging().send(message);
        // This is the message acknowledgement you requested (it will appear in your server console)
        console.log(`Push notification sent successfully to patient: ${user._id}`);
      }
    } catch (pushError) {
      // We log the error but do not stop the main function, so the user still gets a success response.
      console.error(`Failed to send push notification to patient ${user._id}:`, pushError);
    }
    // =================================================================
    // --- END OF NEW PUSH NOTIFICATION LOGIC ---
    // =================================================================

    // This final response remains UNCHANGED.
    res.status(201).json({
      success: true,
      message: `Your appointment with ${doctor.name} for ${formattedDateTime} is reserved.`,
      appointmentId: savedAppointment._id,
      amount: savedAppointment.payment,
      expiresAt: new Date(Date.now() + 7 * 60 * 1000),
    });
    
  } catch (error) {
    console.error("Failed to reserve appointment:", error);
    res.status(400).json({
      success: false,
      message: error.message || "Failed to reserve appointment",
    });
  }
});
exports.deleteAppointment = asyncHandler(async (req, res) => {
  let { appointmentId } = req.params;
  let patientId = req.user._id;
  console.log(" inside delete appointement user : ",req.user);
  console.log("Patient id : ",patientId);

  // let {appointmentId , patientId} = req.body;
  appointmentId = new mongoose.Types.ObjectId(appointmentId);
  // patientId = new mongoose.Types.ObjectId(patientId);
  console.log("appointment id : ",appointmentId);
  try {

    // Find the specific appointment with both patientId and appointmentId match
    const appointment = await Appointment.findOne({
      _id: appointmentId,
      patient: patientId
      // doctor : patientId
    });

    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: "Appointment not found for this patient",
      });
    }

    // Delete only this appointment
    await Appointment.deleteOne({ _id: appointmentId, patient: patientId });
    // await Appointment.deleteOne({_id: appointmentId,doctor : patientId});
    const date = appointment.appointmentDate.toDateString();
    // console.log("appointment date : "+date);
    // push notification 

    const notification = await pushnotificationModel.findOne({patientId : patientId});

    const message = {
      notification : {
        title : "Appointment cancelled successfully ",
        body : `Your Appointment on ${date} at ${appointment.timeSlot} was cancelled successfully`
      },
      token : notification.token
    }

    const response = await admin.messaging().send(message);
    console.log("notification sent to patient.");

    res.status(200).json({
      success: true,
      message: "Appointment deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting appointment:", error);
    res.status(500).json({
      success: false,
      message: "Error deleting appointment",
      error: error.message,
    });
  }
});

// edit appointment only once 

exports.editAppointmentOnce = asyncHandler(async (req, res) => {
  const { appointmentId} = req.params;
  const patientId = req.user._id;

  //  Validate IDs
  if (
    !mongoose.Types.ObjectId.isValid(appointmentId) 
    // !mongoose.Types.ObjectId.isValid(patientId)
    // !isValid(patientId)
  ) {
    return res.status(400).json({ success: false, message: "Invalid ID format" });
  }

  console.log("Appointment id : ",appointmentId);
  console.log("patient Id : ",patientId);

  //  Fetch appointment by _id and patient
  const appointment = await Appointment.findOne({
    _id: new mongoose.Types.ObjectId(appointmentId),
    patient: patientId
  });

  if (!appointment) {
    return res.status(404).json({ success: false, message: "Appointment not found for this patient" });
  }

  //  Rule 1: Already edited before
  if (appointment.diseaseType.edit) {
    return res.status(400).json({
      success: false,
      message: "You can only edit an appointment once."
    });
  }

  // //  Rule 2: Check 3-hour cutoff
  // const [hour, minute] = appointment.timeSlot.split(":").map(Number);
  // const appointmentDateTime = new Date(appointment.appointmentDate);
  // appointmentDateTime.setHours(hour, minute, 0, 0);

  // const now = new Date();
  // const threeHoursMs = 3 * 60 * 60 * 1000;
  // if (appointmentDateTime - now <= threeHoursMs) {
  //   return res.status(400).json({
  //     success: false,
  //     message: "Edits are not allowed within 3 hours of the appointment time."
  //   });
  // }


// Rule: Block edits if we are within 3 hours of today's appointment time
const [hour, minute] = appointment.timeSlot.split(":").map(Number);

// Create the full DateTime for appointment
const appointmentDateTime = new Date(appointment.appointmentDate);
appointmentDateTime.setHours(hour, minute, 0, 0);

const now = new Date();
const threeHoursBefore = new Date(appointmentDateTime.getTime() - (3 * 60 * 60 * 1000));

// If appointment is today, and now is after 3-hour-before cutoff => block
if (
  now.toDateString() === appointmentDateTime.toDateString() && // same day
  now >= threeHoursBefore
) {
  return res.status(400).json({
    success: false,
    message: "Edits are not allowed within 3 hours of today's appointment time."
  });
}

// If appointment date is in the past => block
if (now > appointmentDateTime && now.toDateString() !== appointmentDateTime.toDateString()) {
  return res.status(400).json({
    success: false,
    message: "Cannot edit past appointments."
  });
}


  // Rule 3: New timeSlot validation - must be between 10:00 and 17:00
  if (req.body.timeSlot) {
    const [newHour, newMinute] = req.body.timeSlot.split(":").map(Number);
    const newTime = newHour * 60 + newMinute;
    const minAllowed = 10 * 60; // 10:00 AM = 600 mins
    const maxAllowed = 17 * 60; // 05:00 PM = 1020 mins

    if (newTime < minAllowed || newTime > maxAllowed) {
      return res.status(400).json({
        success: false,
        message: "Time slot must be between 10:00 AM and 05:00 PM."
      });
    }
  }

  //  Update all fields from request body (full update allowed)
  Object.keys(req.body).forEach(key => {
    appointment[key] = req.body[key];
  });

  //  Mark as edited
  appointment.diseaseType.edit = true;

  await appointment.save();

  // push notification 

  const notification = await pushnotificationModel.findOne({patientId : patientId});
  const date = appointment.appointmentDate.toDateString();

  const message = {
    notification : {
      title : "Appointment Edited successfully ",
      body : `Your Appointment on ${date} at ${appointment.timeSlot} was rescheduled successfully`
    },
    token : notification.token
  }

  const response = await admin.messaging().send(message);
  console.log("notification sent to patient.");


  res.status(200).json({
    success: true,
    message: "Appointment updated successfully",
    data: appointment
  });
});
// Optional: Add a cleanup job to remove expired reservations
exports.cleanupExpiredReservations = asyncHandler(async (req, res) => {
  try {
    const result = await Appointment.deleteMany({
      status: "reserved",
      expiresAt: { $lt: new Date() },
    });

    console.log(`Cleaned up ${result.deletedCount} expired reservations`);

    if (res) {
      res.status(200).json({
        success: true,
        message: `Cleaned up ${result.deletedCount} expired reservations`,
      });
    }
  } catch (error) {
    console.error("Error cleaning up expired reservations:", error);
    if (res) {
      res.status(500).json({
        success: false,
        message: "Failed to cleanup expired reservations",
      });
    }
  }
});



exports.getUserAppointments = async (req, res) => {
  console.log("User Appointments endpoint reached");
  try {
    const userId = req.user.id; // Assuming you have user authentication middleware
    const { filter } = req.query;
    console.log("user id:", userId);
    console.log("Filter:", filter);
    let query = { patient: userId };
    const currentDate = moment().startOf("day");

    switch (filter) {
      case "past":
        query.appointmentDate = { $lt: currentDate.toDate() };
        break;
      case "today":
        query.appointmentDate = {
          $gte: currentDate.toDate(),
          $lt: moment(currentDate).endOf("day").toDate(),
        };
        break;
      case "thisWeek":
        query.appointmentDate = {
          $gte: currentDate.toDate(),
          $lt: moment(currentDate).endOf("week").toDate(),
        };
        break;
      case "thisMonth":
        query.appointmentDate = {
          $gte: currentDate.toDate(),
          $lt: moment(currentDate).endOf("month").toDate(),
        };
        break;
      case "nextAppointment":
        console.log("Inside");
        const nextAppointment = await Appointment.findOne({
          patient: userId,
          appointmentDate: { $gte: new Date() },
        })
          .populate("patient", "name") // Get patient name
          .sort({ appointmentDate: 1, timeSlot: 1 }) // Get closest upcoming appointment
          .select("appointmentDate timeSlot diseaseName patient");
        console.log("nextAppointment", nextAppointment);
        if (!nextAppointment) {
          return res
            .status(404)
            .json({ message: "No upcoming appointments found" });
        }

        const appointmentDate = new Date(nextAppointment.appointmentDate);
        return res.json({
          patientName: nextAppointment.patient.name,
          diseaseName: nextAppointment.diseaseName,
          date: appointmentDate.getDate(),
          month: appointmentDate.toLocaleString("default", { month: "long" }),
          time: nextAppointment.timeSlot,
        });
      default:
        // If no filter or 'all', fetch all appointments
        break;
    }

    const appointments = await Appointment.find(query)
      .populate("doctor", "name specialty") // Assuming doctor has name and specialty fields
      .sort({ appointmentDate: 1, timeSlot: 1 });

    res.json(appointments);
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error fetching appointments", error: error.message });
  }
};

exports.updateFollowUpStatus = async (req, res) => {
  try {
    const { patientId: appointmentId } = req.params;
    const appointment = await Appointment.findById(appointmentId);

    if (!appointment) {
      return res.status(404).json({ message: "appointment not found" });
    }

    const patient = await Patient.findById(appointment.patient);
    if (!patient) {
        return res.status(404).json({ message: "Associated patient not found" });
    }

    const originalStatus = appointment.follow;
    switch (appointment.follow) {
      case "Consultation":
        appointment.follow = "Prescription";
        break;
      case "Prescription":
        appointment.follow = "Payment";
        break;
      case "Payment":
        appointment.follow = "Medicine Preparation";
        break;
      case "Medicine Preparation":
        appointment.follow = "Shipment";
        break;
      case "Shipment":
        appointment.follow = "Patient Care";
        break;
      case "Patient Care":
        appointment.follow = "Inactive";
        break;
      default:
        return res.status(400).json({ message: "Invalid follow-up status" });
    }
    
    patient.patientStage = appointment.follow;
    patient.follow = appointment.follow;

    if (appointment.follow === "Patient Care") {
      patient.firstCycleCompleted = true;
    }

    await appointment.save();
    await patient.save();
    
    // --- START: NOTIFICATION LOGIC ---

    if (originalStatus === "Consultation" && appointment.follow === "Prescription") {
        await Notification.create({
            recipient: appointment.patient,
            message: "Following the conclusion of your appointment, we will guide you on the subsequent procedures. Please await further communication for updates.",
            type: "FOLLOW_UP_UPDATE",
            link: `/appointments/${appointment._id}`
        });

        // --- PUSH NOTIFICATION ADDED HERE ---
        try {
            const pushInfo = await pushnotificationModel.findOne({ patientId: appointment.patient });
            if (pushInfo && pushInfo.token) {
                await admin.messaging().send({
                    notification: {
                        title: "Consultation Update",
                        body: "Following the conclusion of your appointment, we will guide you on the subsequent procedures. Please await further communication for updates."
                    },
                    token: pushInfo.token
                });
                console.log(`Push notification sent for 'Prescription' status to patient: ${appointment.patient}`);
            }
        } catch (pushError) {
            console.error(`Failed to send 'Prescription' push notification:`, pushError);
        }
    }

    if (originalStatus === "Shipment" && appointment.follow === "Patient Care") {
        await Notification.create({
            recipient: appointment.patient,
            message: "You are now under patient care and will receive regular reminders for your prescribed medication intake.",
            type: "PATIENT_CARE_STARTED",
            link: `/patient-care/${appointment.patient}`
        });

        // --- PUSH NOTIFICATION ADDED HERE ---
        try {
            const pushInfo = await pushnotificationModel.findOne({ patientId: appointment.patient });
            if (pushInfo && pushInfo.token) {
                await admin.messaging().send({
                    notification: {
                        title: "Patient Care Started",
                        body: "You are now under patient care and will receive regular reminders for your prescribed medication intake."
                    },
                    token: pushInfo.token
                });
                console.log(`Push notification sent for 'Patient Care' status to patient: ${appointment.patient}`);
            }
        } catch (pushError) {
            console.error(`Failed to send 'Patient Care' push notification:`, pushError);
        }
    }

    // --- END: NOTIFICATION LOGIC ---

    // This final response remains UNCHANGED.
    res.status(200).json({
      message: "Follow-up status updated successfully",
      appointment: {
        id: appointment._id,
        follow: appointment.follow,
        followUpTimestamp: appointment.followUpTimestamp,
      },
    });

  } catch (error) {
    console.error("Error updating follow-up status:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};
exports.getPatientStatistics = async (req, res) => {
  try {
    // Use an aggregation pipeline to get all counts in one efficient query
    const result = await Patient.aggregate([
      {
        $facet: {
          // Operation A: Get the total count of all patients
          "totalPatients": [
            { $count: "count" }
          ],
          // Operation B: Group patients by their 'newExisting' status and count each group
          "statusCounts": [
            { $group: { _id: "$newExisting", count: { $sum: 1 } } }
          ]
        }
      }
    ]);

    // Extract and format the results
    const totalCount = result[0].totalPatients[0] ? result[0].totalPatients[0].count : 0;
    
    const statusCounts = result[0].statusCounts;
    const newPatients = statusCounts.find(status => status._id === "New")?.count || 0;
    const existingPatients = statusCounts.find(status => status._id === "Existing")?.count || 0;
    
    // Send the final JSON response
    res.status(200).json({
      success: true,
      totalPatients: totalCount,
      newPatients: newPatients,
      existingPatients: existingPatients
    });

  } catch (error) {
    console.error("Error fetching patient statistics:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};
exports.getAppointmentCountsBasedOnClassification = async (req, res) => {
  try {
    const { classification, newExisting } = req.body;

    // 1. Validate the input from the frontend
    if (!classification || !["acute", "chronic"].includes(classification.toLowerCase())) {
      return res.status(400).json({ message: "Invalid or missing classification. Must be 'acute' or 'chronic'." });
    }
    if (!newExisting || !["New", "Existing"].includes(newExisting)) {
      return res.status(400).json({ message: "Invalid or missing newExisting status. Must be 'New' or 'Existing'." });
    }

    // 2. Define the aggregation pipeline
    const pipeline = [
      // Stage 1: Look up the patient details for each appointment
      {
        $lookup: {
          from: "patients", // Your patients collection name
          localField: "patient",
          foreignField: "_id",
          as: "patientInfo"
        }
      },
      // Deconstruct the patientInfo array to access its fields
      {
        $unwind: "$patientInfo"
      },
      // Stage 2: Match appointments based on BOTH criteria
      {
        $match: {
          "classification": { $regex: `^${classification}$`, $options: 'i' },
          "patientInfo.newExisting": newExisting
        }
      },
      // Stage 3: Group the results by the 'follow' status and count each group
      {
        $group: {
          _id: "$follow",
          count: { $sum: 1 }
        }
      },
      // Stage 4: Format the output
      {
          $project: {
              _id: 0,
              stage: "$_id",
              count: "$count"
          }
      }
    ];

    // 3. Execute the aggregation query
    const results = await Appointment.aggregate(pipeline);

    // 4. Format the final response to ensure all stages are present
    const allStages = [
      "Consultation",
      "Prescription",
      "Payment",
      "Medicine Preparation",
      "Shipment",
      "Patient Care"
    ];

    const countsByStage = {};
    allStages.forEach(stage => {
      countsByStage[stage] = 0;
    });

    results.forEach(result => {
      countsByStage[result.stage] = result.count;
    });
    
    // 5. Send the final JSON response
    res.status(200).json({
      success: true,
      filters: {
          classification: classification,
          status: newExisting
      },
      appointmentCounts: countsByStage
    });

  } catch (error) {
    console.error("Error fetching appointment counts:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};
// Update Call Status
exports.updateFollowPatientCall = async (req, res) => {
  const { patientId } = req.params;
  const { newCallStatus } = req.body;

  try {
    // Find the patient by ID
    const patient = await Patient.findById(patientId);

    if (!patient) {
      return res.status(404).json({ message: "Patient not found" });
    }

    // Update the call status
    patient.enquiryStatus = newCallStatus;

    // If the new call status is 'Completed', update the follow-up status
    if (newCallStatus === "Completed") {
      patient.follow = "Consultation"; // Change this to the desired follow-up status
    }

    // Save the updated patient record
    await patient.save();

    res
      .status(200)
      .json({ message: "Call status updated successfully", patient });
  } catch (error) {
    console.error("Error updating call status:", error);
    res.status(500).json({ message: "Server error", error });
  }
};
exports.markProductReceived = async (req, res) => {
    try {
        const { prescriptionId } = req.params;

        if (!mongoose.Types.ObjectId.isValid(prescriptionId)) {
            return res.status(400).json({ message: "Invalid prescription ID." });
        }

        const prescription = await Prescription.findById(prescriptionId);
        if (!prescription) {
            return res.status(404).json({ message: "Prescription not found" });
        }

        if (!prescription.trackingId) {
            return res.status(400).json({ message: "Cannot acknowledge receipt without a tracking ID." });
        }

        prescription.isProductReceived = true;
        prescription.receivedDate = new Date(); // Added this line
        prescription.updatedAt = new Date();

        await prescription.save({ validateBeforeSave: false });

        return res.status(200).json({
            message: "Product confirmed as received"
        });
    } catch (error) {
        console.error("Error acknowledging receipt:", error);
        return res.status(500).json({ message: "Internal server error", error: error.message });
    }
};
exports.referFriend = asyncHandler(async (req, res) => {
  const { friendName, friendPhone } = req.body;
  console.log("Received request body:", req.body);
  const referrerPhone = req.user.phone;
  console.log(referrerPhone);

  const generateReferralCode = () => {
    const chars =
      "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"; // 62 characters
    let referralCode = "";
    for (let i = 0; i < 8; i++) {
      referralCode += chars[Math.floor(Math.random() * chars.length)];
    }
    return referralCode;
  };

  try {
    const referrer = await Patient.findOne({ phone: referrerPhone });
    if (!referrer) {
      return res
        .status(404)
        .json({ success: false, message: "Referrer not found" });
    }
    const appointmentBooked = await Appointment.findOne({
      patient: referrer._id,
    });
    if (!appointmentBooked) {
      return res.status(400).json({
        success: false,
        message: "First make an appointment to refer a friend",
      });
    }

    const coupon = generateReferralCode();

    const check = await Patient.findOne({ phone: friendPhone });
    console.log("Check", check);
    if (check) {
      return res
        .status(400)
        .json({ message: "Patient with this mobile number already exists!" });
    }

    let referral = await Referral.findOne({
      referredFriendPhone: friendPhone,
      referrerId: referrer._id, 
    });
    if (referral) {
      return res
        .status(400)
        .json({ message: "You have already referred this friend!" });
    } else {
      referral = await Referral.create({
        code: coupon,
        referrerId: referrer._id,
        referredFriendPhone: friendPhone, 
        referredFriendName: friendName,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), 
      });
    }
    const referralLink = `https://localhost:5173/firstform?code=${coupon}`;
    console.log(referralLink);
    res.status(200).json({
      success: true,
      message: "Referral sent successfully",
      referralLink: referralLink,
    });
  } catch (err) {
    console.error("Server error:", err);
    res.status(500).json({ success: false, error: "Server error" });
  }
});

exports.validateCoupon = async (req, res) => {
  try {
    const { code } = req.query;
    const referral = await Referral.findOne({
      code,
      isUsed: false,
      expiresAt: { $gt: new Date() },
    });

    if (referral) {
      res.status(200).json({
        success: true,
        data: {
          referredFriendName: referral.referredFriendName || "",
          referredFriendPhone: referral.referredFriendPhone,
        },
      });
    } else {
      res.status(404).json({
        success: false,
        message: "Invalid or already used referral code.",
      });
    }
  } catch (error) {
    res.status(500).json({ message: "Internal server error" });
  }
};

exports.addFamily = async (req, res) => {
  try {
    console.log("Endpoint reached addFamily at patientController");
    const { IndividulAccess, relationship } = req.body;
    const myPhone = req.user.phone;
    const User = await Patient.findOne({ phone: myPhone });
    if (!User) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    const appointmentBooked = await Appointment.findOne({
      patient: User._id,
    });
    if (!appointmentBooked) {
      return res.status(400).json({
        success: false,
        message: "First make an appointment to add a family member",
      });
    }
    if (
      relationship.toLowerCase() !== "son" &&
      relationship.toLowerCase() !== "daughter"
    ) {
      const isPatientExists = User.familyMembers.some(
        (member) => member.relationship === relationship
      );
      console.log("isPatientExists: " + isPatientExists);

      if (isPatientExists) {
        return res.status(400).json({
          message: "This relationship already exists in familyMembers.",
        });
      }

      const isFamilyLinkExists = await FamilyLink.findOne({
        userId: User._id,
        relationship: relationship,
      });

      if (isFamilyLinkExists) {
        return res.status(400).json({
          message:
            "This relationship already exists in the familyLink collection.",
        });
      }
    }

    if (
      !relationship ||
      ![
        "Father",
        "Mother",
        "Son",
        "Daughter",
        "Father in law",
        "Mother in law",
        "Husband",
        "Wife",
      ].includes(relationship)
    ) {
      return res
        .status(400)
        .json({ message: "Invalid or missing relationship" });
    }
    if (IndividulAccess) {
      const { familyMemberPhone, familyMemberName } = req.body;
      console.log(
        "Received request body:",
        familyMemberName,
        familyMemberPhone
      );
      const check = await Patient.findOne({ phone: familyMemberPhone });
      if (check) {
        return res.json({
          message: "Patient with this mobile number already exists!",
        });
      }

      const token = crypto.randomBytes(16).toString("hex");
      let family = await FamilyLink.findOne({
        phone: familyMemberPhone,
      });

      if (family) {
        
        family.token = token;

        await family.save();
      } else {
        await FamilyLink.create({
          token,
          userId: User._id,
          name: familyMemberName,
          phone: familyMemberPhone,
          relationship,
        });
      }

      const link = `https://localhost:5173/firstform?familyToken=${token}`;

      console.log(link);
      res.status(200).json({
        success: true,
        message: "Link sent successfully",
        link: link,
      });
    } else {
      const { name, age, phone, email, gender, diseaseName, diseaseType } =
        req.body;
      const {
        dob,
        weight,
        height,
        occupation,
        country,
        state,
        city,
        complaint,
        symptoms,
        associatedDisease,
        allopathy,
        diseaseHistory,
        surgeryHistory,
        allergies,
        bodyType,
      } = req.body;
      const existingPatient = await Patient.findOne({ phone });

      if (existingPatient) {
        
        return res.status(400).json({
          message: "Patient with this mobile number already exists",
        });
      }
      const currentLocation = country + ", " + state + ", " + city;
      const patientDocument = new Patient({
        name,
        age,
        phone,
        email,
        // gender,
        // diseaseName,
        // diseaseType,
        patientEntry: "Family Tree",
        currentLocation,
      });
      const saveBasic = await patientDocument.save();

      const medicalDocument = new MedicalDetails({
        patientId: saveBasic._id,
        consultingFor: relationship,
        //   name,
        //   age,
        //   phone,
        //   email,
        //   // gender,
        diseaseName,
        diseaseType,
      });
      const saveMedical = await medicalDocument.save();

      if (
        relationship == "Father" ||
        relationship == "Son" ||
        relationship == "Father-in-law"
      ) {
        patientDocument.gender = "Male";
      } else {
        patientDocument.gender = "Female";
      }
      await patientDocument.save();
      const chronicPatientDocument = new ChronicPatient({
        phone,
        dob,
        weight,
        height,
        occupation,
        country,
        state,
        city,
        complaint,
        symptoms,
        associatedDisease,
        allopathy,
        diseaseHistory,
        surgeryHistory,
        allergies,
        bodyType,
      });

      // Save the chronic patient document to the "chronics" collection in the database
      await chronicPatientDocument.save();
      res.status(201).json({
        message: "Patient data saved successfully",
        AcuteDetails: patientDocument,
        ChronicDetails: chronicPatientDocument,
      });
      const senderId = User._id;
      await Patient.findByIdAndUpdate(senderId, {
        $push: {
          familyMembers: {
            IndividulAccess: false,
            memberId: patientDocument._id, // Add patient ID as memberId
            relationship, // Include relationship role
            name: name, // Store the family member's name here
          },
        },
      });
    }
  } catch (e) {
    console.log(e);
  }
};

exports.fetchFamilyDetails = async (req, res) => {
  try {
    const { familyToken } = req.query;

    if (!familyToken) {
      return res.status(400).json({
        success: false,
        message: "Family token is required",
      });
    }

    const familyLink = await FamilyLink.findOne({ token: familyToken });

    if (!familyLink) {
      return res.status(404).json({
        success: false,
        message: "Invalid or expired family token",
      });
    }

    // Derive gender
    const getGenderFromRelationship = (relationship) => {
      const maleRelationships = ["Father", "Son", "Father in law", "Husband"];
      const femaleRelationships = [
        "Mother",
        "Daughter",
        "Mother in law",
        "Wife",
      ];

      if (maleRelationships.includes(relationship)) {
        return "Male";
      } else if (femaleRelationships.includes(relationship)) {
        return "Female";
      } else {
        return "";
      }
    };

    const gender = getGenderFromRelationship(familyLink.relationship);

    return res.status(200).json({
      success: true,
      data: {
        name: familyLink.name,
        phone: familyLink.phone,
        gender: gender,
      },
    });
  } catch (error) {
    console.error("Error fetching family details:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};
exports.getPatientMedicationSummary = async (req, res) => {
  try {
    const { patientId } = req.params;
    const { date } = req.query;

    if (!patientId || !date) {
      return res.status(400).json({ message: "Patient ID and date are required" });
    }

    const selectedDateUTC = new Date(date);
    selectedDateUTC.setUTCHours(0, 0, 0, 0);

    const nextDateUTC = new Date(selectedDateUTC);
    nextDateUTC.setUTCDate(selectedDateUTC.getUTCDate() + 1);

    console.log("Fetching medication summary for patientId:", patientId, "on date:", selectedDateUTC.toISOString());

    const reminders = await NotificationReminderSettings.find({
      patientId,
      date: {
        $gte: selectedDateUTC,
        $lt: nextDateUTC
      }
    }).lean();

    if (!reminders.length) {
      return res.status(404).json({ message: "No reminders found for this patient on selected date" });
    }

    const patient = await Patient.findById(patientId).lean();
    const meta = await Patient.findById(patientId).lean(); // or findOne({ _id: patientId })


    const taken = [], missed = [], pending = [], viewMedications = [];

    for (const reminder of reminders) {
      const base = {
        medicineName: reminder.medicineName || "",
        doseTime: reminder.doseTime || ""
      };

      if (reminder.status === true) {
        taken.push(base);
        viewMedications.push({ ...base, status: "taken" });
      } else if (reminder.status === false) {
        missed.push(base);
        viewMedications.push({ ...base, status: "missed" });
      } else {
        pending.push(base);
        viewMedications.push({ ...base, status: "pending" });
      }
    }

    const response = {
      patientId,
      name: patient?.name || "",
      age: patient?.age || "",
      gender: patient?.gender || "",
      diseaseName: meta?.diseaseName || "",
      diseaseType: meta?.diseaseType?.name || "",

      doses: {
        taken: {
          count: taken.length,
          data: taken
        },
        missed: {
          count: missed.length,
          data: missed
        },
        pending: {
          count: pending.length,
          data: pending
        }
      },

      viewMedications
    };

    return res.status(200).json(response);
  } catch (error) {
    console.error("Error in getPatientMedicationSummary:", error);
    return res.status(500).json({ message: "Server error", error });
  }
};

exports.getFamily = async (req, res) => {
  try {
    // Find the patient document using the authenticated user's ID
    console.log("Reached!");
    const patient = await Patient.findOne({ _id: req.user.id });

    if (!patient) {
      return res.status(404).json({
        success: false,
        message: "Patient not found",
      });
    }

    // Check if familyMembers array exists
    if (!patient.familyMembers || !Array.isArray(patient.familyMembers)) {
      return res.json({
        success: true,
        familyMembers: [],
      });
    }

    // Map through family members to structure the response
    const enrichedFamilyMembers = patient.familyMembers.map((member) => ({
      _id: member.memberId,
      name: member.name,
      relationship: member.relationship,
      IndividulAccess: member.IndividulAccess || false,
      dob: member.dob,
      weight: member.weight,
      height: member.height,
      occupation: member.occupation,
      country: member.country,
      state: member.state,
      city: member.city,
      complaint: member.complaint,
      symptoms: member.symptoms,
      associatedDisease: member.associatedDisease,
      allopathy: member.allopathy,
      diseaseHistory: member.diseaseHistory,
      surgeryHistory: member.surgeryHistory,
      allergies: member.allergies,
      bodyType: member.bodyType,
    }));

    return res.json({
      success: true,
      familyMembers: enrichedFamilyMembers,
    });
  } catch (error) {
    console.error("Error fetching family members:", error);
    return res.status(500).json({
      success: false,
      message: "Server error while fetching family members",
      error: error.message,
    });
  }
};

//getting family members details while making appointments
exports.getFamilyMembers = async (req, res) => {
  try {
    const myPhone = req.user.phone;
    const user = await Patient.findOne({ phone: myPhone });

    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    const familyMembers = user.familyMembers.map((member) => ({
      id: member.memberId, // Unique identifier
      relationship: `${member.relationship} - ${member.name}`, // Display format
      IndividulAccess: member.IndividulAccess,
    }));

    res.status(200).json({
      success: true,
      familyMembers,
    });
  } catch (error) {
    console.error("Error fetching family members:", error);
    res
      .status(500)
      .json({ success: false, message: "Failed to retrieve family members" });
  }
};

exports.getPatientDetails = async (req, res) => {
  console.log("Patient Details endpoint reached");
  const patientId = req.user.id; // Adjust this based on your authentication method
  console.log(patientId);
  const patient = await Patient.findById(patientId);
  try {
    const patientId = req.user.id; // Adjust this based on your authentication method
    console.log(patientId);
    const patient = await Patient.findById(patientId);

    if (!patient) {
      return res.status(404).json({ message: "Patient not found" });
    }

    const patientDetails = {
      consultingFor: patient.consultingFor,
      name: patient.name,
      age: patient.age,
      phone: patient.phone,
      whatsappNumber: patient.whatsappNumber,
      email: patient.email,
      gender: patient.gender,
      diseaseName: patient.diseaseName,
      diseaseType: patient.diseaseType,
      currentLocation: patient.currentLocation,
      patientEntry: patient.patientEntry,
    };

    res.json(patientDetails);
  } catch (error) {
    console.error("Error fetching family member details:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching family member details",
      error: error.message,
    });
  }
};

exports.getFamilyMemberDetails = async (req, res) => {
  try {
    const { memberId } = req.params;
    const userId = req.user.id;

    const familyMember = await FamilyLink.findOne({
      memberId,
      userId,
    });

    if (!familyMember) {
      return res.status(404).json({
        success: false,
        message: "Family member not found",
      });
    }

    res.status(200).json({
      success: true,
      familyMember,
    });
  } catch (error) {
    console.error("Error fetching family member details:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching family member details",
      error: error.message,
    });
  }
};

// Update family member access
exports.updateFamilyMemberAccess = async (req, res) => {
  try {
    const { memberId } = req.params;
    const { IndividulAccess } = req.body;
    const userId = req.user.id;

    const familyMember = await FamilyLink.findOneAndUpdate(
      { memberId, userId },
      { IndividulAccess },
      { new: true }
    );

    if (!familyMember) {
      return res.status(404).json({
        success: false,
        message: "Family member not found",
      });
    }

    res.status(200).json({
      success: true,
      familyMember,
    });
  } catch (error) {
    console.error("Error updating family member access:", error);
    res.status(500).json({
      success: false,
      message: "Error updating family member access",
      error: error.message,
    });
  }
};

// Add new family member
exports.addFamilyMember = async (req, res) => {
  try {
    const { name, relationship } = req.body;
    const userId = req.user.id;

    // Validate relationship
    const validRelationships = [
      "Father",
      "Mother",
      "Son",
      "Daughter",
      "Father in law",
      "Mother in law",
    ];
    if (!validRelationships.includes(relationship)) {
      return res.status(400).json({
        success: false,
        message: "Invalid relationship type",
      });
    }

    const newFamilyMember = new FamilyLink({
      name,
      relationship,
      memberId: new mongoose.Types.ObjectId(),
      userId,
      IndividulAccess: false,
    });

    await newFamilyMember.save();

    res.status(201).json({
      success: true,
      familyMember: newFamilyMember,
    });
  } catch (error) {
    console.error("Error adding family member:", error);
    res.status(500).json({
      success: false,
      message: "Error adding family member",
      error: error.message,
    });
  }
};

// Remove family member
exports.removeFamilyMember = async (req, res) => {
  try {
    const { memberId } = req.params;
    const userId = req.user.id;

    const result = await FamilyLink.findOneAndDelete({
      memberId,
      userId,
    });

    if (!result) {
      return res.status(404).json({
        success: false,
        message: "Family member not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Family member removed successfully",
    });
  } catch (error) {
    console.error("Error removing family member:", error);
    res.status(500).json({
      success: false,
      message: "Error removing family member",
      error: error.message,
    });
  }
};

// Search family members
exports.searchFamilyMembers = async (req, res) => {
  try {
    const { query } = req.query;
    const userId = req.user.id;

    const searchRegex = new RegExp(query, "i");

    const familyMembers = await FamilyLink.find({
      userId,
      $or: [{ name: searchRegex }, { relationship: searchRegex }],
    }).select("name relationship memberId IndividulAccess");

    res.status(200).json({
      success: true,
      familyMembers,
    });
  } catch (error) {
    console.error("Error searching family members:", error);
    res.status(500).json({
      success: false,
      message: "Error searching family members",
      error: error.message,
    });
  }
};

// Filter family members by relationship
exports.filterFamilyMembers = async (req, res) => {
  try {
    const { relationship } = req.query;
    const userId = req.user.id;

    const query = { userId };

    if (relationship !== "All") {
      if (relationship === "Parents") {
        query.relationship = {
          $in: ["Father", "Mother", "Father in law", "Mother in law"],
        };
      } else if (relationship === "Children") {
        query.relationship = {
          $in: ["Son", "Daughter"],
        };
      } else if (relationship === "In-Laws") {
        query.relationship = {
          $regex: /in law/i,
        };
      } else if (relationship === "Individual Access") {
        query.IndividulAccess = true;
      } else if (relationship === "No Access") {
        query.IndividulAccess = false;
      }
    }

    const familyMembers = await FamilyLink.find(query)
      .select("name relationship memberId IndividulAccess")
      .sort({ relationship: 1, name: 1 });

    res.status(200).json({
      success: true,
      familyMembers,
    });
  } catch (error) {
    console.error("Error filtering family members:", error);
    res.status(500).json({
      success: false,
      message: "Error filtering family members",
      error: error.message,
    });
  }
};

exports.fetchProfile = async (req, res) => {
  try {
    const patientId = req.user.id; // Adjust this based on your authentication method
    console.log(patientId);
    // const patient = await Patient.findById(patientId);
    const patient = await Patient.findById(patientId).select("-password"); // Exclude sensitive data

    if (!patient) {
      return res.status(404).json({ message: "Patient not found" });
    }

    res.status(200).json(patient);
  } catch (error) {
    console.error("Error fetching profile:", error);
    res.status(500).json({ message: "Failed to fetch profile" });
  }
};

exports.uploadProfilePicture = async (req, res) => {
  try {
    const patientId = req.user._id; // assuming authentication middleware sets this
    const patient = await Patient.findById(patientId);

    if (!patient) {
      return res
        .status(404)
        .json({ success: false, message: "Patient not found" });
    }

    let profilePhotoUrl = "";

    if (req.file) {
      // 📤 Upload file to Cloudinary
      const uploadResult = await cloudinary.uploader.upload(req.file.path, {
        folder: "patient_profiles",
        resource_type: "image",
      });

      profilePhotoUrl = uploadResult.secure_url;

      // if (req.file) {
      //   const uploadResult = await cloudinary.uploader.upload(req.file.path, {
      //     folder: "patient_profile_photos",
      //     public_id: `${patientId}_profile`,
      //     overwrite: true,
      //   });

      //   profilePhotoUrl = uploadResult.secure_url;

      // 🧹 Clean up local file
      fs.unlink(req.file.path, (err) => {
        if (err) console.error("Failed to delete local file:", err);
      });
    } else {
      // 🖼️ Generate avatar using initials if no file uploaded
      const initials = patient.name
        ? patient.name
            .split(" ")
            .map((n) => n[0])
            .join("")
            .toUpperCase()
        : "P";

      profilePhotoUrl = `https://ui-avatars.com/api/?name=${initials}&background=random&color=fff&size=128`;
    }

    // ✅ Save to patient
    patient.profilePhoto = profilePhotoUrl;
    await patient.save();

    res.status(200).json({
      success: true,
      message: "Profile picture updated successfully",
      profilePhoto: profilePhotoUrl,
    });
  } catch (error) {
    console.error("Upload error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to upload profile picture",
      error: error.message,
    });
  }
};

exports.updateProfile = async (req, res) => {
  try {
    const userId = req.user.id;

    // Destructure the fields from the request body
    const { name, age, phone, whatsappNumber, gender } = req.body;

    // Find and update the patient document
    const updatedPatient = await Patient.findByIdAndUpdate(
      userId,
      {
        name,
        age,
        phone,
        whatsappNumber,
        gender,
      },
      { new: true, runValidators: true }
    );

    if (!updatedPatient) {
      return res.status(404).json({ message: "Patient not found" });
    }

    res.status(200).json({
      message: "Profile updated successfully",
      data: updatedPatient,
    });
  } catch (error) {
    console.error("Error updating profile:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// exports.getProfile = async (req, res) => {
//   try {
//     const patientId = req.user._id;
//     const patient = await Patient.findById(patientId).select(
//       "name email profilePhoto"
//     );

//     if (!patient) {
//       return res
//         .status(404)
//         .json({ success: false, message: "Patient not found" });
//     }

//     res.status(200).json({ success: true, data: patient });
//   } catch (error) {
//     console.error("Fetch error:", error);
//     res
//       .status(500)
//       .json({
//         success: false,
//         message: "Failed to fetch profile",
//         error: error.message,
//       });
//   }
// };

// // Update Appointment
// exports.updateAppointment = asyncHandler(async (req, res) => {
//   const { id } = req.params;
//   const { status } = req.body;

//   const appointment = await Appointment.findById(id);
//   if (!appointment) {
//     return res.status(404).json({ message: "Appointment not found" });
//   }

//   appointment.status = status || appointment.status;
//   await appointment.save();

//   res.status(200).json({
//     message: "Appointment updated successfully",
//     appointment,
//   });
// });

// // Get Appointments by Date
// exports.getAppointmentsByDate = asyncHandler(async (req, res) => {
//   const { date } = req.query;

//   const appointmentDate = new Date(date);
//   const appointments = await Appointment.find({ appointmentDate });

//   res.status(200).json(appointments);
// });

// // Get Appointment by ID
// exports.getAppointmentById = asyncHandler(async (req, res) => {
//   const { id } = req.params;

//   const appointment = await Appointment.findById(id);
//   if (!appointment) {
//     return res.status(404).json({ message: "Appointment not found" });
//   }

//   res.status(200).json(appointment);
// });

// // Cancel Appointment
// exports.cancelAppointment = asyncHandler(async (req, res) => {
//   const { id } = req.params;

//   const appointment = await Appointment.findByIdAndDelete(id);
//   if (!appointment) {
//     return res.status(404).json({ message: "Appointment not found" });
//   }

//   res.status(200).json({ message: "Appointment cancelled successfully" });
// });

exports.getPayments = async (req, res) => {
  try {
    const userId = req.user.id;
    const payments = await Payment.find().populate("userId", "name"); // Assuming user has 'name'
    res.json(payments);
  } catch (e) {
    res.status(500).json({ message: "Internal server error" });
  }
};

exports.getAppointment = async (req, res) => {
  try {
    console.log("GetAppointment is reaching");
    const { appointmentId } = req.params;
    console.log("Appointment ID: ", appointmentId);
    if (!mongoose.Types.ObjectId.isValid(appointmentId)) {
      return res.status(400).json({ message: "Invalid appointment ID format" });
    }
    console.log("1");
    const appointment = await Appointment.findById(appointmentId)
      .populate("doctor", "name specialty")
      .populate("patient", "name");

    console.log("appointment: ", appointment);
    if (!appointment) {
      return res
        .status(404)
        .json({ message: `Appointment not found with ID: ${appointmentId}` });
    }
    console.log("2");
    // Check if the user is the patient or the doctor for this appointment
    console.log(
      "appointment.patient._id: ",
      appointment.patient._id.toString()
    );
    console.log("req.user.id: ", req.user.id);
    // console.log("req.user.role: ", req.user.role);
    // Must be implemented
    // if (
    //   appointment.patient._id.toString() !== req.user.id &&
    //   appointment.doctor._id.toString() !== req.user.id &&
    //   req.user.userType !== "admin"
    // ) {
    //   return res
    //     .status(403)
    //     .json({ message: "Not authorized to access this appointment" });
    // }
    console.log("3");

    res.json(appointment);
    console.log("4");
  } catch (error) {
    console.log("5");
    res
      .status(500)
      .json({ message: "Error fetching appointment", error: error.message });
  }
};

// Update appointment
exports.updateAppointment = async (req, res) => {
  try {
    const { appointmentId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(appointmentId)) {
      return res.status(400).json({ message: "Invalid appointment ID format" });
    }

    const appointment = await Appointment.findById(appointmentId);

    if (!appointment) {
      return res
        .status(404)
        .json({ message: `Appointment not found with ID: ${appointmentId}` });
    }

    // Check authorization - only allow updates by the patient, doctor, or admin
    if (
      appointment.patient.toString() !== req.user.id &&
      appointment.doctor.toString() !== req.user.id &&
      req.user.role !== "admin"
    ) {
      return res
        .status(403)
        .json({ message: "Not authorized to update this appointment" });
    }

    // Update only allowed fields
    const allowedUpdates = ["status", "medicalPayment", "notes"];

    // Filter out updates that are not allowed
    const updates = Object.keys(req.body)
      .filter((update) => allowedUpdates.includes(update))
      .reduce((obj, key) => {
        obj[key] = req.body[key];
        return obj;
      }, {});

    // Apply updates
    const updatedAppointment = await Appointment.findByIdAndUpdate(
      appointmentId,
      { $set: updates },
      { new: true, runValidators: true }
    ).populate("doctor", "name specialty");

    res.json(updatedAppointment);
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error updating appointment", error: error.message });
  }
};

// Save a new patient notification
exports.savePatientNotification = async function (req, res) {
  try {
    const { message } = req.body;
    const { patientId } = req.params;

    if (!patientId || !message) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    // Explicitly define only allowed fields
    const notification = new PatientNotification({
      patientId,
      message
    });

    await notification.save();

    return res.status(201).json({
      message: "Notification saved",
      data: {
        _id: notification._id,
        patientId: notification.patientId,
        message: notification.message,
        createdAt: notification.createdAt
      }
    });

  } catch (err) {
    console.error("Error saving notification:", err);
    return res.status(500).json({
      message: "Error saving notification",
      error: err.message
    });
  }
};

exports.updateReminderOffset = async function (req, res) {
  try {
    const { reminderOffset } = req.body;
    const { patientId } = req.params; 

    if (!patientId || reminderOffset === undefined) {
      return res.status(400).json({ message: "Missing patientId or reminderOffset" });
    }

    const updated = await Patient.findByIdAndUpdate(
      patientId,
      { reminderOffset },
      { new: true }
    );

    if (!updated) {
      return res.status(404).json({ message: "Patient not found" });
    }

    return res.status(200).json({
      message: "Reminder offset updated",
      reminderOffset: updated.reminderOffset
    });

  } catch (err) {
    console.error("Error updating reminder offset:", err);
    return res.status(500).json({
      message: "Error updating reminder offset",
      error: err.message
    });
  }
};
exports.getPrescriptionsGroupedByPrescriptionId = asyncHandler(async (req, res) => {
  const { patientId } = req.params;

  // 1. Get reminders for this patient
  const reminders = await NotificationReminderSettings.find({ patientId })
    .select("prescriptionId medicineName date doseTime")
    .populate("prescriptionId", "_id")
    .sort({ prescriptionId: 1, date: 1 });

  // 2. Group reminders by prescriptionId
  const grouped = reminders.reduce((acc, curr) => {
    const key = curr.prescriptionId?._id?.toString() || "Unlinked";
    if (!acc[key]) acc[key] = [];
    acc[key].push({
      medicineName: curr.medicineName,
      date: curr.date,
      doseTime: curr.doseTime,
    });
    return acc;
  }, {});

  // 3. Fetch patient name
  const patient = await Patient.findById(patientId).select("name");
  const patientName = patient?.name || "Unknown Patient";

  // 4. Fetch all prescriptions for this patient
  const prescriptionIds = Object.keys(grouped);
  const prescriptions = await Prescription.find({ _id: { $in: prescriptionIds } })
    .populate("doctorId", "name")
    .select("label startDate endDate medicineCourse consultingFor notes doctorId");

  // 5. Map prescription metadata by ID
  const prescriptionMeta = {};
  prescriptions.forEach((pres) => {
    prescriptionMeta[pres._id] = {
      label: pres.label,
      startDate: pres.startDate,
      endDate: pres.endDate,
      medicineCourse: pres.medicineCourse,
      consultingFor: pres.consultingFor,
      notes: pres.notes,
      doctorName: pres.doctorId?.name || "Unknown Doctor",
    };
  });

  // 6. Build final response with medicineDurations
  const result = {};

  for (const id of Object.keys(grouped)) {
    const reminders = grouped[id];

    // Group reminders by medicineName
    const medicineMap = {};
    reminders.forEach(({ medicineName, date }) => {
      if (!medicineMap[medicineName]) {
        medicineMap[medicineName] = new Set();
      }
      medicineMap[medicineName].add(new Date(date).toDateString());
    });

    // Convert sets to duration info
    const medicineDurations = Object.entries(medicineMap).map(
      ([medicineName, dateSet]) => {
        const datesArray = Array.from(dateSet).map((d) => new Date(d));
        const sortedDates = datesArray.sort((a, b) => a - b);
        return {
          medicineName,
          startDate: sortedDates[0],
          endDate: sortedDates[sortedDates.length - 1],
          numberOfDays: dateSet.size,
        };
      }
    );

    result[id] = {
      metadata: prescriptionMeta[id] || {},
      reminders,
      medicineDurations,
    };
  }

  res.status(200).json({
    patientName,
    prescriptions: result,
  });
});

exports.getPatientMedicationSummary = async (req, res) => {
  try {
    const { patientId } = req.params;
    const { date } = req.query;

    if (!patientId || !date) {
      return res.status(400).json({ message: "Patient ID and date are required" });
    }

    const selectedDateUTC = new Date(date);
    selectedDateUTC.setUTCHours(0, 0, 0, 0);

    const nextDateUTC = new Date(selectedDateUTC);
    nextDateUTC.setUTCDate(selectedDateUTC.getUTCDate() + 1);

    console.log("Fetching medication summary for patientId:", patientId, "on date:", selectedDateUTC.toISOString());

    const reminders = await NotificationReminderSettings.find({
      patientId,
      date: {
        $gte: selectedDateUTC,
        $lt: nextDateUTC
      }
    }).lean();

    if (!reminders.length) {
      return res.status(404).json({ message: "No reminders found for this patient on selected date" });
    }

    const patient = await Patient.findById(patientId).lean();
    const meta = await Patient.findById(patientId).lean(); // or findOne({ _id: patientId })


    const taken = [], missed = [], pending = [], viewMedications = [];

    for (const reminder of reminders) {
      const base = {
        medicineName: reminder.medicineName || "",
        doseTime: reminder.doseTime || ""
      };

      if (reminder.status === true) {
        taken.push(base);
        viewMedications.push({ ...base, status: "taken" });
      } else if (reminder.status === false) {
        missed.push(base);
        viewMedications.push({ ...base, status: "missed" });
      } else {
        pending.push(base);
        viewMedications.push({ ...base, status: "pending" });
      }
    }

    const response = {
      patientId,
      name: patient?.name || "",
      age: patient?.age || "",
      gender: patient?.gender || "",
      diseaseName: meta?.diseaseName || "",
      diseaseType: meta?.diseaseType?.name || "",

      doses: {
        taken: {
          count: taken.length,
          data: taken
        },
        missed: {
          count: missed.length,
          data: missed
        },
        pending: {
          count: pending.length,
          data: pending
        }
      },

      viewMedications
    };

    return res.status(200).json(response);
  } catch (error) {
    console.error("Error in getPatientMedicationSummary:", error);
    return res.status(500).json({ message: "Server error", error });
  }
};

exports.getPrescriptionsGroupedByWeekAndDay = asyncHandler(async (req, res) => {
  const { patientId } = req.params;

  const reminders = await NotificationReminderSettings.find({ patientId })
    .select("prescriptionId medicineName date doseTime status")
    .populate("prescriptionId", "_id startDate endDate")
    .sort({ date: 1 });

  if (reminders.length === 0) {
    return res.status(200).json({});
  }

  // Get the earliest medicine date from reminders
  const firstReminderDate = new Date(reminders[0].date);
  firstReminderDate.setUTCHours(0, 0, 0, 0);

  const dayOfWeek = firstReminderDate.getUTCDay(); // 0 (Sun) - 6 (Sat)
  const daysSinceMonday = (dayOfWeek + 6) % 7; // Makes Monday = 0
  const startOfWeekOne = new Date(firstReminderDate);
  startOfWeekOne.setUTCDate(startOfWeekOne.getUTCDate() - daysSinceMonday);
  startOfWeekOne.setUTCHours(0, 0, 0, 0);

  const msPerDay = 1000 * 60 * 60 * 24;
  const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const weekMap = {};

  reminders.forEach((reminder) => {
    const dateObj = new Date(reminder.date);
    dateObj.setUTCHours(0, 0, 0, 0);

    const diffInDays = Math.floor((dateObj - startOfWeekOne) / msPerDay);
    const weekNumber = Math.floor(diffInDays / 7) + 1;

    const dayName = dayNames[dateObj.getUTCDay()];
    const dayKey = `Day ${dayName}`;
    const weekKey = `Week ${weekNumber}`;
    const dayString = dateObj.toISOString().split("T")[0];

    if (!weekMap[weekKey]) weekMap[weekKey] = {};
    if (!weekMap[weekKey][dayKey]) weekMap[weekKey][dayKey] = [];

    weekMap[weekKey][dayKey].push({
      medicineName: reminder.medicineName,
      date: dayString,
      day: dayName,
      doseTime: reminder.doseTime,
      status: reminder.status,
    });
  });

  res.status(200).json(weekMap);
});
exports.getPendingPaymentsByPatient = async (req, res) => {
  try {
    const { patientId } = req.params;

    // Validate if the provided patientId is a valid MongoDB ObjectId
    if (!mongoose.Types.ObjectId.isValid(patientId)) {
      return res.status(400).json({ message: "Invalid Patient ID format" });
    }

    // Find all prescriptions for the patient where payment is not done
    const pendingPrescriptions = await Prescription.find({
      patientId: patientId,
      isPayementDone: false,
    });

    // If no prescriptions are found, return a clean response
    if (!pendingPrescriptions || pendingPrescriptions.length === 0) {
      return res.status(200).json({
        message: "No pending payments found for this patient.",
        prescriptions: [],
        grandTotal: 0,
      });
    }

    // Process the found prescriptions to calculate totals
    const detailedBills = pendingPrescriptions.map((p) => {
      const medicineCharges = p.medicineCharges || 0;
      const shippingCharges = p.shippingCharges || 0;
      const additionalCharges=p.additionalCharges||0;
      const totalCharges = medicineCharges + shippingCharges + additionalCharges

      return {
        prescriptionId: p._id,
        medicineCharges,
        shippingCharges,
        additionalCharges,
        totalCharges,
      };
    });

    // Calculate the grand total by summing up the totalCharges of each bill
    const grandTotal = detailedBills.reduce(
      (sum, bill) => sum + bill.totalCharges,
      0
    );

    // Send the final structured response
    res.status(200).json({
      prescriptions: detailedBills,
      grandTotal,
    });
    
  } catch (error) {
    console.error("Error fetching pending payments:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};
function to24Hour(timeStr) {
  let [hr, min, period] = timeStr.match(/(\d+):(\d+)\s*(AM|PM)/).slice(1,4);
  hr = parseInt(hr, 10);
  min = parseInt(min, 10);
  if (period === "PM" && hr !== 12) hr += 12;
  if (period === "AM" && hr === 12) hr = 0;
  return { hr, min };
}

function getTimeSlots24(start, end, interval) {
  let result = [];
  const s = to24Hour(start);
  const e = to24Hour(end);

  let current = new Date(0, 0, 0, s.hr, s.min);
  const endDate = new Date(0, 0, 0, e.hr, e.min);

  while (current <= endDate) {
    let hh = current.getHours().toString().padStart(2, "0");
    let mm = current.getMinutes().toString().padStart(2, "0");
    result.push(`${hh}:${mm}`); // Only 24-hour format, no AM/PM
    current.setMinutes(current.getMinutes() + interval);
  }
  return result;
}

function removeSlots(slotsToRemove, slots) {
  const removalSet = new Set(slotsToRemove);
  return slots.filter(slot => !removalSet.has(slot));
}

function getFrequency(arr) {
  const freq = { Acute: 0, Chronic: 0, Others: 0 };

  for (const word of arr) {
    if (freq.hasOwnProperty(word)) {
      freq[word] += 1;
    }
  }

  return freq;
}

function calculateSlots(total, percentObj) {
  const result = {};
  let sum = 0;

  for (const [key, percent] of Object.entries(percentObj)) {
    result[key] = Math.floor((percent / 100) * total);
    sum += result[key];
  }

  // Adjust to ensure the total is exactly equal to totalSlots
  let remainder = total - sum;
  if (remainder > 0) {
    // Assign remainder to the category with highest percentage (Acute here)
    result['Acute'] += remainder;
  }

  return result;
}

//give timeslots 
// const Appointment = require("../models/appointmentModel"); 
const {ClinicOperationHours,AppointmentSlotTypes} = require("../models/consultationMessengerSettings");
/**
 * Helper function to calculate the number of slots per category.
 * @param {number} totalSlots - The total number of slots available in a day.
 * @param {object} percentages - An object with percentages for each category.
 * @returns {object} - An object with the calculated number of slots for each category.
 */
function calculateSlots(totalSlots, percentages) {
  const slots = {};
  for (const key in percentages) {
    slots[key] = Math.floor(totalSlots * (percentages[key] / 100));
  }
  return slots;
}

/**
 * Helper function to count the frequency of each item in an array.
 * @param {Array<string>} arr - The array of items to count.
 * @returns {object} - An object with the frequency of each item.
 */
function getFrequency(arr) {
  return arr.reduce((acc, value) => {
    acc[value] = (acc[value] || 0) + 1;
    return acc;
  }, {});
}

/**
 * Helper function to convert 12-hour AM/PM time to 24-hour format.
 * @param {string} timeStr - Time in "hh:mm AM/PM" or "HH:mm" format.
 * @returns {string} - Time in "HH:mm" format.
 */
function convertTo24Hour(timeStr) {
  const time = timeStr.toUpperCase();
  const [hoursMinutes, modifier] = time.split(' ');
  let [hours, minutes] = hoursMinutes.split(':');

  if (modifier === 'PM' && hours !== '12') {
    hours = parseInt(hours, 10) + 12;
  }
  if (modifier === 'AM' && hours === '12') {
    hours = '00';
  }

  // Pad hours with a leading zero if needed
  return `${String(hours).padStart(2, '0')}:${minutes}`;
}


/**
 * NEW AND IMPROVED HELPER FUNCTION
 * Generates time slots and handles both 24-hour and 12-hour AM/PM formats.
 * @param {string} start - Start time (e.g., "09:00 AM" or "09:00").
 * @param {string} end - End time (e.g., "05:00 PM" or "17:00").
 * @param {number} duration - Duration of each slot in minutes.
 * @returns {Array<string>} - An array of time slots.
 */
function getTimeSlots24(start, end, duration) {
    // Convert times to 24-hour format first
    const startTime24 = convertTo24Hour(start);
    const endTime24 = convertTo24Hour(end);

    const slots = [];
    let currentTime = new Date(`1970-01-01T${startTime24}:00`);
    const endTime = new Date(`1970-01-01T${endTime24}:00`);

    if (endTime <= currentTime) {
        endTime.setDate(endTime.getDate() + 1);
    }

    while (currentTime < endTime) {
        slots.push(currentTime.toTimeString().substring(0, 5));
        currentTime.setMinutes(currentTime.getMinutes() + duration);
    }
    return slots;
}

/**
 * Helper function to remove booked slots from a list of all possible slots.
 * @param {Array<string>} booked - An array of booked time slots.
 * @param {Array<string>} allSlots - An array of all possible time slots.
 * @returns {Array<string>} - An array of available time slots.
 */
function removeSlots(booked, allSlots) {
  const bookedSet = new Set(booked);
  return allSlots.filter(slot => !bookedSet.has(slot));
}


// --- Main Controller Function ---

exports.appointmentBookingTimeSlot = async (req, res) => {
    // 'appointmentType' is no longer needed from the request body
    const { date } = req.body;

    try {
        // Validation now only checks for date
        if (!date) {
            return res.status(400).json({ message: "Date is required" });
        }

        const inputDate = new Date(date);
        const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
        const dayName = days[inputDate.getDay()];

        // --- 1. Fetch all necessary data in parallel ---
        const [
            clinicDayInfo,
            allSlotTypes,
            appointmentsForDay,
            doctorDetails,
        ] = await Promise.all([
            ClinicOperationHours.findOne({ day: dayName }),
            AppointmentSlotTypes.find({}),
            Appointment.find({
                appointmentDate: {
                    $gte: new Date(inputDate).setHours(0, 0, 0, 0),
                    $lte: new Date(inputDate).setHours(23, 59, 59, 999),
                },
            }),
            DoctorPrefinedAppointmentDetails.findOne({}),
        ]);

        if (!clinicDayInfo || !doctorDetails) {
            return res.status(404).json({ message: "Clinic or doctor settings not found." });
        }

        // --- 2. Generate Time Slots ---
        // The quota check for 'Acute', 'Chronic', etc., has been removed.
        const bookedTimeSlots = appointmentsForDay.map(app => app.timeSlot);
        const { consultationTime } = doctorDetails;
        const availableSlotsResponse = {};

        // A. Handle Week Off
        if (clinicDayInfo.status === false) {
            const weekoffType = allSlotTypes.find(st => st.slotType === "Weekoff");
            if (weekoffType && weekoffType.allowBooking) {
                const allPossibleSlots = getTimeSlots24(weekoffType.startingTime, weekoffType.endingTime, consultationTime);
                const available = removeSlots(bookedTimeSlots, allPossibleSlots);
                if (available.length > 0) {
                    availableSlotsResponse["Weekoff"] = available.map(time => ({ time, price: weekoffType.price }));
                }
            }
        }
        // B. Handle Working Day
        else {
            for (const slotType of allSlotTypes) {
                if (slotType.slotType === "Weekoff") continue; // Skip weekoff type on a working day

                if (slotType.allowBooking) {
                    const allPossibleSlots = getTimeSlots24(slotType.startingTime, slotType.endingTime, consultationTime);
                    const available = removeSlots(bookedTimeSlots, allPossibleSlots);
                    if (available.length > 0) {
                        availableSlotsResponse[slotType.slotType] = available.map(time => ({ time, price: slotType.price }));
                    }
                }
            }
        }

        // --- 3. Return the final structured response ---
        if (Object.keys(availableSlotsResponse).length === 0) {
            return res.status(200).json({ message: "No available slots for this day.", result: {} });
        }

        return res.status(200).json({ result: availableSlotsResponse });

    } catch (error) {
        console.error("Error in appointmentBookingTimeSlot:", error);
        return res.status(500).json({ message: "An internal server error occurred." });
    }
};
exports.getAllPaymentsByPatient = async (req, res) => {
  try {
    const { patientId } = req.params;

    // Validate the patientId format
    if (!mongoose.Types.ObjectId.isValid(patientId)) {
      return res.status(400).json({ message: "Invalid Patient ID format" });
    }

    // Find ALL prescriptions for the patient, regardless of payment status
    const allPrescriptions = await Prescription.find({
      patientId: patientId,
      // The `isPayementDone: false` filter is removed
    }).sort({ createdAt: -1 }); // Sort by most recent first

    if (!allPrescriptions || allPrescriptions.length === 0) {
      return res.status(200).json({
        message: "No payment history found for this patient.",
        prescriptions: [],
      });
    }

    // Process the prescriptions to include payment status and totals
    let totalAmount = 0;
    let amountPaid = 0;
    
    const detailedBills = allPrescriptions.map((p) => {
      const medicineCharges = p.medicineCharges || 0;
      const shippingCharges = p.shippingCharges || 0;
      const additionalCharges = p.additionalCharges || 0;
      const totalCharges = medicineCharges + shippingCharges + additionalCharges;

      // Add this bill's total to the overall total
      totalAmount += totalCharges;
      // If it's paid, add it to the amountPaid total
      if (p.isPayementDone === true) {
        amountPaid += totalCharges;
      }

      return {
        prescriptionId: p._id,
        isPaid: p.isPayementDone, // Include the payment status
        createdAt: p.createdAt,
        medicineCharges,
        shippingCharges,
        additionalCharges,
        totalCharges,
      };
    });

    // Calculate the final amount due
    const amountDue = totalAmount - amountPaid;

    // Send the final structured response
    res.status(200).json({
      allBills: detailedBills,
      summary: {
        totalAmount,
        amountPaid,
        amountDue
      },
    });
    
  } catch (error) {
    console.error("Error fetching all payments:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};
exports.getPaymentsByPatient = async (req, res) => {
  try {
    const { patientId } = req.params;

    // Validate if the provided patientId is a valid MongoDB ObjectId
    if (!mongoose.Types.ObjectId.isValid(patientId)) {
      return res.status(400).json({ success: false, message: "Invalid Patient ID format." });
    }

    // Find all appointment IDs associated with the patient
    const appointments = await Appointment.find({ patient: patientId }).select('_id');

    // If no appointments are found for the patient, they have no payments.
    if (!appointments || appointments.length === 0) {
      return res.json({
        success: true,
        message: "No payments found for this patient.",
        data: [],
      });
    }

    // Extract just the IDs from the appointment documents
    const appointmentIds = appointments.map(app => app._id);

    // Find all payments where the appointmentId is in our list of appointmentIds
    const payments = await Payment.find({ appointmentId: { $in: appointmentIds } })
      .populate({
        path: 'appointmentId',
        select: 'appointmentDate timeSlot doctor', // Select which appointment fields to return
        populate: {
          path: 'doctor',
          select: 'name specialization' // Select which doctor fields to return
        }
      })
      .sort({ createdAt: -1 }); // Sort by most recent payment first

    res.json({
      success: true,
      message: "Payments retrieved successfully.",
      count: payments.length,
      data: payments,
    });

  } catch (err) {
    console.error("Error fetching patient payments:", err);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};
// Assuming Appointment and Doctor models are imported

exports.getAllAppointmentsForPatientDashboard = async (req, res) => {
  try {
    const { patientId } = req.params;

    // Validate the patientId
    if (!mongoose.Types.ObjectId.isValid(patientId)) {
      return res.status(400).json({ message: "Invalid Patient ID format." });
    }

    // 1. Find ALL appointments for the given patientId
    const appointments = await Appointment.find({ patient: patientId })
      .sort({ appointmentDate: -1 }) // Show most recent/upcoming first
      .populate({ 
          path: 'doctor', 
          select: 'name' // From the Doctor model, select only the 'name' field
      })
      .select('doctor meetLink consultingFor timeSlot appointmentDate status'); // Select necessary fields

    if (!appointments || appointments.length === 0) {
      return res.status(200).json({
        success: true,
        message: "No appointments found for this patient.",
        appointments: [],
      });
    }

    // 2. Format the data to match the required output
    const formattedAppointments = appointments.map(appt => ({
      appointmentId: appt._id,
      doctorName: appt.doctor ? appt.doctor.name : 'Unknown Doctor',
      doctorId: appt.doctor ? appt.doctor._id : null,
      appointmentDate: appt.appointmentDate,
      timeSlot: appt.timeSlot,
      status: appt.status,
      meetLink: appt.meetLink,
      consultingFor: appt.consultingFor,
    }));

    res.status(200).json({
      success: true,
      appointments: formattedAppointments,
    });

  } catch (error) {
    console.error("Error fetching patient's appointments:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};
exports.getAppointedDocs = async (req, res) => {
  try {
    const appointments = await Appointment.find({ patient: req.query.id });
    const uniqueDoctorIds = [...new Set(appointments.map(doc => doc.doctor.toString()))];
    const docDetails = await Doctor.find({_id:{$in:uniqueDoctorIds}})
    res.json(docDetails);
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Server Error" });
  }
};

exports.getBookedAppointmentsByDate = async (req, res) => {
  try {
    const { date } = req.query; // Get date from query params, e.g., ?date=2025-08-27

    // 1. Validate the input date
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({ message: "Please provide a date in YYYY-MM-DD format." });
    }

    // 2. Define the date range for the entire requested day
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    // 3. Find all "booked" (confirmed or completed) appointments in the date range
    const bookedAppointments = await Appointment.find({
      appointmentDate: { $gte: startOfDay, $lte: endOfDay },
      status: { $in: ["confirmed", "completed"] }
    })
    .sort({ timeSlot: 1 }) // Sort appointments by time
    .populate({ 
        path: 'patient', 
        select: 'name phone' // Select the fields you want from the Patient model
    })
    .populate({
        path: 'doctor',
        select: 'name department' // Select the fields you want from the Doctor model
    });

    if (bookedAppointments.length === 0) {
        return res.status(200).json({
            success: true,
            message: "No booked appointments found for this date.",
            appointments: []
        });
    }
    
    // 4. (Optional but recommended) Format the response for clarity
    const formattedAppointments = bookedAppointments.map(appt => ({
        appointmentId: appt._id,
        timeSlot: appt.timeSlot,
        status: appt.status,
        consultingFor: appt.consultingFor,
        patient: appt.patient ? {
            id: appt.patient._id,
            name: appt.patient.name,
            phone: appt.patient.phone
        } : null, // Handle case where patient might be deleted
        doctor: appt.doctor ? {
            id: appt.doctor._id,
            name: appt.doctor.name,
            department: appt.doctor.department
        } : null // Handle case where doctor might be deleted
    }));

    res.status(200).json({
      success: true,
      appointments: formattedAppointments
    });

  } catch (error) {
    console.error("Error fetching booked appointments:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};
exports.getPatientById = async (req, res) => {
  try {
    const patientId = req.params.id;

    // 1. Find the patient
    const user = await Patient.findById(patientId);

    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    // 2. Find all appointments for that patient
    // (Note: I've removed '-_id' so we can use the ID to find payments)
    const appointments = await Appointment.find({ patient: patientId }).select(
      "diseaseName consultingFor appointmentDate timeSlot prescriptionID"
    );

    // 3. Get the IDs from the appointment documents
    const appointmentIds = appointments.map((appt) => appt._id);

    // 4. Find all payment documents linked to those appointment IDs
    let payments = [];
    if (appointmentIds.length > 0) {
      payments = await Payment.find({
        appointmentId: { $in: appointmentIds },
      });
    }

    // 5. Combine patient data, appointments, and payments into one response
    const responseData = {
      ...user.toObject(), // Keep all original patient data
      appointments: appointments, // Add the appointment details
      payments: payments, // Add the payment details
    };

    res.json(responseData);
  } catch (error) {
    console.error("Error fetching patient details:", error);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};
exports.getTotalPatients = async (req, res) => {
  try {
    // Use countDocuments with an empty filter to count all documents in the collection
    const totalPatients = await Patient.countDocuments({});

    res.status(200).json({
      success: true,
      totalPatients: totalPatients,
    });
  } catch (error) {
    console.error("Error fetching total patient count:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

exports.fetchPatientPendingPaymentsToDashboard =async (req, res) => {
  try {
    const patientId = req.user._id;

    // 1. Fetch pending items (this part is unchanged)
    const [pendingAppointments, pendingPrescriptions] = await Promise.all([
      Appointment.find({ patient: patientId, isPaid: false })
        .populate({ path: 'doctor', select: 'name' })
        .select('doctor consultingFor payment'),
      Prescription.find({ patientId: patientId, isPayementDone: false })
        .select('medicineCharges shippingCharges additionalCharges')
    ]);

    // --- START: MODIFIED LOGIC ---

    // 2. Get the COUNT of pending appointments
    const appointmentCount = pendingAppointments.length;
    
    // 3. Get the COUNT of pending medicine prescriptions
    const medicineCount = pendingPrescriptions.length;

    // 4. Calculate the total COUNT
    const totalCount = appointmentCount + medicineCount;

    // --- END: MODIFIED LOGIC ---

    // 5. Format the lists for a clean response (this part is unchanged)
    const formattedAppointments = pendingAppointments.map(appt => ({
        appointmentId: appt._id,
        doctorName: appt.doctor ? appt.doctor.name : 'N/A',
        consultingFor: appt.consultingFor,
        amount: appt.payment || 0
    }));

    const formattedPrescriptions = pendingPrescriptions.map(pres => ({
        prescriptionId: pres._id,
        amount: (pres.medicineCharges || 0) + (pres.shippingCharges || 0) + (pres.additionalCharges || 0)
    }));

    // 6. Send the final response with the new summary counts
    res.status(200).json({
      success: true,
      pendingAppointments: formattedAppointments,
      pendingPrescriptions: formattedPrescriptions,
      summary: {
        totalPendingCount: totalCount,
        pendingAppointmentCount: appointmentCount,
        pendingMedicineCount: medicineCount
      }
    });

  } catch (error) {
    console.error("Error fetching patient pending payments:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};
exports.getPatientReferrals = async (req, res) => {
  try {
    const patientId = req.user._id;

    const referrals = await Referral.find({ referrerId: patientId })
      .sort({ createdAt: -1 });

    if (!referrals || referrals.length === 0) {
      return res.status(200).json({
        success: true,
        message: "You haven't made any referrals yet.",
        referrals: [],
        summary: { total: 0, completed: 0, pending: 0, claimed: 0, expired: 0 }
      });
    }

    const formattedReferrals = referrals.map(ref => {
      let status = 'Pending';
      if (new Date() > ref.expiresAt && !ref.isUsed && !ref.firstAppointmentDone) {
        status = 'Expired';
      } else if (ref.isUsed) {
        status = 'Benefit Claimed';
      } else if (ref.firstAppointmentDone) {
        status = 'Completed';
      }

      return {
        // referralId: ref._id, // <-- THIS LINE HAS BEEN REMOVED
        referredFriendName: ref.referredFriendName || 'Friend',
        referredFriendPhone: ref.referredFriendPhone,
        status: status
      };
    });

    const summary = {
        total: formattedReferrals.length,
        completed: formattedReferrals.filter(r => r.status === 'Completed').length,
        pending: formattedReferrals.filter(r => r.status === 'Pending').length,
        claimed: formattedReferrals.filter(r => r.status === 'Benefit Claimed').length,
        expired: formattedReferrals.filter(r => r.status === 'Expired').length
    };

    res.status(200).json({
      success: true,
      referrals: formattedReferrals,
      summary: summary
    });

  } catch (error) {
    console.error("Error fetching patient referrals:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};
exports.getTotalAppointmentsCount = async (req, res) => {
  try {
    const patientId = req.user._id;

    // Count all documents where the 'patient' field matches the user's ID
    const totalCount = await Appointment.countDocuments({
      patient: patientId,
    });

    res.status(200).json({ 
        success: true, 
        totalAppointments: totalCount 
    });

  } catch (error) {
    console.error("Error fetching total appointments for patient:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};
exports.getUpcomingAppointmentsCount = async (req, res) => {
  try {
    const patientId = req.user._id;
    const now = new Date();

    // Use countDocuments to get only the total number
    const upcomingAppointmentsCount = await Appointment.countDocuments({
      patient: patientId,
      appointmentDate: { $gte: now }, // The filter logic remains the same
      status: { $in: ["reserved", "confirmed"] }
    });

    res.status(200).json({ 
        success: true, 
        count: upcomingAppointmentsCount 
    });

  } catch (error) {
    console.error("Error fetching upcoming appointments count:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};
exports.getPastAppointmentsCount = async (req, res) => {
  try {
    const patientId = req.user._id;
    const now = new Date();

    // Use countDocuments instead of find to get only the total number
    const pastAppointmentsCount = await Appointment.countDocuments({
      patient: patientId,
      // The filter logic remains the same
      $or: [
        { appointmentDate: { $lt: now } },
        { status: "completed" }
      ]
    });

    res.status(200).json({ 
        success: true, 
        count: pastAppointmentsCount 
    });

  } catch (error) {
    console.error("Error fetching past appointments count:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};
exports.getCompletedPaymentsCount = async (req, res) => {
  try {
    const patientId = req.user._id;

    // Run both database counts at the same time
    const [paidAppointmentsCount, paidPrescriptionsCount] = await Promise.all([
      Appointment.countDocuments({ patient: patientId, isPaid: true }),
      Prescription.countDocuments({ patientId: patientId, isPayementDone: true })
    ]);

    const totalPaymentsDone = paidAppointmentsCount + paidPrescriptionsCount;

    res.status(200).json({
      success: true,
      totalPaymentsDone: totalPaymentsDone,
      paidAppointmentsCount: paidAppointmentsCount,
      paidPrescriptionsCount: paidPrescriptionsCount,
    });

  } catch (error) {
    console.error("Error fetching payment count:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};
// Make sure you import this model at the top of your file
// const { AppointmentSlotTypes } = require('../models/yourSettingsModelFile');
// const Appointment = require('../models/Appointment'); //
// const mongoose = require('mongoose');

// --- NEW HELPER FUNCTIONS ---

/**
 * Converts "hh:mm A" (e.g., "01:00 PM") to total minutes from midnight.
 * "01:00 PM" -> 780
 * "10:00 AM" -> 600
 */
function parse12HourToMinutes(timeString) {
  try {
    const [time, modifier] = timeString.split(' ');
    let [hours, minutes] = time.split(':').map(Number);
    if (hours === 12) {
      hours = 0; // 12 AM (0) or 12 PM (12)
    }
    if (modifier === 'PM') {
      hours += 12;
    }
    return hours * 60 + minutes;
  } catch (e) {
    console.error("Failed to parse 12-hour time:", timeString);
    return null;
  }
}

/**
 * Converts "HH:mm" (e.g., "19:40") to total minutes from midnight.
 * "19:40" -> 1180
 * "10:00" -> 600
 */
function parse24HourToMinutes(timeString) {
  try {
    const [hours, minutes] = timeString.split(':').map(Number);
    return hours * 60 + minutes;
  } catch (e) {
    console.error("Failed to parse 24-hour time:", timeString);
    return null;
  }
}

// --- END HELPER FUNCTIONS ---


exports.rescheduleAppointment = async (req, res) => {
  try {
    const { appointmentId } = req.params;
    const { appointmentDate, timeSlot } = req.body; // 'timeSlot' is "HH:mm" (e.g., "19:40")

    // 1. Validate inputs
    if (!mongoose.Types.ObjectId.isValid(appointmentId)) {
      return res.status(400).json({ message: "Invalid Appointment ID format." });
    }
    if (!appointmentDate || !timeSlot) {
      return res.status(400).json({ message: "New appointmentDate and timeSlot are required." });
    }

    // 2. Find the existing appointment
    const appointment = await Appointment.findById(appointmentId);
    if (!appointment) {
      return res.status(404).json({ message: "Appointment not found." });
    }
    if (appointment.status !== 'confirmed') {
        return res.status(400).json({ message: "Only confirmed appointments can be rescheduled." });
    }

    // 3. --- LOGIC COMPLETELY REVISED ---

    // Get all available slot type configurations
    const allSlotTypes = await AppointmentSlotTypes.find({});
    if (!allSlotTypes || allSlotTypes.length === 0) {
        return res.status(500).json({ message: "No appointment slot types are configured in settings." });
    }

    // Convert old and new appointment times to minutes
    const oldTimeInMinutes = parse24HourToMinutes(appointment.timeSlot); // e.g., "10:00" -> 600
    const newTimeInMinutes = parse24HourToMinutes(timeSlot);             // e.g., "19:40" -> 1180

    if (newTimeInMinutes === null) {
      return res.status(400).json({ message: "Invalid timeSlot format in payload."});
    }

    // Find which slot configurations match the old and new times
    let oldSlotDetails = null;
    let newSlotDetails = null;

    for (const slot of allSlotTypes) {
      const startMinutes = parse12HourToMinutes(slot.startingTime);
      const endMinutes = parse12HourToMinutes(slot.endingTime);

      // Check if the old time falls within this slot's range
      if (oldTimeInMinutes >= startMinutes && oldTimeInMinutes < endMinutes) {
        oldSlotDetails = slot;
      }
      
      // Check if the new time falls within this slot's range
      if (newTimeInMinutes >= startMinutes && newTimeInMinutes < endMinutes) {
        newSlotDetails = slot;
      }
    }

    // Validation for slot types
    if (!oldSlotDetails) {
        // This was your original error
        return res.status(404).json({ message: "Configuration error: Original appointment slot type details not found." });
    }
    if (!newSlotDetails) {
        // This was your new error. It should be fixed now.
        // It means the time "19:40" did not fall into any defined range.
        return res.status(404).json({ message: "Configuration error: New appointment time does not fit any available slot type." });
    }

    // --- END REVISED LOGIC ---

    // 4. Calculate the price difference
    const oldPrice = oldSlotDetails.price || 0;
    const newPrice = newSlotDetails.price || 0;
    const rescheduleCharge = newPrice - oldPrice;
    
    // 5. (CRITICAL) Check if the NEW slot is available
    const startOfDay = new Date(appointmentDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(appointmentDate);
    endOfDay.setHours(23, 59, 59, 999);

    const conflictingAppointment = await Appointment.findOne({
      appointmentDate: { $gte: startOfDay, $lte: endOfDay },
      timeSlot: timeSlot, // Checks for "19:40"
      _id: { $ne: appointmentId } 
    });

    if (conflictingAppointment) {
      return res.status(409).json({ message: "This time slot is already booked. Please choose another." });
    }

    // 6. Update and save the appointment
    appointment.appointmentDate = new Date(appointmentDate);
    appointment.timeSlot = timeSlot; // Saves "19:40"
    appointment.reschedule = true;
    appointment.rescheduleCharges = rescheduleCharge; 
    
    const updatedAppointment = await appointment.save();

    res.status(200).json({
      success: true,
      message: "Appointment rescheduled successfully.",
      appointment: updatedAppointment,
    });

  } catch (error) {
    console.error("Error rescheduling appointment:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};
exports.getNotInterestedAppointmentCounts =async (req, res) => {
  try {
    const { classification } = req.body;

    // 1. Validate the input
    if (!classification || !["acute", "chronic"].includes(classification.toLowerCase())) {
      return res.status(400).json({ message: "Invalid or missing classification. Must be 'acute' or 'chronic'." });
    }

    // Convert classification to the boolean used in the Appointment schema
    const isChronic = classification.toLowerCase() === 'chronic';

    // 2. Define the aggregation pipeline
    const pipeline = [
      // Stage 1: Look up the medical details for each appointment
      {
        $lookup: {
          from: "patientdetails", // Your medical details collection name
          localField: "patient",
          foreignField: "patientId",
          as: "medicalDetails"
        }
      },
      // Deconstruct the array to access the object
      {
        $unwind: "$medicalDetails"
      },
      // Stage 2: Match based on BOTH criteria
      {
        $match: {
          "medicalDetails.enquiryStatus": "Not Interested", // First, filter by enquiryStatus
          "isChronic": isChronic // Then, filter by the provided classification
        }
      },
      // Stage 3: Run parallel counts using $facet
      {
        $facet: {
          'stageCounts': [
            { $group: { _id: "$follow", count: { $sum: 1 } } }
          ],
          'totalCount': [
            { $count: 'count' }
          ]
        }
      }
    ];

    // 3. Execute the aggregation query
    const results = await Appointment.aggregate(pipeline);
    const resultData = results[0];

    // 4. Format the response
    const allStages = [
      "Consultation",
      "Prescription",
      "Payment",
      "Medicine Preparation",
      "Shipment",
      "Patient Care"
    ];

    const countsByStage = {};
    allStages.forEach(stage => {
      countsByStage[stage] = 0;
    });

    if (resultData.stageCounts) {
      resultData.stageCounts.forEach(result => {
        if (allStages.includes(result._id)) {
          countsByStage[result._id] = result.count;
        }
      });
    }

    const totalCount = resultData.totalCount[0] ? resultData.totalCount[0].count : 0;
    
    // 5. Send the final JSON response
    res.status(200).json({
      success: true,
      filters: {
        enquiryStatus: "Not Interested",
        classification: classification
      },
      totalAppointments: totalCount,
      countsByStage: countsByStage
    });

  } catch (error) {
    console.error("Error fetching appointment counts:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};
exports.getNotInterestedPatientCountsTotal = async (req, res) => {
  try {
    const pipeline = [
      // Stage 1: Find all documents where enquiryStatus is "Not Interested"
      {
        $match: { enquiryStatus: "Not Interested" }
      },
      // Stage 2: Look up the main patient data to get their "newExisting" status
      {
        $lookup: {
          from: "patients", // Your main patients collection name
          localField: "patientId",
          foreignField: "_id",
          as: "patientInfo"
        }
      },
      // Deconstruct the array to access the patient object
      {
        $unwind: "$patientInfo"
      },
      // Stage 3: Run two parallel counting operations
      {
        $facet: {
          // Operation A: Get the total count of all matched patients
          "totalCount": [
            { $count: "count" }
          ],
          // Operation B: Group the results by the 'newExisting' status and count each
          "statusCounts": [
            { $group: { _id: "$patientInfo.newExisting", count: { $sum: 1 } } }
          ]
        }
      }
    ];

    // Execute the aggregation query
    const result = await PatientDetails.aggregate(pipeline);
    const resultData = result[0];

    // Extract and format the results
    const totalCount = resultData.totalCount[0] ? resultData.totalCount[0].count : 0;
    
    const statusCounts = resultData.statusCounts;
    const newPatients = statusCounts.find(status => status._id === "New")?.count || 0;
    const existingPatients = statusCounts.find(status => status._id === "Existing")?.count || 0;
    
    // Send the final JSON response
    res.status(200).json({
      success: true,
      filter: {
        enquiryStatus: "Not Interested"
      },
      totalNotInterested: totalCount,
      newPatientCount: newPatients,
      existingPatientCount: existingPatients,
    });

  } catch (error) {
    console.error("Error fetching patient statistics:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};
exports.getDashboardStatistics = async (req, res) => {
  try {
    // This pipeline calculates everything at once
    const pipeline = [
      {
        $facet: {
          // --- 1. All Appointments (Acute vs Chronic) ---
          "allAppointments": [
            { $group: { _id: "$classification", count: { $sum: 1 } } }
          ],

          // --- 2 & 3. New vs Existing Appointments (Acute vs Chronic) ---
          "newOrExistingAppointments": [
            // First, get the patient info for each appointment
            {
              $lookup: {
                from: "patients",
                localField: "patient",
                foreignField: "_id",
                as: "patientInfo"
              }
            },
            { $unwind: "$patientInfo" },
            // Group by both classification AND newExisting status
            {
              $group: {
                _id: {
                  classification: "$classification",
                  newExisting: "$patientInfo.newExisting"
                },
                count: { $sum: 1 }
              }
            }
          ],

          // --- 4. "Not Interested" Patients (Acute vs Chronic Appointments) ---
          "notInterestedAppointments": [
            // First, get the patient's medical details
            {
              $lookup: {
                from: "patientdetails",
                localField: "patient",
                foreignField: "patientId",
                as: "medicalDetails"
              }
            },
            { $unwind: "$medicalDetails" },
            // Match only those with the "Not Interested" status
            {
              $match: { "medicalDetails.enquiryStatus": "Not Interested" }
            },
            // Group the results by classification and count
            {
              $group: {
                _id: "$classification",
                count: { $sum: 1 }
              }
            }
          ]
        }
      }
    ];

    // Execute the aggregation query
    const result = await Appointment.aggregate(pipeline);
    const data = result[0];

    // Helper function to extract counts safely
    const getCount = (arr, key) => arr.find(item => item._id === key)?.count || 0;
    
    // Format the final response
    const formattedResponse = {
      allAppointments: {
        total: (getCount(data.allAppointments, "acute") + getCount(data.allAppointments, "chronic")),
        acute: getCount(data.allAppointments, "acute"),
        chronic: getCount(data.allAppointments, "chronic")
      },
      newAppointments: {
        total: data.newOrExistingAppointments.filter(item => item._id.newExisting === "New").reduce((sum, item) => sum + item.count, 0),
        acute: data.newOrExistingAppointments.find(item => item._id.classification === "acute" && item._id.newExisting === "New")?.count || 0,
        chronic: data.newOrExistingAppointments.find(item => item._id.classification === "chronic" && item._id.newExisting === "New")?.count || 0
      },
      existingAppointments: {
        total: data.newOrExistingAppointments.filter(item => item._id.newExisting === "Existing").reduce((sum, item) => sum + item.count, 0),
        acute: data.newOrExistingAppointments.find(item => item._id.classification === "acute" && item._id.newExisting === "Existing")?.count || 0,
        chronic: data.newOrExistingAppointments.find(item => item._id.classification === "chronic" && item._id.newExisting === "Existing")?.count || 0
      },
      notInterestedPatients: {
        total: (getCount(data.notInterestedAppointments, "acute") + getCount(data.notInterestedAppointments, "chronic")),
        acute: getCount(data.notInterestedAppointments, "acute"),
        chronic: getCount(data.notInterestedAppointments, "chronic")
      }
    };
    
    res.status(200).json({
      success: true,
      statistics: formattedResponse
    });

  } catch (error) {
    console.error("Error fetching dashboard statistics:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

exports.getAllAppointmentCountsByStagePerfect = async (req, res) => {
  try {
    const pipeline = [
      {
        $group: {
          _id: "$follow",
          count: { $sum: 1 }
        }
      },
      {
          $project: {
              _id: 0,
              stage: "$_id",
              count: "$count"
          }
      }
    ];

    const results = await Appointment.aggregate(pipeline);

    // --- NEW LOGIC ADDED HERE ---
    // Calculate the total by summing the counts from the results
    const totalAppointments = results.reduce((sum, stage) => sum + stage.count, 0);
    // ----------------------------

    const allStages = [
      "Consultation",
      "Prescription",
      "Payment",
      "Medicine Preparation",
      "Shipment",
      "Patient Care"
    ];

    const countsByStage = {};
    allStages.forEach(stage => {
      countsByStage[stage] = 0;
    });

    results.forEach(result => {
      if (allStages.includes(result.stage)) {
        countsByStage[result.stage] = result.count;
      }
    });
    
    res.status(200).json({
      success: true,
      totalAppointments: totalAppointments, // <-- Total count added here
      appointmentCounts: countsByStage
    });

  } catch (error) {
    console.error("Error fetching appointment counts:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};
exports.updatePatientAddress = async (req, res) => {
  try {
    const { id } = req.params;
    const { address } = req.body;

    if (!address) {
      return res.status(400).json({ message: 'Address field is required.' });
    }

    const patient = await Patient.findByIdAndUpdate(
      id,
      { $set: { address: address } },
      { new: true, runValidators: true } // 'new: true' returns the updated document
    );

    if (!patient) {
      return res.status(404).json({ message: 'Patient not found.' });
    }

    res.status(200).json({
      message: 'Address updated successfully.',
      address: patient.address,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error while updating address.' });
  }
};

