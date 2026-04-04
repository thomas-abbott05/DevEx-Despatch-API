const { getXmlDocumentClass, getNodeContent } = require('../common/basic-xml-validator-service');

const UBL_RECEIPT_ADVICE_NS = {
  oc: 'urn:oasis:names:specification:ubl:schema:xsd:ReceiptAdvice-2',
  cbc: 'urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2',
  cac: 'urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2'
};

async function validateReceiptAdviceXml(rawXml) {
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
    const root = xmlDoc.get('/oc:ReceiptAdvice', UBL_RECEIPT_ADVICE_NS);
    if (!root) {
      return {
        success: false,
        errors: ['Missing ReceiptAdvice root element']
      };
    }

    const id = getNodeContent(
      xmlDoc,
      '/oc:ReceiptAdvice/cbc:ID',
      UBL_RECEIPT_ADVICE_NS
    );

    if (!id) {
      return {
        success: false,
        errors: ['Missing ReceiptAdvice/cbc:ID element']
      };
    }
    
    const issueDate = getNodeContent(
      xmlDoc,
      '/oc:ReceiptAdvice/cbc:IssueDate',
      UBL_RECEIPT_ADVICE_NS
    );

    if (!issueDate) {
      return {
        success: false,
        errors: ['Missing ReceiptAdvice/cbc:IssueDate element']
      };
    }

    const despatchDocReference = getNodeContent(
      xmlDoc,
      '/oc:ReceiptAdvice/cac:DespatchDocumentReference/cbc:ID',
      UBL_RECEIPT_ADVICE_NS
    );

    const receiptLine = getNodeContent(
      xmlDoc,
      '/oc:ReceiptAdvice/cac:ReceiptLine',
      UBL_RECEIPT_ADVICE_NS
    );

    return {
      success: true,
      id,
      issueDate,
      despatchDocReference,
      receiptLine
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
  validateReceiptAdviceXml,
};