const express = require('express');
const crypto = require('crypto');
const { getDb } = require('../database');

const router = express.Router();
const MASTER_KEY = process.env.MASTER_API_KEY;

const jsonParser = express.json({
  limit: '1mb'
});

function generateApiKey() {
  return crypto.randomBytes(32).toString('hex');
}

async function checkMasterKey(req, res, next) {
  const apiKey = req.header('Api-Key');

  if (!apiKey) {
    return res.status(401).json({
      errors: ['Missing API key header. A valid master key is required for this endpoint.'],
      'executed-at': Math.floor(Date.now() / 1000)
    });
  }

  if (apiKey !== MASTER_KEY) {
    return res.status(401).json({
      errors: ['Invalid master API key'],
      'executed-at': Math.floor(Date.now() / 1000)
    });
  }

  next();
}

// All API key management routes require the master key.
router.use(checkMasterKey);

router.post('/create', jsonParser, async (req, res) => {
  try {
    const db = getDb();

    if (!req.body) {
      return res.status(400).send({
        errors: ['Missing request body. Raw JSON object expected.'],
        'executed-at': Math.floor(Date.now() / 1000)
      });
    }

    const teamName = req.body.teamName;
    if (!teamName) {
      return res.status(400).send({
        errors: ['Missing teamName in request body'],
        'executed-at': Math.floor(Date.now() / 1000)
      });
    }

    const contactEmail = req.body.contactEmail;
    if (!contactEmail) {
      return res.status(400).send({
        errors: ['Missing contactEmail in request body'],
        'executed-at': Math.floor(Date.now() / 1000)
      });
    }

    const contactName = req.body.contactName;
    if (!contactName) {
      return res.status(400).send({
        errors: ['Missing contactName in request body'],
        'executed-at': Math.floor(Date.now() / 1000)
      });
    }
    // ensure the email is unique and we have not already issued a key to this contact email
    const existingKey = await db.collection('api-keys').findOne({ contactEmail: contactEmail });
    if (existingKey) {
      return res.status(400).send({
        errors: ['An API key has already been issued for this contact email'],
        'executed-at': Math.floor(Date.now() / 1000)
      });
    }
    
    const apiKey = generateApiKey();
    const newKey = {
      _id: apiKey,
      key: apiKey,
      teamName: teamName,
      contactEmail: contactEmail,
      contactName: contactName,
      createdAt: Math.floor(Date.now() / 1000)
    };

    await db.collection('api-keys').insertOne(newKey);

    res.send({
      apiKey,
      'executed-at': Math.floor(Date.now() / 1000)
    });
  } catch (error) {
    console.error('Error creating API key:', error);

    res.status(500).send({
      errors: ['Internal server error'],
      'executed-at': Math.floor(Date.now() / 1000)
    });
  }
});

router.get('/list', async (req, res) => {
  try {
    const db = getDb();
    const keys = await db.collection('api-keys').find({}).toArray();

    res.send({
      results: keys,
      'executed-at': Math.floor(Date.now() / 1000)
    });
  } catch (error) {
    console.error('Error fetching API keys:', error);

    res.status(500).send({
      errors: ['Internal server error'],
      'executed-at': Math.floor(Date.now() / 1000)
    });
  }
});

router.get('/retrieve/:key', async (req, res) => {
  try {
    const db = getDb();
    const key = req.params.key;
    const keyData = await db.collection('api-keys').findOne({ key: key });

    if (!keyData) {
      return res.status(404).send({
        errors: ['API key not found'],
        'executed-at': Math.floor(Date.now() / 1000)
      });
    }

    return res.status(200).send(keyData);
  } catch (error) {
    console.error('Error fetching API key data:', error);

    res.status(500).send({
      errors: ['Internal server error'],
      'executed-at': Math.floor(Date.now() / 1000)
    });
  }
});

router.delete('/delete/:key', jsonParser, async (req, res) => {
  try {
    const db = getDb();
    const key = req.params.key;

    const result = await db.collection('api-keys').deleteOne({ key: key });
    if (result.deletedCount === 0) {
      return res.status(404).send({
        errors: ['API key not found'],
        'executed-at': Math.floor(Date.now() / 1000)
      });
    }

    res.send({
      errors: [],
      'executed-at': Math.floor(Date.now() / 1000)
    });
  } catch (error) {
    console.error('Error deleting API key:', error);

    res.status(500).send({
      errors: ['Internal server error'],
      'executed-at': Math.floor(Date.now() / 1000)
    });
  }
});

module.exports = router;
