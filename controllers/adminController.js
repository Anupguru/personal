const { User, createUser, deleteUserByUsername } = require('../models/userModel'); // Import User model

const renderAdminDashboard = async (req, res) => {
  try {
    const users = await User.findAll({
      attributes: ['username', 'email', 'title'], // Added title
      order: [['username', 'ASC']]
    });
    res.render('adminDashboard', { users });
  } catch (error) {
    console.error('🔥 Error loading dashboard:', error.message);
    res.status(500).send('Error loading dashboard');
  }
};

const handleAddUser = async (req, res) => {
  const { username, email, password, title } = req.body; // Added title
  try {
    const existingUser = await User.findOne({ where: { username } });
    if (existingUser) {
      return res.status(400).send('Username already exists. Please choose another one.');
    }
    // createUser from userModel now uses User.create and handles hashing
    const newUser = await createUser({ username, email, password, title });
    console.log('User added:', newUser.toJSON()); // Use .toJSON() for plain object if needed
    res.redirect('/admin/dashboard');
  } catch (err) {
    console.error('Error creating user:', err.message);
    res.status(500).send(`Error creating user: ${err.message}`);
  }
};

const handleDeleteUser = async (req, res) => {
  const { username } = req.body;
  try {
    const deletedCount = await deleteUserByUsername(username);
    if (deletedCount === 0) {
      return res.status(404).send('User not found');
    }
    res.redirect('/admin/dashboard');
  } catch (err) {
    console.error('Error deleting user:', err.message);
    res.status(500).send(`Error deleting user: ${err.message}`);
  }
};

module.exports = { renderAdminDashboard, handleAddUser, handleDeleteUser };
