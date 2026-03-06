const express = require('express')
const swaggerUi = require('swagger-ui-express')
const path = require('path')
const swaggerSpecJSON = require('./swagger.json')

const app = express()
const PORT = 3000

// Serve static files from public directory
app.use(express.static(path.join(__dirname, 'public')))

// Set up Swagger UI
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpecJSON))

app.get('/api/v1/hello', (req, res) => {
  res.send('Hello World!')
})

app.listen(PORT, () => {
  console.log(`Despatch API web server started on port: ${PORT}`)
})