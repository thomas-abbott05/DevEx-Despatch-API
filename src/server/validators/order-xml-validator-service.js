const { validate, version } = require('uuid');

const UBL_ORDER_NS = {
  order: 'urn:oasis:names:specification:ubl:schema:xsd:Order-2',
  cbc: 'urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2'
};

let libxml2ModulePromise;

function isValidUuidV4(value) {
  return typeof value === 'string' && validate(value) && version(value) === 4;
}

async function getXmlDocumentClass() {
  if (!libxml2ModulePromise) {
    libxml2ModulePromise = import('libxml2-wasm');
  }

  const { XmlDocument } = await libxml2ModulePromise;
  return XmlDocument;
}

function getNodeContent(xmlDoc, xpath, namespaces) {
  const node = xmlDoc.get(xpath, namespaces);
  return node ? node.content.trim() : null;
}

// Implement basic exception for invalid XML with one error message for simplicity
class BasicXmlValidationError extends Error {
  constructor(errors) {
    super('XML validation failed');
    this.name = 'BasicXmlValidationError';
    this.errors = errors;
  }
}

async function validateOrderXml(rawXml) {
  let XmlDocument;
  try {
    XmlDocument = await getXmlDocumentClass();
  } catch (error) {
    return {
      success: false,
      errors: ['Error initializing XML parser: ' + error.message]
    };
  }

  let xmlDoc;
  try {
    xmlDoc = XmlDocument.fromString(rawXml);
  } catch (error) {
    return {
      success: false,
      errors: ['Invalid XML content']
    };
  }

  try {
    const orderRoot = xmlDoc.get('/order:Order', UBL_ORDER_NS);
    if (!orderRoot) {
      return {
        success: false,
        errors: ['Missing Order root element']
      };
    }

    const uuidValue = getNodeContent(
      xmlDoc,
      '/order:Order/cbc:UUID',
      UBL_ORDER_NS
    );

    if (!uuidValue) {
      return {
        success: false,
        errors: ['Missing Order/cbc:UUID element']
      };
    }

    if (!isValidUuidV4(uuidValue)) {
      return {
        success: false,
        errors: ['Invalid UUID format in Order/cbc:UUID']
      };
    }

    const orderId = getNodeContent(
      xmlDoc,
      '/order:Order/cbc:ID',
      UBL_ORDER_NS
    );
    const salesOrderId = getNodeContent(
      xmlDoc,
      '/order:Order/cbc:SalesOrderID',
      UBL_ORDER_NS
    );
    const issueDate = getNodeContent(
      xmlDoc,
      '/order:Order/cbc:IssueDate',
      UBL_ORDER_NS
    );

    return {
      success: true,
      id: uuidValue,
      orderId,
      salesOrderId,
      issueDate
    };
  } catch (error) {
    return {
      success: false,
      errors: ['Error parsing XML: ' + error.message]
    };
  } finally {
    xmlDoc.dispose();
  }
}

module.exports = {
  validateOrderXml,
  BasicXmlValidationError,
  isValidUuidV4,
  getXmlDocumentClass,
  getNodeContent
};