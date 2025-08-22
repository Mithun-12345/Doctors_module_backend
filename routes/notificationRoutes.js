const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const validateToken = require("../middlewares/validateTokenHandler"); // Your auth middleware
const Notification = require("../models/notificationHub"); // Your Notification model

router.get("/",validateToken, async (req, res) => {
  try {
    const userId = req.user._id; // Get user ID from the authentication token

    // Fetch the 30 most recent notifications for the user
    const notifications = await Notification.find({ recipient: userId })
      .sort({ createdAt: -1 }) // Show newest first
      .limit(30);

    // Separately, count how many are unread
    const unreadCount = await Notification.countDocuments({
      recipient: userId,
      read: false,
    });

    // Send both the list and the count to the frontend
    res.status(200).json({ notifications, unreadCount });

  } catch (error) {
    console.error("Error fetching notifications:", error);
    res.status(500).json({ message: "Server error" });
  }
});

router.patch("/:id/read", validateToken, async (req, res) => {
  try {
    const { id: notificationId } = req.params;
    const userId = req.user._id;

    if (!mongoose.Types.ObjectId.isValid(notificationId)) {
        return res.status(400).json({ message: "Invalid notification ID." });
    }

    // Find the notification and update it
    // We include `recipient: userId` to ensure a user can't mark someone else's notification as read
    const notification = await Notification.findOneAndUpdate(
      { _id: notificationId, recipient: userId },
      { read: true },
      { new: true } // This option returns the updated document
    );

    if (!notification) {
      return res.status(404).json({ message: "Notification not found." });
    }

    res.status(200).json({ message: "Notification marked as read.", notification });

  } catch (error) {
    console.error("Error marking notification as read:", error);
    res.status(500).json({ message: "Server error" });
  }
});

router.patch("/mark-all-read", validateToken, async (req, res) => {
  try {
    const userId = req.user._id;

    // Use updateMany to change all documents that match the filter
    const result = await Notification.updateMany(
      { recipient: userId, read: false }, // Filter: Find all notifications for this user that are unread
      { $set: { read: true } }            // Update: Set the 'read' field to true
    );

    res.status(200).json({ 
      success: true, 
      message: "All unread notifications marked as read.",
      modifiedCount: result.modifiedCount // How many were actually updated
    });

  } catch (error) {
    console.error("Error marking all notifications as read:", error);
    res.status(500).json({ message: "Server error" });
  }
});
router.patch("/:id/bot-status", async (req, res) => {
  const { id } = req.params;
  const { isbotread } = req.body;

  // 1. Validate the notification ID format
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ message: "Invalid notification ID format." });
  }

  // 2. Validate the payload from the request body
  if (typeof isbotread !== "boolean") {
    return res
      .status(400)
      .json({ message: 'The "isbotread" field must be a boolean (true or false).' });
  }

  try {
    // 3. Find the notification by ID and update it
    const updatedNotification = await Notification.findByIdAndUpdate(
      id,
      { isbotread: isbotread }, // The update operation
      { new: true } // This option returns the modified document
    );

    // 4. Handle the case where the notification is not found
    if (!updatedNotification) {
      return res.status(404).json({ message: "Notification not found." });
    }

    // 5. Send a success response with the updated data
    res.status(200).json({
      message: "Bot read status updated successfully.",
      notification: updatedNotification,
    });
  } catch (error) {
    // 6. Handle any server-side errors
    console.error("Error updating notification:", error);
    res.status(500).json({ message: "An internal server error occurred." });
  }
});
module.exports = router;