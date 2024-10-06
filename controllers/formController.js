const Patient = require('../models/patientModel');

exports.createPatient = async (req, res) => {
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
      currentLocation,
      patientEntry,
      symptomNotKnown
    } = req.body;

    const newPatient = new Patient({
      consultingFor,
      name,
      age,
      phone,
      whatsappNumber,
      email,
      gender,
      diseaseName,
      diseaseType: 'Acute', // default value
      currentLocation,
      patientEntry,
      symptomNotKnown
    });

    const savedPatient = await newPatient.save();
    res.status(201).json(savedPatient);
  } catch (error) {
    console.error('Error creating patient:', error);
    res.status(500).json({ error: 'Failed to create patient' });
  }
};

// predictionController.js                                                                                                                                                                                                                                                                                                                                                                             const express = require('express');
const axios = require('axios');
// require('dotenv').config();
// const cors = require('cors');
// const app = express();


// // Enable CORS for all routes
// app.use(cors());

exports.predict = async (req, res) => {
    console.log("Endpoint reached");
  const { consultingReason, symptom } = req.body;

  try {
    const response = await axios.post('http://127.0.0.1:5000/predict', {
      consultingReason,
      symptom
    });

    res.json(response.data);
  } catch (error) {
    console.error('Error communicating with Python microservice:', error.message);
    if (error.response && error.response.data) {
      res.status(error.response.status).json(error.response.data);
    } else {
      res.status(500).json({ error: 'Internal Server Error' });
    }
  }
};