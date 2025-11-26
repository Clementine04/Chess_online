// Sound Manager for Chess Game
class SoundManager {
    constructor() {
        this.sounds = {
            move: new Audio('sounds/move-self.mp3'),
            capture: new Audio('sounds/capture.mp3'),
            check: new Audio('sounds/move-check.mp3'),
            castle: new Audio('sounds/castle.mp3'),
            promote: new Audio('sounds/promote.mp3')
        };
        
        // Set volume to maximum by default
        Object.values(this.sounds).forEach(sound => {
            sound.volume = 1.0; // 100% volume
        });
        
        this.enabled = true;
    }

    playMove() {
        this.play('move');
    }

    playCapture() {
        this.play('capture');
    }

    playCheck() {
        this.play('check');
    }

    playCastle() {
        this.play('castle');
    }

    playPromote() {
        this.play('promote');
    }

    play(soundName) {
        if (!this.enabled) return;
        
        const sound = this.sounds[soundName];
        if (sound) {
            // Clone and play to allow overlapping sounds
            const soundClone = sound.cloneNode();
            soundClone.volume = sound.volume;
            soundClone.play().catch(err => {
                console.warn('Sound play failed:', err);
            });
        }
    }

    toggle(enabled) {
        this.enabled = enabled;
    }

    setVolume(volume) {
        // volume should be 0.0 to 1.0
        Object.values(this.sounds).forEach(sound => {
            sound.volume = Math.max(0, Math.min(1, volume));
        });
    }
}

// Create global sound manager instance
const soundManager = new SoundManager();

