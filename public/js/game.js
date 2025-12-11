// Game state
let playerId = null;
let playerColor = null;
let lastPlayerColor = null; // remember last assigned color for post-game updates
let isBoardFullscreen = false;
let currentUser = null; // { id, username, eloRating, token }

// Initialize when page loads
document.addEventListener('DOMContentLoaded', () => {
    initializeGame();
});

function initializeGame() {
    // Setup event listeners
    setupEventListeners();

    // Setup endgame modal handlers
    setupEndgameModalHandlers();

    // Setup authentication handlers
    setupAuthHandlers();

    // Connect WebSocket
    wsClient.connect();

    // Setup WebSocket handlers
    setupWebSocketHandlers();

    // Check if user has existing token
    checkExistingAuth();
}

function updateBoardFullscreenState(isActive) {
    isBoardFullscreen = !!isActive;
    const toggleBtn = document.getElementById('boardFullscreenToggle');
    if (toggleBtn) {
        toggleBtn.setAttribute('aria-pressed', isBoardFullscreen ? 'true' : 'false');
        toggleBtn.setAttribute('aria-label', isBoardFullscreen ? 'Minimize board' : 'Maximize board');
        const label = toggleBtn.querySelector('.toggle-label');
        const icon = toggleBtn.querySelector('.toggle-icon');
        if (label) label.textContent = isBoardFullscreen ? 'Minimize' : 'Maximize';
        if (icon) icon.textContent = isBoardFullscreen ? '[-]' : '[+]';
    }
    document.body.classList.toggle('board-fullscreen-active', isBoardFullscreen);
}

function checkExistingAuth() {
    const token = localStorage.getItem('chess_token');
    
    if (token) {
        // Verify token with server
        wsClient.verifyToken(token);
    } else {
        // Show auth screen
        showAuthScreen();
    }
}

function showAuthScreen() {
    updateBoardFullscreenState(false);
    document.getElementById('authScreen').classList.remove('hidden');
    document.getElementById('homeScreen').classList.add('hidden');
    document.getElementById('gameScreen').classList.add('hidden');
}

function showHomeScreen() {
    updateBoardFullscreenState(false);
    document.getElementById('authScreen').classList.add('hidden');
    document.getElementById('homeScreen').classList.remove('hidden');
    document.getElementById('gameScreen').classList.add('hidden');
    
    // Update user info on home screen
    if (currentUser) {
        document.getElementById('usernameDisplay').textContent = currentUser.username;
        document.getElementById('eloDisplay').textContent = currentUser.eloRating;
        document.getElementById('welcomeUsername').textContent = currentUser.username;
        document.getElementById('statElo').textContent = currentUser.eloRating;
        document.getElementById('statGames').textContent = currentUser.gamesPlayed || 0;
        document.getElementById('statWins').textContent = currentUser.wins || 0;
        document.getElementById('statDraws').textContent = currentUser.draws || 0;
        document.getElementById('statLosses').textContent = currentUser.losses || 0;
    }
    
    // Request updated leaderboard
    wsClient.send({ type: 'get_leaderboard' });
}

function showGameScreen() {
    document.getElementById('authScreen').classList.add('hidden');
    document.getElementById('homeScreen').classList.add('hidden');
    document.getElementById('gameScreen').classList.remove('hidden');
    
    // Update user info on game screen
    if (currentUser) {
        document.getElementById('gameUsernameDisplay').textContent = currentUser.username;
        document.getElementById('gameEloDisplay').textContent = currentUser.eloRating;
        
        // Update board player name
        const boardYourName = document.getElementById('boardYourName');
        if (boardYourName) {
            boardYourName.textContent = currentUser.username;
        }
    }
}

function setupAuthHandlers() {
    const loginTab = document.getElementById('loginTab');
    const signupTab = document.getElementById('signupTab');
    const loginForm = document.getElementById('loginForm');
    const signupForm = document.getElementById('signupForm');
    const loginBtn = document.getElementById('loginBtn');
    const signupBtn = document.getElementById('signupBtn');

    // Tab switching
    loginTab.addEventListener('click', () => {
        loginTab.classList.add('active');
        signupTab.classList.remove('active');
        loginForm.classList.remove('hidden');
        signupForm.classList.add('hidden');
    });

    signupTab.addEventListener('click', () => {
        signupTab.classList.add('active');
        loginTab.classList.remove('active');
        signupForm.classList.remove('hidden');
        loginForm.classList.add('hidden');
    });

    // Login button
    loginBtn.addEventListener('click', handleLoginSubmit);
    document.getElementById('loginPassword').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleLoginSubmit();
    });

    // Signup button
    signupBtn.addEventListener('click', handleSignupSubmit);
    document.getElementById('signupPasswordConfirm').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleSignupSubmit();
    });

    // Logout button
    document.getElementById('logoutBtn').addEventListener('click', () => {
        localStorage.removeItem('chess_token');
        location.reload();
    });
}

function handleLoginSubmit() {
    const username = document.getElementById('loginUsername').value.trim();
    const password = document.getElementById('loginPassword').value;
    const errorEl = document.getElementById('loginError');

    errorEl.classList.add('hidden');

    if (!username || !password) {
        errorEl.textContent = 'Please enter username and password';
        errorEl.classList.remove('hidden');
        return;
    }

    wsClient.login(username, password);
    document.getElementById('loginBtn').disabled = true;
    document.getElementById('loginBtn').textContent = 'Logging in...';
}

function handleSignupSubmit() {
    const username = document.getElementById('signupUsername').value.trim();
    const password = document.getElementById('signupPassword').value;
    const confirmPassword = document.getElementById('signupPasswordConfirm').value;
    const errorEl = document.getElementById('signupError');

    errorEl.classList.add('hidden');

    if (!username || !password || !confirmPassword) {
        errorEl.textContent = 'Please fill in all fields';
        errorEl.classList.remove('hidden');
        return;
    }

    if (password !== confirmPassword) {
        errorEl.textContent = 'Passwords do not match';
        errorEl.classList.remove('hidden');
        return;
    }

    if (username.length < 3) {
        errorEl.textContent = 'Username must be at least 3 characters';
        errorEl.classList.remove('hidden');
        return;
    }

    if (password.length < 6) {
        errorEl.textContent = 'Password must be at least 6 characters';
        errorEl.classList.remove('hidden');
        return;
    }

    wsClient.register(username, password);
    document.getElementById('signupBtn').disabled = true;
    document.getElementById('signupBtn').textContent = 'Creating account...';
}

function setupEventListeners() {
    // Sound toggle
    const soundToggle = document.getElementById('soundToggle');
    if (soundToggle) {
        soundToggle.addEventListener('change', (e) => {
            soundManager.toggle(e.target.checked);
            console.log('Sound effects:', e.target.checked ? 'enabled' : 'disabled');
        });
    }

    // Board theme selection
    const themeOptions = document.querySelectorAll('input[name="boardTheme"]');
    themeOptions.forEach(option => {
        option.addEventListener('change', (e) => {
            const theme = e.target.value;
            chessUI.applyBoardTheme(theme);
        });
    });

    // Load saved theme on startup
    const savedTheme = localStorage.getItem('chess_board_theme') || 'green';
    const themeRadio = document.querySelector(`input[name="boardTheme"][value="${savedTheme}"]`);
    if (themeRadio) {
        themeRadio.checked = true;
    }

    // Chat functionality
    const chatInput = document.getElementById('chatInput');
    const sendChatBtn = document.getElementById('sendChatBtn');
    
    if (sendChatBtn) {
        sendChatBtn.addEventListener('click', () => {
            const message = chatInput.value.trim();
            if (message) {
                wsClient.send({ type: 'chat_message', message });
                chatInput.value = '';
            }
        });
    }

    if (chatInput) {
        chatInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                sendChatBtn.click();
            }
        });
    }

    // Quick chat messages
    const quickMsgs = document.querySelectorAll('.quick-msg');
    quickMsgs.forEach(btn => {
        btn.addEventListener('click', () => {
            const message = btn.dataset.msg;
            wsClient.send({ type: 'chat_message', message });
        });
    });

    const fullscreenToggle = document.getElementById('boardFullscreenToggle');
    if (fullscreenToggle) {
        fullscreenToggle.addEventListener('click', () => {
            updateBoardFullscreenState(!isBoardFullscreen);
        });
    }

    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && isBoardFullscreen) {
            updateBoardFullscreenState(false);
        }
    });

    // Rematch button
    const rematchBtn = document.getElementById('rematchBtn');
    if (rematchBtn) {
        rematchBtn.addEventListener('click', () => {
            wsClient.send({ type: 'rematch_request' });
            rematchBtn.disabled = true;
            rematchBtn.textContent = '⏳ Waiting...';
        });
    }

    // Public Match button
    document.getElementById('publicModeBtn').addEventListener('click', () => {
        // Ensure we're starting fresh
        resetGameState();
        
        const timeControl = document.querySelector('input[name="timeControl"]:checked').value;
        wsClient.joinGame(timeControl);
        showGameScreen();
    });

    // Create Private Game button
    document.getElementById('createPrivateBtn').addEventListener('click', () => {
        // Ensure we're starting fresh
        resetGameState();
        
        const timeControl = document.querySelector('input[name="timeControl"]:checked').value;
        wsClient.createPrivateGame(timeControl);
        showGameScreen();
    });

    // Join with code button
    document.getElementById('joinWithCodeBtn').addEventListener('click', () => {
        const code = document.getElementById('gameCodeInput').value.trim().toUpperCase();
        
        if (!code || code.length !== 6) {
            chessUI.showMessage('Please enter a valid 6-character game code!', 'error');
            return;
        }
        
        // Ensure we're starting fresh
        resetGameState();
        
        wsClient.joinPrivateGame(code);
        showGameScreen();
    });

    // Auto-uppercase game code input
    document.getElementById('gameCodeInput').addEventListener('input', (e) => {
        e.target.value = e.target.value.toUpperCase();
    });

    // Enter key in game code input
    document.getElementById('gameCodeInput').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            document.getElementById('joinWithCodeBtn').click();
        }
    });

    // Leave Game button
    document.getElementById('leaveGameBtn').addEventListener('click', () => {
        chessUI.showConfirmation(
            'Leave Game',
            'Are you sure you want to leave this game?',
            (confirmed) => {
                if (confirmed) {
                    // Notify server that we're leaving
                    wsClient.send({ type: 'leave_game' });
                    
                    // Reset game state
                    resetGameState();
                    
                    // Go back to home screen
                    showHomeScreen();
                }
            }
        );
    });

    // Undo button
    document.getElementById('undoBtn').addEventListener('click', () => {
        chessUI.showConfirmation(
            'Request Undo',
            'Ask your opponent to undo the last move?',
            (confirmed) => {
                if (confirmed) {
                    wsClient.requestUndo();
                    chessUI.showMessage('Undo request sent...', 'info');
                }
            }
        );
    });

    // Draw button
    document.getElementById('drawBtn').addEventListener('click', () => {
        chessUI.showConfirmation(
            'Offer Draw',
            'Offer a draw to your opponent?',
            (confirmed) => {
                if (confirmed) {
                    wsClient.offerDraw();
                    chessUI.showMessage('Draw offer sent...', 'info');
                }
            }
        );
    });

    // Surrender button
    document.getElementById('surrenderBtn').addEventListener('click', () => {
        chessUI.showConfirmation(
            'Surrender',
            'Are you sure you want to surrender?',
            (confirmed) => {
                if (confirmed) {
                    wsClient.surrender();
                }
            }
        );
    });
}

function resetGameState() {
    console.log('Resetting game state...');
    
    // Reset all game state variables
    playerId = null;
    playerColor = null;
    
    // Clear the board UI completely (this will reset all UI state)
    chessUI.clearBoard();
    
    // Reset controls - disable all buttons
    chessUI.enableControls(false);
    
    // Reset timers to default values
    const playerTimer = document.getElementById('playerTimer');
    const opponentTimer = document.getElementById('opponentTimer');
    if (playerTimer) {
        playerTimer.classList.remove('active', 'low-time');
        const valueEl = playerTimer.querySelector('.timer-value');
        if (valueEl) valueEl.textContent = '3:00';
    }
    if (opponentTimer) {
        opponentTimer.classList.remove('active', 'low-time');
        const valueEl = opponentTimer.querySelector('.timer-value');
        if (valueEl) valueEl.textContent = '3:00';
    }
    
    // Reset turn indicator
    const turnIndicator = document.getElementById('turnIndicator');
    if (turnIndicator) {
        turnIndicator.innerHTML = 'Waiting for opponent...';
        turnIndicator.style.color = '#95a5a6';
    }
    
    // Clear messages
    const messagesDiv = document.getElementById('gameMessages');
    if (messagesDiv) {
        messagesDiv.textContent = '';
        messagesDiv.className = 'game-messages';
    }
    
    // Reset game status display
    const gameStatus = document.getElementById('gameStatus');
    if (gameStatus) {
        gameStatus.textContent = 'Waiting for opponent...';
        gameStatus.style.color = '#95a5a6';
    }
    
    // Reset opponent name
    const opponentNameEl = document.getElementById('opponentName');
    if (opponentNameEl) {
        opponentNameEl.textContent = 'Waiting...';
    }
    
    // Reset player color display
    const playerColorEl = document.getElementById('playerColor');
    const yourColorEl = document.getElementById('yourColor');
    if (playerColorEl) {
        playerColorEl.textContent = '';
    }
    if (yourColorEl) {
        yourColorEl.textContent = '';
    }
    
    // Hide check indicator
    const checkIndicator = document.getElementById('checkIndicator');
    if (checkIndicator) {
        checkIndicator.classList.add('hidden');
    }
    
    console.log('Game state reset complete');
}

function setupEndgameModalHandlers() {
    // Rematch button on modal
    document.getElementById('rematchModalBtn').addEventListener('click', () => {
        wsClient.send({ type: 'rematch_request' });
        
        // Show waiting message
        const waitingDiv = document.getElementById('rematchWaiting');
        const buttonsDiv = document.getElementById('endgameButtons');
        if (waitingDiv) waitingDiv.classList.remove('hidden');
        if (buttonsDiv) buttonsDiv.classList.add('hidden');
    });

    // Accept rematch button
    document.getElementById('acceptRematchBtn').addEventListener('click', () => {
        wsClient.send({ type: 'rematch_response', accepted: true });
        
        // Hide notification, show waiting
        const notification = document.getElementById('rematchNotification');
        const waitingDiv = document.getElementById('rematchWaiting');
        if (notification) notification.classList.add('hidden');
        if (waitingDiv) {
            waitingDiv.classList.remove('hidden');
            waitingDiv.querySelector('.rematch-waiting-text').textContent = '⏳ Starting new game...';
        }
    });

    // Decline rematch button
    document.getElementById('declineRematchBtn').addEventListener('click', () => {
        wsClient.send({ type: 'rematch_response', accepted: false });
        
        // Hide notification, show buttons
        const notification = document.getElementById('rematchNotification');
        const buttonsDiv = document.getElementById('endgameButtons');
        if (notification) notification.classList.add('hidden');
        if (buttonsDiv) buttonsDiv.classList.remove('hidden');
    });

    // New Game button
    document.getElementById('newGameBtn').addEventListener('click', () => {
        // Close the modal
        document.getElementById('endgameModal').classList.add('hidden');
        
        // Notify server we're leaving (in case we're still in a game)
        wsClient.send({ type: 'leave_game' });
        
        // Reset everything
        resetGameState();
        
        // Go back to home screen
        showHomeScreen();
    });

    // Home button
    document.getElementById('homeBtn').addEventListener('click', () => {
        // Close the modal
        document.getElementById('endgameModal').classList.add('hidden');
        
        // Notify server we're leaving (in case we're still in a game)
        wsClient.send({ type: 'leave_game' });
        
        // Reset everything
        resetGameState();
        
        // Go back to home screen
        showHomeScreen();
    });
}

function setupWebSocketHandlers() {
    // On connection
    wsClient.on('onConnect', () => {
        console.log('Connected to server');
    });

    // Authentication responses
    wsClient.on('register_response', (data) => {
        document.getElementById('signupBtn').disabled = false;
        document.getElementById('signupBtn').textContent = 'Sign Up';

        if (data.success) {
            currentUser = data.user;
            localStorage.setItem('chess_token', data.token);
            showHomeScreen();
        } else {
            const errorEl = document.getElementById('signupError');
            errorEl.textContent = data.error;
            errorEl.classList.remove('hidden');
        }
    });

    wsClient.on('login_response', (data) => {
        document.getElementById('loginBtn').disabled = false;
        document.getElementById('loginBtn').textContent = 'Login';

        if (data.success) {
            currentUser = data.user;
            localStorage.setItem('chess_token', data.token);
            showHomeScreen();
        } else {
            const errorEl = document.getElementById('loginError');
            errorEl.textContent = data.error;
            errorEl.classList.remove('hidden');
        }
    });

    wsClient.on('verify_token_response', (data) => {
        if (data.success) {
            currentUser = data.user;
            showHomeScreen();
        } else {
            localStorage.removeItem('chess_token');
            showAuthScreen();
        }
    });

    // Private game created
    wsClient.on('private_game_created', (data) => {
        playerId = data.playerId;
        playerColor = data.color;
        lastPlayerColor = playerColor;
        
        // Initialize board first with player color
        chessUI.setPlayerColor(playerColor);
        
        // Now render the game state
        chessUI.renderBoard(data.gameState);
        chessUI.updateGameStatus(data.gameState.status);
        
        // Show waiting message
        const turnEl = document.getElementById('turnIndicator');
        if (turnEl) {
            turnEl.innerHTML = 
                `⏳ <strong>Waiting for opponent...</strong><br><small>Share the code: ${data.gameCode}</small>`;
        }
        
        // Initialize timer display - ALWAYS update
        if (data.gameState.timer) {
            console.log('Initializing timer on private game created:', data.gameState.timer);
            chessUI.updateTimers(data.gameState.timer, playerColor);
        }
        
        // Show game code modal
        showGameCodeModal(data.gameCode);
    });

    // Queue joined
    wsClient.on('queue_joined', (data) => {
        console.log('Joined matchmaking queue:', data);
        
        const turnEl = document.getElementById('turnIndicator');
        if (turnEl) {
            turnEl.innerHTML = 
                `🔍 <strong>Finding opponent...</strong><br><small>Position in queue: ${data.position} | Time control: ${data.timeControl}</small>`;
        }
        
        chessUI.showMessage(`Searching for an opponent... (${data.timeControl})`, 'info');
    });

    // Queue left
    wsClient.on('queue_left', (data) => {
        console.log('Left matchmaking queue');
        chessUI.showMessage('Left matchmaking queue', 'info');
    });

    // Left game
    wsClient.on('left_game', (data) => {
        console.log('Left game');
        // This is just confirmation, already handled by button
    });

    // Game joined
    wsClient.on('game_joined', (data) => {
        playerId = data.playerId;
        playerColor = data.color;
        lastPlayerColor = playerColor;
        
        chessUI.setPlayerColor(playerColor);
        chessUI.renderBoard(data.gameState);
        chessUI.updateGameStatus(data.gameState.status);
        chessUI.updateTurnIndicator(data.gameState.currentTurn, playerColor);

        // Initialize timer if available - ALWAYS update even if waiting
        if (data.gameState.timer) {
            console.log('Initializing timer on game joined:', data.gameState.timer);
            chessUI.updateTimers(data.gameState.timer, playerColor);
        }

        if (data.gameState.status === 'waiting') {
            const turnEl = document.getElementById('turnIndicator');
            if (turnEl) {
                if (data.gameCode) {
                    turnEl.innerHTML = 
                        `⏳ <strong>Waiting for opponent...</strong><br><small>Game Code: ${data.gameCode}</small>`;
                    chessUI.showMessage(`Share the code with your friend to start!`, 'info');
                } else {
                    turnEl.innerHTML = 
                        '⏳ <strong>Finding opponent...</strong><br><small>Please wait...</small>';
                    chessUI.showMessage('Searching for an opponent...', 'info');
                }
            }
        } else if (data.gameState.status === 'active') {
            // Game is already active (second player joining)
            chessUI.enableControls(true);
        }
    });

    // Game start
    wsClient.on('game_start', (data) => {
        console.log('Game starting with timer:', data.gameState.timer);
        
        chessUI.renderBoard(data.gameState);
        chessUI.updateGameStatus(data.gameState.status);
        chessUI.updateTurnIndicator(data.gameState.currentTurn, playerColor);
        chessUI.enableControls(true);
        chessUI.showMessage('Game started! Good luck!', 'success');

        // Update opponent name
        const opponent = data.gameState.players[playerColor === 'white' ? 'black' : 'white'];
        if (opponent) {
            chessUI.updateOpponentName(opponent.name);
            
            // Update board opponent name
            const boardOpponentName = document.getElementById('boardOpponentName');
            if (boardOpponentName) {
                boardOpponentName.textContent = opponent.name;
            }
        }

        // CRITICAL: Update timer display immediately when game starts
        if (data.gameState.timer) {
            console.log('Updating timer on game start:', data.gameState.timer);
            chessUI.updateTimers(data.gameState.timer, playerColor);
        }

        // Close game code modal if open
        const gameCodeModal = document.getElementById('gameCodeModal');
        if (gameCodeModal) {
            gameCodeModal.classList.add('hidden');
        }
    });

    // Move made
    wsClient.on('move_made', (data) => {
        // Don't process moves if game has ended
        if (data.gameState.status !== 'active') {
            // Set last move for highlighting even when game ends
            if (data.move) {
                chessUI.setLastMove(data.move.from, data.move.to);
            }

            chessUI.renderBoard(data.gameState);
            chessUI.showCheckIndicator(false);
            chessUI.updateGameStatus(data.gameState.status, data.gameState.winner);
            chessUI.enableControls(false);
            chessUI.clearSelection();

            // Update turn indicator to show game ended
            const turnIndicator = document.getElementById('turnIndicator');
            if (turnIndicator) {
                turnIndicator.innerHTML = `🏁 <strong>Game Over</strong>`;
                turnIndicator.style.color = '#95a5a6';
            }

            // Show endgame modal
            const isWinner = data.gameState.winner === playerColor;
            const isDraw = data.gameState.status === 'stalemate' || data.gameState.status === 'draw';
            chessUI.showEndgameModal(data.gameState.status, isWinner, isDraw);

            // Show rematch button
            const rematchBtn = document.getElementById('rematchBtn');
            if (rematchBtn) {
                rematchBtn.classList.remove('hidden');
                rematchBtn.disabled = false;
                rematchBtn.textContent = '🔄 Rematch';
            }
            return;
        }
        
        // Set last move for highlighting
        if (data.move) {
            chessUI.setLastMove(data.move.from, data.move.to);
        }

        chessUI.renderBoard(data.gameState);
        chessUI.updateTurnIndicator(data.gameState.currentTurn, playerColor);

        // Add move to history
        if (data.move) {
            chessUI.addMoveToHistory(data.move, data.gameState.currentTurn === 'white' ? 'black' : 'white');
        }
        
        // Execute premove if it's now player's turn and premove is set
        if (data.gameState.currentTurn === playerColor && chessUI.premove) {
            chessUI.executePremove();
        }
        
        // Play appropriate sound
        if (data.move) {
            if (data.move.isCastling) {
                soundManager.playCastle();
            } else if (data.move.promotion) {
                soundManager.playPromote();
            } else if (data.move.captured) {
                soundManager.playCapture();
            } else {
                soundManager.playMove();
            }
            
            // Play check sound after move sound if in check
            if (data.isCheck) {
                setTimeout(() => soundManager.playCheck(), 200);
            }
        }
        
        // Check for check
        if (data.isCheck) {
            chessUI.showCheckIndicator(true);
            chessUI.showMessage('Check!', 'warning');
        } else {
            chessUI.showCheckIndicator(false);
        }
    });

    // Legal moves
    wsClient.on('legal_moves', (data) => {
        chessUI.showLegalMoves(data.position, data.moves);
    });

    // Undo request received
    wsClient.on('undo_request_received', (data) => {
        chessUI.showConfirmation(
            'Undo Request',
            `${data.from} wants to undo the last move. Allow?`,
            (accepted) => {
                wsClient.respondToUndo(accepted);
            }
        );
    });

    // Undo request sent
    wsClient.on('undo_request_sent', (data) => {
        chessUI.showMessage(data.message, 'info');
    });

    // Undo response
    wsClient.on('undo_response', (data) => {
        if (data.accepted) {
            // Clear last move highlight when undoing
            chessUI.lastMove = null;

            chessUI.renderBoard(data.gameState);
            chessUI.updateTurnIndicator(data.gameState.currentTurn, playerColor);
            chessUI.showMessage('Move undone!', 'success');
            chessUI.showCheckIndicator(false);
        } else {
            chessUI.showMessage('Undo request denied', 'error');
        }
    });

    // Draw offer received
    wsClient.on('draw_offer_received', (data) => {
        chessUI.showConfirmation(
            'Draw Offer',
            `${data.from} offers a draw. Accept?`,
            (accepted) => {
                wsClient.respondToDraw(accepted);
            }
        );
    });

    // Draw offer sent
    wsClient.on('draw_offer_sent', (data) => {
        chessUI.showMessage(data.message, 'info');
    });

    // Draw response
    wsClient.on('draw_response', (data) => {
        if (data.accepted) {
            chessUI.renderBoard(data.gameState);
            chessUI.updateGameStatus(data.gameState.status);
            chessUI.enableControls(false);
            
            // Show endgame modal for draw
            chessUI.showEndgameModal('draw', false, true);
        } else {
            chessUI.showMessage('Draw offer declined', 'error');
        }
    });

    // Game end
    wsClient.on('game_end', (data) => {
        console.log('Game ended:', data.gameState.status, 'Winner:', data.gameState.winner);
        
        // Update final timer state if available
        if (data.gameState.timer && playerColor) {
            chessUI.updateTimers(data.gameState.timer, playerColor);
        }
        
        // Update board and UI
        chessUI.renderBoard(data.gameState);
        chessUI.updateGameStatus(data.gameState.status, data.gameState.winner);
        chessUI.enableControls(false);
        
        // Clear any selections
        chessUI.clearSelection();
        
        // Update turn indicator to show game ended
        const turnIndicator = document.getElementById('turnIndicator');
        if (turnIndicator) {
            if (data.gameState.status === 'timeout') {
                turnIndicator.innerHTML = `⏱️ <strong>Time Expired!</strong>`;
                turnIndicator.style.color = '#e74c3c';
            } else if (data.gameState.status === 'checkmate') {
                turnIndicator.innerHTML = `♔ <strong>Checkmate!</strong>`;
                turnIndicator.style.color = '#e74c3c';
            } else {
                turnIndicator.innerHTML = `🏁 <strong>Game Over</strong>`;
                turnIndicator.style.color = '#95a5a6';
            }
        }
        
        // Show endgame modal
        const isWinner = data.gameState.winner === playerColor;
        const isDraw = data.gameState.status === 'stalemate' || data.gameState.status === 'draw';
        chessUI.showEndgameModal(data.gameState.status, isWinner, isDraw);
        
        // Show rematch button
        const rematchBtn = document.getElementById('rematchBtn');
        if (rematchBtn) {
            rematchBtn.classList.remove('hidden');
            rematchBtn.disabled = false;
            rematchBtn.textContent = '🔄 Rematch';
        }
    });

    // Player disconnected
    wsClient.on('player_disconnected', (data) => {
        chessUI.showMessage(data.message, 'error');
        chessUI.enableControls(false);
    });

    // Player left
    wsClient.on('player_left', (data) => {
        chessUI.showMessage(data.message, 'warning');
        chessUI.enableControls(false);
        
        // Reset and go home after a delay
        setTimeout(() => {
            resetGameState();
            showHomeScreen();
        }, 2000);
    });

    // Leaderboard update
    wsClient.on('leaderboard_update', (data) => {
        chessUI.updateLeaderboard(data.leaderboard);
    });

    // Elo rating update
    wsClient.on('elo_update', (data) => {
        const colorForRating = playerColor || lastPlayerColor;
        if (!colorForRating) {
            console.warn('Received Elo update but no player color is available');
            return;
        }
        
        const myChange = colorForRating === 'white' ? data.changes.white : data.changes.black;
        const sign = myChange >= 0 ? '+' : '';
        
        // Update current user's Elo
        if (currentUser) {
            currentUser.eloRating += myChange;
            
            // Update the displayed Elo on game screen
            const gameEloDisplay = document.getElementById('gameEloDisplay');
            if (gameEloDisplay) {
                gameEloDisplay.textContent = currentUser.eloRating;
            }
            
            // Update stats
            currentUser.gamesPlayed = (currentUser.gamesPlayed || 0) + 1;
            if (myChange > 0) {
                currentUser.wins = (currentUser.wins || 0) + 1;
            } else if (myChange < 0) {
                currentUser.losses = (currentUser.losses || 0) + 1;
            } else {
                currentUser.draws = (currentUser.draws || 0) + 1;
            }
        }
        
        // Show message in the endgame modal area
        console.log(`Rating change: ${sign}${myChange} Elo`);
    });

    // Timer update
    wsClient.on('timer_update', (data) => {
        // Update timers if we have a player color
        // Allow updates even when game is ending to show final time
        if (playerColor && data.timer) {
            chessUI.updateTimers(data.timer, playerColor);
        }
    });

    // Error
    wsClient.on('error', (data) => {
        chessUI.showMessage(data.message, 'error');
        console.error('Error:', data.message);
    });

    // Chat message received
    wsClient.on('chat_message', (data) => {
        const isOwn = data.senderId === (currentUser ? currentUser.id : null);
        chessUI.addChatMessage(data.message, data.sender, isOwn);
    });

    // Rematch request received
    wsClient.on('rematch_request_received', (data) => {
        console.log('Rematch request received from:', data.from);
        
        // Show notification on endgame modal
        const notification = document.getElementById('rematchNotification');
        const requesterName = document.getElementById('rematchRequester');
        const buttonsDiv = document.getElementById('endgameButtons');
        const waitingDiv = document.getElementById('rematchWaiting');
        
        if (notification) {
            notification.classList.remove('hidden');
            if (requesterName) requesterName.textContent = data.from;
        }
        
        // Hide normal buttons and waiting message
        if (buttonsDiv) buttonsDiv.classList.add('hidden');
        if (waitingDiv) waitingDiv.classList.add('hidden');
    });

    // Rematch request sent
    wsClient.on('rematch_request_sent', (data) => {
        console.log('Rematch request sent');
        chessUI.showMessage('Rematch request sent to opponent!', 'info');
    });

    // Rematch accepted - new game starts
    wsClient.on('rematch_accepted', (data) => {
        // Close the endgame modal
        const endgameModal = document.getElementById('endgameModal');
        if (endgameModal) {
            endgameModal.classList.add('hidden');
        }
        
        // Reset game state but keep players
        resetGameState();
        
        // Join the new game
        playerId = data.playerId;
        playerColor = data.color;
        lastPlayerColor = playerColor;
        
        chessUI.setPlayerColor(playerColor);
        chessUI.renderBoard(data.gameState);
        chessUI.updateGameStatus(data.gameState.status);
        chessUI.updateTurnIndicator(data.gameState.currentTurn, playerColor);
        
        // Re-enable controls for the new game
        chessUI.enableControls(true);
        
        // Initialize timer if available
        if (data.gameState.timer) {
            chessUI.updateTimers(data.gameState.timer, playerColor);
        }
        
        // Hide sidebar rematch button
        const rematchBtn = document.getElementById('rematchBtn');
        if (rematchBtn) {
            rematchBtn.classList.add('hidden');
        }
        
        // Reset modal rematch button
        const rematchModalBtn = document.getElementById('rematchModalBtn');
        if (rematchModalBtn) {
            rematchModalBtn.disabled = false;
            rematchModalBtn.textContent = '🔄 Rematch';
        }
        
        chessUI.showMessage('Rematch started! Good luck!', 'success');
    });

    // Rematch declined
    wsClient.on('rematch_declined', (data) => {
        console.log('Rematch declined');
        chessUI.showMessage('Opponent declined the rematch', 'error');
        
        // Hide waiting, show buttons
        const waitingDiv = document.getElementById('rematchWaiting');
        const buttonsDiv = document.getElementById('endgameButtons');
        const notification = document.getElementById('rematchNotification');
        
        if (waitingDiv) waitingDiv.classList.add('hidden');
        if (buttonsDiv) buttonsDiv.classList.remove('hidden');
        if (notification) notification.classList.add('hidden');
        
        // Reset sidebar rematch button
        const rematchBtn = document.getElementById('rematchBtn');
        if (rematchBtn) {
            rematchBtn.disabled = false;
            rematchBtn.textContent = '🔄 Rematch';
        }
        
        // Reset modal rematch button
        const rematchModalBtn = document.getElementById('rematchModalBtn');
        if (rematchModalBtn) {
            rematchModalBtn.disabled = false;
            rematchModalBtn.textContent = '🔄 Rematch';
        }
    });
}

function showGameCodeModal(gameCode) {
    const modal = document.getElementById('gameCodeModal');
    const codeDisplay = document.getElementById('displayGameCode');
    const copyBtn = document.getElementById('copyCodeBtn');
    const closeBtn = document.getElementById('closeCodeModal');

    if (!modal || !codeDisplay || !copyBtn || !closeBtn) {
        console.error('Game code modal elements not found!');
        return;
    }

    codeDisplay.textContent = gameCode;
    modal.classList.remove('hidden');

    // Copy code to clipboard
    copyBtn.onclick = () => {
        navigator.clipboard.writeText(gameCode).then(() => {
            const originalText = copyBtn.textContent;
            copyBtn.textContent = '✅ Copied!';
            setTimeout(() => {
                copyBtn.textContent = originalText;
            }, 2000);
        });
    };

    // Close modal
    closeBtn.onclick = () => {
        modal.classList.add('hidden');
    };
}
