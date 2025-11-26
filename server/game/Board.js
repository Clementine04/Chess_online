const Piece = require('./Piece');

class Board {
    constructor() {
        this.pieces = [];
        this.enPassantTarget = null;
        this.moveHistory = [];
        this.capturedPieces = { white: [], black: [] };
        this.positionHistory = []; // Store position hashes for threefold repetition
        this.currentTurn = 'white'; // Track whose turn it is for proper position hashing
        this.castlingRights = {
            white: { kingside: true, queenside: true },
            black: { kingside: true, queenside: true }
        };
        this.halfMoveClock = 0; // For fifty-move rule
        this.initializeBoard();
    }

    initializeBoard() {
        // Pawns
        for (let i = 0; i < 8; i++) {
            const file = String.fromCharCode(97 + i);
            this.pieces.push(new Piece('pawn', 'white', file + '2'));
            this.pieces.push(new Piece('pawn', 'black', file + '7'));
        }

        // Rooks
        this.pieces.push(new Piece('rook', 'white', 'a1'));
        this.pieces.push(new Piece('rook', 'white', 'h1'));
        this.pieces.push(new Piece('rook', 'black', 'a8'));
        this.pieces.push(new Piece('rook', 'black', 'h8'));

        // Knights
        this.pieces.push(new Piece('knight', 'white', 'b1'));
        this.pieces.push(new Piece('knight', 'white', 'g1'));
        this.pieces.push(new Piece('knight', 'black', 'b8'));
        this.pieces.push(new Piece('knight', 'black', 'g8'));

        // Bishops
        this.pieces.push(new Piece('bishop', 'white', 'c1'));
        this.pieces.push(new Piece('bishop', 'white', 'f1'));
        this.pieces.push(new Piece('bishop', 'black', 'c8'));
        this.pieces.push(new Piece('bishop', 'black', 'f8'));

        // Queens
        this.pieces.push(new Piece('queen', 'white', 'd1'));
        this.pieces.push(new Piece('queen', 'black', 'd8'));

        // Kings
        this.pieces.push(new Piece('king', 'white', 'e1'));
        this.pieces.push(new Piece('king', 'black', 'e8'));

        // Store initial position hash (must be called after pieces are set up)
        this.positionHistory.push(this.getPositionHash());
    }

    getPieceAt(position) {
        return this.pieces.find(piece => piece.position === position);
    }

    movePiece(from, to, promotionType = null) {
        const piece = this.getPieceAt(from);
        if (!piece) return null;

        const capturedPiece = this.getPieceAt(to);
        let isEnPassant = false;
        let isCastling = false;

        // Update castling rights based on piece movement
        this.updateCastlingRights(piece, from);

        // En passant capture
        if (piece.type === 'pawn' && to === this.enPassantTarget) {
            isEnPassant = true;
            const direction = piece.color === 'white' ? -1 : 1;
            const [file, rank] = piece.positionToCoords(to);
            const capturedPawnPos = piece.coordsToPosition(file, rank + direction);
            const capturedPawn = this.getPieceAt(capturedPawnPos);
            if (capturedPawn) {
                this.pieces = this.pieces.filter(p => p !== capturedPawn);
                this.capturedPieces[piece.color].push(capturedPawn);
            }
        }

        // Regular capture
        if (capturedPiece) {
            this.pieces = this.pieces.filter(p => p !== capturedPiece);
            this.capturedPieces[piece.color].push(capturedPiece);
            
            // If a rook is captured, update castling rights
            if (capturedPiece.type === 'rook') {
                if (capturedPiece.color === 'white') {
                    if (to === 'a1') this.castlingRights.white.queenside = false;
                    if (to === 'h1') this.castlingRights.white.kingside = false;
                } else {
                    if (to === 'a8') this.castlingRights.black.queenside = false;
                    if (to === 'h8') this.castlingRights.black.kingside = false;
                }
            }
        }

        // Castling
        if (piece.type === 'king' && Math.abs(from.charCodeAt(0) - to.charCodeAt(0)) === 2) {
            isCastling = true;
            const rank = piece.color === 'white' ? '1' : '8';
            
            if (to.startsWith('g')) { // Kingside
                const rook = this.getPieceAt('h' + rank);
                if (rook) {
                    rook.position = 'f' + rank;
                    rook.hasMoved = true;
                }
            } else if (to.startsWith('c')) { // Queenside
                const rook = this.getPieceAt('a' + rank);
                if (rook) {
                    rook.position = 'd' + rank;
                    rook.hasMoved = true;
                }
            }
        }

        // Store move in history
        this.moveHistory.push({
            from,
            to,
            piece: { ...piece },
            capturedPiece: capturedPiece ? { ...capturedPiece } : null,
            isEnPassant,
            isCastling,
            prevEnPassantTarget: this.enPassantTarget
        });

        // Update en passant target
        this.enPassantTarget = null;
        if (piece.type === 'pawn' && Math.abs(from[1] - to[1]) === 2) {
            const [file, rank] = piece.positionToCoords(from);
            const direction = piece.color === 'white' ? 1 : -1;
            this.enPassantTarget = piece.coordsToPosition(file, rank + direction);
        }

        // Move the piece
        piece.position = to;
        piece.hasMoved = true;

        // Pawn promotion
        if (piece.type === 'pawn') {
            const rank = to[1];
            if ((piece.color === 'white' && rank === '8') || (piece.color === 'black' && rank === '1')) {
                piece.type = promotionType || 'queen';
            }
        }

        // Update half-move clock for fifty-move rule
        if (piece.type === 'pawn' || capturedPiece) {
            this.halfMoveClock = 0; // Reset on pawn move or capture
        } else {
            this.halfMoveClock++;
        }

        // Switch turn
        this.currentTurn = this.currentTurn === 'white' ? 'black' : 'white';

        // Store position hash for threefold repetition (after switching turn)
        this.positionHistory.push(this.getPositionHash());

        return {
            from,
            to,
            piece: piece.type,
            color: piece.color,
            captured: capturedPiece ? capturedPiece.type : null,
            isEnPassant,
            isCastling,
            promotion: promotionType
        };
    }

    updateCastlingRights(piece, from) {
        // Update castling rights when king or rook moves
        if (piece.type === 'king') {
            this.castlingRights[piece.color].kingside = false;
            this.castlingRights[piece.color].queenside = false;
        } else if (piece.type === 'rook') {
            if (piece.color === 'white') {
                if (from === 'a1') this.castlingRights.white.queenside = false;
                if (from === 'h1') this.castlingRights.white.kingside = false;
            } else {
                if (from === 'a8') this.castlingRights.black.queenside = false;
                if (from === 'h8') this.castlingRights.black.kingside = false;
            }
        }
    }

    getPositionHash() {
        // Create a hash of the current position for threefold repetition
        // According to FIDE rules, positions are identical if:
        // 1. Same pieces on same squares
        // 2. Same side to move
        // 3. Same castling rights
        // 4. Same en passant target
        
        const sortedPieces = this.pieces
            .map(p => `${p.type}${p.color}${p.position}`)
            .sort()
            .join('|');
        
        const castlingHash = 
            (this.castlingRights.white.kingside ? 'WK' : '') +
            (this.castlingRights.white.queenside ? 'WQ' : '') +
            (this.castlingRights.black.kingside ? 'BK' : '') +
            (this.castlingRights.black.queenside ? 'BQ' : '');
        
        return `${sortedPieces}|EP:${this.enPassantTarget || 'none'}|TURN:${this.currentTurn}|CASTLE:${castlingHash}`;
    }

    undoLastMove() {
        if (this.moveHistory.length === 0) return null;

        const lastMove = this.moveHistory.pop();
        
        // Remove last position from history
        if (this.positionHistory.length > 0) {
            this.positionHistory.pop();
        }
        
        // Switch turn back
        this.currentTurn = this.currentTurn === 'white' ? 'black' : 'white';
        
        const piece = this.getPieceAt(lastMove.to);

        if (!piece) return null;

        // Move piece back
        piece.position = lastMove.from;
        piece.type = lastMove.piece.type;
        piece.hasMoved = lastMove.piece.hasMoved;

        // Restore captured piece
        if (lastMove.capturedPiece) {
            const restoredPiece = new Piece(
                lastMove.capturedPiece.type,
                lastMove.capturedPiece.color,
                lastMove.isEnPassant ? 
                    this.getEnPassantCapturePosition(lastMove.to, piece.color) : 
                    lastMove.to
            );
            restoredPiece.hasMoved = lastMove.capturedPiece.hasMoved;
            this.pieces.push(restoredPiece);

            // Remove from captured pieces
            const capturedList = this.capturedPieces[piece.color];
            const index = capturedList.findIndex(p => 
                p.type === lastMove.capturedPiece.type && 
                p.color === lastMove.capturedPiece.color
            );
            if (index !== -1) {
                capturedList.splice(index, 1);
            }
        }

        // Undo castling
        if (lastMove.isCastling) {
            const rank = piece.color === 'white' ? '1' : '8';
            if (lastMove.to.startsWith('g')) { // Kingside
                const rook = this.getPieceAt('f' + rank);
                if (rook) {
                    rook.position = 'h' + rank;
                    rook.hasMoved = false;
                }
            } else if (lastMove.to.startsWith('c')) { // Queenside
                const rook = this.getPieceAt('d' + rank);
                if (rook) {
                    rook.position = 'a' + rank;
                    rook.hasMoved = false;
                }
            }
        }

        // Restore en passant target
        this.enPassantTarget = lastMove.prevEnPassantTarget;

        return lastMove;
    }

    getEnPassantCapturePosition(enPassantMove, attackerColor) {
        const [file, rank] = new Piece('pawn', 'white', enPassantMove).positionToCoords(enPassantMove);
        const direction = attackerColor === 'white' ? -1 : 1;
        return new Piece('pawn', 'white', 'a1').coordsToPosition(file, rank + direction);
    }

    isSquareUnderAttack(position, byColor) {
        for (const piece of this.pieces) {
            if (piece.color === byColor) continue;

            const moves = piece.getPossibleMoves(this, true); // Skip special moves to prevent infinite recursion
            if (moves.includes(position)) {
                return true;
            }
        }
        return false;
    }

    getKingPosition(color) {
        const king = this.pieces.find(p => p.type === 'king' && p.color === color);
        return king ? king.position : null;
    }

    isInCheck(color) {
        const kingPos = this.getKingPosition(color);
        if (!kingPos) return false;
        return this.isSquareUnderAttack(kingPos, color);
    }

    clone() {
        const clonedBoard = new Board();
        clonedBoard.pieces = this.pieces.map(piece => {
            const clonedPiece = new Piece(piece.type, piece.color, piece.position);
            clonedPiece.hasMoved = piece.hasMoved;
            return clonedPiece;
        });
        clonedBoard.enPassantTarget = this.enPassantTarget;
        clonedBoard.moveHistory = [...this.moveHistory];
        clonedBoard.positionHistory = [...this.positionHistory];
        clonedBoard.capturedPieces = {
            white: [...this.capturedPieces.white],
            black: [...this.capturedPieces.black]
        };
        clonedBoard.currentTurn = this.currentTurn;
        clonedBoard.castlingRights = {
            white: { ...this.castlingRights.white },
            black: { ...this.castlingRights.black }
        };
        clonedBoard.halfMoveClock = this.halfMoveClock;
        return clonedBoard;
    }

    toJSON() {
        return {
            pieces: this.pieces.map(p => ({
                type: p.type,
                color: p.color,
                position: p.position,
                hasMoved: p.hasMoved
            })),
            enPassantTarget: this.enPassantTarget,
            capturedPieces: this.capturedPieces
        };
    }
}

module.exports = Board;

