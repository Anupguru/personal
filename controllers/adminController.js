const pool = require('../config/db'); 
const { createUser, deleteUserByUsername } = require('../models/userModel');

const renderAdminDashboard = async (req, res) => {
  try {
    const usersResult = await pool.query('SELECT username, email FROM users ORDER BY username');
    const users = usersResult.rows;
    res.render('adminDashboard', { users });
  } catch (error) {
    console.error('🔥 Error loading dashboard:', error.message);
    res.status(500).send('Error loading dashboard');
  }
};

const handleAddUser = async (req, res) => {
  const { username, email, password } = req.body;
  try {
    const userCheck = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
    if (userCheck.rows.length > 0) {
      return res.status(400).send('Username already exists. Please choose another one.');
    }
    const newUser = await createUser({ username, email, password });
    console.log('User added:', newUser);
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
