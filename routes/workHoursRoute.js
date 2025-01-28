const express = require('express');
const workHoursController = require('../controllers/workHoursController');
const validateToken = require("../middlewares/validateTokenHandler");

const router = express.Router();

router.post('/check-in', validateToken, workHoursController.checkIn);
router.post('/check-out', validateToken, workHoursController.checkOut);
// router.post('/auto-logout', validateToken, workHoursController.autoLogoutHandler);

router.post('/start-break',validateToken, workHoursController.startBreak); // Start a break
router.post('/end-break', validateToken,workHoursController.endBreak); // End a break
module.exports = router;
