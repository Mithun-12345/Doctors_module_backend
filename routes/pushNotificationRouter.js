const express = require("express");

const router = express.Router();
const validateToken = require('../middlewares/validateTokenHandler');

const {sendNotification,sendToken} = require("../controllers/pushNotification");

router.post("/sendNotification",validateToken,sendNotification);
router.post("/sendToken",validateToken,sendToken);


module.exports = router;