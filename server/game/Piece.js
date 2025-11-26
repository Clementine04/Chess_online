class Piece {
    constructor(type, color, position) {
        this.type = type; // 'king', 'queen', 'rook', 'bishop', 'knight', 'pawn'
        this.color = color; // 'white' or 'black'
        this.position = position; // e.g., 'e2'
        this.hasMoved = false;
    }

    getImageName() {
        return `${this.color}_${this.type}.png`;
    }

    getPossibleMoves(board, skipSpecialMoves = false) {
        switch (this.type) {
            case 'pawn':
                return this.getPawnMoves(board);
            case 'rook':
                return this.getRookMoves(board);
            case 'knight':
                return this.getKnightMoves(board);
            case 'bishop':
                return this.getBishopMoves(board);
            case 'queen':
                return this.getQueenMoves(board);
            case 'king':
                return this.getKingMoves(board, skipSpecialMoves);
            default:
                return [];
        }
    }

    getPawnMoves(board) {
        const moves = [];
        const [file, rank] = this.positionToCoords(this.position);
        const direction = this.color === 'white' ? 1 : -1;
        const startRank = this.color === 'white' ? 1 : 6;

        // Forward one square
        const forward = this.coordsToPosition(file, rank + direction);
        if (forward && !board.getPieceAt(forward)) {
            moves.push(forward);

            // Forward two squares from starting position
            if (rank === startRank) {
                const forwardTwo = this.coordsToPosition(file, rank + 2 * direction);
                if (forwardTwo && !board.getPieceAt(forwardTwo)) {
                    moves.push(forwardTwo);
                }
            }
        }

        // Captures (diagonal)
        const captureLeft = this.coordsToPosition(file - 1, rank + direction);
        const captureRight = this.coordsToPosition(file + 1, rank + direction);

        if (captureLeft) {
            const targetPiece = board.getPieceAt(captureLeft);
            if (targetPiece && targetPiece.color !== this.color) {
                moves.push(captureLeft);
            }
            // En passant
            if (board.enPassantTarget === captureLeft) {
                moves.push(captureLeft);
            }
        }

        if (captureRight) {
            const targetPiece = board.getPieceAt(captureRight);
            if (targetPiece && targetPiece.color !== this.color) {
                moves.push(captureRight);
            }
            // En passant
            if (board.enPassantTarget === captureRight) {
                moves.push(captureRight);
            }
        }

        return moves;
    }

    getRookMoves(board) {
        return this.getLinearMoves(board, [
            [0, 1], [0, -1], [1, 0], [-1, 0]
        ]);
    }

    getBishopMoves(board) {
        return this.getLinearMoves(board, [
            [1, 1], [1, -1], [-1, 1], [-1, -1]
        ]);
    }

    getQueenMoves(board) {
        return this.getLinearMoves(board, [
            [0, 1], [0, -1], [1, 0], [-1, 0],
            [1, 1], [1, -1], [-1, 1], [-1, -1]
        ]);
    }

    getKnightMoves(board) {
        const moves = [];
        const [file, rank] = this.positionToCoords(this.position);
        const knightOffsets = [
            [2, 1], [2, -1], [-2, 1], [-2, -1],
            [1, 2], [1, -2], [-1, 2], [-1, -2]
        ];

        for (const [df, dr] of knightOffsets) {
            const newPos = this.coordsToPosition(file + df, rank + dr);
            if (newPos) {
                const targetPiece = board.getPieceAt(newPos);
                if (!targetPiece || targetPiece.color !== this.color) {
                    moves.push(newPos);
                }
            }
        }

        return moves;
    }

    getKingMoves(board, skipSpecialMoves = false) {
        const moves = [];
        const [file, rank] = this.positionToCoords(this.position);
        const kingOffsets = [
            [0, 1], [0, -1], [1, 0], [-1, 0],
            [1, 1], [1, -1], [-1, 1], [-1, -1]
        ];

        for (const [df, dr] of kingOffsets) {
            const newPos = this.coordsToPosition(file + df, rank + dr);
            if (newPos) {
                const targetPiece = board.getPieceAt(newPos);
                if (!targetPiece || targetPiece.color !== this.color) {
                    moves.push(newPos);
                }
            }
        }

        // Castling (skip when checking for attacks to prevent infinite recursion)
        if (!skipSpecialMoves && !this.hasMoved && !board.isSquareUnderAttack(this.position, this.color)) {
            // Kingside castling
            const kingsideRook = board.getPieceAt(this.color === 'white' ? 'h1' : 'h8');
            if (kingsideRook && !kingsideRook.hasMoved) {
                const f = this.coordsToPosition(file + 1, rank);
                const g = this.coordsToPosition(file + 2, rank);
                if (!board.getPieceAt(f) && !board.getPieceAt(g) &&
                    !board.isSquareUnderAttack(f, this.color) &&
                    !board.isSquareUnderAttack(g, this.color)) {
                    moves.push(g);
                }
            }

            // Queenside castling
            const queensideRook = board.getPieceAt(this.color === 'white' ? 'a1' : 'a8');
            if (queensideRook && !queensideRook.hasMoved) {
                const d = this.coordsToPosition(file - 1, rank);
                const c = this.coordsToPosition(file - 2, rank);
                const b = this.coordsToPosition(file - 3, rank);
                if (!board.getPieceAt(d) && !board.getPieceAt(c) && !board.getPieceAt(b) &&
                    !board.isSquareUnderAttack(d, this.color) &&
                    !board.isSquareUnderAttack(c, this.color)) {
                    moves.push(c);
                }
            }
        }

        return moves;
    }

    getLinearMoves(board, directions) {
        const moves = [];
        const [file, rank] = this.positionToCoords(this.position);

        for (const [df, dr] of directions) {
            let newFile = file + df;
            let newRank = rank + dr;

            while (true) {
                const newPos = this.coordsToPosition(newFile, newRank);
                if (!newPos) break;

                const targetPiece = board.getPieceAt(newPos);
                if (targetPiece) {
                    if (targetPiece.color !== this.color) {
                        moves.push(newPos);
                    }
                    break;
                }

                moves.push(newPos);
                newFile += df;
                newRank += dr;
            }
        }

        return moves;
    }

    positionToCoords(position) {
        if (!position || position.length !== 2) return null;
        const file = position.charCodeAt(0) - 97; // 'a' = 0, 'b' = 1, etc.
        const rank = parseInt(position[1]) - 1; // '1' = 0, '2' = 1, etc.
        return [file, rank];
    }

    coordsToPosition(file, rank) {
        if (file < 0 || file > 7 || rank < 0 || rank > 7) return null;
        return String.fromCharCode(97 + file) + (rank + 1);
    }
}

module.exports = Piece;

