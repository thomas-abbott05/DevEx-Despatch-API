const { getXmlDocumentClass } = require('./basic-xml-validator-service');
const { parseOrderXml } = require('../despatch/order-parser-service');
const { validateOrder } = require('./order-xml-validator-service');
const { validateReceiptAdviceXml } = require('./receipt-advice-xml-validator');
const { validateDespatchAdviceXml } = require('./despatch-advice-xml-validator');
const { validateOrderCancellationXml } = require('./order-cancellation-xml-validator-service');
const { validateOrderChangeXml } = require('./order-change-xml-validator');
const { validateFulfilmentCancellationXml } = require('./fulfilment-cancellation-xml-validator');

const VALIDATORS_BY_DOCUMENT_TYPE = {
  order: validateOrderDocument,
  receipt: validateReceiptAdviceXml,
  despatch: validateDespatchAdviceXml,
  'order-cancel': validateOrderCancellationXml,
  'order-change': validateOrderChangeXml,
  'fulfilment-cancel': validateFulfilmentCancellationXml
};

async function isWellFormedXml(rawXml) {
  const XmlDocument = await getXmlDocumentClass();
  let xmlDoc;
  try {
    xmlDoc = XmlDocument.fromString(rawXml);
    return true;
  } catch (error) {
    return false;
  } finally {
    if (xmlDoc) {
      xmlDoc.dispose();
    }
  }
}

async function validateOrderDocument(rawXml) {
  const isWellFormed = await isWellFormedXml(rawXml);
  if (!isWellFormed) {
    return {
      success: false,
      errors: ['Invalid XML content']
    };
  }

  const parsedOrderTree = parseOrderXml(rawXml);
  return validateOrder(parsedOrderTree);
}

function toValidationResponse(result) {
  if (!result || typeof result !== 'object') {
    return {
      success: false,
      errors: ['Unknown validation result']
    };
  }

  return {
    success: Boolean(result.success),
    errors: Array.isArray(result.errors) ? result.errors : []
  };
}

/**
 * XSD-based XML validation service.
 * Validates XML documents against their respective UBL XSD schemas.
 *
 * @param {string} documentType - One of 'order', 'receipt', 'despatch', 'order-cancel', 'order-change', 'fulfilment-cancel'
 * @param {string} rawXml - Raw XML string to validate
 * @returns {Promise<{ success: boolean, errors: string[] }>}
 */
async function validateXml(documentType, rawXml) {
  const validator = VALIDATORS_BY_DOCUMENT_TYPE[documentType];
  if (!validator) {
    return {
      success: false,
      errors: [`Unsupported document type: ${documentType}`]
    };
  }

  const result = await validator(rawXml);
  return toValidationResponse(result);
}

module.exports = { validateXml };