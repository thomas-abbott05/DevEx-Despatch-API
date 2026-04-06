const express = require('express');
const userRoutes = require('./user/user-routes');

const router = express.Router();

router.get('/health', (req, res) => {
  res.send({
    success: true,
    status: 'healthy',
    'executed-at': Math.floor(Date.now() / 1000)
  });
});

router.use('/user', userRoutes);

module.exports = router;
