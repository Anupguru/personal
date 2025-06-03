const jwt = require('jsonwebtoken');
const { jwtSecret } = require('../config/db');

const verifyToken = (req, res, next) => {
  const token = req.headers['authorization'];
  if (!token) return res.sendStatus(403);

  try {
    const decoded = jwt.verify(token.split(" ")[1], jwtSecret);
    req.user = decoded;
    next();
  } catch (err) {
    res.sendStatus(401);
  }
};

module.exports = { verifyToken };
