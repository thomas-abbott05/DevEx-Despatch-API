const express = require('express');
const requireSessionAuth = require('../../../middleware/session-auth');

const router = express.Router();

const ORDER_SUMMARIES = [
  {
    uuid: '34ec2376-a8c4-4a59-a307-e64f7aaf1150',
    displayId: 'ORD-2026-001',
    buyer: 'Acme Corp',
    supplier: 'GlobalSupply Ltd',
    lineItems: 4,
    status: 'Pending',
    issueDate: '2026-04-06',
    updatedAt: 1775475600
  },
  {
    uuid: '928919a4-35d5-4d25-bd9f-96d9db217f6f',
    displayId: 'ORD-2026-002',
    buyer: 'Nexus Inc',
    supplier: 'PartnerCo',
    lineItems: 2,
    status: 'Confirmed',
    issueDate: '2026-04-05',
    updatedAt: 1775466000
  },
  {
    uuid: 'f34b6824-2c44-459d-8963-25cd95863c5a',
    displayId: 'ORD-2026-003',
    buyer: 'Skyline Group',
    supplier: 'GlobalSupply Ltd',
    lineItems: 7,
    status: 'In Transit',
    issueDate: '2026-04-04',
    updatedAt: 1775456400
  },
  {
    uuid: '8cab8aa7-27a5-4aa8-88f2-53c532ec6d13',
    displayId: 'ORD-2026-004',
    buyer: 'Meridian LLC',
    supplier: 'FastShip Pty',
    lineItems: 3,
    status: 'Delivered',
    issueDate: '2026-04-03',
    updatedAt: 1775446800
  },
  {
    uuid: '36241dbe-8dbf-412c-8c20-0d9796a29f9f',
    displayId: 'ORD-2026-005',
    buyer: 'Harbor Retail',
    supplier: 'PartnerCo',
    lineItems: 5,
    status: 'Pending',
    issueDate: '2026-04-02',
    updatedAt: 1775437200
  },
  {
    uuid: 'f0dc907d-737d-4c5e-bda3-aa6fed2f31df',
    displayId: 'ORD-2026-006',
    buyer: 'Northwind Traders',
    supplier: 'GlobalSupply Ltd',
    lineItems: 9,
    status: 'Confirmed',
    issueDate: '2026-04-01',
    updatedAt: 1775427600
  }
];

const DESPATCH_SUMMARIES = [
  {
    uuid: '6b17c76a-87cd-4bff-83dc-1257536b6f14',
    displayId: 'DSP-2026-001',
    orderDisplayId: 'ORD-2026-001',
    orderUuid: '34ec2376-a8c4-4a59-a307-e64f7aaf1150',
    carrier: 'FedEx',
    trackingNo: 'FX-10293847',
    status: 'Shipped',
    issueDate: '2026-04-06',
    updatedAt: 1775476200
  },
  {
    uuid: 'b85fa825-bb6e-43ab-85f8-f1a5c7f6f454',
    displayId: 'DSP-2026-002',
    orderDisplayId: 'ORD-2026-002',
    orderUuid: '928919a4-35d5-4d25-bd9f-96d9db217f6f',
    carrier: 'DHL',
    trackingNo: 'DH-29384756',
    status: 'In Transit',
    issueDate: '2026-04-05',
    updatedAt: 1775466600
  },
  {
    uuid: '75f5a5f0-5ca4-4d78-bf22-7dc28a8531fb',
    displayId: 'DSP-2026-003',
    orderDisplayId: 'ORD-2026-003',
    orderUuid: 'f34b6824-2c44-459d-8963-25cd95863c5a',
    carrier: 'UPS',
    trackingNo: 'UP-38475612',
    status: 'Delivered',
    issueDate: '2026-04-04',
    updatedAt: 1775457000
  }
];

const INVOICE_SUMMARIES = [];

function buildDetailSummary(summary) {
  return {
    uuid: summary.uuid,
    displayId: summary.displayId,
    issueDate: summary.issueDate,
    status: summary.status,
    updatedAt: summary.updatedAt
  };
}

function orderDetail(summary) {
  return {
    ...buildDetailSummary(summary),
    buyer: summary.buyer,
    supplier: summary.supplier,
    lineItems: summary.lineItems,
    xml: '<Order><cbc:ID>' + summary.displayId + '</cbc:ID><cbc:UUID>' + summary.uuid + '</cbc:UUID></Order>'
  };
}

function despatchDetail(summary) {
  return {
    ...buildDetailSummary(summary),
    orderDisplayId: summary.orderDisplayId,
    orderUuid: summary.orderUuid,
    carrier: summary.carrier,
    trackingNo: summary.trackingNo,
    xml: '<DespatchAdvice><cbc:ID>' + summary.displayId + '</cbc:ID><cbc:UUID>' + summary.uuid + '</cbc:UUID></DespatchAdvice>'
  };
}

function invoiceDetail(summary) {
  return {
    ...buildDetailSummary(summary),
    despatchDisplayId: summary.despatchDisplayId,
    despatchUuid: summary.despatchUuid,
    buyer: summary.buyer,
    total: summary.total,
    xml: '<Invoice><cbc:ID>' + summary.displayId + '</cbc:ID><cbc:UUID>' + summary.uuid + '</cbc:UUID></Invoice>'
  };
}

function sendNotFound(res, documentType, uuid) {
  return res.status(404).json({
    success: false,
    errors: ['No ' + documentType + ' document found for UUID ' + uuid + '.'],
    'executed-at': Math.floor(Date.now() / 1000)
  });
}

router.use(requireSessionAuth);

router.get('/home-summary', (req, res) => {
  res.status(200).json({
    success: true,
    orders: ORDER_SUMMARIES,
    despatch: DESPATCH_SUMMARIES,
    invoices: INVOICE_SUMMARIES,
    'executed-at': Math.floor(Date.now() / 1000)
  });
});

router.get('/orders', (req, res) => {
  res.status(200).json({
    success: true,
    orders: ORDER_SUMMARIES,
    'executed-at': Math.floor(Date.now() / 1000)
  });
});

router.get('/orders/:uuid', (req, res) => {
  const match = ORDER_SUMMARIES.find((order) => order.uuid === req.params.uuid);
  if (!match) {
    return sendNotFound(res, 'order', req.params.uuid);
  }

  return res.status(200).json({
    success: true,
    order: orderDetail(match),
    'executed-at': Math.floor(Date.now() / 1000)
  });
});

router.get('/despatch', (req, res) => {
  res.status(200).json({
    success: true,
    despatch: DESPATCH_SUMMARIES,
    'executed-at': Math.floor(Date.now() / 1000)
  });
});

router.get('/despatch/:uuid', (req, res) => {
  const match = DESPATCH_SUMMARIES.find((doc) => doc.uuid === req.params.uuid);
  if (!match) {
    return sendNotFound(res, 'despatch', req.params.uuid);
  }

  return res.status(200).json({
    success: true,
    despatch: despatchDetail(match),
    'executed-at': Math.floor(Date.now() / 1000)
  });
});

router.get('/invoices', (req, res) => {
  res.status(200).json({
    success: true,
    invoices: INVOICE_SUMMARIES,
    'executed-at': Math.floor(Date.now() / 1000)
  });
});

router.get('/invoices/:uuid', (req, res) => {
  const match = INVOICE_SUMMARIES.find((doc) => doc.uuid === req.params.uuid);
  if (!match) {
    return sendNotFound(res, 'invoice', req.params.uuid);
  }

  return res.status(200).json({
    success: true,
    invoice: invoiceDetail(match),
    'executed-at': Math.floor(Date.now() / 1000)
  });
});

module.exports = router;
