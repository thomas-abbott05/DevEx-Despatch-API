const { XMLParser } = require('fast-xml-parser');

// By default, fast-xml-parser parses a single child element as a plain object
// Add more array nodes that can have one element below
const ARRAY_NODE_PATHS = new Set([
  'Order.cac:OrderLine'
]);

function createOrderParser() {
  return new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    trimValues: true,
    isArray: (_name, jPath) => ARRAY_NODE_PATHS.has(jPath)
  });
}

function parseOrderXml(rawXml) {
  const parser = createOrderParser();
  const parsedOrderTree = parser.parse(rawXml);
  return parsedOrderTree;
}

module.exports = {
  parseOrderXml
};
