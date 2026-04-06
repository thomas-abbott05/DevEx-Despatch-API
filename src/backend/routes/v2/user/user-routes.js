const express = require('express');
const { randomUUID } = require('node:crypto');
const requireSessionAuth = require('../../../middleware/session-auth');
const { getDb } = require('../../../database');
const { parseOrderXml } = require('../../../despatch/order-parser-service');
const {
  createDespatchAdvice,
  getDespatchAdviceByAdviceId
} = require('../../../despatch/advice/despatch-advice-service');
const {
  nowUnix,
  todayIsoDate,
  readText,
  sendError,
  sendNotFound,
  mapOrderSummary,
  mapOrderDetail,
  mapDespatchSummary,
  mapDespatchDetail,
  mapInvoiceSummary,
  mapInvoiceDetail,
  validateOrderCreateBody,
  validateDespatchCreateBody,
  validateDespatchStatusUpdateBody,
  validateInvoiceCreateBody,
  validateInvoiceStatusUpdateBody,
  resolveInvoiceStatus,
  buildChalksnifferOrderPayload,
  postLastMinutePushInvoiceForXmlResponse,
  postChalksnifferOrderForXmlResponse,
  buildOrderSnapshotFromXml,
  buildPayloadLineSnapshots,
  buildSelectedOrderXml,
  parseDespatchSummaryFromXml,
  parseInvoiceSummaryFromXml,
  overwriteInvoiceXmlDocumentId,
  deriveInvoiceLinesFromDespatch,
  calculateInvoiceTotals
} = require('./user-routes-utilities');

const router = express.Router();

const CHALKSNIFFER_ORDER_CREATE_URL =
  process.env.CHALKSNIFFER_ORDER_CREATE_URL || 'https://www.chalksniffer.com/orders';
const LASTMINUTEPUSH_BASE_URL = 'https://lastminutepush.one';

const USER_ORDER_COLLECTION = 'user-orders';
const USER_DESPATCH_COLLECTION = 'user-despatch-advice';
const USER_INVOICE_COLLECTION = 'user-invoices';

const HOME_SUMMARY_LIMIT = 8;

function readQuantity(value) {
  const quantity = Number(value);
  return Number.isFinite(quantity) ? quantity : 0;
}

function roundCurrency(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

function buildProviderIdentifier(rawValue, fallbackPrefix) {
  const sanitized = readText(rawValue).replace(/[^A-Za-z0-9\-_]/g, '');
  if (sanitized) {
    return sanitized;
  }

  return fallbackPrefix + '-' + nowUnix();
}

function mapLastMinutePushInvoiceStatus(value) {
  const normalized = readText(value).toLowerCase();

  if (normalized === 'paid') {
    return 'Paid';
  }

  if (normalized === 'overdue') {
    return 'Overdue';
  }

  return 'Issued';
}

function deriveOrderPaymentSummary(invoiceSummaries) {
  const invoices = Array.isArray(invoiceSummaries) ? invoiceSummaries : [];
  const invoiceCount = invoices.length;
  const paidInvoiceCount = invoices.filter(
    (invoiceSummary) => readText(invoiceSummary && invoiceSummary.status) === 'Paid'
  ).length;
  const outstandingInvoiceCount = Math.max(invoiceCount - paidInvoiceCount, 0);

  if (!invoiceCount) {
    return {
      status: 'Not Paid',
      paidInFull: false,
      hasInvoices: false,
      invoiceCount,
      paidInvoiceCount,
      outstandingInvoiceCount
    };
  }

  if (!outstandingInvoiceCount) {
    return {
      status: 'Paid',
      paidInFull: true,
      hasInvoices: true,
      invoiceCount,
      paidInvoiceCount,
      outstandingInvoiceCount
    };
  }

  if (paidInvoiceCount > 0) {
    return {
      status: 'Partially Paid',
      paidInFull: false,
      hasInvoices: true,
      invoiceCount,
      paidInvoiceCount,
      outstandingInvoiceCount
    };
  }

  return {
    status: 'Not Paid',
    paidInFull: false,
    hasInvoices: true,
    invoiceCount,
    paidInvoiceCount,
    outstandingInvoiceCount
  };
}

function buildLineIdCandidates(lineIdValue) {
  const lineId = readText(lineIdValue);
  if (!lineId) {
    return [];
  }

  const candidates = new Set([lineId]);
  const linePrefixMatch = /^LINE-(\d+)$/i.exec(lineId);

  if (linePrefixMatch) {
    const numericPart = linePrefixMatch[1];
    const normalizedNumber = String(Number(numericPart));

    candidates.add(numericPart);
    candidates.add(normalizedNumber);
    candidates.add('LINE-' + normalizedNumber.padStart(3, '0'));
  }

  const numericMatch = /^\d+$/.exec(lineId);
  if (numericMatch) {
    const normalizedNumber = String(Number(lineId));

    candidates.add(normalizedNumber);
    candidates.add('LINE-' + normalizedNumber.padStart(3, '0'));
  }

  return Array.from(candidates);
}

function readOrderLineUnitPrice(orderLine, fallbackUnitPrice) {
  const directUnitPrice = Number(orderLine && orderLine.unitPrice);
  if (Number.isFinite(directUnitPrice) && directUnitPrice > 0) {
    return roundCurrency(directUnitPrice);
  }

  const nestedUnitPrice = Number(
    orderLine &&
      orderLine.lineItem &&
      orderLine.lineItem.price &&
      orderLine.lineItem.price.priceAmount
  );

  if (Number.isFinite(nestedUnitPrice) && nestedUnitPrice > 0) {
    return roundCurrency(nestedUnitPrice);
  }

  return roundCurrency(fallbackUnitPrice);
}

function deriveInvoiceLinesFromOrder(orderDoc, fallbackUnitPrice) {
  const mappedOrder = mapOrderDetail(orderDoc);
  const orderLines = Array.isArray(mappedOrder && mappedOrder.orderLines) ? mappedOrder.orderLines : [];

  return orderLines
    .map((line, index) => {
      const quantity = readQuantity(line && line.requestedQuantity);
      if (quantity <= 0) {
        return null;
      }

      const lineId = readText(line && line.lineId) || String(index + 1);
      const description =
        readText(line && line.description) ||
        readText(line && line.itemName) ||
        'Line Item ' + String(index + 1);
      const unitPrice = readOrderLineUnitPrice(line, fallbackUnitPrice);
      const lineTotal = roundCurrency(quantity * unitPrice);

      return {
        lineId,
        description,
        quantity,
        unitPrice,
        lineTotal
      };
    })
    .filter(Boolean);
}

function buildDestinationSummary(line, fallback = '-') {
  const destinationLabels = Array.from(
    new Set(
      (Array.isArray(line && line.destinationOptions) ? line.destinationOptions : [])
        .map((option) => readText(option && (option.label || option.key)))
        .filter(Boolean)
    )
  );

  if (destinationLabels.length > 0) {
    return destinationLabels.join(', ');
  }

  const inlineDestination = readText(line && line.destination);
  return inlineDestination || fallback;
}

function enrichOrderLinesWithDespatch(orderLines, despatchDocs) {
  const despatchLineEntries = [];

  (Array.isArray(despatchDocs) ? despatchDocs : []).forEach((despatchDoc) => {
    const despatchLines = Array.isArray(despatchDoc && despatchDoc.lines) ? despatchDoc.lines : [];

    despatchLines.forEach((despatchLine) => {
      const quantity = readQuantity(
        despatchLine &&
          (despatchLine.quantity || despatchLine.deliveredQuantity || despatchLine.fulfilmentQuantity)
      );

      if (quantity <= 0) {
        return;
      }

      const lineCandidates = new Set([
        ...buildLineIdCandidates(despatchLine && despatchLine.orderLineId),
        ...buildLineIdCandidates(despatchLine && despatchLine.lineId)
      ]);

      if (lineCandidates.size === 0) {
        return;
      }

      despatchLineEntries.push({
        quantity,
        lineCandidates,
        destination: buildDestinationSummary(despatchLine, '')
      });
    });
  });

  const enrichedOrderLines = (Array.isArray(orderLines) ? orderLines : []).map((line, index) => {
    const lineId = readText(line && line.lineId) || 'LINE-' + String(index + 1).padStart(3, '0');
    const requestedQuantity = readQuantity(line && line.requestedQuantity);
    const lineCandidates = buildLineIdCandidates(lineId);
    const matchedDespatchLines = despatchLineEntries.filter((entry) =>
      lineCandidates.some((candidate) => entry.lineCandidates.has(candidate))
    );

    const despatchedQuantity = matchedDespatchLines.reduce(
      (accumulator, entry) => accumulator + entry.quantity,
      0
    );

    const pendingQuantity = Math.max(requestedQuantity - despatchedQuantity, 0);
    let destination = buildDestinationSummary(line);

    if ((!destination || destination === '-') && matchedDespatchLines.length > 0) {
      const despatchDestinations = Array.from(
        new Set(matchedDespatchLines.map((entry) => readText(entry.destination)).filter(Boolean))
      );
      destination = despatchDestinations.length > 0 ? despatchDestinations.join(', ') : '-';
    }

    return {
      ...line,
      lineId,
      requestedQuantity,
      despatchedQuantity,
      pendingQuantity,
      destination
    };
  });

  const pendingDespatchLines = enrichedOrderLines
    .filter((line) => line.pendingQuantity > 0)
    .map((line) => ({
      lineId: line.lineId,
      quantityOrdered: line.requestedQuantity,
      quantityPending: line.pendingQuantity,
      quantityDespatched: line.despatchedQuantity,
      destination: buildDestinationSummary(line)
    }));

  return {
    enrichedOrderLines,
    pendingDespatchLines
  };
}

function hasLineCandidateMatch(leftCandidates, rightCandidates) {
  if (!leftCandidates || !rightCandidates) {
    return false;
  }

  return Array.from(leftCandidates).some((candidate) => rightCandidates.has(candidate));
}

function buildOrderLineStatusEntries(orderDoc) {
  const mappedOrder = mapOrderDetail(orderDoc);
  const orderLines = Array.isArray(mappedOrder && mappedOrder.orderLines) ? mappedOrder.orderLines : [];

  return orderLines.map((line, index) => {
    const lineId = readText(line && line.lineId) || 'LINE-' + String(index + 1).padStart(3, '0');

    return {
      lineId,
      requestedQuantity: Math.max(readQuantity(line && line.requestedQuantity), 0),
      despatchedQuantity: 0,
      paidQuantity: 0,
      candidates: new Set(buildLineIdCandidates(lineId))
    };
  });
}

function mapDespatchLinesToOrderLines(orderLineEntries, despatchDocs) {
  const despatchLineLookupByDespatchUuid = new Map();

  (Array.isArray(despatchDocs) ? despatchDocs : []).forEach((despatchDoc) => {
    const despatchUuid = readText(despatchDoc && despatchDoc._id);
    const despatchLines = Array.isArray(despatchDoc && despatchDoc.lines) ? despatchDoc.lines : [];
    const mappedDespatchLines = [];

    despatchLines.forEach((despatchLine) => {
      const quantity = readQuantity(
        despatchLine &&
          (despatchLine.quantity || despatchLine.deliveredQuantity || despatchLine.fulfilmentQuantity)
      );

      if (quantity <= 0) {
        return;
      }

      const lineCandidates = new Set([
        ...buildLineIdCandidates(despatchLine && despatchLine.orderLineId),
        ...buildLineIdCandidates(despatchLine && despatchLine.lineId)
      ]);

      if (lineCandidates.size === 0) {
        return;
      }

      let matchedOrderLineId = '';
      const matchedOrderLine = orderLineEntries.find((orderLineEntry) =>
        hasLineCandidateMatch(orderLineEntry.candidates, lineCandidates)
      );

      if (matchedOrderLine) {
        matchedOrderLine.despatchedQuantity += quantity;
        matchedOrderLineId = matchedOrderLine.lineId;
      }

      mappedDespatchLines.push({
        quantity,
        lineCandidates,
        matchedOrderLineId
      });
    });

    if (despatchUuid) {
      despatchLineLookupByDespatchUuid.set(despatchUuid, mappedDespatchLines);
    }
  });

  return despatchLineLookupByDespatchUuid;
}

function applyPaidInvoiceQuantities(orderLineEntries, despatchLineLookupByDespatchUuid, invoiceDocs) {
  const orderLineById = new Map(
    orderLineEntries.map((orderLineEntry) => [orderLineEntry.lineId, orderLineEntry])
  );

  (Array.isArray(invoiceDocs) ? invoiceDocs : []).forEach((invoiceDoc) => {
    if (resolveInvoiceStatus(invoiceDoc) !== 'Paid') {
      return;
    }

    const sourceType = readText(invoiceDoc && invoiceDoc.sourceType).toLowerCase();
    if (sourceType === 'order') {
      orderLineEntries.forEach((orderLineEntry) => {
        orderLineEntry.paidQuantity = Math.max(
          orderLineEntry.paidQuantity,
          orderLineEntry.requestedQuantity
        );
      });
      return;
    }

    const relatedDespatchLines =
      despatchLineLookupByDespatchUuid.get(readText(invoiceDoc && invoiceDoc.despatchUuid)) || [];

    const invoiceLines = Array.isArray(
      invoiceDoc &&
        invoiceDoc.invoicePayload &&
        invoiceDoc.invoicePayload.InvoiceData &&
        invoiceDoc.invoicePayload.InvoiceData.lines
    )
      ? invoiceDoc.invoicePayload.InvoiceData.lines
      : [];

    if (!invoiceLines.length) {
      if (sourceType === 'despatch' && relatedDespatchLines.length) {
        relatedDespatchLines.forEach((despatchLine) => {
          if (!despatchLine.matchedOrderLineId) {
            return;
          }

          const targetOrderLine = orderLineById.get(despatchLine.matchedOrderLineId);
          if (targetOrderLine) {
            targetOrderLine.paidQuantity += readQuantity(despatchLine.quantity);
          }
        });
      }

      return;
    }

    invoiceLines.forEach((invoiceLine) => {
      const quantity = readQuantity(invoiceLine && invoiceLine.quantity);
      if (quantity <= 0) {
        return;
      }

      const invoiceLineCandidates = new Set([
        ...buildLineIdCandidates(invoiceLine && invoiceLine.lineId),
        ...buildLineIdCandidates(invoiceLine && invoiceLine.orderLineId)
      ]);

      if (invoiceLineCandidates.size === 0) {
        return;
      }

      let matchedOrderLineId = '';

      const mappedDespatchLine = relatedDespatchLines.find(
        (despatchLine) =>
          despatchLine.matchedOrderLineId &&
          hasLineCandidateMatch(despatchLine.lineCandidates, invoiceLineCandidates)
      );

      if (mappedDespatchLine) {
        matchedOrderLineId = mappedDespatchLine.matchedOrderLineId;
      }

      if (!matchedOrderLineId) {
        const matchedOrderLine = orderLineEntries.find((orderLineEntry) =>
          hasLineCandidateMatch(orderLineEntry.candidates, invoiceLineCandidates)
        );

        if (matchedOrderLine) {
          matchedOrderLineId = matchedOrderLine.lineId;
        }
      }

      if (!matchedOrderLineId) {
        return;
      }

      const targetOrderLine = orderLineById.get(matchedOrderLineId);
      if (targetOrderLine) {
        targetOrderLine.paidQuantity += quantity;
      }
    });
  });
}

function resolveOrderLifecycleStatus(orderDoc, relatedDespatchDocs, relatedInvoiceDocs) {
  const hasDespatchAdvice = Array.isArray(relatedDespatchDocs) && relatedDespatchDocs.length > 0;
  const orderLineEntries = buildOrderLineStatusEntries(orderDoc);

  if (!orderLineEntries.length) {
    return hasDespatchAdvice ? 'In Progress' : 'Pending';
  }

  const despatchLineLookupByDespatchUuid = mapDespatchLinesToOrderLines(
    orderLineEntries,
    relatedDespatchDocs
  );

  applyPaidInvoiceQuantities(orderLineEntries, despatchLineLookupByDespatchUuid, relatedInvoiceDocs);

  const requestedTotal = orderLineEntries.reduce(
    (accumulator, line) => accumulator + line.requestedQuantity,
    0
  );
  const despatchedTotal = orderLineEntries.reduce(
    (accumulator, line) => accumulator + Math.min(line.despatchedQuantity, line.requestedQuantity),
    0
  );
  const paidTotal = orderLineEntries.reduce(
    (accumulator, line) => accumulator + Math.min(line.paidQuantity, line.requestedQuantity),
    0
  );

  const quantityTolerance = 0.0001;
  const allItemsDespatched =
    requestedTotal > quantityTolerance && despatchedTotal >= requestedTotal - quantityTolerance;
  const allItemsPaid = requestedTotal > quantityTolerance && paidTotal >= requestedTotal - quantityTolerance;

  if (allItemsDespatched && allItemsPaid) {
    return 'Completed';
  }

  if (allItemsDespatched) {
    return 'Despatched';
  }

  if (hasDespatchAdvice || despatchedTotal > quantityTolerance) {
    return 'In Progress';
  }

  return 'Pending';
}

function buildOrderStatusLookup(orderDocs, despatchDocs, invoiceDocs) {
  const despatchByOrderUuid = new Map();
  const invoicesByDespatchUuid = new Map();
  const invoicesByOrderUuid = new Map();

  (Array.isArray(despatchDocs) ? despatchDocs : []).forEach((despatchDoc) => {
    const orderUuid = readText(despatchDoc && despatchDoc.orderUuid);
    if (!orderUuid) {
      return;
    }

    const relatedDespatchDocs = despatchByOrderUuid.get(orderUuid) || [];
    relatedDespatchDocs.push(despatchDoc);
    despatchByOrderUuid.set(orderUuid, relatedDespatchDocs);
  });

  (Array.isArray(invoiceDocs) ? invoiceDocs : []).forEach((invoiceDoc) => {
    const despatchUuid = readText(invoiceDoc && invoiceDoc.despatchUuid);
    const orderUuid = readText(invoiceDoc && invoiceDoc.orderUuid);

    if (despatchUuid) {
      const relatedInvoiceDocs = invoicesByDespatchUuid.get(despatchUuid) || [];
      relatedInvoiceDocs.push(invoiceDoc);
      invoicesByDespatchUuid.set(despatchUuid, relatedInvoiceDocs);
    }

    if (orderUuid) {
      const relatedOrderInvoiceDocs = invoicesByOrderUuid.get(orderUuid) || [];
      relatedOrderInvoiceDocs.push(invoiceDoc);
      invoicesByOrderUuid.set(orderUuid, relatedOrderInvoiceDocs);
    }
  });

  const statusesByOrderUuid = new Map();

  (Array.isArray(orderDocs) ? orderDocs : []).forEach((orderDoc) => {
    const orderUuid = readText(orderDoc && orderDoc._id);
    if (!orderUuid) {
      return;
    }

    const relatedDespatchDocs = despatchByOrderUuid.get(orderUuid) || [];
    const despatchLinkedInvoiceDocs = relatedDespatchDocs.flatMap(
      (despatchDoc) => invoicesByDespatchUuid.get(readText(despatchDoc && despatchDoc._id)) || []
    );
    const orderLinkedInvoiceDocs = invoicesByOrderUuid.get(orderUuid) || [];
    const relatedInvoiceDocsById = new Map();

    despatchLinkedInvoiceDocs.concat(orderLinkedInvoiceDocs).forEach((invoiceDoc) => {
      const invoiceUuid = readText(invoiceDoc && invoiceDoc._id) || randomUUID();
      if (!relatedInvoiceDocsById.has(invoiceUuid)) {
        relatedInvoiceDocsById.set(invoiceUuid, invoiceDoc);
      }
    });

    const relatedInvoiceDocs = Array.from(relatedInvoiceDocsById.values());

    const derivedStatus = resolveOrderLifecycleStatus(orderDoc, relatedDespatchDocs, relatedInvoiceDocs);
    statusesByOrderUuid.set(orderUuid, derivedStatus);
  });

  return statusesByOrderUuid;
}

router.use(requireSessionAuth);

router.post('/order/create', async (req, res) => {
  try {
    const validation = validateOrderCreateBody(req.body);
    if (validation.errors.length > 0) {
      return sendError(res, 400, validation.errors);
    }

    const chalksnifferApiToken = readText(process.env.CHALKSNIFFER_API_TOKEN).replace(/^Authorization\s*:\s*/i, '');
    if (!chalksnifferApiToken) {
      return sendError(
        res,
        500,
        'Missing CHALKSNIFFER_API_TOKEN environment variable.'
      );
    }

    const chalksnifferOrderPayload = buildChalksnifferOrderPayload(validation.data);

    const generatedOrderXml = await postChalksnifferOrderForXmlResponse(
      CHALKSNIFFER_ORDER_CREATE_URL,
      chalksnifferOrderPayload,
      'Order generation request',
      chalksnifferApiToken
    );

    const orderSnapshot = buildOrderSnapshotFromXml(generatedOrderXml, validation.data);
    const fallbackLines = buildPayloadLineSnapshots(validation.data);
    const orderUuid = randomUUID();
    const sourceDisplayId = orderSnapshot.displayId || readText(validation.data.ID) || orderUuid;

    const now = new Date();
    const orderDoc = {
      _id: orderUuid,
      userId: req.session.userId,
      displayId: orderUuid,
      sourceDisplayId,
      buyer: orderSnapshot.buyer || 'Unknown Buyer',
      supplier: orderSnapshot.supplier || 'Unknown Supplier',
      lineItems: (orderSnapshot.orderLines.length || fallbackLines.length),
      status: 'Pending',
      issueDate: orderSnapshot.issueDate || readText(validation.data.IssueDate),
      updatedAt: now,
      createdAt: now,
      sellerPartyId: validation.sellerPartyId,
      supplierAbn: validation.supplierAbn || null,
      customerAbn: validation.customerAbn || null,
      submittedOrderData: validation.data,
      chalksnifferOrderPayload,
      generatedOrderXml,
      orderLines: orderSnapshot.orderLines.length ? orderSnapshot.orderLines : fallbackLines
    };

    const db = getDb();

    await db.collection(USER_ORDER_COLLECTION).insertOne(orderDoc);

    return res.status(201).json({
      success: true,
      order: mapOrderDetail(orderDoc),
      'executed-at': nowUnix()
    });
  } catch (error) {
    console.error('Error creating order document:', error);

    if (/failed with status 401/i.test(String(error && error.message))) {
      return sendError(
        res,
        401,
        [
          error.message,
          'Chalksniffer rejected this Authorization token for the order request. Verify CHALKSNIFFER_API_TOKEN and use https://www.chalksniffer.com/orders.'
        ]
      );
    }

    return sendError(res, 500, error.message || 'Unable to create order document.');
  }
});

router.post('/despatch/create', async (req, res) => {
  try {
    const validation = validateDespatchCreateBody(req.body);
    if (validation.errors.length > 0) {
      return sendError(res, 400, validation.errors);
    }

    const db = getDb();
    const userId = req.session.userId;

    const orderDoc = await db.collection(USER_ORDER_COLLECTION).findOne({
      _id: validation.orderUuid,
      userId
    });

    if (!orderDoc) {
      return sendNotFound(res, 'order', validation.orderUuid);
    }

    const baseOrderXml = orderDoc.generatedOrderXml || orderDoc.xml;
    if (!baseOrderXml) {
      return sendError(res, 400, 'Selected order does not contain source XML for despatch generation.');
    }

    let parsedOrderTree;
    try {
      parsedOrderTree = parseOrderXml(baseOrderXml);
    } catch (parseError) {
      return sendError(res, 400, 'Selected order XML could not be parsed.');
    }

    let selectedOrderXml;
    try {
      selectedOrderXml = buildSelectedOrderXml(parsedOrderTree, validation.lineSelections, orderDoc.orderLines);
    } catch (selectionError) {
      return sendError(res, 400, selectionError.message);
    }

    const syntheticApiKey = 'v2-user-' + userId;
    const generationMetadata = {
      contentType: 'application/xml',
      requestIp: req.ip,
      userAgent: req.headers['user-agent'] || null,
      receivedAt: new Date(),
      source: 'v2-user-despatch-create',
      sourceOrderUuid: orderDoc._id
    };

    const { adviceIds } = await createDespatchAdvice(syntheticApiKey, selectedOrderXml, generationMetadata);

    const despatchCollection = db.collection(USER_DESPATCH_COLLECTION);
    const createdDespatches = [];

    for (const adviceId of adviceIds) {
      const generatedAdviceDoc = await getDespatchAdviceByAdviceId(syntheticApiKey, adviceId);
      if (!generatedAdviceDoc || !generatedAdviceDoc.despatchXml) {
        throw new Error('Generated despatch advice ' + adviceId + ' could not be loaded for persistence.');
      }

      const xmlSummary = parseDespatchSummaryFromXml(generatedAdviceDoc.despatchXml);
      const now = new Date();

      const despatchDoc = {
        _id: adviceId,
        userId,
        displayId: xmlSummary.displayId || adviceId,
        orderUuid: orderDoc._id,
        orderDisplayId: orderDoc.displayId,
        status: 'Shipped',
        issueDate: xmlSummary.issueDate || todayIsoDate(),
        buyer: xmlSummary.buyer || orderDoc.buyer || '',
        supplier: xmlSummary.supplier || orderDoc.supplier || '',
        lineItems: xmlSummary.lines.length,
        lines: xmlSummary.lines,
        updatedAt: now,
        createdAt: now,
        despatchXml: generatedAdviceDoc.despatchXml,
        sourceOrderId: generatedAdviceDoc.originalOrderId || orderDoc.displayId,
        sourceAdviceCollectionId: generatedAdviceDoc._id
      };

      await despatchCollection.replaceOne({ _id: adviceId, userId }, despatchDoc, { upsert: true });
      createdDespatches.push(mapDespatchSummary(despatchDoc));
    }

    return res.status(201).json({
      success: true,
      adviceIds: createdDespatches.map((despatch) => despatch.uuid),
      despatch: createdDespatches,
      'executed-at': nowUnix()
    });
  } catch (error) {
    console.error('Error creating despatch advice documents:', error);
    return sendError(res, 500, error.message || 'Unable to create despatch advice documents.');
  }
});

router.post('/invoice/create', async (req, res) => {
  try {
    const validation = validateInvoiceCreateBody(req.body);
    if (validation.errors.length > 0) {
      return sendError(res, 400, validation.errors);
    }

    const invoiceApiToken = readText(process.env.LASTMINUTEPUSH_API_TOKEN).replace(
      /^Authorization\s*:\s*/i,
      ''
    );

    if (!invoiceApiToken) {
      return sendError(res, 500, 'Missing LASTMINUTEPUSH_API_TOKEN environment variable.');
    }

    const db = getDb();
    const userId = req.session.userId;

    let linkedOrder = null;
    if (validation.baseOrderUuid) {
      linkedOrder = await db.collection(USER_ORDER_COLLECTION).findOne({
        _id: validation.baseOrderUuid,
        userId
      });

      if (!linkedOrder) {
        return sendNotFound(res, 'order', validation.baseOrderUuid);
      }
    }

    const baseDespatchDoc = validation.baseDespatchUuid
      ? await db.collection(USER_DESPATCH_COLLECTION).findOne({
          _id: validation.baseDespatchUuid,
          userId
        })
      : null;

    if (validation.baseDespatchUuid && !baseDespatchDoc) {
      return sendNotFound(res, 'despatch', validation.baseDespatchUuid);
    }

    const sourceType = validation.invoiceSourceType;
    const sourceDespatchUuid = sourceType === 'despatch'
      ? validation.invoiceSourceDespatchUuid || validation.baseDespatchUuid
      : '';

    const sourceDespatchDoc = sourceType === 'despatch'
      ? await db.collection(USER_DESPATCH_COLLECTION).findOne({ _id: sourceDespatchUuid, userId })
      : null;

    if (sourceType === 'despatch' && !sourceDespatchDoc) {
      return sendNotFound(res, 'despatch', sourceDespatchUuid);
    }

    if (!linkedOrder) {
      const sourceOrderUuid =
        readText(baseDespatchDoc && baseDespatchDoc.orderUuid) ||
        readText(sourceDespatchDoc && sourceDespatchDoc.orderUuid);

      linkedOrder = sourceOrderUuid
        ? await db.collection(USER_ORDER_COLLECTION).findOne({ _id: sourceOrderUuid, userId })
        : null;
    }

    if (sourceType === 'order' && !linkedOrder) {
      return sendError(
        res,
        400,
        'Selected base order is unavailable for whole-order invoicing. Provide a valid baseOrderUuid or a baseDespatchUuid linked to an order.'
      );
    }

    if (
      sourceType === 'despatch' &&
      linkedOrder &&
      readText(sourceDespatchDoc && sourceDespatchDoc.orderUuid) &&
      readText(sourceDespatchDoc && sourceDespatchDoc.orderUuid) !== linkedOrder._id
    ) {
      return sendError(res, 400, 'Selected despatch advice must belong to the same order as the base despatch advice.');
    }

    const supplierName =
      validation.supplierName ||
      readText(sourceDespatchDoc && sourceDespatchDoc.supplier) ||
      readText(baseDespatchDoc && baseDespatchDoc.supplier) ||
      (linkedOrder && linkedOrder.supplier) ||
      'Supplier';

    const customerName =
      validation.customerName ||
      readText(sourceDespatchDoc && sourceDespatchDoc.buyer) ||
      readText(baseDespatchDoc && baseDespatchDoc.buyer) ||
      (linkedOrder && linkedOrder.buyer) ||
      'Customer';

    const supplierAbn = validation.supplierAbn || (linkedOrder && linkedOrder.supplierAbn) || '';
    const customerAbn = validation.customerAbn || (linkedOrder && linkedOrder.customerAbn) || '';

    const generatedInvoiceLines = sourceType === 'order'
      ? deriveInvoiceLinesFromOrder(linkedOrder, validation.defaultUnitPrice)
      : deriveInvoiceLinesFromDespatch(sourceDespatchDoc, validation.defaultUnitPrice);

    const invoiceLines = validation.manualLines.length
      ? validation.manualLines.map((line, index) => {
          const quantity = readQuantity(line && line.quantity);
          const manualUnitPrice = roundCurrency(readQuantity(line && line.unitPrice));
          const divisor = 1 + (validation.gstPercent / 100);
          const unitPrice = validation.manualLinesIncludeGst && divisor > 0
            ? roundCurrency(manualUnitPrice / divisor)
            : manualUnitPrice;

          return {
            lineId: readText(line && line.lineId) || String(index + 1),
            description: readText(line && line.description) || 'Line Item ' + String(index + 1),
            quantity,
            unitPrice,
            lineTotal: roundCurrency(quantity * unitPrice)
          };
        })
      : generatedInvoiceLines;

    if (!invoiceLines.length) {
      return sendError(res, 400, 'Selected invoice scope has no deliverable lines for invoice generation.');
    }

    const totals = calculateInvoiceTotals(invoiceLines, validation.gstPercent);

    const orderReference =
      readText((linkedOrder && linkedOrder.displayId) || (linkedOrder && linkedOrder._id)) ||
      readText((sourceDespatchDoc && sourceDespatchDoc.displayId) || (sourceDespatchDoc && sourceDespatchDoc._id)) ||
      'ORD-' + nowUnix();
    const supplierIdentifier = buildProviderIdentifier(
      supplierAbn || (linkedOrder && linkedOrder.supplierAbn),
      'SUPPLIER'
    );
    const customerIdentifier = buildProviderIdentifier(
      customerAbn || (linkedOrder && linkedOrder.customerAbn),
      'CUSTOMER'
    );

    const invoicePayload = {
      order_reference: orderReference,
      customer_id: customerIdentifier,
      issue_date: validation.issueDate,
      due_date: validation.dueDate,
      currency: validation.currency,
      supplier: {
        name: supplierName,
        identifier: supplierIdentifier
      },
      customer: {
        name: customerName,
        identifier: customerIdentifier
      },
      items: invoiceLines.map((line, index) => ({
        name: readText(line.description) || 'Line Item ' + String(index + 1),
        description: readText(line.description) || 'Line Item ' + String(index + 1),
        quantity: line.quantity,
        unit_price: roundCurrency(line.unitPrice),
        unit_code: 'EA'
      }))
    };

    const generatedInvoice = await postLastMinutePushInvoiceForXmlResponse(
      LASTMINUTEPUSH_BASE_URL,
      invoicePayload,
      'Invoice generation request',
      invoiceApiToken
    );

    const invoiceUuid = randomUUID();
    const externalInvoice = generatedInvoice.invoice;
    const externalInvoiceId =
      readText(externalInvoice && externalInvoice.invoice_id) ||
      readText(externalInvoice && externalInvoice.invoiceId) ||
      readText(externalInvoice && externalInvoice.id);
    const externalStatus = readText(externalInvoice && externalInvoice.status);
    const externalIssueDate =
      readText(externalInvoice && (externalInvoice.issue_date || externalInvoice.issueDate)) ||
      validation.issueDate;
    const externalDueDate =
      readText(externalInvoice && (externalInvoice.due_date || externalInvoice.dueDate)) || validation.dueDate;
    const externalTotal = Number(
      (externalInvoice &&
        (externalInvoice.payable_amount ||
          externalInvoice.payableAmount ||
          externalInvoice.tax_inclusive_amount ||
          externalInvoice.taxInclusiveAmount ||
          externalInvoice.subtotal)) ||
        NaN
    );
    const invoiceXml = overwriteInvoiceXmlDocumentId(generatedInvoice.invoiceXml, invoiceUuid);

    let invoiceSummary;
    try {
      invoiceSummary = parseInvoiceSummaryFromXml(invoiceXml);
    } catch (parseError) {
      invoiceSummary = {
        displayId: externalInvoiceId,
        issueDate: externalIssueDate,
        buyer: customerName,
        total: Number.isFinite(externalTotal) ? externalTotal : totals.totalAmount
      };
    }

    const now = new Date();
    const invoiceDoc = {
      _id: invoiceUuid,
      userId,
      displayId: invoiceUuid,
      sourceType,
      orderUuid: (linkedOrder && linkedOrder._id) || '',
      orderDisplayId:
        (linkedOrder && linkedOrder.displayId) ||
        readText(baseDespatchDoc && baseDespatchDoc.orderDisplayId),
      baseDespatchUuid: readText(baseDespatchDoc && baseDespatchDoc._id),
      baseDespatchDisplayId: readText(baseDespatchDoc && (baseDespatchDoc.displayId || baseDespatchDoc._id)),
      despatchUuid: sourceType === 'despatch' ? sourceDespatchDoc._id : '',
      despatchDisplayId: sourceType === 'despatch' ? (sourceDespatchDoc.displayId || sourceDespatchDoc._id) : '',
      buyer: invoiceSummary.buyer || customerName,
      total: Number.isFinite(invoiceSummary.total)
        ? invoiceSummary.total
        : Number.isFinite(externalTotal)
          ? externalTotal
          : totals.totalAmount,
      issueDate: invoiceSummary.issueDate || externalIssueDate,
      dueDate: externalDueDate,
      status: mapLastMinutePushInvoiceStatus(externalStatus),
      statusManuallySet: false,
      provider: 'LastMinutePush',
      providerInvoiceId: externalInvoiceId,
      providerInvoiceStatus: externalStatus,
      providerInvoice: externalInvoice,
      updatedAt: now,
      createdAt: now,
      invoiceXml,
      invoicePayload
    };

    await db.collection(USER_INVOICE_COLLECTION).insertOne(invoiceDoc);

    return res.status(201).json({
      success: true,
      invoice: mapInvoiceDetail(invoiceDoc),
      'executed-at': nowUnix()
    });
  } catch (error) {
    console.error('Error creating invoice document:', error);
    return sendError(res, 500, error.message || 'Unable to create invoice document.');
  }
});

router.get('/home-summary', async (req, res) => {
  try {
    const db = getDb();
    const userId = req.session.userId;

    const [orders, despatch, invoices] = await Promise.all([
      db
        .collection(USER_ORDER_COLLECTION)
        .find({ userId })
        .sort({ updatedAt: -1 })
        .limit(HOME_SUMMARY_LIMIT)
        .toArray(),
      db
        .collection(USER_DESPATCH_COLLECTION)
        .find({ userId })
        .sort({ updatedAt: -1 })
        .limit(HOME_SUMMARY_LIMIT)
        .toArray(),
      db
        .collection(USER_INVOICE_COLLECTION)
        .find({ userId })
        .sort({ updatedAt: -1 })
        .limit(HOME_SUMMARY_LIMIT)
        .toArray()
    ]);

    const orderUuids = (Array.isArray(orders) ? orders : [])
      .map((orderDoc) => readText(orderDoc && orderDoc._id))
      .filter(Boolean);

    let relatedOrderDespatchDocs = [];
    let relatedOrderInvoiceDocs = [];

    if (orderUuids.length > 0) {
      relatedOrderDespatchDocs = await db
        .collection(USER_DESPATCH_COLLECTION)
        .find({ userId, orderUuid: { $in: orderUuids } })
        .toArray();

      const relatedDespatchUuids = (Array.isArray(relatedOrderDespatchDocs) ? relatedOrderDespatchDocs : [])
        .map((despatchDoc) => readText(despatchDoc && despatchDoc._id))
        .filter(Boolean);

      relatedOrderInvoiceDocs = await db
        .collection(USER_INVOICE_COLLECTION)
        .find({ userId })
        .toArray();
    }

    const orderStatusLookup = buildOrderStatusLookup(
      orders,
      relatedOrderDespatchDocs,
      relatedOrderInvoiceDocs
    );

    const orderBuyerByUuid = new Map(
      (Array.isArray(orders) ? orders : []).map((orderDoc) => [
        orderDoc && orderDoc._id,
        readText(orderDoc && orderDoc.buyer)
      ])
    );

    const despatchBuyerByUuid = new Map();

    const mappedDespatch = (Array.isArray(despatch) ? despatch : []).map((despatchDoc) => {
      const buyer =
        readText(despatchDoc && despatchDoc.buyer) ||
        readText(orderBuyerByUuid.get(despatchDoc && despatchDoc.orderUuid)) ||
        'Unknown Buyer';

      const mapped = {
        ...mapDespatchSummary(despatchDoc),
        buyer
      };

      if (despatchDoc && despatchDoc._id) {
        despatchBuyerByUuid.set(despatchDoc._id, buyer);
      }

      return mapped;
    });

    const mappedInvoices = (Array.isArray(invoices) ? invoices : []).map((invoiceDoc) => {
      const buyer =
        readText(invoiceDoc && invoiceDoc.buyer) ||
        readText(despatchBuyerByUuid.get(invoiceDoc && invoiceDoc.despatchUuid)) ||
        'Unknown Buyer';

      return {
        ...mapInvoiceSummary(invoiceDoc),
        buyer
      };
    });

    return res.status(200).json({
      success: true,
      orders: orders.map((orderDoc) => {
        const derivedStatus = orderStatusLookup.get(readText(orderDoc && orderDoc._id));

        return mapOrderSummary({
          ...orderDoc,
          status: derivedStatus || readText(orderDoc && orderDoc.status) || 'Pending'
        });
      }),
      despatch: mappedDespatch,
      invoices: mappedInvoices,
      'executed-at': nowUnix()
    });
  } catch (error) {
    console.error('Error loading home summary:', error);
    return sendError(res, 500, error.message || 'Unable to load home summary.');
  }
});

router.get('/orders', async (req, res) => {
  try {
    const db = getDb();
    const userId = req.session.userId;

    const orders = await db
      .collection(USER_ORDER_COLLECTION)
      .find({ userId })
      .sort({ updatedAt: -1 })
      .toArray();

    const despatchDocs = await db.collection(USER_DESPATCH_COLLECTION).find({ userId }).toArray();
    const invoiceDocs = await db
      .collection(USER_INVOICE_COLLECTION)
      .find({ userId })
      .toArray();

    const orderStatusLookup = buildOrderStatusLookup(orders, despatchDocs, invoiceDocs);

    return res.status(200).json({
      success: true,
      orders: orders.map((orderDoc) => {
        const derivedStatus = orderStatusLookup.get(readText(orderDoc && orderDoc._id));

        return mapOrderSummary({
          ...orderDoc,
          status: derivedStatus || readText(orderDoc && orderDoc.status) || 'Pending'
        });
      }),
      'executed-at': nowUnix()
    });
  } catch (error) {
    console.error('Error loading order summaries:', error);
    return sendError(res, 500, error.message || 'Unable to load order summaries.');
  }
});

router.get('/orders/:uuid', async (req, res) => {
  try {
    const db = getDb();
    const userId = req.session.userId;
    const uuid = req.params.uuid;

    const orderDoc = await db.collection(USER_ORDER_COLLECTION).findOne({ _id: uuid, userId });
    if (!orderDoc) {
      return sendNotFound(res, 'order', uuid);
    }

    const relatedDespatchDocs = await db
      .collection(USER_DESPATCH_COLLECTION)
      .find({ userId, orderUuid: uuid })
      .sort({ updatedAt: -1 })
      .toArray();

    const relatedDespatchUuids = (Array.isArray(relatedDespatchDocs) ? relatedDespatchDocs : [])
      .map((despatchDoc) => readText(despatchDoc && despatchDoc._id))
      .filter(Boolean);

    const relatedDespatchUuidSet = new Set(relatedDespatchUuids);

    const candidateInvoiceDocs = await db
      .collection(USER_INVOICE_COLLECTION)
      .find({ userId })
      .sort({ updatedAt: -1 })
      .toArray();

    const relatedInvoiceDocsById = new Map();

    (Array.isArray(candidateInvoiceDocs) ? candidateInvoiceDocs : []).forEach((invoiceDoc) => {
      const orderUuid = readText(invoiceDoc && invoiceDoc.orderUuid);
      const despatchUuid = readText(invoiceDoc && invoiceDoc.despatchUuid);
      const baseDespatchUuid = readText(invoiceDoc && invoiceDoc.baseDespatchUuid);

      const isRelated =
        orderUuid === uuid ||
        relatedDespatchUuidSet.has(despatchUuid) ||
        relatedDespatchUuidSet.has(baseDespatchUuid);

      if (!isRelated) {
        return;
      }

      const invoiceUuid = readText(invoiceDoc && invoiceDoc._id) || randomUUID();
      if (!relatedInvoiceDocsById.has(invoiceUuid)) {
        relatedInvoiceDocsById.set(invoiceUuid, invoiceDoc);
      }
    });

    const relatedInvoiceDocs = Array.from(relatedInvoiceDocsById.values());

    const derivedOrderStatus = resolveOrderLifecycleStatus(
      orderDoc,
      relatedDespatchDocs,
      relatedInvoiceDocs
    );

    const mappedOrder = mapOrderDetail({
      ...orderDoc,
      status: derivedOrderStatus
    });
    const { enrichedOrderLines, pendingDespatchLines } = enrichOrderLinesWithDespatch(
      mappedOrder.orderLines,
      relatedDespatchDocs
    );
    const orderDestinationLabels = Array.from(new Set(
      (Array.isArray(enrichedOrderLines) ? enrichedOrderLines : [])
        .flatMap((line) => (Array.isArray(line?.destinationOptions) ? line.destinationOptions : []))
        .map((option) => option?.label || option?.key)
        .filter(Boolean)
    ));
    const orderDestinationSummary = orderDestinationLabels.length > 0 ? orderDestinationLabels.join(', ') : '-';

    const despatchAdvice = relatedDespatchDocs.map((despatchDoc) => {
      const mappedDespatch = mapDespatchSummary(despatchDoc);

      if ((!mappedDespatch.destination || mappedDespatch.destination === '-') && orderDestinationSummary !== '-') {
        return {
          ...mappedDespatch,
          destination: orderDestinationSummary
        };
      }

      return mappedDespatch;
    });

    const invoiceDocuments = relatedInvoiceDocs
      .map((invoiceDoc) => mapInvoiceSummary(invoiceDoc))
      .sort((left, right) => Number(right && right.updatedAt) - Number(left && left.updatedAt));

    const payment = deriveOrderPaymentSummary(invoiceDocuments);

    return res.status(200).json({
      success: true,
      order: {
        ...mappedOrder,
        orderLines: enrichedOrderLines,
        pendingDespatchLines,
        despatchAdvice,
        invoiceDocuments,
        payment
      },
      'executed-at': nowUnix()
    });
  } catch (error) {
    console.error('Error loading order detail:', error);
    return sendError(res, 500, error.message || 'Unable to load order detail.');
  }
});

router.delete('/orders/:uuid', async (req, res) => {
  try {
    const db = getDb();
    const userId = req.session.userId;
    const uuid = req.params.uuid;

    const relatedDespatchDocs = await db
      .collection(USER_DESPATCH_COLLECTION)
      .find({ userId, orderUuid: uuid })
      .toArray();
    const relatedDespatchUuids = relatedDespatchDocs
      .map((despatchDoc) => readText(despatchDoc && despatchDoc._id))
      .filter(Boolean);

    const deleteResult = await db.collection(USER_ORDER_COLLECTION).deleteOne({ _id: uuid, userId });
    if (!deleteResult.deletedCount) {
      return sendNotFound(res, 'order', uuid);
    }

    await db.collection(USER_DESPATCH_COLLECTION).deleteMany({ userId, orderUuid: uuid });
    await db.collection(USER_INVOICE_COLLECTION).deleteMany({ userId, orderUuid: uuid });

    for (const despatchUuid of relatedDespatchUuids) {
      await db.collection(USER_INVOICE_COLLECTION).deleteMany({ userId, despatchUuid });
    }

    return res.status(200).json({
      success: true,
      message: 'Order, associated despatch advice, and invoices deleted successfully.',
      'executed-at': nowUnix()
    });
  } catch (error) {
    console.error('Error deleting order detail:', error);
    return sendError(res, 500, error.message || 'Unable to delete order detail.');
  }
});

router.get('/despatch', async (req, res) => {
  try {
    const db = getDb();
    const userId = req.session.userId;

    const despatchDocs = await db
      .collection(USER_DESPATCH_COLLECTION)
      .find({ userId })
      .sort({ updatedAt: -1 })
      .toArray();

    return res.status(200).json({
      success: true,
      despatch: despatchDocs.map(mapDespatchSummary),
      'executed-at': nowUnix()
    });
  } catch (error) {
    console.error('Error loading despatch summaries:', error);
    return sendError(res, 500, error.message || 'Unable to load despatch summaries.');
  }
});

router.get('/despatch/:uuid', async (req, res) => {
  try {
    const db = getDb();
    const userId = req.session.userId;
    const uuid = req.params.uuid;

    const despatchDoc = await db.collection(USER_DESPATCH_COLLECTION).findOne({ _id: uuid, userId });
    if (!despatchDoc) {
      return sendNotFound(res, 'despatch', uuid);
    }

    return res.status(200).json({
      success: true,
      despatch: mapDespatchDetail(despatchDoc),
      'executed-at': nowUnix()
    });
  } catch (error) {
    console.error('Error loading despatch detail:', error);
    return sendError(res, 500, error.message || 'Unable to load despatch detail.');
  }
});

router.delete('/despatch/:uuid', async (req, res) => {
  try {
    const db = getDb();
    const userId = req.session.userId;
    const uuid = req.params.uuid;

    const deleteResult = await db.collection(USER_DESPATCH_COLLECTION).deleteOne({ _id: uuid, userId });
    if (!deleteResult.deletedCount) {
      return sendNotFound(res, 'despatch', uuid);
    }

    await db.collection(USER_INVOICE_COLLECTION).deleteMany({ userId, despatchUuid: uuid });

    return res.status(200).json({
      success: true,
      message: 'Despatch advice and associated invoices deleted successfully.',
      'executed-at': nowUnix()
    });
  } catch (error) {
    console.error('Error deleting despatch detail:', error);
    return sendError(res, 500, error.message || 'Unable to delete despatch detail.');
  }
});

router.post('/despatch/:uuid/status', async (req, res) => {
  try {
    const validation = validateDespatchStatusUpdateBody(req.body);
    if (validation.errors.length > 0) {
      return sendError(res, 400, validation.errors);
    }

    const db = getDb();
    const userId = req.session.userId;
    const uuid = req.params.uuid;

    const existingDespatch = await db.collection(USER_DESPATCH_COLLECTION).findOne({ _id: uuid, userId });
    if (!existingDespatch) {
      return sendNotFound(res, 'despatch', uuid);
    }

    const now = new Date();
    await db.collection(USER_DESPATCH_COLLECTION).updateOne(
      { _id: uuid, userId },
      {
        $set: {
          status: validation.status,
          updatedAt: now
        }
      }
    );

    const updatedDespatch = {
      ...existingDespatch,
      status: validation.status,
      updatedAt: now
    };

    return res.status(200).json({
      success: true,
      despatch: mapDespatchDetail(updatedDespatch),
      'executed-at': nowUnix()
    });
  } catch (error) {
    console.error('Error updating despatch status:', error);
    return sendError(res, 500, error.message || 'Unable to update despatch status.');
  }
});

router.get('/invoices', async (req, res) => {
  try {
    const db = getDb();
    const userId = req.session.userId;

    const invoices = await db
      .collection(USER_INVOICE_COLLECTION)
      .find({ userId })
      .sort({ updatedAt: -1 })
      .toArray();

    return res.status(200).json({
      success: true,
      invoices: invoices.map(mapInvoiceSummary),
      'executed-at': nowUnix()
    });
  } catch (error) {
    console.error('Error loading invoice summaries:', error);
    return sendError(res, 500, error.message || 'Unable to load invoice summaries.');
  }
});

router.get('/invoices/:uuid', async (req, res) => {
  try {
    const db = getDb();
    const userId = req.session.userId;
    const uuid = req.params.uuid;

    const invoiceDoc = await db.collection(USER_INVOICE_COLLECTION).findOne({ _id: uuid, userId });
    if (!invoiceDoc) {
      return sendNotFound(res, 'invoice', uuid);
    }

    return res.status(200).json({
      success: true,
      invoice: mapInvoiceDetail(invoiceDoc),
      'executed-at': nowUnix()
    });
  } catch (error) {
    console.error('Error loading invoice detail:', error);
    return sendError(res, 500, error.message || 'Unable to load invoice detail.');
  }
});

router.delete('/invoices/:uuid', async (req, res) => {
  try {
    const db = getDb();
    const userId = req.session.userId;
    const uuid = req.params.uuid;

    const deleteResult = await db.collection(USER_INVOICE_COLLECTION).deleteOne({ _id: uuid, userId });
    if (!deleteResult.deletedCount) {
      return sendNotFound(res, 'invoice', uuid);
    }

    return res.status(200).json({
      success: true,
      message: 'Invoice deleted successfully.',
      'executed-at': nowUnix()
    });
  } catch (error) {
    console.error('Error deleting invoice detail:', error);
    return sendError(res, 500, error.message || 'Unable to delete invoice detail.');
  }
});

router.post('/invoices/:uuid/status', async (req, res) => {
  try {
    const validation = validateInvoiceStatusUpdateBody(req.body);
    if (validation.errors.length > 0) {
      return sendError(res, 400, validation.errors);
    }

    const db = getDb();
    const userId = req.session.userId;
    const uuid = req.params.uuid;

    const existingInvoice = await db.collection(USER_INVOICE_COLLECTION).findOne({ _id: uuid, userId });
    if (!existingInvoice) {
      return sendNotFound(res, 'invoice', uuid);
    }

    const now = new Date();
    await db.collection(USER_INVOICE_COLLECTION).updateOne(
      { _id: uuid, userId },
      {
        $set: {
          status: validation.status,
          statusManuallySet: true,
          updatedAt: now
        }
      }
    );

    const updatedInvoice = {
      ...existingInvoice,
      status: validation.status,
      statusManuallySet: true,
      updatedAt: now
    };

    return res.status(200).json({
      success: true,
      invoice: mapInvoiceDetail(updatedInvoice),
      'executed-at': nowUnix()
    });
  } catch (error) {
    console.error('Error updating invoice status:', error);
    return sendError(res, 500, error.message || 'Unable to update invoice status.');
  }
});

module.exports = router;

