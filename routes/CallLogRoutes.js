const router = require('express').Router();
const express = require('express');
const validateToken = require("../middlewares/validateTokenHandler");

const {
    sendMessage,
    sendFirstFormMessage,
    verifyAppointmentbooking,
    getFollowUpStatus,
    incrementCallCount,
    updateEnquiryStatus,
    login,
    getPatientStats,
    listPatients,
    patientProfile,
    updateComment,
    updateDiseaseType,
    commentController,
    registerAdmin
} = require('../controllers/CallLogController');

router.post('/send-message/:id', sendMessage);
router.post('/send-first-message', sendFirstFormMessage);
router.get('/check/:userId', verifyAppointmentbooking);
router.get('/follow-up/:patientId', getFollowUpStatus);
router.post('/increment-call-count/:patientId', incrementCallCount);
router.put('/update-status/:patientId', updateEnquiryStatus);
router.post('/login', login);
router.get('/dashboard', getPatientStats);
router.get('/list', listPatients);
router.get('/patientProfile/:id', patientProfile);

router.put('/update-comment/:patientId', updateComment);
router.put("/update-disease-type/:patientId", validateToken, updateDiseaseType);
router.post('/comments/:patientId', commentController);
// router.post("/twiml", getTwimlResponse);
// router.post("/make-call", makeCall);
router.post('/register', registerAdmin);

module.exports = router;