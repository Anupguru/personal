const express = require('express');
const path = require('path');
const bodyParser = require('body-parser');
const session = require('express-session');
const { v4: uuidv4 } = require('uuid');
const SequelizeStore = require("connect-session-sequelize")(session.Store);
const { sequelize } = require('./config/db');

const authRoutes = require('./routes/authRoutes');
const adminRoutes = require('./routes/adminRoutes');
const teacherRoutes = require('./routes/teacherRoutes');

const app = express();

// Trust proxy in production
if (process.env.NODE_ENV === "production") {
  app.set("trust proxy", 1);
}

// Session Store setup
const sessionStore = new SequelizeStore({
  db: sequelize,
  tableName: "Session",
  checkExpirationInterval: 15 * 60 * 1000,
  expiration: 24 * 60 * 60 * 1000,
});

// Session middleware setup
app.use(session({
  secret: 'your-secret-key',  // Replace with a secure secret in production
  store: sessionStore,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: false, // Set to true if using HTTPS
    maxAge: 24 * 60 * 60 * 1000
  }
}));

// Middleware
app.set('view engine', 'ejs');
app.use(express.static(path.join(__dirname, 'public')));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// Make session user available to all views
app.use((req, res, next) => {
  res.locals.user = req.session.user || null;
  next();
});

// Mount routes
app.use('/', authRoutes);
app.use('/admin', adminRoutes);
app.use('/teacher', teacherRoutes);

// In-memory storage (temporary)
let students = [];
let attendanceRecords = [];

// Store SSE clients
const adminClients = new Set();
const teacherClients = new Set();

// SSE Endpoints
app.get('/admin/attendance-updates', (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive'
  });

  adminClients.add(res);
  req.on('close', () => adminClients.delete(res));
});

app.get('/teacher/student-updates', (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive'
  });

  teacherClients.add(res);
  req.on('close', () => teacherClients.delete(res));
});

// Notify all SSE clients
function notifyAllClients() {
  const data = JSON.stringify({
    students,
    attendanceRecords
  });

  adminClients.forEach(client => client.write(`data: ${data}\n\n`));
  teacherClients.forEach(client => client.write(`data: ${data}\n\n`));
}

// Landing Page
app.get('/', (req, res) => {
  res.render('landing');
});

// Teacher Dashboard
app.get('/teacherDashboard', (req, res) => {
  const { class: selectedClass, section: selectedSection, attendanceDate: selectedDate } = req.query;

  const filteredStudents = students.filter(student =>
    student.class === selectedClass && student.section === selectedSection
  );

  const studentsWithStatus = filteredStudents.map(student => {
    const attendance = attendanceRecords.find(record =>
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

// Add Student
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
  notifyAllClients();

  res.status(200).json({ message: 'Student added successfully', student: newStudent });
});

// Delete Student
app.post('/teacher/deleteStudent/:id', (req, res) => {
  const studentId = req.params.id;

  students = students.filter(student => student.id !== studentId);
  attendanceRecords = attendanceRecords.filter(record => record.studentId !== studentId);

  notifyAllClients();

  if (req.xhr || req.headers.accept.indexOf('json') > -1) {
    res.json({ success: true });
  } else {
    res.redirect('back');
  }
});

// Mark Attendance Status
app.post('/teacher/markStatus/:id', (req, res) => {
  const studentId = req.params.id;
  const { status, date, class: studentClass, section } = req.body;

  attendanceRecords = attendanceRecords.filter(record => !(record.studentId === studentId && record.date === date));

  attendanceRecords.push({ studentId, status, date });
  notifyAllClients();

  res.redirect(`/teacherDashboard?class=${studentClass}&section=${section}&attendanceDate=${date}`);
});

// Admin Dashboard
app.get('/admin/dashboard', (req, res) => {
  const { class: selectedClass, section: selectedSection, date: selectedDate } = req.query;

  let filteredStudents = students;
  if (selectedClass && selectedSection) {
    filteredStudents = students.filter(student =>
      student.class.toString() === selectedClass && student.section === selectedSection
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

// Logout
app.post('/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/');
  });
});

// Initialize database and start server
sessionStore.sync()
  .then(() => sequelize.sync({ force: false }))
  .then(() => {
    console.log("✅ Database and session store synchronized!");
    const PORT = process.env.PORT || 3000;
    const HOST = process.env.HOST || 'localhost';
    app.listen(PORT, () => {
      console.log('\x1b[36m%s\x1b[0m', '🚀 Server is running!');
      console.log('\x1b[36m%s\x1b[0m', `➜ Local:   http://${HOST}:${PORT}`);
      console.log('\x1b[33m%s\x1b[0m', '\nNote: Press Ctrl+C to stop the server');
    });
  })
  .catch((error) => {
    console.error("❌ Error syncing the database or session store:", error);
  });
