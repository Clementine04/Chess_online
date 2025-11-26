class WebSocketClient {
    constructor() {
        this.ws = null;
        this.connected = false;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.handlers = {}; // Maps event type to array of handlers
    }

    connect() {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}`;

        this.ws = new WebSocket(wsUrl);

        this.ws.onopen = () => {
            console.log('WebSocket connected');
            this.connected = true;
            this.reconnectAttempts = 0;
            this.updateConnectionStatus(true);
            
            // Call all onConnect handlers
            if (this.handlers.onConnect && this.handlers.onConnect.length > 0) {
                this.handlers.onConnect.forEach(handler => handler());
            }
        };

        this.ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                this.handleMessage(data);
            } catch (error) {
                console.error('Error parsing message:', error);
            }
        };

        this.ws.onerror = (error) => {
            console.error('WebSocket error:', error);
        };

        this.ws.onclose = () => {
            console.log('WebSocket disconnected');
            this.connected = false;
            this.updateConnectionStatus(false);

            // Attempt to reconnect
            if (this.reconnectAttempts < this.maxReconnectAttempts) {
                this.reconnectAttempts++;
                setTimeout(() => {
                    console.log(`Reconnecting... Attempt ${this.reconnectAttempts}`);
                    this.connect();
                }, 2000);
            }
        };
    }

    send(data) {
        if (this.ws && this.connected) {
            this.ws.send(JSON.stringify(data));
        } else {
            console.error('WebSocket not connected');
        }
    }

    handleMessage(data) {
        const { type } = data;

        // Call all handlers registered for this event type
        if (this.handlers[type] && this.handlers[type].length > 0) {
            this.handlers[type].forEach(handler => handler(data));
        }
    }

    on(event, handler) {
        // Initialize array for this event type if it doesn't exist
        if (!this.handlers[event]) {
            this.handlers[event] = [];
        }
        // Add handler to the array (allows multiple handlers per event)
        this.handlers[event].push(handler);
    }

    updateConnectionStatus(connected) {
        const statusIndicator = document.getElementById('connectionStatus');
        const statusText = document.getElementById('connectionText');

        if (connected) {
            statusIndicator.classList.add('connected');
            statusText.textContent = 'Connected';
        } else {
            statusIndicator.classList.remove('connected');
            statusText.textContent = 'Disconnected';
        }
    }

    // Authentication Methods
    register(username, password) {
        this.send({
            type: 'register',
            username,
            password
        });
    }

    login(username, password) {
        this.send({
            type: 'login',
            username,
            password
        });
    }

    verifyToken(token) {
        this.send({
            type: 'verify_token',
            token
        });
    }

    // API Methods
    createPrivateGame(timeControl = 'blitz') {
        this.send({
            type: 'create_private_game',
            timeControl
        });
    }

    joinPrivateGame(gameCode) {
        this.send({
            type: 'join_private_game',
            gameCode
        });
    }

    joinGame(timeControl = 'blitz') {
        this.send({
            type: 'join_game',
            timeControl
        });
    }

    makeMove(from, to, promotion = null) {
        this.send({
            type: 'move',
            from,
            to,
            promotion
        });
    }

    getLegalMoves(position) {
        this.send({
            type: 'get_legal_moves',
            position
        });
    }

    requestUndo() {
        this.send({
            type: 'undo_request'
        });
    }

    respondToUndo(accepted) {
        this.send({
            type: 'undo_response',
            accepted
        });
    }

    offerDraw() {
        this.send({
            type: 'draw_offer'
        });
    }

    respondToDraw(accepted) {
        this.send({
            type: 'draw_response',
            accepted
        });
    }

    surrender() {
        this.send({
            type: 'surrender'
        });
    }

    getLeaderboard() {
        this.send({
            type: 'get_leaderboard'
        });
    }

    leaveQueue() {
        this.send({
            type: 'leave_queue'
        });
    }

    leaveGame() {
        this.send({
            type: 'leave_game'
        });
    }

    sendChatMessage(message) {
        this.send({
            type: 'chat_message',
            message
        });
    }

    requestRematch() {
        this.send({
            type: 'rematch_request'
        });
    }

    respondToRematch(accepted) {
        this.send({
            type: 'rematch_response',
            accepted
        });
    }
}

// Create global WebSocket client instance
const wsClient = new WebSocketClient();

