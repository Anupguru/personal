const express = require('express');
const router = express.Router();
const { pool } = require('../config/db');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;
const path = require('path');
const fs = require('fs');

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir);
}

// Middleware to check if user is logged in
const requireLogin = (req, res, next) => {
  if (!req.session.user) {
    return res.redirect('/login');
  }
  next();
};

// Teacher Dashboard
router.get('/dashboard', requireLogin, async (req, res) => {
  try {
    const { class: className, section, attendanceDate, error, success } = req.query;
    const currentDate = attendanceDate || new Date().toISOString().split('T')[0];
    let students = [];

    if (className && section) {
      const result = await pool.query(`
        SELECT 
          s.*,
          COALESCE(a.status, 'Not Marked') as status,
          COALESCE(a.is_submitted, false) as is_submitted
        FROM students s
        LEFT JOIN attendance a ON s.id = a.student_id 
          AND DATE(a.date) = $3::date
        WHERE s.class = $1 AND s.section = $2
        ORDER BY s.name
      `, [className, section, currentDate]);
      
      students = result.rows;
    }

    res.render('teacherDashboard', {
      user: req.session.user,
      students,
      selectedClass: className || '',
      selectedSection: section || '',
      selectedDate: currentDate,
      error: error || '',
      success: success || ''
    });
  } catch (err) {
    console.error('Error loading dashboard:', err);
    res.redirect('/teacher/dashboard?error=' + encodeURIComponent(err.message));
  }
});

// Download students list as CSV
router.get('/downloadStudents', requireLogin, async (req, res) => {
  try {
    const { class: className, section, date } = req.query;
    
    if (!className || !section) {
      return res.redirect('/teacher/dashboard?error=Class and section are required');
    }

    const result = await pool.query(`
      SELECT 
        s.*,
        COALESCE(a.status, 'Not Marked') as attendance_status
      FROM students s
      LEFT JOIN attendance a ON s.id = a.student_id 
        AND DATE(a.date) = $3::date
      WHERE s.class = $1 AND s.section = $2
      ORDER BY s.name
    `, [className, section, date || new Date().toISOString().split('T')[0]]);

    if (result.rows.length === 0) {
      return res.redirect('/teacher/dashboard?error=No students found');
    }

    const fileName = `students_${className}_${section}_${date || 'all'}.csv`;
    const filePath = path.join(uploadsDir, fileName);

    const csvWriter = createCsvWriter({
      path: filePath,
      header: [
        { id: 'name', title: 'Student Name' },
        { id: 'class', title: 'Class' },
        { id: 'section', title: 'Section' },
        { id: 'attendance_status', title: 'Attendance Status' }
      ]
    });

    await csvWriter.writeRecords(result.rows);

    res.download(filePath, fileName, (err) => {
      if (err) console.error('Error downloading file:', err);
      fs.unlink(filePath, (unlinkErr) => {
        if (unlinkErr) console.error('Error deleting temporary file:', unlinkErr);
      });
    });
  } catch (err) {
    console.error('Error generating CSV:', err);
    res.redirect('/teacher/dashboard?error=' + encodeURIComponent(err.message));
  }
});

// Add new student
router.post('/addStudent', requireLogin, async (req, res) => {
  try {
    const { name, class: className, section } = req.body;
    await pool.query(
      'INSERT INTO students (name, class, section) VALUES ($1, $2, $3)',
      [name, className, section]
    );
    res.json({ success: true });
  } catch (err) {
    console.error('Error adding student:', err);
    res.status(500).json({ error: err.message });
  }
});

// Submit attendance for a class
router.post('/submitAttendance', requireLogin, async (req, res) => {
  try {
    const { class: className, section, attendanceDate } = req.body;
    
    if (!className || !section || !attendanceDate) {
      return res.redirect(`/teacher/dashboard?error=Class, section, and date are required`);
    }

    const unmarkedStudents = await pool.query(`
      SELECT s.name
      FROM students s
      LEFT JOIN attendance a ON s.id = a.student_id 
        AND DATE(a.date) = $3::date
      WHERE s.class = $1 
        AND s.section = $2
        AND (a.status IS NULL OR a.id IS NULL)
    `, [className, section, attendanceDate]);

    if (unmarkedStudents.rows.length > 0) {
      const unmarkedNames = unmarkedStudents.rows.map(s => s.name).join(', ');
      return res.redirect(`/teacher/dashboard?class=${className}&section=${section}&attendanceDate=${attendanceDate}&error=Unmarked students: ${unmarkedNames}`);
    }

    await pool.query(`
      UPDATE attendance a
      SET is_submitted = true
      FROM students s
      WHERE a.student_id = s.id
        AND s.class = $1 
        AND s.section = $2
        AND DATE(a.date) = $3::date
    `, [className, section, attendanceDate]);

    res.redirect(`/teacher/dashboard?class=${className}&section=${section}&attendanceDate=${attendanceDate}&success=Attendance submitted successfully`);
  } catch (err) {
    console.error('Error submitting attendance:', err);
    res.redirect(`/teacher/dashboard?error=${err.message}`);
  }
});

// Mark attendance status
router.post('/markStatus/:studentId', requireLogin, async (req, res) => {
  try {
    const { studentId } = req.params;
    const { status, attendanceDate, class: className, section } = req.body;
    const formattedDate = new Date(attendanceDate).toISOString().split('T')[0];

    if (!attendanceDate || !status) {
      return res.redirect(`/teacher/dashboard?class=${className}&section=${section}&error=Date and status are required`);
    }

    const submittedCheck = await pool.query(
      'SELECT is_submitted FROM attendance WHERE student_id = $1 AND DATE(date) = $2::date',
      [studentId, formattedDate]
    );

    if (submittedCheck.rows.length > 0 && submittedCheck.rows[0].is_submitted) {
      return res.redirect(`/teacher/dashboard?class=${className}&section=${section}&attendanceDate=${formattedDate}&error=Attendance already submitted`);
    }

    await pool.query(`
      INSERT INTO attendance (student_id, date, status, is_submitted)
      VALUES ($1, $2, $3, false)
      ON CONFLICT (student_id, date)
      DO UPDATE SET status = $3
    `, [studentId, formattedDate, status]);

    res.redirect(`/teacher/dashboard?class=${className}&section=${section}&attendanceDate=${formattedDate}`);
  } catch (err) {
    console.error('Error marking attendance:', err);
    res.redirect(`/teacher/dashboard?error=${err.message}`);
  }
});

// Delete student
router.post('/deleteStudent/:studentId', requireLogin, async (req, res) => {
  try {
    const { studentId } = req.params;
    const { class: className, section, attendanceDate } = req.body;
    
    await pool.query('DELETE FROM students WHERE id = $1', [studentId]);
    res.redirect(`/teacher/dashboard?class=${className}&section=${section}&attendanceDate=${attendanceDate}&success=Student deleted successfully`);
  } catch (err) {
    console.error('Error deleting student:', err);
    res.redirect(`/teacher/dashboard?error=${err.message}`);
  }
});

module.exports = router;
