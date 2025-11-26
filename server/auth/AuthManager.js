const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

class AuthManager {
    constructor() {
        // MongoDB is already connected via database.js
    }

    async register(username, password) {
        try {
            // Validate input
            if (!username || !password) {
                return { success: false, error: 'Username and password required' };
            }

            if (username.length < 3) {
                return { success: false, error: 'Username must be at least 3 characters' };
            }

            if (password.length < 6) {
                return { success: false, error: 'Password must be at least 6 characters' };
            }

            // Check if username already exists
            const existingUser = await User.findOne({ 
                username: { $regex: new RegExp(`^${username}$`, 'i') } 
            });
            
            if (existingUser) {
                return { success: false, error: 'Username already taken' };
            }

            // Hash password
            const hashedPassword = await bcrypt.hash(password, 10);

            // Create new user
            const newUser = await User.create({
                username: username,
                password: hashedPassword,
                eloRating: 600, // Starting Elo rating
                gamesPlayed: 0,
                wins: 0,
                losses: 0,
                draws: 0
            });

            // Generate token
            const token = jwt.sign(
                { userId: newUser._id, username: newUser.username }, 
                JWT_SECRET, 
                { expiresIn: '7d' }
            );

            return {
                success: true,
                token,
                user: {
                    id: newUser._id,
                    username: newUser.username,
                    eloRating: newUser.eloRating,
                    gamesPlayed: newUser.gamesPlayed,
                    wins: newUser.wins,
                    losses: newUser.losses,
                    draws: newUser.draws,
                    boardTheme: newUser.boardTheme || 'green'
                }
            };
        } catch (error) {
            console.error('Registration error:', error);
            return { success: false, error: 'Registration failed' };
        }
    }

    async login(username, password) {
        try {
            // Find user (case-insensitive)
            const user = await User.findOne({ 
                username: { $regex: new RegExp(`^${username}$`, 'i') } 
            });
            
            if (!user) {
                return { success: false, error: 'Invalid username or password' };
            }

            // Check password
            const validPassword = await bcrypt.compare(password, user.password);
            if (!validPassword) {
                return { success: false, error: 'Invalid username or password' };
            }

            // Generate token
            const token = jwt.sign(
                { userId: user._id, username: user.username }, 
                JWT_SECRET, 
                { expiresIn: '7d' }
            );

            return {
                success: true,
                token,
                user: {
                    id: user._id,
                    username: user.username,
                    eloRating: user.eloRating,
                    gamesPlayed: user.gamesPlayed,
                    wins: user.wins,
                    losses: user.losses,
                    draws: user.draws,
                    boardTheme: user.boardTheme || 'green'
                }
            };
        } catch (error) {
            console.error('Login error:', error);
            return { success: false, error: 'Login failed' };
        }
    }

    async verifyToken(token) {
        try {
            const decoded = jwt.verify(token, JWT_SECRET);
            const user = await User.findById(decoded.userId);
            
            if (!user) return null;

            return {
                id: user._id,
                username: user.username,
                eloRating: user.eloRating,
                gamesPlayed: user.gamesPlayed,
                wins: user.wins,
                losses: user.losses,
                draws: user.draws,
                boardTheme: user.boardTheme || 'green'
            };
        } catch (error) {
            return null;
        }
    }

    async getUserById(userId) {
        try {
            return await User.findById(userId);
        } catch (error) {
            console.error('Error fetching user:', error);
            return null;
        }
    }

    async updateUserStats(userId, result, ratingChange) {
        try {
            const user = await User.findById(userId);
            if (!user) return;

            user.gamesPlayed += 1;
            user.eloRating += ratingChange;

            if (result === 'win') {
                user.wins += 1;
            } else if (result === 'loss') {
                user.losses += 1;
            } else if (result === 'draw') {
                user.draws += 1;
            }

            await user.save();
        } catch (error) {
            console.error('Error updating user stats:', error);
        }
    }

    async getLeaderboard(limit = 10) {
        try {
            const users = await User.find()
                .sort({ eloRating: -1 })
                .limit(limit)
                .select('username eloRating gamesPlayed wins losses draws');

            return users.map(u => ({
                username: u.username,
                eloRating: u.eloRating,
                gamesPlayed: u.gamesPlayed,
                wins: u.wins,
                losses: u.losses,
                draws: u.draws
            }));
        } catch (error) {
            console.error('Error fetching leaderboard:', error);
            return [];
        }
    }

    async updateBoardTheme(userId, theme) {
        try {
            const user = await User.findById(userId);
            if (!user) return { success: false, error: 'User not found' };

            user.boardTheme = theme;
            await user.save();

            return { success: true };
        } catch (error) {
            console.error('Error updating board theme:', error);
            return { success: false, error: 'Failed to update theme' };
        }
    }
}

module.exports = AuthManager;
