const mongoose = require("mongoose");

// Create a separate CommentSchema to handle nesting
const CommentSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Doctor",
    // enum: ["Doctor", "Patient"],
    required: true,
  },
  text: {
    type: String,
    required: true,
  },
  replies: [
    // Self-referencing for nested comments
    {
      type: mongoose.Schema.ObjectId,
      ref: "Comment",
    },
  ],
  parentComment: {
    // Reference to parent comment if this is a reply
    type: mongoose.Schema.ObjectId,
    ref: "Comment",
    default: null,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// Register Comment model
const Comment = mongoose.model("Comment", CommentSchema);

const PostSchema = new mongoose.Schema({
  author: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Doctor",
    required: true,
  },
  text: { type: String, default: "" },
  mediaUrl: { type: String },
  mediaType: { type: String, enum: ["image", "video", "text"], required: true },
  likes: [{ type: mongoose.Schema.Types.ObjectId, ref: "Doctor" }],
  comments: [
    // Reference to top-level comments
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Comment",
    },
  ],
  createdAt: { type: Date, default: Date.now },
});

module.exports = {
  Post: mongoose.model("Post", PostSchema),
  Comment: Comment,
};
