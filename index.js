const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();
const patientModel = require('./models/patientModel');
const dbConnection = require('./config/dbConnection');
const otpRoute = require('./routes/otpRoutes');
const patientRoute = require('./routes/patientRoutes');
const doctorRoute = require('./routes/doctorRoutes');

dbConnection();

const app = express();

app.use(express.json());
app.use(cors({
  origin: 'http://localhost:8081', // Change this to the origin of your frontend app
  methods: 'GET, POST, PUT, DELETE',
  allowedHeaders: 'Content-Type, Authorization',
}));
app.use('/api/otp', otpRoute);
app.use('/api/patient', patientRoute);
app.use('/api/doctor', doctorRoute);

const PORT = process.env.PORT || 8000;

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});

app.get('/test', async (req, res) => {
  try {
    const patients = await patientModel.find();  // Fetch all documents
    res.json(patients);  // Send all documents as a JSON response
  } catch (error) {
    res.status(500).json({ message: 'Server error', error });
  }
});
