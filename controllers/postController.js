const Post = require("../models/postModel");
const Doctor = require("../models/doctorModel");
const Patient = require("../models/patientModel");
const { getIo } = require("./socketController");

exports.createPost = async (req, res, next) => {
  const { content } = req.body;
  try {
    const phone = req.user.phone;
    const doctor = await Doctor.findOne({ phone });
    if (!doctor) {
      res.status(404).json({ message: "Doctor not found!" });
    }
    const doctorId = doctor._id;
    const post = await Post.create({
      doctorId,
      content,
    });

    // // Emit a 'newPost' event to all connected clients
    // io.emit("newPost", post);

    res.status(201).json({
      success: true,
      post,
    });
  } catch (error) {
    console.log(error);
    next(error);
  }
};

//show all post for doctor logged in
exports.showPost = async (req, res, next) => {
  try {
    const phone = req.user.phone;
    const doctor = await Doctor.findOne({ phone });
    if (!doctor) {
      res.status(404).json({ message: "Doctor not found!" });
    }
    const doctorId = doctor._id;
    const posts = await Post.find({ doctorId });
    res.status(201).json({
      success: true,
      posts,
    });
  } catch (error) {
    next(error);
  }
};

//show single post
exports.showSinglePost = async (req, res, next) => {
  try {
    const post = await Post.findById(req.params.id);
    res.status(200).json({
      success: true,
      post,
    });
  } catch (error) {
    next(error);
  }
};

//delete post
exports.deletePost = async (req, res, next) => {
  try {
    //Ensure if the user is a doctor to delete the post
    const phone = req.user.phone;
    const doctor = await Doctor.findOne({ phone });
    if (!doctor) {
      res.status(404).json({ message: "Doctor not found!" });
    }
    const post = await Post.findByIdAndDelete(req.params.id);
    res.status(200).json({
      success: true,
      message: "post deleted",
    });
  } catch (error) {
    next(error);
  }
};

//update post
exports.updatePostContent = async (req, res, next) => {
  try {
    //Ensure if the user is a doctor to update the post
    const phone = req.user.phone;
    const doctor = await Doctor.findOne({ phone });
    if (!doctor) {
      res.status(404).json({ message: "Doctor not found!" });
    }
    const postId = req.params.id;
    const { content } = req.body;

    // Find the post by ID and update the content field
    const post = await Post.findByIdAndUpdate(
      postId,
      { content }, // update the content
      { new: true, runValidators: true } // return the updated document and run validation
    );

    if (!post) {
      return res.status(404).json({
        success: false,
        message: "Post not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Post updated successfully",
      post,
    });
  } catch (error) {
    next(error);
  }
};

//add comment
exports.addComment = async (req, res, next) => {
  let userId;
  try {
    const postId = req.params.id;
    const { comment } = req.body;
    const patient = await Patient.findOne({ phone: req.user.phone });
    const doctor = await Doctor.findOne({ phone: req.user.phone });
    if (patient) {
      userId = patient._id;
    } else {
      userId = doctor._id;
    }
    console.log(userId);

    const post = await Post.findById(postId);

    if (!post) {
      return res.status(404).json({
        success: false,
        message: "Post not found",
      });
    }

    const newComment = {
      userId,
      comment,
      date: Date.now(),
    };

    post.comments.push(newComment);
    await post.save();

    const io = getIo(); // Get the io instance
    io.emit("new-comment", { comment }); // Emit the new comment event

    res.status(200).json({
      success: true,
      message: "Comment added successfully",
      post,
    });
  } catch (error) {
    next(error);
  }
};

//add like
exports.toggleLike = async (req, res, next) => {
  try {
    let userId;
    // Fetch the patient based on the logged-in user's phone number
    const patient = await Patient.findOne({ phone: req.user.phone });
    const doctor = await Doctor.findOne({ phone: req.user.phone });
    if (patient) {
      userId = patient._id;
    } else {
      userId = doctor._id;
    }
    console.log(userId);

    const postId = req.params.id;

    // Find the post using the provided postId
    const post = await Post.findById(postId);

    // Check if the post exists
    if (!post) {
      return res.status(404).json({
        success: false,
        message: "Post not found",
      });
    }

    // Check if the post is already liked by the patient
    const alreadyLiked = post.likes.includes(userId);

    // If already liked, remove the like (filter it out of the array)
    if (alreadyLiked) {
      post.likes = post.likes.filter(
        (likeId) => likeId.toString() !== userId.toString()
      );
    } else {
      // If not liked, add the like (push the patient's ID into the array)
      post.likes.push(userId);
    }

    // Save the post to reflect the changes
    await post.save();

     // Emit the event to all connected clients with the updated post data
     const io = getIo();
     io.emit('post-liked', {
       postId: post._id,
       likesCount: post.likes.length,
       likedBy: userId,
     });

    // Return success response with updated post and like count
    return res.status(200).json({
      success: true,
      message: alreadyLiked
        ? "Like removed successfully"
        : "Post liked successfully",
      post,
      likesCount: post.likes.length, // return the count of likes
    });
  } catch (error) {
    // Handle errors
    next(error);
  }
};
