const Patient = require("../models/patientModel");
const MedicalDetails = require("../models/patientDetails");
exports.createPatient = async (req, res) => {
  console.log("Endpoint reached");
  console.log(req.body);
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
      diseaseType, // This will now be an object from the frontend
      currentLocation,
      patientEntry,
      symptomNotKnown,
    } = req.body;
    const { referralCode, familyToken } = req.query; // Get the referral code from query params

    // Validate diseaseType
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
    });

    const existingPatient = await Patient.findOne({ phone });
    if (existingPatient) {
      return res.status(400).json({
        success: false,
        message: "Phone number already registered",
      });
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
    res.json({
      success: true,
      // patientId: saveBasic._id,
      message: "Patient created successfully",
    });
  } catch (error) {
    console.error("Error creating patient:", error);
    res.status(500).json({
      success: false,
      error: "Failed to create patient",
      message: error.message,
    });
  }
};

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
