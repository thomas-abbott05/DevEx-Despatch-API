const fs = require('fs');
const path = require('path');

const EMAIL_TEMPLATE_DIRECTORY = path.join(__dirname, 'email-templates');
const EMAIL_TEMPLATE_CACHE = new Map();

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function loadEmailTemplate(templateName) {
  if (EMAIL_TEMPLATE_CACHE.has(templateName)) {
    return EMAIL_TEMPLATE_CACHE.get(templateName);
  }

  const templatePath = path.join(EMAIL_TEMPLATE_DIRECTORY, templateName);

  if (!fs.existsSync(templatePath)) {
    throw new Error(`Email template not found: ${templateName}`);
  }

  const template = fs.readFileSync(templatePath, 'utf8');
  EMAIL_TEMPLATE_CACHE.set(templateName, template);
  return template;
}

function preloadEmailTemplates() {
  const templateFiles = fs.readdirSync(EMAIL_TEMPLATE_DIRECTORY, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.html'))
    .map((entry) => entry.name);

  EMAIL_TEMPLATE_CACHE.clear();

  templateFiles.forEach((templateName) => {
    loadEmailTemplate(templateName);
  });

  return templateFiles;
}

function renderEmailTemplate(templateName, values) {
  const template = loadEmailTemplate(templateName);

  return template.replace(/{{\s*([a-zA-Z0-9_]+)\s*}}/g, (_, token) => {
    if (values[token] === undefined || values[token] === null) {
      return '';
    }

    return escapeHtml(values[token]);
  });
}

module.exports = {
  preloadEmailTemplates,
  renderEmailTemplate
};
