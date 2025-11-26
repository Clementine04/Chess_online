const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    username: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        minlength: 3
    },
    password: {
        type: String,
        required: true,
        minlength: 6
    },
    eloRating: {
        type: Number,
        default: 600
    },
    gamesPlayed: {
        type: Number,
        default: 0
    },
    wins: {
        type: Number,
        default: 0
    },
    losses: {
        type: Number,
        default: 0
    },
    draws: {
        type: Number,
        default: 0
    },
    boardTheme: {
        type: String,
        default: 'green',
        enum: ['green', 'blue', 'purple', 'brown']
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

// Index for faster queries (username already has unique: true which creates an index)
userSchema.index({ eloRating: -1 });

module.exports = mongoose.model('User', userSchema);

