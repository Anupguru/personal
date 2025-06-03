// routes/adminRoutes.js
const express = require('express');
const router = express.Router();
const { pool } = require('../config/db');
const bcrypt = require('bcrypt');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;
const path = require('path');
const fs = require('fs');

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir);
}

// Middleware to check if user is admin
const requireAdmin = (req, res, next) => {
  if (!req.session.isAdmin) {
    return res.redirect('/adminLogin');
  }
  next();
};

// Admin Dashboard
router.get('/dashboard', requireAdmin, async (req, res) => {
  try {
    // Get query parameters
    const { class: className, section, attendanceDate, tab } = req.query;
    
    // Get all users
    const result = await pool.query('SELECT username, email FROM users ORDER BY username');
    
    // Get attendance records if class and section are selected
    let attendance = [];
    if (className && section) {
      const attendanceQuery = `
        SELECT 
          s.id as student_id,
          s.name as student_name,
          s.class,
          s.section,
          COALESCE(a.status, 'Not Marked') as status,
          COALESCE(a.date, $3::date) as date
        FROM students s
        LEFT JOIN attendance a ON s.id = a.student_id 
          AND DATE(a.date) = $3::date
        WHERE s.class = $1 AND s.section = $2
        ORDER BY s.name
      `;
      
      const attendanceResult = await pool.query(attendanceQuery, [className, section, attendanceDate || new Date().toISOString().split('T')[0]]);
      attendance = attendanceResult.rows;
    }
    
    res.render('adminDashboard', { 
      users: result.rows,
      attendance,
      selectedClass: className || '',
      selectedSection: section || '',
      selectedDate: attendanceDate || '',
      selectedTab: tab || 'teachers'
    });
  } catch (err) {
    console.error('Error loading dashboard:', err);
    res.status(500).send('Error loading dashboard: ' + err.message);
  }
});

// Download students list as CSV
router.get('/downloadStudents', requireAdmin, async (req, res) => {
  try {
    const { class: className, section } = req.query;
    
    if (!className || !section) {
      return res.status(400).send('Class and section are required');
    }

    const result = await pool.query(
      'SELECT * FROM students WHERE class = $1 AND section = $2 ORDER BY name',
      [className, section]
    );

    if (result.rows.length === 0) {
      return res.status(404).send('No students found for the specified class and section');
    }

    const fileName = `students_${className.replace(/\s+/g, '_')}_${section}_${Date.now()}.csv`;
    const filePath = path.join(uploadsDir, fileName);

    const csvWriter = createCsvWriter({
      path: filePath,
      header: [
        { id: 'id', title: 'ID' },
        { id: 'name', title: 'Student Name' },
        { id: 'class', title: 'Class' },
        { id: 'section', title: 'Section' }
      ]
    });

    await csvWriter.writeRecords(result.rows);

    res.download(filePath, fileName, (err) => {
      if (err) {
        console.error('Error downloading file:', err);
      }
      // Delete the file after sending
      fs.unlink(filePath, (unlinkErr) => {
        if (unlinkErr) {
          console.error('Error deleting temporary file:', unlinkErr);
        }
      });
    });
  } catch (err) {
    console.error('Error generating CSV:', err);
    res.status(500).send('Error generating CSV: ' + err.message);
  }
});

// Get students list
router.get('/students', requireAdmin, async (req, res) => {
  try {
    const { class: className, section } = req.query;
    const result = await pool.query('SELECT * FROM users');
    let students = [];
    
    if (className && section) {
      const studentsResult = await pool.query(
        'SELECT * FROM students WHERE class = $1 AND section = $2 ORDER BY name',
        [className, section]
      );
      students = studentsResult.rows;
    }

    res.render('adminDashboard', {
      users: result.rows,
      students,
      attendanceRecords: [], // Add this to keep attendance tab active
      selectedClass: className || '',
      selectedSection: section || '',
      selectedDate: ''
    });
  } catch (err) {
    console.error('Error loading students:', err);
    res.status(500).send('Error loading students: ' + err.message);
  }
});

// Add new student
router.post('/addStudent', requireAdmin, async (req, res) => {
  try {
    const { name, class: className, section } = req.body;
    
    await pool.query(
      'INSERT INTO students (name, class, section) VALUES ($1, $2, $3)',
      [name, className, section]
    );
    
    // Fetch the updated student list
    const studentsResult = await pool.query(
      'SELECT * FROM students WHERE class = $1 AND section = $2 ORDER BY name',
      [className, section]
    );
    
    const result = await pool.query('SELECT * FROM users');
    
    res.render('adminDashboard', {
      users: result.rows,
      students: studentsResult.rows,
      attendanceRecords: [], // Add this to keep attendance tab active
      selectedClass: className || '',
      selectedSection: section || '',
      selectedDate: new Date().toISOString().split('T')[0]
    });
  } catch (err) {
    console.error('Error adding student:', err);
    res.status(500).send('Error adding student: ' + err.message);
  }
});

// Delete student
router.post('/deleteStudent', requireAdmin, async (req, res) => {
  try {
    const { studentId, tab, class: className, section, attendanceDate } = req.body;
    
    // Delete the student
    await pool.query('DELETE FROM students WHERE id = $1', [studentId]);
    
    // Redirect back to the appropriate tab with parameters
    if (tab === 'attendance') {
      res.redirect(`/admin/dashboard?tab=attendance&class=${className}&section=${section}&attendanceDate=${attendanceDate}`);
    } else {
      res.redirect('/admin/dashboard?tab=teachers');
    }
  } catch (err) {
    console.error('Error deleting student:', err);
    res.status(500).send('Error deleting student: ' + err.message);
  }
});

// Get attendance records
router.get('/attendance', requireAdmin, async (req, res) => {
  try {
    const { class: className, section, date } = req.query;
    let query = `
      SELECT 
        a.id,
        s.name as student_name,
        s.class,
        s.section,
        a.date,
        a.status
      FROM attendance a
      JOIN students s ON a.student_id = s.id
      WHERE 1=1
    `;
    const queryParams = [];
    let paramCount = 1;

    if (className) {
      query += ` AND s.class = $${paramCount}`;
      queryParams.push(className);
      paramCount++;
    }
    if (section) {
      query += ` AND s.section = $${paramCount}`;
      queryParams.push(section);
      paramCount++;
    }
    if (date) {
      query += ` AND DATE(a.date) = $${paramCount}`;
      queryParams.push(date);
    }

    query += ' ORDER BY a.date DESC, s.name ASC';

    const result = await pool.query('SELECT * FROM users');
    const attendanceResult = await pool.query(query, queryParams);

    res.render('adminDashboard', {
      users: result.rows,
      attendanceRecords: attendanceResult.rows,
      selectedClass: className || '',
      selectedSection: section || '',
      selectedDate: date || ''
    });
  } catch (err) {
    console.error('Error loading attendance records:', err);
    res.status(500).send('Error loading attendance records: ' + err.message);
  }
});

// Add new user
router.post('/addUser', requireAdmin, async (req, res) => {
  try {
    const { username, email, password, title } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);
    
    await pool.query(
      'INSERT INTO users (username, email, password, title) VALUES ($1, $2, $3, $4)',
      [username, email, hashedPassword, title]
    );
    
    res.redirect('/admin/dashboard?tab=teachers');
  } catch (err) {
    console.error('Error adding user:', err);
    res.status(500).send('Error adding user: ' + err.message);
  }
});

// Delete user
router.post('/deleteUser', requireAdmin, async (req, res) => {
  try {
    const { username } = req.body;
    await pool.query('DELETE FROM users WHERE username = $1', [username]);
    res.redirect('/admin/dashboard?tab=teachers');
  } catch (err) {
    console.error('Error deleting user:', err);
    res.status(500).send('Error deleting user: ' + err.message);
  }
});

// Download attendance as CSV
router.get('/downloadAttendance', requireAdmin, async (req, res) => {
  try {
    const { class: className, section, date } = req.query;
    
    if (!className || !section || !date) {
      return res.status(400).send('Class, section, and date are required');
    }

    // Query to get attendance records with student names
    const query = `
      SELECT 
        s.name as student_name,
        s.class,
        s.section,
        a.status,
        a.date
      FROM students s
      LEFT JOIN attendance a ON s.id = a.student_id AND DATE(a.date) = $3
      WHERE s.class = $1 AND s.section = $2
      ORDER BY s.name
    `;

    const result = await pool.query(query, [className, section, date]);

    if (result.rows.length === 0) {
      return res.status(404).send('No attendance records found for the specified criteria');
    }

    const fileName = `attendance_class${className}_${section}_${date}.csv`;
    const filePath = path.join(uploadsDir, fileName);

    const csvWriter = createCsvWriter({
      path: filePath,
      header: [
        { id: 'student_name', title: 'Student Name' },
        { id: 'class', title: 'Class' },
        { id: 'section', title: 'Section' },
        { id: 'status', title: 'Attendance Status' },
        { id: 'date', title: 'Date' }
      ]
    });

    // Format the date in each record
    const formattedRecords = result.rows.map(record => ({
      ...record,
      status: record.status || 'Not Marked',
      date: new Date(record.date).toLocaleDateString()
    }));

    await csvWriter.writeRecords(formattedRecords);

    res.download(filePath, fileName, (err) => {
      if (err) {
        console.error('Error downloading file:', err);
      }
      // Delete the file after sending
      fs.unlink(filePath, (unlinkErr) => {
        if (unlinkErr) {
          console.error('Error deleting temporary file:', unlinkErr);
        }
      });
    });
  } catch (err) {
    console.error('Error generating attendance CSV:', err);
    res.status(500).send('Error generating attendance CSV: ' + err.message);
  }
});

module.exports = router;
