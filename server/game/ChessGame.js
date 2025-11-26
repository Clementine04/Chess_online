const Board = require('./Board');
const MoveValidator = require('./MoveValidator');
const ChessTimer = require('./ChessTimer');

class ChessGame {
    constructor(gameId, timeControl = 'blitz') {
        this.gameId = gameId;
        this.board = new Board();
        this.validator = new MoveValidator(this.board);
        this.currentTurn = 'white';
        this.players = {
            white: null,
            black: null
        };
        this.status = 'waiting'; // 'waiting', 'active', 'checkmate', 'stalemate', 'draw', 'resigned', 'timeout'
        this.winner = null;
        this.pendingUndo = null;
        this.pendingDraw = null;
        this.timer = new ChessTimer(timeControl);
        this.timeControl = timeControl;
        this.timerInterval = null;
    }

    addPlayer(playerId, playerName) {
        if (!this.players.white) {
            this.players.white = { id: playerId, name: playerName };
            return 'white';
        } else if (!this.players.black) {
            this.players.black = { id: playerId, name: playerName };
            this.status = 'active';
            // Start the timer for white (first player)
            this.startTimer();
            return 'black';
        }
        return null;
    }

    startTimer() {
        console.log(`Starting timer for game ${this.gameId}`);
        this.timer.start('white');
        
        // Set up interval to check for timeout - check frequently
        this.timerInterval = setInterval(() => {
            const timeout = this.timer.update();
            if (timeout && timeout.timeout && timeout.loser) {
                console.log(`Timeout detected in game ${this.gameId} - Loser: ${timeout.loser}`);
                const gameEnded = this.handleTimeout(timeout.loser);
                
                // If game ended, clear the interval immediately
                if (gameEnded) {
                    clearInterval(this.timerInterval);
                    this.timerInterval = null;
                }
            }
        }, 50); // Check every 50ms for accuracy
    }

    stopTimer() {
        this.timer.stop();
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
        }
    }

    handleTimeout(color) {
        // Validate color parameter
        if (!color || (color !== 'white' && color !== 'black')) {
            console.error(`handleTimeout called with invalid color: ${color}`);
            return false;
        }
        
        // Don't process timeout if game already ended
        if (this.status !== 'active') {
            console.log(`Timeout ignored - game already ended with status: ${this.status}`);
            return false;
        }
        
        console.log(`TIMEOUT: ${color}'s time expired`);
        this.status = 'timeout';
        this.winner = color === 'white' ? 'black' : 'white';
        this.stopTimer();
        console.log(`Game ended by timeout. Winner: ${this.winner} (${color} ran out of time)`);
        return true; // Indicate that game has ended
    }

    getTimerState() {
        const times = this.timer.getTimeRemaining();
        return {
            white: times.white,
            black: times.black,
            activeColor: this.timer.activeColor
        };
    }

    removePlayer(playerId) {
        if (this.players.white && this.players.white.id === playerId) {
            this.players.white = null;
        }
        if (this.players.black && this.players.black.id === playerId) {
            this.players.black = null;
        }
    }

    isFull() {
        return this.players.white !== null && this.players.black !== null;
    }

    getPlayerColor(playerId) {
        if (this.players.white && this.players.white.id === playerId) return 'white';
        if (this.players.black && this.players.black.id === playerId) return 'black';
        return null;
    }

    getOpponentColor(color) {
        return color === 'white' ? 'black' : 'white';
    }

    makeMove(playerId, from, to, promotionType = null) {
        const playerColor = this.getPlayerColor(playerId);
        
        if (!playerColor) {
            return { success: false, error: 'Player not in game' };
        }

        // Block moves if game is not active (includes timeout, checkmate, etc.)
        if (this.status !== 'active') {
            console.log(`Move rejected - game status is ${this.status}`);
            return { success: false, error: `Game is not active (status: ${this.status})` };
        }

        if (playerColor !== this.currentTurn) {
            return { success: false, error: 'Not your turn' };
        }

        if (!this.validator.isValidMove(from, to, playerColor)) {
            return { success: false, error: 'Invalid move' };
        }

        const moveResult = this.board.movePiece(from, to, promotionType);
        
        // Board.movePiece already switched the turn, so sync with it
        this.currentTurn = this.board.currentTurn;
        
        // Switch timer to current player (after the move)
        const opponentColor = this.currentTurn;
        this.timer.switchTurn(playerColor, opponentColor);

        // Check game end conditions
        
        if (this.validator.isCheckmate(opponentColor)) {
            this.status = 'checkmate';
            this.winner = playerColor;
            this.stopTimer(); // Stop timer on checkmate
        } else if (this.validator.isStalemate(opponentColor)) {
            this.status = 'stalemate';
            this.stopTimer(); // Stop timer on stalemate
        } else if (this.validator.isDraw()) {
            this.status = 'draw';
            this.stopTimer(); // Stop timer on draw
        }

        return {
            success: true,
            move: moveResult,
            gameState: this.getGameState(),
            isCheck: this.board.isInCheck(opponentColor),
            isCheckmate: this.status === 'checkmate',
            isStalemate: this.status === 'stalemate',
            isDraw: this.status === 'draw'
        };
    }

    getLegalMoves(position) {
        // Don't return legal moves if game is not active
        if (this.status !== 'active') {
            return [];
        }
        return this.validator.getLegalMoves(position);
    }

    requestUndo(playerId) {
        const playerColor = this.getPlayerColor(playerId);
        if (!playerColor || this.board.moveHistory.length === 0) {
            return { success: false, error: 'Cannot undo' };
        }

        const opponentColor = this.getOpponentColor(playerColor);
        this.pendingUndo = {
            requestedBy: playerId,
            color: playerColor
        };

        return {
            success: true,
            message: 'Undo requested',
            opponentId: this.players[opponentColor].id
        };
    }

    respondToUndo(playerId, accepted) {
        if (!this.pendingUndo) {
            return { success: false, error: 'No pending undo request' };
        }

        const playerColor = this.getPlayerColor(playerId);
        const requesterColor = this.pendingUndo.color;

        if (playerColor === requesterColor) {
            return { success: false, error: 'Cannot respond to your own request' };
        }

        if (!accepted) {
            this.pendingUndo = null;
            return { success: true, accepted: false, message: 'Undo denied' };
        }

        // Perform undo
        const undoneMove = this.board.undoLastMove();
        if (undoneMove) {
            // Board.undoLastMove already switched turn back, sync with it
            const previousPlayer = this.board.currentTurn;
            
            // Switch timer back to match board state
            const currentTimerPlayer = this.currentTurn;
            this.timer.switchTurn(currentTimerPlayer, previousPlayer);
            
            this.currentTurn = previousPlayer;
            this.status = 'active'; // Reset status if game had ended
            this.winner = null;
        }

        this.pendingUndo = null;
        return {
            success: true,
            accepted: true,
            gameState: this.getGameState()
        };
    }

    requestDraw(playerId) {
        const playerColor = this.getPlayerColor(playerId);
        if (!playerColor) {
            return { success: false, error: 'Player not in game' };
        }

        const opponentColor = this.getOpponentColor(playerColor);
        this.pendingDraw = {
            requestedBy: playerId,
            color: playerColor
        };

        return {
            success: true,
            message: 'Draw offered',
            opponentId: this.players[opponentColor].id
        };
    }

    respondToDraw(playerId, accepted) {
        if (!this.pendingDraw) {
            return { success: false, error: 'No pending draw offer' };
        }

        const playerColor = this.getPlayerColor(playerId);
        const requesterColor = this.pendingDraw.color;

        if (playerColor === requesterColor) {
            return { success: false, error: 'Cannot respond to your own offer' };
        }

        this.pendingDraw = null;

        if (!accepted) {
            return { success: true, accepted: false, message: 'Draw declined' };
        }

        this.status = 'draw';
        this.stopTimer(); // Stop timer on accepted draw
        return {
            success: true,
            accepted: true,
            gameState: this.getGameState()
        };
    }

    surrender(playerId) {
        const playerColor = this.getPlayerColor(playerId);
        if (!playerColor) {
            return { success: false, error: 'Player not in game' };
        }

        this.status = 'resigned';
        this.winner = this.getOpponentColor(playerColor);
        this.stopTimer(); // Stop timer when game ends

        return {
            success: true,
            gameState: this.getGameState()
        };
    }

    getGameState() {
        return {
            gameId: this.gameId,
            board: this.board.toJSON(),
            currentTurn: this.currentTurn,
            status: this.status,
            winner: this.winner,
            players: this.players,
            isCheck: {
                white: this.board.isInCheck('white'),
                black: this.board.isInCheck('black')
            },
            timer: this.getTimerState(),
            timeControl: this.timeControl
        };
    }

    resetGame() {
        // Stop all timers
        this.stopTimer();
        
        // Reset board
        this.board = new Board();
        this.validator = new MoveValidator(this.board);
        
        // Reset game state - sync with board's turn
        this.currentTurn = this.board.currentTurn; // Board initializes to 'white'
        this.status = 'active';
        this.winner = null;
        this.pendingUndo = null;
        this.pendingDraw = null;
        
        // Reset timer completely
        this.timer.reset(this.timeControl);
        
        // Start timer for white
        this.startTimer();
        
        console.log(`Game ${this.gameId} reset for rematch`);
    }
}

module.exports = ChessGame;

