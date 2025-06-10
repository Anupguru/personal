const sequelize = require('../config/db');
const bcrypt = require('bcrypt');
const { DataTypes } = require('sequelize');

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
      if (user.changed('password') && user.password) {
        const salt = await bcrypt.genSalt(10);
        user.password = await bcrypt.hash(user.password, salt);
      }
    }
  }
});

// User methods

async function findUserByEmail(email) {
  return User.findOne({ where: { email } });
}

async function createUser({ username, email, password, title = 'Mr' }) {
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
  return User.destroy({ where: { username } });
}

module.exports = {
  User,
  createUser,
  findUserByEmail,
  updateUserTitle,
  getAllUsers,
  deleteUserByUsername,
};
