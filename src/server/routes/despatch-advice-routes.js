const express = require('express');
const apiKeyValidation = require('../middleware/api-key-validation');

const { createDespatchAdvice, listDespatchAdvices } = require('../despatch/despatch-service');
const { BasicXmlValidationError } = require('../validators/basic-xml-validator-service');
const { RequestValidationError, buildRequestMetadata, validateXmlRequest } = require('../despatch/despatch-request-helper');


const router = express.Router();

const rawXmlParser = express.text({
  type: ['application/xml', 'text/xml', 'application/*+xml'],
  limit: '5mb'
});

// All despatch routes require a normal issued API key.
router.use(apiKeyValidation);

router.post('/create', rawXmlParser, async (req, res) => {
  const apiKey = req.apiKey;
  const incomingOrderXml = req.body;

  try {
    validateXmlRequest(req);
    const requestMetadata = buildRequestMetadata(req);
    
    const { adviceIds } = await createDespatchAdvice(apiKey, incomingOrderXml, requestMetadata);
    const executedAt = Math.floor(Date.now() / 1000);

    res.status(200).send({
        success: true,
        adviceIds,
        "executed-at": executedAt
      });

  } catch (error) {
    return res.status(error.statusCode || 500).send({
      success: false,
      errors: [error.message]
    });
  }
});

router.get('/retrieve', async (req, res) => {
  res.status(501).send({
    success: false,
    errors: ['Not implemented yet'],
    'executed-at': Math.floor(Date.now() / 1000)
  });
});

router.get('/list', async (req, res) => {
  const apiKey = req.apiKey;

  try {
    const results = await listDespatchAdvices(apiKey);
    res.send({
      results,
      'executed-at': Math.floor(Date.now() / 1000)
    });
  } catch (error) {
    console.error('Error fetching despatches:', error);
    res.status(500).send({
      success: false,
      errors: [error.message]
    });
  }
});

module.exports = router;
