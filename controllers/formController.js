const Patient = require("../models/patientModel");
const MedicalDetails = require("../models/patientDetails");
const bcrypt = require("bcryptjs");
const nodemailer = require("nodemailer");
const { sendTemporaryPasswordEmail } = require('../services/emailService');


// predictionController.js                                                                                                                                                                                                                                                                                                                                                                             const express = require('express');
const axios = require("axios");
// require('dotenv').config();
// const cors = require('cors');
// const app = express();

// // Enable CORS for all routes
// app.use(cors());

exports.predict = async (req, res) => {
  console.log("Endpoint reached");
  const { consultingReason, symptom } = req.body;

  try {
    const response = await axios.post("http://127.0.0.1:5000/predict", {
      consultingReason,
      symptom,
    });

    res.json(response.data);
  } catch (error) {
    console.error(
      "Error communicating with Python microservice:",
      error.message
    );
    if (error.response && error.response.data) {
      res.status(error.response.status).json(error.response.data);
    } else {
      res.status(500).json({ error: "Internal Server Error" });
    }
  }
};
exports.createPatient = async (req, res) => {
  console.log("Create patient endpoint reached");
  try {
    const {
      consultingFor,
      name,
      age,
      phone,
      whatsappNumber,
      email,
      gender,
      diseaseName,
      diseaseType,
      currentLocation,
      patientEntry,
      symptomNotKnown,
    } = req.body;

    // --- Validation ---
    if (!email || !phone || !name) {
        return res.status(400).json({ success: false, message: "Name, email, and phone are required." });
    }
    
    const existingPatient = await Patient.findOne({ $or: [{ phone }, { email }] });
    if (existingPatient) {
      return res.status(400).json({
        success: false,
        message: "A patient with this phone number or email already exists.",
      });
    }

    // --- Password Generation & Hashing ---
    const temporaryPassword = Math.random().toString(36).slice(-8); // e.g., 'kjv7s8f9'
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(temporaryPassword, salt);
    console.log(`Generated Temp Password for ${email}: ${temporaryPassword}`);

    // --- Create Patient Record ---
    const newPatient = new Patient({
      name,
      age,
      phone,
      whatsappNumber,
      email,
      gender,
      patientEntry,
      currentLocation,
      password: hashedPassword,
      requiresPasswordReset: true, // Set flag to force reset on first login
    });
    
    const savedPatient = await newPatient.save();

    // --- Create Medical Details Record (Your original logic) ---
    let processedDiseaseType = { name: "", edit: false };
    if (diseaseType && typeof diseaseType === "object") {
      processedDiseaseType = {
        name: diseaseType.name || "",
        edit: diseaseType.edit || false,
      };
    }
    
    const medicalDetails = new MedicalDetails({
      patientId: savedPatient._id,
      consultingFor,
      diseaseName,
      diseaseType: processedDiseaseType,
      symptomNotKnown,
    });

    await medicalDetails.save();

    // --- Send Welcome Email ---
    // This is called *after* all database operations succeed.
    await sendTemporaryPasswordEmail(savedPatient.email, temporaryPassword);

    // --- Success Response ---
    res.status(201).json({
      success: true,
      message: "Patient created successfully. A temporary password has been sent to their email.",
      patientId: savedPatient._id
    });

  } catch (error) {
    console.error("Error creating patient:", error);
    res.status(500).json({
      success: false,
      error: "Failed to create patient due to a server error.",
      message: error.message,
    });
  }
};








