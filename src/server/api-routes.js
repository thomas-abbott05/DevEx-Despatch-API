const express = require('express');
const { getServerConstants } = require('./config/server-config');
const { getDb } = require('./database');
const { listDespatchAdvices, createDespatchAdvice } = require('./despatch/despatch-service');
const { DespatchValidationError } = require('./validators/despatch-validator-service');

const router = express.Router();
const rawXmlParser = express.text({
  type: ['application/xml', 'text/xml', 'application/*+xml'],
  limit: '5mb'
});

const validateApiKey = async (req, res, next) => {
  const apiKey = req.headers['api-key'];
  if (!apiKey) {
    return res.status(400).send({
      success: false,
      error: 'Missing required header: api-key'
    });
  };
  req.apiKey = apiKey; // Store the API key in the request object for later use
  next();
};

router.use(validateApiKey);

// Health check endpoint
// Move this above router.use(validateApiKey) to allow unauthenticated access
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

router.post('/despatch/create', rawXmlParser, async (req, res) => {
  const apiKey = req.apiKey;
  const rawXml = req.body;

  const requestMetadata = {
    contentType: req.headers['content-type'] || null,
    requestIp: req.ip,
    userAgent: req.headers['user-agent'] || null,
    receivedAt: new Date()
  };

  // Basic validation to ensure we have XML content and content type is correct
  if (!rawXml || typeof rawXml !== 'string' || rawXml.trim() === '') {
    return res.status(400).send({ 
      success: false, 
      error: 'Request body must contain raw XML data' 
    });
  }
  if (!requestMetadata.contentType || !requestMetadata.contentType.includes('xml')) {
    return res.status(400).send({ 
      success: false, 
      error: 'Content-Type must be application/xml or text/xml' 
    });
  }

  try {
    const newAdviceId = await createDespatchAdvice(apiKey, rawXml, requestMetadata);
    res.send({
      "advice-id": newAdviceId,
      "executed-at": Math.floor(Date.now() / 1000)
    });
  } catch (error) {
    if (error instanceof DespatchValidationError) {
      return res.status(400).send({
        success: false,
        error: error.errors.join(', ')
      });
    }
    console.error('Error creating despatch advice:', error);
    res.status(500).send({ 
      success: false, 
      error: error.message
    });
  }
});

module.exports = router;