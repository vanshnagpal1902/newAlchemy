const express = require('express');
const router = express.Router();
const multer = require('multer');
const Project = require('../models/Project');
const { requireAuth } = require('../middleware/auth');
const Request = require('../models/Request');
const User = require('../models/User');

// Configure multer for file upload
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'public/uploads/') // Make sure this directory exists
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + '-' + file.originalname)
    }
});

const upload = multer({ storage: storage });

// Add this middleware to check profile completion
const checkProfileComplete = async (req, res, next) => {
    try {
        const user = await User.findById(req.session.user.id);
        if (!user.profileCompleted) {
            return res.status(403).json({ 
                error: 'Please complete your profile before adding projects or applying for positions',
                redirectTo: '/profile'
            });
        }
        next();
    } catch (error) {
        res.status(500).json({ error: 'Failed to check profile status' });
    }
};

// GET route for add project page
router.get('/add', requireAuth, (req, res) => {
    res.render('projects/add', { 
        user: req.session.user,
        title: 'Add Project'
    });
});

// Handle project creation
router.post('/add', requireAuth, checkProfileComplete, upload.single('projectImage'), async (req, res) => {
    try {
        const { title, description, category, teamSize } = req.body;
        const imagePath = req.file ? `/uploads/${req.file.filename}` : null;

        // Parse and validate positions
        let positions = [];
        if (req.body.positions) {
            try {
                positions = JSON.parse(req.body.positions);
                
                // Validate positions array
                if (!Array.isArray(positions)) {
                    throw new Error('Positions must be an array');
                }

                // Filter out any invalid positions
                positions = positions.filter(pos => 
                    pos.title && pos.title.trim() !== '' &&
                    pos.description && pos.description.trim() !== ''
                );

                if (positions.length === 0) {
                    throw new Error('At least one valid position is required');
                }

            } catch (e) {
                console.error('Error processing positions:', e);
                return res.status(400).json({ 
                    error: 'Invalid positions data',
                    details: e.message 
                });
            }
        }

        // Format team size
        let formattedTeamSize = teamSize;
        if (teamSize === '1-2') formattedTeamSize = '1';
        else if (teamSize === '3-5') formattedTeamSize = '2';
        else if (teamSize === '5-10') formattedTeamSize = '3';
        else if (teamSize === '10+') formattedTeamSize = '4';

        // Create project with validated data
        const newProject = new Project({
            title,
            description,
            category,
            teamSize: formattedTeamSize,
            image: imagePath,
            adminName: req.session.user.username,
            positions: positions.map(pos => ({
                title: pos.title.trim(),
                description: pos.description.trim()
            })),
            author: req.session.user.id
        });

        await newProject.save();
        
        console.log('Project created successfully:', {
            id: newProject._id,
            title: newProject.title,
            positionsCount: newProject.positions.length
        });

        res.json({ 
            success: true, 
            message: 'Project added successfully',
            project: {
                id: newProject._id,
                title: newProject.title
            }
        });
    } catch (error) {
        // If it's a validation error, send a more specific message
        if (error.name === 'ValidationError') {
            return res.status(400).json({
                error: 'Please fill in all required fields',
                details: Object.values(error.errors).map(err => err.message)
            });
        }

        console.error('Error creating project:', error);
        res.status(500).json({ 
            error: 'Failed to create project',
            details: error.message 
        });
    }
});

// Get all projects for dashboard
router.get('/all', requireAuth, async (req, res) => {
    try {
        const projects = await Project.find()
            .sort({ createdAt: -1 })
            .populate({
                path: 'author',
                select: 'username university'
            });
        
        res.json(projects);
    } catch (error) {
        console.error('Error fetching projects:', error);
        res.status(500).json({ error: 'Failed to fetch projects' });
    }
});

// Handle project application
router.post('/apply', requireAuth, checkProfileComplete, async (req, res) => {
    try {
        const { projectId, positionTitle, reason, experience } = req.body;
        const applicant = req.session.user;

        // First, fetch the project to get the author
        const project = await Project.findById(projectId);
        if (!project) {
            return res.status(404).json({ error: 'Project not found' });
        }

        // Check if the user has already applied for this position
        const user = await User.findById(applicant.id);
        const hasApplied = user.applications && user.applications.some(app => 
            app.projectId.toString() === projectId && 
            app.positionTitle === positionTitle
        );

        if (hasApplied) {
            return res.status(400).json({ error: 'You have already applied for this position' });
        }

        // Create application request
        const application = new Request({
            type: 'project_application',
            project: projectId,
            from: applicant.id,
            to: project.author,
            position: {
                title: positionTitle
            },
            details: {
                reason: reason,
                experience: experience
            },
            status: 'pending'
        });

        await application.save();

        // Add application to user's applications array
        if (!user.applications) {
            user.applications = [];
        }
        
        const newApplication = {
            projectId: projectId,
            positionTitle: positionTitle,
            appliedAt: new Date()
        };
        
        user.applications.push(newApplication);
        await user.save();

        // Update the session with the new application
        if (!req.session.user.applications) {
            req.session.user.applications = [];
        }
        req.session.user.applications.push(newApplication);
        await req.session.save();

        console.log('Application submitted - User applications:', user.applications); // Debug log
        console.log('Application submitted - Session user:', req.session.user); // Debug log

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

// GET route for user's projects
router.get('/your', requireAuth, async (req, res) => {
    try {
        const projects = await Project.find({ author: req.session.user.id })
            .sort({ createdAt: -1 });

        res.render('projects/yourProjects', {
            user: req.session.user,
            projects: projects,
            title: 'Your Projects'
        });
    } catch (error) {
        console.error('Error fetching user projects:', error);
        res.status(500).json({ error: 'Failed to fetch projects' });
    }
});

// GET route for dashboard
router.get('/dashboard', requireAuth, async (req, res) => {
    try {
        // Fetch the complete user data including applications
        const user = await User.findById(req.session.user.id);
        
        // Fetch all projects with their authors
        const projects = await Project.find()
            .populate('author', 'username');

        // Update session with latest applications data
        if (user.applications) {
            req.session.user = {
                ...req.session.user,
                applications: user.applications
            };
            await req.session.save(); // Make sure to save the session
        }

        console.log('User applications:', user.applications); // Debug log
        console.log('Session user:', req.session.user); // Debug log

        res.render('dashboard', { 
            user: user,
            projects: projects,
            title: 'Dashboard'
        });
    } catch (error) {
        console.error('Error fetching projects:', error);
        res.status(500).json({ error: 'Failed to fetch projects' });
    }
});

// Delete project
router.delete('/:projectId', requireAuth, async (req, res) => {
    try {
        const project = await Project.findById(req.params.projectId);
        
        // Check if project exists and user is the owner
        if (!project) {
            return res.status(404).json({ error: 'Project not found' });
        }
        if (project.author.toString() !== req.session.user.id) {
            return res.status(403).json({ error: 'Unauthorized' });
        }

        await Project.findByIdAndDelete(req.params.projectId);
        res.json({ success: true, message: 'Project deleted successfully' });
    } catch (error) {
        console.error('Error deleting project:', error);
        res.status(500).json({ error: 'Failed to delete project' });
    }
});

// Get project for editing
router.get('/edit/:projectId', requireAuth, async (req, res) => {
    try {
        const project = await Project.findById(req.params.projectId);
        
        if (!project) {
            return res.status(404).json({ error: 'Project not found' });
        }
        if (project.author.toString() !== req.session.user.id) {
            return res.status(403).json({ error: 'Unauthorized' });
        }

        res.render('projects/edit', { project });
    } catch (error) {
        console.error('Error fetching project:', error);
        res.status(500).json({ error: 'Failed to fetch project' });
    }
});

// Update project
router.put('/:projectId', requireAuth, upload.single('projectImage'), async (req, res) => {
    try {
        const project = await Project.findById(req.params.projectId);
        
        if (!project) {
            return res.status(404).json({ error: 'Project not found' });
        }
        if (project.author.toString() !== req.session.user.id) {
            return res.status(403).json({ error: 'Unauthorized' });
        }

        const { title, description, category, teamSize, positions } = req.body;
        const imagePath = req.file ? `/uploads/${req.file.filename}` : project.image;

        // Ensure teamSize is in the correct format
        let formattedTeamSize = teamSize;
        // Convert old format to new format if necessary
        if (teamSize === '1-2') formattedTeamSize = '1';
        else if (teamSize === '3-5') formattedTeamSize = '2';
        else if (teamSize === '5-10') formattedTeamSize = '3';
        else if (teamSize === '10+') formattedTeamSize = '4';

        const updatedProject = await Project.findByIdAndUpdate(
            req.params.projectId,
            {
                title,
                description,
                category,
                teamSize: formattedTeamSize,
                image: imagePath,
                positions: JSON.parse(positions)
            },
            { new: true }
        );

        res.json({ success: true, project: updatedProject });
    } catch (error) {
        console.error('Error updating project:', error);
        res.status(500).json({ error: 'Failed to update project' });
    }
});

// Update the save route
router.post('/save/:projectId', requireAuth, async (req, res) => {
    try {
        const user = await User.findById(req.session.user.id);
        const projectId = req.params.projectId;

        // Check if project exists
        const project = await Project.findById(projectId);
        if (!project) {
            return res.status(404).json({ error: 'Project not found' });
        }

        // Initialize savedProjects array if it doesn't exist
        if (!user.savedProjects) {
            user.savedProjects = [];
        }

        const savedProjectIndex = user.savedProjects.findIndex(
            sp => sp.projectId.toString() === projectId.toString()
        );

        let saved = false;
        if (savedProjectIndex === -1) {
            // Save project
            user.savedProjects.push({ projectId });
            saved = true;
        } else {
            // Unsave project
            user.savedProjects.splice(savedProjectIndex, 1);
        }

        await user.save();

        // Update the session user data
        req.session.user = {
            ...req.session.user,
            savedProjects: user.savedProjects
        };

        await req.session.save();

        res.json({ 
            success: true, 
            saved,
            message: saved ? 'Project saved successfully' : 'Project removed from saved'
        });
    } catch (error) {
        console.error('Error toggling save:', error);
        res.status(500).json({ error: 'Failed to toggle save' });
    }
});

// Update the saved projects route
router.get('/saved', requireAuth, async (req, res) => {
    try {
        const user = await User.findById(req.session.user.id);
        const savedProjectIds = user.savedProjects.map(sp => sp.projectId);
        const savedProjects = await Project.find({
            '_id': { $in: savedProjectIds }
        }).populate({
            path: 'author',
            select: 'username university'
        });

        // Helper function to truncate text
        const truncateText = (text, limit, type, title) => {
            if (!text) return 'No description available';
            
            // Clean and normalize the text
            const cleanText = text.replace(/\s+/g, ' ').trim();
            
            if (cleanText.length <= limit) {
                return `<div class="truncated-text">${cleanText}</div>`;
            }
            
            // Find the last complete word within the limit
            let truncated = cleanText.substr(0, limit);
            truncated = truncated.substr(0, Math.min(truncated.length, truncated.lastIndexOf(' ')));
            
            // Escape special characters for HTML attributes
            const escapedTitle = title.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
            const escapedText = cleanText.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
            
            return `
                <div class="truncated-text">
                    ${truncated}...
                    <span class="read-more-btn" 
                        data-title="${escapedTitle}"
                        data-description="${escapedText}"
                        data-type="${type}"
                        onclick="showFullDescription(this)">
                        Read More
                    </span>
                </div>`;
        };

        res.render('projects/savedProjects', {
            user: req.session.user,
            projects: savedProjects,
            truncateText
        });
    } catch (error) {
        console.error('Error loading saved projects:', error);
        res.status(500).send('Error loading saved projects');
    }
});

module.exports = router; 