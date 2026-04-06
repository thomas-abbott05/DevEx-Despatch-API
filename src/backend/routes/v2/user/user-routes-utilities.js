const { XMLBuilder, XMLParser } = require('fast-xml-parser');
const { randomUUID } = require('node:crypto');
const { parseOrderXml } = require('../../../despatch/order-parser-service');
const { isValidUuid } = require('../../../validators/common/basic-xml-validator-service');
function nowUnix() {
  return Math.floor(Date.now() / 1000);
}

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

function toUnix(value) {
  if (!value) {
    return nowUnix();
  }

  const dateValue = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(dateValue.getTime())) {
    return nowUnix();
  }

  return Math.floor(dateValue.getTime() / 1000);
}

function asArray(value) {
  if (Array.isArray(value)) {
    return value;
  }
  if (value === undefined || value === null) {
    return [];
  }
  return [value];
}

function firstObject(value) {
  if (Array.isArray(value)) {
    const match = value.find((entry) => entry && typeof entry === 'object' && !Array.isArray(entry));
    return match || null;
  }
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value;
  }
  return null;
}

function getObjectValue(objectValue, keys) {
  if (!objectValue || typeof objectValue !== 'object' || Array.isArray(objectValue)) {
    return null;
  }

  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(objectValue, key)) {
      return objectValue[key];
    }
  }

  return null;
}

function getObjectValueLoose(objectValue, keys) {
  const directMatch = getObjectValue(objectValue, keys);
  if (directMatch !== null) {
    return directMatch;
  }

  if (!objectValue || typeof objectValue !== 'object' || Array.isArray(objectValue)) {
    return null;
  }

  const lowerCaseLookup = new Map();
  Object.keys(objectValue).forEach((key) => {
    lowerCaseLookup.set(String(key).toLowerCase(), key);
  });

  for (const key of keys) {
    const matchingKey = lowerCaseLookup.get(String(key).toLowerCase());
    if (matchingKey !== undefined) {
      return objectValue[matchingKey];
    }
  }

  return null;
}

function getOrderLineNodes(orderNode) {
  return asArray(getObjectValueLoose(orderNode, ['cac:OrderLine', 'OrderLine', 'orderLine']));
}

function getLineItemNode(lineNode) {
  return firstObject(getObjectValueLoose(lineNode, ['cac:LineItem', 'LineItem', 'lineItem']));
}

function readText(value) {
  if (value === undefined || value === null) {
    return '';
  }

  if (typeof value === 'object' && !Array.isArray(value)) {
    if (value['#text'] !== undefined && value['#text'] !== null) {
      return String(value['#text']).trim();
    }
    return '';
  }

  return String(value).trim();
}

function readNumber(value) {
  const text = readText(value);
  const parsed = Number(text);
  if (!Number.isFinite(parsed)) {
    return NaN;
  }
  return parsed;
}

function roundCurrency(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

function isIsoDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }
  const parsed = new Date(value + 'T00:00:00.000Z');
  return !Number.isNaN(parsed.getTime());
}

function sendError(res, statusCode, errors) {
  const errorList = Array.isArray(errors) ? errors : [errors];
  return res.status(statusCode).json({
    success: false,
    errors: errorList,
    'executed-at': nowUnix()
  });
}

function sendNotFound(res, documentType, uuid) {
  return sendError(res, 404, 'No ' + documentType + ' document found for UUID ' + uuid + '.');
}

function stableStringify(value) {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return '[' + value.map((entry) => stableStringify(entry)).join(',') + ']';
  }

  const keys = Object.keys(value).sort();
  return '{' + keys.map((key) => JSON.stringify(key) + ':' + stableStringify(value[key])).join(',') + '}';
}

function collectAddressCandidates(targetList, candidate) {
  if (Array.isArray(candidate)) {
    candidate.forEach((entry) => collectAddressCandidates(targetList, entry));
    return;
  }

  if (candidate && typeof candidate === 'object' && !Array.isArray(candidate)) {
    targetList.push(candidate);
  }
}

function buildAddressLabel(address) {
  const addressLineNode = firstObject(getObjectValueLoose(address, ['AddressLine', 'addressLine', 'cac:AddressLine']));

  const street = readText(
    getObjectValueLoose(address, ['StreetName', 'streetName', 'cbc:StreetName']) ||
      getObjectValueLoose(addressLineNode, ['Line', 'line', 'cbc:Line'])
  );
  const city = readText(getObjectValueLoose(address, ['CityName', 'cityName', 'cbc:CityName']));
  const postal = readText(getObjectValueLoose(address, ['PostalZone', 'postalZone', 'cbc:PostalZone']));

  const countryNode = firstObject(getObjectValueLoose(address, ['Country', 'country', 'cac:Country']));

  const country = readText(
    getObjectValueLoose(countryNode, ['IdentificationCode', 'identificationCode', 'cbc:IdentificationCode']) ||
      getObjectValueLoose(address, ['CountryCode', 'countryCode']) ||
      address.country
  );

  const segments = [street, city, postal, country].filter(Boolean);
  if (!segments.length) {
    return 'Destination Address';
  }
  return segments.join(', ');
}

function normaliseAddressOptions(addresses) {
  const dedupeMap = new Map();

  addresses.forEach((address) => {
    if (!address || typeof address !== 'object' || Array.isArray(address)) {
      return;
    }

    const key = stableStringify(address);
    if (!dedupeMap.has(key)) {
      dedupeMap.set(key, {
        key,
        label: buildAddressLabel(address),
        address
      });
    }
  });

  return Array.from(dedupeMap.values());
}

function extractPayloadPartyName(partyNode) {
  const party = firstObject(partyNode && partyNode.Party);
  const partyName = firstObject(party && party.PartyName);
  return readText(partyName && partyName.Name);
}

function extractXmlPartyName(partyNode) {
  const party = firstObject(getObjectValueLoose(partyNode, ['cac:Party', 'Party', 'party']));
  const partyName = firstObject(getObjectValueLoose(party, ['cac:PartyName', 'PartyName', 'partyName']));
  return readText(getObjectValueLoose(partyName, ['cbc:Name', 'Name', 'name']));
}

function getPayloadLineAddressOptions(orderData, lineItem) {
  const candidates = [];

  collectAddressCandidates(candidates, lineItem && lineItem.DeliveryAddress);

  const lineDeliveryNode = firstObject(lineItem && lineItem.Delivery);
  collectAddressCandidates(candidates, lineDeliveryNode && lineDeliveryNode.DeliveryAddress);
  collectAddressCandidates(candidates, firstObject(lineDeliveryNode && lineDeliveryNode.DeliveryLocation)?.Address);

  const orderDeliveryNode = firstObject(orderData && orderData.Delivery);
  collectAddressCandidates(candidates, orderDeliveryNode && orderDeliveryNode.DeliveryAddress);
  collectAddressCandidates(candidates, firstObject(orderDeliveryNode && orderDeliveryNode.DeliveryLocation)?.Address);

  return normaliseAddressOptions(candidates);
}

function getXmlLineAddressOptions(orderNode, lineItemNode) {
  const candidates = [];

  collectAddressCandidates(candidates, getObjectValueLoose(lineItemNode, ['cac:DeliveryAddress', 'DeliveryAddress', 'deliveryAddress']));

  const lineDeliveryNode = firstObject(getObjectValueLoose(lineItemNode, ['cac:Delivery', 'Delivery', 'delivery']));
  collectAddressCandidates(candidates, getObjectValueLoose(lineDeliveryNode, ['cac:DeliveryAddress', 'DeliveryAddress', 'deliveryAddress']));
  collectAddressCandidates(
    candidates,
    getObjectValueLoose(
      firstObject(getObjectValueLoose(lineDeliveryNode, ['cac:DeliveryLocation', 'DeliveryLocation', 'deliveryLocation'])),
      ['cac:Address', 'Address', 'address']
    )
  );

  const orderDeliveryNode = firstObject(getObjectValueLoose(orderNode, ['cac:Delivery', 'Delivery', 'delivery']));
  collectAddressCandidates(candidates, getObjectValueLoose(orderDeliveryNode, ['cac:DeliveryAddress', 'DeliveryAddress', 'deliveryAddress']));
  collectAddressCandidates(
    candidates,
    getObjectValueLoose(
      firstObject(getObjectValueLoose(orderDeliveryNode, ['cac:DeliveryLocation', 'DeliveryLocation', 'deliveryLocation'])),
      ['cac:Address', 'Address', 'address']
    )
  );

  return normaliseAddressOptions(candidates);
}

function parsePayloadQuantity(lineItem) {
  const quantity = Number(lineItem && lineItem.Quantity);
  return Number.isFinite(quantity) ? quantity : NaN;
}

function parseXmlQuantity(quantityNode) {
  const quantity = readNumber(quantityNode);
  return Number.isFinite(quantity) ? quantity : NaN;
}

function parseLineUnitPrice(priceNode) {
  if (!priceNode || typeof priceNode !== 'object' || Array.isArray(priceNode)) {
    return NaN;
  }

  const priceAmountNode = getObjectValueLoose(priceNode, ['cbc:PriceAmount', 'PriceAmount', 'priceAmount']);
  return readNumber(priceAmountNode);
}

function getLineQuantityNode(lineItem) {
  return getObjectValueLoose(lineItem, [
    'cbc:Quantity',
    'Quantity',
    'quantity',
    'cbc:RequestedQuantity',
    'RequestedQuantity',
    'requestedQuantity',
    'cbc:DeliveredQuantity',
    'DeliveredQuantity',
    'deliveredQuantity',
    'cbc:InvoicedQuantity',
    'InvoicedQuantity',
    'invoicedQuantity'
  ]);
}

function buildPayloadLineSnapshots(orderData) {
  const lines = asArray(orderData && orderData.OrderLine);

  return lines.map((lineNode, index) => {
    const lineItem = firstObject(lineNode && lineNode.LineItem) || {};
    const itemNode = firstObject(lineItem.Item) || {};
    const priceNode = firstObject(lineItem.Price) || {};
    const unitPrice = parseLineUnitPrice(priceNode);
    const descriptions = asArray(itemNode.Description)
      .map((entry) => readText(entry))
      .filter(Boolean);

    return {
      lineId: readText(lineItem.ID) || 'LINE-' + String(index + 1).padStart(3, '0'),
      requestedQuantity: parsePayloadQuantity(lineItem),
      unitPrice: Number.isFinite(unitPrice) ? unitPrice : 0,
      itemName: readText(itemNode.Name) || 'Line Item ' + String(index + 1),
      description: descriptions[0] || '',
      destinationOptions: getPayloadLineAddressOptions(orderData, lineItem)
    };
  });
}

function buildXmlLineSnapshots(orderNode) {
  const lines = getOrderLineNodes(orderNode);

  return lines.map((lineNode, index) => {
    const lineItem = getLineItemNode(lineNode) || {};
    const itemNode = firstObject(getObjectValueLoose(lineItem, ['cac:Item', 'Item', 'item'])) || {};
    const priceNode = firstObject(getObjectValueLoose(lineItem, ['cac:Price', 'Price', 'price'])) || {};
    const descriptions = asArray(getObjectValueLoose(itemNode, ['cbc:Description', 'Description', 'description']))
      .map((entry) => readText(entry))
      .filter(Boolean);
    const quantityNode = getLineQuantityNode(lineItem);
    const requestedQuantity = parseXmlQuantity(quantityNode);
    const unitPrice = parseLineUnitPrice(priceNode);

    return {
      lineId: readText(getObjectValueLoose(lineItem, ['cbc:ID', 'ID', 'id'])) || 'LINE-' + String(index + 1).padStart(3, '0'),
      requestedQuantity: Number.isFinite(requestedQuantity) ? requestedQuantity : 0,
      unitPrice: Number.isFinite(unitPrice) ? unitPrice : 0,
      itemName: readText(getObjectValueLoose(itemNode, ['cbc:Name', 'Name', 'name'])) || 'Line Item ' + String(index + 1),
      description: descriptions[0] || '',
      destinationOptions: getXmlLineAddressOptions(orderNode, lineItem)
    };
  });
}

function writeXmlQuantity(existingQuantityNode, quantity) {
  if (existingQuantityNode && typeof existingQuantityNode === 'object' && !Array.isArray(existingQuantityNode)) {
    return {
      ...existingQuantityNode,
      '#text': String(quantity)
    };
  }

  return String(quantity);
}

function normaliseAddressNode(addressNode) {
  if (!addressNode || typeof addressNode !== 'object' || Array.isArray(addressNode)) {
    return null;
  }

  const streetName = readText(getObjectValueLoose(addressNode, ['cbc:StreetName', 'StreetName', 'streetName']));
  const cityName = readText(getObjectValueLoose(addressNode, ['cbc:CityName', 'CityName', 'cityName']));
  const postalZone = readText(getObjectValueLoose(addressNode, ['cbc:PostalZone', 'PostalZone', 'postalZone']));

  const countryNode = firstObject(getObjectValueLoose(addressNode, ['cac:Country', 'Country', 'country']));
  const countryCode = readText(
    getObjectValueLoose(countryNode, ['cbc:IdentificationCode', 'IdentificationCode', 'identificationCode']) ||
      getObjectValueLoose(addressNode, ['CountryCode', 'countryCode']) ||
      (typeof getObjectValueLoose(addressNode, ['country']) === 'string'
        ? getObjectValueLoose(addressNode, ['country'])
        : '')
  );

  const normalisedAddress = {};

  if (streetName) {
    normalisedAddress['cbc:StreetName'] = streetName;
  }
  if (cityName) {
    normalisedAddress['cbc:CityName'] = cityName;
  }
  if (postalZone) {
    normalisedAddress['cbc:PostalZone'] = postalZone;
  }
  if (countryCode) {
    normalisedAddress['cac:Country'] = {
      'cbc:IdentificationCode': countryCode
    };
  }

  if (!Object.keys(normalisedAddress).length) {
    return addressNode;
  }

  return normalisedAddress;
}

function normaliseDeliveryNode(deliveryNode) {
  const sourceDelivery = firstObject(deliveryNode) || deliveryNode;
  if (!sourceDelivery || typeof sourceDelivery !== 'object' || Array.isArray(sourceDelivery)) {
    return null;
  }

  const directAddress =
    getObjectValueLoose(sourceDelivery, ['cac:DeliveryAddress', 'DeliveryAddress', 'deliveryAddress']) ||
    getObjectValueLoose(sourceDelivery, ['cac:Address', 'Address', 'address']);

  const deliveryLocation = firstObject(
    getObjectValueLoose(sourceDelivery, ['cac:DeliveryLocation', 'DeliveryLocation', 'deliveryLocation'])
  );
  const locationAddress = getObjectValueLoose(deliveryLocation, ['cac:Address', 'Address', 'address']);

  const requestedDeliveryPeriod = getObjectValueLoose(sourceDelivery, [
    'cac:RequestedDeliveryPeriod',
    'RequestedDeliveryPeriod',
    'requestedDeliveryPeriod'
  ]);

  const normalisedDelivery = {};
  const normalisedAddress = normaliseAddressNode(directAddress) || normaliseAddressNode(locationAddress);

  if (normalisedAddress) {
    normalisedDelivery['cac:DeliveryAddress'] = normalisedAddress;
  }
  if (requestedDeliveryPeriod) {
    normalisedDelivery['cac:RequestedDeliveryPeriod'] = requestedDeliveryPeriod;
  }

  if (!Object.keys(normalisedDelivery).length) {
    return null;
  }

  return normalisedDelivery;
}

function normalisePartyNode(partyContainerNode) {
  const sourceContainer = firstObject(partyContainerNode) || partyContainerNode;
  if (!sourceContainer || typeof sourceContainer !== 'object' || Array.isArray(sourceContainer)) {
    return null;
  }

  const sourceParty =
    firstObject(getObjectValueLoose(sourceContainer, ['cac:Party', 'Party', 'party'])) || sourceContainer;

  if (!sourceParty || typeof sourceParty !== 'object' || Array.isArray(sourceParty)) {
    return null;
  }

  const sourcePartyName =
    firstObject(getObjectValueLoose(sourceParty, ['cac:PartyName', 'PartyName', 'partyName'])) ||
    getObjectValueLoose(sourceParty, ['cac:PartyName', 'PartyName', 'partyName']);

  const partyName = readText(
    getObjectValueLoose(sourcePartyName, ['cbc:Name', 'Name', 'name']) || sourcePartyName
  );

  const postalAddress = normaliseAddressNode(
    getObjectValueLoose(sourceParty, ['cac:PostalAddress', 'PostalAddress', 'postalAddress'])
  );

  const normalisedParty = {};

  if (partyName) {
    normalisedParty['cac:PartyName'] = {
      'cbc:Name': partyName
    };
  }

  if (postalAddress) {
    normalisedParty['cac:PostalAddress'] = postalAddress;
  }

  if (!Object.keys(normalisedParty).length) {
    return null;
  }

  return {
    'cac:Party': normalisedParty
  };
}

function normaliseLineItemNode(lineItemNode, fulfilmentQuantity, destinationAddress) {
  const sourceLineItem = firstObject(lineItemNode) || lineItemNode;
  const normalisedLineItem =
    sourceLineItem && typeof sourceLineItem === 'object' && !Array.isArray(sourceLineItem)
      ? { ...sourceLineItem }
      : {};

  const lineId = readText(getObjectValueLoose(normalisedLineItem, ['cbc:ID', 'ID', 'id']));
  if (lineId) {
    normalisedLineItem['cbc:ID'] = lineId;
  }

  const quantityNode = getObjectValueLoose(normalisedLineItem, [
    'cbc:Quantity',
    'Quantity',
    'quantity',
    'cbc:RequestedQuantity',
    'RequestedQuantity',
    'requestedQuantity'
  ]);
  normalisedLineItem['cbc:Quantity'] = writeXmlQuantity(quantityNode, fulfilmentQuantity);

  const itemNode = firstObject(getObjectValueLoose(normalisedLineItem, ['cac:Item', 'Item', 'item']));
  if (itemNode) {
    normalisedLineItem['cac:Item'] = itemNode;
  }

  const sourceDeliveryNode = firstObject(
    getObjectValueLoose(normalisedLineItem, ['cac:Delivery', 'Delivery', 'delivery'])
  );

  const normalisedDestinationAddress = normaliseAddressNode(destinationAddress) || destinationAddress;
  const normalisedDelivery = normaliseDeliveryNode(sourceDeliveryNode) || {};

  if (normalisedDestinationAddress) {
    normalisedDelivery['cac:DeliveryAddress'] = normalisedDestinationAddress;
  }

  if (!normalisedDelivery['cac:DeliveryAddress']) {
    const inlineAddress = getObjectValueLoose(normalisedLineItem, ['cac:DeliveryAddress', 'DeliveryAddress', 'deliveryAddress']);
    const normalisedInlineAddress = normaliseAddressNode(inlineAddress) || inlineAddress;

    if (normalisedInlineAddress) {
      normalisedDelivery['cac:DeliveryAddress'] = normalisedInlineAddress;
    }
  }

  if (Object.keys(normalisedDelivery).length) {
    normalisedLineItem['cac:Delivery'] = normalisedDelivery;
  }

  return normalisedLineItem;
}

function createOrderXmlBuilder() {
  return new XMLBuilder({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    format: true,
    suppressEmptyNode: true
  });
}

function createXmlParser(arrayNodePaths = []) {
  const pathSet = new Set(arrayNodePaths);

  return new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    trimValues: true,
    isArray: (_name, jPath) => pathSet.has(jPath)
  });
}

function parseDespatchSummaryFromXml(despatchXml) {
  const parser = createXmlParser(['DespatchAdvice.cac:DespatchLine']);
  const parsedTree = parser.parse(despatchXml);
  const root =
    firstObject(parsedTree && parsedTree.DespatchAdvice) ||
    firstObject(parsedTree && parsedTree.despatchAdvice) ||
    {};

  const shipmentNode = firstObject(getObjectValueLoose(root, ['cac:Shipment', 'Shipment', 'shipment'])) || {};
  const shipmentDeliveryNode = firstObject(getObjectValueLoose(shipmentNode, ['cac:Delivery', 'Delivery', 'delivery'])) || {};
  const consignmentNode = firstObject(getObjectValueLoose(shipmentNode, ['cac:Consignment', 'Consignment', 'consignment'])) || {};
  const carrierParty = firstObject(getObjectValueLoose(consignmentNode, ['cac:CarrierParty', 'CarrierParty', 'carrierParty'])) || {};

  const lines = asArray(getObjectValueLoose(root, ['cac:DespatchLine', 'DespatchLine', 'despatchLine'])).map((lineNode, index) => {
    const itemNode = firstObject(getObjectValueLoose(lineNode, ['cac:Item', 'Item', 'item'])) || {};
    const deliveredQuantityNode = getObjectValueLoose(lineNode, ['cbc:DeliveredQuantity', 'DeliveredQuantity', 'deliveredQuantity']);
    const deliveredQuantity = parseXmlQuantity(deliveredQuantityNode);
    const lineId = readText(getObjectValueLoose(lineNode, ['cbc:ID', 'ID', 'id'])) || String(index + 1);
    const descriptions = asArray(getObjectValueLoose(itemNode, ['cbc:Description', 'Description', 'description']))
      .map((entry) => readText(entry))
      .filter(Boolean);
    const lineDeliveryNode = firstObject(getObjectValueLoose(lineNode, ['cac:Delivery', 'Delivery', 'delivery']));
    const destinationCandidates = [];

    collectAddressCandidates(destinationCandidates, getObjectValueLoose(lineNode, ['cac:DeliveryAddress', 'DeliveryAddress', 'deliveryAddress']));
    collectAddressCandidates(destinationCandidates, getObjectValueLoose(lineDeliveryNode, ['cac:DeliveryAddress', 'DeliveryAddress', 'deliveryAddress']));
    collectAddressCandidates(
      destinationCandidates,
      getObjectValueLoose(
        firstObject(getObjectValueLoose(lineDeliveryNode, ['cac:DeliveryLocation', 'DeliveryLocation', 'deliveryLocation'])),
        ['cac:Address', 'Address', 'address']
      )
    );
    collectAddressCandidates(destinationCandidates, getObjectValueLoose(shipmentDeliveryNode, ['cac:DeliveryAddress', 'DeliveryAddress', 'deliveryAddress']));

    const destinationOptions = normaliseAddressOptions(destinationCandidates);

    return {
      lineId,
      quantity: Number.isFinite(deliveredQuantity) ? deliveredQuantity : 0,
      itemName: readText(getObjectValueLoose(itemNode, ['cbc:Name', 'Name', 'name'])) || 'Line Item ' + String(index + 1),
      description: descriptions[0] || '',
      unitCode:
        deliveredQuantityNode &&
        typeof deliveredQuantityNode === 'object' &&
        !Array.isArray(deliveredQuantityNode)
          ? readText(deliveredQuantityNode['@_unitCode'])
          : '',
      orderLineId: readText(
        getObjectValueLoose(
          firstObject(getObjectValueLoose(lineNode, ['cac:OrderLineReference', 'OrderLineReference', 'orderLineReference'])),
          ['cbc:LineID', 'LineID', 'lineId']
        )
      ),
      destinationOptions
    };
  });

  return {
    displayId: readText(getObjectValueLoose(root, ['cbc:ID', 'ID', 'id'])) || readText(getObjectValueLoose(root, ['cbc:UUID', 'UUID', 'uuid'])),
    issueDate: readText(getObjectValueLoose(root, ['cbc:IssueDate', 'IssueDate', 'issueDate'])) || todayIsoDate(),
    orderDisplayId: readText(
      getObjectValueLoose(
        firstObject(getObjectValueLoose(root, ['cac:OrderReference', 'OrderReference', 'orderReference'])),
        ['cbc:ID', 'ID', 'id']
      )
    ),
    carrier: extractXmlPartyName(carrierParty) || 'Unassigned',
    trackingNo: readText(getObjectValueLoose(consignmentNode, ['cbc:ID', 'ID', 'id'])) || '-',
    supplier: extractXmlPartyName(getObjectValueLoose(root, ['cac:DespatchSupplierParty', 'DespatchSupplierParty', 'despatchSupplierParty'])),
    buyer: extractXmlPartyName(getObjectValueLoose(root, ['cac:DeliveryCustomerParty', 'DeliveryCustomerParty', 'deliveryCustomerParty'])),
    lines
  };
}

function parseInvoiceSummaryFromXml(invoiceXml) {
  const parser = createXmlParser(['Invoice.cac:InvoiceLine']);
  const parsedTree = parser.parse(invoiceXml);
  const root = firstObject(parsedTree && parsedTree.Invoice) || {};

  const legalMonetaryTotalNode = firstObject(root['cac:LegalMonetaryTotal']) || {};
  const payableAmount = readNumber(legalMonetaryTotalNode['cbc:PayableAmount']);

  return {
    displayId: readText(root['cbc:ID']) || readText(root['cbc:UUID']),
    issueDate: readText(root['cbc:IssueDate']) || todayIsoDate(),
    buyer: extractXmlPartyName(root['cac:AccountingCustomerParty']),
    total: Number.isFinite(payableAmount) ? payableAmount : 0
  };
}

function summariseDespatchDestinations(despatchDoc) {
  const labels = new Set();
  const lines = Array.isArray(despatchDoc && despatchDoc.lines) ? despatchDoc.lines : [];

  lines.forEach((line) => {
    if (Array.isArray(line && line.destinationOptions)) {
      line.destinationOptions.forEach((option) => {
        const label = readText(option && (option.label || option.key));
        if (label) {
          labels.add(label);
        }
      });
    }

    const inlineDestination = readText(line && line.destination);
    if (inlineDestination) {
      labels.add(inlineDestination);
    }
  });

  if (labels.size > 0) {
    return Array.from(labels).join(', ');
  }

  const fallbackDestination = readText(despatchDoc && despatchDoc.destination);
  return fallbackDestination || '-';
}

function mapOrderSummary(orderDoc) {
  return {
    uuid: orderDoc._id,
    displayId: orderDoc.displayId || orderDoc._id,
    buyer: orderDoc.buyer || 'Unknown Buyer',
    supplier: orderDoc.supplier || 'Unknown Supplier',
    lineItems: Number(orderDoc.lineItems) || 0,
    status: orderDoc.status || 'Pending',
    issueDate: orderDoc.issueDate || '',
    updatedAt: toUnix(orderDoc.updatedAt || orderDoc.createdAt)
  };
}

function mapOrderDetail(orderDoc) {
  const persistedOrderLines = Array.isArray(orderDoc.orderLines) ? orderDoc.orderLines : [];
  let orderLines = persistedOrderLines;

  const hasResolvedLineData = persistedOrderLines.some((line, index) => {
    const requestedQuantity = Number(line && line.requestedQuantity);
    const unitPrice = Number(line && line.unitPrice);
    const itemName = readText(line && line.itemName);
    const defaultItemName = 'Line Item ' + String(index + 1);
    const destinationOptions = Array.isArray(line && line.destinationOptions) ? line.destinationOptions : [];

    return (
      (Number.isFinite(requestedQuantity) && requestedQuantity > 0) ||
      (Number.isFinite(unitPrice) && unitPrice > 0) ||
      (itemName && itemName !== defaultItemName) ||
      destinationOptions.length > 0 ||
      Boolean(readText(line && line.description))
    );
  });

  if (!hasResolvedLineData) {
    const xml = readText(orderDoc.generatedOrderXml || orderDoc.xml);
    if (xml) {
      try {
        const snapshot = buildOrderSnapshotFromXml(xml);
        const parsedOrderLines = Array.isArray(snapshot && snapshot.orderLines) ? snapshot.orderLines : [];

        if (parsedOrderLines.length > 0) {
          orderLines = parsedOrderLines;
        }
      } catch (_error) {
        orderLines = persistedOrderLines;
      }
    }
  }

  return {
    ...mapOrderSummary(orderDoc),
    xml: orderDoc.generatedOrderXml || orderDoc.xml || '',
    orderLines
  };
}

function mapDespatchSummary(despatchDoc) {
  const lines = Array.isArray(despatchDoc && despatchDoc.lines) ? despatchDoc.lines : [];

  return {
    uuid: despatchDoc._id,
    displayId: despatchDoc.displayId || despatchDoc._id,
    orderDisplayId: despatchDoc.orderDisplayId || '',
    orderUuid: despatchDoc.orderUuid || '',
    carrier: despatchDoc.carrier || 'Unassigned',
    trackingNo: despatchDoc.trackingNo || '-',
    status: despatchDoc.status || 'Shipped',
    issueDate: despatchDoc.issueDate || '',
    lineItems: Number(despatchDoc.lineItems) || lines.length || 0,
    destination: summariseDespatchDestinations(despatchDoc),
    updatedAt: toUnix(despatchDoc.updatedAt || despatchDoc.createdAt)
  };
}

function mapDespatchDetail(despatchDoc) {
  return {
    ...mapDespatchSummary(despatchDoc),
    xml: despatchDoc.despatchXml || despatchDoc.xml || '',
    lines: Array.isArray(despatchDoc.lines) ? despatchDoc.lines : []
  };
}

function mapInvoiceSummary(invoiceDoc) {
  return {
    uuid: invoiceDoc._id,
    displayId: invoiceDoc.displayId || invoiceDoc._id,
    despatchDisplayId: invoiceDoc.despatchDisplayId || '',
    despatchUuid: invoiceDoc.despatchUuid || '',
    buyer: invoiceDoc.buyer || 'Unknown Buyer',
    total: Number(invoiceDoc.total) || 0,
    issueDate: invoiceDoc.issueDate || '',
    status: invoiceDoc.status || 'Issued',
    updatedAt: toUnix(invoiceDoc.updatedAt || invoiceDoc.createdAt)
  };
}

function mapInvoiceDetail(invoiceDoc) {
  return {
    ...mapInvoiceSummary(invoiceDoc),
    xml: invoiceDoc.invoiceXml || invoiceDoc.xml || ''
  };
}

function validateOrderCreateBody(body) {
  const errors = [];

  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { errors: ['Request body must be a JSON object.'] };
  }

  const data = firstObject(body.data);
  if (!data) {
    errors.push('Missing required field data (Order payload).');
  }

  const sellerPartyId = typeof body.sellerPartyId === 'string' ? body.sellerPartyId.trim() : '';
  if (
    body.sellerPartyId !== undefined &&
    body.sellerPartyId !== null &&
    typeof body.sellerPartyId !== 'string'
  ) {
    errors.push('sellerPartyId must be a string when provided.');
  }

  const supplierAbn = typeof body.supplierAbn === 'string' ? body.supplierAbn.trim() : '';
  const customerAbn = typeof body.customerAbn === 'string' ? body.customerAbn.trim() : '';

  if (data) {
    if (!readText(data.ID)) {
      errors.push('data.ID is required.');
    }

    const issueDate = readText(data.IssueDate);
    if (!issueDate || !isIsoDate(issueDate)) {
      errors.push('data.IssueDate must be a valid ISO date in YYYY-MM-DD format.');
    }

    if (!extractPayloadPartyName(data.BuyerCustomerParty)) {
      errors.push('data.BuyerCustomerParty.Party.PartyName[0].Name is required.');
    }

    if (!extractPayloadPartyName(data.SellerSupplierParty)) {
      errors.push('data.SellerSupplierParty.Party.PartyName[0].Name is required.');
    }

    const buyerParty = firstObject(data.BuyerCustomerParty && data.BuyerCustomerParty.Party);
    const sellerParty = firstObject(data.SellerSupplierParty && data.SellerSupplierParty.Party);

    if (!buildChalksnifferAddress(buyerParty && buyerParty.PostalAddress)) {
      errors.push(
        'data.BuyerCustomerParty.Party.PostalAddress must include StreetName, CityName, PostalZone, and Country.IdentificationCode.'
      );
    }

    if (!buildChalksnifferAddress(sellerParty && sellerParty.PostalAddress)) {
      errors.push(
        'data.SellerSupplierParty.Party.PostalAddress must include StreetName, CityName, PostalZone, and Country.IdentificationCode.'
      );
    }

    const lines = asArray(data.OrderLine);
    if (!lines.length) {
      errors.push('data.OrderLine must include at least one line item.');
    }

    lines.forEach((lineNode, index) => {
      const lineItem = firstObject(lineNode && lineNode.LineItem);
      const lineLabel = 'data.OrderLine[' + index + ']';

      if (!lineItem) {
        errors.push(lineLabel + '.LineItem is required.');
        return;
      }

      if (!readText(lineItem.ID)) {
        errors.push(lineLabel + '.LineItem.ID is required.');
      }

      const quantity = parsePayloadQuantity(lineItem);
      if (!Number.isFinite(quantity) || quantity <= 0) {
        errors.push(lineLabel + '.LineItem.Quantity must be greater than 0.');
      }

      const destinations = getPayloadLineAddressOptions(data, lineItem);
      if (!destinations.length) {
        errors.push(lineLabel + ' must include a delivery address on the line or order.');
      }
    });
  }

  return {
    errors,
    data,
    sellerPartyId,
    supplierAbn,
    customerAbn
  };
}

function validateDespatchCreateBody(body) {
  const errors = [];

  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { errors: ['Request body must be a JSON object.'] };
  }

  const orderUuid = readText(body.orderUuid);
  if (!orderUuid || !isValidUuid(orderUuid)) {
    errors.push('orderUuid must be a valid UUID.');
  }

  const lineSelections = asArray(body.lineSelections)
    .map((selection) => firstObject(selection))
    .filter(Boolean)
    .map((selection) => ({
      lineId: readText(selection.lineId),
      fulfilmentQuantity: Number(selection.fulfilmentQuantity),
      destinationAddress: firstObject(selection.destinationAddress) || null
    }));

  if (!lineSelections.length) {
    errors.push('lineSelections must include at least one selected order line.');
  }

  lineSelections.forEach((selection, index) => {
    if (!selection.lineId) {
      errors.push('lineSelections[' + index + '].lineId is required.');
    }

    if (!Number.isFinite(selection.fulfilmentQuantity) || selection.fulfilmentQuantity <= 0) {
      errors.push('lineSelections[' + index + '].fulfilmentQuantity must be greater than 0.');
    }
  });

  return {
    errors,
    orderUuid,
    lineSelections
  };
}

function validateInvoiceCreateBody(body) {
  const errors = [];

  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { errors: ['Request body must be a JSON object.'] };
  }

  const despatchUuid = readText(body.despatchUuid);
  if (!despatchUuid || !isValidUuid(despatchUuid)) {
    errors.push('despatchUuid must be a valid UUID.');
  }

  const issueDate = readText(body.issueDate) || todayIsoDate();
  const dueDate = readText(body.dueDate) || issueDate;

  if (!isIsoDate(issueDate)) {
    errors.push('issueDate must be a valid ISO date in YYYY-MM-DD format.');
  }
  if (!isIsoDate(dueDate)) {
    errors.push('dueDate must be a valid ISO date in YYYY-MM-DD format.');
  }

  const currency = (readText(body.currency) || 'AUD').toUpperCase();
  const gstPercentRaw = body.gstPercent;
  const gstPercent =
    gstPercentRaw === undefined || gstPercentRaw === null || gstPercentRaw === ''
      ? currency === 'AUD'
        ? 10
        : 0
      : Number(gstPercentRaw);

  if (!Number.isFinite(gstPercent) || gstPercent < 0) {
    errors.push('gstPercent must be a number greater than or equal to 0.');
  }

  const defaultUnitPriceRaw = body.defaultUnitPrice;
  const defaultUnitPrice =
    defaultUnitPriceRaw === undefined || defaultUnitPriceRaw === null || defaultUnitPriceRaw === ''
      ? 1
      : Number(defaultUnitPriceRaw);

  if (!Number.isFinite(defaultUnitPrice) || defaultUnitPrice <= 0) {
    errors.push('defaultUnitPrice must be a number greater than 0.');
  }

  return {
    errors,
    despatchUuid,
    issueDate,
    dueDate,
    currency,
    gstPercent,
    defaultUnitPrice,
    supplierName: readText(body.supplierName),
    customerName: readText(body.customerName),
    supplierAbn: readText(body.supplierAbn),
    customerAbn: readText(body.customerAbn)
  };
}

function buildChalksnifferAddress(addressNode, fallbackCountryCode = '') {
  const address = firstObject(addressNode);
  if (!address) {
    return null;
  }

  const street = readText(
    address.StreetName ||
      address['cbc:StreetName'] ||
      firstObject(address.AddressLine)?.Line ||
      firstObject(address['cac:AddressLine'])?.['cbc:Line']
  );
  const city = readText(address.CityName || address['cbc:CityName']);
  const postalZone = readText(address.PostalZone || address['cbc:PostalZone']);

  const countryNode = firstObject(address.Country) || firstObject(address['cac:Country']) || firstObject(address.country);
  const countryCodeRaw = readText(
    (countryNode && (countryNode.IdentificationCode || countryNode['cbc:IdentificationCode'])) ||
      address.CountryCode ||
      address.countryCode ||
      fallbackCountryCode
  );

  if (!street || !city || !postalZone || !countryCodeRaw) {
    return null;
  }

  return {
    streetName: street,
    cityName: city,
    postalZone,
    country: countryCodeRaw.slice(0, 2).toUpperCase()
  };
}
function buildChalksnifferParty(partyNode, partyLabel) {
  const party = firstObject(partyNode && partyNode.Party);
  const partyName = extractPayloadPartyName(partyNode);
  const postalAddress = buildChalksnifferAddress(party && party.PostalAddress);

  if (!partyName || !postalAddress) {
    throw new Error(
      'Invalid ' +
        partyLabel +
        ' payload. Ensure PartyName and PostalAddress(StreetName, CityName, PostalZone, Country.IdentificationCode) are provided.'
    );
  }

  return {
    party: {
      partyName,
      postalAddress
    }
  };
}

function readLinePriceAmount(lineItem, quantity) {
  const priceNode = firstObject(lineItem && lineItem.Price);
  const explicitPriceAmount = readNumber(priceNode && (priceNode.PriceAmount || priceNode['cbc:PriceAmount']));
  if (Number.isFinite(explicitPriceAmount) && explicitPriceAmount >= 0) {
    return explicitPriceAmount;
  }

  const lineExtensionAmount = readNumber(lineItem && (lineItem.LineExtensionAmount || lineItem['cbc:LineExtensionAmount']));
  if (Number.isFinite(lineExtensionAmount) && Number.isFinite(quantity) && quantity > 0) {
    return lineExtensionAmount / quantity;
  }

  return 1;
}

function buildChalksnifferOrderPayload(orderData) {
  const issueDate = readText(orderData && orderData.IssueDate) || todayIsoDate();
  const documentCurrencyCode = (readText(orderData && orderData.DocumentCurrencyCode) || 'AUD').toUpperCase();

  const orderLines = asArray(orderData && orderData.OrderLine).map((lineNode, index) => {
    const lineItem = firstObject(lineNode && lineNode.LineItem) || {};
    const itemNode = firstObject(lineItem.Item) || {};
    const descriptions = asArray(itemNode.Description)
      .map((entry) => readText(entry))
      .filter(Boolean);

    const quantityRaw = Number(lineItem.Quantity);
    const quantity = Number.isFinite(quantityRaw) && quantityRaw > 0 ? quantityRaw : 1;
    const priceAmount = roundCurrency(readLinePriceAmount(lineItem, quantity));

    const chalkLineItem = {
      id: readText(lineItem.ID) || String(index + 1),
      quantity,
      price: {
        priceAmount,
        currencyID: documentCurrencyCode
      },
      item: {
        name: readText(itemNode.Name) || 'Line Item ' + String(index + 1)
      }
    };

    if (descriptions[0]) {
      chalkLineItem.item.description = descriptions[0];
    }

    const unitCode =
      lineItem &&
      lineItem.Quantity &&
      typeof lineItem.Quantity === 'object' &&
      !Array.isArray(lineItem.Quantity)
        ? readText(lineItem.Quantity['@_unitCode'] || lineItem.Quantity.unitCode)
        : '';

    if (unitCode) {
      chalkLineItem.unitCode = unitCode;
    }

    const destinations = getPayloadLineAddressOptions(orderData, lineItem);
    if (destinations.length > 0) {
      const deliveryAddress = buildChalksnifferAddress(destinations[0].address);
      if (deliveryAddress) {
        chalkLineItem.delivery = {
          deliveryAddress
        };
      }
    }

    return {
      lineItem: chalkLineItem
    };
  });

  const lineExtensionAmount = roundCurrency(
    orderLines.reduce((accumulator, line) => {
      const lineItem = firstObject(line && line.lineItem) || {};
      const quantity = Number(lineItem.quantity) || 0;
      const priceAmount = Number(firstObject(lineItem.price)?.priceAmount || 0);
      return accumulator + quantity * priceAmount;
    }, 0)
  );

  return {
    id: readText(orderData && orderData.ID) || randomUUID(),
    issueDate,
    documentCurrencyCode,
    buyerCustomerParty: buildChalksnifferParty(orderData && orderData.BuyerCustomerParty, 'buyerCustomerParty'),
    sellerSupplierParty: buildChalksnifferParty(orderData && orderData.SellerSupplierParty, 'sellerSupplierParty'),
    orderLines,
    anticipatedMonetaryTotal: {
      lineExtensionAmount,
      taxExclusiveAmount: lineExtensionAmount,
      taxInclusiveAmount: lineExtensionAmount,
      allowanceTotalAmount: 0,
      chargeTotalAmount: 0,
      payableAmount: lineExtensionAmount
    }
  };
}

async function postJsonForXmlResponse(url, payload, requestLabel, requestHeaders = {}) {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...requestHeaders
    },
    body: JSON.stringify(payload)
  });

  const responseText = await response.text();

  if (!response.ok) {
    const errorSuffix = responseText ? ': ' + responseText.slice(0, 400) : '';
    throw new Error(requestLabel + ' failed with status ' + response.status + errorSuffix);
  }

  if (!responseText || !responseText.trim()) {
    throw new Error(requestLabel + ' failed: empty XML response.');
  }

  return responseText;
}

function resolveUrl(baseUrl, urlValue) {
  const rawUrl = readText(urlValue);
  if (!rawUrl) {
    return '';
  }

  try {
    return new URL(rawUrl, baseUrl).toString();
  } catch (_error) {
    return '';
  }
}

function extractXmlUrl(payload) {
  const dataNode = firstObject(payload && payload.data);
  const orderNode = firstObject(payload && payload.order);

  return (
    readText(payload && payload.xmlUrl) ||
    readText(payload && payload.ublXmlUrl) ||
    readText(dataNode && dataNode.xmlUrl) ||
    readText(dataNode && dataNode.ublXmlUrl) ||
    readText(orderNode && orderNode.xmlUrl) ||
    readText(orderNode && orderNode.ublXmlUrl) ||
    readText(payload && payload.url)
  );
}

function extractXmlString(payload) {
  const dataNode = firstObject(payload && payload.data);
  const orderNode = firstObject(payload && payload.order);

  const xmlValue =
    readText(payload && payload.ublXml) ||
    readText(payload && payload.xml) ||
    readText(dataNode && dataNode.ublXml) ||
    readText(dataNode && dataNode.xml) ||
    readText(orderNode && orderNode.ublXml) ||
    readText(orderNode && orderNode.xml);

  return xmlValue.startsWith('<') ? xmlValue : '';
}

function parseJsonSafe(textValue) {
  try {
    return JSON.parse(textValue);
  } catch (_error) {
    return null;
  }
}

function normalizeAuthHeaderValue(value) {
  const trimmed = readText(value).replace(/^Authorization\s*:\s*/i, '').trim();
  return trimmed;
}

function normalizeChalksnifferUrl(urlValue) {
  const rawUrl = readText(urlValue);
  if (!rawUrl) {
    return '';
  }

  try {
    const parsed = new URL(rawUrl);
    if (parsed.hostname.toLowerCase() === 'chalksniffer.com') {
      parsed.hostname = 'www.chalksniffer.com';
    }
    return parsed.toString();
  } catch (_error) {
    return rawUrl;
  }
}

async function postChalksnifferOrderForXmlResponse(url, payload, requestLabel, apiTokenValue) {
  const normalizedCreateUrl = normalizeChalksnifferUrl(url);
  const normalizedApiToken = normalizeAuthHeaderValue(apiTokenValue);

  const headers = {
    'Content-Type': 'application/json'
  };

  if (normalizedApiToken) {
    headers.Authorization = normalizedApiToken;
  }

  const createResponse = await fetch(normalizedCreateUrl, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload)
  });

  const createResponseText = await createResponse.text();

  if (!createResponse.ok) {
    const errorSuffix = createResponseText ? ': ' + createResponseText.slice(0, 400) : '';
    throw new Error(requestLabel + ' failed with status ' + createResponse.status + errorSuffix);
  }

  if (!createResponseText || !createResponseText.trim()) {
    throw new Error(requestLabel + ' failed: empty response.');
  }

  const trimmedCreateResponse = createResponseText.trim();
  if (trimmedCreateResponse.startsWith('<')) {
    return trimmedCreateResponse;
  }

  const createPayload = parseJsonSafe(trimmedCreateResponse);
  if (!createPayload) {
    throw new Error(requestLabel + ' failed: unable to parse JSON create response.');
  }

  const directXml = extractXmlString(createPayload);
  if (directXml) {
    return directXml;
  }

  const xmlUrl = extractXmlUrl(createPayload);
  if (!xmlUrl) {
    throw new Error(requestLabel + ' failed: response did not include xmlUrl.');
  }

  const resolvedXmlUrl = normalizeChalksnifferUrl(resolveUrl(normalizedCreateUrl, xmlUrl));
  if (!resolvedXmlUrl) {
    throw new Error(requestLabel + ' failed: could not resolve xmlUrl ' + xmlUrl + '.');
  }

  const xmlHeaders = {};
  if (normalizedApiToken) {
    xmlHeaders.Authorization = normalizedApiToken;
  }

  const xmlResponse = await fetch(resolvedXmlUrl, {
    method: 'GET',
    headers: xmlHeaders
  });

  const xmlResponseText = await xmlResponse.text();

  if (!xmlResponse.ok) {
    const errorSuffix = xmlResponseText ? ': ' + xmlResponseText.slice(0, 400) : '';
    throw new Error(requestLabel + ' XML fetch failed with status ' + xmlResponse.status + errorSuffix);
  }

  if (!xmlResponseText || !xmlResponseText.trim()) {
    throw new Error(requestLabel + ' XML fetch failed: empty response.');
  }

  const trimmedXmlResponse = xmlResponseText.trim();
  if (trimmedXmlResponse.startsWith('<')) {
    return trimmedXmlResponse;
  }

  const xmlPayload = parseJsonSafe(trimmedXmlResponse);
  if (xmlPayload) {
    const nestedXml = extractXmlString(xmlPayload);
    if (nestedXml) {
      return nestedXml;
    }
  }

  throw new Error(requestLabel + ' XML fetch returned a non-XML payload.');
}

function buildOrderSnapshotFromXml(orderXml, fallbackData) {
  const parsedTree = parseOrderXml(orderXml);
  const orderNode = firstObject(parsedTree && parsedTree.Order);

  if (!orderNode) {
    throw new Error('Generated Order XML did not include an Order root element.');
  }

  const lineSnapshots = buildXmlLineSnapshots(orderNode);

  return {
    displayId: readText(getObjectValueLoose(orderNode, ['cbc:ID', 'ID', 'id'])) || readText(fallbackData && fallbackData.ID),
    issueDate:
      readText(getObjectValueLoose(orderNode, ['cbc:IssueDate', 'IssueDate', 'issueDate'])) ||
      readText(fallbackData && fallbackData.IssueDate),
    buyer:
      extractXmlPartyName(getObjectValueLoose(orderNode, ['cac:BuyerCustomerParty', 'BuyerCustomerParty', 'buyerCustomerParty'])) ||
      extractPayloadPartyName(fallbackData && fallbackData.BuyerCustomerParty),
    supplier:
      extractXmlPartyName(getObjectValueLoose(orderNode, ['cac:SellerSupplierParty', 'SellerSupplierParty', 'sellerSupplierParty'])) ||
      extractPayloadPartyName(fallbackData && fallbackData.SellerSupplierParty),
    orderLines: lineSnapshots
  };
}

function buildLineIdCandidates(lineIdValue) {
  const lineId = readText(lineIdValue);
  if (!lineId) {
    return [];
  }

  const candidates = new Set([lineId]);

  const linePrefixMatch = /^LINE-(\d+)$/i.exec(lineId);
  if (linePrefixMatch) {
    const numericPart = linePrefixMatch[1];
    const normalizedNumber = String(Number(numericPart));

    candidates.add(numericPart);
    candidates.add(normalizedNumber);
    candidates.add('LINE-' + normalizedNumber.padStart(3, '0'));
  }

  const numericMatch = /^\d+$/.exec(lineId);
  if (numericMatch) {
    const normalizedNumber = String(Number(lineId));

    candidates.add(normalizedNumber);
    candidates.add('LINE-' + normalizedNumber.padStart(3, '0'));
  }

  return Array.from(candidates);
}

function buildOrderLineMap(parsedOrderTree) {
  const orderNode = firstObject(parsedOrderTree && parsedOrderTree.Order);
  const lineNodes = getOrderLineNodes(orderNode);

  const lineMap = new Map();
  const lineEntries = [];

  lineNodes.forEach((lineNode, index) => {
    const lineItem = getLineItemNode(lineNode) || {};
    const lineId = readText(getObjectValueLoose(lineItem, ['cbc:ID', 'ID', 'id'])) || 'LINE-' + String(index + 1).padStart(3, '0');
    const quantity = parseXmlQuantity(getLineQuantityNode(lineItem));

    const lineEntry = {
      lineNode,
      lineItem,
      requestedQuantity: Number.isFinite(quantity) ? quantity : 0
    };

    lineEntries.push(lineEntry);

    buildLineIdCandidates(lineId).forEach((candidate) => {
      if (!lineMap.has(candidate)) {
        lineMap.set(candidate, lineEntry);
      }
    });
  });

  return {
    lineMap,
    lineEntries
  };
}

function buildSelectedOrderXml(parsedOrderTree, lineSelections, fallbackOrderLines = []) {
  const orderNode = firstObject(parsedOrderTree && parsedOrderTree.Order);
  if (!orderNode) {
    throw new Error('Invalid base order XML.');
  }

  const { lineMap, lineEntries } = buildOrderLineMap(parsedOrderTree);
  const fallbackQuantityByLineId = new Map();

  asArray(fallbackOrderLines).forEach((fallbackLine, index) => {
    const fallbackLineId = readText(fallbackLine && fallbackLine.lineId);
    const fallbackRequestedQuantity = Number(fallbackLine && fallbackLine.requestedQuantity);

    if (!fallbackLineId || !Number.isFinite(fallbackRequestedQuantity) || fallbackRequestedQuantity <= 0) {
      return;
    }

    fallbackQuantityByLineId.set(fallbackLineId, fallbackRequestedQuantity);

    if (!fallbackQuantityByLineId.has(String(index + 1))) {
      fallbackQuantityByLineId.set(String(index + 1), fallbackRequestedQuantity);
    }
  });

  const selectedLineNodes = [];
  const seenLineIds = new Set();

  lineSelections.forEach((selection, selectionIndex) => {
    if (seenLineIds.has(selection.lineId)) {
      throw new Error('Duplicate lineId in selection: ' + selection.lineId + '.');
    }
    seenLineIds.add(selection.lineId);

    const sourceLine = buildLineIdCandidates(selection.lineId)
      .map((candidate) => lineMap.get(candidate))
      .find(Boolean) || lineEntries[selectionIndex] || null;

    if (!sourceLine) {
      throw new Error('Selected line does not exist on base order: ' + selection.lineId + '.');
    }

    if (!Number.isFinite(sourceLine.requestedQuantity) || sourceLine.requestedQuantity <= 0) {
      const fallbackQuantity = buildLineIdCandidates(selection.lineId)
        .map((candidate) => fallbackQuantityByLineId.get(candidate))
        .find((value) => Number.isFinite(value) && value > 0) ||
        fallbackQuantityByLineId.get(String(selectionIndex + 1));

      if (Number.isFinite(fallbackQuantity) && fallbackQuantity > 0) {
        sourceLine.requestedQuantity = fallbackQuantity;
      }
    }

    if (selection.fulfilmentQuantity > sourceLine.requestedQuantity) {
      throw new Error(
        'Fulfilment quantity for line ' + selection.lineId + ' exceeds requested quantity (' +
          sourceLine.requestedQuantity +
          ').'
      );
    }

    const clonedLineNode = JSON.parse(JSON.stringify(sourceLine.lineNode));
    const clonedLineItem = getLineItemNode(clonedLineNode) || {};
    const normalisedLineItem = normaliseLineItemNode(
      clonedLineItem,
      selection.fulfilmentQuantity,
      selection.destinationAddress
    );

    selectedLineNodes.push({
      ...clonedLineNode,
      'cac:LineItem': normalisedLineItem
    });
  });

  if (!selectedLineNodes.length) {
    throw new Error('No valid order lines were selected for despatch generation.');
  }

  const normalisedOrderNode = {
    ...orderNode,
    'cac:OrderLine': selectedLineNodes
  };

  const orderId = getObjectValueLoose(orderNode, ['cbc:ID', 'ID', 'id']);
  if (readText(orderId)) {
    normalisedOrderNode['cbc:ID'] = orderId;
  }

  const orderUuid = getObjectValueLoose(orderNode, ['cbc:UUID', 'UUID', 'uuid']);
  if (readText(orderUuid)) {
    normalisedOrderNode['cbc:UUID'] = orderUuid;
  }

  const salesOrderId = getObjectValueLoose(orderNode, ['cbc:SalesOrderID', 'SalesOrderID', 'salesOrderId']);
  if (readText(salesOrderId)) {
    normalisedOrderNode['cbc:SalesOrderID'] = salesOrderId;
  }

  const issueDate = getObjectValueLoose(orderNode, ['cbc:IssueDate', 'IssueDate', 'issueDate']);
  if (readText(issueDate)) {
    normalisedOrderNode['cbc:IssueDate'] = issueDate;
  }

  const buyerCustomerParty = normalisePartyNode(
    getObjectValueLoose(orderNode, ['cac:BuyerCustomerParty', 'BuyerCustomerParty', 'buyerCustomerParty'])
  );
  if (buyerCustomerParty) {
    normalisedOrderNode['cac:BuyerCustomerParty'] = buyerCustomerParty;
  }

  const sellerSupplierParty = normalisePartyNode(
    getObjectValueLoose(orderNode, ['cac:SellerSupplierParty', 'SellerSupplierParty', 'sellerSupplierParty'])
  );
  if (sellerSupplierParty) {
    normalisedOrderNode['cac:SellerSupplierParty'] = sellerSupplierParty;
  }

  let orderDelivery = normaliseDeliveryNode(
    getObjectValueLoose(orderNode, ['cac:Delivery', 'Delivery', 'delivery'])
  );

  if (!orderDelivery) {
    const fallbackLineItem = getLineItemNode(selectedLineNodes[0]);
    orderDelivery = normaliseDeliveryNode(
      getObjectValueLoose(fallbackLineItem, ['cac:Delivery', 'Delivery', 'delivery'])
    );
  }

  if (orderDelivery) {
    normalisedOrderNode['cac:Delivery'] = orderDelivery;
  }

  parsedOrderTree.Order = normalisedOrderNode;

  const builder = createOrderXmlBuilder();
  return builder.build(parsedOrderTree);
}

function deriveInvoiceLinesFromDespatch(despatchDoc, defaultUnitPrice) {
  let sourceLines = Array.isArray(despatchDoc.lines) ? despatchDoc.lines : [];

  if (!sourceLines.length && despatchDoc.despatchXml) {
    const parsedSummary = parseDespatchSummaryFromXml(despatchDoc.despatchXml);
    sourceLines = parsedSummary.lines;
  }

  return sourceLines
    .map((line, index) => {
      const quantity = Number(line.quantity);
      if (!Number.isFinite(quantity) || quantity <= 0) {
        return null;
      }

      const unitPrice = roundCurrency(defaultUnitPrice);
      const lineTotal = roundCurrency(quantity * unitPrice);

      return {
        lineId: readText(line.lineId) || String(index + 1),
        description: readText(line.description) || readText(line.itemName) || 'Line Item ' + String(index + 1),
        quantity,
        unitPrice,
        lineTotal
      };
    })
    .filter(Boolean);
}

function calculateInvoiceTotals(invoiceLines, gstPercent) {
  const linesTotal = roundCurrency(
    invoiceLines.reduce((accumulator, line) => accumulator + Number(line.lineTotal || 0), 0)
  );

  const gstAmount = roundCurrency(linesTotal * (gstPercent / 100));
  const totalAmount = roundCurrency(linesTotal + gstAmount);

  return {
    linesTotal,
    gstAmount,
    totalAmount
  };
}
module.exports = {
  nowUnix,
  todayIsoDate,
  readText,
  sendError,
  sendNotFound,
  mapOrderSummary,
  mapOrderDetail,
  mapDespatchSummary,
  mapDespatchDetail,
  mapInvoiceSummary,
  mapInvoiceDetail,
  validateOrderCreateBody,
  validateDespatchCreateBody,
  validateInvoiceCreateBody,
  buildChalksnifferOrderPayload,
  postJsonForXmlResponse,
  postChalksnifferOrderForXmlResponse,
  buildOrderSnapshotFromXml,
  buildPayloadLineSnapshots,
  buildSelectedOrderXml,
  parseDespatchSummaryFromXml,
  parseInvoiceSummaryFromXml,
  deriveInvoiceLinesFromDespatch,
  calculateInvoiceTotals
};
