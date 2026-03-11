const fs = require('node:fs');
const path = require('node:path');

// Template is loaded once at module initialization to avoid repeated disk reads.
const DESPATCH_ADVICE_TEMPLATE = fs.readFileSync(
  path.join(__dirname, 'mocks/despatch-advice-mock.xml'),
  'utf8'
);

function replaceTagValue(xml, tagName, value) {
  if (!value) {
    return xml;
  }

  const pattern = new RegExp(`(<${tagName}>)([^<]*)(</${tagName}>)`);
  return xml.replace(pattern, `$1${value}$3`);
}

function replaceOrderReferenceTagValue(xml, tagName, value) {
  if (!value) {
    return xml;
  }

  const pattern = new RegExp(`(<cac:OrderReference>[\\s\\S]*?<${tagName}>)([^<]*)(</${tagName}>)`);
  return xml.replace(pattern, `$1${value}$3`);
}

function buildTemplatedDespatchAdviceXml(validatedOrder) {
  let despatchAdviceXml = DESPATCH_ADVICE_TEMPLATE;
  despatchAdviceXml = replaceTagValue(despatchAdviceXml, 'cbc:UUID', validatedOrder.id);
  despatchAdviceXml = replaceOrderReferenceTagValue(despatchAdviceXml, 'cbc:ID', validatedOrder.orderId);
  despatchAdviceXml = replaceOrderReferenceTagValue(despatchAdviceXml, 'cbc:SalesOrderID', validatedOrder.salesOrderId);
  despatchAdviceXml = replaceOrderReferenceTagValue(despatchAdviceXml, 'cbc:IssueDate', validatedOrder.issueDate);
  return despatchAdviceXml;
}

module.exports = {
  buildTemplatedDespatchAdviceXml
};