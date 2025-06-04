const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const Attendance = sequelize.define('Attendance', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  studentId: { type: DataTypes.INTEGER, allowNull: false },
  date: { type: DataTypes.DATEONLY, allowNull: false },
  status: { type: DataTypes.STRING, allowNull: false },
  class: { type: DataTypes.STRING, allowNull: false },
  section: { type: DataTypes.STRING, allowNull: false },
  is_submitted: { type: DataTypes.BOOLEAN, defaultValue: false },
}, {
  tableName: 'attendances',
  timestamps: false,
});

module.exports = Attendance;
