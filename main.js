const express = require('express')
const https = require('https')
const os = require('os')
const fs = require('fs')
const swaggerUi = require('swagger-ui-express')
const path = require('path')
const swaggerSpecJSON = require('./swagger.json')
const dbModule = require('./database.js')

const app = express()

// Initialize database connection
let db = null;
(async () => {
  await dbModule.connectToDatabase();
  db = dbModule.getDb();
})().catch(console.error);

var PORT = 80;
const API_VERSION = 'v1';
const STARTED_AT = new Date();
var HEALTHY = true;

// Serve static files from public directory
app.use(express.static(path.join(__dirname, 'public')));

// Set up Swagger UI
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpecJSON));

app.get('/api/v1/health', (req, res) => {
  res.send({
    status: (HEALTHY ? 'healthy' : 'error'),
    uptime: Math.floor((Date.now() - STARTED_AT.getTime()) / 1000),
    version: API_VERSION,
    timestamp: Math.floor(Date.now() / 1000)
  });
});

app.get('/api/v1/dbtest', async (req, res) => { // note that routes using database access should be asynchronous
  try {
    const collection = db.collection('test-collection');
    const result = await collection.insertOne({ test: 'This is a test document', timestamp: new Date() });
    res.send({ success: true, insertedId: result.insertedId });
  } catch (error) {
    console.error('Error inserting document:', error);
    res.status(500).send({ success: false, error: 'Database error' });
  }
});

// Enable SSL if in production environment
const CERT_PATH = "/etc/letsencrypt/live/devex.cloud.tcore.network/fullchain.pem";
const KEY_PATH = "/etc/letsencrypt/live/devex.cloud.tcore.network/privkey.pem";
var CERT = null;
var KEY = null;
var SSL_ENABLED = false;
if (os.platform() === 'linux') { // ec2 will be ubuntu
  if (fs.existsSync(CERT_PATH) && fs.existsSync(KEY_PATH)) {
    SSL_ENABLED = true;
    CERT = fs.readFileSync(CERT_PATH);
    KEY = fs.readFileSync(KEY_PATH);
    PORT = 443;
    console.log('SSL certificate and key found. SSL is enabled.');
  } else {
    console.warn('SSL certificate or key not found. Ensure the EC2 instance has SSL certificates installed via certbot (run certbot certonly). SSL is disabled.');
  }
} else {
  console.warn('Non-Linux platform detected. Most likely a development environment - SSL is disabled.');
}

if (SSL_ENABLED) {
  https.createServer({ key: KEY, cert: CERT }, app).listen(PORT, () => {
    console.log(`HTTPS Server running on port ${PORT}`);
  });
} else {
  app.listen(PORT, () => {
    console.log(`HTTP Server running on port ${PORT}`);
  });
}