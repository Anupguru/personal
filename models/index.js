const User = require('./userModel');
const Student = require('./studentModel');
const Attendance = require('./attendanceModel');

<<<<<<< HEAD
User.hasMany(Attendance, { foreignKey: 'submitted_by', as: 'submitted_attendances' });
Student.hasMany(Attendance, { foreignKey: 'studentId', as: 'attendances' });
Attendance.belongsTo(Student, { foreignKey: 'studentId', as: 'student' }); 
=======
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

Student.hasMany(Attendance, {
  foreignKey: 'studentId',
  as: 'attendances',
  onDelete: 'CASCADE'
});
>>>>>>> cb4ad0e3d651b369b23f22c0db79d1e87cfc4da8

// Export all models
module.exports = {
  User,
  Student,
  Attendance
};
