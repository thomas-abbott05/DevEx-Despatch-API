const express = require('express');
const { getServerConstants } = require('./config/server-config');
const { getDb } = require('./database');

const router = express.Router();

// Health check endpoint
router.get('/health', (req, res) => {
  const { API_VERSION, STARTED_AT, HEALTHY } = getServerConstants();
  res.send({
    status: (HEALTHY ? 'healthy' : 'error'),
    uptime: Math.floor((Date.now() - STARTED_AT.getTime()) / 1000),
    version: API_VERSION,
    "executed-at": Math.floor(Date.now() / 1000)
  });
});

// Database test endpoint
router.get('/dbtest', async (req, res) => {
  try {
    const db = getDb();
    const collection = db.collection('test-collection');
    const result = await collection.insertOne({ 
      test: 'This is a test document', 
      timestamp: new Date() 
    });
    
    res.send({ 
      success: true, 
      insertedId: result.insertedId 
    });
  } catch (error) {
    console.error('Error inserting document:', error);
    res.status(500).send({ 
      success: false, 
      error: 'Database error' 
    });
  }
});

module.exports = router;