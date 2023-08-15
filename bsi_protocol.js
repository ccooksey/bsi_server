//-----------------------------------------------------------------------------
// Copyright 2023 Chris Cooksey
//-----------------------------------------------------------------------------

const wsMsgTypes = {
    AUTHORIZATION: 'authorization',     // -> {type, token} | <- {type, authorized}
    PLAYER_ONLINE: 'playerOnline',      // {type, player}
    PLAYER_OFFLINE: 'playerOffline',    // {type, player}
    GAME_CREATED: 'gameCreated',        // {type, player}
    GAME_ACTIVE: 'gameActive',          // {type, player, id} NB: player is the one who loaded the game
    GAME_INACTIVE: 'gameInactive',      // {type, player, id} NB: player is the one who unloaded the game
    GAME_UPDATED: 'gameUpdated',        // {type}
};

module.exports = {
    wsMsgTypes
};
