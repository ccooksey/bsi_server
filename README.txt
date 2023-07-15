My second React server!

This is an Othello game server. It stores games in MongoDB, and uses expressjs to fetch
and update them as needed. It requires the ou-oauth2 server running in the same environment.

It has logic for determining if a move is legal and applying that move.

This is not fit for purpose right now. You cannot create a new game, and it cannot determine
if someone has won yet. It also just lets the first player play alternating colors. But it
has promise.

You will need MongoDB running on the same machine. Set the port numbers and
credentials in .env.development or .env.production.

The code can be dragged to a server somewhere and started with either

    npm run start:dev

or

    npm run start:prod

Don't just

    npm start

the server. It will not pick up a config file and will not be able to contact the MongoDB database.

There is a React client "bsi" in my github repo that uses this server to play the actual games (kinda).
The client passes the token it receives from the ou-oauth2 server to the bsi server, and the bsi server
validates the token with the ou-oauth2 server. The bsi server picks up the username from there as well
(it does not trust the client).
