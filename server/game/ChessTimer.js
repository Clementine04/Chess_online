class ChessTimer {
    constructor(timeControl) {
        // Time controls (in milliseconds) - Standard chess.com/FIDE formats
        this.timeControls = {
            bullet: { initial: 1 * 60 * 1000, increment: 0 }, // 1+0 (1 minute, no increment)
            blitz: { initial: 3 * 60 * 1000, increment: 2 * 1000 }, // 3+2 (3 minutes + 2 sec increment)
            rapid: { initial: 10 * 60 * 1000, increment: 0 }, // 10+0 (10 minutes, no increment)
            classical: { initial: 30 * 60 * 1000, increment: 0 } // 30+0 (30 minutes, no increment)
        };

        const control = this.timeControls[timeControl] || this.timeControls.blitz;
        
        this.timers = {
            white: control.initial,
            black: control.initial
        };
        
        this.increment = control.increment;
        this.activeColor = null;
        this.lastUpdateTime = null;
        this.intervalId = null;
        this.gameEnded = false;
    }

    start(color) {
        if (this.gameEnded) return;
        
        this.activeColor = color;
        this.lastUpdateTime = Date.now();
        console.log(`Timer started for ${color}`);
        
        // Start the timer interval
        if (!this.intervalId) {
            this.intervalId = setInterval(() => {
                this.update();
            }, 100); // Update every 100ms
        }
    }

    update() {
        if (!this.activeColor || this.gameEnded) return null;

        const now = Date.now();
        const elapsed = now - this.lastUpdateTime;
        
        this.timers[this.activeColor] = Math.max(0, this.timers[this.activeColor] - elapsed);
        this.lastUpdateTime = now;

        // Check for timeout
        if (this.timers[this.activeColor] <= 0) {
            this.timers[this.activeColor] = 0;
            this.gameEnded = true;
            
            // IMPORTANT: Save the loser BEFORE calling stop() which sets activeColor to null
            const loser = this.activeColor;
            this.stop();
            
            console.log(`Timer expired for ${loser}`);
            return { timeout: true, loser: loser };
        }

        return null;
    }

    switchTurn(fromColor, toColor) {
        if (this.gameEnded) return;

        // Update current player's time
        if (this.activeColor === fromColor) {
            this.update();
        }

        // Add increment to the player who just moved
        if (this.increment > 0 && fromColor) {
            this.timers[fromColor] += this.increment;
        }

        // Switch active color
        this.activeColor = toColor;
        this.lastUpdateTime = Date.now();
        console.log(`Timer switched from ${fromColor} to ${toColor}`);
    }

    stop() {
        this.activeColor = null;
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
    }

    pause() {
        if (this.activeColor) {
            this.update();
            this.activeColor = null;
        }
    }

    resume(color) {
        this.activeColor = color;
        this.lastUpdateTime = Date.now();
    }

    getTimeRemaining() {
        return {
            white: Math.max(0, Math.round(this.timers.white)),
            black: Math.max(0, Math.round(this.timers.black))
        };
    }

    getFormattedTime(color) {
        const ms = this.timers[color];
        const totalSeconds = Math.max(0, Math.floor(ms / 1000));
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        
        return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    }

    toJSON() {
        return {
            white: Math.max(0, Math.round(this.timers.white)),
            black: Math.max(0, Math.round(this.timers.black)),
            activeColor: this.activeColor,
            increment: this.increment
        };
    }
    
    setTime(color, time) {
        this.timers[color] = time;
    }

    reset(timeControl) {
        // Stop any running intervals
        this.stop();
        
        // Reset game ended flag
        this.gameEnded = false;
        
        // Reset timers based on time control
        const control = this.timeControls[timeControl] || this.timeControls.blitz;
        this.timers = {
            white: control.initial,
            black: control.initial
        };
        
        this.increment = control.increment;
        this.activeColor = null;
        this.lastUpdateTime = null;
        
        console.log(`Timer reset for ${timeControl} time control`);
    }
}

module.exports = ChessTimer;

