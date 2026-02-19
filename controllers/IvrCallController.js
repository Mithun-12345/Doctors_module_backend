const axios = require("axios");

const Patient = require("../models/patientModel");
const CallLog = require("../models/CallLog");

exports.callPatient = async (req, res) => {
  try {
    const { patientId } = req.body;

    if (!patientId) {
      return res.status(400).json({ message: "patientId is required" });
    }

    const {
      COMPANY_ID,
      SECRET_TOKEN,
      PUBLIC_IVR_ID,
      X_API_KEY
    } = process.env;

    if (!COMPANY_ID || !SECRET_TOKEN || !PUBLIC_IVR_ID || !X_API_KEY) {
      return res.status(500).json({
        message: "OBD API credentials missing"
      });
    }

   
  

    //  Get Patient
    const patient = await Patient.findById(patientId);

    if (!patient || !patient.phoneAllowed) {
      return res.status(400).json({
        message: "Patient not available for call"
      });
    }

    const formattedNumber = patient.phone.startsWith("+")
      ? patient.phone
      : `+${patient.phone}`;

    const referenceId = `CALL_${Date.now()}`;

    // Create Call Log
    const callLog = await CallLog.create({
     
      patient: patient._id,
      patientPhone: formattedNumber,
      referenceId,
      direction: "agent_to_patient",
      status: "initiated"
    });

    console.log("Calling via OBD...");
    console.log("Patient number:", formattedNumber);

    try {
      const response = await axios.post(
        "https://obd-api.myoperator.co/obd-api-v1",
        {
          company_id: COMPANY_ID,
          secret_token: SECRET_TOKEN,
          type: "1", 
          user_id: "6984348450629128", 
          number: formattedNumber,
          public_ivr_id: PUBLIC_IVR_ID,
          reference_id: referenceId
        },
        {
          headers: {
            "x-api-key": X_API_KEY,
            "Content-Type": "application/json"
          },
          timeout: 10000
        }
      );

      callLog.status = "ringing";
      callLog.providerResponse = response.data;
      await callLog.save();

      return res.status(200).json({
        message: "Call initiated successfully via OBD",
        data: response.data
      });

    } catch (apiError) {

      const providerStatus = apiError.response?.status || 500;
      const providerData = apiError.response?.data || apiError.message;

      console.error("OBD Error:", providerStatus, providerData);

      callLog.status = "failed";
      callLog.errorMessage =
        providerData?.message || apiError.message;

      await callLog.save();

      return res.status(providerStatus).json({
        message: "Call failed via OBD",
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

exports.checkPatient = async (req, res) => {
  try {
    const callerNumber = req.body.from; 

    const patient = await Patient.findOne({ phone: callerNumber });

    if (patient) {
      return res.json({
        status: "existing"
      });
    } else {
      return res.json({
        status: "new"
      });
    }

  } catch (error) {
    res.status(500).json({ status: "error" });
  }
};
