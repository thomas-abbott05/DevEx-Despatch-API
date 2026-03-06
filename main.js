const express = require('express')
const swaggerUi = require('swagger-ui-express')
const swaggerSpecJSON = require('./swagger.json')

const app = express()
const port = 3000

// Set up Swagger UI
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpecJSON))

app.get('/', (req, res) => {
  res.send('Hello World!')
})

app.listen(port, () => {
  console.log(`Despatch API web server started on port: ${port}`)
})