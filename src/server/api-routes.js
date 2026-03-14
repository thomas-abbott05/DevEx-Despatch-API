const express = require('express');
const { getServerConstants } = require('./config/server-config');
const { getDb } = require('./database');
const { listDespatchAdvices, createDespatchAdvice } = require('./despatch/despatch-service');
const { BasicXmlValidationError } = require('./validators/order-xml-validator-service');
const { RequestValidationError, buildRequestMetadata } = require('./despatch/despatch-request-helper');
const { cancelDespatchAdvice, getCancellation, CancellationNotFoundError, CancellationForbiddenError } = require('./despatch/despatch-cancel-order');
const { buildCancelRequestMetadata, buildCancelRetrievalMetadata } = require('./despatch/despatch-cancel-order-request-helper');

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

// POST /api/v1/despatch/cancel/order
router.post('/despatch/cancel/order', async (req, res) => {
  const apiKey = req.apiKey;
 
  try {
    const metadata = buildCancelRequestMetadata(req);
    const result = await cancelDespatchAdvice(apiKey, metadata);
    res.status(200).send(result);
  } catch (error) {
    if (error instanceof RequestValidationError || error instanceof BasicXmlValidationError) {
      return res.status(400).send({
        error: 'Bad Request',
        message: error.message,
        'executed-at': Math.floor(Date.now() / 1000)
      });
    }
    if (error instanceof CancellationNotFoundError) {
      return res.status(404).send({
        error: 'Not Found',
        message: error.message,
        'executed-at': Math.floor(Date.now() / 1000)
      });
    }
    if (error instanceof CancellationForbiddenError) {
      return res.status(403).send({
        error: 'Forbidden',
        message: error.message,
        'executed-at': Math.floor(Date.now() / 1000)
      });
    }
    console.error('Error cancelling despatch advice:', error);
    res.status(500).send({
      error: 'Internal Server Error',
      message: 'An unexpected error occurred while processing the request.',
      'executed-at': Math.floor(Date.now() / 1000)
    });
  }
});

// GET /api/v1/despatch/cancel/order
router.get('/despatch/cancel/order', async (req, res) => {
  const apiKey = req.apiKey;
 
  try {
    const metadata = buildCancelRetrievalMetadata(req);
    const result = await getCancellation(apiKey, metadata);
    res.status(200).send(result);
  } catch (error) {
    if (error instanceof RequestValidationError) {
      return res.status(400).send({
        error: 'Bad Request',
        message: error.message,
        'executed-at': Math.floor(Date.now() / 1000)
      });
    }
    if (error instanceof CancellationNotFoundError) {
      return res.status(404).send({
        error: 'Not Found',
        message: error.message,
        'executed-at': Math.floor(Date.now() / 1000)
      });
    }
    if (error instanceof CancellationForbiddenError) {
      return res.status(403).send({
        error: 'Forbidden',
        message: error.message,
        'executed-at': Math.floor(Date.now() / 1000)
      });
    }
    console.error('Error retrieving cancellation:', error);
    res.status(500).send({
      error: 'Internal Server Error',
      message: 'An unexpected error occurred while processing the request.',
      'executed-at': Math.floor(Date.now() / 1000)
    });
  }
});

module.exports = router;