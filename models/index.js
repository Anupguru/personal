const User = require('./userModel');
const Student = require('./studentModel');
const Attendance = require('./attendanceModel');

// Associations
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

// Export all models
module.exports = {
  User,
  Student,
  Attendance
};
