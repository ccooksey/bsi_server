//-----------------------------------------------------------------------------
// Copyright 2023 Chris Cooksey
//-----------------------------------------------------------------------------

var Mutex = require('async-mutex').Mutex;

const mutex = new Mutex();

module.exports = mutex;