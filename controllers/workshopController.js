const Doctor = require("../models/doctorModel");
const Patient = require("../models/patientModel");
const Workshop = require("../models/workShopModel");

exports.createWorkshop = async (req, res) => {
  try {
    const phone = req.user.phone;
    const doctor = await Doctor.findOne({ phone });
    if (!doctor) {
      return res.status(404).json({ message: "Doctor not found" });
    }
    const {
      title,
      description,
      fee,
      allowedParticipants,
      scheduledDateTime,
      limit,
    } = req.body;
    const newWorkshop = new Workshop({
      title,
      description,
      fee,
      doctorId: doctor._id,
      allowedParticipants,
      scheduledDateTime,
      limit,
    });
    await newWorkshop.save();
    res.status(201).json({
      message: "Workshop started successfully",
      workshop: newWorkshop,
    });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Internal Server Error", error: error.message });
  }
};

//General page where upcoming workshops can be seen
exports.viewPendingWorkshops = async (req, res) => {
  try {
    const phone = req.user.phone;
    const doctor = await Doctor.findOne({ phone });
    const patient = await Patient.findOne({ phone });
    let userType;
    if (doctor) {
      userType = "Doctor";
    } else if (patient) {
      userType = "Patient";
    }
    const workshops = await Workshop.find({
      $or: [{ allowedParticipants: userType }, { allowedParticipants: "Both" }],
    });

    res.status(200).json({ workshops });
  } catch (error) {
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

exports.bookWorkshop = async (req, res) => {
  try {
    const { workshopId } = req.body;
    const phone = req.user.phone;

    // Identify user type
    const doctor = await Doctor.findOne({ phone });
    const patient = await Patient.findOne({ phone });

    if (!doctor && !patient) {
      return res.status(404).json({ message: "User not found" });
    }

    const userId = doctor ? doctor._id : patient._id;
    const userType = doctor ? "Doctor" : "Patient";

    const workshop = await Workshop.findById(workshopId);
    if (!workshop) {
      return res.status(404).json({ message: "Workshop not found" });
    }

    // Check if the user is allowed to book
    if (
      workshop.allowedParticipants !== userType &&
      workshop.allowedParticipants !== "Both"
    ) {
      return res
        .status(403)
        .json({ message: "You are not allowed to book this workshop" });
    }

    // // Ensure participants array exists
    // if (!workshop.participants) {
    //   workshop.participants = [];
    // }

    if (new Date(workshop.scheduledDateTime) < new Date()) {
      return res.status(400).json({ message: "Workshop has already passed" });
    }

    // Check if user already booked the workshop
    if (workshop.participants.includes(userId)) {
      return res
        .status(400)
        .json({ message: "You have already booked this workshop" });
    }

    // Add user to participants and save
    if (typeof workshop.limit === "number") {
      if (workshop.limit > 0) {
        workshop.participants.push(userId);
        workshop.limit--;
        await workshop.save();
        return res
          .status(200)
          .json({ message: "Workshop booked successfully", workshop });
      } else {
        return res
          .status(400)
          .json({ message: "Workshop booking limit reached" });
      }
    } else {
      // No limit set
      workshop.participants.push(userId);
      await workshop.save();
      return res
        .status(200)
        .json({ message: "Workshop booked successfully", workshop });
    }
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Internal Server Error", error: error.message });
  }
};

//Doctors view their own Workshops
exports.viewOwnWorkshops = async (req, res) => {
  try {
    const phone = req.user.phone;

    const doctor = await Doctor.findOne({ phone });
    if (!doctor) {
      return res.status(404).json({ message: "Doctor not found" });
    }

    const workshops = await Workshop.find({ doctor: doctor._id }).sort({
      createdAt: -1,
    });

    res.status(200).json({ workshops });
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Internal Server Error", error: error.message });
  }
};
