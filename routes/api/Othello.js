const express = require('express');
const mongoose = require('mongoose');
const { sendMessageToUser, typesDef } = require('../../WebSocketServer.js');
const Othello = require('../../models/Othello');

const router = express.Router();

// @route GET /api/games/othello/test
// @description tests Othello route
// @access Public
router.get('/test', (req, res) => res.send('Othello route testing!'));

// @route GET /api/games/othello
// @description Get all Othello games
// @access Public
router.get('/', (req, res) => {
  Othello.find(req.query)
    .then(othelloGames => res.json(othelloGames))
    .catch(err => res.status(404).json({ othelloDatabaseError: 'noGames' }));   
});

// @route GET /api/games/othello/:id
// @description Get single Othello game by id
// @access Public
router.get('/:id', (req, res) => {
  Othello.findById(new mongoose.Types.ObjectId(req.params.id))
    .then(othelloGame => res.json(othelloGame))
    .catch(err => res.status(404).json({ othelloDatabaseError: 'noSuchGame' }));
});

// @route POST /api/games/othello/:id
// @description Apply a single move to an Othello game. This is more complicated than
// just fetching or setting data. We must validate the move, update the database,
// look for a winning game, switch to a new player if needed, and notify the opponent
// that a move has been made. There are lots and lots of ways this
// can fail. We will return 404 for server / database / react problems and 400 for
// invalid moves. In the latter case, the message will be a token indicating what,
// specifically, was invalid about the move.
// @access Public
router.post('/:id/move', (req, res) => {
  id = new mongoose.Types.ObjectId(req.params.id);
  let game;
  Othello.findById(id)
    .then(othelloGameBefore => applyMove(othelloGameBefore, req.username, req.body.bx, req.body.by))
    .then(othelloGameAfter => {
      game = othelloGameAfter;
      return Othello.updateOne({_id: id}, {'$set': othelloGameAfter});
    })
    .then((updateResult) => {
      if (updateResult.modifiedCount === 1) {
        res.status(200).json(game);
      } else {
        res.status(500).json({ othelloDatabaseError: 'gameUpdateError' });
      }
    })
    .catch((err) => {
      console.log("Caught error: " + err);
      if (err.message.startsWith('othello')) {
        res.status(400).json({ othelloMoveError: err.message }); 
      } else {
        res.status(404).json({ othelloDatabaseError: 'noSuchGame' }); 
      }
    })
});

// @route POST /api/games/othello
// @description Create an Othello game
// @access Public
router.post('/', (req, res) => {
  Othello.create(req.body)
    .then(othelloGame => res.json({ msg: 'Othello game added successfully' }))
    .catch(err => res.status(400).json({ othelloDatabaseError: 'unableToCreateGame' }));
});

// @route DELETE /api/games/othello/:id
// @description Delete book by id
// @access Public
router.delete('/:id', (req, res) => {
  Othello.findByIdAndRemove(req.params.id, req.body)
    .then(othelloGame => res.json({ msg: 'Othello game deleted successfully' }))
    .catch(err => res.status(404).json({ othelloDatabaseError: 'noSuchGame' }));
});

// New file? Doesn't implement a route, does not need the db

// x and y are the cell number. We need to examine
// the existing game state and determine if it is a valid move
// This will involve:
// Must be empty
// Must be adjacent to at least one opposite color token. If so
//  For each of 8 directions
//  if adjacent to opposite color token and there is a
//  token of our color beyond that token in that direction then
//  change each token up to the first of our tokens into our token.
//  record the move in the history

// After changing tokens:
// If next player can move,
//  change next in game state
//  send notice to opponent (will need to research -but it can be done).
// Else if current player can move, continue
// Else game is finished.
//   Record the winner and allow the React component to celebrate them

// Update the current score. We might want a useEffect to recover it
// on load and set some state with the initial values.

function applyMove(game, username, x, y) {

  var promise = new Promise( (resolve, reject) => {

    if (game == null) {
      reject(new Error('databaseError'));
    }

    // Note that username is recovered / validated using the authorization server
    // via the authorization token. We do not rely on an unauthenticated value
    // provided by the client. From username we can derive other values of interest.
    const usercolor = game.players[0] === username ? game.colors[0] : game.colors[1];
    const opponame = game.players[0] === username ? game.players[1] : game.players[0];
    const oppocolor = game.players[0] === username ? game.colors[1] : game.colors[0];

    console.log("Processing move x: " + x + " y: " + y + " = " + game.gameState[y][x] + " made by user " + username);

    const result = legalMove(game, username, usercolor, x, y, true);
    if (result !== '') {
      reject(new Error(result));
    }

    // Let's make history!
    const event = {
      'player': username,
      'color': usercolor,
      'x': x,
      'y': y
    };
    game.history = [...game.history, event];

    // Check if either player has a legal next move
    const usercanmove = legalMoveExists(game, username, usercolor);
    const oppocanmove = legalMoveExists(game, opponame, oppocolor);

    // Switch to the other player if they have a legal move available
    if (oppocanmove) {
      game.next = opponame;
    }

    // If no one has a legal next move, determine the winner
    if (!usercanmove && !oppocanmove) {
      game.winner = getWinner(game);
      game.next = '';
    }

    // Support test playing against oneself. We just swap the
    // token colors (unless the game has already been won, or
    // the opponent can't move).
    if (username === opponame) {
      if (game.next != '' ) {
        if (oppocanmove) {
          const temp = game.colors[1];
          game.colors[1] = game.colors[0];
          game.colors[0] = temp;
        }
      }
    }

    // Lastly -ping the opposing player that a move ha been made
    sendMessageToUser(opponame, {type: typesDef.GAME_UPDATE });

    console.log("Othello.js: applyMove: Move accepted.");
    resolve(game);
  });

  return promise;
}

function getWinner(game) {
  let i;
  let j;
  let blackCount = 0;
  let whiteCount = 0;
  for (i = 0; i < 8; i++) {
    for (j = 0; j < 8; j++) {
      if (game.gameState[j][i] == 'B') {
        blackCount++;
      } else if (game.gameState[j][i] == 'W') {
        whiteCount++;
      }
    }
  }
  if (blackCount > whiteCount) {
    return game.colors[0] === 'B' ? game.players[0] : game.players[1];
  }
  if (whiteCount > blackCount) {
    return game.colors[0] === 'W' ? game.players[0] : game.players[1];
  }
  if (blackCount === whiteCount) {
    return 'tie';
  }
  // Can't be reached
  return '';
}

function legalMoveExists(game, user, color) {
  let i;
  let j;
  for (i = 0; i < 8; i++) {
    for (j = 0; j < 8; j++) {
      if (legalMove(game, user, color, i, j, false) == '') {
        return true;
      }
    }
  }
  return false;
}

function legalMove(game, user, color, x, y, apply) {

  const oppocolor = color === 'B' ? 'W' : 'B';

  if (game.gameState[y][x] !== 'E') {
    return 'othelloCellNotEmpty';
  }

  if (apply && user !== game.next) {
    return 'othelloNotYourTurn';
  }

  let validMove = false;
  let oppocolorCount = 0;
  let i;
  let j;
  for (i = -1; i <= 1; i++) {
    console.log("i = " + i);
    let ty = y + i;
    for (j = -1; j <= 1; j++) {
      console.log("j = " + j);
      let tx = x + j;
      if ((j !== 0 || i !== 0) && ty >= 0 && ty <= 7 && tx >= 0 && tx <= 7) {
        console.log("y: " + ty + " x: " + tx + " = " + game.gameState[ty][tx]);
        if (game.gameState[ty][tx] === oppocolor) {
          oppocolorCount++;
          console.log("This cell contains a " + oppocolor + " -now looking for " + color + " somewhere beyond that." );
          // let's see if we can find our color again in this direction.
          // If we do, this move will be accepted and we will do the actual
          // flips while we are here
          let checkNext = true;
          let foundUsercolor = false;
          let sy = y;
          let sx = x;
          while (checkNext && !foundUsercolor) {
            sy = sy + i;
            sx = sx + j;
            if (sy < 0 || sy > 7 || sx < 0 || sx > 7 || game.gameState[sy][sx] === 'E') {
              checkNext = false;
            } else {
              console.log("Next cell y: " + sy + " x: " + sx + " contains a " + game.gameState[sy][sx] );
              foundUsercolor = game.gameState[sy][sx] === color;
              if (foundUsercolor) {
                validMove = true;

                if (apply) {
                  console.log("Setting clicked cell y: " + y + " x: " + x + " to " + color);
                  game.gameState[y][x] = color;
                  // We found our color, flip all tokens in between
                  foundUsercolor = false;
                  let sy = y;
                  let sx = x;
                  while (!foundUsercolor) {
                    sy = sy + i;
                    sx = sx + j;
                    foundUsercolor = game.gameState[sy][sx] === color;
                    if (!foundUsercolor) {
                      console.log("Setting intermediate cell y: " + sy + " x: " + sx + " to " + color);
                      game.gameState[sy][sx] = color;
                    }
                  }
                }

              }
            }
          }
        }
      }
    }
  }

  if (oppocolorCount === 0) {
    return 'othelloOpponentCellNotAdjacent';
  }

  if (!validMove) {
    return 'othelloTerminatingCellNotPresent';
  }

  // Empty string indicates the move was legal (and applied if requested).
  return '';
}


module.exports = router;
