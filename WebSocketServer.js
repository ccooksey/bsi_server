const { WebSocket, WebSocketServer } = require('ws');
const uuid = require('uuid');
const { authenticateWS } = require('./Authenticate');

const typesDef = {
    AUTHORIZATION: 'authorization',
    GAME_UPDATE: 'gameUpdated'
}

const clients = {};
let interval;

function startWebSocketServer(htmlServer) {

    wsServer = new WebSocketServer({server: htmlServer});

    wsServer.on('connection', (wsClient, req) => {

        const userId = uuid.v4();
        clients[userId] = wsClient;
    
        console.log(`Received a new connection. ${userId}`);
        console.log('There are currently ' + Object.keys(clients).length + ' active connections.');

        // Is this a problem? The only way this could be reliable is if
        // the ping function does not exceute at any point in time between
        // the socket creation and this statment.
        wsClient.isAlive = true;

        // A valid token has not been seen yet. All traffic other than
        // inbound authorization tokens will be discarded.
        wsClient.authorized = false;

        // Kick pinging off if this is the first websocket connection
        if (Object.keys(clients).length === 1) {
            startPinging();
        }

        wsClient.on('pong', heartbeat);

        wsClient.on('error', console.error);
    
        wsClient.on('message', (message) => handleMessage(wsClient, message, userId));

        wsClient.on('close', () => handleDisconnect(userId));

    });
}

function handleMessage(ws, messageJSON, userId) {

    console.log(`${userId} received message. ${messageJSON}`);

    // e.g.
    // const messageJSON = {
    //     'type': 'authorization',
    //     'token': 'Bearer tokenString'
    // };

    const messageObject = JSON.parse(messageJSON);

    // Handle authorization token. No other messages will be allowed
    // in or out on the socket unless the token is validated.
    // Note that this is asynchronous, we don't need to wait around
    // for the oauth server. We will just disallow all traffic until
    // an inbound token is authorized. We also snag the username so
    // that we know who the websocket client belongs to.
    console.log('Authenticate.js:handleMessage');
    if (messageObject.type === typesDef.AUTHORIZATION) {
        console.log('Authenticate.js:handleMessage:AUTHORIZATION');
        authenticateWS(messageObject.token, (valid, username) => {
            console.log('Authenticate.js:handleMessage:AUTHORIZATION:valid = ' + valid);
            ws.authorized = valid;
            ws.username = username;
            replyObject = {
                type: typesDef.AUTHORIZATION,
                authorized: valid
            };
            console.log('Authenticate.js:handleMessage: sending: ' + JSON.stringify(replyObject));
            sendMessage(ws, replyObject);
        });
    }

    // If the client has not presented a valid token, ignore every other message
    // type until they do.
    if (!ws.authorized) {
        return;
    }
}

function handleDisconnect(userId) {
    console.log(`${userId} disconnected.`);
    delete clients[userId]; // This is fetching the ws value associated with the userId key
    const json = {'a': 'b'};
    broadcastMessage(json);
    // Stop pinging if there are no more websocket connections
    if (Object.keys(clients).length === 0) {
        stopPinging();
    }
}

function heartbeat() {
    this.isAlive = true;
}

function startPinging() {
    interval = setInterval(function ping () {
        wsServer.clients.forEach((ws) => {
            if (ws.isAlive === true) {
                ws.isAlive = false;
                ws.ping();
            } else {
                ws.terminate();
            }
        });
    }, 10000);
}

function stopPinging() {
    clearInterval(interval);
}

// Send a message to a client by websocket
function sendMessage(ws, messageObject) {
    console.log('sendMessage: ws = ' + ws);
    console.log('sendMessage: ws.readyState = ' + ws.readyState);
    console.log('sendMessage: WebSocket.OPEN = ' + WebSocket.OPEN);
    const messageJSON = JSON.stringify(messageObject);
    if(ws.readyState === WebSocket.OPEN) {
        console.log('sendMessage: Sending a message to the client: ' + messageJSON);
        ws.send(messageJSON);
    }
}

// Send a message to a client by username. This is needed by the Othello route handler
// to tell a user that their opponent has moved.
function sendMessageToUser(username, messageObject) {
    console.log('WebSocketServer: sendMessageToUser: searching for user: ' + username);
    const messageJSON = JSON.stringify(messageObject);
    for (let userId in clients) {
        let ws = clients[userId];
        console.log('WebSocketServer: sendMessageToUser: this webSocketClient belongs to: ' + ws.username);
        if (ws.readyState === WebSocket.OPEN &&
            ws.username === username) {
            console.log('sendMessageToUser: Sending a message: ' + messageJSON + ' to user: ' + username);
            ws.send(messageJSON);
            return;
        }
    };
}

// Send the same message to all clients
function broadcastMessage(messageObject) {
    const messageJSON = JSON.stringify(messageObject);
    for(let userId in clients) {
        let ws = clients[userId];
        if(ws.readyState === WebSocket.OPEN) {
            ws.send(messageJSON);
        }
    };
}

module.exports = {
    typesDef,
    startWebSocketServer,
    sendMessageToUser
};
