class ChessUI {
    constructor() {
        this.boardElement = document.getElementById('chessboard');
        this.selectedSquare = null;
        this.legalMoves = [];
        this.playerColor = null;
        this.gameState = null;
        this.promotionCallback = null;
        this.boardInitialized = false;
        this.moveHistory = [];
        this.currentBoardTheme = 'green'; // default theme
        this.premove = null; // {from, to}
        this.lastMove = null; // {from, to} - track last move for highlighting

        // Load saved theme
        const savedTheme = localStorage.getItem('chess_board_theme');
        if (savedTheme) {
            this.currentBoardTheme = savedTheme;
        }

        // Don't initialize board until we know player color
    }

    initializeBoard() {
        this.boardElement.innerHTML = '';

        // Apply theme
        this.boardElement.className = `chessboard theme-${this.currentBoardTheme}`;

        // Determine board orientation based on player color
        // White players see ranks 8-1 (top to bottom), Black players see ranks 1-8
        const rankStart = this.playerColor === 'black' ? 0 : 7;
        const rankEnd = this.playerColor === 'black' ? 7 : 0;
        const rankStep = this.playerColor === 'black' ? 1 : -1;
        
        const fileStart = this.playerColor === 'black' ? 7 : 0;
        const fileEnd = this.playerColor === 'black' ? 0 : 7;
        const fileStep = this.playerColor === 'black' ? -1 : 1;

        for (let rank = rankStart; this.playerColor === 'black' ? rank <= rankEnd : rank >= rankEnd; rank += rankStep) {
            for (let file = fileStart; this.playerColor === 'black' ? file >= fileEnd : file <= fileEnd; file += fileStep) {
                const square = document.createElement('div');
                const position = String.fromCharCode(97 + file) + (rank + 1);
                
                square.classList.add('square');
                square.classList.add((file + rank) % 2 === 0 ? 'dark' : 'light');
                square.dataset.position = position;
                
                square.addEventListener('click', () => this.handleSquareClick(position));
                
                this.boardElement.appendChild(square);
            }
        }
    }

    applyBoardTheme(theme) {
        this.currentBoardTheme = theme;
        localStorage.setItem('chess_board_theme', theme);
        if (this.boardElement) {
            this.boardElement.className = `chessboard theme-${theme}`;
        }
    }

    renderBoard(gameState) {
        // Always save the game state
        this.gameState = gameState;
        const board = gameState.board;

        // Ensure board is initialized before rendering
        if (!this.boardInitialized) {
            // Board will be rendered after initialization in setPlayerColor
            return;
        }

        // Clear any selections and highlights first
        this.clearSelection();

        // Clear all squares
        const squares = this.boardElement.querySelectorAll('.square');
        squares.forEach(square => {
            square.innerHTML = '';
            square.classList.remove('selected', 'highlighted', 'capture', 'in-check', 'last-move');
        });

        // Place pieces
        board.pieces.forEach(piece => {
            const square = this.getSquareElement(piece.position);
            if (square) {
                const img = document.createElement('img');
                img.src = `images/pieces/${piece.color}_${piece.type}.png`;
                img.alt = `${piece.color} ${piece.type}`;
                img.draggable = false;
                square.appendChild(img);
            }
        });

        // Highlight last move
        if (this.lastMove) {
            const fromSquare = this.getSquareElement(this.lastMove.from);
            const toSquare = this.getSquareElement(this.lastMove.to);
            if (fromSquare) fromSquare.classList.add('last-move');
            if (toSquare) toSquare.classList.add('last-move');
        }

        // Highlight king if in check
        if (gameState.isCheck) {
            const kingInCheck = board.pieces.find(p =>
                p.type === 'king' && gameState.isCheck[p.color]
            );
            if (kingInCheck) {
                const kingSquare = this.getSquareElement(kingInCheck.position);
                if (kingSquare) {
                    kingSquare.classList.add('in-check');
                }
            }
        }

        // Update captured pieces
        this.updateCapturedPieces(board.capturedPieces);
    }

    handleSquareClick(position) {
        // Block all clicks if game is not active or doesn't exist
        if (!this.gameState) {
            console.log('No game state, ignoring click');
            return;
        }

        // Block clicks if game has ended (any status other than 'active')
        if (this.gameState.status !== 'active') {
            console.log(`Game status is ${this.gameState.status}, ignoring click`);
            // Show appropriate message based on status
            if (this.gameState.status === 'timeout') {
                this.showMessage('Game ended - Time expired!', 'error');
            } else if (this.gameState.status === 'checkmate') {
                this.showMessage('Game ended - Checkmate!', 'error');
            } else if (['stalemate', 'draw', 'resigned'].includes(this.gameState.status)) {
                this.showMessage(`Game ended - ${this.gameState.status}!`, 'error');
            } else if (this.gameState.status === 'waiting') {
                this.showMessage('Waiting for opponent...', 'info');
            }
            return;
        }

        // If clicking on the board, cancel any premove
        if (this.premove) {
            this.cancelPremove();
        }

        const piece = this.getPieceAt(position);

        // Check if it's the player's turn
        if (this.gameState.currentTurn !== this.playerColor) {
            // Allow pre-moves when it's not your turn
            if (piece && piece.color === this.playerColor) {
                this.selectSquare(position);
                wsClient.getLegalMoves(position);
                return;
            }

            // If square is selected, set as premove
            if (this.selectedSquare) {
                if (this.legalMoves.includes(position)) {
                    this.setPremove(this.selectedSquare, position);
                    this.clearSelection();
                } else {
                    this.clearSelection();
                }
            }
            return;
        }

        // If clicking on own piece, select it
        if (piece && piece.color === this.playerColor) {
            this.selectSquare(position);
            wsClient.getLegalMoves(position);
            return;
        }

        // If square is selected, try to move
        if (this.selectedSquare) {
            if (this.legalMoves.includes(position)) {
                this.makeMove(this.selectedSquare, position);
            } else {
                this.clearSelection();
            }
        }
    }

    setPremove(from, to) {
        this.premove = { from, to };
        
        // Visually mark the premove
        const fromSquare = this.getSquareElement(from);
        const toSquare = this.getSquareElement(to);
        
        if (fromSquare) fromSquare.classList.add('premove');
        if (toSquare) toSquare.classList.add('premove');
        
        this.showMessage('Pre-move set! Click board to cancel.', 'info');
    }

    cancelPremove() {
        if (!this.premove) return;
        
        const fromSquare = this.getSquareElement(this.premove.from);
        const toSquare = this.getSquareElement(this.premove.to);
        
        if (fromSquare) fromSquare.classList.remove('premove');
        if (toSquare) toSquare.classList.remove('premove');
        
        this.premove = null;
    }

    executePremove() {
        if (!this.premove) return;
        
        const { from, to } = this.premove;
        this.cancelPremove();
        
        // Execute the premove
        setTimeout(() => {
            this.makeMove(from, to);
        }, 100);
    }

    selectSquare(position) {
        this.clearSelection();
        
        this.selectedSquare = position;
        const square = this.getSquareElement(position);
        if (square) {
            square.classList.add('selected');
        }
    }

    clearSelection() {
        if (this.selectedSquare) {
            const square = this.getSquareElement(this.selectedSquare);
            if (square) {
                square.classList.remove('selected');
            }
        }
        
        this.selectedSquare = null;
        this.clearHighlights();
    }

    showLegalMoves(position, moves) {
        // Clear highlights FIRST, before setting legal moves
        this.clearHighlights();
        // Now set the legal moves (after clearHighlights won't clear them)
        this.legalMoves = moves;

        moves.forEach(move => {
            const square = this.getSquareElement(move);
            if (square) {
                square.classList.add('highlighted');
                
                // Check if it's a capture move
                const targetPiece = this.getPieceAt(move);
                if (targetPiece) {
                    square.classList.add('capture');
                }
            }
        });
    }

    clearHighlights() {
        const highlighted = this.boardElement.querySelectorAll('.highlighted');
        highlighted.forEach(square => {
            square.classList.remove('highlighted', 'capture');
        });
        this.legalMoves = [];
    }

    setLastMove(from, to) {
        // Store the last move for highlighting
        this.lastMove = { from, to };
    }

    makeMove(from, to) {
        const piece = this.getPieceAt(from);
        
        // Check if pawn promotion
        if (piece && piece.type === 'pawn') {
            const toRank = to[1];
            if ((piece.color === 'white' && toRank === '8') || 
                (piece.color === 'black' && toRank === '1')) {
                this.showPromotionModal(piece.color, (promotionType) => {
                    wsClient.makeMove(from, to, promotionType);
                    this.clearSelection();
                });
                return;
            }
        }

        wsClient.makeMove(from, to);
        this.clearSelection();
    }

    showPromotionModal(color, callback) {
        const modal = document.getElementById('promotionModal');
        modal.classList.remove('hidden');

        // Update promotion piece images
        const pieces = ['queen', 'rook', 'bishop', 'knight'];
        pieces.forEach(piece => {
            const img = document.getElementById(`promote${piece.charAt(0).toUpperCase() + piece.slice(1)}`);
            img.src = `images/pieces/${color}_${piece}.png`;
        });

        const choices = modal.querySelectorAll('.promotion-piece');
        
        const handleChoice = (e) => {
            const piece = e.currentTarget.dataset.piece;
            modal.classList.add('hidden');
            choices.forEach(choice => {
                choice.removeEventListener('click', handleChoice);
            });
            callback(piece);
        };

        choices.forEach(choice => {
            choice.addEventListener('click', handleChoice);
        });
    }

    getPieceAt(position) {
        if (!this.gameState) return null;
        return this.gameState.board.pieces.find(p => p.position === position);
    }

    getSquareElement(position) {
        return this.boardElement.querySelector(`[data-position="${position}"]`);
    }

    updateTurnIndicator(currentTurn, playerColor) {
        const turnIndicator = document.getElementById('turnIndicator');
        
        if (currentTurn === playerColor) {
            turnIndicator.textContent = '🟢 Your Turn';
            turnIndicator.style.color = '#27ae60';
        } else {
            turnIndicator.textContent = '⏳ Opponent\'s Turn';
            turnIndicator.style.color = '#e74c3c';
        }
    }

    showCheckIndicator(show) {
        const checkIndicator = document.getElementById('checkIndicator');
        if (show) {
            checkIndicator.classList.remove('hidden');
        } else {
            checkIndicator.classList.add('hidden');
        }
    }

    updateGameStatus(status, winner = null) {
        const gameStatus = document.getElementById('gameStatus');
        
        // Always update game state status
        if (this.gameState) {
            this.gameState.status = status;
            if (winner) {
                this.gameState.winner = winner;
            }
        }
        
        switch (status) {
            case 'waiting':
                gameStatus.textContent = 'Waiting for opponent...';
                gameStatus.style.color = '#f39c12';
                break;
            case 'active':
                gameStatus.textContent = 'In Progress';
                gameStatus.style.color = '#27ae60';
                break;
            case 'checkmate':
                gameStatus.textContent = `Checkmate! ${winner ? winner.toUpperCase() : ''} wins!`;
                gameStatus.style.color = '#e74c3c';
                this.showGameEndMessage(`Checkmate! ${winner ? winner.toUpperCase() : ''} wins!`, 'success');
                break;
            case 'stalemate':
                gameStatus.textContent = 'Stalemate - Draw';
                gameStatus.style.color = '#f39c12';
                this.showGameEndMessage('Game ended in stalemate!', 'warning');
                break;
            case 'draw':
                gameStatus.textContent = 'Draw';
                gameStatus.style.color = '#f39c12';
                this.showGameEndMessage('Game ended in a draw!', 'warning');
                break;
            case 'resigned':
                gameStatus.textContent = `${winner ? winner.toUpperCase() : ''} wins by resignation`;
                gameStatus.style.color = '#e74c3c';
                this.showGameEndMessage(`${winner ? winner.toUpperCase() : ''} wins by resignation!`, 'success');
                break;
            case 'timeout':
                gameStatus.textContent = `${winner ? winner.toUpperCase() : ''} wins on time`;
                gameStatus.style.color = '#e74c3c';
                this.showGameEndMessage(`${winner ? winner.toUpperCase() : ''} wins on time!`, 'error');
                break;
            default:
                gameStatus.textContent = status;
                gameStatus.style.color = '#95a5a6';
        }
    }

    updateCapturedPieces(capturedPieces) {
        const capturedWhite = document.querySelector('#capturedWhite .pieces-list');
        const capturedBlack = document.querySelector('#capturedBlack .pieces-list');

        capturedWhite.innerHTML = '';
        capturedBlack.innerHTML = '';

        // Piece values for scoring
        const pieceValues = {
            'pawn': 1,
            'knight': 3,
            'bishop': 3,
            'rook': 5,
            'queen': 9,
            'king': 0 // King is not counted in material
        };

        let whiteScore = 0;
        let blackScore = 0;

        // White's captures (black pieces captured by white)
        capturedPieces.white.forEach(piece => {
            const img = document.createElement('img');
            img.src = `images/pieces/${piece.color}_${piece.type}.png`;
            img.alt = piece.type;
            img.title = `${piece.type} (${pieceValues[piece.type]})`;
            capturedWhite.appendChild(img);
            whiteScore += pieceValues[piece.type] || 0;
        });

        // Black's captures (white pieces captured by black)
        capturedPieces.black.forEach(piece => {
            const img = document.createElement('img');
            img.src = `images/pieces/${piece.color}_${piece.type}.png`;
            img.alt = piece.type;
            img.title = `${piece.type} (${pieceValues[piece.type]})`;
            capturedBlack.appendChild(img);
            blackScore += pieceValues[piece.type] || 0;
        });

        // Update score displays
        const whiteScoreEl = document.getElementById('whiteScore');
        const blackScoreEl = document.getElementById('blackScore');
        
        if (whiteScoreEl) {
            whiteScoreEl.textContent = `Score: ${whiteScore}`;
        }
        if (blackScoreEl) {
            blackScoreEl.textContent = `Score: ${blackScore}`;
        }

        // Update material advantage
        const advantageEl = document.getElementById('materialAdvantage');
        const advantageDisplay = advantageEl?.querySelector('.advantage-display');
        
        if (advantageDisplay) {
            const diff = whiteScore - blackScore;
            
            if (diff > 0) {
                advantageDisplay.textContent = `White +${diff}`;
                advantageDisplay.className = 'advantage-display white-advantage';
            } else if (diff < 0) {
                advantageDisplay.textContent = `Black +${Math.abs(diff)}`;
                advantageDisplay.className = 'advantage-display black-advantage';
            } else {
                advantageDisplay.textContent = 'Material: Even';
                advantageDisplay.className = 'advantage-display';
            }
        }
    }

    updateLeaderboard(leaderboard) {
        // Only update home leaderboard
        const homeLeaderboard = document.getElementById('homeLeaderboardList');
        
        if (!homeLeaderboard) return;
        
        console.log('Updating leaderboard with data:', leaderboard);
        homeLeaderboard.innerHTML = '';

        if (!leaderboard || leaderboard.length === 0) {
            homeLeaderboard.innerHTML = '<div class="loading">No players yet</div>';
            return;
        }

        // Sort by Elo rating (highest first) and take top 10
        const topPlayers = [...leaderboard]
            .sort((a, b) => (b.eloRating || 0) - (a.eloRating || 0))
            .slice(0, 10);

        topPlayers.forEach((player, index) => {
            const item = document.createElement('div');
            item.classList.add('leaderboard-item');
            item.classList.add(`rank-${index + 1}`);

            // Use eloRating if available, otherwise fall back to rating
            const rating = player.eloRating || player.rating || 1200;

            item.innerHTML = `
                <span class="player-rank">#${index + 1}</span>
                <span class="player-name">${player.username}</span>
                <div class="player-stats">
                    <span class="player-rating">${rating} Elo</span>
                    <span class="player-stats-detail">${player.wins || 0}W ${player.draws || 0}D ${player.losses || 0}L</span>
                </div>
            `;

            homeLeaderboard.appendChild(item);
        });
        
        console.log(`Leaderboard updated with ${topPlayers.length} players`);
    }

    clearBoard() {
        console.log('Clearing board completely...');

        // Clear the board state completely
        this.selectedSquare = null;
        this.legalMoves = [];
        this.gameState = null;
        this.playerColor = null;
        this.boardInitialized = false;
        this.promotionCallback = null;
        this.moveHistory = [];
        this.premove = null;
        this.lastMove = null;

        // Clear all squares
        if (this.boardElement) {
            const squares = this.boardElement.querySelectorAll('.square');
            squares.forEach(square => {
                square.innerHTML = '';
                square.classList.remove('selected', 'highlighted', 'capture', 'in-check', 'premove', 'last-move');
            });

            // Clear the entire board element to prepare for new game
            this.boardElement.innerHTML = '';
        }
        
        // Clear captured pieces displays
        const capturedWhite = document.querySelector('#capturedWhite .pieces-list');
        const capturedBlack = document.querySelector('#capturedBlack .pieces-list');
        if (capturedWhite) capturedWhite.innerHTML = '';
        if (capturedBlack) capturedBlack.innerHTML = '';
        
        // Reset scores
        const whiteScore = document.getElementById('whiteScore');
        const blackScore = document.getElementById('blackScore');
        if (whiteScore) whiteScore.textContent = 'Score: 0';
        if (blackScore) blackScore.textContent = 'Score: 0';
        
        // Reset material advantage
        const advantageDisplay = document.querySelector('#materialAdvantage .advantage-display');
        if (advantageDisplay) {
            advantageDisplay.textContent = 'Material: Even';
            advantageDisplay.className = 'advantage-display';
        }
        
        // Clear move history
        this.clearMoveHistory();
        
        // Clear chat
        this.clearChat();
        
        console.log('Board cleared successfully');
    }

    // Move History Functions
    addMoveToHistory(move, color) {
        const notation = this.convertToChessNotation(move, color);
        this.moveHistory.push({ notation, color, move });
        this.updateMoveHistoryDisplay();
    }

    convertToChessNotation(move, color) {
        // Basic chess notation conversion
        const { from, to, piece, captured, promotion, isCastling } = move;
        
        if (isCastling) {
            // King-side or Queen-side castling
            return to === 'g1' || to === 'g8' ? 'O-O' : 'O-O-O';
        }
        
        let notation = '';
        
        // Piece letter (K, Q, R, B, N) - pawns have no letter
        if (piece !== 'pawn') {
            notation += piece.charAt(0).toUpperCase();
        }
        
        // File hint for pawns that capture
        if (piece === 'pawn' && captured) {
            notation += from.charAt(0);
        }
        
        // Capture symbol
        if (captured) {
            notation += 'x';
        }
        
        // Destination square
        notation += to;
        
        // Promotion
        if (promotion) {
            notation += '=' + promotion.charAt(0).toUpperCase();
        }
        
        return notation;
    }

    updateMoveHistoryDisplay() {
        const historyList = document.getElementById('moveHistoryList');
        if (!historyList) return;
        
        historyList.innerHTML = '';
        
        if (this.moveHistory.length === 0) {
            historyList.innerHTML = '<div class="no-moves">No moves yet</div>';
            return;
        }
        
        // Group moves by pairs (white, black)
        for (let i = 0; i < this.moveHistory.length; i += 2) {
            const moveNum = Math.floor(i / 2) + 1;
            const whiteMove = this.moveHistory[i];
            const blackMove = this.moveHistory[i + 1];
            
            const movePair = document.createElement('div');
            movePair.className = 'move-pair';
            
            const moveNumber = document.createElement('span');
            moveNumber.className = 'move-number';
            moveNumber.textContent = `${moveNum}.`;
            
            const whiteMoveEl = document.createElement('span');
            whiteMoveEl.className = 'move-white';
            whiteMoveEl.textContent = whiteMove.notation;
            
            movePair.appendChild(moveNumber);
            movePair.appendChild(whiteMoveEl);
            
            if (blackMove) {
                const blackMoveEl = document.createElement('span');
                blackMoveEl.className = 'move-black';
                blackMoveEl.textContent = blackMove.notation;
                movePair.appendChild(blackMoveEl);
            }
            
            historyList.appendChild(movePair);
        }
        
        // Auto-scroll to bottom
        historyList.scrollTop = historyList.scrollHeight;
    }

    clearMoveHistory() {
        this.moveHistory = [];
        const historyList = document.getElementById('moveHistoryList');
        if (historyList) {
            historyList.innerHTML = '<div class="no-moves">No moves yet</div>';
        }
    }

    // Chat Functions
    addChatMessage(message, sender, isOwn = false) {
        const chatMessages = document.getElementById('chatMessages');
        if (!chatMessages) return;
        
        // Remove info message if it exists
        const infoMsg = chatMessages.querySelector('.chat-info');
        if (infoMsg) {
            infoMsg.remove();
        }
        
        const messageEl = document.createElement('div');
        messageEl.className = `chat-message ${isOwn ? 'own' : 'opponent'}`;
        
        const senderEl = document.createElement('div');
        senderEl.className = 'sender';
        senderEl.textContent = sender;
        
        const textEl = document.createElement('div');
        textEl.className = 'text';
        textEl.textContent = message;
        
        messageEl.appendChild(senderEl);
        messageEl.appendChild(textEl);
        chatMessages.appendChild(messageEl);
        
        // Auto-scroll to bottom
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    clearChat() {
        const chatMessages = document.getElementById('chatMessages');
        if (chatMessages) {
            chatMessages.innerHTML = '<div class="chat-info">Chat with your opponent</div>';
        }
    }

    updateTimers(timerData, playerColor) {
        if (!timerData || !playerColor) {
            return;
        }
        
        const playerTime = timerData[playerColor];
        const opponentColor = playerColor === 'white' ? 'black' : 'white';
        const opponentTime = timerData[opponentColor];
        
        // Format time as MM:SS
        const formatTime = (ms) => {
            const totalSeconds = Math.max(0, Math.floor(ms / 1000));
            const minutes = Math.floor(totalSeconds / 60);
            const seconds = totalSeconds % 60;
            return `${minutes}:${seconds.toString().padStart(2, '0')}`;
        };
        
        // Update player timer
        const playerTimerEl = document.getElementById('playerTimer');
        if (playerTimerEl) {
            const playerValueEl = playerTimerEl.querySelector('.timer-value');
            if (playerValueEl) {
                playerValueEl.textContent = formatTime(playerTime);
            }
            
            if (timerData.activeColor === playerColor) {
                playerTimerEl.classList.add('active');
            } else {
                playerTimerEl.classList.remove('active');
            }
            
            if (playerTime < 30000) {
                playerTimerEl.classList.add('low-time');
            } else {
                playerTimerEl.classList.remove('low-time');
            }
        }
        
        // Update opponent timer
        const opponentTimerEl = document.getElementById('opponentTimer');
        if (opponentTimerEl) {
            const opponentValueEl = opponentTimerEl.querySelector('.timer-value');
            if (opponentValueEl) {
                opponentValueEl.textContent = formatTime(opponentTime);
            }
            
            if (timerData.activeColor === opponentColor) {
                opponentTimerEl.classList.add('active');
            } else {
                opponentTimerEl.classList.remove('active');
            }
            
            if (opponentTime < 30000) {
                opponentTimerEl.classList.add('low-time');
            } else {
                opponentTimerEl.classList.remove('low-time');
            }
        }
    }

    showMessage(message, type = 'info') {
        const messagesDiv = document.getElementById('gameMessages');
        messagesDiv.textContent = message;
        messagesDiv.className = 'game-messages';
        
        if (type) {
            messagesDiv.classList.add(type);
        }

        setTimeout(() => {
            messagesDiv.textContent = '';
            messagesDiv.className = 'game-messages';
        }, 5000);
    }

    showGameEndMessage(message, type) {
        const messagesDiv = document.getElementById('gameMessages');
        messagesDiv.textContent = message;
        messagesDiv.className = 'game-messages';
        messagesDiv.classList.add(type);
    }

    showConfirmation(title, message, callback) {
        const modal = document.getElementById('confirmationModal');
        const titleEl = document.getElementById('confirmTitle');
        const messageEl = document.getElementById('confirmMessage');
        const yesBtn = document.getElementById('confirmYes');
        const noBtn = document.getElementById('confirmNo');

        titleEl.textContent = title;
        messageEl.textContent = message;
        modal.classList.remove('hidden');

        const handleYes = () => {
            modal.classList.add('hidden');
            cleanup();
            callback(true);
        };

        const handleNo = () => {
            modal.classList.add('hidden');
            cleanup();
            callback(false);
        };

        const cleanup = () => {
            yesBtn.removeEventListener('click', handleYes);
            noBtn.removeEventListener('click', handleNo);
        };

        yesBtn.addEventListener('click', handleYes);
        noBtn.addEventListener('click', handleNo);
    }

    enableControls(enabled) {
        const undoBtn = document.getElementById('undoBtn');
        const drawBtn = document.getElementById('drawBtn');
        const surrenderBtn = document.getElementById('surrenderBtn');
        
        if (undoBtn) undoBtn.disabled = !enabled;
        if (drawBtn) drawBtn.disabled = !enabled;
        if (surrenderBtn) surrenderBtn.disabled = !enabled;
        
        console.log(`Controls ${enabled ? 'enabled' : 'disabled'}`);
    }

    setPlayerColor(color) {
        this.playerColor = color;
        const playerColorEl = document.getElementById('playerColor');
        const yourColorEl = document.getElementById('yourColor');
        
        if (playerColorEl) {
            playerColorEl.textContent = `Playing as ${color.toUpperCase()}`;
        }
        if (yourColorEl) {
            yourColorEl.textContent = color.toUpperCase();
        }
        
        // Initialize board and coordinates
        this.initializeBoard();
        this.initializeCoordinates();
        this.boardInitialized = true;
        
        // If we have a game state waiting, render it now
        if (this.gameState) {
            this.renderBoard(this.gameState);
        }
    }
    
    initializeCoordinates() {
        const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
        const ranks = ['8', '7', '6', '5', '4', '3', '2', '1'];
        
        const displayFiles = this.playerColor === 'black' ? [...files].reverse() : files;
        const displayRanks = this.playerColor === 'black' ? [...ranks].reverse() : ranks;
        
        // Top and bottom files
        const topFiles = document.getElementById('coordFilesTop');
        const bottomFiles = document.getElementById('coordFilesBottom');
        if (topFiles) topFiles.innerHTML = displayFiles.map(f => `<span>${f}</span>`).join('');
        if (bottomFiles) bottomFiles.innerHTML = displayFiles.map(f => `<span>${f}</span>`).join('');
        
        // Left and right ranks
        const leftRanks = document.getElementById('coordRanksLeft');
        const rightRanks = document.getElementById('coordRanksRight');
        if (leftRanks) leftRanks.innerHTML = displayRanks.map(r => `<span>${r}</span>`).join('');
        if (rightRanks) rightRanks.innerHTML = displayRanks.map(r => `<span>${r}</span>`).join('');
    }



    updateOpponentName(name) {
        document.getElementById('opponentName').textContent = name || 'Waiting...';
    }

    showEndgameModal(status, isWinner, isDraw) {
        const modal = document.getElementById('endgameModal');
        const icon = document.getElementById('endgameIcon');
        const title = document.getElementById('endgameTitle');
        const message = document.getElementById('endgameMessage');

        console.log(`Showing endgame modal - Status: ${status}, Winner: ${isWinner}, Draw: ${isDraw}`);

        // Reset modal state - hide notifications and waiting, show buttons
        const notification = document.getElementById('rematchNotification');
        const waitingDiv = document.getElementById('rematchWaiting');
        const buttonsDiv = document.getElementById('endgameButtons');
        
        if (notification) notification.classList.add('hidden');
        if (waitingDiv) waitingDiv.classList.add('hidden');
        if (buttonsDiv) buttonsDiv.classList.remove('hidden');

        // Set icon, title, and message based on game result
        if (isDraw) {
            icon.textContent = '🤝';
            title.textContent = 'Draw!';
            if (status === 'stalemate') {
                message.textContent = 'The game ended in a stalemate.';
            } else {
                message.textContent = 'The game ended in a draw.';
            }
            title.style.color = '#f39c12'; // Warning color (orange/gold)
        } else if (isWinner) {
            icon.textContent = '🏆';
            title.textContent = 'Victory!';
            
            // Different messages based on how they won
            if (status === 'checkmate') {
                message.textContent = '♟️ Checkmate! You won the game!';
            } else if (status === 'timeout') {
                message.textContent = "⏱️ You Win – Opponent's Time Expired!";
            } else if (status === 'resigned') {
                message.textContent = '🏳️ You won by resignation!';
            } else {
                message.textContent = '🏆 You won the game!';
            }
            
            title.style.color = '#27ae60'; // Success color (green)
        } else {
            icon.textContent = '😔';
            title.textContent = 'Defeat';
            
            // Different messages based on how they lost
            if (status === 'checkmate') {
                message.textContent = '♟️ Checkmate! You lost the game.';
            } else if (status === 'timeout') {
                message.textContent = '⏱️ You Lost – Time Expired!';
            } else if (status === 'resigned') {
                message.textContent = '🏳️ You lost by resignation.';
            } else {
                message.textContent = '😔 You lost the game.';
            }
            
            title.style.color = '#e74c3c'; // Danger color (red)
        }

        modal.classList.remove('hidden');
    }
}

// Create global UI instance
const chessUI = new ChessUI();

