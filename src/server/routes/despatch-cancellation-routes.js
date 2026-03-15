const express = require('express');
const { buildCancelRequestMetadata, buildCancelRetrievalMetadata } = require('../despatch/despatch-cancel-order-request-helper');
const { cancelDespatchAdvice, getCancellation } = require('../despatch/despatch-cancel-order');
const { buildFulfilmentCancelRequestMetadata, buildFulfilmentCancelRetrievalMetadata } = require('../despatch/despatch-cancel-fulfilment-helper');
const { cancelDespatchWithFulfilment, getFulfilmentCancellation } = require('../despatch/despatch-cancel-fulfilment');
const router = express.Router();

// POST /api/v1/despatch/cancel/order
router.post('/order', async (req, res) => {
  const apiKey = req.apiKey;
 
  try {
    const metadata = buildCancelRequestMetadata(req);
    const result = await cancelDespatchAdvice(apiKey, metadata);
    res.status(200).send(result);
  } catch (error) {
    return res.status(error.statusCode || 500).send({errors: [error.message]});
  }
});

// GET /api/v1/despatch/cancel/order
router.get('/order', async (req, res) => {
  const apiKey = req.apiKey;

  try {
    const metadata = buildCancelRetrievalMetadata(req);
    const result = await getCancellation(apiKey, metadata);
    res.status(200).send(result);
  } catch (error) {
    return res.status(error.statusCode || 500).send({errors: [error.message]});
  }
});

// POST /api/v1/despatch/cancel/fulfilment
router.post('/fulfilment', async (req, res) => {
  const apiKey = req.apiKey;

  try {
    const metadata = buildFulfilmentCancelRequestMetadata(req);
    const result = await cancelDespatchWithFulfilment(apiKey, metadata);
    res.status(200).send(result);
  } catch (error) {
    return res.status(error.statusCode || 500).send({ errors: [error.message] });
  }
});

// GET /api/v1/despatch/cancel/fulfilment
router.get('/fulfilment', async (req, res) => {
  const apiKey = req.apiKey;
  
  try {
    const metadata = buildFulfilmentCancelRetrievalMetadata(req);
    const result = await getFulfilmentCancellation(apiKey, metadata);
    res.status(200).send(result);
  } catch (error) {
    return res.status(error.statusCode || 500).send({ errors: [error.message] });
  }
});

module.exports = router;