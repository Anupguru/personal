const sequelize = require('../config/db');
const { DataTypes, Op } = require('sequelize');

// Define Student Model
const Student = sequelize.define('Student', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
    allowNull: false
  },
  name: { type: DataTypes.STRING, allowNull: false },
  class: { type: DataTypes.STRING, allowNull: false, field: 'class' },
  section: { type: DataTypes.STRING, allowNull: false },
}, {
  tableName: 'students',
  timestamps: false,
});

async function getStudentsWithAttendance(studentClass, section, date) {
  try {
    const students = await Student.findAll({
      attributes: ['id', 'name', 'class', 'section'],
      where: {
        class: studentClass,
        section: section,
      },
      include: [{
        model: sequelize.models.Attendance,
        as: 'attendances',
        where: { date: date },
        attributes: ['status', 'date', 'is_submitted'],
        required: false,
      }],
      order: [['name', 'ASC']],
    });

    return students.map(s => {
      const attendanceRecord = s.attendances && s.attendances.length > 0 ? s.attendances[0] : null;
      return {
        id: s.id,
        name: s.name,
        class: s.class,
        section: s.section,
        status: attendanceRecord ? attendanceRecord.status : 'Not Marked',
        attendance_date: attendanceRecord ? attendanceRecord.date : date,
        is_submitted: attendanceRecord ? attendanceRecord.is_submitted : false,
      };
    });
  } catch (error) {
    console.error('Error fetching students with attendance:', error);
    throw error;
  }
}

module.exports = {
  Student,
  getStudentsWithAttendance,
};
