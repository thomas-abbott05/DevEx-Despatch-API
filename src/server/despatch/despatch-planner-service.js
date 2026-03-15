function stableStringify(value) {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(',')}]`;
  }

  const keys = Object.keys(value).sort();
  const entries = keys.map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`);
  return `{${entries.join(',')}}`;
}

function getOrderDeliveryNode(orderNode) {
  const deliveryNode = orderNode['cac:Delivery'];
  if (Array.isArray(deliveryNode)) {
    return deliveryNode[0];
  }
  return deliveryNode;
}

function getLineQuantity(lineNode) {
  const quantityNode = lineNode?.['cac:LineItem']?.['cbc:Quantity'];

  if (quantityNode && typeof quantityNode === 'object' && !Array.isArray(quantityNode)) {
    return Number(quantityNode['#text']);
  }

  return Number(quantityNode);
}

function getLineId(lineNode, fallbackIndex) {
  const lineId = lineNode?.['cac:LineItem']?.['cbc:ID'];
  return lineId === undefined || lineId === null || lineId === '' ? `index-${fallbackIndex}` : String(lineId);
}

function getEffectiveDeliveryAddress(orderNode, lineNode) {
  return (
    lineNode?.['cac:LineItem']?.['cac:Delivery']?.['cac:DeliveryAddress'] ||
    getOrderDeliveryNode(orderNode)?.['cac:DeliveryAddress']
  );
}

function buildDespatchGroups(parsedOrderTree) {
  const orderNode = parsedOrderTree?.Order;

  if (!orderNode || typeof orderNode !== 'object') {
    throw new Error('Invalid order tree: Missing Order root');
  }

  const orderLines = orderNode['cac:OrderLine'];
  if (!Array.isArray(orderLines) || orderLines.length === 0) {
    throw new Error('Invalid order tree: Missing Order.cac:OrderLine array');
  }

  const deliveryNode = getOrderDeliveryNode(orderNode);
  const deliveryPeriod = deliveryNode?.['cac:RequestedDeliveryPeriod'];

  const groupsByAddress = new Map();

  orderLines.forEach((lineNode, index) => {
    const lineId = getLineId(lineNode, index);
    const quantityValue = getLineQuantity(lineNode);

    if (!Number.isFinite(quantityValue) || quantityValue <= 0) {
      throw new Error(`Invalid order line quantity for line ${lineId}: must be greater than 0`);
    }

    const deliveryAddress = getEffectiveDeliveryAddress(orderNode, lineNode);
    if (!deliveryAddress || typeof deliveryAddress !== 'object') {
      throw new Error(`Invalid order line ${lineId}: missing effective delivery address`);
    }

    // use custom stringify to ensure deterministic address keys
    const addressKey = stableStringify(deliveryAddress);

    if (!groupsByAddress.has(addressKey)) {
      groupsByAddress.set(addressKey, {
        deliveryAddress,
        deliveryPeriod,
        lines: []
      });
    }

    groupsByAddress.get(addressKey).lines.push(lineNode);
  });

  return Array.from(groupsByAddress.values());
}

module.exports = {
  buildDespatchGroups
};
