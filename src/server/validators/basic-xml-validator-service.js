const { validate, version } = require('uuid');

let libxml2ModulePromise;

async function getXmlDocumentClass() {
  if (!libxml2ModulePromise) {
    libxml2ModulePromise = import('libxml2-wasm');
  }
  const { XmlDocument } = await libxml2ModulePromise;
  return XmlDocument;
}

function getNodeContent(xmlDoc, xpath, namespaces) {
  const node = xmlDoc.get(xpath, namespaces);
  return node ? node.content.trim() : null;
}

function isValidUuid(value) {
  return typeof value === 'string' && validate(value);
}

class BasicXmlValidationError extends Error {
  constructor(errors) {
    super('XML validation failed');
    this.name = 'BasicXmlValidationError';
    this.errors = errors;
    this.statusCode = 400;
  }
}

module.exports = {
  getXmlDocumentClass,
  getNodeContent,
  isValidUuid,
  BasicXmlValidationError
};
