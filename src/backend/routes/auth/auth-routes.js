const express = require('express');
const bcrypt = require('bcryptjs');
const { ObjectId } = require('mongodb');
const { getDb } = require('../../database');
const requireSessionAuth = require('../../middleware/session-auth');

const router = express.Router();
const jsonParser = express.json({ limit: '1mb' });
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SESSION_COOKIE_NAME = 'devex.sid';
const TURNSTILE_VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
const TURNSTILE_TEST_SECRET = '1x0000000000000000000000000000000AA';

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

function buildSafeUser(userDoc) {
  return {
    id: userDoc._id.toString(),
    email: userDoc.email,
    profilePhotoUuid: userDoc.profilePhotoUuid || null,
    firstName: userDoc.firstName,
    lastName: userDoc.lastName
  };
}

function getTurnstileSecret() {
  if (process.env.CLOUDFLARE_TURNSTILE_SECRET_KEY) {
    return process.env.CLOUDFLARE_TURNSTILE_SECRET_KEY;
  }

  if (process.env.NODE_ENV !== 'production') {
    return TURNSTILE_TEST_SECRET;
  }

  return null;
}

async function verifyTurnstileToken(token, remoteIp) {
  const secret = getTurnstileSecret();
  if (!secret) {
    return { success: false, errorCodes: ['missing-input-secret'] };
  }

  const payload = new URLSearchParams({
    secret,
    response: token
  });

  if (remoteIp) {
    payload.append('remoteip', remoteIp);
  }

  const response = await fetch(TURNSTILE_VERIFY_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: payload
  });

  const verificationPayload = await response.json().catch(() => null);
  if (!response.ok || !verificationPayload) {
    return { success: false, errorCodes: ['verification-request-failed'] };
  }

  return {
    success: Boolean(verificationPayload.success),
    errorCodes: Array.isArray(verificationPayload['error-codes'])
      ? verificationPayload['error-codes']
      : []
  };
}

function validateRegistrationInput(payload) {
  const errors = [];

  const email = normaliseEmail(payload?.email);
  const password = typeof payload?.password === 'string' ? payload.password : '';
  const firstName = sanitiseText(payload?.firstName);
  const lastName = sanitiseText(payload?.lastName);
  const turnstileToken = sanitiseText(payload?.turnstileToken);

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

  if (!turnstileToken) {
    errors.push('Missing turnstileToken in request body.');
  }

  return {
    errors,
    data: {
      email,
      password,
      firstName,
      lastName,
      turnstileToken
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

    const turnstileResult = await verifyTurnstileToken(data.turnstileToken, req.ip);
    if (!turnstileResult.success) {
      return res.status(400).json({
        errors: ['Turnstile verification failed. Please try again.'],
        details: turnstileResult.errorCodes,
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
      profilePhotoUuid: null,
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
