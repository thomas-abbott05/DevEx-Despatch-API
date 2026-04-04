const { getXmlDocumentClass, getNodeContent } = require('../common/basic-xml-validator-service');

const UBL_ORDER_CHANGE_NS = {
  oc: 'urn:oasis:names:specification:ubl:schema:xsd:OrderChange-2',
  cbc: 'urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2',
  cac: 'urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2'
};

async function validateOrderChangeXml(rawXml) {
    let XmlDocument;
  try {
    XmlDocument = await getXmlDocumentClass();
  } catch (error) {
    return {
      success: false,
      errors: ['Error initialising XML parser: ' + error.message]
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
    const root = xmlDoc.get('/oc:OrderChange', UBL_ORDER_CHANGE_NS);
    if (!root) {
      return {
        success: false,
        errors: ['Missing OrderChange root element']
      };
    }

    const id = getNodeContent(
      xmlDoc,
      '/oc:OrderChange/cbc:ID',
      UBL_ORDER_CHANGE_NS
    );

    if (!id) {
      return {
        success: false,
        errors: ['Missing OrderChange/cbc:ID element']
      };
    }
    
    const issueDate = getNodeContent(
      xmlDoc,
      '/oc:OrderChange/cbc:IssueDate',
      UBL_ORDER_CHANGE_NS
    );

    if (!issueDate) {
      return {
        success: false,
        errors: ['Missing OrderChange/cbc:IssueDate element']
      };
    }

    const originalOrderId = getNodeContent(
      xmlDoc,
      '/oc:OrderChange/cac:OrderReference/cbc:ID',
      UBL_ORDER_CHANGE_NS
    );

    const orderLine = getNodeContent(
      xmlDoc,
      '/oc:OrderChange/cac:OrderLine',
      UBL_ORDER_CHANGE_NS
    );

    return {
      success: true,
      id,
      issueDate,
      originalOrderId,
      orderLine
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
  validateOrderChangeXml,
};