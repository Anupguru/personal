// models/userModel.js
const { pool, sequelize } = require('../config/db');
const bcrypt = require('bcrypt');
const { DataTypes } = require('sequelize');

// Find user by email (raw query)
async function findUserByEmail(email) {
  const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
  return result.rows[0];
}

// Create a new user (raw query)
async function createUser({ username, email, password, title = 'Mr' }) {
  const hashedPassword = await bcrypt.hash(password, 10);
  const query = `INSERT INTO users (username, email, password, title) VALUES ($1, $2, $3, $4) RETURNING *`;
  const values = [username, email, hashedPassword, title];
  const result = await pool.query(query, values);
  return result.rows[0];
}

// Update user title
async function updateUserTitle(userId, title) {
  try {
    const query = 'UPDATE users SET title = $1 WHERE id = $2 RETURNING *';
    const result = await pool.query(query, [title, userId]);
    return result.rows[0];
  } catch (error) {
    console.error('Error updating user title:', error);
    throw error;
  }
}

// Get all users (raw query)
async function getAllUsers() {
  const result = await pool.query('SELECT * FROM users');
  return result.rows;
}

// Delete user by username (raw query)
async function deleteUserByUsername(username) {
  const result = await pool.query('DELETE FROM users WHERE username = $1', [username]);
  return result.rowCount;
}

// Create a new student (raw query)
// NOTE: "class" column wrapped in quotes to avoid conflict with SQL reserved word
async function createStudent({ name, class: className, section }) {
  try {
    const result = await pool.query(
      'INSERT INTO students (name, "class", section) VALUES ($1, $2, $3) RETURNING *',
      [name, className, section]
    );
    console.log('Student created:', result.rows[0]);
    return result.rows[0];
  } catch (error) {
    console.error('Error creating student:', error);
    throw error;
  }
}

// Get students with attendance for a specific date (raw query)
async function getStudentsWithAttendance(studentClass, section, date) {
  try {
    console.log('Fetching students with params:', { studentClass, section, date });
    const query = `
      SELECT 
        s.*,
        CASE
          WHEN a.date IS NULL THEN 'Not Marked'
          WHEN a.status IS NULL THEN 'Not Marked'
          ELSE a.status
        END as status,
        COALESCE(a.date, $3::date) as attendance_date
      FROM students s
      LEFT JOIN attendance a 
        ON s.id = a.student_id 
        AND DATE(a.date) = $3::date
      WHERE s.class = $1 
        AND s.section = $2
      ORDER BY s.name
    `;
    const result = await pool.query(query, [studentClass, section, date]);
    console.log('Found students:', result.rows);
    return result.rows;
  } catch (error) {
    console.error('Error fetching students:', error);
    throw error;
  }
}

// Get attendance history for a student
async function getStudentAttendanceHistory(studentId) {
  try {
    const query = `
      SELECT date, status
      FROM attendance
      WHERE student_id = $1
      ORDER BY date DESC
    `;
    const result = await pool.query(query, [studentId]);
    return result.rows;
  } catch (error) {
    console.error('Error fetching attendance history:', error);
    throw error;
  }
}

// Get attendance summary for a date range
async function getAttendanceSummary(studentId, startDate, endDate) {
  try {
    const query = `
      SELECT 
        COUNT(CASE WHEN status = 'Present' THEN 1 END) as present_count,
        COUNT(CASE WHEN status = 'Absent' THEN 1 END) as absent_count,
        COUNT(*) as total_days
      FROM attendance
      WHERE student_id = $1 
      AND date BETWEEN $2 AND $3
    `;
    const result = await pool.query(query, [studentId, startDate, endDate]);
    return result.rows[0];
  } catch (error) {
    console.error('Error fetching attendance summary:', error);
    throw error;
  }
}

// Mark attendance (raw query)
async function markAttendance(studentId, date, status) {
  try {
    const query = `
      INSERT INTO attendance (student_id, date, status)
      VALUES ($1, $2, $3)
      ON CONFLICT (student_id, date)
      DO UPDATE SET status = EXCLUDED.status
      RETURNING *
    `;
    const result = await pool.query(query, [studentId, date, status]);
    console.log('Attendance marked:', result.rows[0]);
    return result.rows[0];
  } catch (error) {
    console.error('Error marking attendance:', error);
    throw error;
  }
}

// Delete student (raw query)
async function deleteStudent(studentId) {
  try {
    // First delete related attendance records
    await pool.query('DELETE FROM attendance WHERE student_id = $1', [studentId]);
    // Then delete the student
    const result = await pool.query('DELETE FROM students WHERE id = $1 RETURNING *', [studentId]);
    console.log('Student deleted:', result.rows[0]);
    return result.rows[0];
  } catch (error) {
    console.error('Error deleting student:', error);
    throw error;
  }
}

// Get all students in a class/section
async function getStudentsByClassAndSection(className, section) {
  try {
    const result = await pool.query(
      'SELECT * FROM students WHERE class = $1 AND section = $2 ORDER BY name',
      [className, section]
    );
    return result.rows;
  } catch (error) {
    console.error('Error fetching students by class and section:', error);
    throw error;
  }
}

// Sequelize ORM model for Student (optional usage)
const Student = sequelize.define('Student', {
  name: { type: DataTypes.STRING, allowNull: false },
  class: { type: DataTypes.STRING, allowNull: false },  // keep it consistent with DB schema
  section: { type: DataTypes.STRING, allowNull: false },
}, {
  tableName: 'students',
  timestamps: false, // if your table does not have createdAt/updatedAt columns
});

module.exports = {
  createUser,
  getAllUsers,
  findUserByEmail,
  deleteUserByUsername,
  createStudent,
  getStudentsWithAttendance,
  markAttendance,
  deleteStudent,
  getStudentsByClassAndSection,
  Student,
  getStudentAttendanceHistory,
  getAttendanceSummary,
  updateUserTitle
};
