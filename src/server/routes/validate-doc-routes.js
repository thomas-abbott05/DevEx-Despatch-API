const express = require('express');
const apiKeyValidation = require('../middleware/api-key-validation');
const { validateXml } = require('../validators/xsd-validator-service');

const VALID_DOCUMENT_TYPES = ['order', 'receipt', 'despatch', 'order-cancel', 'order-change', 'fulfilment-cancel'];

const router = express.Router();

router.use(apiKeyValidation);

// POST /api/v1/validate-doc/{document-type}
router.post('/{document-type}', express.text({ type: ['text/xml', 'application/xml'] }), async (req, res) => {
  const executedAt = Math.floor(Date.now() / 1000);
  const documentType = req.params['document-type'];
  const rawXml = req.body;

  if (!VALID_DOCUMENT_TYPES.includes(documentType)) {
    return res.status(400).json({
      errors: [`{document-type} is not a valid option - must be one of 'order', 'receipt', 'despatch', 'order-cancel', 'order-change', 'fulfilment-cancel'.`],
      'executed-at': executedAt
    });
  }

  if (!rawXml || typeof rawXml !== 'string' || rawXml.trim() === '') {
    return res.status(400).json({
      errors: ['Missing required parameter: XML body must be provided.'],
      'executed-at': executedAt
    });
  }

  try {
    const result = await validateXml(documentType, rawXml);

    return res.status(200).json({
      valid: result.success,
      errors: result.errors || [],
      'executed-at': executedAt
    });
  } catch (error) {
    console.error('Error validating document:', error);
    return res.status(500).json({
      errors: ['Internal server error during validation.'],
      'executed-at': executedAt
    });
  }
});

module.exports = router;
