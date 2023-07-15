const express = require('express');
const axios = require('axios');
const mongoose = require('mongoose');
const Othello = require('../../models/Othello');

const router = express.Router();

// jwt signing. Will want eventually:
//      // On client:
//      jwt.sign({
//        person: 'some unique identifier'
//      }, 'secret', { expiresIn: '1y' })
//
//      // Here:
//      const { username } = await jwt.verify(token, SECRET)
// or   const decodedJWT = await jwt.verify(token, SECRET)
//      const username = decodedJWT.username

// Middleware to authenticate the client token in the Authorization header.
// We are checking in with the oauth server every time which has the advantage
// that revocations have immediate effect. It is in theory costly to do so,
// however in our context there is virtually no cost so we will keep doing it.
router.use(async (req, res) => {

  console.log("headers = ", JSON.stringify(req.headers));
  const authorization = req.headers.authorization;
  console.log("authorization = ", authorization);
  if (authorization == null) {
    console.log("Bailing");
    return res.status(401).json({ othelloDatabaseError: 'noToken' });
  }

  const ou_oauth2 = `${process.env.OU_OAUTH2_SERVER_URL}:${process.env.OU_OAUTH2_SERVER_PORT}`;

  const token = authorization.substring(authorization.indexOf(" ") + 1);
  console.log("Authorization middleware: token = " + token);

  axios.post(`${ou_oauth2}/auth/token/introspect`, {
    'client_id': 'bsi',
    'grant_type': 'password',
    'token': token,
    'client_secret': `${process.env.BSI_SERVER_OU_OAUTH2_SERVER_SHARED_SECRET}`,
  })
  .then((res) => {
    console.log("Authorization middleware: success", res.data);
    req.username = res.data.response.username;
    return req.next();
  })
  .catch((err) => {
    // This is reached with 401 error if token is not valid
    console.log("Authorization middleware: failed", err);
    res.status(401).json({ othelloDatabaseError: 'unauthorized' })
  });
})

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
  console.log("/:id Header Authorization = " + req.header('Authorization'));
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
        res.status(500).json({ othelloDatabaseError: 'gameServerError' });
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
    .catch(err => res.status(400).json({ error: 'Unable to add Othello game' }));
});

// @route DELETE /api/games/othello/:id
// @description Delete book by id
// @access Public
router.delete('/:id', (req, res) => {
  Othello.findByIdAndRemove(req.params.id, req.body)
    .then(othelloGame => res.json({ mgs: 'Othello game deleted successfully' }))
    .catch(err => res.status(404).json({ error: 'No such Othello game' }));
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

    // Note that username was recovered / validated using the authorization server
    // via the authorization token. We must not rely on an unauthenticated value
    // provided by the client
    const usercolor = game?.players[0] === username ? game?.colors[0] : game?.colors[1];
    const oppocolor = game?.players[0] === username ? game?.colors[1] : game?.colors[0];

    console.log("Processing move y: " + y + " x: " + x + " = " + game.gameState[y][x] + " made by user " + username);

    if (username !== game.next) {
      reject(new Error('othelloNotYourTurn'));
    }
  
    if (game.gameState[y][x] !== 'E') {
      reject(new Error('othelloCellNotEmpty'));
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
            console.log("This cell contains a " + oppocolor + " -now looking for " + usercolor + " somewhere beyond that." );
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
                foundUsercolor = game.gameState[sy][sx] === usercolor;
                if (foundUsercolor) {
                  validMove = true;
                  console.log("Setting clicked cell y: " + y + " x: " + x + " to " + usercolor);
                  game.gameState[y][x] = usercolor;
                  // We found our color, flip all tokens in between
                  foundUsercolor = false;
                  let sy = y;
                  let sx = x;
                  while (!foundUsercolor) {
                    sy = sy + i;
                    sx = sx + j;
                    foundUsercolor = game.gameState[sy][sx] === usercolor;
                    if (!foundUsercolor) {
                      console.log("Setting intermediate cell y: " + sy + " x: " + sx + " to " + usercolor);
                      game.gameState[sy][sx] = usercolor;
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
      reject(new Error('othelloOpponentCellNotAdjacent'));
    }

    if (!validMove) {
      reject(new Error('othelloTerminatingCellNotPresent'));
    }

// Hack for testing. Switching sides
const temp = game.colors[0];
game.colors[0] = game.colors[1];
game.colors[1] = temp;

  console.log("Othello.js: applyMove: Move accepted.");
  resolve(game);
  });

  return promise;
}



module.exports = router;
