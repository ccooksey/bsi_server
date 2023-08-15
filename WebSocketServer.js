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
    
        console.log(`WebSocketServer.js:startWebSocketServer.js:Received a new connection. ${userId}`);
        console.log('WebSocketServer.js:startWebSocketServer.js:There are currently ' + Object.keys(clients).length + ' active connections.');

        // Is this a problem? The only way this could be reliable is if
        // the ping function does not exceute at any point in time between
        // the socket creation and this statment.
        wsClient.isAlive = true;

        // A valid token has not been seen yet. All traffic other than
        // inbound authorization tokens will be discarded.
        wsClient.authorized = false;

        // We'll keep a record of all opponents to whom we sent GAME_ACTIVE
        // messages so that they can be replayed to the opponent if they
        // come online later. This is a compromise to maintaining user state
        // somewhere separately.
        wsClient.active = new Map();

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
        console.log('WebSocketServer.js:handleMessage:AUTHORIZATION authorizing');
        authenticateWS(messageObject.token, (valid, username) => {
            console.log('WebSocketServer.js:handleMessage:AUTHORIZATION authorized = ' + valid);
            ws.authorized = valid;
            ws.username = username;
            replyObject = {
                type: wsMsgTypes.AUTHORIZATION,
                authorized: valid
            };
            console.log('WebSocketServer.js:handleMessage: sending: ' + JSON.stringify(replyObject));
            sendMessage(ws, replyObject);

            if (valid) {
                replayState(username);
            }
        });
    }

    // If the client has not presented a valid token, ignore every other message
    // type until they do.
    if (!ws.authorized) {
        return;
    }
}

// A user is going offline. We can't rely on the user's socket still being connected,
// but this is more about letting all the other clients know what happened. Note that
// we will go ahead and clean out the active map, but that needs improvement: it's ok
// to clean it out when the user signs out, but we should wait a couple minutes if we
// see any other kind of disconnection just in case the user is experiencing a
// temporary glitch in connectivity.
function handleDisconnect(ws, userId) {

    console.log(`WebSocketServer.js:handleDisconnect: ${ws.username}. Attempting to disconnect.`);

    //  Update active games -let each opponent know that this user will no longer
    // have any mutual games loaded.
    ws.active.forEach((id, username) => {
        console.log('WebSocketServer.js:handleDisconnect: Sending GAME_INACTIVE to ' + username);
        sendMessageToUser(username, ws.username, {
            type: wsMsgTypes.GAME_INACTIVE,
            player: ws.username,
            id: id
        });
    });

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

// Send a message to a specific user.
function sendMessageToUser(userTo, userFrom, messageObject) {

    const messageJSON = JSON.stringify(messageObject);
    for (let userId in clients) {
        let ws = clients[userId];
        if (ws.readyState === WebSocket.OPEN &&
            ws.username === userTo) {
            console.log('WebSocketServer.js:sendMessageToUser:' +
                ' to: ' + userTo +
                ' from: ' + userFrom +
                ' message: ' + messageJSON);
             ws.send(messageJSON);
        }
    };

    //  This is ugly. We are deep inspecting the message and noting to whom GAME_ACTIVE
    // events were sent. Each client socket maintains a list of every game active message
    // that was sent to another player. This will allow us to replay them to that player if
    // they come online later.
    if (messageObject.type === wsMsgTypes.GAME_ACTIVE ||
        messageObject.type === wsMsgTypes.GAME_INACTIVE) {
        // Find the websocket for the client that sent the message.
        let wsFrom;
        for (let userId in clients) {
            let ws = clients[userId];
            if (ws.username === userFrom) {
                wsFrom = ws;
            }
        }
        if (wsFrom != null) {
            if (messageObject.type === wsMsgTypes.GAME_ACTIVE) {
                console.log('WebSocketServer.js:sendMessageToUser: adding / updating ' +
                    userTo + ' in websocket active map for ' + userFrom);
                wsFrom.active.set(userTo, messageObject.id);
            } else if (messageObject.type === wsMsgTypes.GAME_INACTIVE) {
                console.log('WebSocketServer.js:sendMessageToUser: deleting ' +
                    userTo + ' from websocket active map for ' + userFrom);
                wsFrom.active.delete(userTo);
            }
        }
     }

}

// Send the same message to all clients
function broadcastMessage(messageObject) {
    const messageJSON = JSON.stringify(messageObject);
    console.log('WebSocketServer.js:broadcastMessage: Sending a message to everyone: ' + messageJSON);
    for(let userId in clients) {
        let ws = clients[userId];
        if(ws.readyState === WebSocket.OPEN) {
            console.log('WebSocketServer.js:broadcastMessage:' +
                ' to: ' + ws.username +
                ' message: ' + messageJSON);
            ws.send(messageJSON);
        }
    };
}

// A user has come online. Send the presence events to the other online players.
function updatePresenceForUser(username) {

    console.log('WebSocketServer.js:updatePresenceForUser: ' +
        username + ' is coming online');

    const messageObject = {
        type: wsMsgTypes.PLAYER_ONLINE,
        player: username
    };

    broadcastMessage(messageObject);
}

// 'username' is either loading or unloading a game. Send the right game
// activity event to the opponent.
function updateGameActivity(username, opponent, active, id) {

    console.log('WebSocketServer.js:updateGameActivity: ' +
        username + ' is ' + (active ? 'loading game ' : 'unloading game ') + id);

    const messageObject = {
        type: active ? wsMsgTypes.GAME_ACTIVE : wsMsgTypes.GAME_INACTIVE,
        player: username,
        id: id
    };

    sendMessageToUser(opponent, username, messageObject);
}

// A user has come online. Play the current presence and active game events from all
// other online users to them.
function replayState(username) {

    console.log('WebSocketServer.js:replayState: ' +
        username + ' has come online. Sending state');

    // Presence is easy -any client with a websocket is present. Walk through
    // the list and fabricate a presence event.
    for(let userId in clients) {
        let ws = clients[userId];
        console.log('WebSocketServer.js:replayState: sending player present message for ' +
            ws.username + ' to ' + username);
        const messageObject = {
            type: wsMsgTypes.PLAYER_ONLINE,
            player: ws.username
        };
        sendMessageToUser(username, ws.username, messageObject);
    }

    // Game activity is less easy -we cached all game activity
    // messages sent by a client in their socket state by using deep
    // inspection in sendMessageToUser(). For each client still online,
    // examine the caches and fabricate game activity messages that
    // were sent to this particluar user.
    for(let userId in clients) {
        let ws = clients[userId];
        const id = ws.active.get(username);
        if (id != null) {
            console.log('WebSocketServer.js:replayState: sending game active message for ' +
                ws.username + ' to ' + username + ' id: ' + id);
            const messageObject = {
                type: wsMsgTypes.GAME_ACTIVE,
                player: ws.username,
                id: id
            };
            sendMessageToUser(username, ws.username, messageObject);
        }
    }
}

// A user signed out in an orderly fashion via the presence API in Roster.js.
// All we need to do is find the client websocket and call the private function
// handleDisconnect() used for disorderly disconnections. Note that this could
// end badly if the user is signed in twice. It might be easier just to
// disallow that in a future revision.
function handleDisconnectUser(username) {

    console.log('WebSocketServer.js:handleDisconnectUser: ' +
        username + ' is going offline. Attempting to disconnect.');

    for(let userId in clients) {
        let ws = clients[userId];
        if (ws.username == username) {
            handleDisconnect(ws, userId);
            return;
        }
    }
}

module.exports = {
    startWebSocketServer,
    sendMessageToUser,
    broadcastMessage,
    updatePresenceForUser,
    updateGameActivity,
    handleDisconnectUser
};
