const { isValidUuid, getXmlDocumentClass, getNodeContent } = require('./basic-xml-validator-service');

const UBL_ORDER_CANCELLATION_NS = {
  oc: 'urn:oasis:names:specification:ubl:schema:xsd:OrderCancellation-2',
  cbc: 'urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2'
};

/**
 * Validates a UBL OrderCancellation XML string.
 * Checks that it is valid XML, has the correct root element,
 * and contains a valid UUID in the ID field.
 *
 * Returns { success: true, id, cancellationNote } on success,
 * or { success: false, errors: [...] } on failure.
 */
async function validateOrderCancellationXml(rawXml) {
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
    const root = xmlDoc.get('/oc:OrderCancellation', UBL_ORDER_CANCELLATION_NS);
    if (!root) {
      return {
        success: false,
        errors: ['Missing OrderCancellation root element']
      };
    }

    const id = getNodeContent(
      xmlDoc,
      '/oc:OrderCancellation/cbc:ID',
      UBL_ORDER_CANCELLATION_NS
    );

    if (!id) {
      return {
        success: false,
        errors: ['Missing OrderCancellation/cbc:ID element']
      };
    }

    if (!isValidUuid(id)) {
      return {
        success: false,
        errors: ['Invalid UUID format in OrderCancellation/cbc:ID']
      };
    }

    const cancellationNote = getNodeContent(
      xmlDoc,
      '/oc:OrderCancellation/cbc:CancellationNote',
      UBL_ORDER_CANCELLATION_NS
    );

    return {
      success: true,
      id,
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
  validateOrderCancellationXml,
};