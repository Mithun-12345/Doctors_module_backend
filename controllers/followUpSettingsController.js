const FollowUpSetting = require("../models/followUpSettings"); // Adjust path as needed

exports.updateFollowUpSettings = async (req, res) => {
  try {
    const { allowCallAfterMinutes } = req.body;

    // CHANGED: Only check if the field is missing (undefined or null).
    // This allows 0 or negative numbers if you really wanted them.
    if (allowCallAfterMinutes === undefined || allowCallAfterMinutes === null) {
       return res.status(400).json({ success: false, message: "allowCallAfterMinutes is required." });
    }

    // Upsert (Update if exists, Insert if new)
    const settings = await FollowUpSetting.findOneAndUpdate(
      {}, // Filter: Find the first document (since it's a singleton)
      { allowCallAfterMinutes: allowCallAfterMinutes }, // Update
      { new: true, upsert: true, setDefaultsOnInsert: true } // Options
    );

    res.status(200).json({
      success: true,
      message: "Follow-up window updated successfully",
      data: settings,
    });
  } catch (error) {
    console.error("Error updating settings:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};