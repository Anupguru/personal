const { Sequelize } = require("sequelize");
require("dotenv").config();

const sequelize = new Sequelize(process.env.DATABASE_URL, {
  dialect: "postgres",
  protocol: "postgres",
  dialectOptions: {
    ssl: {
      require: true,
      rejectUnauthorized: false, // Needed for some hosted DBs with self-signed certs
    },
  },
  logging: false, // disable SQL query logging, enable for debugging
});

module.exports = sequelize;