const mongoose = require("mongoose");
const Doctor = require("../models/doctorModel");

exports.addDoctor = async (req, res) => {
  const phone = req.user.phone;
  if (!phone) {
    return res.status(400).json({ message: "Phone number not available" });
  }
  const checkDoctor = await Doctor.find({ phone });
  if (!checkDoctor) {
    const { name, age, gender, photo, specialization, bio } = req.body;
    try {
      const assistantDoctor = new Doctor({
        name,
        age,
        gender,
        photo,
        specialization,
        bio,
        phone,
      });
      await assistantDoctor.save();
      res.status(201).send("Assistant doctor added successfully");
    } catch (error) {
      res.status(500).send("Failed to add assistant doctor");
    }
  } else {
    res.json({ message: "Doctor already exists!" });
  }
};
