const mongoose = require("mongoose");

const consumptionOptionSchema = new mongoose.Schema({
  form: {
    type: String,
    required: true,
    enum: ["Liquid form", "Pills", "Tablets", "Individual Medicine"],
  },
  label: {
    type: String,
    required: true,
  },
});

module.exports = mongoose.model("ConsumptionOption", consumptionOptionSchema);
