// models/index.js
const User = require('./userModel');
const Student = require('./studentModel');
const Attendance = require('./attendanceModel');

const models = { User, Student, Attendance };

// Define associations here explicitly or call associate methods if defined in models
User.hasMany(Attendance, {
  foreignKey: 'submitted_by',
  as: 'submitted_attendances',
  onDelete: 'SET NULL',
  onUpdate: 'CASCADE'
});

Student.hasMany(Attendance, {
  foreignKey: 'studentId',
  as: 'attendances',
  onDelete: 'CASCADE'
});

Attendance.belongsTo(Student, {
  foreignKey: 'studentId',
  as: 'student'
});

Attendance.belongsTo(User, {
  foreignKey: 'submitted_by',
  as: 'submitter'
});

module.exports = models;
