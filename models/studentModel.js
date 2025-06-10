const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const Student = sequelize.define('Student', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true, allowNull: false },
  name: { type: DataTypes.STRING, allowNull: false },
  class: { type: DataTypes.STRING, allowNull: false, field: 'class' },
  section: { type: DataTypes.STRING, allowNull: false },
}, {
  tableName: 'students',
  timestamps: false,
});


module.exports = Student;
