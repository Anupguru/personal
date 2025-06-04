// controllers/studentController.js
const {
  createStudent,
  getStudentsWithAttendance,
  markAttendance,
  deleteStudent,
  getStudentsByClassAndSection,
  getStudentAttendanceHistory,
  getAttendanceSummary
} = require('../models/userModel');

module.exports = {
  // Add new student
  async addStudent(req, res) {
    try {
      const { name, class: className, section } = req.body;
      const student = await createStudent({ name, class: className, section });
      return res.status(201).json(student);
    } catch (err) {
      console.error('Error creating student:', err);
      return res.status(500).json({ error: 'Failed to create student' });
    }
  },

  // Get students with attendance for a date
  async fetchStudentsWithAttendance(req, res) {
    try {
      const { class: studentClass, section, date } = req.query;
      const result = await getStudentsWithAttendance(studentClass, section, date);
      return res.status(200).json(result);
    } catch (err) {
      console.error('Error fetching student attendance:', err);
      return res.status(500).json({ error: 'Failed to fetch student attendance' });
    }
  },

  // Mark attendance
  async updateAttendance(req, res) {
    try {
      const { studentId, date, status } = req.body;
      const result = await markAttendance(studentId, date, status);
      return res.status(200).json(result);
    } catch (err) {
      console.error('Error marking attendance:', err);
      return res.status(500).json({ error: err.message });
    }
  },

  // Delete student
  async removeStudent(req, res) {
    try {
      const { id } = req.params;
      const result = await deleteStudent(id);
      if (!result) return res.status(404).json({ error: 'Student not found' });
      return res.status(200).json({ message: 'Student deleted successfully' });
    } catch (err) {
      console.error('Error deleting student:', err);
      return res.status(500).json({ error: 'Failed to delete student' });
    }
  },

  // Get students by class and section
  async getStudentsByClassSection(req, res) {
    try {
      const { class: className, section } = req.query;
      const result = await getStudentsByClassAndSection(className, section);
      return res.status(200).json(result);
    } catch (err) {
      console.error('Error fetching students:', err);
      return res.status(500).json({ error: 'Failed to fetch students' });
    }
  },

  // Get attendance history for a student
  async getAttendanceHistory(req, res) {
    try {
      const { studentId } = req.params;
      const result = await getStudentAttendanceHistory(studentId);
      return res.status(200).json(result);
    } catch (err) {
      console.error('Error fetching attendance history:', err);
      return res.status(500).json({ error: 'Failed to fetch attendance history' });
    }
  },

  // Get attendance summary for a student
  async getSummary(req, res) {
    try {
      const { studentId } = req.params;
      const { startDate, endDate } = req.query;
      const summary = await getAttendanceSummary(studentId, startDate, endDate);
      return res.status(200).json(summary);
    } catch (err) {
      console.error('Error fetching attendance summary:', err);
      return res.status(500).json({ error: 'Failed to fetch summary' });
    }
  }
};
