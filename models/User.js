const mongoose = require('mongoose');

const applicationSchema = new mongoose.Schema({
    projectId: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'Project',
        required: true 
    },
    positionTitle: { 
        type: String, 
        required: true 
    },
    appliedAt: { 
        type: Date, 
        default: Date.now 
    }
});

const userSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    fullName: { type: String, default: '' },
    description: { type: String, default: '' },
    skills: [String],
    interests: [String],
    role: { type: String, default: 'user', enum: ['user', 'admin'] },
    isAdmin: { type: Boolean, default: false },
    profileCompleted: { type: Boolean, default: false },
    applications: [applicationSchema],
    university: { 
        type: String,
        set: v => v.toLowerCase()
    },
    createdAt: { type: Date, default: Date.now },
    savedProjects: [{
        projectId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Project'
        }
    }]
});

userSchema.pre('save', function(next) {
    if (this.university) {
        this.university = this.university.toLowerCase();
    }
    next();
});

userSchema.set('toJSON', {
    transform: function(doc, ret) {
        return {
            ...ret,
            fullName: ret.fullName || '',
            description: ret.description || ''
        };
    }
});

module.exports = mongoose.model('User', userSchema); 