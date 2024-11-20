const express = require('express');
const router = express.Router();
const Message = require('../models/Message');
const User = require('../models/User');
const { requireAuth } = require('../middleware/auth');
const mongoose = require('mongoose');
const ObjectId = mongoose.Types.ObjectId;

// Get messages page
router.get('/', requireAuth, async (req, res) => {
    try {
        // Get target user from query params if provided
        let targetUser = null;
        if (req.query.userId) {
            targetUser = await User.findById(req.query.userId);
            if (!targetUser) {
                return res.status(404).send('User not found');
            }
        }

        // Pass both the current user and target user to the view
        res.render('messages', {
            user: req.session.user,
            targetUser: targetUser,
            title: 'Messages'
        });
    } catch (error) {
        console.error('Error loading messages page:', error);
        res.status(500).send('Error loading messages page');
    }
});

// Get all chats for the current user
router.get('/chats', requireAuth, async (req, res) => {
    try {
        const userId = req.session.user.id;
        
        // Find all messages where the current user is either sender or recipient
        const messages = await Message.aggregate([
            {
                $match: {
                    $or: [
                        { sender: new ObjectId(userId) },
                        { recipient: new ObjectId(userId) }
                    ]
                }
            },
            {
                $sort: { createdAt: -1 }
            },
            {
                $group: {
                    _id: {
                        $cond: [
                            { $eq: ['$sender', new ObjectId(userId)] },
                            '$recipient',
                            '$sender'
                        ]
                    },
                    lastMessage: { $first: '$content' },
                    lastMessageDate: { $first: '$createdAt' },
                    unreadCount: {
                        $sum: {
                            $cond: [
                                { 
                                    $and: [
                                        { $eq: ['$recipient', new ObjectId(userId)] },
                                        { $eq: ['$read', false] }
                                    ]
                                },
                                1,
                                0
                            ]
                        }
                    }
                }
            },
            { $sort: { lastMessageDate: -1 } }
        ]);

        // Get user details for each chat
        const userIds = messages.map(m => m._id);
        const users = await User.find({ _id: { $in: userIds } });

        const chats = messages.map(msg => {
            const user = users.find(u => u._id.toString() === msg._id.toString());
            return {
                userId: msg._id,
                username: user ? user.username : 'Unknown User',
                lastMessage: msg.lastMessage,
                lastMessageDate: msg.lastMessageDate,
                unreadCount: msg.unreadCount
            };
        });

        res.json(chats);
    } catch (error) {
        console.error('Error fetching chats:', error);
        res.status(500).json({ error: 'Failed to fetch chats' });
    }
});

// Get chat messages between current user and another user
router.get('/chat/:userId', requireAuth, async (req, res) => {
    try {
        const currentUserId = req.session.user.id;
        const otherUserId = req.params.userId;

        // Fetch messages between the two users
        const messages = await Message.find({
            $or: [
                { sender: currentUserId, recipient: otherUserId },
                { sender: otherUserId, recipient: currentUserId }
            ]
        })
        .sort({ createdAt: 1 }); // Sort by timestamp ascending

        // Mark messages as read
        await Message.updateMany(
            {
                recipient: currentUserId,
                sender: otherUserId,
                read: false
            },
            { $set: { read: true } }
        );

        res.json(messages);
    } catch (error) {
        console.error('Error fetching chat messages:', error);
        res.status(500).json({ error: 'Failed to fetch messages' });
    }
});

// Send a new message
router.post('/send', requireAuth, async (req, res) => {
    try {
        const { recipientId, content } = req.body;
        const senderId = req.session.user.id;

        const newMessage = new Message({
            sender: senderId,
            recipient: recipientId,
            content: content,
            read: false
        });

        await newMessage.save();

        // Emit socket event for real-time updates
        req.app.get('io').emit('new message', {
            message: newMessage,
            recipientId: recipientId
        });

        res.json({ success: true, message: newMessage });
    } catch (error) {
        console.error('Error sending message:', error);
        res.status(500).json({ error: 'Failed to send message' });
    }
});

// Mark messages as read
router.post('/read/:userId', requireAuth, async (req, res) => {
    try {
        const currentUserId = req.session.user.id;
        const otherUserId = req.params.userId;

        await Message.updateMany(
            {
                recipient: currentUserId,
                sender: otherUserId,
                read: false
            },
            { $set: { read: true } }
        );

        res.json({ success: true });
    } catch (error) {
        console.error('Error marking messages as read:', error);
        res.status(500).json({ error: 'Failed to mark messages as read' });
    }
});

module.exports = router; 