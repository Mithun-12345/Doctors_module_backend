const express = require("express");

const router = express.Router();
const validateToken = require('../middlewares/validateTokenHandler');

const {sendNotification} = require("../controllers/pushNotfication");

router.post("/sendNotification",validateToken,sendNotification);

module.exports = router;