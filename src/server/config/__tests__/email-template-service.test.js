jest.mock('fs');
jest.mock('path');

const fs = require('fs');
const path = require('path');
const emailTemplateService = require('../email-template-service');

describe('email-template-service', () => {
  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();
    
    // Set up default mock implementations
    path.join.mockImplementation((...args) => args.join('/'));
    fs.existsSync.mockReturnValue(true);
    fs.readFileSync.mockReturnValue('');
    fs.readdirSync.mockReturnValue([]);
  });

  describe('escapeHtml', () => {
    it('should escape ampersands in rendered output', () => {
      const templateContent = 'Hello {{name}}';
      fs.readFileSync.mockReturnValue(templateContent);

      const result = emailTemplateService.renderEmailTemplate('ampersand.html', { name: 'Tom & DevEx team' });
      expect(result).toBe('Hello Tom &amp; DevEx team');
    });

    it('should escape less-than signs in rendered output', () => {
      const templateContent = 'Script: {{code}}';
      fs.readFileSync.mockReturnValue(templateContent);

      const result = emailTemplateService.renderEmailTemplate('less-than.html', { code: '<script>' });
      expect(result).toBe('Script: &lt;script&gt;');
    });

    it('should escape greater-than signs in rendered output', () => {
      const templateContent = 'Tag: {{tag}}';
      fs.readFileSync.mockReturnValue(templateContent);

      const result = emailTemplateService.renderEmailTemplate('greater-than.html', { tag: '<div>' });
      expect(result).toBe('Tag: &lt;div&gt;');
    });

    it('should escape double quotes in rendered output', () => {
      const templateContent = 'Attribute: {{attr}}';
      fs.readFileSync.mockReturnValue(templateContent);

      const result = emailTemplateService.renderEmailTemplate('double-quote.html', { attr: 'value="test"' });
      expect(result).toBe('Attribute: value=&quot;test&quot;');
    });

    it('should escape single quotes in rendered output', () => {
      const templateContent = 'Quote: {{quote}}';
      fs.readFileSync.mockReturnValue(templateContent);

      const result = emailTemplateService.renderEmailTemplate('single-quote.html', { quote: "it's" });
      expect(result).toBe('Quote: it&#39;s');
    });

    it('should escape all special characters together', () => {
      const templateContent = 'Mixed: {{mixed}}';
      fs.readFileSync.mockReturnValue(templateContent);

      const result = emailTemplateService.renderEmailTemplate('all-escapes.html', { mixed: '<script>alert("XSS")</script>' });
      expect(result).toBe('Mixed: &lt;script&gt;alert(&quot;XSS&quot;)&lt;/script&gt;');
    });
  });

  describe('loadEmailTemplate', () => {
    it('should load a template from the file system', () => {
      const templateContent = '<h1>Welcome {{name}}</h1>';
      fs.readFileSync.mockReturnValue(templateContent);

      const result = emailTemplateService.renderEmailTemplate('welcome.html', {});
      expect(result).toBe('<h1>Welcome </h1>');
      expect(fs.readFileSync).toHaveBeenCalledTimes(1);
    });

    it('should throw an error if template file does not exist', () => {
      fs.existsSync.mockReturnValue(false);

      expect(() => {
        emailTemplateService.renderEmailTemplate('nonexistent.html', {});
      }).toThrow('Email template not found: nonexistent.html');
    });

    it('should use cached template on subsequent loads', () => {
      const templateContent = '<p>Cached content</p>';
      fs.readFileSync.mockReturnValue(templateContent);

      // Load three times
      emailTemplateService.renderEmailTemplate('cached-subsequent.html', {});
      emailTemplateService.renderEmailTemplate('cached-subsequent.html', {});
      emailTemplateService.renderEmailTemplate('cached-subsequent.html', {});

      // Should only read from file once
      expect(fs.readFileSync).toHaveBeenCalledTimes(1);
    });
  });

  describe('preloadEmailTemplates', () => {
    it('should load all HTML templates from the directory', () => {
      const mockFiles = [
        { name: 'welcome.html', isFile: () => true },
        { name: 'confirmation.html', isFile: () => true },
        { name: 'rejection.html', isFile: () => true },
        { name: 'readme.txt', isFile: () => true },
        { name: 'subfolder', isFile: () => false }
      ];

      fs.readdirSync.mockReturnValue(mockFiles);
      fs.readFileSync.mockReturnValue('<h1>Template</h1>');

      const result = emailTemplateService.preloadEmailTemplates();

      expect(result).toEqual(['welcome.html', 'confirmation.html', 'rejection.html']);
      expect(fs.readFileSync).toHaveBeenCalledTimes(3);
    });

    it('should only load .html files', () => {
      const mockFiles = [
        { name: 'email.html', isFile: () => true },
        { name: 'config.json', isFile: () => true },
        { name: 'style.css', isFile: () => true },
        { name: 'script.js', isFile: () => true }
      ];

      fs.readdirSync.mockReturnValue(mockFiles);
      fs.readFileSync.mockReturnValue('<h1>Email</h1>');

      const result = emailTemplateService.preloadEmailTemplates();

      expect(result).toEqual(['email.html']);
      expect(fs.readFileSync).toHaveBeenCalledTimes(1);
    });

    it('should return an empty array when no HTML files exist', () => {
      const mockFiles = [
        { name: 'config.json', isFile: () => true },
        { name: 'style.css', isFile: () => true }
      ];

      fs.readdirSync.mockReturnValue(mockFiles);

      const result = emailTemplateService.preloadEmailTemplates();

      expect(result).toEqual([]);
      expect(fs.readFileSync).not.toHaveBeenCalled();
    });
  });

  describe('renderEmailTemplate', () => {
    it('should render a template with provided values', () => {
      fs.readFileSync.mockReturnValue('Hello {{name}}, welcome to {{company}}');

      const result = emailTemplateService.renderEmailTemplate('greeting.html', {
        name: 'Tom',
        company: 'DevEx'
      });

      expect(result).toBe('Hello Tom, welcome to DevEx');
    });

    it('should replace missing values with empty strings', () => {
      fs.readFileSync.mockReturnValue('Hello {{name}}, your code is {{code}}');

      const result = emailTemplateService.renderEmailTemplate('template.html', {
        name: 'Alice'
        // code is missing
      });

      expect(result).toBe('Hello Alice, your code is ');
    });

    it('should replace undefined values with empty strings', () => {
      fs.readFileSync.mockReturnValue('Value: {{missing}}');

      const result = emailTemplateService.renderEmailTemplate('undefined.html', {
        missing: undefined
      });

      expect(result).toBe('Value: ');
    });

    it('should handle multiple occurrences of the same placeholder', () => {
      fs.readFileSync.mockReturnValue('{{greeting}} {{name}}, {{greeting}} again {{name}}!');

      const result = emailTemplateService.renderEmailTemplate('multiple.html', {
        greeting: 'Hello',
        name: 'Tom'
      });

      expect(result).toBe('Hello Tom, Hello again Tom!');
    });

    it('should escape HTML in template values', () => {
      fs.readFileSync.mockReturnValue('<p>User input: {{userInput}}</p>');

      const result = emailTemplateService.renderEmailTemplate('html-escape.html', {
        userInput: '<script>alert("xss")</script>'
      });

      expect(result).toBe('<p>User input: &lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;</p>');
    });

    it('should handle numeric values', () => {
      fs.readFileSync.mockReturnValue('Order total: {{amount}}');

      const result = emailTemplateService.renderEmailTemplate('numeric.html', {
        amount: 99.99
      });

      expect(result).toBe('Order total: 99.99');
    });

    it('should handle boolean values', () => {
      fs.readFileSync.mockReturnValue('Confirmed: {{confirmed}}');

      const result = emailTemplateService.renderEmailTemplate('boolean.html', {
        confirmed: true
      });

      expect(result).toBe('Confirmed: true');
    });

    it('should only replace valid placeholders (alphanumeric and underscore)', () => {
      fs.readFileSync.mockReturnValue('Valid: {{name}} and Invalid: {{na-me}}');

      const result = emailTemplateService.renderEmailTemplate('valid-placeholder.html', {
        name: 'Test'
      });

      // Should replace {{name}} but not {{na-me}}
      expect(result).toBe('Valid: Test and Invalid: {{na-me}}');
    });

    it('should handle complex HTML templates with multiple placeholders', () => {
      const templateContent = `
        <html>
          <body>
            <h1>Hello {{firstName}} {{lastName}}</h1>
            <p>Your order #{{orderId}} is confirmed.</p>
            <p>Total: {{currency}}{{amount}}</p>
          </body>
        </html>
      `;
      fs.readFileSync.mockReturnValue(templateContent);

      const result = emailTemplateService.renderEmailTemplate('order.html', {
        firstName: 'Tom',
        lastName: 'Abbott',
        orderId: '12345',
        currency: '$',
        amount: '99.99'
      });

      expect(result).toContain('Hello Tom Abbott');
      expect(result).toContain('Your order #12345 is confirmed.');
      expect(result).toContain('Total: $99.99');
    });
  });

  describe('integration tests', () => {
    it('should preload templates and then render them from cache', () => {
      const mockFiles = [
        { name: 'welcome.html', isFile: () => true },
        { name: 'confirmation.html', isFile: () => true }
      ];

      fs.readdirSync.mockReturnValue(mockFiles);
      fs.readFileSync
        .mockReturnValueOnce('Welcome {{name}}!')
        .mockReturnValueOnce('Confirmed: {{orderId}}');

      // Preload templates
      const templates = emailTemplateService.preloadEmailTemplates();
      expect(templates).toHaveLength(2);

      // Render from cache (no additional file reads)
      const readCountAfterPreload = fs.readFileSync.mock.calls.length;
      const result1 = emailTemplateService.renderEmailTemplate('welcome.html', { name: 'Alice' });
      expect(result1).toBe('Welcome Alice!');
      expect(fs.readFileSync).toHaveBeenCalledTimes(readCountAfterPreload);
    });
  });
});
