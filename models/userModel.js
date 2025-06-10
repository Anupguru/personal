// models/userModel.js
const sequelize = require('../config/db');
const bcrypt = require('bcrypt');
const Attendance = require('./attendanceModel'); // Required for associations to work

const { DataTypes, Op } = require('sequelize');
// Removed: const Attendance = require('./attendanceModel');

// Define User Model
const User = sequelize.define('User', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
    allowNull: false
  },
  username: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  email: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
  },
  password: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  title: {
    type: DataTypes.STRING(10),
    defaultValue: 'Mr',
    validate: {
      isIn: [['Mr', 'Ms', 'Mrs', 'Dr']],
    },
  },
}, {
  tableName: 'users',
  timestamps: false,
  hooks: {
    beforeCreate: async (user) => {
      if (user.password) {
        const salt = await bcrypt.genSalt(10);
        user.password = await bcrypt.hash(user.password, salt);
      }
    },
    beforeUpdate: async (user) => {
      if (user.changed('password') && user.password) { // Ensure password is not null/undefined
        const salt = await bcrypt.genSalt(10);
        user.password = await bcrypt.hash(user.password, salt);
      }
    }
  }
});

// Define Student Model
const Student = sequelize.define('Student', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
    allowNull: false
  },
  name: { type: DataTypes.STRING, allowNull: false },
  class: { type: DataTypes.STRING, allowNull: false, field: 'class' }, // Explicitly map 'class' field
  section: { type: DataTypes.STRING, allowNull: false },
}, {
  tableName: 'students',
  timestamps: false,
});

// Define Associations in static methods
User.associate = function(models) {
  User.hasMany(models.Attendance, {
    foreignKey: 'submitted_by',
    as: 'submitted_attendances',
    onDelete: 'SET NULL', // Or 'NO ACTION' if you prefer, depends on requirements
    onUpdate: 'CASCADE'
  });
};

Student.associate = function(models) {
  Student.hasMany(models.Attendance, {
    foreignKey: 'studentId',
    as: 'attendances',
    onDelete: 'CASCADE' // If a student is deleted, their attendance records are also deleted.
  });
};

// User methods
async function findUserByEmail(email) {
  return User.findOne({ where: { email } });
}

async function createUser({ username, email, password, title = 'Mr' }) {
  // Password hashing is handled by the User model's beforeCreate hook
  return User.create({ username, email, password, title });
}

async function updateUserTitle(userId, title) {
  const user = await User.findByPk(userId);
  if (user) {
    user.title = title;
    await user.save();
    return user;
  }
  return null;
}

async function getAllUsers() {
  return User.findAll();
}

async function deleteUserByUsername(username) {
  // Returns the number of destroyed rows
  return User.destroy({ where: { username } });
}

// Student methods
async function createStudent({ name, class: className, section }) {
  return Student.create({ name, class: className, section });
}

async function getStudentsWithAttendance(studentClass, section, date) {
  try {
    console.log('Fetching students with params (Sequelize):', { studentClass, section, date });
    const students = await Student.findAll({
      attributes: ['id', 'name', 'class', 'section'], // Explicitly define attributes for Student
      where: {
        class: studentClass,
        section: section,
      },
      include: [{
        model: sequelize.models.Attendance, // Access Attendance model via sequelize.models
        as: 'attendances', // This alias must match the one in Student.hasMany
        where: { date: date },
        attributes: ['status', 'date', 'is_submitted'], // Ensure is_submitted is fetched
        required: false, // LEFT JOIN
      }],
      order: [['name', 'ASC']],
    });

    const result = students.map(s => {
      const attendanceRecord = s.attendances && s.attendances.length > 0 ? s.attendances[0] : null;
      return {
        id: s.id,
        name: s.name,
        class: s.class,
        section: s.section,
        status: attendanceRecord ? attendanceRecord.status : 'Not Marked',
        attendance_date: attendanceRecord ? attendanceRecord.date : date,
        is_submitted: attendanceRecord ? attendanceRecord.is_submitted : false, // Add is_submitted
      };
    });
    console.log('Found students (Sequelize):', result);
    return result;

  } catch (error) {
    console.error('Error fetching students with attendance (Sequelize):', error);
    throw error;
  }
}

async function getStudentAttendanceHistory(studentId) {
  return sequelize.models.Attendance.findAll({ // Access Attendance model via sequelize.models
    where: { studentId: studentId },
    attributes: ['date', 'status'],
    order: [['date', 'DESC']],
  });
}

async function getAttendanceSummary(studentId, startDate, endDate) {
  const summary = await sequelize.models.Attendance.findOne({ // Access Attendance model via sequelize.models
    attributes: [
      [sequelize.fn('COUNT', sequelize.literal("CASE WHEN status = 'Present' THEN 1 END")), 'present_count'],
      [sequelize.fn('COUNT', sequelize.literal("CASE WHEN status = 'Absent' THEN 1 END")), 'absent_count'],
      [sequelize.fn('COUNT', sequelize.col('id')), 'total_days']
    ],
    where: {
      studentId: studentId,
      date: {
        [Op.between]: [startDate, endDate],
      },
    },
    raw: true, // Get plain JSON object
  });
  // Ensure counts are numbers and default to 0 if summary is null or counts are null
  return {
    present_count: Number(summary?.present_count) || 0,
    absent_count: Number(summary?.absent_count) || 0,
    total_days: Number(summary?.total_days) || 0,
  };
}

async function markAttendance(studentId, date, status) {
  // Upsert functionality: create or update if exists.
  // Sequelize's upsert might not return the instance in all dialects or versions consistently.
  // A common pattern is findOrCreate then update if necessary, or findOne + update/create.
  // This function should now use the fields from the new Attendance model
  // The new Attendance model expects 'userId', 'class', 'section', 'is_submitted'
  // This function might need more parameters if it's creating a new record.
  // For now, let's assume it's primarily updating status.
  // If creating, it would need class and section.

let attendanceRecord = await sequelize.models.Attendance.findOne({ // Access Attendance model via sequelize.models
  where: { studentId: studentId, date: date }
});

if (attendanceRecord) {
  // Prevent update if already submitted, this logic is also in teacherRoutes, but good to have at model level too
  if (attendanceRecord.is_submitted) {
      throw new Error('Attendance record is already submitted and cannot be modified.');
  }
  if (attendanceRecord.status !== status) {
    attendanceRecord.status = status;
    await attendanceRecord.save();
  }
} else {
  // To create a new record, we need class and section.
  // This function's signature might need to change or rely on studentId to fetch them.
  // For now, this part will fail if it tries to create without class/section.
  // Let's assume for now this function is only called for existing, non-submitted records.
  // Or, we fetch student details first.
  const student = await Student.findByPk(studentId);
  if (!student) throw new Error('Student not found');

  attendanceRecord = await sequelize.models.Attendance.create({ // Access Attendance model via sequelize.models
    studentId: studentId,
    date: date,
    status: status,
    class: student.class, // Fetch from student
    section: student.section, // Fetch from student
    is_submitted: false // New records are not submitted by default
  });
}
return attendanceRecord;
}

async function deleteStudent(studentId) {
  const student = await Student.findByPk(studentId);
  if (student) {
    await student.destroy(); // Relies on onDelete: 'CASCADE' for attendance
    return student; // Returns the instance that was destroyed
  }
  return null;
}

async function getStudentsByClassAndSection(className, section) {
  return Student.findAll({
    where: {
      class: className,
      section: section,
    },
    order: [['name', 'ASC']],
  });
}

module.exports = {
  User,
  Student,
  createUser,
  getAllUsers,
  findUserByEmail,
  deleteUserByUsername,
  updateUserTitle,
  createStudent,
  getStudentsWithAttendance,
  markAttendance,
  deleteStudent,
  getStudentsByClassAndSection,
  getStudentAttendanceHistory,
  getAttendanceSummary,
};
