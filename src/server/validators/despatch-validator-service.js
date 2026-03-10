// Mock implementation of the despatch validator service
// In a real implementation, this would perform actual validation logic


// Implement basic exception for invalid XML with one error message for simplicity
class DespatchValidationError extends Error {
  constructor(errors) {
    super('Despatch advice validation failed');
    this.name = 'DespatchValidationError';
    this.errors = errors;
  }
}

async function validateDespatchAdvice(rawXml, metadata) {
  // Simulate validation logic
  if (!rawXml || typeof rawXml !== 'string' || rawXml.trim() === '') {
    return {
      success: false,
      errors: ['Invalid XML content']
    };
  }

  // Simulate successful validation
  return {
    success: true,
    errors: []
  };
}

module.exports = {
  validateDespatchAdvice,
  DespatchValidationError
};