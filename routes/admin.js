const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Post = require('../models/Post');

// Admin middleware
const isAdmin = (req, res, next) => {
    if (!req.session.user || !req.session.user.isAdmin) {
        return res.status(403).json({ error: 'Access denied' });
    }
    next();
};

// Get admin dashboard
router.get('/', isAdmin, async (req, res) => {
    try {
        const users = await User.countDocuments({ profileCompleted: true });
        const posts = await Post.countDocuments();
        
        res.render('admin/dashboard', { 
            activeUsers: users,
            totalPosts: posts
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to load admin dashboard' });
    }
});

// Delete user
router.delete('/users/:userId', isAdmin, async (req, res) => {
    try {
        await User.findByIdAndDelete(req.params.userId);
        await Post.deleteMany({ author: req.params.userId });
        res.json({ message: 'User deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete user' });
    }
});

// Delete post
router.delete('/posts/:postId', isAdmin, async (req, res) => {
    try {
        await Post.findByIdAndDelete(req.params.postId);
        res.json({ message: 'Post deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete post' });
    }
});

module.exports = router; 