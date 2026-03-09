const https = require('https');
const SSLConfig = require('./config/ssl-config');
const { createExpressApp, setupErrorHandling } = require('./config/server-config');
const { connectToDatabase } = require('./database');
const apiRouter = require('./api-routes');

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

      this.app = createExpressApp();
      
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