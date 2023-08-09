//-----------------------------------------------------------------------------
// Copyright 2023 Chris Cooksey
//-----------------------------------------------------------------------------

const mongoose = require('mongoose');

// mongoose.set('debug', true);

// const OthelloCellSchema = new mongoose.Schema({
//   cell: { type: String, enum: ['B', 'W', 'E'], default: 'E' }
// });

// const OthelloRowSchema = new mongoose.Schema({
//   row: { type: [OthelloCellSchema], validate: v => Array.isArray(v) && v.length == 8 }
// });

// const OthelloBoardSchema = new mongoose.Schema({
//   board: { type: [OthelloRowSchema], validate: v => Array.isArray(v) && v.length == 8 }
// });

const OthelloEventSchema = new mongoose.Schema({
  date: { type: Date, default: Date.now, required: true },
  player: { type: String, required: true },
  color: {type: String, enum: ['B', 'W'], required: true },
  x: { type: Number, required: true },
  y: { type: Number, required: true },
});

// Note it is *critically* important to define the collection name
// with the schema. If you do not, Mongoose will arbitrarily change
// it to something else.
const OthelloSchema = new mongoose.Schema({

  created: { type: Date, default: Date.now, required: true },
  players: { type: [String],
    validate: v => Array.isArray(v) && v.length == 2 },
  colors: { type: [{ type: String, enum: ['B', 'W']}],
    validate: v => Array.isArray(v) && v.length == 2 },
  gameState: { type: [{ type: [{ type: String, enum: ['B', 'W', 'E'], default: 'E'}],
    validate: v => Array.isArray(v) && v.length == 8}],
    validate: v => Array.isArray(v) && v.length == 8 },
  next: { type: String, default: '', required: true },
  winner: { type: String },
  history: {
    type: [OthelloEventSchema],
  },
}, { collection: 'othello' });

module.exports = Othello = mongoose.model('othello', OthelloSchema);
