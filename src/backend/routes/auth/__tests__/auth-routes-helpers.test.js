const mockSendMail = jest.fn().mockResolvedValue({ messageId: 'mock-message-id' });

jest.mock('nodemailer', () => ({
  createTransport: jest.fn(() => ({
    sendMail: mockSendMail
  }))
}));

jest.mock('../../../database', () => ({
  getDb: jest.fn()
}));

jest.mock('../../../middleware/session-auth', () => jest.fn((req, res, next) => next()));

jest.mock('../../../config/email-template-service', () => ({
  renderEmailTemplate: jest.fn(() => '<html>Mock Email</html>')
}));

const { renderEmailTemplate } = require('../../../config/email-template-service');
const authRoutes = require('../auth-routes');

describe('auth route helpers', () => {
  const originalEnv = process.env;
  const originalFetch = global.fetch;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = {
      ...originalEnv,
      EMAIL_HOST: 'email.tcore.network',
      EMAIL_PORT: '587',
      EMAIL_USER: 'user@example.com',
      EMAIL_PASSWORD: 'secret',
      BASE_URL: 'https://devex.example.com',
      NODE_ENV: 'test'
    };
    global.fetch = jest.fn();
  });

  afterEach(() => {
    process.env = originalEnv;
    global.fetch = originalFetch;
  });

  test('hashes values and compares hashes safely', () => {
    const hash = authRoutes.hashValue('alpha');

    expect(hash).toHaveLength(64);
    expect(authRoutes.safeEqualHash(hash, hash)).toBe(true);
    expect(authRoutes.safeEqualHash(hash, hash.slice(2))).toBe(false);
    expect(authRoutes.safeEqualHash(null, hash)).toBe(false);
  });

  test('generates verification codes and reset tokens', () => {
    expect(authRoutes.generateVerificationCode()).toMatch(/^\d{6}$/);
    expect(authRoutes.generatePasswordResetToken()).toMatch(/^[0-9a-f]{64}$/);
  });

  test('checks expiry and cooldown thresholds', () => {
    const currentUnix = 1_700_000_100;

    expect(authRoutes.hasExpired(undefined, currentUnix)).toBe(true);
    expect(authRoutes.hasExpired(currentUnix - 1, currentUnix)).toBe(true);
    expect(authRoutes.hasExpired(currentUnix + 1, currentUnix)).toBe(false);
    expect(authRoutes.isWithinCooldown(undefined, currentUnix)).toBe(false);
    expect(authRoutes.isWithinCooldown(currentUnix - 30, currentUnix)).toBe(true);
    expect(authRoutes.isWithinCooldown(currentUnix - 61, currentUnix)).toBe(false);
  });

  test('builds reset urls and normalises text helpers', () => {
    expect(authRoutes.sanitiseText('  hello  ')).toBe('hello');
    expect(authRoutes.normaliseEmail('  TEST@EXAMPLE.COM  ')).toBe('test@example.com');

    process.env.BASE_URL = '';
    expect(authRoutes.buildResetPasswordUrl('abc123')).toBe('/reset-password?token=abc123');

    process.env.BASE_URL = 'https://devex.example.com/app';
    expect(authRoutes.buildResetPasswordUrl('abc123')).toBe('https://devex.example.com/reset-password?token=abc123');

    process.env.BASE_URL = 'not-a-valid-url';
    expect(authRoutes.buildResetPasswordUrl('abc123')).toBe('/reset-password?token=abc123');
  });

  test('builds safe users and detects production mode and turnstile secret values', () => {
    expect(
      authRoutes.buildSafeUser({
        _id: { toString: () => 'user-1' },
        email: 'user@example.com',
        profilePhotoUuid: '',
        firstName: 'Test',
        lastName: 'User'
      })
    ).toEqual({
      id: 'user-1',
      email: 'user@example.com',
      profilePhotoUuid: null,
      firstName: 'Test',
      lastName: 'User'
    });

    expect(authRoutes.isProductionMode()).toBe(false);
    expect(authRoutes.getTurnstileSecret()).toBe('1x0000000000000000000000000000000AA');

    process.env.NODE_ENV = 'production';
    delete process.env.CLOUDFLARE_TURNSTILE_SECRET_KEY;
    expect(authRoutes.getTurnstileSecret()).toBeNull();

    process.env.CLOUDFLARE_TURNSTILE_SECRET_KEY = 'secret-key';
    expect(authRoutes.getTurnstileSecret()).toBe('secret-key');
  });

  test('validates registration, login, verification, and reset payloads', () => {
    expect(authRoutes.validateRegistrationInput({})).toEqual(
      expect.objectContaining({
        errors: expect.arrayContaining([
          'Missing email in request body.',
          'Missing password in request body.',
          'Missing firstName in request body.',
          'Missing lastName in request body.'
        ])
      })
    );

    expect(
      authRoutes.validateRegistrationInput(
        {
          email: 'tester@example.com',
          password: 'short',
          firstName: 'x'.repeat(81),
          lastName: 'y'.repeat(81)
        },
        { requireTurnstileToken: true }
      ).errors
    ).toEqual(
      expect.arrayContaining([
        'Password must be at least 8 characters long.',
        'firstName must be 80 characters or less.',
        'lastName must be 80 characters or less.',
        'Missing turnstileToken in request body.'
      ])
    );

    expect(
      authRoutes.validateRegistrationInput(
        {
          email: 'tester@example.com',
          password: 'Password123',
          firstName: 'Test',
          lastName: 'User',
          turnstileToken: 'token-123'
        },
        { requireTurnstileToken: true }
      )
    ).toEqual(
      expect.objectContaining({
        errors: [],
        data: expect.objectContaining({
          email: 'tester@example.com',
          firstName: 'Test',
          lastName: 'User',
          turnstileToken: 'token-123'
        })
      })
    );

    expect(authRoutes.validateLoginInput({ email: 'bad-email', password: '' }).errors).toEqual(
      expect.arrayContaining(['Invalid email format.', 'Missing password in request body.'])
    );
    expect(authRoutes.validateVerificationRequestInput({ email: 'bad-email' }).errors).toContain(
      'Invalid email format.'
    );
    expect(authRoutes.validateVerifyEmailInput({ email: 'tester@example.com', code: '12' }).errors).toContain(
      'Verification code must be a 6 digit number.'
    );
    expect(authRoutes.validatePasswordResetRequestInput({ email: '' }).errors).toContain(
      'Missing email in request body.'
    );
    expect(authRoutes.validateResetPasswordInput({ token: '', password: '' }).errors).toEqual(
      expect.arrayContaining(['Missing token in request body.', 'Missing password in request body.'])
    );
    expect(authRoutes.validateResetPasswordInput({ token: 'short', password: '12345678' }).errors).toEqual(
      expect.arrayContaining([
        'Invalid reset token.',
        'Password must include at least one letter and one number.'
      ])
    );
  });

  test('verifies turnstile tokens and sends email helpers', async () => {
    process.env.NODE_ENV = 'production';
    delete process.env.CLOUDFLARE_TURNSTILE_SECRET_KEY;
    await expect(authRoutes.verifyTurnstileToken('token-1', '127.0.0.1')).resolves.toEqual({
      success: false,
      errorCodes: ['missing-input-secret']
    });

    process.env.CLOUDFLARE_TURNSTILE_SECRET_KEY = 'secret-key';
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, 'error-codes': [] })
    });

    await expect(authRoutes.verifyTurnstileToken('token-2', '127.0.0.1')).resolves.toEqual({
      success: true,
      errorCodes: []
    });

    global.fetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ success: false, 'error-codes': ['bad-request'] })
    });

    await expect(authRoutes.verifyTurnstileToken('token-3', '127.0.0.1')).resolves.toEqual({
      success: false,
      errorCodes: ['verification-request-failed']
    });

    await authRoutes.sendAuthEmail({
      to: 'user@example.com',
      subject: 'Subject',
      templateName: 'template.html',
      values: { firstName: 'Test' }
    });

    expect(renderEmailTemplate).toHaveBeenCalledWith('template.html', { firstName: 'Test' });
    expect(mockSendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'user@example.com',
        subject: 'Subject',
        cc: 'devex@platform.tcore.network'
      })
    );

    await authRoutes.sendVerificationCodeEmail('user@example.com', 'Test', '123456');
    await authRoutes.sendPasswordResetEmail('user@example.com', 'Test', 'https://devex.example.com/reset-password?token=abc');

    expect(mockSendMail).toHaveBeenCalled();
  });

  test('regenerates and saves sessions', async () => {
    await expect(
      authRoutes.regenerateSession({ session: { regenerate: (callback) => callback() } })
    ).resolves.toBeUndefined();
    await expect(
      authRoutes.saveSession({ session: { save: (callback) => callback() } })
    ).resolves.toBeUndefined();

    await expect(
      authRoutes.regenerateSession({ session: { regenerate: (callback) => callback(new Error('regen failed')) } })
    ).rejects.toThrow('regen failed');
    await expect(
      authRoutes.saveSession({ session: { save: (callback) => callback(new Error('save failed')) } })
    ).rejects.toThrow('save failed');
  });
});