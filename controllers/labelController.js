const Label = require("../models/Label");

exports.getLabels = async (req, res) => {
  try {
    const labels = await Label.find().sort({ value: 1 });
    res.json(labels);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch labels" });
  }
};

exports.addLabel = async (req, res) => {
  const { value } = req.body;
  if (!value) return res.status(400).json({ error: "Label value is required" });

  try {
    const existing = await Label.findOne({ value });
    if (existing) {
      return res.status(400).json({ error: "Label already exists" });
    }

    const label = new Label({ value });
    await label.save();
    res.status(201).json(label);
  } catch (err) {
    res.status(500).json({ error: "Failed to add label" });
  }
};
