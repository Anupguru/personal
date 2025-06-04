// routes/userRoutes.js
const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');

// Create new user
router.post('/register', userController.registerUser);

// Get all users
router.get('/', userController.getUsers);

// Get user by email
router.get('/:email', userController.getUserByEmail);

// Update user title
router.put('/:id/title', userController.updateTitle);

// Delete user by username
router.delete('/:username', userController.deleteUser);

module.exports = router;
