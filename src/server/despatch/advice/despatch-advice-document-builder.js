const { randomUUID } = require('node:crypto');

const DESPATCH_ADVICE_NAMESPACES = {
  '@_xmlns:cbc': 'urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2',
  '@_xmlns:cac': 'urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2',
  '@_xmlns': 'urn:oasis:names:specification:ubl:schema:xsd:DespatchAdvice-2'
};

function getTodayDate() {
  return new Date().toISOString().slice(0, 10);
}

function toQuantityNode(quantityNode, fallbackTextValue) {
  if (quantityNode && typeof quantityNode === 'object' && !Array.isArray(quantityNode)) {
    return {
      '#text': quantityNode['#text'],
      ...(quantityNode['@_unitCode'] ? { '@_unitCode': quantityNode['@_unitCode'] } : {})
    };
  }

  return {
    '#text': quantityNode !== undefined ? quantityNode : fallbackTextValue
  };
}

function buildBackorderQuantityNode(deliveredQuantityNode) {
  return {
    '#text': 0,
    ...(deliveredQuantityNode['@_unitCode'] ? { '@_unitCode': deliveredQuantityNode['@_unitCode'] } : {})
  };
}

function buildOrderReference(orderNode) {
  const orderReference = {
    'cbc:ID': orderNode['cbc:ID'],
    'cbc:UUID': orderNode['cbc:UUID'] || undefined, // include UUID if present in order, otherwise omit
    'cbc:IssueDate': orderNode['cbc:IssueDate']
  };

  if (orderNode['cbc:UUID']) { // uuid is optional in orders but if present should be included in despatch advice order reference
    orderReference['cbc:UUID'] = orderNode['cbc:UUID'];
  }

  if (orderNode['cbc:SalesOrderID']) {
    orderReference['cbc:SalesOrderID'] = orderNode['cbc:SalesOrderID'];
  }

  return orderReference;
}

function buildShipment(deliveryAddress, deliveryPeriod) {
  const deliveryNode = {
    'cac:DeliveryAddress': deliveryAddress
  };

  if (deliveryPeriod) {
    deliveryNode['cac:RequestedDeliveryPeriod'] = deliveryPeriod;
  }

  return {
    'cbc:ID': '1',
    'cac:Delivery': deliveryNode
  };
}

function buildDespatchLine(orderNode, lineNode, index) {
  const lineItem = lineNode?.['cac:LineItem'] || {};
  const lineId = lineItem['cbc:ID'] !== undefined ? String(lineItem['cbc:ID']) : String(index + 1);
  const deliveredQuantity = toQuantityNode(lineItem['cbc:Quantity'], 0);

  const orderLineReference = {
    'cbc:LineID': lineId,
    'cac:OrderReference': buildOrderReference(orderNode)
  };

  if (lineItem['cbc:SalesOrderID']) {
    orderLineReference['cbc:SalesOrderLineID'] = lineItem['cbc:SalesOrderID'];
  }

  const despatchLine = {
    'cbc:ID': lineId,
    'cbc:DeliveredQuantity': deliveredQuantity,
    'cbc:BackorderQuantity': buildBackorderQuantityNode(deliveredQuantity),
    'cac:OrderLineReference': orderLineReference
  };

  if (lineItem['cac:Item']) {
    despatchLine['cac:Item'] = lineItem['cac:Item'];
  }

  return despatchLine;
}

function buildDespatchAdviceDocument(parsedOrderTree, despatchGroup) {
  const orderNode = parsedOrderTree?.Order;

  if (!orderNode || typeof orderNode !== 'object') {
    throw new Error('Invalid order tree: Missing Order root');
  }

  if (!despatchGroup || typeof despatchGroup !== 'object') {
    throw new Error('Invalid despatch group: Missing group data');
  }

  if (!Array.isArray(despatchGroup.lines) || despatchGroup.lines.length === 0) {
    throw new Error('Invalid despatch group: Missing lines');
  }

  if (!despatchGroup.deliveryAddress || typeof despatchGroup.deliveryAddress !== 'object') {
    throw new Error('Invalid despatch group: Missing deliveryAddress');
  }

  const adviceUuid = randomUUID();
  const issueDate = getTodayDate();
  const orderReference = buildOrderReference(orderNode);

  return {
    DespatchAdvice: {
      ...DESPATCH_ADVICE_NAMESPACES,
      'cbc:UBLVersionID': '2.1',
      'cbc:ID': adviceUuid,
      'cbc:CopyIndicator': false,
      'cbc:UUID': adviceUuid,
      'cbc:IssueDate': issueDate,
      'cac:OrderReference': orderReference,
      'cac:DespatchSupplierParty': orderNode['cac:SellerSupplierParty'],
      'cac:DeliveryCustomerParty': orderNode['cac:BuyerCustomerParty'],
      'cac:Shipment': buildShipment(despatchGroup.deliveryAddress, despatchGroup.deliveryPeriod),
      'cac:DespatchLine': despatchGroup.lines.map((lineNode, index) =>
        buildDespatchLine(orderNode, lineNode, index)
      )
    }
  };
}

module.exports = {
  buildDespatchAdviceDocument
};
