const express = require("express");
const {
  createPost,
  getPosts,
  likePost,
  commentPost,
  updatePost,
  deletePost,
  getPaginatedPosts,
  replyToComment,
  likeComment,
  updateComment,
} = require("../controllers/postController");
const { upload, handleMulterError } = require('../middlewares/uploadMiddleware');
const validateToken = require("../middlewares/validateTokenHandler");

const router = express.Router();

router.post(
  '/', 
  validateToken,
  upload.single('file'), 
  handleMulterError,
  createPost
);


router.get("/", validateToken, getPosts);
router.post("/:id/like", validateToken, likePost);
router.post("/:id/comment", validateToken, commentPost);
router.post("/:id/reply", validateToken, replyToComment);
router.put("/:id", validateToken, updatePost);
router.delete("/:id", validateToken, deletePost);
router.get("/homePosts", validateToken, getPaginatedPosts);
router.post("/:id/likeComment", validateToken, likeComment);
router.put("/:id/updateComment", validateToken, updateComment);

module.exports = router;
