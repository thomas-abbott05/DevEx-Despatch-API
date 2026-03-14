const apiKeyAuth = require('../apiKeyAuth');
const { getDb } = require('../../database');
const { cloneElement } = require('react');
const { json } = require('express');

jest.mock('../../database');

describe('apiKeyAuth middleware', () => {
    test('Missing API key: returns 401', async () => {
        const req = {
            header: jest.fn().mockReturnValue(undefined)
        };

        const res = { 
            status: jest.fn().mockReturnThis(),
            json: jest.fn()
        };

        const next = jest.fn();

        await apiKeyAuth(req, res, next);

        expect(res.status).toHaveBeenCalledWith(401);
        expect(next).not.toHaveBeenCalled();
    });

    test('Invalid API key: returns 401', async () => {
        const req = {
            header: jest.fn().mockReturnValue("bad-key")
        };

        const res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn()
        };

        const next = jest.fn();

        const mockDb = {
            collection: () => ({
                findOne: jest.fn().mockResolvedValue(null)
            })
        };

        getDb.mockReturnValue(mockDb);

        await apiKeyAuth(req, res, next);

        expect(res.status).toHaveBeenCalledWith(401);
        expect(next).not.toHaveBeenCalled();
    });

    test('Valid API key: calls next()', async () => {
        const req = {
            header: jest.fn().mockReturnValue("valid-key")
        };

        const res = {};

        const next = jest.fn();

        const mockDb = {
            collection: () => ({
                findOne: jest.fn().mockResolvedValue({
                    key: "valid-key",
                    owner: "devex-team:"
                })
            })
        };

        getDb.mockReturnValue(mockDb);

        await apiKeyAuth(req, res, next);

        expect(next).toHaveBeenCalled();
    });

    test("Database error: returns 500", async () => {
        const req = {
            header: jest.fn().mockReturnValue("vaid-key")
        };
        
        const res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn()
        };

        const next = jest.fn();

        const mockDb = {
            collection: () => ({
                findOne: jest.fn().mockRejectedValue(new Error("DB crash"))
            })
        };

        getDb.mockReturnValue(mockDb);

        await apiKeyAuth(req, res, next);

        expect(res.status).toHaveBeenCalledWith(500);
    });
});