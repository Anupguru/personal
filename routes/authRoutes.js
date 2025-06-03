const express = require('express');
const router = express.Router();
const { pool } = require('../config/db');
const {
  loginAdmin,
  loginTeacher
} = require('../controllers/authController');

const { 
  createStudent,
  getStudentsWithAttendance,
  markAttendance,
  deleteStudent
} = require('../models/userModel');

// Admin Login Routes
router.get('/adminLogin', (req, res) => {
  res.render('adminLogin');
});

router.post('/adminLogin', loginAdmin);

// Teacher Login Routes
router.get('/teacherLogin', (req, res) => {
  res.render('teacherLogin');
});

router.post('/teacherLogin', loginTeacher);

// Teacher Dashboard - show students with attendance
router.get('/teacherDashboard', async (req, res) => {
  // Check if user is logged in
  if (!req.session.user) {
    return res.redirect('/teacherLogin');
  }

  // Redirect to the new dashboard route
  res.redirect('/teacher/dashboard');
});

// POST: Add student
router.post('/teacher/addStudent', async (req, res) => {
  const { name, class: className, section } = req.body;
  try {
    const newStudent = await createStudent({ name, class: className, section });
    res.json(newStudent);
  } catch (err) {
    console.error('Error adding student:', err);
    res.status(500).json({ error: 'Failed to add student' });
  }
});

// POST: Delete student
router.post('/teacher/deleteStudent/:id', async (req, res) => {
  try {
    const { class: className, section } = req.body;
    await deleteStudent(req.params.id);
    res.redirect(`/teacherDashboard?class=${encodeURIComponent(className)}&section=${encodeURIComponent(section)}`);
  } catch (error) {
    console.error('Error deleting student:', error);
    res.status(500).send('Error deleting student');
  }
});

// Mark Attendance
router.post('/teacher/markStatus/:id', async (req, res) => {
  const studentId = req.params.id;
  const { status, attendanceDate, class: studentClass, section } = req.body;

  try {
    // Ensure we have a valid date
    if (!attendanceDate) {
      return res.redirect(`/teacherDashboard?class=${encodeURIComponent(studentClass)}&section=${encodeURIComponent(section)}&error=Date is required`);
    }

    // Format the date to ensure proper PostgreSQL date format
    const formattedDate = new Date(attendanceDate).toISOString().split('T')[0];

    await markAttendance(studentId, formattedDate, status);
    
    // Redirect back to the dashboard with the same filters
    res.redirect(`/teacherDashboard?class=${encodeURIComponent(studentClass)}&section=${encodeURIComponent(section)}&attendanceDate=${encodeURIComponent(formattedDate)}`);
  } catch (error) {
    console.error('Error updating attendance:', error);
    res.redirect(`/teacherDashboard?class=${encodeURIComponent(studentClass)}&section=${encodeURIComponent(section)}&attendanceDate=${encodeURIComponent(attendanceDate)}&error=Failed to update attendance`);
  }
});

module.exports = router;
