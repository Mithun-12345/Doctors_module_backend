const express = require("express");
const dbConnection = require("./config/dbConnection.js");
const otpRoute = require("./routes/otpRoutes.js");
const patientRoute = require("./routes/patientRoutes.js");
const doctorRoute = require("./routes/doctorRoutes.js");
const cors = require("cors");
require("dotenv").config();

dbConnection();

const app = express();

app.use(express.json());
app.use(cors());

app.use("/api/otp", otpRoute);
app.use("/api/patient", patientRoute);
app.use("/api/doctor", doctorRoute);

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server listening on ${PORT}`);
});
