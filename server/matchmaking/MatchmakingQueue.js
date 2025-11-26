class MatchmakingQueue {
    constructor() {
        // Separate queues per time control for better organization
        this.queues = {
            bullet: [],
            blitz: [],
            rapid: [],
            classical: []
        };
    }

    addPlayer(userId, username, eloRating, timeControl = 'blitz') {
        // Check if player already in ANY queue
        for (const control in this.queues) {
            if (this.queues[control].find(p => p.userId === userId)) {
                return { success: false, error: 'Already in queue' };
            }
        }

        // Validate time control
        if (!this.queues[timeControl]) {
            timeControl = 'blitz'; // Default fallback
        }

        this.queues[timeControl].push({
            userId,
            username,
            eloRating,
            timestamp: Date.now(),
            timeControl
        });

        console.log(`Player ${username} added to ${timeControl} queue. Queue size: ${this.queues[timeControl].length}`);
        return { success: true, position: this.queues[timeControl].length };
    }

    removePlayer(userId) {
        for (const control in this.queues) {
            const initialLength = this.queues[control].length;
            this.queues[control] = this.queues[control].filter(p => p.userId !== userId);
            
            if (this.queues[control].length < initialLength) {
                console.log(`Player ${userId} removed from ${control} queue. New queue size: ${this.queues[control].length}`);
            }
        }
    }

    // FIFO matching - match first two players in queue for the same time control
    findMatch(timeControl = 'blitz') {
        const queue = this.queues[timeControl];
        
        if (!queue || queue.length < 2) {
            return null; // Not enough players to match
        }

        // Take the first two players (FIFO)
        const player1 = queue.shift();
        const player2 = queue.shift();
        
        console.log(`Match found! ${player1.username} vs ${player2.username} in ${timeControl}`);
        
        return {
            player1,
            player2,
            timeControl
        };
    }

    // Try to match any available players across all time controls
    findAnyMatch() {
        for (const control in this.queues) {
            const match = this.findMatch(control);
            if (match) {
                return match;
            }
        }
        return null;
    }

    getQueueSize(timeControl = null) {
        if (timeControl && this.queues[timeControl]) {
            return this.queues[timeControl].length;
        }
        // Return total size across all queues
        return Object.values(this.queues).reduce((sum, q) => sum + q.length, 0);
    }

    getQueueSizeByControl() {
        const sizes = {};
        for (const control in this.queues) {
            sizes[control] = this.queues[control].length;
        }
        return sizes;
    }

    isPlayerInQueue(userId) {
        for (const control in this.queues) {
            if (this.queues[control].some(p => p.userId === userId)) {
                return true;
            }
        }
        return false;
    }

    getPlayerQueue(userId) {
        for (const control in this.queues) {
            const player = this.queues[control].find(p => p.userId === userId);
            if (player) {
                return { timeControl: control, position: this.queues[control].indexOf(player) + 1 };
            }
        }
        return null;
    }
}

module.exports = MatchmakingQueue;

