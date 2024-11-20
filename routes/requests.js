const express = require('express');
const router = express.Router();
const Request = require('../models/Request');
const Project = require('../models/Project');
const Message = require('../models/Message');
const User = require('../models/User');
const { requireAuth } = require('../middleware/auth');
const { sendRequestNotification } = require('../utils/mailer');

// Add the checkProfileComplete middleware
const checkProfileComplete = async (req, res, next) => {
    try {
        const user = await User.findById(req.session.user.id);
        if (!user.profileCompleted) {
            return res.status(403).json({ 
                error: 'Please complete your profile before applying for positions',
                redirectTo: '/profile'
            });
        }
        next();
    } catch (error) {
        res.status(500).json({ error: 'Failed to check profile status' });
    }
};

// Get all requests for the user
router.get('/', requireAuth, (req, res) => {
    res.redirect('/requests/received');
});

// Get received requests
router.get('/received', requireAuth, async (req, res) => {
    try {
        const requests = await Request.find({ to: req.session.user.id })
            .populate('from', 'username email')
            .populate('to', 'username email')
            .populate('project', 'title')
            .populate('position', 'title')
            .sort({ createdAt: -1 });

        // Filter out any requests with missing data
        const validRequests = requests.filter(request => 
            request.to && 
            request.from && 
            request.project
        );

        res.render('requests', { 
            requests: validRequests,
            user: req.session.user,
            type: 'received'
        });
    } catch (error) {
        console.error('Error fetching received requests:', error);
        res.status(500).send('Error fetching requests');
    }
});

// Get sent requests
router.get('/sent', requireAuth, async (req, res) => {
    try {
        const requests = await Request.find({ from: req.session.user.id })
            .populate('from', 'username email')
            .populate('to', 'username email')
            .populate('project', 'title')
            .populate('position', 'title')
            .sort({ createdAt: -1 });

        // Filter out any requests with missing data
        const validRequests = requests.filter(request => 
            request.to && 
            request.from && 
            request.project
        );

        res.render('requests', { 
            requests: validRequests,
            user: req.session.user,
            type: 'sent'
        });
    } catch (error) {
        console.error('Error fetching sent requests:', error);
        res.status(500).send('Error fetching requests');
    }
});

// Handle request response (accept/reject)
router.post('/:requestId/respond', requireAuth, async (req, res) => {
    try {
        const { status } = req.body;
        
        // First, send the response immediately
        res.json({ 
            success: true, 
            message: `Request ${status} successfully` 
        });

        // Then handle all the background tasks
        const request = await Request.findById(req.params.requestId)
            .populate('from', 'username email')
            .populate('project', 'title')
            .populate('position', 'title')
            .populate('to', 'username email');

        if (!request) {
            console.error('Request not found:', req.params.requestId);
            return;
        }

        // Update request status
        request.status = status;
        await request.save();

        // Handle background tasks asynchronously
        Promise.all([
            // Update project team size if accepted
            (async () => {
                if (status === 'accepted') {
                    try {
                        const project = await Project.findById(request.project);
                        if (project) {
                            let currentSize = parseInt(project.teamSize) || 1;
                            if (currentSize < 5) {
                                project.teamSize = (currentSize + 1).toString();
                            } else {
                                project.teamSize = '5+';
                            }
                            await project.save();
                        }
                    } catch (error) {
                        console.error('Error updating project team size:', error);
                    }
                }
            })(),

            // Send email notification
            (async () => {
                try {
                    if (request.from && request.from.email) {
                        sendRequestNotification(
                            request.from.email,
                            request.project.title,
                            status === 'accepted' ? 'application_accepted' : 'application_rejected'
                        ).catch(err => console.error('Email error:', err));
                    }
                } catch (error) {
                    console.error('Error sending notification email:', error);
                }
            })(),

            // Send in-app notification
            (async () => {
                try {
                    const notificationMessage = new Message({
                        sender: req.session.user.id,
                        recipient: request.from._id,
                        content: `Your application for the position "${request.position.title}" in project "${request.project.title}" has been ${status}`,
                        type: 'notification',
                        read: false
                    });
                    await notificationMessage.save();
                } catch (error) {
                    console.error('Error sending in-app notification:', error);
                }
            })()
        ]).catch(error => {
            console.error('Error in background tasks:', error);
        });

    } catch (error) {
        console.error('Error responding to request:', error);
        // Don't send error response since we already sent success
        // Just log it for debugging
    }
});

// Accept request
router.post('/:requestId/accept', requireAuth, async (req, res) => {
    try {
        // Fetch request with populated project data
        const request = await Request.findById(req.params.requestId)
            .populate('project');

        if (!request) {
            return res.status(404).json({ error: 'Request not found' });
        }

        // Check if user is authorized to accept this request
        if (request.to.toString() !== req.session.user.id) {
            return res.status(403).json({ error: 'Unauthorized' });
        }

        // Update request status
        request.status = 'accepted';
        await request.save();

        // Update project team size
        const project = await Project.findById(request.project._id);
        if (project) {
            // Convert current team size to number
            let currentSize = parseInt(project.teamSize) || 1;
            
            // Increment team size
            if (currentSize < 5) {
                project.teamSize = (currentSize + 1).toString();
            } else {
                project.teamSize = '5+';
            }
            
            await project.save();
        }

        // Send notification to the applicant
        const notificationMessage = new Message({
            sender: req.session.user.id,
            recipient: request.from,
            content: `Your application for ${request.project.title} has been accepted!`,
            type: 'notification'
        });
        await notificationMessage.save();

        res.json({ success: true, message: 'Request accepted and team size updated' });
    } catch (error) {
        console.error('Error accepting request:', error);
        res.status(500).json({ error: 'Failed to accept request' });
    }
});

// Handle project application
router.post('/apply', requireAuth, checkProfileComplete, async (req, res) => {
    try {
        console.log('\n=== Starting Application Process ===');
        console.log('Request received at /requests/apply');
        console.log('Headers:', req.headers);
        console.log('Session user:', req.session.user);
        console.log('Request body:', req.body);

        const { projectId, positionTitle, reason, experience } = req.body;
        const applicant = req.session.user;

        // Log the request body
        console.log('Parsed request data:', {
            projectId,
            positionTitle,
            reason,
            experience,
            applicant: {
                id: applicant.id,
                username: applicant.username,
                email: applicant.email
            }
        });

        // Fetch project with author details
        const project = await Project.findById(projectId)
            .populate({
                path: 'author',
                select: 'email username'
            });

        if (!project) {
            console.error('Project not found:', projectId);
            return res.status(404).json({ error: 'Project not found' });
        }

        // Log project details
        console.log('Found project:', {
            id: project._id,
            title: project.title,
            author: {
                id: project.author._id,
                username: project.author.username,
                email: project.author.email
            }
        });

        // Fetch complete project owner details
        const projectOwner = await User.findById(project.author._id);
        if (!projectOwner) {
            console.error('Project owner not found:', project.author._id);
            return res.status(404).json({ error: 'Project owner not found' });
        }

        // Log project owner details
        console.log('Project owner details:', {
            id: projectOwner._id,
            username: projectOwner.username,
            email: projectOwner.email
        });

        // Create and save the application
        const application = new Request({
            type: 'project_application',
            project: projectId,
            from: applicant.id,
            to: projectOwner._id,
            position: {
                title: positionTitle
            },
            details: {
                reason,
                experience
            },
            status: 'pending'
        });

        await application.save();
        console.log('Application saved:', application._id);

        // Send email notification without waiting
        if (projectOwner.email) {
            sendRequestNotification(
                projectOwner.email,
                project.title,
                'project_application'
            ).catch(err => console.error('Email error:', err));
        }

        // Update applicant's applications array
        await User.findByIdAndUpdate(applicant.id, {
            $push: { 
                applications: {
                    projectId: projectId,
                    positionTitle: positionTitle,
                    appliedAt: new Date()
                }
            }
        });

        console.log('Application process completed successfully');
        res.json({ 
            success: true, 
            message: 'Application submitted successfully'
        });

    } catch (error) {
        console.error('Error submitting application:', error);
        res.status(500).json({ 
            error: 'Failed to submit application',
            details: error.message 
        });
    }
});

module.exports = router; 