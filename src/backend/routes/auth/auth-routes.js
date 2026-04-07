const express = require('express');
const bcrypt = require('bcryptjs');
const { ObjectId } = require('mongodb');
const { createHash, randomBytes, randomInt, timingSafeEqual } = require('node:crypto');
const nodemailer = require('nodemailer');
const { getDb } = require('../../database');
const requireSessionAuth = require('../../middleware/session-auth');
const { ConfigOptions } = require('../../config/nodemailer-config');
const { renderEmailTemplate } = require('../../config/email-template-service');

const router = express.Router();
const jsonParser = express.json({ limit: '1mb' });
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SESSION_COOKIE_NAME = 'devex.sid';
const TURNSTILE_VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
const TURNSTILE_TEST_SECRET = '1x0000000000000000000000000000000AA';
const EMAIL_VERIFICATION_CODE_EXPIRY_SECONDS = 15 * 60;
const PASSWORD_RESET_TOKEN_EXPIRY_SECONDS = 15 * 60;
const REQUEST_COOLDOWN_SECONDS = 60;
const PASSWORD_COMPLEXITY_REGEX = /^(?=.*[A-Za-z])(?=.*\d).+$/;

function nowUnix() {
  return Math.floor(Date.now() / 1000);
}

function hashValue(value) {
  return createHash('sha256').update(String(value)).digest('hex');
}

function safeEqualHash(left, right) {
  if (typeof left !== 'string' || typeof right !== 'string' || left.length !== right.length) {
    return false;
  }

  return timingSafeEqual(Buffer.from(left, 'hex'), Buffer.from(right, 'hex'));
}

function generateVerificationCode() {
  return String(randomInt(0, 1000000)).padStart(6, '0');
}

function generatePasswordResetToken() {
  return randomBytes(32).toString('hex');
}

function hasExpired(expiryUnix, currentUnix) {
  if (typeof expiryUnix !== 'number') {
    return true;
  }

  return expiryUnix <= currentUnix;
}

function isWithinCooldown(lastRequestedAt, currentUnix) {
  if (typeof lastRequestedAt !== 'number') {
    return false;
  }

  return currentUnix - lastRequestedAt < REQUEST_COOLDOWN_SECONDS;
}

function buildResetPasswordUrl(token) {
  const fallback = `/reset-password?token=${encodeURIComponent(token)}`;
  const configuredBaseUrl = sanitiseText(process.env.BASE_URL);

  if (!configuredBaseUrl) {
    return fallback;
  }

  try {
    return new URL(fallback, configuredBaseUrl).toString();
  } catch {
    return fallback;
  }
}

async function sendAuthEmail({ to, subject, templateName, values }) {
  const transporter = nodemailer.createTransport(new ConfigOptions().config);
  const html = renderEmailTemplate(templateName, values);

  await transporter.sendMail({
    from: {
      name: 'DevEx Despatch API',
      address: process.env.EMAIL_USER
    },
    to,
    cc: 'devex@platform.tcore.network',
    subject,
    html
  });
}

async function sendVerificationCodeEmail(email, firstName, code) {
  const expiresAt = nowUnix() + EMAIL_VERIFICATION_CODE_EXPIRY_SECONDS;

  await sendAuthEmail({
    to: email,
    subject: 'Verify your DevEx account',
    templateName: 'registration-verification-code.html',
    values: {
      firstName,
      code,
      expiresMinutes: Math.floor(EMAIL_VERIFICATION_CODE_EXPIRY_SECONDS / 60),
      supportEmail: process.env.EMAIL_USER,
      baseURL: process.env.BASE_URL,
      expiresAt
    }
  });
}

async function sendPasswordResetEmail(email, firstName, resetUrl) {
  await sendAuthEmail({
    to: email,
    subject: 'Reset your DevEx password',
    templateName: 'password-reset-magic-link.html',
    values: {
      firstName,
      resetUrl,
      expiresMinutes: Math.floor(PASSWORD_RESET_TOKEN_EXPIRY_SECONDS / 60),
      supportEmail: process.env.EMAIL_USER,
      baseURL: process.env.BASE_URL
    }
  });
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

function isProductionMode() {
  return process.env.NODE_ENV === 'production';
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

function validateRegistrationInput(payload, options = {}) {
  const { requireTurnstileToken = false } = options;
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
  } else if (!PASSWORD_COMPLEXITY_REGEX.test(password)) {
    errors.push('Password must include at least one letter and one number.');
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

  if (requireTurnstileToken && !turnstileToken) {
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

function validateVerificationRequestInput(payload) {
  const email = normaliseEmail(payload?.email);
  const errors = [];

  if (!email) {
    errors.push('Missing email in request body.');
  } else if (!EMAIL_REGEX.test(email)) {
    errors.push('Invalid email format.');
  }

  return { errors, data: { email } };
}

function validateVerifyEmailInput(payload) {
  const errors = [];
  const email = normaliseEmail(payload?.email);
  const code = sanitiseText(payload?.code);

  if (!email) {
    errors.push('Missing email in request body.');
  } else if (!EMAIL_REGEX.test(email)) {
    errors.push('Invalid email format.');
  }

  if (!code) {
    errors.push('Missing code in request body.');
  } else if (!/^\d{6}$/.test(code)) {
    errors.push('Verification code must be a 6 digit number.');
  }

  return { errors, data: { email, code } };
}

function validatePasswordResetRequestInput(payload) {
  return validateVerificationRequestInput(payload);
}

function validateResetPasswordInput(payload) {
  const errors = [];
  const token = sanitiseText(payload?.token);
  const password = typeof payload?.password === 'string' ? payload.password : '';

  if (!token) {
    errors.push('Missing token in request body.');
  } else if (token.length < 16) {
    errors.push('Invalid reset token.');
  }

  if (!password) {
    errors.push('Missing password in request body.');
  } else if (password.length < 8) {
    errors.push('Password must be at least 8 characters long.');
  } else if (!PASSWORD_COMPLEXITY_REGEX.test(password)) {
    errors.push('Password must include at least one letter and one number.');
  }

  return {
    errors,
    data: {
      token,
      password
    }
  };
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

    const shouldVerifyTurnstile = isProductionMode();
    const { errors, data } = validateRegistrationInput(req.body, {
      requireTurnstileToken: shouldVerifyTurnstile
    });
    if (errors.length > 0) {
      return res.status(400).json({
        errors,
        'executed-at': nowUnix()
      });
    }

    if (shouldVerifyTurnstile) {
      const turnstileResult = await verifyTurnstileToken(data.turnstileToken, req.ip);
      if (!turnstileResult.success) {
        return res.status(400).json({
          errors: ['Turnstile verification failed. Please try again.'],
          details: turnstileResult.errorCodes,
          'executed-at': nowUnix()
        });
      }
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
      emailVerified: false,
      emailVerificationCodeHash: null,
      emailVerificationCodeExpiresAt: null,
      emailVerificationRequestedAt: null,
      passwordResetTokenHash: null,
      passwordResetTokenExpiresAt: null,
      passwordResetRequestedAt: null,
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

    if (!user.emailVerified) {
      return res.status(403).json({
        errors: ['Email address is not verified yet. Please verify your account before logging in.'],
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

router.post('/request-verification-code', jsonParser, async (req, res) => {
  try {
    if (!req.body) {
      return res.status(400).json({
        errors: ['Missing request body. Raw JSON object expected.'],
        'executed-at': nowUnix()
      });
    }

    const { errors, data } = validateVerificationRequestInput(req.body);
    if (errors.length > 0) {
      return res.status(400).json({
        errors,
        'executed-at': nowUnix()
      });
    }

    const db = getDb();
    const usersCollection = db.collection('users');
    const now = nowUnix();
    const user = await usersCollection.findOne({ email: data.email });

    if (!user || user.emailVerified) {
      return res.status(200).json({
        message: 'If this account exists and is pending verification, a code has been sent.',
        'executed-at': now
      });
    }

    if (isWithinCooldown(user.emailVerificationRequestedAt, now)) {
      return res.status(429).json({
        errors: ['Please wait before requesting another verification code.'],
        'executed-at': now
      });
    }

    const code = generateVerificationCode();
    const codeHash = hashValue(code);
    const expiresAt = now + EMAIL_VERIFICATION_CODE_EXPIRY_SECONDS;

    await usersCollection.updateOne(
      { _id: user._id },
      {
        $set: {
          emailVerificationCodeHash: codeHash,
          emailVerificationCodeExpiresAt: expiresAt,
          emailVerificationRequestedAt: now,
          updatedAt: now
        }
      }
    );

    await sendVerificationCodeEmail(user.email, user.firstName, code);

    return res.status(200).json({
      message: 'Verification code sent.',
      'executed-at': now
    });
  } catch (error) {
    console.error('Error requesting verification code:', error);
    return res.status(500).json({
      errors: ['Internal server error'],
      'executed-at': nowUnix()
    });
  }
});

router.post('/verify-email', jsonParser, async (req, res) => {
  try {
    if (!req.body) {
      return res.status(400).json({
        errors: ['Missing request body. Raw JSON object expected.'],
        'executed-at': nowUnix()
      });
    }

    const { errors, data } = validateVerifyEmailInput(req.body);
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
      return res.status(400).json({
        errors: ['Invalid or expired verification code.'],
        'executed-at': nowUnix()
      });
    }

    if (user.emailVerified) {
      return res.status(200).json({
        message: 'Email is already verified.',
        'executed-at': nowUnix()
      });
    }

    const currentUnix = nowUnix();
    if (hasExpired(user.emailVerificationCodeExpiresAt, currentUnix) || !user.emailVerificationCodeHash) {
      return res.status(400).json({
        errors: ['Invalid or expired verification code.'],
        'executed-at': currentUnix
      });
    }

    const submittedHash = hashValue(data.code);
    if (!safeEqualHash(submittedHash, user.emailVerificationCodeHash)) {
      return res.status(400).json({
        errors: ['Invalid or expired verification code.'],
        'executed-at': currentUnix
      });
    }

    await usersCollection.updateOne(
      { _id: user._id },
      {
        $set: {
          emailVerified: true,
          updatedAt: currentUnix
        },
        $unset: {
          emailVerificationCodeHash: '',
          emailVerificationCodeExpiresAt: '',
          emailVerificationRequestedAt: ''
        }
      }
    );

    return res.status(200).json({
      message: 'Email verified successfully. You can now log in.',
      'executed-at': currentUnix
    });
  } catch (error) {
    console.error('Error verifying email:', error);
    return res.status(500).json({
      errors: ['Internal server error'],
      'executed-at': nowUnix()
    });
  }
});

router.post('/request-password-reset', jsonParser, async (req, res) => {
  try {
    if (!req.body) {
      return res.status(400).json({
        errors: ['Missing request body. Raw JSON object expected.'],
        'executed-at': nowUnix()
      });
    }

    const { errors, data } = validatePasswordResetRequestInput(req.body);
    if (errors.length > 0) {
      return res.status(400).json({
        errors,
        'executed-at': nowUnix()
      });
    }

    if (!EMAIL_REGEX.test(data.email)) { 
      return res.status(400).json({
        errors: ['Invalid email format.'],
        'executed-at': nowUnix()
      });
    }

    const db = getDb();
    const usersCollection = db.collection('users');
    const now = nowUnix();
    const user = await usersCollection.findOne({ email: data.email });

    if (user && !isWithinCooldown(user.passwordResetRequestedAt, now)) {
      const token = generatePasswordResetToken();
      const tokenHash = hashValue(token);
      const expiresAt = now + PASSWORD_RESET_TOKEN_EXPIRY_SECONDS;

      await usersCollection.updateOne(
        { _id: user._id },
        {
          $set: {
            passwordResetTokenHash: tokenHash,
            passwordResetTokenExpiresAt: expiresAt,
            passwordResetRequestedAt: now,
            updatedAt: now
          }
        }
      );

      const resetUrl = buildResetPasswordUrl(token);
      await sendPasswordResetEmail(user.email, user.firstName, resetUrl);
    }

    return res.status(200).json({
      message: 'If an account exists for this email, password reset instructions will be sent.',
      'executed-at': now
    });
  } catch (error) {
    console.error('Error requesting password reset:', error);
    return res.status(500).json({
      errors: ['Internal server error'],
      'executed-at': nowUnix()
    });
  }
});

router.post('/reset-password', jsonParser, async (req, res) => {
  try {
    if (!req.body) {
      return res.status(400).json({
        errors: ['Missing request body. Raw JSON object expected.'],
        'executed-at': nowUnix()
      });
    }

    const { errors, data } = validateResetPasswordInput(req.body);
    if (errors.length > 0) {
      return res.status(400).json({
        errors,
        'executed-at': nowUnix()
      });
    }

    const db = getDb();
    const usersCollection = db.collection('users');
    const currentUnix = nowUnix();
    const tokenHash = hashValue(data.token);

    const user = await usersCollection.findOne({
      passwordResetTokenHash: tokenHash,
      passwordResetTokenExpiresAt: { $gt: currentUnix }
    });

    if (!user) {
      return res.status(400).json({
        errors: ['Invalid or expired reset link.'],
        'executed-at': currentUnix
      });
    }

    const passwordHash = await bcrypt.hash(data.password, 10);

    await usersCollection.updateOne(
      { _id: user._id },
      {
        $set: {
          passwordHash,
          updatedAt: currentUnix
        },
        $unset: {
          passwordResetTokenHash: '',
          passwordResetTokenExpiresAt: '',
          passwordResetRequestedAt: ''
        }
      }
    );

    return res.status(200).json({
      message: 'Password reset successful. You can now log in.',
      'executed-at': currentUnix
    });
  } catch (error) {
    console.error('Error resetting password:', error);
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
