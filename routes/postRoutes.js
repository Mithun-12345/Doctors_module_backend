const express = require("express");
const postController = require("../controllers/postController");
const validateToken = require("../middlewares/validateTokenHandler");

const router = express.Router();

router.post("/createPost", validateToken, postController.createPost);
router.get("/showPost", validateToken, postController.showPost);
router.get("/showSinglePost/:id", validateToken, postController.showSinglePost);
router.delete("/deletePost/:id", validateToken, postController.deletePost);
router.patch(
  "/updatePost/:id",
  validateToken,
  postController.updatePostContent
);
router.post("/addComment/:id", validateToken, postController.addComment);
router.post("/toggleLike/:id", validateToken, postController.toggleLike);

module.exports = router;
