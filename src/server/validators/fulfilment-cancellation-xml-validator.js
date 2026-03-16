const { getXmlDocumentClass, getNodeContent } = require('./basic-xml-validator-service');

const UBL_ORDER_FULFILMENT_NS = {
  oc: 'urn:oasis:names:specification:ubl:schema:xsd:FulfilmentCancellation-2',
  cbc: 'urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2',
  cac: 'urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2'
};

async function validateFulfilmentCancellationXml(rawXml) {
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
    const root = xmlDoc.get('/oc:FulfilmentCancellation', UBL_ORDER_FULFILMENT_NS);
    if (!root) {
      return {
        success: false,
        errors: ['Missing FulfilmentCancellation root element']
      };
    }

    const id = getNodeContent(
      xmlDoc,
      '/oc:FulfilmentCancellation/cbc:ID',
      UBL_ORDER_FULFILMENT_NS
    );

    if (!id) {
      return {
        success: false,
        errors: ['Missing FulfilmentCancellation/cbc:ID element']
      };
    }

    const issueDate = getNodeContent(
      xmlDoc,
      '/oc:FulfilmentCancellation/cbc:IssueDate',
      UBL_ORDER_FULFILMENT_NS
    );

    if (!issueDate) {
      return {
        success: false,
        errors: ['Missing DespatchAdvice/cbc:IssueDate element']
      };
    }
    
    const originalOrderId = getNodeContent(
      xmlDoc,
      '/oc:FulfilmentCancellation/cac:OrderReference/cbc:ID',
      UBL_ORDER_FULFILMENT_NS
    );

    const cancellationNote = getNodeContent(
      xmlDoc,
      '/oc:FulfilmentCancellation/cbc:CancellationNote',
      UBL_ORDER_FULFILMENT_NS
    );

    return {
      success: true,
      id,
      issueDate,
      originalOrderId,
      cancellationNote: cancellationNote ?? 'No reason provided'
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
  validateFulfilmentCancellationXml,
};