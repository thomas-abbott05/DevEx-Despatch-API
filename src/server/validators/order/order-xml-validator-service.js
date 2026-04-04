const { isValidUuid } = require('../common/basic-xml-validator-service');
const { validateBuyerCustomerParty, validateSellerSupplierParty } = require('../common/common-schema-fields-validators');

const REQUIRED_ORDER_FIELDS = [
  'cbc:ID',
  'cac:Delivery',
  'cac:OrderLine',
  'cbc:IssueDate',
  'cac:BuyerCustomerParty',
  'cac:SellerSupplierParty'
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

  // validate buyer customer party
  const buyerCustomerPartyResult = validateBuyerCustomerParty(order['cac:BuyerCustomerParty']);
  if (!buyerCustomerPartyResult.success) {
    return buyerCustomerPartyResult;
  }

  // validate seller supplier party
  const sellerSupplierPartyResult = validateSellerSupplierParty(order['cac:SellerSupplierParty']);
  if (!sellerSupplierPartyResult.success) {
    return sellerSupplierPartyResult;
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