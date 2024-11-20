const express = require('express');
const router = express.Router();
const Message = require('../models/Message');
const Request = require('../models/Request');
const { requireAuth } = require('../middleware/auth');

router.get('/counts', requireAuth, async (req, res) => {
    try {
        const userId = req.session.user.id;
        
        // Get unread message count
        const messageCount = await Message.countDocuments({
            recipient: userId,
            read: false
        });
        
        // Get pending request count
        const requestCount = await Request.countDocuments({
            to: userId,
            status: 'pending'
        });
        
        res.json({
            messages: messageCount,
            requests: requestCount
        });
    } catch (error) {
        console.error('Error fetching notification counts:', error);
        res.status(500).json({ error: 'Failed to fetch notification counts' });
    }
});

module.exports = router; 