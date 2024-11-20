require('dotenv').config();

const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
const session = require('express-session');
const http = require('http');
const socketIO = require('socket.io');
const projectRoutes = require('./routes/projects');
const requestsRoutes = require('./routes/requests');
const Project = require('./models/Project');
const messagesRoutes = require('./routes/messages');
const notificationsRouter = require('./routes/notifications');
const User = require('./models/User');

const app = express();
const server = http.createServer(app);
const io = socketIO(server);

// Store io instance in app
app.set('io', io);

// Connect to MongoDB with environment variables
mongoose.connect(process.env.MONGODB_URI || 'mongodb+srv://newUser:newUser@cluster0.ugeqm.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0', {
    // useNewUrlParser: true,
    // useUnifiedTopology: true
}).then(() => {
    console.log('Connected to MongoDB');
}).catch(err => {
    console.error('Database connection error:', err);
    process.exit(1);  // Exit if database connection fails
});

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public')); // Serve static files from the public directory
app.set('view engine', 'ejs');

// Use environment variable for session secret
app.use(session({
    secret: process.env.SESSION_SECRET || 'your-secret-key',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: process.env.NODE_ENV === 'production',
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
}));

// Set EJS as templating engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Protected route middleware
const requireAuth = (req, res, next) => {
    if (!req.session.user) {
        return res.redirect('/auth/login');
    }
    next();
};

// Import routes
const authRoutes = require('./routes/auth');
const profileRoutes = require('./routes/profile');
const searchRoutes = require('./routes/search');
const adminRoutes = require('./routes/admin');
const notificationsRoutes = require('./routes/notifications');

// Add this before your routes
app.use((req, res, next) => {
    if (req.method === 'POST') {
        console.log('\n=== Incoming POST Request ===');
        console.log('Method:', req.method);
        console.log('Path:', req.path);
        console.log('Headers:', req.headers);
        console.log('Body:', req.body);
        console.log('=== End POST Request Info ===\n');
    }
    next();
});

// Add this logging middleware before the routes
app.use('/requests', (req, res, next) => {
    console.log('\n=== Requests Route Hit ===');
    console.log('Method:', req.method);
    console.log('Path:', req.originalUrl);
    console.log('Body:', req.body);
    console.log('=== End Requests Route Info ===\n');
    next();
}, requestsRoutes);

// Use routes
app.use('/auth', authRoutes);
app.use('/profile', requireAuth, profileRoutes);
app.use('/search', requireAuth, searchRoutes);
app.use('/admin', requireAuth, adminRoutes);
app.use('/notifications', requireAuth, notificationsRouter);
app.use('/projects', requireAuth, projectRoutes);
app.use('/requests', (req, res, next) => {
    if (req.method === 'POST') {
        console.log('Requests POST route hit:', {
            method: req.method,
            path: req.path,
            body: req.body
        });
    }
    next();
}, requestsRoutes);
app.use('/messages', messagesRoutes);

// Home route with auth check
app.get('/', (req, res) => {
    if (req.session.user) {
        return res.redirect('/dashboard');
    }
    res.render('auth/home');
});

// Dashboard route
app.get('/dashboard', requireAuth, async (req, res) => {
    try {
        // Fetch all projects with author details including university
        const projects = await Project.find()
            .sort({ createdAt: -1 })
            .populate({
                path: 'author',
                select: 'username university'
            });

        // Fetch unique universities from the database
        const universities = await User.distinct('university');
        
        // Filter out null/empty values and sort alphabetically
        const validUniversities = universities
            .filter(uni => uni && uni.trim() !== '')
            .sort();

        res.render('dashboard', { 
            user: req.session.user,
            projects: projects,
            universities: validUniversities,
            title: `Welcome ${req.session.user.username}`
        });
    } catch (error) {
        console.error('Error fetching projects:', error);
        res.status(500).json({ error: 'Failed to fetch projects' });
    }
});

// WebSocket connection handling
io.on('connection', (socket) => {
    console.log('New user connected');

    // Store user information when they join
    socket.on('join', (userId) => {
        socket.userId = userId;
        socket.join(`user_${userId}`); // Create a private room for the user
        console.log(`User ${userId} joined`);
    });

    // Handle new message
    socket.on('sendMessage', async (data) => {
        try {
            const { to, content } = data;
            const from = socket.userId;

            // Save message to database
            const message = new Message({
                sender: from,
                recipient: to,
                content: content,
                createdAt: new Date()
            });
            await message.save();

            // Send to recipient
            io.to(`user_${to}`).emit('newMessage', {
                message: message,
                from: from
            });

            // Send back to sender
            socket.emit('messageSent', {
                message: message
            });
        } catch (error) {
            console.error('Error sending message:', error);
            socket.emit('messageError', { error: 'Failed to send message' });
        }
    });

    // Handle typing status
    socket.on('typing', (data) => {
        io.to(`user_${data.to}`).emit('userTyping', {
            from: socket.userId
        });
    });

    socket.on('stopTyping', (data) => {
        io.to(`user_${data.to}`).emit('userStoppedTyping', {
            from: socket.userId
        });
    });

    // Handle disconnect
    socket.on('disconnect', () => {
        console.log('User disconnected');
    });
});

// Start the server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});

module.exports = app;
