// routes/adminRoutes.js
const express = require('express');
const router = express.Router();
const { User, Student, Attendance, createUser, deleteUserByUsername, createStudent, deleteStudent, getStudentsWithAttendance, getStudentsByClassAndSection } = require('../models/userModel');
const { Op } = require('sequelize'); // Import Op for complex queries
const createCsvWriter = require('csv-writer').createObjectCsvWriter;
const path = require('path');
const fs = require('fs');

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
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
    const { class: className, section, attendanceDate, tab } = req.query;
    const effectiveDate = attendanceDate || new Date().toISOString().split('T')[0];

    const users = await User.findAll({
      attributes: ['id', 'username', 'email', 'title'],
      order: [['username', 'ASC']]
    });

    let attendanceRecords = [];
    if (className && section) {
      // Use the refactored model function
      attendanceRecords = await getStudentsWithAttendance(className, section, effectiveDate);
    }

    res.render('adminDashboard', {
      users: users.map(u => u.toJSON()), // Pass plain objects to template
      attendance: attendanceRecords, // Already plain objects from getStudentsWithAttendance
      selectedClass: className || '',
      selectedSection: section || '',
      selectedDate: effectiveDate,
      selectedTab: tab || 'teachers' // Default to 'teachers' tab
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

    const students = await getStudentsByClassAndSection(className, section);

    if (students.length === 0) {
      return res.status(404).send('No students found for the specified class and section');
    }

    const fileName = `students_${className.replace(/\s+/g, '_')}_${section}_${Date.now()}.csv`;
    const filePath = path.join(uploadsDir, fileName);

    const csvWriterInstance = createCsvWriter({
      path: filePath,
      header: [
        { id: 'id', title: 'ID' },
        { id: 'name', title: 'Student Name' },
        { id: 'class', title: 'Class' },
        { id: 'section', title: 'Section' }
      ]
    });

    await csvWriterInstance.writeRecords(students.map(s => s.toJSON()));

    res.download(filePath, fileName, (err) => {
      if (err) {
        console.error('Error downloading file:', err);
      }
      fs.unlink(filePath, (unlinkErr) => {
        if (unlinkErr) console.error('Error deleting temporary file:', unlinkErr);
      });
    });
  } catch (err) {
    console.error('Error generating CSV:', err);
    res.status(500).send('Error generating CSV: ' + err.message);
  }
});

// Get students list (for student management tab)
router.get('/students', requireAdmin, async (req, res) => {
  try {
    const { class: className, section } = req.query;
    
    const users = await User.findAll({
        attributes: ['id', 'username', 'email', 'title'],
        order: [['username', 'ASC']]
    });
    let students = [];

    if (className && section) {
      students = await getStudentsByClassAndSection(className, section);
    }

    res.render('adminDashboard', {
      users: users.map(u => u.toJSON()),
      students: students.map(s => s.toJSON()),
      attendance: [], // For attendance tab, keep it consistent
      selectedClass: className || '',
      selectedSection: section || '',
      selectedDate: '', // No date context here
      selectedTab: 'students' // Explicitly set tab
    });
  } catch (err) {
    console.error('Error loading students page:', err);
    res.status(500).send('Error loading students page: ' + err.message);
  }
});


// Add new student
router.post('/addStudent', requireAdmin, async (req, res) => {
  try {
    const { name, class: className, section } = req.body;
    await createStudent({ name, class: className, section });
    res.redirect(`/admin/dashboard?tab=students&class=${encodeURIComponent(className)}&section=${encodeURIComponent(section)}`);
  } catch (err) {
    console.error('Error adding student:', err);
    res.status(500).send('Error adding student: ' + err.message);
  }
});

// Delete student
router.post('/deleteStudent', requireAdmin, async (req, res) => {
  try {
    const { studentId, tab, class: className, section, attendanceDate } = req.body;
    await deleteStudent(studentId); // This now uses Sequelize and handles cascade via DB or model association

    let redirectUrl = '/admin/dashboard?tab=teachers'; // Default redirect
    if (tab === 'attendance' && className && section && attendanceDate) {
      redirectUrl = `/admin/dashboard?tab=attendance&class=${encodeURIComponent(className)}&section=${encodeURIComponent(section)}&attendanceDate=${encodeURIComponent(attendanceDate)}`;
    } else if (tab === 'students' && className && section) {
      redirectUrl = `/admin/dashboard?tab=students&class=${encodeURIComponent(className)}&section=${encodeURIComponent(section)}`;
    }
    res.redirect(redirectUrl);
  } catch (err) {
    console.error('Error deleting student:', err);
    res.status(500).send('Error deleting student: ' + err.message);
  }
});

// Get attendance records (for detailed attendance view/management if different from dashboard)
router.get('/attendance', requireAdmin, async (req, res) => {
  try {
    const { class: className, section, date } = req.query;
    
    const users = await User.findAll({
        attributes: ['id', 'username', 'email', 'title'],
        order: [['username', 'ASC']]
    });
    let attendanceDetailRecords = [];

    if (className && section && date) {
      attendanceDetailRecords = await Attendance.findAll({
        include: [{
          model: Student,
          as: 'student',
          where: { class: className, section: section },
          attributes: ['name', 'class', 'section']
        }],
        where: { date: date },
        order: [['date', 'DESC'], [{ model: Student, as: 'student' }, 'name', 'ASC']],
        attributes: ['id', 'date', 'status', 'student_id']
      });
    } else if (className && section) { // All dates for a class/section
        attendanceDetailRecords = await Attendance.findAll({
            include: [{
              model: Student,
              as: 'student',
              where: { class: className, section: section },
              attributes: ['name', 'class', 'section']
            }],
            order: [['date', 'DESC'], [{ model: Student, as: 'student' }, 'name', 'ASC']],
            attributes: ['id', 'date', 'status', 'student_id']
          });
    }


    res.render('adminDashboard', {
      users: users.map(u => u.toJSON()),
      attendance: attendanceDetailRecords.map(ar => { // Use 'attendance' to match template if it expects that
          const plainAR = ar.toJSON();
          return {
              id: plainAR.id,
              student_name: plainAR.student.name,
              class: plainAR.student.class,
              section: plainAR.student.section,
              date: plainAR.date,
              status: plainAR.status,
              student_id: plainAR.student_id
          };
      }),
      selectedClass: className || '',
      selectedSection: section || '',
      selectedDate: date || '',
      selectedTab: 'attendance' // Explicitly set tab
    });
  } catch (err) {
    console.error('Error loading attendance records:', err);
    res.status(500).send('Error loading attendance records: ' + err.message);
  }
});

// Add new user (teacher/staff)
router.post('/addUser', requireAdmin, async (req, res) => {
  try {
    const { username, email, password, title } = req.body;
    // Password hashing is handled by User model's beforeCreate hook
    await createUser({ username, email, password, title });
    res.redirect('/admin/dashboard?tab=teachers');
  } catch (err) {
    console.error('Error adding user:', err);
    // Check for SequelizeUniqueConstraintError
    if (err.name === 'SequelizeUniqueConstraintError') {
        return res.status(400).send(`Error adding user: ${err.errors.map(e => e.message).join(', ')}`);
    }
    res.status(500).send('Error adding user: ' + err.message);
  }
});

// Delete user (teacher/staff)
router.post('/deleteUser', requireAdmin, async (req, res) => {
  try {
    const { username } = req.body; // Assuming username is unique for deletion target
    const result = await deleteUserByUsername(username);
    if (result === 0) {
        // Optionally, send a message back if user not found, or just redirect
        console.log(`Attempted to delete non-existent user: ${username}`);
    }
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
      return res.status(400).send('Class, section, and date are required for attendance download.');
    }

    // Use getStudentsWithAttendance which is designed for this kind of report
    const attendanceReportData = await getStudentsWithAttendance(className, section, date);

    if (attendanceReportData.length === 0) {
      return res.status(404).send('No attendance records found for the specified criteria');
    }

    const fileName = `attendance_${className.replace(/\s+/g, '_')}_${section}_${date.replace(/-/g, '')}_${Date.now()}.csv`;
    const filePath = path.join(uploadsDir, fileName);

    const csvWriterInstance = createCsvWriter({
      path: filePath,
      header: [
        { id: 'student_name', title: 'Student Name' },
        { id: 'class', title: 'Class' },
        { id: 'section', title: 'Section' },
        { id: 'status', title: 'Attendance Status' },
        { id: 'date', title: 'Date' }
      ]
    });
    
    const formattedRecords = attendanceReportData.map(record => ({
      student_name: record.name, // field name from getStudentsWithAttendance
      class: record.class,
      section: record.section,
      status: record.status || 'Not Marked',
      date: record.attendance_date ? new Date(record.attendance_date).toLocaleDateString() : 'N/A'
    }));

    await csvWriterInstance.writeRecords(formattedRecords);

    res.download(filePath, fileName, (err) => {
      if (err) console.error('Error downloading file:', err);
      fs.unlink(filePath, (unlinkErr) => {
        if (unlinkErr) console.error('Error deleting temporary file:', unlinkErr);
      });
    });
  } catch (err) {
    console.error('Error generating attendance CSV:', err);
    res.status(500).send('Error generating attendance CSV: ' + err.message);
  }
});

module.exports = router;
