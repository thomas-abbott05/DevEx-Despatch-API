const { getXmlDocumentClass, getNodeContent } = require('./basic-xml-validator-service');

const UBL_DESPATCH_ADVICE_NS = {
  oc: 'urn:oasis:names:specification:ubl:schema:xsd:DespatchAdvice-2',
  cbc: 'urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2',
  cac: 'urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2'
};

async function validateDespatchAdviceXml(rawXml) {
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
    const root = xmlDoc.get('/oc:DespatchAdvice', UBL_DESPATCH_ADVICE_NS);
    if (!root) {
      return {
        success: false,
        errors: ['Missing DespatchAdvice root element']
      };
    }

    const id = getNodeContent(
      xmlDoc,
      '/oc:DespatchAdvice/cbc:ID',
      UBL_DESPATCH_ADVICE_NS
    );

    if (!id) {
      return {
        success: false,
        errors: ['Missing DespatchAdvice/cbc:ID element']
      };
    }
    
    const issueDate = getNodeContent(
      xmlDoc,
      '/oc:DespatchAdvice/cbc:IssueDate',
      UBL_DESPATCH_ADVICE_NS
    );

    if (!issueDate) {
      return {
        success: false,
        errors: ['Missing DespatchAdvice/cbc:IssueDate element']
      };
    }

    const originalOrderId = getNodeContent(
      xmlDoc,
      '/oc:DespatchAdvice/cac:OrderReference/cbc:ID',
      UBL_DESPATCH_ADVICE_NS
    );

    const despatchLine = getNodeContent(
      xmlDoc,
      '/oc:DespatchAdvice/cac:DespatchLine',
      UBL_DESPATCH_ADVICE_NS
    );

    return {
      success: true,
      id,
      issueDate,
      originalOrderId,
      despatchLine
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
  validateDespatchAdviceXml,
};