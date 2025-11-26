const ChessGame = require('../game/ChessGame');
const { v4: uuidv4 } = require('uuid');

class GameRoom {
    constructor() {
        this.games = new Map();
        this.playerGameMap = new Map(); // playerId -> gameId
        this.gameCodeMap = new Map(); // gameCode -> gameId
        this.waitingPlayers = [];
    }

    // Generate a random 6-character game code
    generateGameCode() {
        const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let code = '';
        for (let i = 0; i < 6; i++) {
            code += characters.charAt(Math.floor(Math.random() * characters.length));
        }
        
        // Make sure code is unique
        if (this.gameCodeMap.has(code)) {
            return this.generateGameCode();
        }
        
        return code;
    }

    // Create a private game with a code
    createPrivateGame(playerId, playerName, timeControl = 'blitz') {
        // Check if player is already in a game
        if (this.playerGameMap.has(playerId)) {
            const gameId = this.playerGameMap.get(playerId);
            const existingGame = this.games.get(gameId);
            return { game: existingGame, code: this.getGameCode(gameId) };
        }

        const gameId = uuidv4();
        const gameCode = this.generateGameCode();
        const game = new ChessGame(gameId, timeControl);
        game.isPrivate = true;
        game.gameCode = gameCode;
        game.timeControl = timeControl; // Ensure time control is set
        game.addPlayer(playerId, playerName);
        
        this.games.set(gameId, game);
        this.gameCodeMap.set(gameCode, gameId);
        this.playerGameMap.set(playerId, gameId);
        
        console.log(`Private game created: ${gameCode} with time control: ${timeControl}`);
        
        return { game, code: gameCode };
    }

    // Join a private game using a code
    joinPrivateGame(playerId, playerName, gameCode) {
        gameCode = gameCode.toUpperCase().trim();
        
        // Check if player is already in a game
        if (this.playerGameMap.has(playerId)) {
            const gameId = this.playerGameMap.get(playerId);
            return { success: false, error: 'You are already in a game' };
        }

        // Check if game code exists
        if (!this.gameCodeMap.has(gameCode)) {
            return { success: false, error: 'Invalid game code' };
        }

        const gameId = this.gameCodeMap.get(gameCode);
        const game = this.games.get(gameId);

        if (!game) {
            return { success: false, error: 'Game not found' };
        }

        if (game.isFull()) {
            return { success: false, error: 'Game is already full' };
        }

        const color = game.addPlayer(playerId, playerName);
        if (color) {
            this.playerGameMap.set(playerId, gameId);
            console.log(`Player ${playerName} joined private game ${gameCode} as ${color}`);
            return { success: true, game, code: gameCode };
        }

        return { success: false, error: 'Failed to join game' };
    }

    getGameCode(gameId) {
        for (const [code, id] of this.gameCodeMap) {
            if (id === gameId) return code;
        }
        return null;
    }

    findOrCreateGame(playerId, playerName, timeControl = 'blitz') {
        // Check if player is already in a game
        if (this.playerGameMap.has(playerId)) {
            const gameId = this.playerGameMap.get(playerId);
            return this.games.get(gameId);
        }

        // Try to find an existing game waiting for a player with same time control
        for (const [gameId, game] of this.games) {
            if (!game.isFull() && game.status === 'waiting' && !game.isPrivate && game.timeControl === timeControl) {
                const color = game.addPlayer(playerId, playerName);
                if (color) {
                    this.playerGameMap.set(playerId, gameId);
                    return game;
                }
            }
        }

        // Create a new game
        const gameId = uuidv4();
        const game = new ChessGame(gameId, timeControl);
        game.isPrivate = false;
        game.addPlayer(playerId, playerName);
        this.games.set(gameId, game);
        this.playerGameMap.set(playerId, gameId);
        
        return game;
    }

    getGame(gameId) {
        return this.games.get(gameId);
    }

    getGameByPlayerId(playerId) {
        const gameId = this.playerGameMap.get(playerId);
        return gameId ? this.games.get(gameId) : null;
    }

    removePlayer(playerId) {
        const gameId = this.playerGameMap.get(playerId);
        if (!gameId) return null;

        const game = this.games.get(gameId);
        if (!game) return null;

        game.removePlayer(playerId);
        this.playerGameMap.delete(playerId);

        // If game is now empty, remove it
        if (!game.players.white && !game.players.black) {
            this.games.delete(gameId);
        }

        return game;
    }

    getActiveGamesCount() {
        return this.games.size;
    }

    getAllGames() {
        return Array.from(this.games.values());
    }

    // Create a new game (for rematch)
    createGame(timeControl = 'blitz') {
        const gameId = uuidv4();
        const game = new ChessGame(gameId, timeControl);
        game.isPrivate = false;
        this.games.set(gameId, game);
        return game;
    }

    // Remove a game completely
    removeGame(gameId) {
        const game = this.games.get(gameId);
        if (!game) return;

        // Remove players from map
        if (game.players.white) {
            this.playerGameMap.delete(game.players.white.id);
        }
        if (game.players.black) {
            this.playerGameMap.delete(game.players.black.id);
        }

        // Remove game code if it exists
        const gameCode = this.getGameCode(gameId);
        if (gameCode) {
            this.gameCodeMap.delete(gameCode);
        }

        // Remove the game
        this.games.delete(gameId);
    }
}

module.exports = GameRoom;

