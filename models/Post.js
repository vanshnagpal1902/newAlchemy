const mongoose = require('mongoose');

// Define position schema without _id
const positionSchema = new mongoose.Schema({
    title: String,
    description: String
}, { _id: false }); // This prevents Mongoose from creating _id for subdocuments

const postSchema = new mongoose.Schema({
    title: { type: String, required: true },
    description: { type: String, required: true },
    category: { type: String, required: true },
    teamSize: { type: String, required: true },
    image: String,
    author: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    positions: {
        type: [positionSchema],
        default: []
    },
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Post', postSchema); 