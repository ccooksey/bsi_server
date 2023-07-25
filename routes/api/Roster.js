const express = require('express');
const Roster = require('../../models/Roster');

var mutex = require('./Mutex');

const router = express.Router();

// @route GET /api/roster
// @description Get all BSI players
// @access Public
router.get('/', (req, res) => {
  console.log('Roster.js:get: called');
  Roster.find({visible: true})
  .then(roster => {
    res.json(roster);
    console.log('Roster.js:get: success');
  })
  .catch(err => {
    console.log('Roster.js:get failure err = noRoster');
    res.status(404).json({ rosterDatabaseError: 'noRoster' }); 
  });
})

// @route POST /api/roster
// @description Add a username to the roster
// @access Public
// Username comes from oauth server via authenticate middleware
router.post('/', (req, res) => {
  // This is a test and set operation and must be
  // synchronised so that the findOne() and create() are
  // queued not intermingled with a second call to this
  // function (which absolutely can happen).
  mutex.runExclusive(async () => {
    try {
      const fres = await Roster.findOne({'username': req.username})
      if (fres == null) {
        const cres = await Roster.create({username: req.username});
        console.log('Roster.js:post: User "' + req.username + '" added to database');
        res.status(200).json({msg: 'User added to database'})
      } else {
        res.status(400).json({error: 'User already in database'})
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
  Othello.findByIdAndRemove(req.params.username)
    .then(othelloGame => res.json({ msg: 'User deleted successfully'}))
    .catch(err => res.status(404).json({error: 'No such user'}));
});

module.exports = router;

// function timeout(ms) {
//   return new Promise(resolve => setTimeout(resolve, ms));
// }
// await timeout(3000);

