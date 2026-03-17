
class ConfigOptions {
  config = {
    host: process.env.EMAIL_HOST,
    port: process.env.EMAIL_PORT,
    secure: false, // use TLS
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASSWORD
    },
    tls: {
      rejectUnauthorized: true,
      servername: process.env.EMAIL_HOST,
      minVersion: 'TLSv1.2'
    }
  }
}

module.exports = {
  ConfigOptions
}