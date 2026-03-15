const { v4: uuidv4 } = require('uuid');
const { XMLParser, XMLBuilder } = require('fast-xml-parser');
const { getDb } = require('../database');

const XML_OPTIONS = {
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  trimValues: true,
  format: true,
  suppressEmptyNode: true
};

class FulfilmentCancellationNotFoundError extends Error {
  constructor(message) {
    super(message || 'Despatch advice not found');
    this.name = 'FulfilmentCancellationNotFoundError';
    this.statusCode = 404;
  }
}

class FulfilmentCancellationForbiddenError extends Error {
  constructor(message) {
    super(message || 'Unauthorised access');
    this.name = 'FulfilmentCancellationForbiddenError';
    this.statusCode = 403;
  }
}

function buildFulfilmentCancellationXml(despatchDoc, cancellationReason) {
  const despatch = new XMLParser(XML_OPTIONS).parse(despatchDoc.despatchXml)?.DespatchAdvice;
  const fulfilmentCancellationId = uuidv4();

  const xml = new XMLBuilder(XML_OPTIONS).build({
    FulfilmentCancellation: {
      '@_xmlns': 'urn:oasis:names:specification:ubl:schema:xsd:FulfilmentCancellation-2',
      '@_xmlns:cac': 'urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2',
      '@_xmlns:cbc': 'urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2',
      'cbc:UBLVersionID': '2.1',
      'cbc:ID': fulfilmentCancellationId,
      'cbc:CopyIndicator': false,
      'cbc:IssueDate': new Date().toISOString().slice(0, 10),
      'cbc:CancellationNote': cancellationReason,
      'cac:DespatchDocumentReference': {
        'cbc:ID': despatchDoc._id,
        'cbc:IssueDate': despatch?.['cbc:IssueDate'] ?? null
      },
      ...(despatch?.['cac:OrderReference'] && { 'cac:OrderReference': despatch['cac:OrderReference'] }),
      ...(despatch?.['cac:DeliveryCustomerParty'] && { 'cac:BuyerCustomerParty': despatch['cac:DeliveryCustomerParty'] }),
      ...(despatch?.['cac:DespatchSupplierParty'] && { 'cac:SellerSupplierParty': despatch['cac:DespatchSupplierParty'] })
    }
  });

  return { xml, fulfilmentCancellationId };
}

async function createFulfilmentCancellation(apiKey, metadata) {
  const { adviceId, cancellationReason } = metadata;
  const collection = getDb().collection('despatch-advice');

  const despatchDoc = await collection.findOne({ _id: adviceId });

  if (!despatchDoc) {
    throw new FulfilmentCancellationNotFoundError(`Failed to find Despatch Advice with id ${adviceId}.`);
  }

  if (despatchDoc.apiKey !== apiKey) {
    throw new FulfilmentCancellationForbiddenError('Unauthorised access.');
  }

  const { xml: fulfilmentCancellationXml, fulfilmentCancellationId } = buildFulfilmentCancellationXml(despatchDoc, cancellationReason);
  const now = new Date();

  await collection.updateOne(
    { _id: adviceId },
    {
      $set: { 
        status: 'cancelled',
        fulfilmentCancellationXml,
        fulfilmentCancellationId,
        cancellationReason,
        cancelledAt: now
      },
      $unset: { 
        despatchXml: ''
      }
    }
  );

  return {
    'fulfilment-cancellation': fulfilmentCancellationXml,
    'fulfilment-cancellation-reason': cancellationReason,
    'fulfilment-cancellation-id': fulfilmentCancellationId,
    'advice-id': adviceId,
    'executed-at': now
  };
}

async function getFulfilmentCancellation(apiKey, metadata) {
  const { adviceId, fulfilmentCancellationId } = metadata;
  const collection = getDb().collection('despatch-advice');

  const despatchDoc = await collection.findOne(adviceId ? { _id: adviceId } : { fulfilmentCancellationId });

  if (!despatchDoc) {
    throw new FulfilmentCancellationNotFoundError(`Failed to find Despatch Advice with id ${adviceId ?? fulfilmentCancellationId}.`);
  }

  if (despatchDoc.apiKey !== apiKey) {
    throw new FulfilmentCancellationForbiddenError('Unauthorised access.');
  }

  if (!despatchDoc.fulfilmentCancellationXml) {
    throw new FulfilmentCancellationNotFoundError(`No fulfilment cancellation found for id ${adviceId ?? fulfilmentCancellationId}.`);
  }

  return {
    'fulfilment-cancellation': despatchDoc.fulfilmentCancellationXml,
    'fulfilment-cancellation-reason': despatchDoc.cancellationReason,
    'fulfilment-cancellation-id': despatchDoc.fulfilmentCancellationId,
    'advice-id': despatchDoc._id,
    'executed-at': new Date()
  };
}

module.exports = {
  createFulfilmentCancellation,
  getFulfilmentCancellation,
  FulfilmentCancellationNotFoundError,
  FulfilmentCancellationForbiddenError
};