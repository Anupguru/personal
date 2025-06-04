const User = require('./userModel');
const Student = require('./studentModel');
const Attendance = require('./attendanceModel');

User.hasMany(Attendance, { foreignKey: 'submitted_by', as: 'submitted_attendances' });
Student.hasMany(Attendance, { foreignKey: 'studentId', as: 'attendances' });
Attendance.belongsTo(Student, { foreignKey: 'studentId', as: 'student' }); 

// Export all models
module.exports = {
  User,
  Student,
  Attendance
};
