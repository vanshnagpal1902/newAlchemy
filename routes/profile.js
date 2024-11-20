const express = require('express');
const router = express.Router();
const User = require('../models/User');
const { requireAuth } = require('../middleware/auth');

// Get profile page
router.get('/', requireAuth, async (req, res) => {
    try {
        // Fetch complete user data including fullName, description, and university
        const user = await User.findById(req.session.user.id).select('-password');
        
        // Log the fetched user data for debugging
        console.log('Fetched user:', user);

        // Render profile with all user data
        res.render('profile', { 
            user: {
                username: user.username,
                email: user.email,
                fullName: user.fullName || '',
                skills: user.skills || [],
                interests: user.interests || [],
                description: user.description || '',
                university: user.university || ''
            },
            title: 'Profile'
        });
    } catch (error) {
        console.error('Error fetching profile:', error);
        res.status(500).json({ error: 'Failed to fetch profile' });
    }
});

// Update profile
router.post('/update', requireAuth, async (req, res) => {
    try {
        const { fullName, skills, interests, description, university } = req.body;
        
        // Debug log
        console.log('Update request body:', req.body);
        
        if (skills && skills.length < 5) {
            return res.status(400).json({ error: 'Please select at least 5 skills' });
        }

        // Convert university to lowercase before saving
        const universityLowerCase = university ? university.toLowerCase() : '';

        // Update user with all fields
        const updatedUser = await User.findByIdAndUpdate(
            req.session.user.id,
            { 
                $set: {
                    fullName,
                    skills, 
                    interests, 
                    description,
                    university: universityLowerCase,
                    profileCompleted: true
                }
            },
            { new: true, runValidators: true }
        );

        // Update session with new user data
        req.session.user = {
            ...req.session.user,
            fullName: updatedUser.fullName,
            skills: updatedUser.skills,
            interests: updatedUser.interests,
            description: updatedUser.description,
            university: updatedUser.university,
            profileCompleted: true
        };

        // Save the updated session
        await new Promise((resolve, reject) => {
            req.session.save((err) => {
                if (err) reject(err);
                else resolve();
            });
        });

        // Debug log
        console.log('Updated user:', updatedUser);
        console.log('Updated session:', req.session.user);

        // Return the updated user data
        res.json({
            fullName: updatedUser.fullName,
            skills: updatedUser.skills,
            interests: updatedUser.interests,
            description: updatedUser.description,
            university: updatedUser.university,
            profileCompleted: true
        });
    } catch (error) {
        console.error('Error updating profile:', error);
        res.status(500).json({ error: 'Failed to update profile' });
    }
});

// Delete account
router.delete('/delete', requireAuth, async (req, res) => {
    try {
        await User.findByIdAndDelete(req.session.user.id);
        req.session.destroy((err) => {
            if (err) {
                return res.status(500).json({ error: 'Failed to logout after account deletion' });
            }
            res.json({ success: true });
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete account' });
    }
});

// Add this new route to get current user data
router.get('/current', requireAuth, async (req, res) => {
    try {
        const user = await User.findById(req.session.user.id)
            .select('applications');
        res.json(user);
    } catch (error) {
        console.error('Error fetching current user:', error);
        res.status(500).json({ error: 'Failed to fetch user data' });
    }
});

module.exports = router; 