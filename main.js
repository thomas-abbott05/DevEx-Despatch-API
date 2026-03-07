const express = require('express')
const app = express()
const swaggerUi = require('swagger-ui-express')
const path = require('path')
const swaggerSpecJSON = require('./swagger.json')

const PORT = 80
const API_VERSION = 'v1'
const STARTED_AT = new Date()
var HEALTHY = true

// Serve static files from public directory
app.use(express.static(path.join(__dirname, 'public')))

// Set up Swagger UI
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpecJSON))

app.get('/api/v1/health', (req, res) => {
  res.send({
    status: (HEALTHY ? 'healthy' : 'error'),
    uptime: Math.floor((Date.now() - STARTED_AT.getTime()) / 1000),
    version: API_VERSION,
    timestamp: Math.floor(Date.now() / 1000)
  })
})

app.listen(PORT, () => {
  console.log(`Despatch API web server started on port: ${PORT}`)
})