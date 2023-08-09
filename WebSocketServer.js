//-----------------------------------------------------------------------------
// Copyright 2023 Chris Cooksey
//-----------------------------------------------------------------------------

const { WebSocket, WebSocketServer } = require('ws');
const uuid = require('uuid');
const { authenticateWS } = require('./Authenticate');
const { wsMsgTypes } = require('./bsi_protocol');

const clients = {};
let interval;

function startWebSocketServer(htmlServer) {

    wsServer = new WebSocketServer({server: htmlServer});

    wsServer.on('connection', (wsClient, req) => {

        const userId = uuid.v4();
        clients[userId] = wsClient;
    
        console.log(`WebSocketServer.js:handleDisconnect: Received a new connection. ${userId}`);
        console.log('WebSocketServer.js:handleDisconnect: There are currently ' + Object.keys(clients).length + ' active connections.');

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

        wsClient.on('close', () => handleDisconnect(wsClient, userId));

    });
}

function handleMessage(ws, messageJSON, userId) {

    console.log(`WebSocketServer.js:handleMessage: ${userId} received message. ${messageJSON}`);

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
    if (messageObject.type === wsMsgTypes.AUTHORIZATION) {
        console.log('WebSocketServer.js:handleMessage:AUTHORIZATION');
        authenticateWS(messageObject.token, (valid, username) => {
            console.log('WebSocketServer.js:handleMessage:AUTHORIZATION:valid = ' + valid);
            ws.authorized = valid;
            ws.username = username;
            replyObject = {
                type: wsMsgTypes.AUTHORIZATION,
                authorized: valid
            };
            console.log('WebSocketServer.js:handleMessage: sending: ' + JSON.stringify(replyObject));
            sendMessage(ws, replyObject);
        });
    }

    // If the client has not presented a valid token, ignore every other message
    // type until they do.
    if (!ws.authorized) {
        return;
    }
}

function handleDisconnect(ws, userId) {
    console.log(`WebSocketServer.js:handleDisconnect: ${ws.username} disconnected.`);

    // Update presence -let everyone else know that the user has gone offline
    broadcastMessage({
        type: wsMsgTypes.PLAYER_OFFLINE,
        player: ws.username
      });

    // Delete the ws value associated with the userId key
    delete clients[userId];

    // Stop pinging if there are no more websocket connections
    if (Object.keys(clients).length === 0) {
        console.log('WebSocketServer.js:handleDisconnect: Cancelling heartbeat timer.');
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
    const messageJSON = JSON.stringify(messageObject);
    if(ws.readyState === WebSocket.OPEN) {
        console.log('WebSocketServer.js:sendMessage: Sending a message to the client: ' + messageJSON);
        ws.send(messageJSON);
    }
}

// Send a message to a client by username. This is needed by the Othello route handler
// to tell a user that their opponent has moved.
function sendMessageToUser(username, messageObject) {
    console.log('WebSocketServer:sendMessageToUser: searching for user: ' + username);
    const messageJSON = JSON.stringify(messageObject);
    for (let userId in clients) {
        let ws = clients[userId];
        if (ws.readyState === WebSocket.OPEN &&
            ws.username === username) {
            console.log('WebSocketServer:sendMessageToUser: Sending a message: ' + messageJSON + ' to user: ' + username);
            ws.send(messageJSON);
        }
    };
}

// Send the same message to all clients
function broadcastMessage(messageObject) {
    const messageJSON = JSON.stringify(messageObject);
    console.log('WebSocketServer.js: broadcastMessage: Sending a message to everyone: ' + messageJSON);
    for(let userId in clients) {
        let ws = clients[userId];
        if(ws.readyState === WebSocket.OPEN) {
            ws.send(messageJSON);
        }
    };
}

// Send a list of online clients to the specified user (the user
// has just come online and needs to know who else is present).
function updatePresenceForUser(username) {
    console.log('WebSocketServer.js: sendPresenceToUser: Sending presence updates to ' + username);
    for(let userId in clients) {
        let ws = clients[userId];
        if (ws.readyState === WebSocket.OPEN &&
            ws.username !== username) {
            messageObject = {
                type: wsMsgTypes.PLAYER_ONLINE,
                player: ws.username
            };
            console.log('sendMessageToUser: Sending presence message: ' + JSON.stringify(messageObject) + ' to user: ' + username);
            sendMessageToUser(username, messageObject);
        }
    };

}

module.exports = {
    startWebSocketServer,
    sendMessageToUser,
    broadcastMessage,
    updatePresenceForUser
};
