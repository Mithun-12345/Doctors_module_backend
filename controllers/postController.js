const Post = require("../models/postModel");
const Doctor = require("../models/doctorModel");
const Patient = require("../models/patientModel");
const cloudinary = require("cloudinary").v2;

// Create a Post
exports.createPost = async (req, res) => {
  try {
    const { text } = req.body;
    const mediaUrl = req.file ? req.file.path : null;
    const mediaType = mediaUrl
      ? req.file.mimetype.startsWith("video")
        ? "video"
        : "image"
      : "text";

    if (!text && !mediaUrl) {
      return res.status(400).json({
        success: false,
        message: "Post must contain either text or media.",
      });
    }

    const phone = req.user.phone;
    const doctor = await Doctor.findOne({ phone });
    if (!doctor) {
      return res
        .status(403)
        .json({ success: false, message: "You should be a doctor to post!" });
    }
    const doctorId = doctor._id;

    const newPost = new Post({
      author: doctorId,
      text,
      mediaUrl,
      mediaType,
    });

    await newPost.save();
    res.status(201).json({ success: true, post: newPost });
  } catch (error) {
    console.error("Error creating post:", error);
    res.status(500).json({ success: false, message: "Internal server error." });
  }
};

// Get all posts(for doctor)
exports.getPosts = async (req, res) => {
  try {
    const doctor = await Doctor.findOne({ phone: req.user.phone }).select(
      "_id"
    );

    if (!doctor) {
      return res
        .status(404)
        .json({ success: false, message: "Doctor not found" });
    }

    const posts = await Post.find({ author: doctor._id })
      .sort({ createdAt: -1 })
      .populate("author", "name"); // Populate doctor details (name and profile photo)

    res.status(200).json({ success: true, posts });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// Like/Unlike a Post
exports.likePost = async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post)
      return res
        .status(404)
        .json({ success: false, message: "Post not found" });

    if (post.likes.includes(req.user.id)) {
      post.likes = post.likes.filter((id) => id.toString() !== req.user.id);
    } else {
      post.likes.push(req.user.id);
    }

    await post.save();
    res.status(200).json({ success: true, likes: post.likes.length }); //Like count is returned
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// Comment on a Post
exports.commentPost = async (req, res) => {
  try {
    const { text } = req.body;
    const post = await Post.findById(req.params.id);
    if (!post)
      return res
        .status(404)
        .json({ success: false, message: "Post not found" });

    const phone = req.user.phone;
    let userId = await Doctor.findOne({ phone });
    if (!userId) {
      userId = await Patient.findOne({ phone });
    }

    const comment = { user: userId, text };
    post.comments.push(comment);

    await post.save();
    res.status(200).json({ success: true, comments: post.comments });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

//Update can be done only for text part and not on the file/s
exports.updatePost = async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post)
      return res
        .status(404)
        .json({ success: false, message: "Post not found" });

    const phone = req.user.phone;
    const user = await Doctor.findOne({ phone });

    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    // Ensure only the owner can edit
    if (post.author.toString() !== user._id.toString()) {
      return res
        .status(403)
        .json({ success: false, message: "Unauthorized to edit this post" });
    }

    // Only update text (media should remain unchanged)
    if (req.body.text) {
      post.text = req.body.text;
    }

    await post.save();
    res.status(200).json({ success: true, post });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

//Post can be deleted from DB as well as Cloudinary
exports.deletePost = async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post)
      return res
        .status(404)
        .json({ success: false, message: "Post not found" });

    const phone = req.user.phone;
    const user = await Doctor.findOne({ phone });

    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    // Ensure only the owner can edit
    if (post.author.toString() !== user._id.toString()) {
      return res
        .status(403)
        .json({ success: false, message: "Unauthorized to edit this post" });
    }
    // Delete media from Cloudinary if it exists
    if (post.mediaUrl) {
      const publicId = post.mediaUrl
        .split("/")
        .slice(-2)
        .join("/")
        .split(".")[0];

      await cloudinary.uploader.destroy(publicId);
    }
    await Post.findByIdAndDelete(post._id);
    return res
      .status(200)
      .json({ success: true, message: "Post deleted successfully" });
  } catch (error) {
    console.log({ success: false, error: error.message });
  }
};

exports.getPaginatedPosts = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1; // Get page number from query
    const limit = parseInt(req.query.limit) || 10; // Limit posts per request
    const skip = (page - 1) * limit;

    const posts = await Post.find()
      .populate("author", "name") // Get doctor's name & image; After updating profile picture make a space after name and give the mongodb filed for profile picture
      .sort({ createdAt: -1 }) // Newest posts first
      .skip(skip)
      .limit(limit);

    const totalPosts = await Post.countDocuments();
    const totalPages = Math.ceil(totalPosts / limit);

    res.status(200).json({
      success: true,
      posts,
      page,
      totalPages,
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

//Handle multiple images upload with size/limit restriction
//If video, only one video should be uploaded for a post
//Comment/Reply a comment
//Like a comment
//Home page that display all posts where each post will have doctor name, profile picture, and time of post(Eg.,1d,2w,1m,2y)
