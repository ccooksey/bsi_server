const express = require('express');
const axios = require('axios');

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
function authenticate(req, res, next) {

  const authorization = req?.headers?.authorization;
  if (authorization == null) {
    console.log("Authenticate.js: authorization header missing");
    return res.status(401).json({ authorizationError: 'noToken' });
  }
  const token = authorization.substring(authorization.indexOf(" ") + 1);

  const ou_oauth2 = `${process.env.OU_OAUTH2_SERVER_URL}:${process.env.OU_OAUTH2_SERVER_PORT}`;

  axios.post(`${ou_oauth2}/auth/token/introspect`, {
    'client_id': 'bsi',
    'grant_type': 'password',
    'token': token,
    'client_secret': `${process.env.BSI_SERVER_OU_OAUTH2_SERVER_SHARED_SECRET}`,
  })
  .then((ores) => {
    req.username = ores?.data?.response?.username;
    next();
  })
  .catch((err) => {
    // This is reached with 401 error if token is not valid
    console.log("Authenticate.js: failure ", err);
    return res.status(401).json({ authorizationError: 'unauthorized' })
  });
}

// A slightly different approach to authorization. Used by custom authorization
// tokens received over the websocket.
function authenticateWS(authorizationToken, cb) {

  const token = authorizationToken.substring(authorizationToken.indexOf(" ") + 1);
  const ou_oauth2 = `${process.env.OU_OAUTH2_SERVER_URL}:${process.env.OU_OAUTH2_SERVER_PORT}`;
  axios.post(`${ou_oauth2}/auth/token/introspect`, {
      'client_id': 'bsi',
      'grant_type': 'password',
      'token': token,
      'client_secret': `${process.env.BSI_SERVER_OU_OAUTH2_SERVER_SHARED_SECRET}`,
  })
  .then((ores) => {
      const username = ores?.data?.response?.username;
      cb(true, username);
  })
  .catch((err) => {
      cb(false);
  });
}

module.exports = {
  authenticate,
  authenticateWS
};

