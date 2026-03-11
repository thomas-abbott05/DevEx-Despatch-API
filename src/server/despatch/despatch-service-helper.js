const fs = require('node:fs');
const path = require('node:path');

const DESPATCH_ADVICE_MOCK_TEMPLATE = fs.readFileSync(
  path.join(__dirname, 'mocks/despatch-advice-mock.xml'),
  'utf8'
);

function applyTagValue(xml, tagName, value) {
  if (!value) {
    return xml;
  }

  const pattern = new RegExp(`(<${tagName}>)([^<]*)(</${tagName}>)`);
  return xml.replace(pattern, `$1${value}$3`);
}

function applyOrderReferenceValue(xml, tagName, value) {
  if (!value) {
    return xml;
  }

  const pattern = new RegExp(`(<cac:OrderReference>[\\s\\S]*?<${tagName}>)([^<]*)(</${tagName}>)`);
  return xml.replace(pattern, `$1${value}$3`);
}

function buildMockDespatchAdviceXml(validationResult) {
  let despatchXml = DESPATCH_ADVICE_MOCK_TEMPLATE;
  despatchXml = applyTagValue(despatchXml, 'cbc:UUID', validationResult.id);
  despatchXml = applyOrderReferenceValue(despatchXml, 'cbc:ID', validationResult.orderId);
  despatchXml = applyOrderReferenceValue(despatchXml, 'cbc:SalesOrderID', validationResult.salesOrderId);
  despatchXml = applyOrderReferenceValue(despatchXml, 'cbc:IssueDate', validationResult.issueDate);
  return despatchXml;
}

module.exports = { 
    buildMockDespatchAdviceXml
};