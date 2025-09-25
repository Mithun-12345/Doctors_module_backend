const Prescription = require("../models/Prescription");
const Patient = require("../models/patientModel");
const Doctor = require("../models/doctorModel");
const Appointment = require("../models/appointmentModel");
const RawMaterial = require("../models/RawMaterial");
const Medicine = require("../models/Medicine");
const Notification = require("../models/notificationHub");
const { pushnotificationModel } = require("../models/pushNotificationModel");
const admin = require("../configs/firebase");


const createPrescription = async (req, res) => {
  try {
    console.log("createPrescription reached");

    const {
      appointmentID,
      patientId,
      prescriptionItems,
      followUpDays,
      medicineCharges,
      shippingCharges,
      additionalCharges,
      notes,
      medicineCourse,
      action,
      parentPrescriptionId,
      consultingType,
      consultingFor,
      specialNote,
      sendSpecialNote,
    } = req.body;

    const doctorId = req.user._id;

    if (!patientId || !prescriptionItems?.length || !medicineCourse) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields",
      });
    }

    const [patient, doctor] = await Promise.all([
      Patient.findById(patientId),
      Doctor.findById(doctorId),
    ]);

    if (!patient)
      return res
        .status(404)
        .json({ success: false, message: "Patient not found" });
    if (!doctor)
      return res
        .status(404)
        .json({ success: false, message: "Doctor not found" });

    for (const item of prescriptionItems) {
      if (item.rawMaterialDetails?.length) {
        for (const rmDetail of item.rawMaterialDetails) {
          const rawMaterial = await RawMaterial.findById(rmDetail._id);
          if (!rawMaterial) {
            return res.status(404).json({
              success: false,
              message: `Raw material ${rmDetail.name} not found`,
            });
          }
        }
      }
    }

    const prescription = new Prescription({
        patientId,
        doctorId,
        appointmentID,
        prescriptionItems: prescriptionItems.map((item) => {
          const frequencies = (item.frequencies || []).map((freq) => {
            // ... (your complex mapping logic) ...
            return { /* ... processed frequency data ... */ };
          });
          // ... (your complex legacy mapping logic) ...
          return { /* ... mapped prescription item ... */ };
        }),
        followUpDays: followUpDays || 10,
        medicineCharges: medicineCharges || 0,
        shippingCharges: shippingCharges || 0,
        additionalCharges: additionalCharges || 0,
        notes: notes || "",
        specialNote: specialNote || "",
        sendSpecialNote: sendSpecialNote || false,
        medicineCourse,
        action: action || { status: "In Progress", closeComment: "" },
        consultingType: consultingType || "",
        consultingFor: consultingFor || "",
      });

    const savedPrescription = await prescription.save();

    const patientAppointment = await Appointment.findById(appointmentID);
    if (!patientAppointment) {
      return res.status(404).json({ message: "Appointment not found" });
    }
    patientAppointment.prescriptionCreated = true;
    patientAppointment.prescriptionID = savedPrescription._id;
    await patientAppointment.save();

    if (parentPrescriptionId) {
      await Prescription.findByIdAndUpdate(parentPrescriptionId, {
        $push: { subPrescriptionID: savedPrescription._id },
      });
    }

    // --- EXISTING NOTIFICATION LOGIC ---
    const totalCharges =
      (medicineCharges || 0) +
      (shippingCharges || 0) +
      (additionalCharges || 0);

    await Notification.create({
      recipient: patientId,
      message: `Your prescription is ready. The total amount to be paid is ₹${totalCharges}. Please complete the payment to proceed.`,
      type: "PRESCRIPTION_PAYMENT_DUE",
      link: `/pay/prescription/${savedPrescription._id}`,
    });

    // --- PUSH NOTIFICATION FOR PAYMENT DUE ADDED HERE ---
    try {
        const pushInfo = await pushnotificationModel.findOne({ patientId });
        if (pushInfo && pushInfo.token) {
            await admin.messaging().send({
                notification: {
                    title: "Prescription Ready for Payment",
                    body: `Your prescription is ready. The total amount to be paid is ₹${totalCharges}. Please complete the payment to proceed.`
                },
                token: pushInfo.token
            });
            console.log(`Push notification for 'Payment Due' sent to patient: ${patientId}`);
        }
    } catch (pushError) {
        console.error(`Failed to send 'Payment Due' push notification:`, pushError);
    }
    
    // --- CONDITIONAL NOTIFICATION LOGIC ---
    if (sendSpecialNote === true && specialNote) {
      await Notification.create({
        recipient: patientId,
        message: specialNote,
        type: "PRESCRIPTION_SPECIAL_NOTE",
        link: `/view/prescription/${savedPrescription._id}`,
      });

      // --- PUSH NOTIFICATION FOR SPECIAL NOTE ADDED HERE ---
      try {
        const pushInfo = await pushnotificationModel.findOne({ patientId });
        if (pushInfo && pushInfo.token) {
            await admin.messaging().send({
                notification: {
                    title: "A Special Note from Your Doctor",
                    body: specialNote
                },
                token: pushInfo.token
            });
            console.log(`Push notification for 'Special Note' sent to patient: ${patientId}`);
        }
      } catch (pushError) {
        console.error(`Failed to send 'Special Note' push notification:`, pushError);
      }
    }

    // This final response remains UNCHANGED.
    res.status(201).json({
      success: true,
      message: "Prescription created successfully",
      data: savedPrescription,
    });

  } catch (error) {
    console.error("Error creating prescription:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// Get all prescriptions for a patient
const getPatientPrescriptions = async (req, res) => {
  try {
    const { patientId } = req.params;

    // Validate patient exists
    const patient = await Patient.findById(patientId);
    if (!patient) {
      return res.status(404).json({
        success: false,
        message: "Patient not found",
      });
    }

    // Get prescriptions with populated data
    const prescriptions = await Prescription.find({ patientId })
      .populate("doctorId", "name email")
      .populate("appointmentId", "consultingType consultingFor appointmentDate")
      .sort({ createdAt: -1 });

    // Format prescriptions for response
    const formattedPrescriptions = prescriptions.map((prescription) => ({
      _id: prescription._id,
      consultingType:
        prescription.consultingType ||
        prescription.appointmentId?.consultingType ||
        "N/A",
      consultingFor:
        prescription.consultingFor ||
        prescription.appointmentId?.consultingFor ||
        "N/A",
      medicineCourse: prescription.medicineCourse,
      action: prescription.action,
      createdAt: prescription.createdAt,
      doctorName: prescription.doctorId?.name || "Unknown",
      prescriptionType: prescription.prescriptionType,
      medicineCharges: prescription.medicineCharges,
      isPaymentDone: prescription.isPaymentDone,
      subPrescriptionCount: prescription.subPrescriptionID?.length || 0,
    }));

    res.status(200).json({
      success: true,
      data: formattedPrescriptions,
    });
  } catch (error) {
    console.error("Error fetching patient prescriptions:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// Get prescription by ID
const getPrescriptionById = async (req, res) => {
  try {
    const { prescriptionId } = req.params;

    const prescription = await Prescription.findById(prescriptionId)
      .populate("patientId", "name age phone email")
      .populate("doctorId", "name email")
      .populate("appointmentId", "consultingType consultingFor appointmentDate")
      .populate("subPrescriptionID");

    if (!prescription) {
      return res.status(404).json({
        success: false,
        message: "Prescription not found",
      });
    }

    res.status(200).json({
      success: true,
      data: prescription,
    });
  } catch (error) {
    console.error("Error fetching prescription:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// Update prescription
const updatePrescription = async (req, res) => {
  try {
    const { prescriptionId } = req.params;
    const updateData = req.body;

    // Validate prescription exists
    const prescription = await Prescription.findById(prescriptionId);
    if (!prescription) {
      return res.status(404).json({
        success: false,
        message: "Prescription not found",
      });
    }

    // Check if doctor is authorized to update this prescription
    if (prescription.doctorId.toString() !== req.user.userId) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to update this prescription",
      });
    }

    // Update prescription
    const updatedPrescription = await Prescription.findByIdAndUpdate(
      prescriptionId,
      { ...updateData, updatedAt: Date.now() },
      { new: true, runValidators: true }
    )
      .populate("patientId", "name age phone email")
      .populate("doctorId", "name email");

    res.status(200).json({
      success: true,
      message: "Prescription updated successfully",
      data: updatedPrescription,
    });
  } catch (error) {
    console.error("Error updating prescription:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// Close prescription
const closePrescription = async (req, res) => {
  try {
    const { prescriptionId } = req.params;
    const { closeComment } = req.body;

    // Validate prescription exists
    const prescription = await Prescription.findById(prescriptionId);
    if (!prescription) {
      return res.status(404).json({
        success: false,
        message: "Prescription not found",
      });
    }

    // Check if doctor is authorized
    if (prescription.doctorId.toString() !== req.user.userId) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to close this prescription",
      });
    }

    // Update prescription status
    prescription.action.status = "Close";
    prescription.action.closeComment = closeComment || "";
    prescription.updatedAt = Date.now();

    await prescription.save();

    res.status(200).json({
      success: true,
      message: "Prescription closed successfully",
      data: prescription,
    });
  } catch (error) {
    console.error("Error closing prescription:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// Get available medicines
const getMedicines = async (req, res) => {
  try {
    const medicines = await Medicine.find()
      .select("name form ingredients dosage")
      .sort({ name: 1 });
    console.log(medicines);
    res.status(200).json({
      success: true,
      data: medicines,
    });
  } catch (error) {
    console.error("Error fetching medicines:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// Get available raw materials
const getRawMaterials = async (req, res) => {
  try {
    const rawMaterials = await RawMaterial.find({})
      .select("name uom currentQuantity costPerUnit description")
      .sort({ name: 1 });

    console.log("rawMaterials:", rawMaterials);
    res.status(200).json({
      success: true,
      data: rawMaterials,
    });
  } catch (error) {
    console.error("Error fetching raw materials:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// Get doctor's prescriptions
const getDoctorPrescriptions = async (req, res) => {
  try {
    const doctorId = req.user.userId;
    const { page = 1, limit = 10, status, patientName } = req.query;

    // Build query
    let query = { doctorId };

    if (status) {
      query["action.status"] = status;
    }

    // Get prescriptions with pagination
    const prescriptions = await Prescription.find(query)
      .populate("patientId", "name age phone")
      .populate("appointmentId", "consultingType consultingFor")
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    // Filter by patient name if provided
    let filteredPrescriptions = prescriptions;
    if (patientName) {
      filteredPrescriptions = prescriptions.filter((prescription) =>
        prescription.patientId?.name
          ?.toLowerCase()
          .includes(patientName.toLowerCase())
      );
    }

    const total = await Prescription.countDocuments(query);

    res.status(200).json({
      success: true,
      data: {
        prescriptions: filteredPrescriptions,
        pagination: {
          current: page,
          pages: Math.ceil(total / limit),
          total,
        },
      },
    });
  } catch (error) {
    console.error("Error fetching doctor prescriptions:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// Get prescription statistics
const getPrescriptionStats = async (req, res) => {
  try {
    const doctorId = req.user.userId;

    const stats = await Prescription.aggregate([
      { $match: { doctorId: mongoose.Types.ObjectId(doctorId) } },
      {
        $group: {
          _id: "$action.status",
          count: { $sum: 1 },
          totalCharges: { $sum: "$medicineCharges" },
        },
      },
    ]);

    const totalPrescriptions = await Prescription.countDocuments({ doctorId });
    const recentPrescriptions = await Prescription.find({ doctorId })
      .populate("patientId", "name")
      .sort({ createdAt: -1 })
      .limit(5);

    res.status(200).json({
      success: true,
      data: {
        stats,
        totalPrescriptions,
        recentPrescriptions,
      },
    });
  } catch (error) {
    console.error("Error fetching prescription stats:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

const postMedicine = async (req, res) => {
  const { name } = req.body;
  if (!name)
    return res.status(400).json({ error: "Medicine name is required" });

  try {
    const existing = await Medicine.findOne({
      name: { $regex: new RegExp(`^${name}$`, "i") },
    });
    if (existing) {
      return res.status(409).json({ error: "Medicine name already exists" });
    }

    const newMedicine = new Medicine({ name });
    await newMedicine.save();
    res.status(201).json(newMedicine);
  } catch (error) {
    console.error("Error creating medicine:", error);
    res.status(500).json({ error: "Server error" });
  }
};

const updateCloseComment = async (req, res) => {
  const { status, closeComment } = req.body;
  const { prescriptionId } = req.params;

  console.log("updateCloseComment reached");
  console.log("Request body:", req.body);
  console.log("Request params:", req.params);

  if (!status) {
    return res
      .status(400)
      .json({ success: false, message: "Status is required" });
  }

  if (!["In Progress", "Close"].includes(status)) {
    return res
      .status(400)
      .json({ success: false, message: "Invalid status value" });
  }

  try {
    const updatedPrescription = await Prescription.findByIdAndUpdate(
      prescriptionId,
      {
        $set: {
          "action.status": status,
          "action.closeComment": closeComment || "",
          updatedAt: Date.now(),
        },
      },
      { new: true }
    );

    if (!updatedPrescription) {
      return res
        .status(404)
        .json({ success: false, message: "Prescription not found" });
    }

    res.status(200).json({ success: true, data: updatedPrescription });
  } catch (error) {
    console.error("Error updating prescription action:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

module.exports = {
  createPrescription,
  getPatientPrescriptions,
  getPrescriptionById,
  updatePrescription,
  closePrescription,
  getMedicines,
  getRawMaterials,
  getDoctorPrescriptions,
  getPrescriptionStats,
  postMedicine,
  updateCloseComment,
};
