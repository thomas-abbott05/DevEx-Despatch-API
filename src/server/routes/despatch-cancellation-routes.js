const express = require('express');
const apiKeyValidation = require('../middleware/api-key-validation');

const { buildCancelRequestMetadata, buildCancelRetrievalMetadata } = require('../despatch/despatch-cancel-order-request-helper');
const { cancelDespatchAdvice, getCancellation } = require('../despatch/despatch-cancel-order');
const { buildFulfilmentCancelRequestMetadata, buildFulfilmentCancelRetrievalMetadata } = require('../despatch/despatch-cancel-fulfilment-helper');
const { createFulfilmentCancellation, getFulfilmentCancellation } = require('../despatch/despatch-cancel-fulfilment');
const router = express.Router();

function getResponseErrors(error) {
  if (Array.isArray(error.errors) && error.errors.length > 0) {
    return error.errors;
  }
  return [error.message];
}

router.use(apiKeyValidation);

// POST /api/v1/despatch/cancel/order
router.post('/order', async (req, res) => {
  const apiKey = req.apiKey;

  try {
    const metadata = buildCancelRequestMetadata(req);
    const result = await cancelDespatchAdvice(apiKey, metadata);
    res.status(200).send(result);
  } catch (error) {
    return res.status(error.statusCode || 500).send({errors: getResponseErrors(error), "executed-at": Math.floor(Date.now() / 1000)});
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
    return res.status(error.statusCode || 500).send({errors: getResponseErrors(error), "executed-at": Math.floor(Date.now() / 1000)});
  }
});

// POST /api/v1/despatch/cancel/fulfilment
router.post('/fulfilment', async (req, res) => {
  const apiKey = req.apiKey;

  try {
    const metadata = buildFulfilmentCancelRequestMetadata(req);
    const result = await createFulfilmentCancellation(apiKey, metadata);
    res.status(200).send(result);
  } catch (error) {
    return res.status(error.statusCode || 500).send({ errors: getResponseErrors(error), "executed-at": Math.floor(Date.now() / 1000) });
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
    return res.status(error.statusCode || 500).send({ errors: getResponseErrors(error), "executed-at": Math.floor(Date.now() / 1000) });
  }
});

module.exports = router;