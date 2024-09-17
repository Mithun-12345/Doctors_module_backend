const express = require('express');
const router = express.Router();
const asyncHandler = require('express-async-handler');
const mongoose = require('mongoose');
const Message = require('../models/messageModel');
const validateToken = require('../middlewares/validateTokenHandler');

router.get('/chat-list', validateToken, asyncHandler(async (req, res) => {
    try {
        let userId = req.user._id; // Using _id from the user object
        console.log('User ID:', userId);

        if (!userId) {
            return res.status(401).json({ success: false, error: 'User ID is not available' });
        }

        const chats = await Message.aggregate([
            {
                $match: {
                    $or: [{ sender: userId }, { receiver: userId }]
                }
            },
            {
                $sort: { timestamp: -1 }
            },
            {
                $group: {
                    _id: {
                        $cond: [
                            { $eq: ["$sender", userId] },
                            "$receiver",
                            "$sender"
                        ]
                    },
                    lastMessage: { $first: "$content" },
                    lastMessageTime: { $first: "$timestamp" }
                }
            },
            {
                $lookup: {
                    from: 'patients', // Assuming your users collection is named 'patients'
                    localField: '_id',
                    foreignField: '_id',
                    as: 'userDetails'
                }
            },
            {
                $unwind: '$userDetails'
            },
            {
                $project: {
                    _id: 1,
                    name: '$userDetails.name',
                    phone: '$userDetails.phone',
                    lastMessage: 1,
                    lastMessageTime: 1
                }
            }
        ]);

        res.status(200).json({ success: true, chats });
    } catch (error) {
        console.error('Error fetching chat list:', error);
        res.status(500).json({ success: false, error: 'Server error' });
    }
}));

module.exports = router;