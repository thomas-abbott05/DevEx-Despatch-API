const { MongoClient, ServerApiVersion } = require('mongodb');
const dns = require('dns');
dns.setServers(['8.8.8.8', '8.8.4.4']); // MongoDB SRV record lookup can fail on some DNS servers. Force Google DNS.
const env = require('dotenv').config();
console.log('Environment variables loaded from .env file:', env?.parsed ? Object.keys(env.parsed) : 'No .env file found or it is empty');
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
let indexesInitialised = false;

async function initialiseIndexes() {
  if (!db || indexesInitialised) {
    return;
  }

  const usersCollection = db.collection('users');
  await usersCollection.createIndex({ email: 1 }, { unique: true });

  const userOrdersCollection = db.collection('user-orders');
  await userOrdersCollection.createIndex({ userId: 1, updatedAt: -1 });
  await userOrdersCollection.createIndex({ userId: 1, displayId: 1 });

  const userDespatchCollection = db.collection('user-despatch-advice');
  await userDespatchCollection.createIndex({ userId: 1, updatedAt: -1 });
  await userDespatchCollection.createIndex({ userId: 1, orderUuid: 1 });
  await userDespatchCollection.createIndex({ userId: 1, displayId: 1 });

  const userInvoiceCollection = db.collection('user-invoices');
  await userInvoiceCollection.createIndex({ userId: 1, updatedAt: -1 });
  await userInvoiceCollection.createIndex({ userId: 1, despatchUuid: 1 });
  await userInvoiceCollection.createIndex({ userId: 1, displayId: 1 });
  await userInvoiceCollection.createIndex({ userId: 1, status: 1, updatedAt: -1 });

  indexesInitialised = true;
}

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
    await initialiseIndexes();
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