const os = require('os');
const fs = require('fs');

const CERT_PATH = "/etc/letsencrypt/live/devex.cloud.tcore.network/fullchain.pem";
const KEY_PATH = "/etc/letsencrypt/live/devex.cloud.tcore.network/privkey.pem";
const DEFAULT_HTTP_PORT = 80;
const DEFAULT_HTTPS_PORT = 443;
const DEFAULT_LOCAL_PORT = 80;

function resolvePort(rawPort, fallbackPort) {
  const parsedPort = Number.parseInt(rawPort, 10);
  if (Number.isInteger(parsedPort) && parsedPort > 0) {
    return parsedPort;
  }

  return fallbackPort;
}

class SSLConfig {
  constructor() {
    this.cert = null;
    this.key = null;
    this.enabled = false;
    this.port = resolvePort(process.env.PORT, DEFAULT_HTTP_PORT);
    this.init();
  }

  init() {
    if (os.platform() === 'linux') { // ec2 will be ubuntu
      if (fs.existsSync(CERT_PATH) && fs.existsSync(KEY_PATH)) {
        this.enabled = true;
        this.cert = fs.readFileSync(CERT_PATH);
        this.key = fs.readFileSync(KEY_PATH);
        this.port = resolvePort(process.env.HTTPS_PORT, DEFAULT_HTTPS_PORT);
        console.log('SSL certificate and key found. SSL is enabled.');
      } else {
        this.port = resolvePort(process.env.PORT, DEFAULT_HTTP_PORT);
        console.warn('SSL certificate or key not found. Ensure the EC2 instance has SSL certificates installed via certbot (run certbot certonly). SSL is disabled.');
      }
    } else {
      this.port = resolvePort(process.env.PORT, DEFAULT_LOCAL_PORT);
      console.warn('Non-Linux platform detected. Most likely a development environment - SSL is disabled.');
    }
  }

  getConfig() {
    return {
      enabled: this.enabled,
      cert: this.cert,
      key: this.key,
      port: this.port
    };
  }
}

module.exports = SSLConfig;