const mongoose = require('mongoose');
// mongoose.set('debug', true);

const path = require('node:path');
require('dotenv').config({ path: `./.env.${process.env.NODE_ENV}` });

const connectDB = async () => {
    try {
        const host = process.env.MONGO_DB_HOST;
        const port = process.env.MONGO_DB_PORT;
        const user = process.env.MONGO_DB_USER;
        const password = process.env.MONGO_DB_PASSWORD;
        const database = process.env.MONGO_DB_DATABASE;
        const db = `mongodb://${user}:${password}@${host}:${port}/${database}`;
        mongoose.set('strictQuery', true);
        await mongoose.connect(db, { useNewUrlParser: true, });
        console.log('Using MongoDB');
    } catch (err) {const MongoClient = require('mongodb').MongoClient;
    const Logger = require('mongodb').Logger;
    Logger.setLevel('info');
        console.error(err.message);
        process.exit(1);
    }
};

module.exports = connectDB;
