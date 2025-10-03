const express = require('express');
const router = express.Router();
const { createNote, updateNote, deleteNote,getAllNotes } = require('../controllers/debitCredit');
const validateToken = require('../middlewares/validateTokenHandler');
const mongoose = require('mongoose');


// You should protect these routes with an authentication middleware
// const { protect } = require('../middleware/authMiddleware');

// Example: router.use(protect);

// POST /api/notes -> Create a new note
router.post('/create',validateToken, createNote);

// PATCH /api/notes/:id -> Update a note by its MongoDB document ID (_id)
router.patch('/modify/:id',validateToken, updateNote);

// DELETE /api/notes/:id -> Delete a note by its MongoDB document ID (_id)
router.delete('/delete/:id',validateToken, deleteNote);

router.get('/allNotes',validateToken,getAllNotes)

module.exports = router;