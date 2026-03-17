const { ConfigOptions } = require('../nodemailer-config');

describe('nodemailer-config', () => {
	const originalEnv = process.env;

	beforeEach(() => {
		jest.resetModules();
		process.env = {
			...originalEnv,
			EMAIL_HOST: 'email.tcore.network',
			EMAIL_PORT: '587',
			EMAIL_USER: 'user',
			EMAIL_PASSWORD: 'pass'
		};
	});

	afterAll(() => {
		process.env = originalEnv;
	});

	it('has all required fields in config', () => {
		const options = new ConfigOptions();
		const { config } = options;

		expect(config).toEqual(
			expect.objectContaining({
				host: process.env.EMAIL_HOST,
				port: process.env.EMAIL_PORT,
				secure: false,
				auth: expect.objectContaining({
					user: process.env.EMAIL_USER,
					pass: process.env.EMAIL_PASSWORD
				}),
				tls: expect.objectContaining({
					rejectUnauthorized: true,
					servername: process.env.EMAIL_HOST,
					minVersion: 'TLSv1.2'
				})
			})
		);
	});
});
