// routes/studentRoutes.js
const express = require('express');
const router = express.Router();
const studentController = require('../controllers/studentController');
const requireLogin = require('../middlewares/requireLogin');
router.get('/dashboard', requireLogin, studentController.teacherDashboard);

router.get('/downloadStudents', requireLogin, studentController.downloadStudents); // fix here

// rest remain unchanged

router.post('/addStudent', requireLogin, studentController.addStudent);
router.post('/submitAttendance', requireLogin, studentController.submitAttendance);
router.post('/markStatus/:studentId', requireLogin, studentController.markStatus);
router.post('/deleteStudent/:studentId', requireLogin, studentController.deleteStudent);

module.exports = router;