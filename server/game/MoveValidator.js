class MoveValidator {
    constructor(board) {
        this.board = board;
    }

    isValidMove(from, to, color) {
        const piece = this.board.getPieceAt(from);
        
        if (!piece) return false;
        if (piece.color !== color) return false;

        const possibleMoves = piece.getPossibleMoves(this.board);
        if (!possibleMoves.includes(to)) return false;

        // Check if move leaves king in check
        const clonedBoard = this.board.clone();
        clonedBoard.movePiece(from, to);
        
        if (clonedBoard.isInCheck(color)) {
            return false;
        }

        return true;
    }

    getLegalMoves(position) {
        const piece = this.board.getPieceAt(position);
        if (!piece) return [];

        const possibleMoves = piece.getPossibleMoves(this.board);
        const legalMoves = [];

        for (const move of possibleMoves) {
            if (this.isValidMove(position, move, piece.color)) {
                legalMoves.push(move);
            }
        }

        return legalMoves;
    }

    hasLegalMoves(color) {
        for (const piece of this.board.pieces) {
            if (piece.color === color) {
                const legalMoves = this.getLegalMoves(piece.position);
                if (legalMoves.length > 0) {
                    return true;
                }
            }
        }
        return false;
    }

    isCheckmate(color) {
        return this.board.isInCheck(color) && !this.hasLegalMoves(color);
    }

    isStalemate(color) {
        return !this.board.isInCheck(color) && !this.hasLegalMoves(color);
    }

    isInsufficientMaterial() {
        const pieces = this.board.pieces;
        
        // King vs King
        if (pieces.length === 2) return true;

        // King + Bishop/Knight vs King
        if (pieces.length === 3) {
            const nonKing = pieces.find(p => p.type !== 'king');
            if (nonKing && (nonKing.type === 'bishop' || nonKing.type === 'knight')) {
                return true;
            }
        }

        // King + Bishop vs King + Bishop (same colored squares)
        if (pieces.length === 4) {
            const bishops = pieces.filter(p => p.type === 'bishop');
            if (bishops.length === 2) {
                const [file1, rank1] = bishops[0].positionToCoords(bishops[0].position);
                const [file2, rank2] = bishops[1].positionToCoords(bishops[1].position);
                const color1 = (file1 + rank1) % 2;
                const color2 = (file2 + rank2) % 2;
                if (color1 === color2) return true;
            }
        }

        return false;
    }

    isThreefoldRepetition() {
        // Need at least 5 positions for threefold repetition to occur
        // (initial position + 4 half-moves minimum)
        if (this.board.positionHistory.length < 5) return false;

        const currentPosition = this.board.getPositionHash();
        let count = 0;

        // Count how many times the current position has occurred
        // Note: We include the current position in the count
        for (const hash of this.board.positionHistory) {
            if (hash === currentPosition) {
                count++;
                if (count >= 3) {
                    console.log('Threefold repetition detected!');
                    return true;
                }
            }
        }

        return false;
    }

    isFiftyMoveRule() {
        // The fifty-move rule states that a draw can be claimed if
        // 50 consecutive moves (100 half-moves) have been made by both players
        // without any pawn move or capture
        // We now track this with halfMoveClock
        if (this.board.halfMoveClock >= 100) {
            console.log('Fifty-move rule triggered!');
            return true;
        }
        return false;
    }

    isDraw() {
        return this.isInsufficientMaterial() || 
               this.isThreefoldRepetition() || 
               this.isFiftyMoveRule();
    }
}

module.exports = MoveValidator;

