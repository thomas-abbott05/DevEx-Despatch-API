const { getDespatchAdviceByAdviceId, getDespatchAdviceByOrderId } = require('./despatch-advice-service');
const { validateOrder } = require('../validators/order-xml-validator-service');
const { parseOrderXml } = require('./order-parser-service');
const { isValidUuid } = require('../validators/basic-xml-validator-service');

async function searchDespatchAdvice(req, res, apiKey, searchType) {
    const VALID_SEARCH_TYPES = ['order', 'advice-id'];
  if (!searchType || !VALID_SEARCH_TYPES.includes(searchType)) {
    return res.status(400).send({
      errors: [`Missing valid search-type parameter - must be one of: ${VALID_SEARCH_TYPES.join(', ')}`],
      "executed-at": Math.floor(Date.now() / 1000)
    });
  }
  const query = req.query['query'];
  if (!query) {
    return res.status(400).send({
      errors: ['Missing query parameter - must provide a value to search for'],
      "executed-at": Math.floor(Date.now() / 1000)
    });
  }
  // validate query format
  if (searchType === 'advice-id') {
    if (!isValidUuid(query)) {
      return res.status(400).send({
        errors: ['Invalid advice-id format - must be a valid UUID'],
        "executed-at": Math.floor(Date.now() / 1000)
      });
    }
    // search by advice ID
    const result = await getDespatchAdviceByAdviceId(apiKey, query);
    if (!result) {
      return res.status(404).send({
        errors: ['Despatch advice not found for provided advice-id'],
        "executed-at": Math.floor(Date.now() / 1000)
      });
    }
    return res.status(200).send({
      "despatch-advice": result.despatchXml,
      "advice-id": query,
      "executed-at": Math.floor(Date.now() / 1000)
    });
  } else if (searchType === 'order') {
    try {
      const parsedOrderTree = parseOrderXml(query);
      let result = await validateOrder(parsedOrderTree);
      if (!result.success) {
        return res.status(400).send({
          errors: result.errors,
          "executed-at": Math.floor(Date.now() / 1000)
        });
      }
      // search by order XML by extracting Order ID
      const orderId = result.orderId;
      if (!orderId) {
        return res.status(400).send({
          errors: ['Order XML must contain cbc:ID field to search by order'],
          "executed-at": Math.floor(Date.now() / 1000)
        });
      }
      result = await getDespatchAdviceByOrderId(apiKey, orderId);
      if (!result) {
        return res.status(404).send({
          errors: [`Despatch advice not found for provided order XML document - no matching order ID found for ${orderId}`],
          "executed-at": Math.floor(Date.now() / 1000)
        });
      }
      return res.status(200).send({
        "despatch-advice": result.despatchXml,
        "advice-id": result._id,
        "executed-at": Math.floor(Date.now() / 1000)
      });

    } catch (error) {
      return res.status(400).send({
        errors: [error.message],
        "executed-at": Math.floor(Date.now() / 1000)
      });
    }
  }
}

module.exports = {
  searchDespatchAdvice
};