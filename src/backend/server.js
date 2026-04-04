const https = require('https');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const SSLConfig = require('./config/ssl-config');
const { createExpressApp, setupErrorHandling } = require('./config/server-config');
const { preloadEmailTemplates } = require('./config/email-template-service');
const { connectToDatabase, getDbClient } = require('./database');
const apiRouter = require('./routes');

const REQUIRED_ENV_VARS = [
  'MONGODB_URI',
  'MASTER_API_KEY',
  'EMAIL_HOST',
  'EMAIL_PORT',
  'EMAIL_USER',
  'EMAIL_PASSWORD',
  'DEFAULT_DOCS_URL'
];

class DevExServer {
  constructor() {
    this.app = null;
    this.sslConfig = null;
    this.server = null;
  }

  async initialise() {
    try {      
      await connectToDatabase();
      console.log('Database connection established');

      REQUIRED_ENV_VARS.forEach(v => {
        if (!process.env[v]) {
          throw new Error(`Missing required environment variable: ${v}`);
        }
      });

      this.app = createExpressApp();

      if (!process.env.SESSION_SECRET) {
        console.warn('SESSION_SECRET is not set. Falling back to prototype default secret.');
      }

      this.app.use(session({
        name: 'devex.sid',
        secret: process.env.SESSION_SECRET || 'devex-prototype-secret-change-me',
        resave: false,
        saveUninitialized: false,
        store: MongoStore.create({
          client: getDbClient(),
          dbName: 'devex',
          collectionName: 'sessions',
          ttl: 60 * 60 * 24 * 7
        }),
        cookie: {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          maxAge: 1000 * 60 * 60 * 24 * 7
        }
      }));

      preloadEmailTemplates();
      
      this.sslConfig = new SSLConfig();

      this.app.use('/api/v1', apiRouter);

      // Setup error handling for 404s and 500s etc (must be after route definitions!)
      setupErrorHandling(this.app);

      console.log('Server initialised successfully');
    } catch (error) {
      console.error('Failed to initialise server:', error);
      throw error;
    }
  }

  start() {
    const { port, enabled: sslEnabled, cert, key } = this.sslConfig.getConfig();

    if (sslEnabled) {
      this.server = https.createServer({ key, cert }, this.app).listen(port, () => {
        console.log(`HTTPS Server running on port ${port}`);
      });
    } else {
      this.server = this.app.listen(port, () => {
        console.log(`HTTP Server running on port ${port}`);
      });
    }

    return this.server;
  }

  async stop() {
    if (this.server) {
      return new Promise((resolve) => {
        this.server.close(() => {
          console.log('Server stopped');
          resolve();
        });
      });
    }
  }
}

module.exports = DevExServer;