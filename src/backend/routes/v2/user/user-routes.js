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
  validateInvoiceCreateBody,
  buildChalksnifferOrderPayload,
  postJsonForXmlResponse,
  postChalksnifferOrderForXmlResponse,
  buildOrderSnapshotFromXml,
  buildPayloadLineSnapshots,
  buildSelectedOrderXml,
  parseDespatchSummaryFromXml,
  parseInvoiceSummaryFromXml,
  deriveInvoiceLinesFromDespatch,
  calculateInvoiceTotals
} = require('./user-routes-utilities');

const router = express.Router();

const CHALKSNIFFER_ORDER_CREATE_URL =
  process.env.CHALKSNIFFER_ORDER_CREATE_URL || 'https://www.chalksniffer.com/orders';
const GPTLESS_INVOICE_URL = process.env.GPTLESS_INVOICE_URL || 'https://api.gptless.au/v2/invoices/generate';

const USER_ORDER_COLLECTION = 'user-orders';
const USER_DESPATCH_COLLECTION = 'user-despatch-advice';
const USER_INVOICE_COLLECTION = 'user-invoices';

const HOME_SUMMARY_LIMIT = 8;

function readQuantity(value) {
  const quantity = Number(value);
  return Number.isFinite(quantity) ? quantity : 0;
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

    await db.collection(USER_ORDER_COLLECTION).updateOne(
      { _id: orderDoc._id, userId },
      {
        $set: {
          status: 'Confirmed',
          updatedAt: new Date()
        }
      }
    );

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

    const gptlessApiToken = process.env.GPTLESS_API_TOKEN;
    if (!gptlessApiToken) {
      return sendError(res, 500, 'Missing GPTLESS_API_TOKEN environment variable.');
    }

    const templateInvoice = process.env.GPTLESS_TEMPLATE_INVOICE_ID;
    if (!templateInvoice) {
      return sendError(res, 500, 'Missing GPTLESS_TEMPLATE_INVOICE_ID environment variable.');
    }

    const db = getDb();
    const userId = req.session.userId;

    const despatchDoc = await db.collection(USER_DESPATCH_COLLECTION).findOne({
      _id: validation.despatchUuid,
      userId
    });

    if (!despatchDoc) {
      return sendNotFound(res, 'despatch', validation.despatchUuid);
    }

    const linkedOrder = despatchDoc.orderUuid
      ? await db.collection(USER_ORDER_COLLECTION).findOne({ _id: despatchDoc.orderUuid, userId })
      : null;

    const supplierName =
      validation.supplierName ||
      despatchDoc.supplier ||
      (linkedOrder && linkedOrder.supplier) ||
      'Supplier';

    const customerName =
      validation.customerName ||
      despatchDoc.buyer ||
      (linkedOrder && linkedOrder.buyer) ||
      'Customer';

    const supplierAbn = validation.supplierAbn || (linkedOrder && linkedOrder.supplierAbn) || '';
    const customerAbn = validation.customerAbn || (linkedOrder && linkedOrder.customerAbn) || '';

    if (!supplierAbn) {
      return sendError(
        res,
        400,
        'Supplier ABN is required for invoice generation. Provide supplierAbn or store it on the base order.'
      );
    }

    const invoiceLines = deriveInvoiceLinesFromDespatch(despatchDoc, validation.defaultUnitPrice);
    if (!invoiceLines.length) {
      return sendError(res, 400, 'Selected despatch has no deliverable lines for invoice generation.');
    }

    const totals = calculateInvoiceTotals(invoiceLines, validation.gstPercent);

    const customerParty = {
      name: customerName
    };
    if (customerAbn) {
      customerParty.ABN = customerAbn;
    }

    const invoicePayload = {
      templateInvoice,
      InvoiceData: {
        supplier: {
          name: supplierName,
          ABN: supplierAbn
        },
        customer: customerParty,
        issueDate: validation.issueDate,
        dueDate: validation.dueDate,
        totalAmount: totals.totalAmount,
        currency: validation.currency,
        lines: invoiceLines.map((line, index) => ({
          lineId: line.lineId || String(index + 1),
          description: line.description,
          quantity: line.quantity,
          unitPrice: line.unitPrice,
          lineTotal: line.lineTotal
        })),
        gstPercent: validation.gstPercent
      }
    };

    const invoiceXml = await postJsonForXmlResponse(
      GPTLESS_INVOICE_URL,
      invoicePayload,
      'Invoice generation request',
      {
        APItoken: gptlessApiToken
      }
    );

    let invoiceSummary;
    try {
      invoiceSummary = parseInvoiceSummaryFromXml(invoiceXml);
    } catch (parseError) {
      invoiceSummary = {
        displayId: '',
        issueDate: validation.issueDate,
        buyer: customerName,
        total: totals.totalAmount
      };
    }

    const now = new Date();
    const invoiceDoc = {
      _id: randomUUID(),
      userId,
      displayId: invoiceSummary.displayId || 'INV-' + nowUnix(),
      despatchUuid: despatchDoc._id,
      despatchDisplayId: despatchDoc.displayId || despatchDoc._id,
      buyer: invoiceSummary.buyer || customerName,
      total: Number.isFinite(invoiceSummary.total) ? invoiceSummary.total : totals.totalAmount,
      issueDate: invoiceSummary.issueDate || validation.issueDate,
      status: 'Issued',
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

    return res.status(200).json({
      success: true,
      orders: orders.map(mapOrderSummary),
      despatch: despatch.map(mapDespatchSummary),
      invoices: invoices.map(mapInvoiceSummary),
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

    return res.status(200).json({
      success: true,
      orders: orders.map(mapOrderSummary),
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

    const mappedOrder = mapOrderDetail(orderDoc);
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

    return res.status(200).json({
      success: true,
      order: {
        ...mappedOrder,
        orderLines: enrichedOrderLines,
        pendingDespatchLines,
        despatchAdvice
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

    const deleteResult = await db.collection(USER_ORDER_COLLECTION).deleteOne({ _id: uuid, userId });
    if (!deleteResult.deletedCount) {
      return sendNotFound(res, 'order', uuid);
    }

    await db.collection(USER_DESPATCH_COLLECTION).deleteMany({ userId, orderUuid: uuid });

    return res.status(200).json({
      success: true,
      message: 'Order and associated despatch advice deleted successfully.',
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

module.exports = router;

