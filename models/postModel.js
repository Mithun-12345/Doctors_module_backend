const mongoose = require("mongoose");

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
    {
      user: { type: mongoose.Schema.Types.ObjectId, ref: "Doctor" },
      text: { type: String, required: true },
      createdAt: { type: Date, default: Date.now },
    },
  ],
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("Post", PostSchema);
