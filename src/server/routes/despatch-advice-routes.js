const express = require('express');
const apiKeyValidation = require('../middleware/api-key-validation');
const { createDespatchAdvice, listDespatchAdvices, getDespatchAdviceById } = require('../despatch/despatch-service');
const { isValidUuid } = require('../validators/basic-xml-validator-service');
const { buildRequestMetadata, validateXmlRequest } = require('../despatch/despatch-request-helper');
const { validateOrder } = require('../validators/order-xml-validator-service');
const { parseOrderXml } = require('../despatch/order-parser-service');

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
  const apiKey = req.apiKey;
  const searchType = req.query['search-type'];
  const VALID_SEARCH_TYPES = ['order', 'advice-id'];
  if (!searchType || !VALID_SEARCH_TYPES.includes(searchType)) {
    return res.status(400).send({
      errors: [`Missing valid search-type parameter - must be one of: ${VALID_SEARCH_TYPES.join(', ')}`],
      "executed-at": Math.floor(Date.now() / 1000)
    });
  }
  const query = req.query['query'];
  if (!query) {
    return res.status(400).send({
      errors: ['Missing query parameter - must provide a value to search for'],
      "executed-at": Math.floor(Date.now() / 1000)
    });
  }
  // validate query format
  if (searchType === 'advice-id') {
    if (!isValidUuid(query)) {
      return res.status(400).send({
        errors: ['Invalid advice-id format - must be a valid UUID'],
        "executed-at": Math.floor(Date.now() / 1000)
      });
    }
    // search by advice ID
    result = await getDespatchAdviceById(apiKey, query);
    if (!result) {
      return res.status(404).send({
        errors: ['Despatch advice not found for provided advice-id'],
        "executed-at": Math.floor(Date.now() / 1000)
      });
    }
    return res.status(200).send({
      "despatch-advice": result.despatchXml,
      "advice-id": query,
      "executed-at": Math.floor(Date.now() / 1000)
    });
  } else if (searchType === 'order') {
    try {
      const parsedOrderTree = parseOrderXml(query);
      let result = await validateOrder(parsedOrderTree);
      if (!result.success) {
        return res.status(400).send({
          errors: result.errors,
          "executed-at": Math.floor(Date.now() / 1000)
        });
      }
      // search by order XML

    } catch (error) {
      return res.status(400).send({
        errors: [error.message],
        "executed-at": Math.floor(Date.now() / 1000)
      });
    }
  }
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
