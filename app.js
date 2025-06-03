const express = require('express');
const path = require('path');
const authRoutes = require('./routes/authRoutes');
const adminRoutes = require('./routes/adminRoutes');
const teacherRoutes = require('./routes/teacherRoutes');
const bodyParser = require('body-parser');
const { v4: uuidv4 } = require('uuid');
const session = require('express-session');
const { DataTypes } = require('sequelize');
const { sequelize, pool } = require('./config/db');

const app = express();

// Middleware setup
app.set('view engine', 'ejs');
app.use(express.static('public'));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// Session middleware setup
app.use(session({
  secret: 'your-secret-key',  // Change this to a secure secret
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: false, // Set to true if using HTTPS
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

// Middleware to make user data available to all views
app.use((req, res, next) => {
  res.locals.user = req.session.user || null;
  next();
});

// Mount routes
app.use('/', authRoutes);
app.use('/admin', adminRoutes);
app.use('/teacher', teacherRoutes);

// Root route
app.get('/', (req, res) => {
  res.render('landing');
});

let students = []; // Temporary in-memory storage
let attendanceRecords = [];

// Store SSE clients
const adminClients = new Set();
const teacherClients = new Set();

// Middleware for admin SSE endpoint
app.get('/admin/attendance-updates', (req, res) => {
  // Set headers for SSE
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive'
  });

  // Add client to the admin set
  adminClients.add(res);

  // Remove client when connection closes
  req.on('close', () => {
    adminClients.delete(res);
  });
});

// Middleware for teacher SSE endpoint
app.get('/teacher/student-updates', (req, res) => {
  // Set headers for SSE
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive'
  });

  // Add client to the teacher set
  teacherClients.add(res);

  // Remove client when connection closes
  req.on('close', () => {
    teacherClients.delete(res);
  });
});

// Function to notify all clients of updates
function notifyAllClients() {
  const data = {
    students: students,
    attendanceRecords: attendanceRecords
  };

  const dataString = JSON.stringify(data);

  // Notify admin clients
  adminClients.forEach(client => {
    client.write(`data: ${dataString}\n\n`);
  });

  // Notify teacher clients
  teacherClients.forEach(client => {
    client.write(`data: ${dataString}\n\n`);
  });
}

app.get('/teacherDashboard', (req, res) => {
  const selectedClass = req.query.class || '';
  const selectedSection = req.query.section || '';
  const selectedDate = req.query.attendanceDate || '';

  const filteredStudents = students.filter(student =>
    student.class === selectedClass && student.section === selectedSection
  );

  // Merge attendance status if exists
  const studentsWithStatus = filteredStudents.map(student => {
    const attendance = attendanceRecords.find(
      record =>
        record.studentId === student.id && record.date === selectedDate
    );
    return {
      ...student,
      status: attendance ? attendance.status : null,
    };
  });

  res.render('teacherdashboard', {
    students: studentsWithStatus,
    selectedClass,
    selectedSection,
    selectedDate,
  });
});

app.post('/teacher/addStudent', (req, res) => {
  const { name, class: studentClass, section } = req.body;

  if (!name || !studentClass || !section) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const newStudent = {
    id: uuidv4(),
    name,
    class: studentClass,
    section,
  };

  students.push(newStudent);
  
  // Notify all clients about the update
  notifyAllClients();
  
  res.status(200).json({ message: 'Student added successfully', student: newStudent });
});

// Delete student
app.post('/teacher/deleteStudent/:id', (req, res) => {
  const studentId = req.params.id;
  students = students.filter(student => student.id !== studentId);
  attendanceRecords = attendanceRecords.filter(record => record.studentId !== studentId);
  
  // Notify all clients about the update
  notifyAllClients();
  
  if (req.xhr || req.headers.accept.indexOf('json') > -1) {
    res.json({ success: true });
  } else {
    res.redirect('back');
  }
});

app.post('/teacher/markStatus/:id', (req, res) => {
  const studentId = req.params.id;
  const { status, date, class: studentClass, section } = req.body;

  // Remove old record if it exists
  attendanceRecords = attendanceRecords.filter(record => !(record.studentId === studentId && record.date === date));

  attendanceRecords.push({
    studentId,
    status,
    date,
  });

  // Notify all clients about the update
  notifyAllClients();

  // Redirect back with preserved class/section/date
  res.redirect(`/teacherDashboard?class=${studentClass}&section=${section}&attendanceDate=${date}`);
});

app.post('/logout', (req, res) => {
  res.redirect('/');
});

// Admin dashboard route
app.get('/admin/dashboard', (req, res) => {
  const selectedClass = req.query.class;
  const selectedSection = req.query.section;
  const selectedDate = req.query.date;

  let filteredStudents = students;
  if (selectedClass && selectedSection) {
    filteredStudents = students.filter(student => 
      student.class.toString() === selectedClass && 
      student.section === selectedSection
    );
  }

  const filteredAttendance = attendanceRecords.filter(record => {
    const student = students.find(s => s.id === record.studentId);
    return (!selectedClass || student.class.toString() === selectedClass) &&
           (!selectedSection || student.section === selectedSection) &&
           (!selectedDate || record.date === selectedDate);
  });

  res.render('adminDashboard', {
    students: filteredStudents,
    attendance: filteredAttendance,
    selectedClass,
    selectedSection,
    selectedDate
  });
});

// Start server
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || 'localhost';

app.listen(PORT, () => {
  console.log('\x1b[36m%s\x1b[0m', '🚀 Server is running!');
  console.log('\x1b[36m%s\x1b[0m', `➜ Local:   http://${HOST}:${PORT}`);
  console.log('\x1b[33m%s\x1b[0m', '\nNote: Press Ctrl+C to stop the server');
});
