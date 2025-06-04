// controllers/studentController.js
const { Student, createStudent, deleteStudent, markAttendance, getStudentsWithAttendance, getStudentsByClassAndSection } = require('../models/userModel');
const Attendance = require('../models/attendanceModel');
const { Op } = require('sequelize');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;
const path = require('path');
const fs = require('fs');

const uploadsDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

exports.teacherDashboard = async (req, res) => {
  try {
    const { class: className, section, attendanceDate, error, success } = req.query;
    const currentDate = attendanceDate || new Date().toISOString().split('T')[0];
    let studentsWithStatus = [];

    if (className && section) {
      studentsWithStatus = await getStudentsWithAttendance(className, section, currentDate);
    }

    res.render('teacherDashboard', {
      user: req.session.user,
      students: studentsWithStatus,
      selectedClass: className || '',
      selectedSection: section || '',
      selectedDate: currentDate,
      error: error || '',
      success: success || ''
    });
  } catch (err) {
    console.error('Error loading teacher dashboard:', err);
    res.redirect(`/teacher/dashboard?error=${encodeURIComponent(err.message)}`);
  }
};

exports.downloadStudents = async (req, res) => {
  try {
    const { class: className, section, date } = req.query;
    const effectiveDate = date || new Date().toISOString().split('T')[0];

    if (!className || !section) {
      return res.redirect('/teacher/dashboard?error=Class and section are required');
    }

    const studentsData = await getStudentsWithAttendance(className, section, effectiveDate);
    if (studentsData.length === 0) {
      return res.redirect('/teacher/dashboard?error=No students found');
    }

    const fileName = `students_attendance_${className.replace(/\s+/g, '_')}_${section}_${effectiveDate.replace(/-/g, '')}.csv`;
    const filePath = path.join(uploadsDir, fileName);

    const csvWriterInstance = createCsvWriter({
      path: filePath,
      header: [
        { id: 'name', title: 'Student Name' },
        { id: 'class', title: 'Class' },
        { id: 'section', title: 'Section' },
        { id: 'status', title: 'Attendance Status' },
      ]
    });

    await csvWriterInstance.writeRecords(studentsData.map(s => ({
      name: s.name,
      class: s.class,
      section: s.section,
      status: s.status
    })));

    res.download(filePath, fileName, (err) => {
      if (err) console.error('Error downloading file:', err);
      fs.unlink(filePath, (unlinkErr) => {
        if (unlinkErr) console.error('Error deleting temporary file:', unlinkErr);
      });
    });
  } catch (err) {
    console.error('Error generating CSV:', err);
    res.redirect(`/teacher/dashboard?error=${encodeURIComponent(err.message)}`);
  }
};

exports.addStudent = async (req, res) => {
  try {
    const { name, class: className, section } = req.body;
    if (!name || !className || !section) {
      return res.status(400).json({ error: "All fields (name, class, section) are required." });
    }
    await createStudent({ name, class: className, section });
    res.json({ success: true, message: "Student added successfully." });
  } catch (err) {
    console.error('Error adding student:', err);
    res.status(500).json({ error: err.message });
  }
};

exports.submitAttendance = async (req, res) => {
  try {
    const { class: className, section, attendanceDate } = req.body;
    if (!className || !section || !attendanceDate) {
      return res.redirect(`/teacher/dashboard?error=All fields (class, section, date) are required`);
    }

    const formattedDate = new Date(attendanceDate).toISOString().split('T')[0];
    const studentsInClass = await getStudentsByClassAndSection(className, section);
    const studentIds = studentsInClass.map(s => s.id);

    const markedAttendance = await Attendance.findAll({
      where: {
        student_id: { [Op.in]: studentIds },
        date: formattedDate,
      }
    });

    const markedStudentIds = new Set(markedAttendance.map(a => a.student_id));
    const unmarkedStudents = studentsInClass.filter(s => !markedStudentIds.has(s.id));

    if (unmarkedStudents.length > 0) {
      const unmarkedNames = unmarkedStudents.map(s => s.name).join(', ');
      return res.redirect(`/teacher/dashboard?class=${encodeURIComponent(className)}&section=${encodeURIComponent(section)}&attendanceDate=${formattedDate}&error=Attendance not marked for: ${unmarkedNames}`);
    }

    await Attendance.update({ is_submitted: true }, {
      where: {
        student_id: { [Op.in]: studentIds },
        date: formattedDate
      }
    });

    res.redirect(`/teacher/dashboard?class=${encodeURIComponent(className)}&section=${encodeURIComponent(section)}&attendanceDate=${formattedDate}&success=Attendance submitted successfully`);
  } catch (err) {
    console.error('Error submitting attendance:', err);
    res.redirect(`/teacher/dashboard?error=${encodeURIComponent(err.message)}`);
  }
};

exports.markStatus = async (req, res) => {
  try {
    const { studentId } = req.params;
    const { status, attendanceDate, class: className, section } = req.body;

    if (!attendanceDate || !status || !studentId) {
      return res.redirect('/teacher/markStatus');

    }

    const formattedDate = new Date(attendanceDate).toISOString().split('T')[0];

    const existingAttendance = await Attendance.findOne({
      where: { student_id: studentId, date: formattedDate }
    });

    if (existingAttendance && existingAttendance.is_submitted) {
      return res.redirect('/teacher/markStatus');
    }

    await markAttendance(parseInt(studentId), formattedDate, status);
    res.redirect('/teacher/markStatus');
  } catch (err) {
    console.error('Error in markStatus:', err);
    res.redirect('/teacher/markStatus');
  }
};

exports.deleteStudent = async (req, res) => {
  try {
    const { studentId } = req.params;
    const { class: className, section, attendanceDate } = req.body;

    await deleteStudent(parseInt(studentId));
    res.redirect(`/teacher/dashboard?class=${encodeURIComponent(className)}&section=${encodeURIComponent(section)}&attendanceDate=${encodeURIComponent(attendanceDate)}&success=Student deleted successfully`);
  } catch (err) {
    console.error('Error deleting student:', err);
    res.redirect(`/teacher/dashboard?class=${encodeURIComponent(req.body.class)}&section=${encodeURIComponent(req.body.section)}&attendanceDate=${encodeURIComponent(req.body.attendanceDate)}&error=${encodeURIComponent(err.message)}`);
  }
};
