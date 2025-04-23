const mongoose = require("mongoose");
require("dotenv").config();

const dbConnection = async () => {
  try {
    const uri = process.env.MONGO_URI;
    await mongoose.connect(uri); // Simple and clean
    console.log("Connected to MongoDB database!");
  } catch (error) {
    console.error("Connection failed!", error);
  }
};

module.exports = dbConnection;
