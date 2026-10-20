/**
 * WhatsApp Outreach Export Service for Knotiq Rugs
 * Formats lead contacts into clean broadcast lists, wa.me direct links,
 * and outreach text ready for one-click WhatsApp Web chat initiation.
 */

const fs = require('fs');
const path = require('path');
const { sanitizeCsvCell } = require('./exportCsv');

/**
 * Normalizes phone numbers to pure international digits for wa.me links
 * @param {string} phone
 * @returns {string} E.164 digits without plus sign
 */
function toWhatsappDigits(phone) {
  if (!phone) return '';
  return phone.replace(/[^0-9]/g, '');
}

/**
 * Generates WhatsApp outreach CSV and text format
 * @param {Array<object>} leads
 * @returns {string}
 */
function generateWhatsappExportContent(leads) {
  const lines = [
    ['Business Name', 'Contact Person', 'WhatsApp Number', 'Direct Chat Link', 'Fit Score', 'Country', 'City', 'Personalized Hook'].map(sanitizeCsvCell).join(',')
  ];

  leads.forEach((lead) => {
    const raw = typeof lead.toJSON === 'function' ? lead.toJSON() : lead;
    const phone = raw.whatsapp || raw.phone || '';
    const digits = toWhatsappDigits(phone);
    if (!digits) return; // skip records with no valid phone

    const introMessage = encodeURIComponent(
      `Hello ${raw.businessName}, this is Knotiq Rugs (handmade rug manufacturer from India). We noticed your design portfolio in ${raw.city || 'your city'} and would love to share our trade catalog for bespoke carpets.`
    );
    const waLink = `https://wa.me/${digits}?text=${introMessage}`;

    lines.push([
      sanitizeCsvCell(raw.businessName),
      sanitizeCsvCell('Procurement / Design Team'),
      sanitizeCsvCell(`+${digits}`),
      sanitizeCsvCell(waLink),
      sanitizeCsvCell(raw.score || 0),
      sanitizeCsvCell(raw.country || ''),
      sanitizeCsvCell(raw.city || ''),
      sanitizeCsvCell(raw.scoreReason || '')
    ].join(','));
  });

  return '\uFEFF' + lines.join('\r\n');
}

/**
 * Writes WhatsApp export to disk
 * @param {string} destinationPath
 * @param {Array<object>} leads
 * @returns {Promise<string>}
 */
async function writeWhatsappFile(destinationPath, leads) {
  const dir = path.dirname(destinationPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const content = generateWhatsappExportContent(leads);
  await fs.promises.writeFile(destinationPath, content, 'utf8');
  return destinationPath;
}

module.exports = {
  toWhatsappDigits,
  generateWhatsappExportContent,
  writeWhatsappFile
};
