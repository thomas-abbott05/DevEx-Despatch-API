const { isValidUuid } = require('./basic-xml-validator-service');

const REQUIRED_ORDER_FIELDS = [
  'cbc:ID',
  'cac:Delivery',
  'cac:OrderLine'
];

async function validateOrder(parsedOrderTree) {
  const order = parsedOrderTree?.Order;

  if (!order || typeof order !== 'object') {
    return { success: false, errors: ['Invalid Order XML: Missing Order root element'] };
  }

  for (const field of REQUIRED_ORDER_FIELDS) {
    const value = order[field];
    const missing = value === undefined || value === null || value === '' ||
      (Array.isArray(value) && value.length === 0);
    if (missing) {
      return { success: false, errors: [`Invalid Order XML: Missing required field ${field}`] };
    }
  }

  if (order['cbc:UUID'] && !isValidUuid(order['cbc:UUID'])) {
    return { success: false, errors: [`Invalid UUID format in Order/cbc:UUID - ${order['cbc:UUID']}`] };
  }

  return {
    success: true,
    id: order['cbc:UUID'], // may be undefined if not provided
    orderId: order['cbc:ID'],
    salesOrderId: order['cbc:SalesOrderID'],
    issueDate: order['cbc:IssueDate']
  };
}

module.exports = {
  validateOrder
};