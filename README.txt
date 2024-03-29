A React based Othello game server.

Stores games in MongoDB, and exposes expressjs APIs to fetch and update the games
as needed. It requires the ou-oauth server running in the same environment (although
it could be elsewhere if the appropriate CORS permissions are granted).

It keeps a roster of BSI players (separate from the ou-oauth server). It allows the creation
and playing of games. It validates and applies moves and detects winners and ties. It also keeps
the move history of individual games.

You will need MongoDB running on the same machine. Set the port numbers and
credentials in .env.development or .env.production that you create. Follow the pattern from
the .env file.

The code can be dragged to a server somewhere and started with either

    npm run start:dev

or

    npm run start:prod

Don't just

    npm start

the server. It will not pick up a config file and will not be able to contact the MongoDB database or
the ou_oauth server. Nor will it configure it's own port correctly.

There is a React client "bsi" in my github repo that uses this server to play the actual games.
The client passes the token it receives from the ou-oauth2 server to the bsi server, and the bsi server
validates the token with the ou-oauth2 server. The bsi server picks up the username from there as well
(it does not trust the client).
