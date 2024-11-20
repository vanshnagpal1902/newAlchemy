const express = require('express');
const router = express.Router();
const User = require('../models/User');
const OTP = require('../models/OTP');
const bcrypt = require('bcryptjs');
const { sendVerificationOTP, sendPasswordEmail } = require('../utils/mailer');

// Generate 6-digit OTP
const generateOTP = () => {
    return Math.floor(100000 + Math.random() * 900000).toString();
};

// Login page
router.get('/login', (req, res) => {
    res.render('auth/home');
});

// Signup page
router.get('/signup', (req, res) => {
    res.render('auth/signup');
});

// Login POST
router.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        
        // Validate input
        if (!username || !password) {
            return res.status(400).json({ error: 'Username and password are required' });
        }

        // Find user
        const user = await User.findOne({ username });
        
        if (!user) {
            return res.status(400).json({ error: 'User not found' });
        }

        // Compare passwords directly (since we're storing plain text)
        if (password !== user.password) {
            return res.status(400).json({ error: 'Invalid password' });
        }

        // Set session data
        req.session.user = {
            id: user._id,
            username: user.username,
            email: user.email,
            role: user.role,
            isAdmin: user.role === 'admin',
            applications: user.applications || [],
            fullName: user.fullName,
            skills: user.skills,
            interests: user.interests,
            description: user.description,
            university: user.university,
            profileCompleted: user.profileCompleted
        };

        await req.session.save();

        res.json({ success: true });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Login failed' });
    }
});

// Signup POST - First step
router.post('/signup', async (req, res) => {
    try {
        const { username, email, password } = req.body;
        
        // Validate input
        if (!username || !email || !password) {
            return res.status(400).json({ error: 'All fields are required' });
        }

        // Check if user exists
        const existingUser = await User.findOne({ 
            $or: [{ email }, { username }] 
        });
        
        if (existingUser) {
            return res.status(400).json({ 
                error: 'Username or email already exists' 
            });
        }

        // Generate OTP
        const otp = generateOTP();
        
        try {
            // Send verification email
            await sendVerificationOTP(email, otp);
            
            // Save OTP
            await OTP.create({
                email,
                otp: await bcrypt.hash(otp, 10)
            });

            // Store user data in session
            req.session.pendingUser = {
                username,
                email,
                password
            };

            res.json({ 
                success: true, 
                message: 'Verification code sent to your email'
            });
        } catch (emailError) {
            console.error('Email sending failed:', emailError);
            res.status(500).json({ 
                error: 'Failed to send verification email' 
            });
        }
    } catch (error) {
        console.error('Signup error:', error);
        res.status(500).json({ error: 'Signup failed' });
    }
});

// Verify OTP and complete signup
router.post('/verify-otp', async (req, res) => {
    try {
        const { otp } = req.body;
        const pendingUser = req.session.pendingUser;

        if (!pendingUser) {
            return res.status(400).json({ error: 'No pending registration found' });
        }

        // Find the stored OTP
        const otpDoc = await OTP.findOne({ email: pendingUser.email });
        if (!otpDoc) {
            return res.status(400).json({ error: 'OTP expired. Please try again' });
        }

        // Verify OTP
        const validOTP = await bcrypt.compare(otp, otpDoc.otp);
        if (!validOTP) {
            return res.status(400).json({ error: 'Invalid OTP' });
        }

        // Create new user with plain text password
        const user = new User({
            username: pendingUser.username,
            email: pendingUser.email,
            password: pendingUser.password,  // Store password directly
            role: 'user'
        });

        await user.save();

        // Clear session and OTP
        delete req.session.pendingUser;
        await OTP.deleteOne({ email: pendingUser.email });

        res.json({ 
            success: true, 
            message: 'Email verified successfully. Please login.'
        });
    } catch (error) {
        console.error('Verification error:', error);
        res.status(500).json({ error: 'Verification failed' });
    }
});

// Logout
router.get('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            return res.status(500).json({ error: 'Failed to logout' });
        }
        res.redirect('/');
    });
});

// Add these routes
router.get('/forgot-password', (req, res) => {
    res.render('auth/forgot-password');
});

router.post('/forgot-password', async (req, res) => {
    try {
        const { username } = req.body;
        
        // Find user by username
        const user = await User.findOne({ username });
        
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Send password to user's email
        try {
            await sendPasswordEmail(user.email, user.password);  // Password is already in plain text
            res.json({ 
                success: true, 
                message: 'Password has been sent to your email. Redirecting to login...' 
            });
        } catch (emailError) {
            console.error('Failed to send password email:', emailError);
            res.status(500).json({ error: 'Failed to send password email' });
        }
    } catch (error) {
        console.error('Forgot password error:', error);
        res.status(500).json({ error: 'Failed to process request' });
    }
});

module.exports = router; 