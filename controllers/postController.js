const { Post, Comment } = require("../models/postModel");
const Doctor = require("../models/doctorModel");
const Patient = require("../models/patientModel");
const cloudinary = require("cloudinary").v2;
const moment = require("moment");

// Helper function to format time
const formatTimeAgo = (date) => moment(date).fromNow();

// Create a Post
// exports.createPost = async (req, res) => {
//   try {
//     const { text } = req.body;
//     const mediaUrl = req.file ? req.file.path : null;
//     const mediaType = mediaUrl
//       ? req.file.mimetype.startsWith("video")
//         ? "video"
//         : "image"
//       : "text";

//     if (!text && !mediaUrl) {
//       return res.status(400).json({
//         success: false,
//         message: "Post must contain either text or media.",
//       });
//     }

//     const phone = req.user.phone;
//     const doctor = await Doctor.findOne({ phone });
//     if (!doctor) {
//       return res
//         .status(403)
//         .json({ success: false, message: "You should be a doctor to post!" });
//     }
//     const doctorId = doctor._id;

//     const newPost = new Post({
//       author: doctorId,
//       text,
//       mediaUrl,
//       mediaType,
//     });

//     await newPost.save();
//     res.status(201).json({ success: true, post: newPost });
//   } catch (error) {
//     console.error("Error creating post:", error);
//     res.status(500).json({ success: false, message: "Internal server error." });
//   }
// };

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

exports.createPost = async (req, res) => {
  try {
    console.log("ffefw");
    const { text } = req.body;
    let mediaUrl = null;
    let mediaType = 'text';

    // Validate post content
    if (!text && !req.file) {
      return res.status(400).json({
        success: false,
        message: "Post must contain either text or media.",
      });
    }

    // Upload file to Cloudinary if exists
    if (req.file) {
      try {
        // Determine upload preset based on file type
        const uploadOptions = {
          folder: 'doctor_posts',
          resource_type: req.file.mimetype.startsWith('video') ? 'video' : 'image'
        };

        // Upload to Cloudinary
        const cloudinaryResponse = await new Promise((resolve, reject) => {
          cloudinary.uploader.upload(
            req.file.path, 
            uploadOptions, 
            (error, result) => {
              if (error) reject(error);
              else resolve(result);
            }
          );
        });

        // Set media URL and type
        mediaUrl = cloudinaryResponse.secure_url;
        mediaType = cloudinaryResponse.resource_type === 'video' ? 'video' : 'image';
      } catch (cloudinaryError) {
        console.error('Cloudinary upload error:', cloudinaryError);
        return res.status(500).json({
          success: false,
          message: "Failed to upload media to cloud.",
        });
      }
    }

    // Verify doctor
    const phone = req.user.phone;
    const doctor = await Doctor.findOne({ phone });
    if (!doctor) {
      return res.status(403).json({ 
        success: false, 
        message: "You should be a doctor to post!" 
      });
    }
    const doctorId = doctor._id;

    // Create new post
    const newPost = new Post({
      author: doctorId,
      text,
      mediaUrl,
      mediaType,
    });

    await newPost.save();

    // Optional: Remove local file after Cloudinary upload
    if (req.file) {
      const fs = require('fs');
      fs.unlink(req.file.path, (err) => {
        if (err) console.error('Failed to delete local file:', err);
      });
    }

    res.status(201).json({ 
      success: true, 
      post: newPost 
    });
  } catch (error) {
    console.error("Error creating post:", error);
    res.status(500).json({ 
      success: false, 
      message: "Internal server error." 
    });
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

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const commentPage = parseInt(req.query.commentPage) || 1;
    const commentLimit = parseInt(req.query.commentLimit) || 5;
    const commentSkip = (commentPage - 1) * commentLimit;

    // Fetch posts
    const posts = await Post.find({ author: doctor._id })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate("author", "name profilePhoto")
      .populate({
        path: "comments",
        options: {
          sort: { createdAt: -1 },
          skip: commentSkip,
          limit: commentLimit,
        },
        populate: { path: "replies" },
      });

    // Collect all user IDs (from comments and replies)
    let userIds = new Set();
    posts.forEach((post) => {
      post.comments.forEach((comment) => {
        userIds.add(comment.user.toString());
        comment.replies.forEach((reply) => userIds.add(reply.user.toString()));
      });
    });

    // Fetch all users in a single query
    const users = await Promise.all([
      Doctor.find({ _id: { $in: [...userIds] } }).select(
        "_id name profilePhoto"
      ),
      Patient.find({ _id: { $in: [...userIds] } }).select(
        "_id name profilePhoto"
      ),
    ]);
    const allUsers = [...users[0], ...users[1]];

    // Create a user lookup map
    const userMap = {};
    allUsers.forEach((user) => {
      userMap[user._id] = {
        ...user.toObject(),
        userType: user instanceof Doctor ? "Doctor" : "Patient",
      };
    });

    // Format posts with user details and timeAgo
    const formattedPosts = posts.map((post) => ({
      ...post.toObject(),
      timeAgo: formatTimeAgo(post.createdAt),
      comments: post.comments.map((comment) => ({
        ...comment.toObject(),
        user: userMap[comment.user] || null, // Attach user details
        timeAgo: formatTimeAgo(comment.createdAt),
        replies: comment.replies.map((reply) => ({
          ...reply.toObject(),
          user: userMap[reply.user] || null,
          timeAgo: formatTimeAgo(reply.createdAt),
        })),
      })),
    }));

    const totalPosts = await Post.countDocuments({ author: doctor._id });
    const totalPages = Math.ceil(totalPosts / limit);

    res.status(200).json({
      success: true,
      posts: formattedPosts,
      page,
      totalPages,
      commentPage,
      commentLimit,
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// Like/Unlike a Post
exports.likePost = async (req, res) => {
  try {
    console.log(req.user);
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

//Like a comment
exports.likeComment = async (req, res) => {
  console.log("Reached", req.params.id);
  try {
    const comment = await Comment.findById(req.params.id);
    console.log(comment);
    if (!comment)
      return res
        .status(404)
        .json({ success: false, message: "Comment not found" });
    if (comment.likes.includes(req.user.id)) {
      comment.likes = comment.likes.filter(
        (id) => id.toString() !== req.user.id
      );
    } else {
      comment.likes.push(req.user.id);
    }

    await comment.save();
    res.status(200).json({ success: true, likes: comment.likes.length }); //Like count is returned
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
    let userType = "Doctor";
    if (!userId) {
      userId = await Patient.findOne({ phone });
      userType = "Patient";
    }

    if (!text.trim()) {
      return res
        .status(400)
        .json({ success: false, message: "Comment cannot be empty." });
    }

    // Create a new top-level comment
    const newComment = new Comment({
      user: userId,
      userType: userType,
      text,
      parentComment: null, // Top-level comment has no parent
    });

    // Save the comment first
    const savedComment = await newComment.save();

    // Add comment reference to the post
    post.comments.push(savedComment._id);
    await post.save();

    res.status(200).json({
      success: true,
      comment: savedComment,
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// Reply to an existing comment
exports.replyToComment = async (req, res) => {
  try {
    const { text } = req.body;
    // const { commentId } = req.params;

    // Find the parent comment
    const parentComment = await Comment.findById(req.params.id);
    if (!parentComment)
      return res
        .status(404)
        .json({ success: false, message: "Comment not found" });

    const phone = req.user.phone;
    let userId = await Doctor.findOne({ phone });
    let userType = "Doctor";
    if (!userId) {
      userId = await Patient.findOne({ phone });
      userType = "Patient";
    }

    if (!text.trim()) {
      return res
        .status(400)
        .json({ success: false, message: "Comment cannot be empty." });
    }

    // Create a new reply comment
    const newReply = new Comment({
      user: userId,
      userType,
      text,
      parentComment: parentComment._id, // Set parent reference
    });

    // Save the reply
    const savedReply = await newReply.save();

    // Add reply reference to parent comment
    parentComment.replies.push(savedReply._id);
    await parentComment.save();

    res.status(200).json({
      success: true,
      reply: savedReply,
    });
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
      post.edited = true;
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
    await Comment.deleteMany({ _id: { $in: post.comments } });
    return res
      .status(200)
      .json({ success: true, message: "Post deleted successfully" });
  } catch (error) {
    console.log({ success: false, error: error.message });
  }
};

exports.getPaginatedPosts = async (req, res) => {
  try {
    console.log("Getting paginated posts");
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const commentPage = parseInt(req.query.commentPage) || 1;
    const commentLimit = parseInt(req.query.commentLimit) || 5;
    const commentSkip = (commentPage - 1) * commentLimit;

    // Fetch posts
    const posts = await Post.find()
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate("author", "name profilePhoto")
      .populate({
        path: "comments",
        options: {
          sort: { createdAt: -1 },
          skip: commentSkip,
          limit: commentLimit,
        },
        populate: { path: "replies" },
      });

    // Collect all user IDs (from comments and replies)
    let userIds = new Set();
    posts.forEach((post) => {
      post.comments.forEach((comment) => {
        userIds.add(comment.user.toString());
        comment.replies.forEach((reply) => userIds.add(reply.user.toString()));
      });
    });

    // Fetch all users in a single query
    const users = await Promise.all([
      Doctor.find({ _id: { $in: [...userIds] } }).select(
        "_id name profilePhoto"
      ),
      Patient.find({ _id: { $in: [...userIds] } }).select(
        "_id name profilePhoto"
      ),
    ]);
    const allUsers = [...users[0], ...users[1]];

    // Create a user lookup map
    const userMap = {};
    allUsers.forEach((user) => {
      userMap[user._id] = {
        ...user.toObject(),
        userType: user instanceof Doctor ? "Doctor" : "Patient",
      };
    });

    // Format posts with user details and timeAgo
    const formattedPosts = posts.map((post) => ({
      ...post.toObject(),
      timeAgo: formatTimeAgo(post.createdAt),
      comments: post.comments.map((comment) => ({
        ...comment.toObject(),
        user: userMap[comment.user] || null, // Attach user details
        timeAgo: formatTimeAgo(comment.createdAt),
        replies: comment.replies.map((reply) => ({
          ...reply.toObject(),
          user: userMap[reply.user] || null,
          timeAgo: formatTimeAgo(reply.createdAt),
        })),
      })),
    }));

    const totalPosts = await Post.countDocuments();
    const totalPages = Math.ceil(totalPosts / limit);

    res.status(200).json({
      success: true,
      posts: formattedPosts,
      page,
      totalPages,
      commentPage,
      commentLimit,
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

//Updating comment text and marking as edited
exports.updateComment = async (req, res) => {
  try {
    const comment = await Comment.findById(req.params.id);
    if (!comment) {
      return res
        .status(404)
        .json({ success: false, message: "Comment not found" });
    }
    const phone = req.user.phone;
    let user =
      (await Doctor.findOne({ phone })) || (await Patient.findOne({ phone }));
    if (!user || comment.user.toString() !== user._id.toString()) {
      return res
        .status(403)
        .json({ success: false, message: "Unauthorized to edit the comment" });
    }
    if (req.body.text) {
      comment.text = req.body.text;
      comment.edited = true;
    }
    await comment.save();
    res.status(200).json({ success: true, comment });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};

//Handle multiple images upload with size/limit restriction - If video, only one video should be uploaded for a post
