const { XMLBuilder } = require('fast-xml-parser');

function createXmlBuilder() {
  return new XMLBuilder({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    format: true,
    suppressEmptyNode: true
  });
}

function serializeDespatchAdvice(despatchAdviceDocument) {
  if (!despatchAdviceDocument || typeof despatchAdviceDocument !== 'object') {
    throw new Error('Invalid despatch advice document: expected object');
  }

  if (!despatchAdviceDocument.DespatchAdvice || typeof despatchAdviceDocument.DespatchAdvice !== 'object') {
    throw new Error('Invalid despatch advice document: missing DespatchAdvice root');
  }

  const builder = createXmlBuilder();
  return builder.build(despatchAdviceDocument);
}

module.exports = {
  serializeDespatchAdvice
};
