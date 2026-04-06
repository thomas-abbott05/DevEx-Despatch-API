describe('database module', () => {
  const originalEnv = process.env;
  const originalExit = process.exit;

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    process.env = { ...originalEnv, MONGODB_URI: 'mongodb://localhost:27017/test-db' };
  });

  afterEach(() => {
    process.exit = originalExit;
    process.env = originalEnv;
    jest.restoreAllMocks();
  });

  test('connectToDatabase connects, pings admin db, and returns devex db instance', async () => {
    const mockCommand = jest.fn().mockResolvedValue({ ok: 1 });
    const mockCreateIndex = jest.fn().mockResolvedValue('email_1');
    const mockCollection = jest.fn().mockReturnValue({
      createIndex: mockCreateIndex
    });
    const devexDb = {
      name: 'devex',
      collection: mockCollection
    };
    const mockDb = jest.fn((name) => {
      if (name === 'admin') {
        return { command: mockCommand };
      }
      if (name === 'devex') {
        return devexDb;
      }
      return null;
    });
    const mockConnect = jest.fn().mockResolvedValue(undefined);

    jest.doMock('mongodb', () => ({
      MongoClient: jest.fn().mockImplementation(() => ({
        connect: mockConnect,
        db: mockDb
      })),
      ServerApiVersion: { v1: 'v1' }
    }));
    jest.doMock('dotenv', () => ({ config: jest.fn() }));
    jest.doMock('dns', () => ({ setServers: jest.fn() }));

    const dbModule = require('../database');

    const connectedDb = await dbModule.connectToDatabase();

    expect(mockConnect).toHaveBeenCalledTimes(1);
    expect(mockDb).toHaveBeenCalledWith('admin');
    expect(mockCommand).toHaveBeenCalledWith({ ping: 1 });
    expect(mockDb).toHaveBeenCalledWith('devex');
    expect(mockCollection).toHaveBeenCalledWith('users');
    expect(mockCreateIndex).toHaveBeenCalledWith({ email: 1 }, { unique: true });
    expect(connectedDb).toBe(devexDb);
    expect(dbModule.getDb()).toBe(devexDb);
  });

  test('getDb throws before connectToDatabase is called', () => {
    jest.doMock('mongodb', () => ({
      MongoClient: jest.fn().mockImplementation(() => ({
        connect: jest.fn(),
        db: jest.fn()
      })),
      ServerApiVersion: { v1: 'v1' }
    }));
    jest.doMock('dotenv', () => ({ config: jest.fn() }));
    jest.doMock('dns', () => ({ setServers: jest.fn() }));

    const dbModule = require('../database');

    expect(() => dbModule.getDb()).toThrow('Database not connected. Call connectToDatabase() first.');
  });

  test('connectToDatabase rethrows connection errors', async () => {
    const connectionError = new Error('connect failed');
    const mockConnect = jest.fn().mockRejectedValue(connectionError);

    jest.doMock('mongodb', () => ({
      MongoClient: jest.fn().mockImplementation(() => ({
        connect: mockConnect,
        db: jest.fn()
      })),
      ServerApiVersion: { v1: 'v1' }
    }));
    jest.doMock('dotenv', () => ({ config: jest.fn() }));
    jest.doMock('dns', () => ({ setServers: jest.fn() }));

    const dbModule = require('../database');

    await expect(dbModule.connectToDatabase()).rejects.toThrow('connect failed');
  });

  test('getDbClient returns created Mongo client instance', () => {
    const clientInstance = {
      connect: jest.fn(),
      db: jest.fn()
    };

    jest.doMock('mongodb', () => ({
      MongoClient: jest.fn().mockImplementation(() => clientInstance),
      ServerApiVersion: { v1: 'v1' }
    }));
    jest.doMock('dotenv', () => ({ config: jest.fn() }));
    jest.doMock('dns', () => ({ setServers: jest.fn() }));

    const dbModule = require('../database');

    expect(dbModule.getDbClient()).toBe(clientInstance);
  });

  test('module exits process when MONGODB_URI is missing', () => {
    process.env = { ...originalEnv };
    delete process.env.MONGODB_URI;

    const exitError = new Error('process exited');
    process.exit = jest.fn(() => {
      throw exitError;
    });

    jest.doMock('mongodb', () => ({
      MongoClient: jest.fn(),
      ServerApiVersion: { v1: 'v1' }
    }));
    jest.doMock('dotenv', () => ({ config: jest.fn() }));
    jest.doMock('dns', () => ({ setServers: jest.fn() }));

    expect(() => require('../database')).toThrow(exitError);
    expect(process.exit).toHaveBeenCalledWith(1);
  });
});
