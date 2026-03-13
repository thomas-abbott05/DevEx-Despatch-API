const express = require('express');
const crypto = require('crypto');

const { getServerConstants } = require('./config/server-config');
const { getDb } = require('./database');
const { listDespatchAdvices, createDespatchAdvice } = require('./despatch/despatch-service');
const { BasicXmlValidationError } = require('./validators/order-xml-validator-service');
const { RequestValidationError, buildRequestMetadata } = require('./despatch/despatch-request-helper');
const apiKeyAuth = require('./middleware/apiKeyAuth');

//
function generateApiKey() {
  return crypto.randomBytes(32).toString('hex');
}
//

const router = express.Router();
const rawXmlParser = express.text({
  type: ['application/xml', 'text/xml', 'application/*+xml'],
  limit: '5mb'
});

/*
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
*/

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

router.post('/keys', async (req, res) => {
  try {
    const db = getDb();
    const apiKey = generateApiKey();

    const newKey = {
      key: apiKey,
      owner: "devex-team", 
      createdAt: new Date()
    };

    await db.collection("api-keys").insertOne(newKey);

    res.send({
      apiKey: apiKey,
      "executed-at": Math.floor(Date.now() / 1000)
    });
  } catch (error) {
    console.error("Error creating API key:", error);

    res.status(500).send({
      errors: ["Internal server error"],
      "executed-at": Math.floor(Date.now() / 1000)
    });
  }
});

router.get('/keys', async (req, res) => {
  try {
    const db = getDb();

    const keys = await db.collection("api-keys").find({}).toArray();

    res.send({
      results: keys,
      "executed-at": Math.floor(Date.now() / 1000)
    });
  } catch (error) {
    console.error("Error fetching API keys:", error);

    res.status(500).send({
      errors: ["Internal server error"],
      "executed-at": Math.floor(Date.now() / 1000)
    });
  }
});

router.delete('/keys/:key', async (req, res) => {
  try {
    const db = getDb();
    const key = req.params.key;

    const result = await db.collection("api-keys").deleteOne({
      key: key
    });
    if (result.deletedCount === 0) {
      return res.status(404).send({
        errors: ["API key not found"],
        "executed-at": Math.floor(Date.now() / 1000)
      });
    }
    res.send({
      success: true,
      "executed-at": Math.floor(Date.now() / 1000)
    });
  } catch (error) {
    console.error("Error deleting API key:", error);

    res.status(500).send({
      errors: ["Internal server error"],
      "executed-at": Math.floor(Date.now() / 1000)
    });
  }
});

router.use(apiKeyAuth);

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
  const incomingOrderXml = req.body;

  try {
    const requestMetadata = buildRequestMetadata(req);
    const { adviceId, despatchXml: generatedDespatchAdviceXml } = await createDespatchAdvice(apiKey, incomingOrderXml, requestMetadata);
    const executedAt = Math.floor(Date.now() / 1000);

    res
      .set({
        'Content-Type': 'application/xml',
        'advice-id': adviceId,
        'executed-at': String(executedAt)
      })
      .send(generatedDespatchAdviceXml);

  } catch (error) {
      if (error instanceof RequestValidationError || error instanceof BasicXmlValidationError) {
      return res.status(400).send({ success: false, error: error.message });
    }
    console.error('Error creating despatch advice:', error);
    res.status(500).send({ success: false, error: error.message });
  }
});

router.get('/despatch/retrieve', async (req, res) => {
  const apiKey = req.apiKey;

  res.status(501).send({
    success: false,
    error: 'Not implemented yet',
    "executed-at": Math.floor(Date.now() / 1000)
  });
});

router.get('/despatch/list', async (req, res) => {
  const apiKey = req.apiKey;
  try {
    const results = await listDespatchAdvices(apiKey);
    res.send({ 
      results: results,
      "executed-at": Math.floor(Date.now() / 1000)
    });
  } catch (error) {
    console.error('Error fetching despatches:', error);
    res.status(500).send({ 
      success: false, 
      error: error.message
    });
  }
});

module.exports = router;