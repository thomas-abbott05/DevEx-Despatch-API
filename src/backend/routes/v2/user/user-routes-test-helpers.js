const express = require('express');
const session = require('express-session');
const v2Router = require('../index');

function createCursor(records) {
  return {
    sort: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    toArray: jest.fn().mockResolvedValue(records)
  };
}

function createDbMock({ orders = [], despatch = [], invoices = [] } = {}) {
  return {
    collection: jest.fn((name) => {
      if (name === 'user-orders') {
        return {
          find: jest.fn(() => createCursor(orders)),
          findOne: jest.fn(async (query) =>
            orders.find((record) => {
              if (query._id && query.userId) {
                return record._id === query._id && record.userId === query.userId;
              }
              if (query.displayId && query.userId) {
                return record.displayId === query.displayId && record.userId === query.userId;
              }
              return false;
            }) || null
          ),
          insertOne: jest.fn(),
          updateOne: jest.fn(),
          deleteOne: jest.fn(async (query) => {
            const index = orders.findIndex((record) => record._id === query._id && record.userId === query.userId);
            if (index === -1) {
              return { deletedCount: 0 };
            }

            orders.splice(index, 1);
            return { deletedCount: 1 };
          })
        };
      }

      if (name === 'user-despatch-advice') {
        return {
          find: jest.fn(() => createCursor(despatch)),
          findOne: jest.fn(async (query) =>
            despatch.find((record) => record._id === query._id && record.userId === query.userId) || null
          ),
          deleteMany: jest.fn(async (query) => {
            const beforeCount = despatch.length;
            const filtered = despatch.filter(
              (record) => !(record.userId === query.userId && record.orderUuid === query.orderUuid)
            );

            despatch.splice(0, despatch.length, ...filtered);
            return { deletedCount: beforeCount - despatch.length };
          }),
          replaceOne: jest.fn()
        };
      }

      if (name === 'user-invoices') {
        return {
          find: jest.fn(() => createCursor(invoices)),
          findOne: jest.fn(async (query) =>
            invoices.find((record) => record._id === query._id && record.userId === query.userId) || null
          ),
          insertOne: jest.fn()
        };
      }

      throw new Error('Unexpected collection access: ' + name);
    })
  };
}

function seedDefaultData() {
  const now = new Date('2026-04-06T10:00:00.000Z');

  return {
    orders: [
      {
        _id: '34ec2376-a8c4-4a59-a307-e64f7aaf1150',
        userId: 'test-user',
        displayId: 'ORD-2026-001',
        buyer: 'Acme Corp',
        supplier: 'GlobalSupply Ltd',
        lineItems: 2,
        status: 'Pending',
        issueDate: '2026-04-06',
        updatedAt: now,
        generatedOrderXml: '<Order />',
        orderLines: []
      }
    ],
    despatch: [
      {
        _id: '6b17c76a-87cd-4bff-83dc-1257536b6f14',
        userId: 'test-user',
        displayId: 'DSP-2026-001',
        orderDisplayId: 'ORD-2026-001',
        orderUuid: '34ec2376-a8c4-4a59-a307-e64f7aaf1150',
        carrier: 'FedEx',
        trackingNo: 'FX-10293847',
        status: 'Shipped',
        issueDate: '2026-04-06',
        updatedAt: now,
        despatchXml: '<DespatchAdvice />',
        lines: []
      }
    ],
    invoices: []
  };
}

function startServer() {
  const app = express();
  app.use(session({
    secret: 'test-secret',
    resave: false,
    saveUninitialized: false
  }));

  app.post('/test-login', (req, res) => {
    req.session.userId = 'test-user';
    res.status(204).send();
  });

  app.use('/api/v2', v2Router);

  return new Promise((resolve) => {
    const server = app.listen(0, () => {
      const { port } = server.address();
      resolve({
        server,
        baseUrl: 'http://127.0.0.1:' + port
      });
    });
  });
}

module.exports = {
  createDbMock,
  seedDefaultData,
  startServer
};