const express = require('express');
const router = express.Router();
const Post = require('../models/Post');
const User = require('../models/User');
const Message = require('../models/Message');
const Request = require('../models/Request');
const { requireAuth } = require('../middleware/auth');

// Search routes
router.get('/search/posts', requireAuth, async (req, res) => {
    try {
        const { college, teamSize, category, query } = req.query;
        let searchQuery = {};

        if (college) searchQuery.college = college;
        if (teamSize) searchQuery.teamSize = teamSize;
        if (category) searchQuery.category = category;
        if (query) {
            searchQuery.$or = [
                { title: { $regex: query, $options: 'i' } },
                { description: { $regex: query, $options: 'i' } }
            ];
        }

        const posts = await Post.find(searchQuery).populate('author', 'username');
        res.json(posts);
    } catch (error) {
        res.status(500).json({ error: 'Search failed' });
    }
});

// Notification routes
router.get('/notifications/counts', requireAuth, async (req, res) => {
    try {
        const userId = req.session.user.id;
        
        const messageCount = await Message.countDocuments({
            recipient: userId,
            read: false
        });
        
        const requestCount = await Request.countDocuments({
            recipient: userId,
            status: 'pending'
        });
        
        res.json({
            messages: messageCount,
            requests: requestCount
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch notification counts' });
    }
});

module.exports = router; 