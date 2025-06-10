const User = require('./userModel');
const Student = require('./studentModel');
const Attendance = require('./attendanceModel');

// Define associations directly
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

// Export all models
module.exports = {
  User,
  Student,
  Attendance
};
