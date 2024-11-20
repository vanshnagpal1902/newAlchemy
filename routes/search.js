const express = require('express');
const router = express.Router();
const User = require('../models/User');
const { requireAuth } = require('../middleware/auth');

// Predefined skills list
const PREDEFINED_SKILLS = [
    "JavaScript",
    "Python",
    "Java",
    "C++",
    "C#",
    "Ruby",
    "Go",
    "Swift",
    "Kotlin",
    "PHP",
    "SQL",
    "TypeScript",
    "R",
    "HTML/CSS",
    "MATLAB",
    "Rust",
    "Scala"
];

// Get search by skills page
router.get('/skills', requireAuth, async (req, res) => {
    try {
        const { skills, university } = req.query;
        let users = [];

        // Get all unique universities
        const universities = await User.distinct('university');

        if (skills || university) {
            let query = { _id: { $ne: req.session.user.id } };

            if (skills) {
                const skillsArray = Array.isArray(skills) ? skills : [skills];
                query.skills = { $in: skillsArray };
            }

            if (university) {
                query.university = university.toLowerCase();
            }

            users = await User.find(query).select('username university skills');
        }

        res.render('search/skills', {
            users,
            universities,
            allSkills: PREDEFINED_SKILLS,
            user: req.session.user,
            selectedSkills: skills ? (Array.isArray(skills) ? skills : [skills]) : [],
            selectedUniversity: university || ''
        });
    } catch (error) {
        console.error('Search error:', error);
        res.status(500).send('Error searching users');
    }
});

// Search users by skills and/or university
router.get('/users', requireAuth, async (req, res) => {
    try {
        const { skills, university } = req.query;
        let query = { _id: { $ne: req.session.user.id } };

        if (skills) {
            const skillsArray = Array.isArray(skills) ? skills : skills.split(',');
            query.skills = { 
                $in: skillsArray.map(skill => new RegExp(skill.trim(), 'i'))
            };
        }

        if (university) {
            query.university = university.toLowerCase();
        }

        const users = await User.find(query)
            .select('username university skills')
            .lean();

        res.json(users);
    } catch (error) {
        console.error('Error searching users:', error);
        res.status(500).json({ error: 'Failed to search users' });
    }
});

module.exports = router; 