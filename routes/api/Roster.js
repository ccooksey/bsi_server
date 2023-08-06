const express = require('express');
const { broadcastMessage, typesDef } = require('../../WebSocketServer.js');
const Roster = require('../../models/Roster');

var mutex = require('./Mutex');

const router = express.Router();

// @route GET /api/roster
// @description Get all BSI players
// @access Public
router.get('/', (req, res) => {
  Roster.find({visible: true})
  .then(roster => res.json(roster))
  .catch(err => res.status(404).json({ rosterDatabaseError: 'noRoster' }));
})

// @route POST /api/roster
// @description Add a username to the roster
// @access Public
// Username comes from oauth server via authenticate middleware
router.post('/', (req, res) => {
  // This is a test and set operation and must be synchronised so that
  // the findOne() and create() which are independently queued operations
  // are not intermingled with a second call to this function (which
  // absolutely _can_ happen).
  mutex.runExclusive(async () => {
    try {
      const fres = await Roster.findOne({username: req.username})
      if (fres == null) {
        const cres = await Roster.create({username: req.username});
        console.log('Roster.js:post: User "' + req.username + '" added to database');
        res.status(200).json({msg: 'User added to database'})
      } else {
        // Not a bad request!
        // res.status(400).json({error: 'User already in database'})
        res.status(200).json({msg: 'User already in database'})
      }
    } catch (err) {
      console.log('Roster.js:post: Unable to add user', err);
      res.status(400).json({error: 'Unable to add user'})
    }
  })
})

// @route DELETE /api/roster
// @description Delete user
// @access Public
// Username comes from oauth server via authenticate middleware
router.delete('/', (req, res) => {
  console.log('Roster.js:delete: called' + req.username);
  Othello.findByIdAndRemove(req.username)
    .then(othelloGame => res.json({ msg: 'User deleted successfully'}))
    .catch(err => res.status(404).json({error: 'No such user'}));
  res.status(200).json({msg: 'User ' + req.username + ' deleted from roster'})
});

// @route POST /api/roster/presence
// @description Change user presence -notify other players
// @access Public
// Username comes from oauth server via authenticate middleware
router.post('/presence', (req, res) => {

  // Ping all players, via the websocket, that a user's online status has changed (including oneself!)
  broadcastMessage({
    type: req.body.presence ? typesDef.PLAYER_ONLINE : typesDef.PLAYER_OFFLINE,
    player: req.username
  });

  res.status(200).json({msg: 'Presence for ' + req.username + 'posted to websocket'})
})

module.exports = router;

