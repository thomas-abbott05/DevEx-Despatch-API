const { isValidUuidV4 } = require('./basic-xml-validator-service');

// Commented out ones will be validated in XSD
const REQUIRED_ORDER_FIELDS = [
  'cbc:UUID',
  'cbc:ID',
  // 'cac:BuyerCustomerParty',
  // 'cac:SellerSupplierParty',
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

  if (!isValidUuidV4(order['cbc:UUID'])) {
    return { success: false, errors: ['Invalid UUID format in Order/cbc:UUID'] };
  }

  return {
    success: true,
    id: order['cbc:UUID'],
    orderId: order['cbc:ID'],
    salesOrderId: order['cbc:SalesOrderID'],
    issueDate: order['cbc:IssueDate']
  };
}

module.exports = {
  validateOrder
};