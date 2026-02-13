const axios = require("axios");
const Patient = require("../models/patientModel");
const CallLog = require("../models/CallLog");

exports.callPatient = async (req, res) => {
  try {
    const { patientId } = req.body;

    if (!patientId) {
      return res.status(400).json({ message: "patientId is required" });
    }

    const { API_TOKEN, API_KEY, AGENT_MOBILE } = process.env;
console.log("ENV VALUES:", {
  API_TOKEN: process.env.API_TOKEN,
  API_KEY: process.env.API_KEY,
  AGENT_MOBILE: process.env.AGENT_MOBILE
});

    if (!API_TOKEN || !API_KEY || !AGENT_MOBILE) {
      return res.status(500).json({
        message: "MyOperator Public API credentials missing"
      });
    }

    //  Find Patient
    const patient = await Patient.findById(patientId);

    if (!patient) {
      return res.status(404).json({ message: "Patient not found" });
    }

    if (!patient.phoneAllowed) {
      return res.status(403).json({ message: "Patient not allowed for call" });
    }

    const formattedNumber = patient.phone.startsWith("+")
      ? patient.phone
      : `+${patient.phone}`;

    const referenceId = `CALL_${Date.now()}`;

    //  Create Call Log
    const callLog = await CallLog.create({
      patient: patient._id,
      patientPhone: formattedNumber,
      referenceId,
      direction: "agent_to_patient",
      status: "initiated"
    });

    console.log("Calling from:", AGENT_MOBILE);
    console.log("Calling to:", formattedNumber);

    try {
      const response = await axios.post(
"https://api.myoperator.co/v1/clicktocall", 
       {
          from: AGENT_MOBILE,
          to: formattedNumber
        },
        {
          headers: {
            "Authorization": `Bearer ${API_TOKEN}`,
            "x-api-key": API_KEY,
            "Content-Type": "application/json"
          },
          timeout: 10000
        }
      );

      // 🔹 Update log on success
      callLog.status = "ringing";
      callLog.providerResponse = response.data;
      await callLog.save();

      patient.phoneReceived += 1;
      await patient.save();

      return res.status(200).json({
        message: "Call initiated successfully",
        data: response.data
      });

    } catch (apiError) {
      const providerStatus = apiError.response?.status || 500;
      const providerData = apiError.response?.data || apiError.message;

      console.error("MyOperator Error:", providerStatus, providerData);

      callLog.status = "failed";
      callLog.errorMessage =
        providerData?.message || apiError.message;

      await callLog.save();

      return res.status(providerStatus).json({
        message: "Call failed",
        error: providerData
      });
    }

  } catch (error) {
    console.error("Server Error:", error);

    return res.status(500).json({
      message: "Server error",
      error: error.message
    });
  }
};
