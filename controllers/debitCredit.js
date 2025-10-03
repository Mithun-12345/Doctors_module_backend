const DebitCreditNote = require('../models/debitCredit');

/**
 * @desc    Create a new Debit/Credit Note
 * @route   POST /api/notes
 * @access  Private
 */
exports.createNote = async (req, res) => {
    try {
        // Assuming req.user.id is available from an authentication middleware
        const createdBy = req.user.id;

        // Check if a note with the same noteId already exists
        const existingNote = await DebitCreditNote.findOne({ noteId: req.body.noteId });
        if (existingNote) {
            return res.status(409).json({ message: `Note with ID '${req.body.noteId}' already exists.` });
        }

        const newNote = new DebitCreditNote({
            ...req.body,
            createdBy
        });

        const savedNote = await newNote.save();
        res.status(201).json(savedNote);

    } catch (error) {
        // Handle validation errors or other issues
        console.error("Error creating note:", error);
        if (error.name === 'ValidationError') {
            return res.status(400).json({ message: "Validation Error", details: error.message });
        }
        res.status(500).json({ message: "Server error while creating the note." });
    }
};

/**
 * @desc    Update an existing Debit/Credit Note
 * @route   PATCH /api/notes/:id
 * @access  Private
 */
exports.updateNote = async (req, res) => {
    try {
        const { id } = req.params;
        const updates = req.body;

        // Prevent critical fields from being updated via this endpoint
        if (updates.noteId || updates.createdBy) {
            return res.status(400).json({ message: "Cannot update Note ID or creator." });
        }
        
        const updatedNote = await DebitCreditNote.findByIdAndUpdate(
            id,
            updates,
            { 
                new: true, // Return the modified document
                runValidators: true // Re-run schema validations on update
            }
        );

        if (!updatedNote) {
            return res.status(404).json({ message: "Note not found." });
        }

        res.status(200).json(updatedNote);

    } catch (error) {
        console.error("Error updating note:", error);
        if (error.name === 'ValidationError') {
            return res.status(400).json({ message: "Validation Error", details: error.message });
        }
        res.status(500).json({ message: "Server error while updating the note." });
    }
};

/**
 * @desc    Delete a Debit/Credit Note
 * @route   DELETE /api/notes/:id
 * @access  Private
 */
exports.deleteNote = async (req, res) => {
    try {
        const { id } = req.params;

        const deletedNote = await DebitCreditNote.findByIdAndDelete(id);

        if (!deletedNote) {
            return res.status(404).json({ message: "Note not found." });
        }

        res.status(200).json({ message: "Note deleted successfully." });

    } catch (error) {
        console.error("Error deleting note:", error);
        res.status(500).json({ message: "Server error while deleting the note." });
    }
};
// ... (keep the existing createNote, updateNote, deleteNote functions)

/**
 * @desc    Get all Debit/Credit Notes
 * @route   GET /api/notes
 * @access  Private
 */
// This controller is now correct and will work!
exports.getAllNotes = async (req, res) => {
    try {
        const notes = await DebitCreditNote.find({})
            .populate('createdBy', 'name email') // This will now correctly populate from the 'Doctor' collection
            .sort({ createdAt: -1 });

        res.status(200).json(notes);

    } catch (error) {
        console.error("Error fetching notes:", error);
        res.status(500).json({ message: "Server error while fetching notes." });
    }
};