const fs = require('fs');
const https = require('https');
const dotenv = require('dotenv');
const express = require('express');
const cors = require('cors');
const connectDB = require('./db/db');
const Authenticate = require('./Authenticate');
const Roster = require('./routes/api/Roster');
const Othello = require('./routes/api/Othello');

// Must be run with "npm run start:prod" or "npm run start:dev" for this to work
dotenv.config({ path: `./.env.${process.env.NODE_ENV}` });
console.log(`NODE_ENV = ${process.env.NODE_ENV}`);
console.log(`Server located at ${__dirname}`);

// Express
const app = express();

// Database
connectDB();

// Restrict CORS access
const corsOptions = {
    origin: process.env.BSI_SERVER_ALLOWED_ORIGINS,
    methods: 'POST, GET, DELETE, OPTIONS'
}
app.use(cors(corsOptions));

app.use(express.json({ extended: false }));

app.use(Authenticate);

app.use('/api/roster', Roster);
app.use('/api/games/othello', Othello);

function Development() {
    return (!process.env.NODE_ENV || process.env.NODE_ENV === 'development');
}

// Let's listen!
if (Development()) {
    app.listen(process.env.BSI_SERVER_PORT_HTTP, () => {
        console.log(`HTTP server listening on port ${process.env.BSI_SERVER_PORT_HTTP}`)
    });
} else {
    const options = {
        key: fs.readFileSync(process.env.BSI_SERVER_PRIVATE_KEY_PATH),
        cert: fs.readFileSync(process.env.BSI_SERVER_FULL_CHAIN_PATH)
    }
    https.createServer(options, app).listen(process.env.BSI_SERVER_PORT_HTTP, () => {
        console.log(`HTTPS server listening on port ${process.env.BSI_SERVER_PORT_HTTP}`)
    });
}


// // Cookies -note that the following routes send and receive cookies.
// // We probably won't need any of this.

// // Restrict CORS access as much as desired
// const corsOptions = { 
//     origin: process.env.BSI_SERVER_ALLOWED_ORIGINS,
//     credentials: true, // Allows cookies
//     methods: 'POST, GET, DELETE, OPTIONS' 
// }
// app.use(cors(corsOptions));

// const cookieParser = require('cookie-parser');
// const jwt = require('jsonwebtoken');
// app.use(cookieParser());

// // Client sets the cookie
// app.get('/set/cookie', (req, res) => {

//     console.log("in /set/cookie");
//     const payload = {
//         name: "Test Name",
//         website: "example.com"
//     };
//     const bsiSecret = process.env.BSI_SERVER_SECRET;
//     const token = jwt.sign(payload, bsiSecret);
//     res.cookie("token", token, {
//         httpOnly: true
//     }).send("Cookie shipped")
// })

// // Server returns the cookie
// app.get("/get/cookie", (req, res) => {

//     console.log("in /get/cookie");
//     const token = req.cookies.token;
//     const bsiSecret = process.env.BSI_SERVER_SECRET;
//     const payload = jwt.verify(token, bsiSecret);
//     res.json({token, payload});
// })
