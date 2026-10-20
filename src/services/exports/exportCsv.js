/**
 * CSV Export Service for Knotiq Rugs Lead Scraper
 * Features:
 * - UTF-8 Byte Order Mark (BOM) for correct international character rendering in MS Excel
 * - Robust Spreadsheet Formula Injection (CSV Injection) defense
 * - Safe CSV escaping for commas, quotes, and multiline text
 */

const fs = require('fs');
const path = require('path');

// Characters that spreadsheet applications (Excel, LibreOffice, Google Sheets)
// interpret as formula prefixes when placed at the start of a cell
const FORMULA_INJECTION_PREFIXES = ['=', '+', '-', '@', '\t', '\r'];

/**
 * Escapes text to prevent CSV / Spreadsheet formula injection
 * @param {string|number|boolean} value
 * @returns {string}
 */
function sanitizeCsvCell(value) {
  if (value === null || value === undefined) {
    return '';
  }

  let str = String(value);

  // If the cell begins with an active formula character, prepend a single quote (')
  if (FORMULA_INJECTION_PREFIXES.some((prefix) => str.startsWith(prefix))) {
    str = `'${str}`;
  }

  // If cell contains commas, double quotes, or newlines, quote the cell and escape quotes
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    str = `"${str.replace(/"/g, '""')}"`;
  }

  return str;
}

const DEFAULT_CSV_COLUMNS = [
  { header: 'ID', key: 'id' },
  { header: 'Business Name', key: 'businessName' },
  { header: 'Lead Type', key: 'leadType' },
  { header: 'Fit Score (0-100)', key: 'score' },
  { header: 'Score Reason', key: 'scoreReason' },
  { header: 'Country', key: 'country' },
  { header: 'State / Region', key: 'state' },
  { header: 'City', key: 'city' },
  { header: 'Address', key: 'address' },
  { header: 'Phone', key: 'phone' },
  { header: 'WhatsApp', key: 'whatsapp' },
  { header: 'Email', key: 'email' },
  { header: 'Website', key: 'website' },
  { header: 'Rating', key: 'rating' },
  { header: 'Reviews', key: 'reviewCount' },
  { header: 'Sells Rugs Signal', key: 'sellsRugsSignal' },
  { header: 'Instagram', key: 'instagram' },
  { header: 'LinkedIn', key: 'linkedin' },
  { header: 'Source', key: 'source' },
  { header: 'Status', key: 'status' },
  { header: 'Notes', key: 'notes' },
  { header: 'Date Added', key: 'createdAt' }
];

/**
 * Generates CSV content as a UTF-8 BOM string
 * @param {Array<object>} leads
 * @param {Array<object>} [columns=DEFAULT_CSV_COLUMNS]
 * @returns {string}
 */
function generateCsvString(leads, columns = DEFAULT_CSV_COLUMNS) {
  const headerRow = columns.map((col) => sanitizeCsvCell(col.header)).join(',');
  const rows = [headerRow];

  for (const lead of leads) {
    const rawLead = typeof lead.toJSON === 'function' ? lead.toJSON() : lead;
    const row = columns.map((col) => {
      let val = rawLead[col.key];
      if (val instanceof Date) {
        val = val.toISOString().slice(0, 10);
      } else if (typeof val === 'boolean') {
        val = val ? 'Yes' : 'No';
      }
      return sanitizeCsvCell(val);
    }).join(',');
    rows.push(row);
  }

  // Prepend UTF-8 BOM (\uFEFF)
  return '\uFEFF' + rows.join('\r\n');
}

/**
 * Writes leads to a CSV file on disk
 * @param {string} destinationPath
 * @param {Array<object>} leads
 * @returns {Promise<string>} Destination path
 */
async function writeCsvFile(destinationPath, leads) {
  const dir = path.dirname(destinationPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const csvContent = generateCsvString(leads);
  await fs.promises.writeFile(destinationPath, csvContent, 'utf8');
  return destinationPath;
}

module.exports = {
  sanitizeCsvCell,
  generateCsvString,
  writeCsvFile,
  DEFAULT_CSV_COLUMNS
};
