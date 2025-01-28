// routes/leaveRoutes.js
const express = require('express');
const {
  requestLeave,
  getMyLeaveRequests,
  getPendingLeaveRequests,
  approveLeave,
  rejectLeave,
  setLeaveSettings,
  getLeaveBalance,
  getLeaveSettings,
  addLeave,
  getLeaves,
} = require('../controllers/leaveController');
const validateToken = require("../middlewares/validateTokenHandler");
const router = express.Router();

// Assistant doctor submits a leave request
router.post('/request', validateToken, requestLeave);

// Assistant doctor views their own leave requests
router.get('/my-requests', validateToken, getMyLeaveRequests);

// Admin-doctor views all pending leave requests
router.get('/pending', validateToken, getPendingLeaveRequests);

// Admin-doctor approves a leave request
router.put('/approve/:id', validateToken, approveLeave);

// Admin-doctor rejects a leave request
router.put('/reject/:id', validateToken, rejectLeave);

// Admin-Doctor route to configure leave entitlements
router.post('/set-leave-settings', validateToken, setLeaveSettings);

router.get('/get-leave-settings', validateToken, getLeaveSettings);

// Assistant-Doctor route to fetch leave balance
router.get('/leave-balance', validateToken, getLeaveBalance);
router.post("/add", addLeave);

router.get("/all",getLeaves);

module.exports = router;
