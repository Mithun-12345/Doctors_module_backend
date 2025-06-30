const ConsumptionOption = require("../models/ConsumptionOption");

// GET options by form
exports.getOptionsByForm = async (req, res) => {
  try {
    const { form } = req.params;
    const options = await ConsumptionOption.find({ form });
    res.json(options);
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
};

// POST add new option
exports.addOption = async (req, res) => {
  try {
    const { form, label } = req.body;
    if (!form || !label) {
      return res.status(400).json({ message: "Form and label are required" });
    }

    // Avoid duplicates
    const existing = await ConsumptionOption.findOne({ form, label });
    if (existing) return res.status(409).json({ message: "Already exists" });

    const newOption = new ConsumptionOption({ form, label });
    await newOption.save();

    res.status(201).json(newOption);
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
};
