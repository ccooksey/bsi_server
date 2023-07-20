const mongoose = require('mongoose');
// mongoose.set('debug', true);

// db.roster.insertOne({
//   joindate: new Date(),
//   username: 'dvader',
//   visible: true,
// })

const RosterSchema = new mongoose.Schema({
  joindate: { type: Date, default: Date.now, required: true },
  username: { type: String, required: true },
  visible: { type: Boolean, default: true, required: true },
}, { collection: 'roster' });

module.exports = Roster = mongoose.model('roster', RosterSchema);
