const { MongoClient, ServerApiVersion } = require('mongodb');
const dns = require('dns');
dns.setServers(['8.8.8.8', '8.8.4.4']); // MongoDB SRV record lookup can fail on some DNS servers. Force Google DNS.
const env = require('dotenv').config()
const uri = process.env.MONGODB_URI;

if (!uri) {
  console.error("[ERROR] MONGODB_URI environment variable is not set - can't connect to database! A valid .env file with MONGODB_URI in the working directory is required.");
  process.exit(1);
}

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

let db = null;

function getDbClient() {
  return client;
}

function getDb() {
  if (!db) {
    throw new Error('Database not connected. Call connectToDatabase() first.');
  }
  return db;
}

async function connectToDatabase() {
  try {
    // Connect the client to the server (optional starting in v4.7)
    await client.connect();
    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    db = client.db("devex");
    console.log("Successfully connected to MongoDB!");
    return db;
  } catch (error) {
    console.error("Error connecting to MongoDB:", error);
    throw error;
  }
}

module.exports = {
  getDbClient,
  getDb,
  connectToDatabase
};