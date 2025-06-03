require('dotenv').config();
const bcrypt = require('bcrypt');
const { findUserByEmail } = require('../models/userModel');

const loginAdmin = async (req, res) => {
  const { username, password } = req.body;

  const ADMIN_USERNAME = process.env.ADMIN_USERNAME;
  const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

  if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
    // Set both admin flag and user info in session
    req.session.isAdmin = true;
    req.session.user = {
      username: ADMIN_USERNAME,
      isAdmin: true
    };
    
    // Save session before redirecting
    req.session.save((err) => {
      if (err) {
        console.error('Session save error:', err);
        return res.status(500).send('Error saving session');
      }
      return res.redirect('/admin/dashboard');
    });
  } else {
    return res.status(401).send('Invalid admin credentials');
  }
};

const loginTeacher = async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await findUserByEmail(email);
    console.log('Found user:', user); // Debug log

    if (!user) {
      console.log('No user found with email:', email); // Debug log
      return res.status(401).send('Invalid credentials (email not found)');
    }

    const isMatch = await bcrypt.compare(password, user.password);
    console.log('Password match:', isMatch); // Debug log

    if (!isMatch) {
      return res.status(401).send('Invalid credentials (wrong password)');
    }

    // Store user info in session
    req.session.user = {
      id: user.id,
      username: user.username,
      email: user.email,
      title: user.title || 'Mr/Ms'
    };

    // Save session before redirecting
    req.session.save((err) => {
      if (err) {
        console.error('Session save error:', err);
        return res.status(500).send('Error saving session');
      }
      res.redirect('/teacher/dashboard');
    });
  } catch (error) {
    console.error('Teacher login error:', error);
    res.status(500).send('Login error: ' + error.message);
  }
};

// Logout handler
const logout = (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error('Logout error:', err);
      return res.status(500).send('Error logging out');
    }
    res.redirect('/');
  });
};

module.exports = {
  loginAdmin,
  loginTeacher,
  logout
};
