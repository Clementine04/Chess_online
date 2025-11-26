class EloCalculator {
    constructor(kFactor = 32) {
        this.kFactor = kFactor; // K-factor determines rating volatility
    }

    // Calculate expected score
    calculateExpectedScore(ratingA, ratingB) {
        return 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400));
    }

    // Calculate new ratings after a game
    calculateNewRatings(winnerRating, loserRating, isDraw = false) {
        const expectedScoreWinner = this.calculateExpectedScore(winnerRating, loserRating);
        const expectedScoreLoser = this.calculateExpectedScore(loserRating, winnerRating);

        let actualScoreWinner, actualScoreLoser;

        if (isDraw) {
            actualScoreWinner = 0.5;
            actualScoreLoser = 0.5;
        } else {
            actualScoreWinner = 1;
            actualScoreLoser = 0;
        }

        const winnerChange = Math.round(this.kFactor * (actualScoreWinner - expectedScoreWinner));
        const loserChange = Math.round(this.kFactor * (actualScoreLoser - expectedScoreLoser));

        return {
            winnerChange,
            loserChange,
            newWinnerRating: winnerRating + winnerChange,
            newLoserRating: loserRating + loserChange
        };
    }

    // Get rating changes for both players
    getRatingChanges(player1Rating, player2Rating, result) {
        // result: 'player1' | 'player2' | 'draw'
        
        if (result === 'draw') {
            const changes = this.calculateNewRatings(player1Rating, player2Rating, true);
            return {
                player1Change: changes.winnerChange,
                player2Change: changes.loserChange
            };
        }

        if (result === 'player1') {
            const changes = this.calculateNewRatings(player1Rating, player2Rating, false);
            return {
                player1Change: changes.winnerChange,
                player2Change: changes.loserChange
            };
        }

        if (result === 'player2') {
            const changes = this.calculateNewRatings(player2Rating, player1Rating, false);
            return {
                player1Change: changes.loserChange,
                player2Change: changes.winnerChange
            };
        }

        return { player1Change: 0, player2Change: 0 };
    }
}

module.exports = EloCalculator;

