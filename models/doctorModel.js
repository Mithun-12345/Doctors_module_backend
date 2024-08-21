const mongoose = require("mongoose");

const doctorSchema = new mongoose.Schema({
  phone:String,
  name: String,
  age: Number,
  gender: String,
  photo: String,
  specialization: String,
  bio: String,
});

module.exports = new mongoose.model("Doctor", doctorSchema);