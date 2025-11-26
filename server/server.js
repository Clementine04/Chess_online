require('dotenv').config();
const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');
const connectDB = require('./config/database');
const GameRoom = require('./rooms/GameRoom');
const AuthManager = require('./auth/AuthManager');
const { v4: uuidv4 } = require('uuid');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const gameRoom = new GameRoom();
const authManager = new AuthManager();
const MatchmakingQueue = require('./matchmaking/MatchmakingQueue');
const matchmakingQueue = new MatchmakingQueue();
const clients = new Map(); // ws -> { userId, username, token }

// Serve static files
app.use(express.static(path.join(__dirname, '../public')));

// WebSocket connection handler
wss.on('connection', (ws) => {
    console.log('New client connected');

    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);
            handleMessage(ws, data);
        } catch (error) {
            console.error('Error handling message:', error);
            ws.send(JSON.stringify({ type: 'error', message: 'Invalid message format' }));
        }
    });

    ws.on('close', () => {
        handleDisconnect(ws);
    });

    // Send initial leaderboard
    authManager.getLeaderboard(5).then(leaderboard => {
        ws.send(JSON.stringify({
            type: 'leaderboard_update',
            leaderboard
        }));
    });
});

function handleMessage(ws, data) {
    const { type } = data;

    switch (type) {
        case 'register':
            handleRegister(ws, data);
            break;
        case 'login':
            handleLogin(ws, data);
            break;
        case 'verify_token':
            handleVerifyToken(ws, data);
            break;
        case 'create_private_game':
            handleCreatePrivateGame(ws, data);
            break;
        case 'join_private_game':
            handleJoinPrivateGame(ws, data);
            break;
        case 'join_game':
            handleJoinGame(ws, data);
            break;
        case 'move':
            handleMove(ws, data);
            break;
        case 'get_legal_moves':
            handleGetLegalMoves(ws, data);
            break;
        case 'undo_request':
            handleUndoRequest(ws, data);
            break;
        case 'undo_response':
            handleUndoResponse(ws, data);
            break;
        case 'draw_offer':
            handleDrawOffer(ws, data);
            break;
        case 'draw_response':
            handleDrawResponse(ws, data);
            break;
        case 'surrender':
            handleSurrender(ws, data);
            break;
        case 'leave_game':
            handleLeaveGame(ws, data);
            break;
        case 'leave_queue':
            handleLeaveQueue(ws, data);
            break;
        case 'get_leaderboard':
            authManager.getLeaderboard(10).then(leaderboard => {
                ws.send(JSON.stringify({
                    type: 'leaderboard_update',
                    leaderboard
                }));
            });
            break;
        case 'chat_message':
            handleChatMessage(ws, data);
            break;
        case 'rematch_request':
            handleRematchRequest(ws, data);
            break;
        case 'rematch_response':
            handleRematchResponse(ws, data);
            break;
        default:
            ws.send(JSON.stringify({ type: 'error', message: 'Unknown message type' }));
    }
}

async function handleRegister(ws, data) {
    const { username, password } = data;
    const result = await authManager.register(username, password);

    if (result.success) {
        clients.set(ws, { userId: result.user.id, username: result.user.username, token: result.token });
    }

    ws.send(JSON.stringify({
        type: 'register_response',
        ...result
    }));
}

async function handleLogin(ws, data) {
    const { username, password } = data;
    const result = await authManager.login(username, password);

    if (result.success) {
        clients.set(ws, { userId: result.user.id, username: result.user.username, token: result.token });
    }

    ws.send(JSON.stringify({
        type: 'login_response',
        ...result
    }));
}

function handleVerifyToken(ws, data) {
    const { token } = data;
    const user = authManager.verifyToken(token);

    if (user) {
        clients.set(ws, { userId: user.id, username: user.username, token });
        ws.send(JSON.stringify({
            type: 'verify_token_response',
            success: true,
            user
        }));
    } else {
        ws.send(JSON.stringify({
            type: 'verify_token_response',
            success: false,
            error: 'Invalid token'
        }));
    }
}

function handleCreatePrivateGame(ws, data) {
    const client = clients.get(ws);
    if (!client || !client.userId) {
        ws.send(JSON.stringify({ type: 'error', message: 'Not authenticated' }));
        return;
    }

    const { timeControl } = data;
    const { game, code } = gameRoom.createPrivateGame(client.userId, client.username, timeControl);
    const playerColor = game.getPlayerColor(client.userId);

    ws.send(JSON.stringify({
        type: 'private_game_created',
        playerId: client.userId,
        color: playerColor,
        gameCode: code,
        gameState: game.getGameState()
    }));
}

function handleJoinPrivateGame(ws, data) {
    const client = clients.get(ws);
    if (!client || !client.userId) {
        ws.send(JSON.stringify({ type: 'error', message: 'Not authenticated' }));
        return;
    }

    const { gameCode } = data;
    const result = gameRoom.joinPrivateGame(client.userId, client.username, gameCode);

    if (!result.success) {
        ws.send(JSON.stringify({
            type: 'error',
            message: result.error
        }));
        return;
    }

    const { game, code } = result;
    const playerColor = game.getPlayerColor(client.userId);

    ws.send(JSON.stringify({
        type: 'game_joined',
        playerId: client.userId,
        color: playerColor,
        gameCode: code,
        gameState: game.getGameState()
    }));

    // If game is now full, notify both players
    if (game.isFull()) {
        broadcastToGame(game.gameId, {
            type: 'game_start',
            gameState: game.getGameState()
        });
        
        // Start broadcasting timer updates
        startTimerBroadcast(game.gameId);
    }
}

async function handleJoinGame(ws, data) {
    const client = clients.get(ws);
    if (!client || !client.userId) {
        ws.send(JSON.stringify({ type: 'error', message: 'Not authenticated' }));
        return;
    }

    const { timeControl = 'blitz' } = data;

    // Check if player is already in a game
    const existingGame = gameRoom.getGameByPlayerId(client.userId);
    if (existingGame) {
        ws.send(JSON.stringify({ 
            type: 'error', 
            message: 'You are already in a game. Please finish or leave your current game first.' 
        }));
        return;
    }

    // Check if player is already in queue
    if (matchmakingQueue.isPlayerInQueue(client.userId)) {
        ws.send(JSON.stringify({ 
            type: 'error', 
            message: 'You are already in the matchmaking queue' 
        }));
        return;
    }

    // Get player's Elo rating
    const user = await authManager.getUserById(client.userId);
    const eloRating = user ? user.eloRating : 1000;

    // Add player to queue
    const queueResult = matchmakingQueue.addPlayer(client.userId, client.username, eloRating, timeControl);
    
    if (!queueResult.success) {
        ws.send(JSON.stringify({ type: 'error', message: queueResult.error }));
        return;
    }

    // Notify player they're in queue
    ws.send(JSON.stringify({
        type: 'queue_joined',
        timeControl,
        position: queueResult.position,
        message: `Joined ${timeControl} queue. Position: ${queueResult.position}`
    }));

    console.log(`Player ${client.username} joined ${timeControl} queue. Queue size: ${matchmakingQueue.getQueueSize(timeControl)}`);

    // Try to find a match immediately
    tryMatchPlayers(timeControl);
}

function tryMatchPlayers(timeControl) {
    const match = matchmakingQueue.findMatch(timeControl);
    
    if (!match) {
        return; // Not enough players in queue
    }

    const { player1, player2 } = match;
    
    console.log(`Creating game for ${player1.username} vs ${player2.username}`);

    // Create a new game
    const game = gameRoom.createGame(timeControl);
    
    // Add both players
    const color1 = game.addPlayer(player1.userId, player1.username);
    const color2 = game.addPlayer(player2.userId, player2.username);
    
    // Map players to game
    gameRoom.playerGameMap.set(player1.userId, game.gameId);
    gameRoom.playerGameMap.set(player2.userId, game.gameId);

    // Notify both players
    const player1Ws = findClientByPlayerId(player1.userId);
    const player2Ws = findClientByPlayerId(player2.userId);

    if (player1Ws) {
        player1Ws.send(JSON.stringify({
            type: 'game_joined',
            playerId: player1.userId,
            color: color1,
            gameState: game.getGameState()
        }));
    }

    if (player2Ws) {
        player2Ws.send(JSON.stringify({
            type: 'game_joined',
            playerId: player2.userId,
            color: color2,
            gameState: game.getGameState()
        }));
    }

    // Game is now full, notify both players to start
    broadcastToGame(game.gameId, {
        type: 'game_start',
        gameState: game.getGameState()
    });
    
    // Start broadcasting timer updates
    startTimerBroadcast(game.gameId);
}

// Timer broadcast functionality
const timerIntervals = new Map();

function startTimerBroadcast(gameId) {
    // Clear existing interval if any
    if (timerIntervals.has(gameId)) {
        clearInterval(timerIntervals.get(gameId));
        timerIntervals.delete(gameId);
    }
    
    const game = gameRoom.getGame(gameId);
    if (!game) {
        console.log(`Cannot start timer broadcast - game ${gameId} not found`);
        return;
    }
    
    console.log(`Starting timer broadcast for game ${gameId}`);
    
    // Broadcast timer update every second
    const interval = setInterval(() => {
        const currentGame = gameRoom.getGame(gameId);
        if (!currentGame) {
            console.log(`Game ${gameId} not found, clearing timer broadcast interval`);
            clearInterval(interval);
            timerIntervals.delete(gameId);
            return;
        }
        
        // Check if game ended first (before broadcasting)
        if (currentGame.status !== 'active') {
            console.log(`Game ${gameId} ended with status: ${currentGame.status}, winner: ${currentGame.winner}`);
            
            // Broadcast final timer state
            broadcastToGame(gameId, {
                type: 'timer_update',
                timer: currentGame.getTimerState()
            });
            
            // Game ended - broadcast game end for ANY end status
            console.log(`Broadcasting game end for game ${gameId}, status: ${currentGame.status}, winner: ${currentGame.winner}`);
            broadcastToGame(gameId, {
                type: 'game_end',
                gameState: currentGame.getGameState(),
                reason: currentGame.status
            });
            handleGameEnd(currentGame);
            
            clearInterval(interval);
            timerIntervals.delete(gameId);
            return;
        }
        
        // Game is still active - broadcast timer update
        broadcastToGame(gameId, {
            type: 'timer_update',
            timer: currentGame.getTimerState()
        });
    }, 1000);
    
    timerIntervals.set(gameId, interval);
}

function handleMove(ws, data) {
    const client = clients.get(ws);
    if (!client) return;

    const { from, to, promotion } = data;
    const game = gameRoom.getGameByPlayerId(client.userId);

    if (!game) {
        ws.send(JSON.stringify({ type: 'error', message: 'Game not found' }));
        return;
    }

    const result = game.makeMove(client.userId, from, to, promotion);

    if (!result.success) {
        ws.send(JSON.stringify({ type: 'error', message: result.error }));
        return;
    }

    // Broadcast move to both players
    broadcastToGame(game.gameId, {
        type: 'move_made',
        move: result.move,
        gameState: result.gameState,
        isCheck: result.isCheck
    });

    // Check if game ended
    if (result.isCheckmate || result.isStalemate || result.isDraw) {
        handleGameEnd(game);
    }
}

function handleGetLegalMoves(ws, data) {
    const client = clients.get(ws);
    if (!client) return;

    const { position } = data;
    const game = gameRoom.getGameByPlayerId(client.userId);

    if (!game) return;

    const legalMoves = game.getLegalMoves(position);

    ws.send(JSON.stringify({
        type: 'legal_moves',
        position,
        moves: legalMoves
    }));
}

function handleUndoRequest(ws, data) {
    const client = clients.get(ws);
    if (!client) return;

    const game = gameRoom.getGameByPlayerId(client.userId);
    if (!game) return;

    const result = game.requestUndo(client.userId);

    if (!result.success) {
        ws.send(JSON.stringify({ type: 'error', message: result.error }));
        return;
    }

    // Send confirmation request to opponent
    const opponentWs = findClientByPlayerId(result.opponentId);
    if (opponentWs) {
        opponentWs.send(JSON.stringify({
            type: 'undo_request_received',
            from: client.username
        }));
    }

    ws.send(JSON.stringify({
        type: 'undo_request_sent',
        message: 'Waiting for opponent response'
    }));
}

function handleUndoResponse(ws, data) {
    const client = clients.get(ws);
    if (!client) return;

    const { accepted } = data;
    const game = gameRoom.getGameByPlayerId(client.userId);
    if (!game) return;

    const result = game.respondToUndo(client.userId, accepted);

    if (!result.success) {
        ws.send(JSON.stringify({ type: 'error', message: result.error }));
        return;
    }

    broadcastToGame(game.gameId, {
        type: 'undo_response',
        accepted: result.accepted,
        gameState: result.gameState
    });
}

function handleDrawOffer(ws, data) {
    const client = clients.get(ws);
    if (!client) return;

    const game = gameRoom.getGameByPlayerId(client.userId);
    if (!game) return;

    const result = game.requestDraw(client.userId);

    if (!result.success) {
        ws.send(JSON.stringify({ type: 'error', message: result.error }));
        return;
    }

    const opponentWs = findClientByPlayerId(result.opponentId);
    if (opponentWs) {
        opponentWs.send(JSON.stringify({
            type: 'draw_offer_received',
            from: client.username
        }));
    }

    ws.send(JSON.stringify({
        type: 'draw_offer_sent',
        message: 'Waiting for opponent response'
    }));
}

function handleDrawResponse(ws, data) {
    const client = clients.get(ws);
    if (!client) return;

    const { accepted } = data;
    const game = gameRoom.getGameByPlayerId(client.userId);
    if (!game) return;

    const result = game.respondToDraw(client.userId, accepted);

    if (!result.success) {
        ws.send(JSON.stringify({ type: 'error', message: result.error }));
        return;
    }

    broadcastToGame(game.gameId, {
        type: 'draw_response',
        accepted: result.accepted,
        gameState: result.gameState
    });

    if (result.accepted) {
        handleGameEnd(game);
    }
}

function handleSurrender(ws, data) {
    const client = clients.get(ws);
    if (!client) return;

    const game = gameRoom.getGameByPlayerId(client.userId);
    if (!game) return;

    const result = game.surrender(client.userId);

    if (!result.success) {
        ws.send(JSON.stringify({ type: 'error', message: result.error }));
        return;
    }

    broadcastToGame(game.gameId, {
        type: 'game_end',
        gameState: result.gameState,
        reason: 'surrender'
    });

    handleGameEnd(game);
}

function handleLeaveQueue(ws, data) {
    const client = clients.get(ws);
    if (!client) return;

    matchmakingQueue.removePlayer(client.userId);
    
    ws.send(JSON.stringify({
        type: 'queue_left',
        message: 'You have left the matchmaking queue'
    }));
    
    console.log(`Player ${client.username} left the matchmaking queue`);
}

async function handleLeaveGame(ws, data) {
    const client = clients.get(ws);
    if (!client) return;

    // Remove from matchmaking queue if present
    matchmakingQueue.removePlayer(client.userId);

    const game = gameRoom.getGameByPlayerId(client.userId);
    if (game && game.status === 'active' && game.isFull()) {
        // Game is active and has both players - leaving counts as forfeit
        const playerColor = game.getPlayerColor(client.userId);
        const opponentColor = game.getOpponentColor(playerColor);
        
        // Set game as resigned by the leaving player
        game.status = 'resigned';
        game.winner = opponentColor;
        game.stopTimer();
        
        // Process game end with stats update
        await handleGameEnd(game);
        
        // Stop timer broadcast
        if (timerIntervals.has(game.gameId)) {
            clearInterval(timerIntervals.get(game.gameId));
            timerIntervals.delete(game.gameId);
        }
        
        // Notify opponent they won
        broadcastToGame(game.gameId, {
            type: 'game_end',
            gameState: game.getGameState(),
            reason: 'opponent_left'
        });
        
        // Remove the leaving player
        gameRoom.removePlayer(client.userId);
    } else {
        // Game not active or not full - just remove player
        const removedGame = gameRoom.removePlayer(client.userId);
        if (removedGame) {
            // Stop timer broadcast for this game
            if (timerIntervals.has(removedGame.gameId)) {
                clearInterval(timerIntervals.get(removedGame.gameId));
                timerIntervals.delete(removedGame.gameId);
            }
            
            // Stop the game timer
            removedGame.stopTimer();
            
            // Clean up processed game ends
            processedGameEnds.delete(removedGame.gameId);
            
            // Notify opponent if any
            broadcastToGame(removedGame.gameId, {
                type: 'player_left',
                message: 'Opponent left the game'
            });
        }
    }

    // Send confirmation
    ws.send(JSON.stringify({
        type: 'left_game',
        message: 'You have left the game'
    }));
}

const processedGameEnds = new Set(); // Track which games have been processed

async function handleGameEnd(game) {
    // Prevent double processing
    if (processedGameEnds.has(game.gameId)) {
        console.log(`Game ${game.gameId} end already processed, skipping`);
        return;
    }
    processedGameEnds.add(game.gameId);
    
    const { status, winner } = game;
    console.log(`Processing game end for ${game.gameId}: status=${status}, winner=${winner}`);
    
    // Stop timer broadcast
    if (timerIntervals.has(game.gameId)) {
        clearInterval(timerIntervals.get(game.gameId));
        timerIntervals.delete(game.gameId);
    }
    
    // Stop the game timer
    game.stopTimer();

    // Update stats for both players with Elo calculation
    if (game.players.white && game.players.black) {
        const whiteUser = await authManager.getUserById(game.players.white.id);
        const blackUser = await authManager.getUserById(game.players.black.id);

        if (whiteUser && blackUser) {
            const EloCalculator = require('./utils/EloCalculator');
            const eloCalc = new EloCalculator();

            let whiteResult, blackResult, gameResult;

            // Check if there's a winner (checkmate, timeout, resigned)
            if (winner) {
                whiteResult = winner === 'white' ? 'win' : 'loss';
                blackResult = winner === 'black' ? 'win' : 'loss';
                gameResult = winner === 'white' ? 'player1' : 'player2';
            } else {
                // No winner means it's a draw (stalemate, agreed draw, etc.)
                whiteResult = 'draw';
                blackResult = 'draw';
                gameResult = 'draw';
            }

            console.log(`Game result - White: ${whiteResult}, Black: ${blackResult}, Winner: ${winner}`);

            // Calculate Elo changes
            const changes = eloCalc.getRatingChanges(whiteUser.eloRating, blackUser.eloRating, gameResult);

            // Update both players
            await authManager.updateUserStats(whiteUser.id, whiteResult, changes.player1Change);
            await authManager.updateUserStats(blackUser.id, blackResult, changes.player2Change);

            // Broadcast updated leaderboard
            const leaderboard = await authManager.getLeaderboard(10);
            broadcastToAll({
                type: 'leaderboard_update',
                leaderboard
            });

            // Send Elo update to both players
            broadcastToGame(game.gameId, {
                type: 'elo_update',
                changes: {
                    white: changes.player1Change,
                    black: changes.player2Change
                }
            });
        }
    }
}

async function handleDisconnect(ws) {
    const client = clients.get(ws);
    if (!client) return;

    // Remove from matchmaking queue
    matchmakingQueue.removePlayer(client.userId);

    const game = gameRoom.getGameByPlayerId(client.userId);
    
    if (game && game.status === 'active' && game.isFull()) {
        // Treat disconnect as resignation/forfeit
        const playerColor = game.getPlayerColor(client.userId);
        const opponentColor = game.getOpponentColor(playerColor);
        
        game.status = 'resigned';
        game.winner = opponentColor;
        game.stopTimer();
        
        await handleGameEnd(game);
        
        if (timerIntervals.has(game.gameId)) {
            clearInterval(timerIntervals.get(game.gameId));
            timerIntervals.delete(game.gameId);
        }
        
        broadcastToGame(game.gameId, {
            type: 'game_end',
            gameState: game.getGameState(),
            reason: 'opponent_disconnected'
        });
        
        gameRoom.removePlayer(client.userId);
    } else {
        const removedGame = gameRoom.removePlayer(client.userId);
        if (removedGame) {
            if (timerIntervals.has(removedGame.gameId)) {
                clearInterval(timerIntervals.get(removedGame.gameId));
                timerIntervals.delete(removedGame.gameId);
            }
            
            removedGame.stopTimer();
            processedGameEnds.delete(removedGame.gameId);
            
            broadcastToGame(removedGame.gameId, {
                type: 'player_disconnected',
                message: 'Opponent disconnected'
            });
        }
    }
    
    clients.delete(ws);
    console.log(`Client disconnected: ${client.username || 'unknown'}`);
}

function broadcastToGame(gameId, message) {
    const game = gameRoom.getGame(gameId);
    if (!game) return;

    for (const [ws, client] of clients) {
        if (client.userId) {
            const playerGame = gameRoom.getGameByPlayerId(client.userId);
            if (playerGame && playerGame.gameId === gameId) {
                if (ws.readyState === WebSocket.OPEN) {
                    ws.send(JSON.stringify(message));
                }
            }
        }
    }
}

function broadcastToAll(message) {
    for (const [ws, client] of clients) {
        if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify(message));
        }
    }
}

function findClientByPlayerId(playerId) {
    for (const [ws, client] of clients) {
        if (client.userId === playerId) {
            return ws;
        }
    }
    return null;
}

// Chat message handling
function handleChatMessage(ws, data) {
    const client = clients.get(ws);
    if (!client) return;

    const { message } = data;
    const game = gameRoom.getGameByPlayerId(client.userId);

    if (!game) {
        ws.send(JSON.stringify({ type: 'error', message: 'Not in a game' }));
        return;
    }

    // Broadcast chat message to both players in the game
    broadcastToGame(game.gameId, {
        type: 'chat_message',
        message,
        sender: client.username,
        senderId: client.userId
    });
}

// Rematch handling
const rematchRequests = new Map(); // gameId -> { requestedBy, opponentId }

function handleRematchRequest(ws, data) {
    const client = clients.get(ws);
    if (!client) return;

    const game = gameRoom.getGameByPlayerId(client.userId);
    
    if (!game) {
        ws.send(JSON.stringify({ type: 'error', message: 'Not in a game' }));
        return;
    }

    // Game must be over to request rematch
    if (game.status === 'active' || game.status === 'waiting') {
        ws.send(JSON.stringify({ type: 'error', message: 'Game is still active' }));
        return;
    }

    const playerColor = game.getPlayerColor(client.userId);
    const opponentColor = game.getOpponentColor(playerColor);
    const opponent = game.players[opponentColor];

    if (!opponent) {
        ws.send(JSON.stringify({ type: 'error', message: 'Opponent not found' }));
        return;
    }

    // Store rematch request
    rematchRequests.set(game.gameId, {
        requestedBy: client.userId,
        opponentId: opponent.id
    });

    // Notify opponent
    const opponentWs = findClientByPlayerId(opponent.id);
    if (opponentWs) {
        opponentWs.send(JSON.stringify({
            type: 'rematch_request_received',
            from: client.username
        }));
    }

    ws.send(JSON.stringify({
        type: 'rematch_request_sent',
        message: 'Rematch request sent'
    }));
}

function handleRematchResponse(ws, data) {
    const client = clients.get(ws);
    if (!client) return;

    const { accepted } = data;
    const game = gameRoom.getGameByPlayerId(client.userId);

    if (!game) {
        ws.send(JSON.stringify({ type: 'error', message: 'Not in a game' }));
        return;
    }

    const rematchRequest = rematchRequests.get(game.gameId);
    if (!rematchRequest) {
        ws.send(JSON.stringify({ type: 'error', message: 'No pending rematch request' }));
        return;
    }

    // Make sure this is the opponent responding
    if (rematchRequest.opponentId !== client.userId) {
        ws.send(JSON.stringify({ type: 'error', message: 'Cannot respond to your own request' }));
        return;
    }

    // Clear the rematch request
    rematchRequests.delete(game.gameId);

    if (!accepted) {
        // Notify requester that rematch was declined
        const requesterWs = findClientByPlayerId(rematchRequest.requestedBy);
        if (requesterWs) {
            requesterWs.send(JSON.stringify({
                type: 'rematch_declined',
                message: 'Rematch declined'
            }));
        }
        return;
    }

    // Store player info before resetting
    const player1 = game.players.white;
    const player2 = game.players.black;
    const oldGameId = game.gameId;

    console.log(`Starting rematch for game ${oldGameId}. Players: ${player1.name} (white) vs ${player2.name} (black)`);

    // Clear any timer intervals for old game
    if (timerIntervals.has(oldGameId)) {
        clearInterval(timerIntervals.get(oldGameId));
        timerIntervals.delete(oldGameId);
    }
    
    // Clean up processed game ends
    processedGameEnds.delete(oldGameId);

    // Swap player colors for fairness
    const tempPlayer = game.players.white;
    game.players.white = game.players.black;
    game.players.black = tempPlayer;

    // Reset the game completely (this will reset the timer properly)
    game.resetGame();

    console.log(`Game reset complete. New colors: ${game.players.white.name} (white) vs ${game.players.black.name} (black)`);

    // Notify both players
    const player1Ws = findClientByPlayerId(player1.id);
    const player2Ws = findClientByPlayerId(player2.id);

    if (player1Ws) {
        const color = game.getPlayerColor(player1.id);
        player1Ws.send(JSON.stringify({
            type: 'rematch_accepted',
            playerId: player1.id,
            color,
            gameState: game.getGameState(),
            message: `Rematch started! You are now ${color}`
        }));
    }

    if (player2Ws) {
        const color = game.getPlayerColor(player2.id);
        player2Ws.send(JSON.stringify({
            type: 'rematch_accepted',
            playerId: player2.id,
            color,
            gameState: game.getGameState(),
            message: `Rematch started! You are now ${color}`
        }));
    }

    // Broadcast game start to both players
    broadcastToGame(game.gameId, {
        type: 'game_start',
        gameState: game.getGameState(),
        message: 'Rematch started!'
    });

    // Start timer broadcast for the game
    startTimerBroadcast(game.gameId);
    
    console.log(`Timer broadcast started for rematch game ${game.gameId}`);
}

const PORT = process.env.PORT || 3000;

// Connect to MongoDB and start server
connectDB().then(() => {
    server.listen(PORT, () => {
        console.log(`🚀 Chess server running on http://localhost:${PORT}`);
    });
}).catch(err => {
    console.error('Failed to start server:', err);
    process.exit(1);
});
