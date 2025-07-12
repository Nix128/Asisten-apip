const { MongoClient } = require('mongodb');

const uri = process.env.DATABASE_URL;
if (!uri) {
  throw new Error('DATABASE_URL environment variable is not set.');
}

const client = new MongoClient(uri);
let db;

async function connectToDatabase() {
  if (db) {
    return db;
  }
  try {
    await client.connect();
    console.log('Connected to MongoDB Atlas');
    db = client.db('apip_assistant_db'); // You can name your database here
    return db;
  } catch (error) {
    console.error('Failed to connect to MongoDB', error);
    throw error;
  }
}

module.exports = { connectToDatabase };
