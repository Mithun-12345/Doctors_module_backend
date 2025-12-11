const mongoose = require("mongoose");
const Doctor = require("../models/doctorModel");
const Appointment = require("../models/appointmentModel.js");
const Patient = require("../models/patientModel.js");
const patientDetails = require("../models/patientDetails"); // clinical info
const moment = require("moment-timezone");
const cloudinary = require("cloudinary").v2;
const Prescription = require("../models/Prescription.js");
const fs = require("fs");
const NotificationReminderSettings = require("../models/NotificationReminderSettings");
const MedicinePreparationSummary = require('../models/MedicinePreparationSummary');
const Payment = require("../models/Payment.js");
const ConsultationNote = require("../models/ConsultationNots.js")
const multer = require('multer');
const upload = multer({ dest: 'uploads/' });
const Message = require('../models/messageModel'); // Or whatever the path to your file is
const FollowUpSetting = require("../models/followUpSettings"); // Adjust path as needed


// ... other controller functions

/**
 * @desc    Get all payments for a specific doctor
 * @route   GET /api/payments/doctor/:doctorId
 * @access  Private
 */
exports.getPaymentsByDoctor = async (req, res) => {
  try {
    const { doctorId } = req.params;

    // Validate if the provided doctorId is a valid MongoDB ObjectId
    if (!mongoose.Types.ObjectId.isValid(doctorId)) {
      return res.status(400).json({ success: false, message: "Invalid Doctor ID format." });
    }

    // Find all appointment IDs associated with the doctor
    const appointments = await Appointment.find({ doctor: doctorId }).select('_id');

    // If no appointments are found for the doctor, they have no payments.
    if (!appointments || appointments.length === 0) {
      return res.json({
        success: true,
        message: "No payments found for this doctor.",
        data: [],
      });
    }

    // Extract just the IDs from the appointment documents
    const appointmentIds = appointments.map(app => app._id);

    // Find all payments where the appointmentId is in our list of appointmentIds
    const payments = await Payment.find({ appointmentId: { $in: appointmentIds } })
      .populate({
        path: 'appointmentId',
        select: 'appointmentDate timeSlot patient', // Select which appointment fields to return
        populate: {
          path: 'patient',
          select: 'name phone' // Select which patient fields to return for the doctor's view
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
    console.error("Error fetching doctor payments:", err);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

// ... other controller functions

/**
 * @desc    Get all payments made to any doctor
 * @route   GET /api/payments/doctors
 * @access  Private (e.g., for Admin)
 */
exports.getAllDoctorPaymentsTotal = async (req, res) => {
  try {
    // Find all payments and populate details
    const payments = await Payment.find({}) // 👈 Find all documents
      .populate({
        path: 'appointmentId',
        select: 'appointmentDate timeSlot patient doctor', // Select fields from appointment
        populate: [ // 👈 We can populate multiple fields within the appointment
          {
            path: 'patient',
            select: 'name phone' // Select fields from patient
          },
          {
            path: 'doctor',
            select: 'name specialization' // Select fields from doctor
          }
        ]
      })
      .sort({ createdAt: -1 }); // Sort by most recent payment first

    res.json({
      success: true,
      message: "All doctor-related payments retrieved successfully.",
      count: payments.length,
      data: payments,
    });

  } catch (err) {
    console.error("Error fetching all doctor payments:", err);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

exports.addDoctor = async (req, res) => {
  const { name, age, gender, photo, specialization, bio, phone, role } =
    req.body;

  try {
    // Check if the requesting doctor is an admin
    const requestingDoctor = await Doctor.findOne({ phone: req.user.phone });
    if (!requestingDoctor || requestingDoctor.role !== "admin-doctor") {
      return res
        .status(403)
        .json({ message: "Only admin doctors can add new doctors" });
    }

    // Check if a doctor with the same phone number already exists
    const checkDoctor = await Doctor.findOne({ phone });
    if (checkDoctor) {
      return res.status(400).json({ message: "Doctor already exists!" });
    }

    // Create and save the new doctor
    const newDoctor = new Doctor({
      name,
      age,
      gender,
      photo,
      specialization,
      bio,
      phone,
      role: role || "assistant-doctor", // Default to "assistant-doctor" if no role is provided
    });

    await newDoctor.save();
    res
      .status(201)
      .json({ message: `${role || "Assistant"} doctor added successfully` });
  } catch (error) {
    // Improved error handling for validation errors
    if (error.name === "ValidationError") {
      return res
        .status(400)
        .json({ message: "Validation failed", error: error.message });
    }
    res
      .status(500)
      .json({ message: "Failed to add doctor", error: error.message });
  }
};

exports.getAppointments = async (req, res) => {
  try {
    const phone = req.user.phone;
    const doctor = await Doctor.findOne({ phone });
    // console.log(doctor);
    if (!doctor) {
      return res.status(404).json({ message: "Doctor not found" });
    }

    const { dateFilter, typeFilter } = req.query;
    const doctorRole = doctor.role;

    let query = {};
    let startDate, endDate;
    const now = new Date();

    switch (dateFilter) {
      case "today":
        startDate = new Date(now.setHours(0, 0, 0, 0));
        endDate = new Date(now.setHours(23, 59, 59, 999));
        query.appointmentDate = { $gte: startDate, $lte: endDate };
        break;
      case "this week":
        startDate = new Date(now.setDate(now.getDate() - now.getDay()));
        startDate.setHours(0, 0, 0, 0);
        endDate = new Date(now.setDate(now.getDate() - now.getDay() + 6));
        endDate.setHours(23, 59, 59, 999);
        query.appointmentDate = { $gte: startDate, $lte: endDate };
        break;
      case "this month":
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        endDate = new Date(
          now.getFullYear(),
          now.getMonth() + 1,
          0,
          23,
          59,
          59,
          999
        );
        query.appointmentDate = { $gte: startDate, $lte: endDate };
        break;
      case "past":
        endDate = new Date(now.setHours(0, 0, 0, 0));
        query.appointmentDate = { $lt: endDate };
        break;
      default:
        startDate = new Date(now.setHours(0, 0, 0, 0));
        endDate = new Date(now.setHours(23, 59, 59, 999));
        query.appointmentDate = { $gte: startDate, $lte: endDate };
    }

    if (
      typeFilter === "mine" ||
      (doctorRole !== "admin-doctor" && typeFilter !== "all")
    ) {
      query.doctor = doctor._id;
    }

    const appointments = await Appointment.find(query)
      .populate({
        path: "patient",
        select: "name",
      })
      .populate({
        path: "doctor",
        select: "name",
      });

    if (appointments.length === 0) {
      return res
        .status(200)
        .json({ message: "No appointments found", appointments: [] });
    }

    const modifiedAppointments = appointments.map((appointment) => ({
      ...appointment._doc,
      canRedirect: doctorRole === "admin-doctor",
      doctorName: appointment.doctor ? appointment.doctor.name : "Unknown",
      patientName: appointment.patient ? appointment.patient.name : "Unknown",
    }));

    res.status(200).json({ appointments: modifiedAppointments });
  } catch (error) {
    res.status(500).json({
      message: "Failed to retrieve appointments",
      error: error.message,
    });
  }
};

exports.redirectAppointment = async (req, res) => {
  const { assistantDoctorId, appointmentId } = req.body;
  console.log("Assistant Doctor ID:", assistantDoctorId);
  console.log("Appointment ID:", appointmentId);

  try {
    const assistantDoctor = await Doctor.findOne({ _id: assistantDoctorId });
    const appointment = await Appointment.findById(appointmentId);

    // console.log("Assistant Doctor found:", assistantDoctor);
    // console.log("Appointment found:", appointment);

    if (!appointment) {
      return res.status(404).json({ message: "Appointment not found" });
    }
    if (!assistantDoctor) {
      return res.status(404).json({
        message: "No such doctor found or doctor is not allowed to redirect",
      });
    }

    appointment.doctor = assistantDoctorId;
    appointment.status = `redirected`;
    await appointment.save();

    res
      .status(200)
      .json({ message: "Appointment redirected successfully", appointment });
  } catch (e) {
    console.error("Error redirecting appointment:", e.message);
    res.status(500).json({
      message: "Failed to redirect appointment",
      error: e.message,
    });
  }
};

exports.getDoctorAppointments = async (req, res) => {
  try {
    // 1. Get the logged-in doctor's ID from the token
    const doctorId = req.user._id;

    // 2. Find all appointments assigned to this doctor
    const appointments = await Appointment.find({ doctor: doctorId })
      .sort({ appointmentDate: 1 }) // Show soonest appointments first
      .populate({ 
        path: 'patient', 
        select: 'name phone age gender' // Select which patient details to show
      });

    if (!appointments || appointments.length === 0) {
      return res.status(200).json({ 
        success: true, 
        message: "No appointments found.",
        appointments: [] 
      });
    }

    res.status(200).json({ success: true, appointments });

  } catch (error) {
    console.error("Error fetching doctor's appointments:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

exports.getAssistantDoctors = async (req, res) => {
  try {
    const doctors = await Doctor.find({ role: "assistant-doctor" });
    res.status(200).json({ doctors });
  } catch (e) {
    res
      .status(500)
      .json({ message: "Failed to fetch assistant doctors", error: e.message });
  }
};

exports.getUserRole = async (req, res) => {
  const token = req.headers.authorization.split(" ")[1];
  try {
    const decodedToken = jwt.verify(token, process.env.JWT_SECRET);
    const doctor = await Doctor.findById(decodedToken.id);
    if (!doctor) {
      return res.status(404).json({ message: "Doctor not found" });
    }
    res.status(200).json({ role: doctor.role });
  } catch (e) {
    res
      .status(500)
      .json({ message: "Failed to get user role", error: e.message });
  }
};

exports.doctorDetails = async (req, res) => {
  try {
    console.log("Doctor details Endpoint reached");
    const doctorPhone = req.user.phone;
    console.log("Searching for doctor with phone:", doctorPhone);

    // Find the doctor by phone number
    const doctor = await Doctor.findOne({ phone: doctorPhone });

    if (!doctor) {
      console.log("Doctor not found for phone:", doctorPhone);
      return res
        .status(404)
        .json({ success: false, message: "Doctor not found" });
    }

    console.log("Doctor found:", doctor.name);

    // Return the doctor's details
    res.json({
      success: true,
      doctor: {
        id: doctor._id,
        name: doctor.name,
        email: doctor.email,
        phone: doctor.phone,
        specialization: doctor.specialization,
        experience: doctor.experience,
        role: doctor.role,
        // Add any other relevant fields
      },
    });
  } catch (error) {
    console.error("Error in doctor/details:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

exports.getDoctorFollow = async (req, res) => {
  console.log("GetDoctorFollow reached");
  console.log("GetDoctorFollow reached");
  const phone = req.user.phone; // Use the phone from the token
  console.log("doctor Phone:", phone);
  console.log("doctor Phone:", phone);
  try {
    const doctor = await Doctor.findOne({ phone }); // Find by phone instead of ID
    if (!doctor) {
      return res.status(404).json({ message: "Doctor not found" });
    }
    res.json({ follow: doctor.follow });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

//add/modify amount for the appointment
exports.addAmount = async (req, res) => {
  const { amount } = req.body;

  try {
    // Check if the requesting doctor is an admin
    const requestingDoctor = await Doctor.findOne({ phone: req.user.phone });
    if (!requestingDoctor || requestingDoctor.role !== "admin-doctor") {
      return res
        .status(403)
        .json({ message: "Only admin doctors can add new doctors" });
    }
  } catch (e) {
    console.log(e);
  }
};

exports.getDoctorById = async (req, res) => {
  try {
    const doctor = await Doctor.findById(req.params.id);
    if (!doctor) {
      return res.status(404).json({ message: "Doctor not found" });
      return res.status(404).json({ message: "Doctor not found" });
    }
    res.json(doctor);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.getSettings = async (req, res) => {
  try {
    const doctor = await Doctor.findById(req.doctorId);
    res.json({ videoPlatform: doctor.videoPlatform || "" });
  } catch (error) {
    console.error("Error fetching settings:", error);
    res.status(500).json({ error: "Unable to fetch settings" });
  }
};

// exports.updateSettings = async (req, res) => {
//   try {
//     const { videoPlatform } = req.body;
//     const doctor = await Doctor.findByIdAndUpdate(
//       req.doctorId,
//       { videoPlatform },
//       { new: true }
//     );
//     res.json({ message: "Settings updated successfully", videoPlatform: doctor.videoPlatform });
//   } catch (error) {
//     console.error("Error updating settings:", error);
//     res.status(500).json({ error: "Failed to update settings" });
//   }
// };

exports.updateSettings = async (req, res) => {
  try {
    const { videoPlatform } = req.body;

    if (!videoPlatform) {
      return res.status(400).json({ error: "Video platform is required" });
    }

    console.log("Doctor ID from request:", req.doctorId);

    // Use req.doctorId, which was added by the middleware, to update the doctor’s settings
    const doctor = await Doctor.findByIdAndUpdate(
      req.doctorId, // Use the doctorId from the request
      req.doctorId, // Use the doctorId from the request
      { videoPlatform },
      { new: true }
    );

    if (!doctor) {
      return res.status(404).json({ error: "Doctor not found" });
    }
    console.log("Platform:", doctor.videoPlatform);
    res.json({
      message: "Settings updated successfully",
      videoPlatform: doctor.videoPlatform,
    });
    console.log("Platform:", doctor.videoPlatform);
    res.json({
      message: "Settings updated successfully",
      videoPlatform: doctor.videoPlatform,
    });
  } catch (error) {
    console.error("Error updating settings:", error);
    res.status(500).json({ error: "Failed to update settings" });
  }
};

exports.getAllAppointments = async (req, res) => {
  try {
    // Fetch all appointments and populate patient details
    const appointments = await Appointment.find()
      .populate("patient", {
        name: 1,
        age: 1,
        newExisting: 1,
        phone: 1,
        whatsappNumber: 1,
        email: 1,
        gender: 1,
        medicalRecords: 1,
        patientEntry: 1,
        currentLocation: 1,
        appointmentFixed: 1,
        appDownload: 1,
        follow: 1,
        followComment: 1,
        followUpTimestamp: 1,
        familyMembers: 1,
        createdAt: 1,
        updatedAt: 1,
      })
      .lean(); // Fetch as plain objects for easier formatting

    // Transform data into the desired format
    const formattedData = appointments.map((appointment) => {
      const patientDetails = appointment.patient || {};
      return {
        ...patientDetails,
        medicalDetails: {
          _id: appointment._id,
          patientId: appointment.patient?._id,
          consultingFor: appointment.consultingFor,
          diseaseName: appointment.diseaseName,
          diseaseType: appointment.diseaseType,
          follow: appointment.follow,
          followComment: appointment.followComment,
          followUpTimestamp: appointment.followUpTimestamp,
          medicalPayment: appointment.medicalPayment,
          callCount: appointment.callCount,
          comments: appointment.comments,
          __v: appointment.__v,
        },
      };
    });
    console.log("data:", formattedData);
    res.status(200).json(formattedData);
  } catch (error) {
    console.error("Error fetching appointments:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// API endpoint to fetch patient and appointment data
exports.getAllAppointmentsWithPatientData = async (req, res) => {
  try {
    // Fetch all unique patient IDs from the appointments
    const appointments = await Appointment.find({});
    const patientIds = [
      ...new Set(
        appointments.map((appointment) => appointment.patient.toString())
      ),
    ];

    // Fetch patient data for the corresponding IDs
    const patients = await Patient.find({ _id: { $in: patientIds } });

    // Format response as required
    const response = [];

    patients.forEach((patient) => {
      const patientAppointments = appointments.filter(
        (appointment) =>
          appointment.patient.toString() === patient._id.toString()
      );

      patientAppointments.forEach((appointment) => {
        response.push({
          _id: patient._id,
          name: patient.name,
          age: patient.age,
          newExisting: patient.newExisting,
          phone: patient.phone,
          whatsappNumber: patient.whatsappNumber,
          email: patient.email,
          gender: patient.gender,
          medicalRecords: patient.medicalRecords,
          patientEntry: patient.patientEntry,
          currentLocation: patient.currentLocation,
          appointmentFixed: patient.appointmentFixed,
          appDownload: patient.appDownload,
          follow: patient.follow,
          followComment: patient.followComment,
          followUpTimestamp: patient.followUpTimestamp,
          familyMembers: patient.familyMembers,
          createdAt: patient.createdAt,
          updatedAt: patient.updatedAt,
          medicalDetails: {
            _id: appointment._id,
            patientId: appointment.patient,
            consultingFor: appointment.consultingFor,
            appointmentDate: appointment.appointmentDate,
            timeSlot: appointment.timeSlot,
            diseaseName: appointment.diseaseName,
            classification:appointment.classification,
            diseaseType: appointment.diseaseType,
            follow: appointment.follow,
            followComment: appointment.followComment,
            followUpTimestamp: appointment.followUpTimestamp,
            medicalPayment: appointment.medicalPayment,
            callCount: appointment.callCount,
            comments: appointment.comments,
            meetLink: appointment.meetLink,
            drafts: appointment.notes,
            prescriptionCreated: appointment.prescriptionCreated,
            prescription_id: appointment.prescriptionID,
            medicinePrepared:appointment.medicinePrepared
          },
        });
      });
    });

    res.status(200).json(response);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal server error" });
  }
};

exports.submitNotes = async (req, res) => {
  console.log("Reached");
  const { appointmentID, notes } = req.body;

  try {
    const appointment = await Appointment.findById(appointmentID);
    if (!appointment) {
      return res
        .status(404)
        .json({ success: false, message: "Appointment not found" });
    }

    appointment.notes = notes;
    await appointment.save();

    res
      .status(200)
      .json({ success: true, message: "Notes submitted successfully" });
  } catch (error) {
    console.error("Error submitting notes:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

exports.fetchProfile = async (req, res) => {
  try {
    const doctorId = req.user.id; // Adjust this based on your authentication method
    console.log(doctorId);
    // const patient = await Patient.findById(doctorId);
    const doctor = await Doctor.findById(doctorId).select("-password"); // Exclude sensitive data

    if (!doctor) {
      return res.status(404).json({ message: "Doctor not found" });
    }

    res.status(200).json(doctor);
  } catch (error) {
    console.error("Error fetching profile:", error);
    res.status(500).json({ message: "Failed to fetch profile" });
  }
};

exports.updateProfile = async (req, res) => {
  try {
    const userId = req.user.id;

    // Destructure the fields from the request body
    const { name, age, phone, whatsappNumber, gender } = req.body;

    // Find and update the patient document
    const updatedDoctor = await Doctor.findByIdAndUpdate(
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

    if (!updatedDoctor) {
      return res.status(404).json({ message: "Doctor not found" });
    }

    res.status(200).json({
      message: "Profile updated successfully",
      data: updatedDoctor,
    });
  } catch (error) {
    console.error("Error updating profile:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

exports.uploadProfilePicture = async (req, res) => {
  try {
    const doctorId = req.user._id; // assuming authentication middleware sets this
    const doctor = await Doctor.findById(doctorId);

    if (!doctor) {
      return res
        .status(404)
        .json({ success: false, message: "Doctor not found" });
    }

    let profilePhotoUrl = "";

    if (req.file) {
      // 📤 Upload file to Cloudinary
      const uploadResult = await cloudinary.uploader.upload(req.file.path, {
        folder: "doctor_profiles",
        resource_type: "image",
      });

      profilePhotoUrl = uploadResult.secure_url;

      // if (req.file) {
      //   const uploadResult = await cloudinary.uploader.upload(req.file.path, {
      //     folder: "doctor_profile_photos",
      //     public_id: `${doctorId}_profile`,
      //     overwrite: true,
      //   });

      //   profilePhotoUrl = uploadResult.secure_url;

      // 🧹 Clean up local file
      fs.unlink(req.file.path, (err) => {
        if (err) console.error("Failed to delete local file:", err);
      });
    } else {
      // 🖼️ Generate avatar using initials if no file uploaded
      const initials = doctor.name
        ? doctor.name
            .split(" ")
            .map((n) => n[0])
            .join("")
            .toUpperCase()
        : "P";

      profilePhotoUrl = `https://ui-avatars.com/api/?name=${initials}&background=random&color=fff&size=128`;
    }

    // ✅ Save to doctor
    doctor.profilePhoto = profilePhotoUrl;
    await doctor.save();

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
exports.updateTrackingId = async (req, res) => {
  try {
    const { prescriptionId } = req.params;
    const { trackingId, deliveryPartner, shippedDate, arrivalDate } = req.body;
    
    if (!trackingId) {
      return res.status(400).json({ message: "Tracking ID is required." });
    }

    // --- START: NEW FILE UPLOAD LOGIC ---
    let imageUrl = null;
    if (req.file) {
        // 1. Upload the file to Cloudinary
        const result = await cloudinary.uploader.upload(req.file.path, {
            folder: "shipment_images"
        });
        imageUrl = result.secure_url;

        // 2. Clean up the temporary file from your server
        fs.unlinkSync(req.file.path);
    }
    // --- END: NEW FILE UPLOAD LOGIC ---

    // --- Update the Prescription document (Existing Logic) ---
    const prescription = await Prescription.findById(prescriptionId);
    if (!prescription) {
      return res.status(404).json({ message: "Prescription not found." });
    }
    prescription.trackingId = trackingId;
    prescription.isProductShipped = true;
    prescription.shippedDate = new Date(shippedDate); 
    await prescription.save({ validateBeforeSave: false });

    
    // --- Update the MedicinePreparationSummary (Modified Logic) ---
    const updateData = {
        "packagingUsed.0.shipmentId": trackingId,
        "packagingUsed.0.deliveryPartner": deliveryPartner,
        "packagingUsed.0.shippedDate": shippedDate,
        "packagingUsed.0.arrivalDate": arrivalDate
    };

    // Conditionally add the image URL to the update if it exists
    if (imageUrl) {
        updateData["packagingUsed.0.shipmentImageForMessenger"] = imageUrl;
    }

    await MedicinePreparationSummary.updateOne(
      { prescriptionId: prescriptionId },
      { $set: updateData }
    );
    
    res.json({ message: "Tracking ID and shipping details updated successfully." });
    
  } catch (err) {
    console.error("Error updating tracking ID:", err);
    res.status(500).json({ message: "Internal server error" });
  }
};
exports.startPrescription = async (req, res) => {
  try {
    const { prescriptionId } = req.params;
    const { startDate: startDatePayload } = req.body;

    if (!prescriptionId || !startDatePayload) {
      return res.status(400).json({ message: "Missing prescriptionId or startDate in request" });
    }

    const prescription = await Prescription.findById(prescriptionId);
    if (!prescription) {
      return res.status(404).json({ message: "Prescription not found" });
    }

    const startDate = moment.utc(startDatePayload).startOf("day");
    const duration = parseInt(prescription.medicineCourse, 10) || 0;
    const endDate = moment(startDate).add(duration - 1, "days");

    prescription.startDate = startDate.toDate();
    prescription.endDate = endDate.toDate();
    await prescription.save();

    const remindersToInsert = [];

    for (const [index, med] of (prescription.prescriptionItems || []).entries()) {
      const {
        medicineName = `Unnamed Medicine #${index}`,
        form, // ✅ Get the form here**
        dispenseQuantity,
        medicineConsumption: dosage = "",
        additionalComments: instructions = "",
        standardSchedule = [],
        frequentSchedule = [],
        parallelConsumption = null,
      } = med || {};

      // Standard Schedule
      for (const sched of standardSchedule) {
        const { day, timing = {} } = sched;
        if (!day || !timing || typeof timing !== "object") continue;

        const doseDate = moment(startDate).add(day - 1, "days").format("YYYY-MM-DD");

        const timeSlots = Object.values(timing)
          .map(slot => slot?.time)
          .filter(Boolean); 

        for (const time of timeSlots) {
          remindersToInsert.push({
            patientId: prescription.patientId,
            doctorId: prescription.doctorId,
            prescriptionId,
            medicineName,
            form, // ✅ Add the form to the reminder**
            dispenseQuantity,
            medicineConsumption: dosage,
            dosage,
            instructions,
            date: doseDate,
            doseTime: time,
            taken: false,
            notificationType: "reminder",
          });
        }
      }

      // Frequent Schedule
      for (const sched of frequentSchedule) {
        const { day, frequentFrequency } = sched;
        if (!day || !frequentFrequency) continue;

        const { doses = 0, hours = 0, minutes = 0 } = frequentFrequency;
        const baseDate = moment(startDate).add(day - 1, "days");
        const baseTime = moment(baseDate).hour(8).minute(0);

        for (let i = 0; i < doses; i++) {
          const doseTime = baseTime.clone().add(i * (hours * 60 + minutes), "minutes");
          remindersToInsert.push({
            patientId: prescription.patientId,
            doctorId: prescription.doctorId,
            prescriptionId,
            medicineName,
            form, // ✅ Add the form to the reminder**
            dispenseQuantity,
            medicineConsumption: dosage,
            dosage,
            instructions,
            date: doseTime.format("YYYY-MM-DD"),
            doseTime: doseTime.format("HH:mm"),
            taken: false,
            notificationType: "reminder",
          });
        }
      }

      // Parallel Consumption
      if (parallelConsumption) {
        const { schedule = [], startTime = "08:00", intervalHours = 0, intervalMinutes = 0, totalDoses = 0 } = parallelConsumption;

        if (schedule.length > 0) {
          for (const { day, time } of schedule) {
            const doseDate = moment(startDate).add(day - 1, "days").format("YYYY-MM-DD");
            remindersToInsert.push({
              patientId: prescription.patientId,
              doctorId: prescription.doctorId,
              prescriptionId,
              medicineName,
              form, // ✅ Add the form to the reminder**
              dispenseQuantity,
              medicineConsumption: dosage,
              dosage,
              instructions,
              date: doseDate,
              doseTime: time,
              taken: false,
              notificationType: "reminder",
            });
          }
        } else if (totalDoses > 0) {
          const [sh, sm] = startTime.split(":").map(Number);
          const baseTime = moment(startDate).hour(sh || 8).minute(sm || 0);

          for (let i = 0; i < totalDoses; i++) {
            const doseTime = baseTime.clone().add(i * (intervalHours * 60 + intervalMinutes), "minutes");
            remindersToInsert.push({
              patientId: prescription.patientId,
              doctorId: prescription.doctorId,
              prescriptionId,
              medicineName,
              form, // ✅ Add the form to the reminder**
              dispenseQuantity,
              medicineConsumption: dosage,
              dosage,
              instructions,
              date: doseTime.format("YYYY-MM-DD"),
              doseTime: doseTime.format("HH:mm"),
              taken: false,
              notificationType: "reminder",
            });
          }
        }
      }
    }

    if (remindersToInsert.length > 0) {
      try {
        await NotificationReminderSettings.insertMany(remindersToInsert, { ordered: false });
      } catch (insertErr) {
        console.error("Reminder Insert Error:", insertErr.message);
      }
    }
// --- NEW: LOGIC TO SCHEDULE FOLLOW-UP CALLS ---
    try {
        // Only schedule calls if the course is long enough
        if (duration >= 3) {
            const patientId = prescription.patientId;
            
            // Calculate three equally spaced days for the calls (e.g., at 25%, 50%, 75% of the course)
            const callDays = new Set([
                Math.round(duration * 0.25),
                Math.round(duration * 0.50),
                Math.round(duration * 0.75)
            ]);

            // Ensure we don't schedule a call on day 0
            callDays.delete(0);

            const followUpCallObjects = [];
            for (const day of callDays) {
                // Calculate the actual date for the call
                const callDate = moment(startDate).add(day, "days").toDate();
                followUpCallObjects.push({
                    date: callDate,
                    callMade: false // Default to false
                });
            }

            if (followUpCallObjects.length > 0) {
                // Push the new call schedule objects into the patient's record
                await Patient.findByIdAndUpdate(patientId, {
                    $push: {
                        followUpCallsMade: { $each: followUpCallObjects }
                    }
                });
                console.log(`Scheduled ${followUpCallObjects.length} follow-up calls for patient ${patientId}`);
            }
        }
    } catch (callScheduleError) {
        console.error("Error scheduling follow-up calls:", callScheduleError);
        // This error will be logged but won't stop the main function from succeeding
    }
    // --- END OF NEW LOGIC ---

    res.status(200).json({
      message: "Prescription started. Reminders created where possible."
    });
  } catch (error) {
    console.error("Unhandled Error in startPrescription:", error.message);
    res.status(500).json({
      message: "Something went wrong while starting the prescription",
      error: error.message,
    });
  }
};

/**
 * @desc    Update the status of a specific follow-up call for a patient.
 * @route   PATCH /api/patients/:patientId/follow-up-status
 * @access  Private (Admin/Doctor)
 * @body    { "date": "YYYY-MM-DD", "callMade": true | false }
 */
exports.updateFollowUpCallStatus = async (req, res) => {
    try {
        const { patientId } = req.params;
        const { date, callMade } = req.body;

        // 1. Validate all inputs
        if (!mongoose.Types.ObjectId.isValid(patientId)) {
            return res.status(400).json({ message: "Invalid Patient ID format." });
        }
        if (!date || typeof callMade !== 'boolean') {
            return res.status(400).json({ message: "A 'date' (YYYY-MM-DD) and a 'callMade' boolean are required." });
        }

        // 2. Find the patient
        const patient = await Patient.findById(patientId);
        if (!patient) {
            return res.status(404).json({ message: "Patient not found." });
        }

        // 3. Find the specific call record in the array
        let callRecordFound = false;
        const targetDate = new Date(date);
        targetDate.setUTCHours(0, 0, 0, 0);

        patient.followUpCallsMade.forEach(call => {
            const callDate = new Date(call.date);
            callDate.setUTCHours(0, 0, 0, 0);
            if (callDate.getTime() === targetDate.getTime()) {
                call.callMade = callMade;
                callRecordFound = true;
            }
        });

        // 4. Check if a record for that date was found
        if (!callRecordFound) {
            return res.status(404).json({ message: `No follow-up call scheduled for this patient on ${date}.` });
        }

        // 5. Save the updated patient document
        const updatedPatient = await patient.save();

        res.status(200).json({
            success: true,
            message: `Follow-up call status for ${date} updated successfully.`,
            data: updatedPatient,
        });

    } catch (error) {
        console.error("Error updating follow-up call status:", error);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
};
/**
 * @desc    Get a list of all patients with scheduled follow-up calls.
 * @route   GET /api/patients/follow-up-calls
 * @access  Private (Admin/Doctor)
 */
exports.getFollowUpCallList = async (req, res) => {
    try {
        // Find patients where the 'followUpCallsMade' array exists and is not empty.
        // We also select only the fields we need for a clean response.
        const patientsWithCalls = await Patient.find(
            { "followUpCallsMade.0": { $exists: true } }, // Efficiently finds non-empty arrays
            { name: 1, followUpCallsMade: 1 } // Selects only name and the calls array
        ).sort({ name: 1 });

        res.status(200).json({
            success: true,
            count: patientsWithCalls.length,
            data: patientsWithCalls,
        });

    } catch (error) {
        console.error("Error fetching follow-up call list:", error);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
};
exports.getDeliveryStatusByPatient = async (req, res) => {
  try {
    const { patientId } = req.params;
    const objectId = new mongoose.Types.ObjectId(patientId);

    const prescriptions = await Prescription.find({
      patientId: objectId,
    }).select("trackingId isProductReceived shippedDate prescriptionItems");

    if (!prescriptions.length) {
      return res
        .status(404)
        .json({ message: "No prescriptions found for this patient." });
    }

    // ✅ 1. Use Promise.all to handle the async call inside the map
    const simplified = await Promise.all(
      prescriptions.map(async (prescription) => {
        // ✅ 2. Fetch the corresponding packaging details
        const summary = await MedicinePreparationSummary.findOne(
            { prescriptionId: prescription._id }
        ).select("packagingUsed");

        // Prepare the object with all the required data
        return {
          id: prescription._id,
          trackingId: prescription.trackingId,
          shippedDate: prescription.shippedDate || null,
          isProductReceived: prescription.isProductReceived,
          items: prescription.prescriptionItems.map((item) => ({
            name: item.medicineName,
            qty: item.dispenseQuantity,
            uom: item.uom,
          })),
          // ✅ 3. Add the packaging details to the response
          packagingDetails: summary?.packagingUsed || [],
        };
      })
    );

    res.json(simplified);
  } catch (error) {
    console.error("Error fetching delivery status:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};
//To check he is appointed with consultation or not
exports.getDoctorByFollow = async (req, res) => {
  try {
    const doctorId = req.user.id; // You should extract from token
    const doctor = await Doctor.findById(doctorId).select("role follow");

    if (!doctor) {
      return res.status(404).json({ message: "Doctor not found" });
    }

    res.status(200).json(doctor); } catch(err){
    console.error("Error fetching doctor details:", err);
    res.status(500).json({ message: "Server Error" })}};

exports.getDoctorPatientMedicationSummary = async (req, res) => {
  try {
    const { doctorId } = req.params;
    const { date } = req.query;

    if (!doctorId || !date) {
      return res.status(400).json({ message: "Doctor ID and date are required" });
    }

    const selectedDateUTC = new Date(date);
    selectedDateUTC.setUTCHours(0, 0, 0, 0);

    const nextDateUTC = new Date(selectedDateUTC);
    nextDateUTC.setUTCDate(selectedDateUTC.getUTCDate() + 1);

    const reminders = await NotificationReminderSettings.find({
      doctorId,
      date: {
        $gte: selectedDateUTC,
        $lt: nextDateUTC
      }
    }).lean();

    if (!reminders.length) {
      return res.status(404).json({ message: "No reminders found for this doctor on selected date" });
    }

    const patientIds = [...new Set(reminders.map(r => r.patientId.toString()))];

    const patients = await Patient.find({ _id: { $in: patientIds } }).lean();
    const patientDetailsDocs = await patientDetails.find({ patientId: { $in: patientIds } }).lean();

    const patientMap = Object.fromEntries(patients.map(p => [p._id.toString(), p]));
    const patientMetaMap = Object.fromEntries(patientDetailsDocs.map(p => [p.patientId.toString(), p]));

    const response = [];

    for (const pid of patientIds) {
      const patientReminders = reminders.filter(r => r.patientId.toString() === pid);

      const demo = patientMap[pid];
      const meta = patientMetaMap[pid];

      const taken = [], missed = [], pending = [], viewMedications = [];

      for (const reminder of patientReminders) {
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

      response.push({
        patientId: pid,
        name: demo?.name || "",
        age: demo?.age || "",
        gender: demo?.gender || "",
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
      });
    }

    return res.status(200).json(response);
  } catch (error) {
    console.error("Error in getDoctorPatientMedicationSummary:", error);
    return res.status(500).json({ message: "Server error", error });
  }
};
/**
 * @desc    Mark an appointment as a 'no-show'.
 * @route   PATCH /api/appointments/:appointmentId/no-show
 * @access  Private
 */
exports.markAppointmentAsNoShow = async (req, res) => {
    try {
        const { appointmentId } = req.params;
        const { noShow } = req.body;

        // 1. Validate inputs
        if (!mongoose.Types.ObjectId.isValid(appointmentId)) {
            return res.status(400).json({ message: "Invalid Appointment ID format." });
        }
        if (typeof noShow !== 'boolean') {
            return res.status(400).json({ message: "A 'noShow' boolean value is required in the body." });
        }

        let updatedAppointment;
        let message;

        if (noShow === true) {
            // --- SCENARIO 1: APPOINTMENT WAS MISSED ---
            // Just update noShow to true, as requested.
            updatedAppointment = await Appointment.findByIdAndUpdate(
                appointmentId,
                { noShow: true, status: 'completed' }, // Also marking status as completed
                { new: true }
            );
            message = "Appointment successfully marked as no-show.";

        } else {
            // --- SCENARIO 2: APPOINTMENT WAS COMPLETED SUCCESSFULLY ---
            
            // 1. Update the appointment's follow status
            updatedAppointment = await Appointment.findByIdAndUpdate(
                appointmentId,
                { 
                    follow: "Prescription",
                    status: "completed",
                    noShow: false // Explicitly set noShow to false
                },
                { new: true }
            );

            if (updatedAppointment) {
                // 2. Update the patient's follow and stage status
                await Patient.findByIdAndUpdate(updatedAppointment.patient, {
                    follow: "Prescription",
                    stage: "Prescription"
                });
            }
            message = "Appointment successfully completed and patient moved to Prescription stage.";
        }

        // Check if the appointment was found
        if (!updatedAppointment) {
            return res.status(404).json({ message: "Appointment not found." });
        }

        // Send the final response
        res.status(200).json({
            success: true,
            message: message,
            appointment: updatedAppointment,
        });

    } catch (error) {
        console.error("Error concluding appointment:", error);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
};

/**
 * @desc    Get a detailed all-time attendance report for all doctors.
 * @route   GET /api/doctors/attendance-report
 * @access  Private (Admin)
 */
exports.getDoctorAttendanceReport = async (req, res) => {
    try {
        // REMOVED: No longer need startDate or endDate from req.query

        // 2. Build the aggregation pipeline
        const pipeline = [
            // Stage 1: Deconstruct the attendanceRecords array
            {
                $unwind: "$attendanceRecords"
            },
            
            // REMOVED: The $match stage for date filtering is now gone.

            // Stage 2: Group back by doctor to calculate counts for each one
            {
                $group: {
                    _id: "$_id", // Group by the doctor's ID
                    name: { $first: "$name" },
                    employeeID: { $first: "$employeeID" },
                    department: { $first: "$department" },
                    role: { $first: "$role" },
                    // Sum up the counts for each status
                    presentCount: {
                        $sum: { $cond: [{ $eq: ["$attendanceRecords.status", "Present"] }, 1, 0] }
                    },
                    absentCount: {
                        $sum: { $cond: [{ $eq: ["$attendanceRecords.status", "Absent"] }, 1, 0] }
                    },
                    lateCount: {
                        $sum: { $cond: [{ $eq: ["$attendanceRecords.status", "Late"] }, 1, 0] }
                    }
                }
            },
            // Stage 3: Format the final output
            {
                $project: {
                    _id: 0,
                    doctorId: "$_id",
                    doctorName: "$name",
                    employeeID: 1,
                    department: 1,
                    role: 1,
                    presentCount: 1,
                    absentCount: 1,
                    lateCount: 1
                }
            },
            // Stage 4: (Optional) Sort the results by name
            {
                $sort: { doctorName: 1 }
            }
        ];

        // 3. Execute the aggregation and send the response
        const report = await Doctor.aggregate(pipeline);

        res.status(200).json({
            success: true,
            count: report.length,
            data: report,
        });

    } catch (error) {
        console.error("Error fetching doctor attendance report:", error);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
};
/**
 * @desc    Update the shipment lost status of a prescription.
 * @route   PATCH /api/prescriptions/:prescriptionId/mark-lost
 * @access  Private (Admin/Logistics)
 * @body    { "shipmentLost": true | false }
 */
exports.markShipmentAsLost = async (req, res) => {
    try {
        const { prescriptionId } = req.params;
        const { shipmentLost } = req.body;

        // 1. Validate inputs
        if (!mongoose.Types.ObjectId.isValid(prescriptionId)) {
            return res.status(400).json({ message: "Invalid Prescription ID format." });
        }
        if (typeof shipmentLost !== 'boolean') {
            return res.status(400).json({ message: "A 'shipmentLost' boolean value is required in the body." });
        }

        let updatedPrescription;
        let message;

        if (shipmentLost === true) {
            // --- SCENARIO 1: Shipment is marked as LOST ---
            // Reset the process back to preparation stage
            
            // 1. Update the prescription
            updatedPrescription = await Prescription.findByIdAndUpdate(
                prescriptionId,
                { 
                    shipmentLost: true,
                    isProductShipped: false, // Reset shipped status
                    updatedAt: new Date()
                },
                { new: true }
            );

            if (updatedPrescription) {
                // 2. Update the associated appointment
                await Appointment.findByIdAndUpdate(
                    updatedPrescription.appointmentID,
                    {
                        follow: "Medicine Preparation",
                        medicinePrepared: false // Reset prepared status
                    }
                );
            }
            message = "Shipment marked as lost. Process has been reset to 'Medicine Preparation'.";

        } else {
            // --- SCENARIO 2: Reverting a "lost" status back to NOT LOST ---
            updatedPrescription = await Prescription.findByIdAndUpdate(
                prescriptionId,
                { 
                    shipmentLost: false,
                    updatedAt: new Date()
                },
                { new: true }
            );
            message = "Shipment status has been reverted to not lost.";
        }

        // 3. Check if the prescription was found
        if (!updatedPrescription) {
            return res.status(404).json({ message: "Prescription not found." });
        }

        // 4. Send a successful response
        res.status(200).json({
            success: true,
            message: message,
            data: updatedPrescription,
        });

    } catch (error) {
        console.error("Error updating shipment lost status:", error);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
};/**
 * @desc    Allow phone calls for a specific patient.
 * @route   PATCH /api/patients/:patientId/allow-calls
 * @access  Private
 */
exports.allowPhoneCalls = async (req, res) => {
    try {
        const { patientId } = req.params;

        // 1. Validate the patient ID format
        if (!mongoose.Types.ObjectId.isValid(patientId)) {
            return res.status(400).json({ message: "Invalid Patient ID format." });
        }

        // 2. Find the patient and update the 'phoneAllowed' field
        const updatedPatient = await Patient.findByIdAndUpdate(
            patientId,
            { phoneAllowed: true },
            { new: true } // This option returns the updated document
        );

        // 3. Check if the patient was found
        if (!updatedPatient) {
            return res.status(404).json({ message: "Patient not found." });
        }

        // 4. Send a successful response
        res.status(200).json({
            success: true,
            message: "Phone calls are now allowed for this patient.",
            data: updatedPatient,
        });

    } catch (error) {
        console.error("Error allowing phone calls:", error);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
};
/**
 * @desc    Increment the phone calls received count for a patient by 1.
 * @route   PATCH /api/patients/:patientId/increment-call
 * @access  Private
 */
exports.incrementCallCount = async (req, res) => {
    try {
        const { patientId } = req.params;

        // 1. Validate the patient ID format
        if (!mongoose.Types.ObjectId.isValid(patientId)) {
            return res.status(400).json({ message: "Invalid Patient ID format." });
        }

        // 2. Find the patient and increment the 'phoneReceived' field
        const updatedPatient = await Patient.findByIdAndUpdate(
            patientId,
            { $inc: { phoneReceived: 1 } }, // Use the $inc operator to increment
            { new: true } // Return the updated document
        );

        // 3. Check if the patient was found
        if (!updatedPatient) {
            return res.status(404).json({ message: "Patient not found." });
        }

        // 4. Send a successful response
        res.status(200).json({
            success: true,
            message: "Patient call count incremented successfully.",
            data: updatedPatient,
        });

    } catch (error) {
        console.error("Error incrementing call count:", error);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
};
/**
 * @desc    Mark or update a doctor's attendance for a specific day.
 * @route   POST /api/doctors/:doctorId/attendance
 * @access  Private (Admin)
 * @body    { "status": "Present" | "Absent" | "Late", "date": "YYYY-MM-DD", "notes": "Optional comment" }
 */
exports.markDoctorAttendance = async (req, res) => {
    try {
        const { doctorId } = req.params;
        const { status, date, notes } = req.body;

        // 1. Validate inputs
        if (!mongoose.Types.ObjectId.isValid(doctorId)) {
            return res.status(400).json({ message: "Invalid Doctor ID format." });
        }
        if (!status || !['Present', 'Absent', 'Late'].includes(status)) {
            return res.status(400).json({ message: "A valid status ('Present', 'Absent', 'Late') is required." });
        }

        // 2. Find the doctor
        const doctor = await Doctor.findById(doctorId);
        if (!doctor) {
            return res.status(404).json({ message: "Doctor not found." });
        }

        // 3. Prepare the date for the record (use provided date or today's date)
        const recordDate = date ? new Date(date) : new Date();
        recordDate.setUTCHours(0, 0, 0, 0); // Normalize to the start of the day

        // 4. Check if a record for this date already exists
        const existingRecordIndex = doctor.attendanceRecords.findIndex(record => {
            const existingDate = new Date(record.date);
            existingDate.setUTCHours(0, 0, 0, 0);
            return existingDate.getTime() === recordDate.getTime();
        });

        if (existingRecordIndex > -1) {
            // If record exists, update it
            doctor.attendanceRecords[existingRecordIndex].status = status;
            doctor.attendanceRecords[existingRecordIndex].notes = notes || doctor.attendanceRecords[existingRecordIndex].notes;
        } else {
            // If no record exists, add a new one
            doctor.attendanceRecords.push({
                date: recordDate,
                status: status,
                notes: notes
            });
        }

        const updatedDoctor = await doctor.save();

        res.status(200).json({
            success: true,
            message: `Attendance for ${doctor.name} on ${recordDate.toISOString().split('T')[0]} marked as ${status}.`,
            data: updatedDoctor
        });

    } catch (error) {
        console.error("Error marking doctor attendance:", error);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
};
exports.getTodaysAppointments = async (req, res) => {
  try {
    // 1. Get doctorId from logged-in user and date from query
    const doctorId = req.user._id; // Assumes doctor's ID is from the auth token
    const { date } = req.query; // e.g., ?date=2025-09-01

    // 2. Validate the input date
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res
        .status(400)
        .json({ message: "Please provide a date in YYYY-MM-DD format." });
    }

    // 3. Define the date range for the entire requested day
    const startOfDay = new Date(date);
    startOfDay.setUTCHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setUTCHours(23, 59, 59, 999);

    // 4. Find all confirmed or completed appointments for that doctor on that day
    const appointments = await Appointment.find({
      doctor: doctorId,
      appointmentDate: { $gte: startOfDay, $lte: endOfDay },
      status: { $in: ["confirmed", "completed"] }, // Get booked appointments
    })
      .sort({ timeSlot: 1 }) // Sort by time
      .populate({
        path: "patient",
        select: "name phone", // Select name and phone from Patient model
      })

    // 5. Format the response to match your example
    const formattedAppointments = appointments.map((appt) => ({
      appointmentId: appt._id,
      timeSlot: appt.timeSlot,
      status: appt.status,
      diseaseName:appt.diseaseName,
      consultingFor:appt.consultingFor,
      patient: appt.patient
        ? {
            id: appt.patient._id,
            name: appt.patient.name,
            phone: appt.patient.phone,
          }
        : null, // Handle case where patient might be deleted
    }));

    res.status(200).json({
      success: true,
      appointments: formattedAppointments,
    });
  } catch (error) {
    console.error("Error fetching doctor appointments by date:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};
exports.getAppointmentWithTimedata = async (req, res) => {
  try {
    const patientId = new mongoose.Types.ObjectId(req.query.id);
    const type = req.query.type; // "past" or "future"

    const allAppointments = await Appointment.find({ patient: patientId });

    if (allAppointments.length === 0) {
      return res.json({ message: "The appointments are not found" });
    }

    const now = new Date();

    const filteredAppointments = allAppointments.filter(app => {
      const date = new Date(app.appointmentDate);
      const [hour, minute] = app.timeSlot.split(":").map(Number);
      date.setHours(hour, minute, 0, 0);
      return type === "past" ? date < now : date >= now;
    });

    res.json(filteredAppointments);

  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Internal server error" });
  }
};

exports.getAppointedPatients = async (req,res)=>{
  try {
    const appointments = await Appointment.find({doctor:req.query.id});
    const appointedPatients = [...new Set(appointments.map(patient => patient.patient.toString()))];
    const patientDetails = await Patient.find({_id:{$in:appointedPatients}})
    res.json(patientDetails)
  } catch (error) {
    console.log(error)
  }
}

exports.consultationNotes = async (req, res) => {
  try {
    console.log('Received consultation note data:', req.body); // Debug log
    
    // Validate required fields
    const { patientId, userId, note } = req.body;
    
    if (!patientId || !userId || !note) {
      return res.status(400).json({ 
        success: false,
        message: 'Missing required fields: patientId, userId, and note are required',
        received: req.body
      });
    }

    // Create new consultation note
    const consultationNote = new ConsultationNote({
      patientId,
      userId,
      note,
      date: req.body.date || new Date()
    });

    console.log('Saving consultation note:', consultationNote); // Debug log
    
    const savedNote = await consultationNote.save();
    
    console.log('Successfully saved note:', savedNote); // Debug log
    
    res.status(201).json({
      success: true,
      message: 'Consultation note saved successfully',
      data: savedNote
    });
    
  } catch (error) {
    console.error('Error saving consultation note:', error); // Detailed error log
    
    // Handle different types of errors
    if (error.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        message: 'Validation Error',
        errors: Object.values(error.errors).map(err => err.message)
      });
    }
    
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'Duplicate entry error',
        error: error.message
      });
    }
    
    res.status(500).json({ 
      success: false,
      message: 'Internal Server Error',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
    });
  }
};

exports.secondFormDetails = async (req,res) =>{
  try {
    const response = await chronicModel.find({userId:req.query.id})
    res.json(response);
  } catch (error) {
    console.log(error);
  }
}
exports.getTotalAppointments = async (req, res) => {
  try {
    // Count all documents in the Appointment collection with no filter
    const totalAppointments = await Appointment.countDocuments({});

    res.status(200).json({
      success: true,
      totalAppointments: totalAppointments,
    });
  } catch (error) {
    console.error("Error fetching total appointment count:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};
exports.chatPatientWithDoctorAndIsReadCount = async (req, res) => {
    const doctorId = req.user._id.toString();

    try {
        // Step 1: Find all messages where the doctor is the receiver
        const result = await Message.find({ receiver: doctorId });

        // Step 2: Collect all patient (sender) IDs
        const patientIds = result.map(app => app.sender);

        // Step 3: Fetch the FULL PATIENT PROFILE for each of those patients
        const patientFullDetails = await Promise.all(
            patientIds.map(async (id) => {
                // ✅ CHANGE 1: Query the 'Patient' model instead of 'PatientDetails'
                // We find the patient by their main unique _id.
                return await Patient.findOne({ _id: id }).select("-password");
            })
        );

        // Step 4: Filter out any null results and create a unique list of patients by phone
        const uniqueData = Array.from(
            new Map(
                patientFullDetails
                    .filter(item => item !== null)
                    .map(item => [item.phone, item])
            ).values()
        );

        // Step 5: For each unique patient, count their unread messages
        const unreadCounts = uniqueData.map(patient => {
            const count = result.filter(
                // ✅ CHANGE 2: Match the sender with the patient's '_id'
                // The Patient model uses '_id', not 'patientId'.
                msg => msg.sender === patient._id.toString() && msg.isRead === false
            ).length;

            return {
                patientId: patient._id,
                isReadFalseCount: count
            };
        });
        
        if (uniqueData.length === 0) {
            return res.status(200).json({ 
                success: true, 
                message: "No patient chat history found.",
                uniqueData: [],
                unreadCounts: []
            });
        }

        // Return the successful response with the full patient profiles
        return res.status(200).json({
            success: true,
            message: "Successfully fetched patientIds and unread counts",
            uniqueData,
            unreadCounts
        });

    } catch (error) {
        console.error("Error in chatPatientWithDoctorAndIsReadCount: ", error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};
exports.addFollowUpCall = async (req, res) => {
  try {
    const { 
      appointmentId, 
      callDate, 
      status, 
      remarks 
    } = req.body;

    if (!appointmentId || !callDate) {
      return res.status(400).json({ 
        success: false, 
        message: "Appointment ID and Call Date are required" 
      });
    }

    const appointment = await Appointment.findById(appointmentId);

    if (!appointment) {
      return res.status(404).json({ success: false, message: "Appointment not found" });
    }

    // 1. Create the new call object
    const newCall = {
      callDate: new Date(callDate),
      status: status || "Pending", // Default to Pending if not sent
      remarks: remarks || ""
    };

    // 2. Push it into the array
    appointment.followUpCalls.push(newCall);

    // 3. (Optional but Recommended) Update the main timestamp 
    // This ensures your main dashboard shows this new date as the active follow-up
    appointment.followUpTimestamp = newCall.callDate;

    // 4. Save
    await appointment.save();

    res.status(200).json({
      success: true,
      message: "New follow-up call added successfully",
      data: newCall
    });

  } catch (error) {
    console.error("Error adding follow-up call:", error);
    res.status(500).json({ 
      success: false, 
      message: "Internal server error", 
      error: error.message 
    });
  }
};
exports.incrementCallCountByOne = async (req, res) => {
  try {
    const { appointmentId } = req.body;

    if (!appointmentId) {
      return res.status(400).json({ 
        success: false, 
        message: "Appointment ID is required" 
      });
    }

    const updatedAppointment = await Appointment.findByIdAndUpdate(
      appointmentId,
      { 
        $inc: { callCount: 1 },        // Increment count by 1
        $set: { lastCallMade: new Date() } // Set timestamp to NOW
      }, 
      { new: true } // Returns the updated document
    );

    if (!updatedAppointment) {
      return res.status(404).json({ success: false, message: "Appointment not found" });
    }

    res.status(200).json({
      success: true,
      message: "Call count and timestamp updated",
      data: {
        _id: updatedAppointment._id,
        callCount: updatedAppointment.callCount,
        lastCallMade: updatedAppointment.lastCallMade // Return this so UI updates instantly
      }
    });

  } catch (error) {
    console.error("Error updating call count:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

exports.getPrescriptionsByAppointmentForNewDash = async (req, res) => {
  try {
    const { appointmentId } = req.params;

    // Helper: Returns val if exists, else "-"
    const check = (val) => (val && val !== "" && val !== null && val !== undefined) ? val : "-";

    // 1. Fetch Appointment Details
    const appointment = await Appointment.findById(appointmentId).lean();

    if (!appointment) {
      return res.status(404).json({ message: "Appointment not found" });
    }

    // 2. Build Robust Query (checking all possible link locations)
    const queryConditions = [
      { appointment: appointmentId },     // Standard link
      { appointmentID: appointmentId }    // Alternative link
    ];

    // If Appointment has a legacy ID stored, check that too
    if (appointment.prescriptionID) {
      queryConditions.push({ _id: appointment.prescriptionID });
    }

    // 3. Fetch Prescriptions
    const prescriptions = await Prescription.find({
      $or: queryConditions
    }).lean();

    // 4. Initialize Status Counts (Strictly these 3)
    const statusCounts = {
      "Active": 0,
      "Hold": 0,
      "Closed": 0
    };

    // 5. Process Prescriptions
    const processedPrescriptions = prescriptions.map(presc => {
      
      // A. Extract Medicine Names
      const medicineNames = (presc.prescriptionItems && presc.prescriptionItems.length > 0)
        ? presc.prescriptionItems.map(item => item.medicineName).join(", ")
        : "-";

      // B. Determine Status (Schema Field: prescriptionStatus)
      // Default to "Active" if missing (as per your Schema default), or "-" if you prefer.
      // We prioritize the explicit schema field.
      const pStatus = presc.prescriptionStatus || "Active"; 

      // C. Update Status Count
      // Only increment if it matches one of our valid keys to keep the object clean
      if (statusCounts.hasOwnProperty(pStatus)) {
        statusCounts[pStatus]++;
      } 
      // Optional: If you have dirty data (e.g. "In Progress"), you might want to map it to "Active" here.

      // D. Safe Access for Nested Appointment Fields
      const apptDiseaseType = (appointment.diseaseType && appointment.diseaseType.name) 
        ? appointment.diseaseType.name 
        : "-";

      return {
        prescriptionId: check(presc._id),
        prescriptionUniqueId: check(presc.prescriptionUniqueId),
        
        // Fields from Appointment Schema
        appointmentUniqueId: check(appointment.appointmentUniqueId),
        diseaseType: check(apptDiseaseType),
        consultingFor: check(appointment.diseaseName), 
        
        // Fields from Prescription Schema
        createdAt: check(presc.createdAt),
        medicineNames: medicineNames,
        prescriptionStatus: pStatus // Returns Active, Hold, or Closed
      };
    });

    // 6. Construct Final Response
    return res.status(200).json({
      appointmentId: check(appointment._id),
      appointmentUniqueId: check(appointment.appointmentUniqueId),
      totalPrescriptions: prescriptions.length,
      statusCounts: statusCounts, // Will always show Active/Hold/Closed counts
      prescriptions: processedPrescriptions
    });

  } catch (error) {
    console.error("Error fetching prescriptions:", error);
    return res.status(500).json({ message: "Server Error", error: error.message });
  }
};
exports.closePrescriptionsByAppointment = async (req, res) => {
  try {
    const { appointmentId } = req.params;

    // 1. Fetch Appointment 
    // We need this to check if it exists AND to get the legacy prescriptionID if present
    const appointment = await Appointment.findById(appointmentId);

    if (!appointment) {
      return res.status(404).json({ message: "Appointment not found" });
    }

    // 2. Build Query Conditions
    // Matches standard links OR legacy links
    const queryConditions = [
      { appointment: appointmentId },     // Field: appointment
      { appointmentID: appointmentId }    // Field: appointmentID
    ];

    // If the Appointment doc has a legacy direct link, include it
    if (appointment.prescriptionID) {
      queryConditions.push({ _id: appointment.prescriptionID });
    }

    // 3. Perform Bulk Update
    // updateMany finds all matching documents and sets the status to "Closed"
    const result = await Prescription.updateMany(
      { $or: queryConditions },
      { 
        $set: { 
          prescriptionStatus: "Closed",
          updatedAt: Date.now() // Keep timestamp fresh
        } 
      }
    );

    // 4. Return Response
    if (result.matchedCount === 0) {
      return res.status(200).json({
        success: true,
        message: "No prescriptions found linked to this appointment.",
        count: 0
      });
    }

    return res.status(200).json({
      success: true,
      message: "Prescriptions closed successfully.",
      count: result.modifiedCount // Number of prescriptions actually updated
    });

  } catch (error) {
    console.error("Error closing prescriptions:", error);
    return res.status(500).json({ message: "Server Error", error: error.message });
  }
};
exports.getActiveRemindersByAppointment = async (req, res) => {
  try {
    const { appointmentId } = req.params;

    // 1. Fetch Appointment (to check for legacy prescriptionID link)
    const appointment = await Appointment.findById(appointmentId).lean();
    if (!appointment) {
      return res.status(404).json({ message: "Appointment not found" });
    }

    // 2. Build Query to find LINKED Prescriptions
    const queryConditions = [
      { appointment: appointmentId },     // Standard link
      { appointmentID: appointmentId }    // Alternative naming link
    ];

    // Add legacy link if it exists in the appointment doc
    if (appointment.prescriptionID) {
      queryConditions.push({ _id: appointment.prescriptionID });
    }

    // 3. Fetch ONLY "Active" Prescriptions matching those links
    const activePrescriptions = await Prescription.find({
      $and: [
        { $or: queryConditions },
        { prescriptionStatus: "Active" } // <--- FILTER: Only Active
      ]
    }).select('_id').lean();

    // If no active prescriptions found, return empty list immediately
    if (activePrescriptions.length === 0) {
      return res.status(200).json({
        success: true,
        message: "No active prescriptions found for this appointment",
        data: []
      });
    }

    // Extract just the IDs (e.g., ['68e4...', '691b...'])
    const activePrescriptionIds = activePrescriptions.map(p => p._id);

    // 4. Fetch Reminders linked to these Active Prescriptions
    const reminders = await NotificationReminderSettings.find({
      prescriptionId: { $in: activePrescriptionIds }
    })
    .sort({ date: 1, doseTime: 1 }) // Sorted chronologically
    .lean();

    // 5. Map the results to your requested fields
    const formattedReminders = reminders.map(reminder => ({
      reminderId: reminder._id,
      prescriptionId: reminder.prescriptionId, // Included for reference
      medicineName: reminder.medicineName,
      date: reminder.date,
      day: reminder.day || "-",
      doseTime: reminder.doseTime,
      quantityConsumed: reminder.quantityConsumed,
      status: reminder.status // true/false/null
    }));

    return res.status(200).json({
      success: true,
      count: formattedReminders.length,
      data: formattedReminders
    });

  } catch (error) {
    console.error("Error fetching active reminders:", error);
    return res.status(500).json({ message: "Server Error", error: error.message });
  }
};
exports.getPatientHistoryForNewDash = async (req, res) => {
  try {
    const { patientId } = req.params;

    // Helper
    const check = (val, fieldName) => (val && val !== "") ? val : fieldName;

    // 1. Fetch Patient
    const patient = await Patient.findById(patientId)
      .select('patientUniqueId gender email address currentLocation patientEntry phone');

    if (!patient) {
      return res.status(404).json({ message: 'Patient not found' });
    }

    // 2. Fetch Appointments
    const appointments = await Appointment.find({ patient: patient._id })
      .sort({ appointmentDate: -1 })
      .lean();

    // 3. Process Appointments
    const processedAppointments = await Promise.all(appointments.map(async (appt) => {
      
      // --- FIX IS HERE ---
      // Build the query conditions dynamically
      const queryConditions = [
        { appointment: appt._id },     // Standard link
        { appointmentID: appt._id }    // Alternative naming link
      ];

      // If the Appointment document has a legacy 'prescriptionID' field, add it to the search
      if (appt.prescriptionID) {
        queryConditions.push({ _id: appt.prescriptionID });
      }

      // Fetch Prescriptions matching ANY of those conditions
      const prescriptions = await Prescription.find({ 
        $or: queryConditions
      }).lean();
      // -------------------

      // --- STATUS LOGIC (unchanged) ---
      let status = 'Unknown';
      const currentDate = new Date();
      const hasPrescriptions = prescriptions.length > 0;
      
      const allPrescriptionsExpired = hasPrescriptions && prescriptions.every(p => {
        return p.endDate && new Date(p.endDate) < currentDate;
      });

      if (hasPrescriptions && allPrescriptionsExpired) {
        status = 'Completed';
      } else if (appt.follow && appt.follow.toLowerCase() === 'patient care') { 
        status = 'Ongoing';
      } else if (['Consultation', 'Prescription', 'Payment', 'Medicine Preparation'].includes(appt.follow)) {
        status = 'New';
      } else if (appt.status === 'confirmed' && !appt.follow) {
        status = 'New';
      }

      // Safe Access
      const dType = (appt.diseaseType && appt.diseaseType.name) ? appt.diseaseType.name : null;

      return {
        appointmentId: check(appt._id, "Appointment ID"),
        appointmentUniqueId: check(appt.appointmentUniqueId,"-"),
        diseaseType: check(dType, "Disease Type"), 
        consultingFor: check(appt.diseaseName, "Consulting For"),
        
        // This will now be correct because we fetched the legacy prescription too
        prescriptionCount: prescriptions.length, 
        
        appointmentDate: check(appt.appointmentDate, "Appointment Date"),
        createdAt: check(appt.createdAt, "Created At"),
        status: check(status, "Status")
      };
    }));

    // 4. Last Visit
// 4. Last Visit (Strict Logic: Must be <= Today)
let lastVisitVal = "-"; // Default to dash

    if (appointments.length > 0) {
      const now = new Date();
      
      // Find the first appointment where date is Valid AND <= Today
      const pastAppt = appointments.find(appt => {
        const d = new Date(appt.appointmentDate);
        return !isNaN(d.getTime()) && d <= now;
      });

      if (pastAppt) {
        lastVisitVal = pastAppt.appointmentDate;
      }
    }
    const responsePayload = {
      patientDetails: {
        id: check(patient._id, "ID"),
        patientUniqueId: check(patient.patientUniqueId, "-"),
        gender: check(patient.gender, "-"),
        email: check(patient.email, "-"),
        address: check(patient.address, "-"),
        city: check(patient.currentLocation, "-"),
        source: check(patient.patientEntry, "-"),
        lastVisit: check(lastVisitDate, "-"),
        phoneNumber: check(patient.phone,"-")
      },
      appointments: processedAppointments
    };

    return res.status(200).json(responsePayload);

  } catch (error) {
    console.error("Error fetching patient history:", error);
    return res.status(500).json({ message: 'Server Error', error: error.message });
  }
};
exports.getPrescriptionRemindersForNewDash = async (req, res) => {
  try {
    const { prescriptionId } = req.params;

    // 1. Fetch Reminders
    // We sort by 'date' (ASC) and then 'doseTime' (ASC) so the frontend gets an ordered timeline
    const reminders = await NotificationReminderSettings.find({ prescriptionId: prescriptionId })
      .sort({ date: 1, doseTime: 1 }) 
      .lean();

    if (!reminders || reminders.length === 0) {
      return res.status(200).json({ 
        message: "No reminders found for this prescription", 
        data: [] 
      });
    }

    // 2. Map specific fields requested
    const formattedReminders = reminders.map(reminder => {
      return {
        reminderId: reminder._id, // Always good to include the ID for future updates
        medicineName: reminder.medicineName,
        date: reminder.date,      // Returns ISO Date string (e.g., 2025-12-12T00:00:00.000Z)
        day: reminder.day || "-",
        doseTime: reminder.doseTime,
        quantityConsumed: reminder.quantityConsumed,
        status: reminder.status   // true (Taken), false (Missed), or null (Pending)
      };
    });

    // 3. Return Response
    return res.status(200).json({
      success: true,
      count: formattedReminders.length,
      data: formattedReminders
    });

  } catch (error) {
    console.error("Error fetching prescription reminders:", error);
    return res.status(500).json({ message: "Server Error", error: error.message });
  }
};
exports.updatePrescriptionSpecificStatus = async (req, res) => {
  try {
    const { prescriptionId } = req.params; // Get ID from URL parameter
    const { status } = req.body;           // Get new status from Body

    // 1. Validate Input
    if (!status) {
      return res.status(400).json({ message: "Status is required" });
    }

    // Validate against allowed Enum values (Active, Hold, Closed)
    const validStatuses = ["Active", "Hold", "Closed"];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ 
        message: `Invalid status. Allowed values are: ${validStatuses.join(", ")}` 
      });
    }

    // 2. Find and Update
    const updatedPrescription = await Prescription.findByIdAndUpdate(
      prescriptionId,
      { 
        prescriptionStatus: status,
        updatedAt: Date.now() // Good practice to update timestamp
      },
      { new: true } // Return the updated document
    );

    if (!updatedPrescription) {
      return res.status(404).json({ message: "Prescription not found" });
    }

    // 3. Success Response
    return res.status(200).json({
      success: true,
      message: "Prescription status updated successfully",
      data: {
        prescriptionId: updatedPrescription._id,
        newStatus: updatedPrescription.prescriptionStatus,
        updatedAt: updatedPrescription.updatedAt
      }
    });

  } catch (error) {
    console.error("Error updating prescription status:", error);
    return res.status(500).json({ message: "Server Error", error: error.message });
  }
};
exports.updateFollowUpCall = async (req, res) => {
  try {
    const { 
      appointmentId, 
      originalCallDate, // Used to find the specific log entry
      newCallDate,      // Optional: If you are rescheduling the time
      status, 
      remarks 
    } = req.body;

    if (!appointmentId || !originalCallDate) {
      return res.status(400).json({ 
        success: false, 
        message: "Appointment ID and Original Call Date are required" 
      });
    }

    const appointment = await Appointment.findById(appointmentId);

    if (!appointment) {
      return res.status(404).json({ success: false, message: "Appointment not found" });
    }

    // 1. Find the specific call in the array
    // We compare timestamps to ensure we find the exact match
    const callIndex = appointment.followUpCalls.findIndex(
      (call) => new Date(call.callDate).getTime() === new Date(originalCallDate).getTime()
    );

    if (callIndex === -1) {
      return res.status(404).json({ 
        success: false, 
        message: "Follow-up call record not found for this date" 
      });
    }

    // 2. Update fields if provided
    if (status) appointment.followUpCalls[callIndex].status = status;
    if (remarks) appointment.followUpCalls[callIndex].remarks = remarks;
    
    // 3. Handle Date Change (Rescheduling)
    if (newCallDate) {
      appointment.followUpCalls[callIndex].callDate = newCallDate;
      appointment.followUpCalls[callIndex].rescheduleCount += 1;
      
      // OPTIONAL: If this was the call driving the main 'followUpTimestamp', update that too.
      // This logic checks if the call we are moving was the one currently set on the main document.
      if (new Date(appointment.followUpTimestamp).getTime() === new Date(originalCallDate).getTime()) {
         appointment.followUpTimestamp = newCallDate;
      }
    }

    // 4. Save the changes
    await appointment.save();

    res.status(200).json({
      success: true,
      message: "Follow-up call updated successfully",
      data: appointment.followUpCalls[callIndex]
    });

  } catch (error) {
    console.error("Error updating follow-up call:", error);
    res.status(500).json({ 
      success: false, 
      message: "Internal server error", 
      error: error.message 
    });
  }
};
// Route: POST /api/patients/log-call-attempt
exports.logWelcomeCallAttempt = async (req, res) => {
  try {
    const { patientId } = req.body;

    const patient = await Patient.findByIdAndUpdate(
      patientId,
      {
        $inc: { "newPatientFollowUp.callsMade": 1 }, // Only Increment Count
        // REMOVED: History entry for "Call Attempt" as it wasn't in your allowed list.
      },
      { new: true }
    );

    if (!patient) return res.status(404).json({ message: "Patient not found" });

    res.status(200).json({
      success: true,
      callsMade: patient.newPatientFollowUp.callsMade,
      message: "Call count incremented"
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// Route: POST /api/patients/reschedule-welcome
exports.rescheduleWelcomeCall = async (req, res) => {
  try {
    const { patientId, newDate, newTime, remarks } = req.body;

    // 1. Combine Date and Time into a JS Date object
    const combinedDateTime = new Date(`${newDate}T${newTime}:00`);

    if (isNaN(combinedDateTime)) {
      return res.status(400).json({ message: "Invalid Date or Time format" });
    }

    // 2. Find and Update
    const updatedPatient = await Patient.findByIdAndUpdate(
      patientId,
      {
        $set: {
          "newPatientFollowUp.scheduledTime": combinedDateTime,
          "newPatientFollowUp.status": "Pending", 
          "newPatientFollowUp.remarks": remarks || "Rescheduled by staff"
        },
        $push: {
          "newPatientFollowUp.history": {
            action: "Rescheduled",
            timestamp: new Date(),
            note: "Rescheduled" // <--- STRICT NOTE AS REQUESTED
          }
        }
      },
      { new: true }
    );

    if (!updatedPatient) return res.status(404).json({ message: "Patient not found" });

    res.status(200).json({
      success: true,
      message: "Welcome call rescheduled successfully",
      newSchedule: updatedPatient.newPatientFollowUp.scheduledTime
    });

  } catch (error) {
    console.error("Reschedule Error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// Route: PUT /api/patients/update-status
exports.updateWelcomeCallStatus = async (req, res) => {
  try {
    const { patientId, status, remarks } = req.body;

    // Validate Status Enum
    const validStatuses = ['Pending', 'Overdue', 'Rescheduled', 'Lost', 'Completed'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ 
        success: false, 
        message: `Invalid status. Allowed: ${validStatuses.join(', ')}` 
      });
    }

    // 1. Prepare the dynamic updates
    let updateFields = {
      "newPatientFollowUp.status": status,
      ...(remarks && { "newPatientFollowUp.remarks": remarks }) 
    };

    // 2. Logic for "Lost" status
    if (status === 'Lost') {
      updateFields.userStatus = "Inactive";
      updateFields.patientStage = "Miscellaneous";
      updateFields.follow = "Miscellaneous";
      updateFields.enquiryStatus = "Not Interested";
    }

    const patient = await Patient.findByIdAndUpdate(
      patientId,
      {
        $set: updateFields,
        $push: {
          "newPatientFollowUp.history": {
            action: "Status Change",
            timestamp: new Date(),
            note: status // <--- STRICT NOTE: Will be "Completed" or "Lost" etc.
          }
        }
      },
      { new: true }
    );

    if (!patient) return res.status(404).json({ success: false, message: "Patient not found" });

    res.status(200).json({
      success: true,
      message: `Status updated to ${status}`,
      currentStatus: patient.newPatientFollowUp.status
    });

  } catch (error) {
    console.error("Update Status Error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
};
const MedicalDetails = require('../models/patientDetails'); // Import this to get disease name

exports.getPatientCallLogs = async (req, res) => {
  try {
    const { patientId } = req.params;

    // 1. Fetch Patient Data (including the history array)
    const patient = await Patient.findById(patientId).lean();

    if (!patient) {
      return res.status(404).json({ success: false, message: "Patient not found" });
    }

    // 2. Fetch Disease Name from MedicalDetails
    const medDetails = await MedicalDetails.findOne({ patientId: patient._id }).select('diseaseName').lean();

    // 3. Format the response
    const profileData = {
      patientName: patient.name,
      phoneNumber: patient.phone,
      email: patient.email || "-",
      gender: patient.gender || "-",
      source: patient.patientEntry || "Direct", // Maps to 'patientEntry'
      
      // Location Details
      city: patient.currentLocation || "-",
      address: patient.address || "-", 
      // Note: Country/Pincode are not separate fields in your schema, 
      // so we return the full address.
      
      diseaseName: medDetails ? medDetails.diseaseName : "-",
      
      // Current Status
      currentStatus: patient.newPatientFollowUp?.status || "Pending",
      scheduledTime: patient.newPatientFollowUp?.scheduledTime || null
    };

    // 4. Get the Call Log (History)
    // We sort it so the most recent events appear first
    const callLogs = (patient.newPatientFollowUp?.history || []).sort((a, b) => 
      new Date(b.timestamp) - new Date(a.timestamp)
    );

    res.status(200).json({
      success: true,
      profile: profileData,
      logs: callLogs
    });

  } catch (error) {
    console.error("Error fetching patient logs:", error);
    res.status(500).json({ success: false, error: error.message });
  }
};
exports.getNewPatientDashboard = async (req, res) => {
  try {
    const dashboardData = await Patient.aggregate([
      // 1. FILTER: Only "New" Patients
      {
        $match: {
          newExisting: "New"
        }
      },

      // 2. LOOKUP: Fetch patientDetails (Replaced MedicalDetails)
      {
        $lookup: {
          from: "patientdetails", // <--- CHANGED: Now looks in 'patientdetails' collection
          localField: "_id",
          foreignField: "patientId",
          as: "medDetails" // Kept alias same to avoid breaking projection logic below
        }
      },
      // Unwind to flatten the array (preserve if no details exist)
      { $unwind: { path: "$medDetails", preserveNullAndEmptyArrays: true } },

      {
        $facet: {
          // --- BLOCK A: KPI CARDS ---
          "kpis": [
            {
              $group: {
                _id: null,
                totalRegistered: { $sum: 1 },
                completed: { 
                  $sum: { $cond: [{ $eq: ["$newPatientFollowUp.status", "Completed"] }, 1, 0] } 
                },
                rescheduled: { 
                  $sum: { $cond: [{ $eq: ["$newPatientFollowUp.status", "Rescheduled"] }, 1, 0] } 
                },
                overdue: { 
                  $sum: { $cond: [{ $eq: ["$newPatientFollowUp.status", "Overdue"] }, 1, 0] } 
                },
                lost: { 
                  $sum: { $cond: [{ $eq: ["$newPatientFollowUp.status", "Lost"] }, 1, 0] } 
                }
              }
            },
            {
              $project: {
                _id: 0,
                totalRegistered: 1,
                completed: 1,
                rescheduled: 1,
                overdue: 1,
                lost: 1,
                slaCompletionPercentage: {
                  $cond: {
                    if: { $eq: ["$totalRegistered", 0] },
                    then: 0,
                    else: { $multiply: [{ $divide: ["$completed", "$totalRegistered"] }, 100] }
                  }
                }
              }
            }
          ],

          // --- BLOCK B: PIE CHART ---
          "callAttemptsBreakdown": [
            {
              $group: {
                _id: "$newPatientFollowUp.callsMade",
                count: { $sum: 1 }
              }
            },
            { $sort: { _id: 1 } }
          ],

          // --- BLOCK C: TABLE LIST ---
          "tableList": [
            { $sort: { createdAt: -1 } }, 
            {
              $project: {
                _id: 1,
                patientName: { $ifNull: ["$name", "-"] },
                phoneNumber: { $ifNull: ["$phone", "-"] },
                registrationTime: "$createdAt",
                appDownload: { $ifNull: ["$appDownload", 0] },

                // --- FETCHING FROM patientDetails (via medDetails alias) ---
                diseaseName: { $ifNull: ["$medDetails.diseaseName", "-"] },
                consultingFor: { $ifNull: ["$medDetails.consultingFor", "-"] },
                diseaseType: { $ifNull: ["$medDetails.diseaseType.name", "-"] }, 
                // ----------------------------------

                scheduledTime: { $ifNull: ["$newPatientFollowUp.scheduledTime", "-"] },

                // Last Call Attempt Logic
                lastCallAttempt: { 
                    $let: {
                        vars: { 
                          lastLog: { 
                            $arrayElemAt: [ { $slice: [ "$newPatientFollowUp.history", -1 ] }, 0 ] 
                          } 
                        },
                        in: { $ifNull: ["$$lastLog.timestamp", "-"] }
                    }
                },

                callsMade: { $ifNull: ["$newPatientFollowUp.callsMade", "-"] },
                
                rescheduledTime: {
                  $cond: {
                    if: { $eq: ["$newPatientFollowUp.status", "Rescheduled"] },
                    then: { $ifNull: ["$newPatientFollowUp.rescheduledTo", "-"] },
                    else: "-"
                  }
                },

                status: "$newPatientFollowUp.status"
              }
            }
          ]
        }
      }
    ]);

    const result = dashboardData[0];

    res.status(200).json({
      success: true,
      kpis: result.kpis[0] || { 
          totalRegistered: 0, completed: 0, rescheduled: 0, 
          overdue: 0, lost: 0, slaCompletionPercentage: 0 
      },
      pieChart: result.callAttemptsBreakdown,
      tableData: result.tableList
    });

  } catch (error) {
    console.error("Dashboard Error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
};
exports.getPrescriptionFollowUpReport = async (req, res) => {
  try {
    // 1. Find all appointments that HAVE a prescriptionID
    const appointments = await Appointment.find({
      prescriptionID: { $exists: true, $ne: null },
    })
      .populate("patient", "patientUniqueId name phone") 
      .lean(); 

    // ============================================================
    // --- NEW ADDITION: CALCULATE CHART STATISTICS ---
    // ============================================================
    let globalPending = 0;
    let globalRescheduled = 0;
    let globalCompleted = 0;
    let globalTotalCalls = 0;

    appointments.forEach(appt => {
        const calls = appt.followUpCalls || [];
        globalTotalCalls += calls.length;

        calls.forEach(call => {
            if (call.status === 'Pending') globalPending++;
            if (call.status === 'Rescheduled') globalRescheduled++;
            if (call.status === 'Completed') globalCompleted++;
        });
    });

    // Calculate Completion Rate (Percentage)
    // Formula: (Total Completed / Total Calls) * 100
    const completionRate = globalTotalCalls > 0 
        ? Math.round((globalCompleted / globalTotalCalls) * 100) 
        : 0;
    // ============================================================


    // 2. Map through appointments to format the data (UNTOUCHED)
    const reportData = appointments.map((appt) => {
      const calls = appt.followUpCalls || [];

      // A. Calculate Counts
      const totalFollowUps = calls.length;
      
      const completedCount = calls.filter(
        (c) => c.status === "Completed"
      ).length;
      
      const missedCount = calls.filter(
        (c) => c.status === "Missed"
      ).length;

      // ADDED: Count for Pending calls
      const pendingCount = calls.filter(
        (c) => c.status === "Pending"
      ).length;

      // B. Find "Last" Follow-Up (Only "Completed" or "Missed")
      const pastCalls = calls
        .filter((c) => c.status === "Completed" || c.status === "Missed")
        .sort((a, b) => new Date(b.callDate) - new Date(a.callDate));
      
      const lastCall = pastCalls.length > 0 ? pastCalls[0] : null;

      // C. Find "Next" Follow-Up (Usually "Pending")
      const pendingCalls = calls
        .filter((c) => c.status === "Pending")
        .sort((a, b) => new Date(a.callDate) - new Date(b.callDate));
        
      const nextCall = pendingCalls.length > 0 ? pendingCalls[0] : null;

      // D. Return the "Line Item"
      return {
        // ADDED: Appointment ID
        appointmentId: appt._id,

        // Patient Details
        patientUniqueId: appt.patient?.patientUniqueId || "N/A",
        patientId: appt.patient?._id,
        patientName: appt.patient?.name || "Unknown",
        // ADDED: Phone Number
        phoneNumber: appt.patient?.phone || "N/A",
        
        // Appointment Details
        appointmentDate: appt.appointmentDate,
        timeSlot: appt.timeSlot, 
        prescriptionId: appt.prescriptionID,

        // Follow-Up Stats
        totalFollowUpsScheduled: totalFollowUps,
        completedFollowUps: completedCount,
        missedFollowUps: missedCount,
        // ADDED: Pending Count
        pendingFollowUps: pendingCount,

        // Last Follow-Up Details
        lastFollowUpDate: lastCall ? lastCall.callDate : null,
        lastFollowUpStatus: lastCall ? lastCall.status : null,
        lastFollowUpRemarks: lastCall ? lastCall.remarks : null,

        // Next Follow-Up Details
        nextFollowUpDate: nextCall ? nextCall.callDate : null,
      };
    });

    res.status(200).json({
      success: true,
      // --- NEW ADDITION: STATS OBJECT FOR CHART ---
      stats: {
          pending: globalPending,
          rescheduled: globalRescheduled,
          completed: globalCompleted,
          completionRate: completionRate
      },
      // --------------------------------------------
      count: reportData.length,
      data: reportData,
    });
  } catch (error) {
    console.error("Error fetching follow-up report:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};
exports.getPatientCallReport = async (req, res) => {
  try {
    const { patientId } = req.params;

    // 1. Fetch Patient Data (including the history array)
    const patient = await Patient.findById(patientId).lean();

    if (!patient) {
      return res.status(404).json({ success: false, message: "Patient not found" });
    }

    // 2. Fetch Disease Name using your specific model import
    const details = await patientDetails.findOne({ patientId: patient._id }).select('diseaseName').lean();

    // 3. Format the response
    const profileData = {
      patientName: patient.name,
      phoneNumber: patient.phone,
      email: patient.email || "-",
      gender: patient.gender || "-",
      source: patient.patientEntry || "Direct", 
      
      // Location Details
      city: patient.currentLocation || "-",
      address: patient.address || "-", 
      
      // Use the fetched details to get diseaseName
      diseaseName: details ? details.diseaseName : "-",
      
      // Current Status
      currentStatus: patient.newPatientFollowUp?.status || "Pending",
      scheduledTime: patient.newPatientFollowUp?.scheduledTime || null
    };

    // 4. Get the Call Log (History)
    const callLogs = (patient.newPatientFollowUp?.history || []).sort((a, b) => 
      new Date(b.timestamp) - new Date(a.timestamp)
    );

    res.status(200).json({
      success: true,
      profile: profileData,
      logs: callLogs
    });

  } catch (error) {
    console.error("Error fetching patient logs:", error);
    res.status(500).json({ success: false, error: error.message });
  }
};
exports.getTotalAppointmentsForDoctor = async (req, res) => {
  try {
    // 1. Get the logged-in doctor's ID from the token
    const doctorId = req.user._id;

    // 2. Count all documents where the 'doctor' field matches the ID
    const totalAppointments = await Appointment.countDocuments({
      doctor: doctorId,
    });

    res.status(200).json({ 
        success: true, 
        totalAppointments: totalAppointments 
    });

  } catch (error) {
    console.error("Error fetching total appointments for doctor:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};
exports.getTodaysAppointmentCount = async (req, res) => {
  try {
    // 1. Get the logged-in doctor's ID from the token
    const doctorId = req.user._id;

    // 2. Define the start and end of the current day
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
    const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    // 3. Count documents for the doctor within today's date range
    const todaysCount = await Appointment.countDocuments({
      doctor: doctorId,
      appointmentDate: {
        $gte: startOfToday,
        $lte: endOfToday,
      },
    });

    res.status(200).json({ 
        success: true, 
        count: todaysCount 
    });

  } catch (error) {
    console.error("Error fetching today's appointment count for doctor:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};