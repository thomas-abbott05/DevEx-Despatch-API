const os = require('os');
const fs = require('fs');

const CERT_PATH = "/etc/letsencrypt/live/devex.cloud.tcore.network/fullchain.pem";
const KEY_PATH = "/etc/letsencrypt/live/devex.cloud.tcore.network/privkey.pem";

class SSLConfig {
  constructor() {
    this.cert = null;
    this.key = null;
    this.enabled = false;
    this.port = 80;
    this.init();
  }

  init() {
    if (os.platform() === 'linux') { // ec2 will be ubuntu
      if (fs.existsSync(CERT_PATH) && fs.existsSync(KEY_PATH)) {
        this.enabled = true;
        this.cert = fs.readFileSync(CERT_PATH);
        this.key = fs.readFileSync(KEY_PATH);
        this.port = 443;
        console.log('SSL certificate and key found. SSL is enabled.');
      } else {
        console.warn('SSL certificate or key not found. Ensure the EC2 instance has SSL certificates installed via certbot (run certbot certonly). SSL is disabled.');
      }
    } else {
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