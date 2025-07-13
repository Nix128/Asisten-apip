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
    console.log('Successfully connected to MongoDB Atlas');
    db = client.db('apip_assistant_db'); // You can name your database here
    return db;
  } catch (error) {
    console.error('!!! MongoDB Connection Error !!!');
    console.error('Connection String Used:', uri ? 'URI is set' : 'URI is NOT SET');
    console.error('Error Message:', error.message);
    console.error('Full Error Object:', JSON.stringify(error, null, 2));
    throw new Error(`Failed to connect to MongoDB: ${error.message}`);
  }
}

module.exports = { connectToDatabase };
