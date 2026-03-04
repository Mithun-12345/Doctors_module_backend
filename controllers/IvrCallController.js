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
      referenceId:referenceId,
      direction: "agent_to_patient",
      call_status: "initiated"
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

      callLog.call_status = "initiated";
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

      callLog.call_status = "failed";
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
    const callerNumber = req.body.from ||
      req.body.number ||
      req.query.from ||
      req.query.number;
console.log(callerNumber,"caller")
    if (!callerNumber) {
      return res.status(400).json({
        error: "Caller number is required"
      });
    }

    const patient = await Patient.findOne({ phone: callerNumber });

    if (patient) {
      return res.json({ route: "existing" });
    } else {
      return res.json({ route: "new" });
    }

  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Server error" });
  }
};

exports.afterCallWebhook = async (req, res) => {
  try {
  console.log("========== WEBHOOK RECEIVED ==========");
    console.log("Headers:", req.headers);
    console.log("Body:", JSON.stringify(req.body, null, 2));
    console.log("======================================");
   const authHeader = req.headers["authorization"];

if (!authHeader || authHeader !== `Bearer ${process.env.API_TOKEN}`) {
  return res.status(403).json({ message: "Unauthorized webhook" });
}
    console.log("📞 MyOperator Webhook received:", req.body);

    const {
      unique_id,
      reference_id,
      call_status,
      duration,
      recording_url
    } = req.body;

    if (!reference_id) {
      return res.status(400).json({
        message: "reference_id missing in webhook"
      });
    }

 
    const call = await CallLog.findOne({ referenceId: reference_id });

    if (!call) {
      console.log("Call not found for reference:", reference_id);
      return res.status(404).json({
        message: "Call not found"
      });
    }

  
    call.call_status = call_status
    call.duration = duration || 0;
    call.recording_url = recording_url || null;
    call.unique_id = unique_id || null;

    await call.save();

    console.log("Call log updated successfully");

    return res.status(200).json({
      message: "Webhook processed successfully"
    });

  } catch (error) {
    console.error("Webhook Error:", error);

    return res.status(500).json({
      message: "Webhook server error",
      error: error.message
    });
  }
};

