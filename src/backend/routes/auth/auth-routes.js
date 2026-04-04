const express = require('express');
const bcrypt = require('bcryptjs');
const { ObjectId } = require('mongodb');
const { getDb } = require('../../database');
const { isValidUuid } = require('../../validators/common/basic-xml-validator-service');
const requireSessionAuth = require('../../middleware/session-auth');

const router = express.Router();
const jsonParser = express.json({ limit: '1mb' });
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SESSION_COOKIE_NAME = 'devex.sid';

function nowUnix() {
  return Math.floor(Date.now() / 1000);
}

function normaliseEmail(email) {
  if (typeof email !== 'string') {
    return '';
  }

  return email.trim().toLowerCase();
}

function sanitiseText(value) {
  if (typeof value !== 'string') {
    return '';
  }

  return value.trim();
}

function sanitiseProfilePhotoUuid(value) {
  if (value === undefined || value === null) {
    return null;
  }

  const trimmed = sanitiseText(value);
  if (!trimmed) {
    return null;
  }

  return trimmed;
}

function buildSafeUser(userDoc) {
  return {
    id: userDoc._id.toString(),
    email: userDoc.email,
    profilePhotoUuid: userDoc.profilePhotoUuid || null,
    firstName: userDoc.firstName,
    lastName: userDoc.lastName
  };
}

function validateRegistrationInput(payload) {
  const errors = [];

  const email = normaliseEmail(payload?.email);
  const password = typeof payload?.password === 'string' ? payload.password : '';
  const firstName = sanitiseText(payload?.firstName);
  const lastName = sanitiseText(payload?.lastName);
  const profilePhotoUuid = sanitiseProfilePhotoUuid(payload?.profilePhotoUuid);

  if (!email) {
    errors.push('Missing email in request body.');
  } else if (!EMAIL_REGEX.test(email)) {
    errors.push('Invalid email format.');
  }

  if (!password) {
    errors.push('Missing password in request body.');
  } else if (password.length < 8) {
    errors.push('Password must be at least 8 characters long.');
  }

  if (!firstName) {
    errors.push('Missing firstName in request body.');
  } else if (firstName.length > 80) {
    errors.push('firstName must be 80 characters or less.');
  }

  if (!lastName) {
    errors.push('Missing lastName in request body.');
  } else if (lastName.length > 80) {
    errors.push('lastName must be 80 characters or less.');
  }

  if (profilePhotoUuid && !isValidUuid(profilePhotoUuid)) {
    errors.push('profilePhotoUuid must be a valid UUID when provided.');
  }

  return {
    errors,
    data: {
      email,
      password,
      profilePhotoUuid,
      firstName,
      lastName
    }
  };
}

function validateLoginInput(payload) {
  const errors = [];

  const email = normaliseEmail(payload?.email);
  const password = typeof payload?.password === 'string' ? payload.password : '';

  if (!email) {
    errors.push('Missing email in request body.');
  } else if (!EMAIL_REGEX.test(email)) {
    errors.push('Invalid email format.');
  }

  if (!password) {
    errors.push('Missing password in request body.');
  }

  return { errors, data: { email, password } };
}

function regenerateSession(req) {
  return new Promise((resolve, reject) => {
    req.session.regenerate((error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });
}

function saveSession(req) {
  return new Promise((resolve, reject) => {
    req.session.save((error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });
}

router.post('/register', jsonParser, async (req, res) => {
  try {
    if (!req.body) {
      return res.status(400).json({
        errors: ['Missing request body. Raw JSON object expected.'],
        'executed-at': nowUnix()
      });
    }

    const { errors, data } = validateRegistrationInput(req.body);
    if (errors.length > 0) {
      return res.status(400).json({
        errors,
        'executed-at': nowUnix()
      });
    }

    const db = getDb();
    const usersCollection = db.collection('users');

    const existingEmail = await usersCollection.findOne({ email: data.email }, { projection: { _id: 1 } });
    if (existingEmail) {
      return res.status(400).json({
        errors: ['Email is already registered.'],
        'executed-at': nowUnix()
      });
    }

    const passwordHash = await bcrypt.hash(data.password, 10);
    const createdAt = nowUnix();

    const result = await usersCollection.insertOne({
      email: data.email,
      passwordHash,
      profilePhotoUuid: data.profilePhotoUuid,
      firstName: data.firstName,
      lastName: data.lastName,
      createdAt,
      updatedAt: createdAt,
      lastLoginAt: null
    });

    const createdUser = await usersCollection.findOne({ _id: result.insertedId });

    return res.status(201).json({
      message: 'User registered successfully.',
      user: buildSafeUser(createdUser),
      'executed-at': nowUnix()
    });
  } catch (error) {
    if (error?.code === 11000) {
      return res.status(400).json({
        errors: ['A user with this email already exists.'],
        'executed-at': nowUnix()
      });
    }

    console.error('Error registering user:', error);
    return res.status(500).json({
      errors: ['Internal server error'],
      'executed-at': nowUnix()
    });
  }
});

router.post('/login', jsonParser, async (req, res) => {
  try {
    if (!req.body) {
      return res.status(400).json({
        errors: ['Missing request body. Raw JSON object expected.'],
        'executed-at': nowUnix()
      });
    }

    const { errors, data } = validateLoginInput(req.body);
    if (errors.length > 0) {
      return res.status(400).json({
        errors,
        'executed-at': nowUnix()
      });
    }

    const db = getDb();
    const usersCollection = db.collection('users');

    const user = await usersCollection.findOne({ email: data.email });
    if (!user) {
      return res.status(401).json({
        errors: ['Invalid email or password.'],
        'executed-at': nowUnix()
      });
    }

    const passwordMatches = await bcrypt.compare(data.password, user.passwordHash);
    if (!passwordMatches) {
      return res.status(401).json({
        errors: ['Invalid email or password.'],
        'executed-at': nowUnix()
      });
    }

    if (!req.session) {
      return res.status(500).json({
        errors: ['Session middleware is not configured.'],
        'executed-at': nowUnix()
      });
    }

    await regenerateSession(req);

    req.session.userId = user._id.toString();
    req.session.email = user.email;
    req.session.loggedInAt = nowUnix();

    await saveSession(req);

    await usersCollection.updateOne(
      { _id: user._id },
      {
        $set: {
          lastLoginAt: nowUnix(),
          updatedAt: nowUnix()
        }
      }
    );

    return res.status(200).json({
      message: 'Login successful.',
      user: buildSafeUser(user),
      'executed-at': nowUnix()
    });
  } catch (error) {
    console.error('Error logging in user:', error);
    return res.status(500).json({
      errors: ['Internal server error'],
      'executed-at': nowUnix()
    });
  }
});

router.get('/session', async (req, res) => {
  try {
    if (!req.session || !req.session.userId) {
      return res.status(401).json({
        errors: ['Not authenticated. Please log in.'],
        'executed-at': nowUnix()
      });
    }

    const db = getDb();
    const usersCollection = db.collection('users');

    if (!ObjectId.isValid(req.session.userId)) {
      return res.status(401).json({
        errors: ['Not authenticated. Please log in.'],
        'executed-at': nowUnix()
      });
    }

    const user = await usersCollection.findOne({ _id: new ObjectId(req.session.userId) });

    if (!user) {
      return res.status(401).json({
        errors: ['Not authenticated. Please log in.'],
        'executed-at': nowUnix()
      });
    }

    return res.status(200).json({
      user: buildSafeUser(user),
      'executed-at': nowUnix()
    });
  } catch (error) {
    console.error('Error checking session:', error);
    return res.status(500).json({
      errors: ['Internal server error'],
      'executed-at': nowUnix()
    });
  }
});

router.post('/logout', requireSessionAuth, (req, res) => {
  req.session.destroy((error) => {
    if (error) {
      console.error('Error logging out user:', error);
      return res.status(500).json({
        errors: ['Internal server error'],
        'executed-at': nowUnix()
      });
    }

    res.clearCookie(SESSION_COOKIE_NAME);
    return res.status(200).json({
      message: 'Logout successful.',
      'executed-at': nowUnix()
    });
  });
});

module.exports = router;
