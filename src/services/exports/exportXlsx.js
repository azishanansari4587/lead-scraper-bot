/**
 * Excel XLSX Export Service for Knotiq Rugs
 * Uses ExcelJS for professional styling, frozen header rows, multi-sheet workbook,
 * auto-filters, and conditional score formatting.
 */

const ExcelJS = require('exceljs');
const fs = require('fs');
const path = require('path');

/**
 * Builds an ExcelJS Workbook from a list of leads
 * @param {Array<object>} leads
 * @returns {ExcelJS.Workbook}
 */
function buildLeadsWorkbook(leads) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Knotiq Rugs Export Bot';
  workbook.created = new Date();

  // ----------------------------------------------------
  // Sheet 1: Qualified Leads
  // ----------------------------------------------------
  const sheet = workbook.addWorksheet('Qualified Leads', {
    views: [{ state: 'frozen', ySplit: 1 }]
  });

  sheet.columns = [
    { header: 'ID', key: 'id', width: 8 },
    { header: 'Business Name', key: 'businessName', width: 32 },
    { header: 'Lead Type', key: 'leadType', width: 22 },
    { header: 'Score (0-100)', key: 'score', width: 14 },
    { header: 'Score Reason', key: 'scoreReason', width: 45 },
    { header: 'Country', key: 'country', width: 16 },
    { header: 'City', key: 'city', width: 18 },
    { header: 'Phone', key: 'phone', width: 18 },
    { header: 'WhatsApp', key: 'whatsapp', width: 18 },
    { header: 'Email', key: 'email', width: 28 },
    { header: 'Website', key: 'website', width: 32 },
    { header: 'Rating', key: 'rating', width: 10 },
    { header: 'Reviews', key: 'reviewCount', width: 10 },
    { header: 'Sells Rugs', key: 'sellsRugsSignal', width: 12 },
    { header: 'Instagram', key: 'instagram', width: 22 },
    { header: 'LinkedIn', key: 'linkedin', width: 22 },
    { header: 'Status', key: 'status', width: 14 },
    { header: 'Source', key: 'source', width: 16 },
    { header: 'Notes', key: 'notes', width: 30 }
  ];

  // Style Header Row (Dark Navy, White bold text)
  const headerRow = sheet.getRow(1);
  headerRow.height = 26;
  headerRow.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF1E293B' } // Slate 800
  };
  headerRow.alignment = { vertical: 'middle', horizontal: 'center' };

  // Enable Auto-filter across all columns
  sheet.autoFilter = {
    from: 'A1',
    to: sheet.getColumn(sheet.columns.length).letter + '1'
  };

  // Add Data Rows with conditional score formatting
  leads.forEach((lead) => {
    const raw = typeof lead.toJSON === 'function' ? lead.toJSON() : lead;
    const row = sheet.addRow({
      id: raw.id,
      businessName: raw.businessName,
      leadType: raw.leadType,
      score: raw.score || 0,
      scoreReason: raw.scoreReason || '',
      country: raw.country,
      city: raw.city,
      phone: raw.phone || '',
      whatsapp: raw.whatsapp || '',
      email: raw.email || '',
      website: raw.website || '',
      rating: raw.rating ? Number(raw.rating) : null,
      reviewCount: raw.reviewCount || 0,
      sellsRugsSignal: raw.sellsRugsSignal ? 'Yes' : 'No',
      instagram: raw.instagram || '',
      linkedin: raw.linkedin || '',
      status: raw.status || 'new',
      source: raw.source || '',
      notes: raw.notes || ''
    });

    row.height = 20;
    row.alignment = { vertical: 'middle' };

    // Format Score Cell (Column 4: D)
    const scoreCell = row.getCell('score');
    scoreCell.alignment = { vertical: 'middle', horizontal: 'center' };
    const scoreVal = raw.score || 0;
    if (scoreVal >= 70) {
      scoreCell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFDCFCE7' } // Light Green
      };
      scoreCell.font = { bold: true, color: { argb: 'FF166534' } }; // Dark green
    } else if (scoreVal >= 40) {
      scoreCell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFFEF3C7' } // Light Amber
      };
      scoreCell.font = { bold: true, color: { argb: 'FF92400E' } }; // Dark amber
    } else {
      scoreCell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFFEE2E2' } // Light Red
      };
      scoreCell.font = { color: { argb: 'FF991B1B' } };
    }
  });

  // ----------------------------------------------------
  // Sheet 2: Summary & Stats
  // ----------------------------------------------------
  const statsSheet = workbook.addWorksheet('Summary & Stats');
  statsSheet.columns = [
    { header: '', key: 'metric', width: 28 },
    { header: '', key: 'value', width: 22 }
  ];

  // Header Banner
  const titleRow = statsSheet.addRow(['KNOTIQ RUGS — B2B EXPORT LEAD REPORT', '']);
  titleRow.font = { name: 'Calibri', size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
  titleRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } };
  statsSheet.mergeCells('A1:B1');
  titleRow.height = 30;
  titleRow.alignment = { vertical: 'middle', horizontal: 'center' };

  statsSheet.addRow(['', '']);

  // Summary Metrics
  const totalCount = leads.length;
  const highFitCount = leads.filter((l) => (l.score || 0) >= 70).length;
  const rugsVerifiedCount = leads.filter((l) => l.sellsRugsSignal).length;
  const avgScore = totalCount > 0 ? Math.round(leads.reduce((sum, l) => sum + (l.score || 0), 0) / totalCount) : 0;

  statsSheet.addRow(['Total Leads Exported', totalCount]);
  statsSheet.addRow(['High-Fit Export Targets (Score >= 70)', highFitCount]);
  statsSheet.addRow(['Sells Rugs / Carpet Signal Verified', rugsVerifiedCount]);
  statsSheet.addRow(['Average Lead Fit Score', `${avgScore} / 100`]);
  statsSheet.addRow(['Report Generated At', new Date().toISOString().replace('T', ' ').slice(0, 19)]);
  statsSheet.addRow(['Target Brand', 'Knotiq Rugs (Handmade Carpets Exporter)']);

  // Format metric rows
  for (let r = 3; r <= 8; r++) {
    const row = statsSheet.getRow(r);
    row.getCell(1).font = { bold: true, color: { argb: 'FF334155' } };
    row.getCell(2).font = { bold: true, color: { argb: 'FF0F172A' } };
    row.getCell(2).alignment = { horizontal: 'right' };
  }

  statsSheet.addRow(['', '']);

  // Country Breakdown
  const countryCounts = {};
  leads.forEach((l) => {
    const c = l.country || 'Unknown';
    countryCounts[c] = (countryCounts[c] || 0) + 1;
  });

  const countrySectionRow = statsSheet.addRow(['Top Destination Countries', 'Count']);
  countrySectionRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  countrySectionRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF334155' } };

  Object.entries(countryCounts)
    .sort((a, b) => b[1] - a[1])
    .forEach(([country, count]) => {
      statsSheet.addRow([country, count]);
    });

  return workbook;
}

/**
 * Generates an XLSX file and writes it to disk
 * @param {string} destinationPath
 * @param {Array<object>} leads
 * @returns {Promise<string>}
 */
async function writeXlsxFile(destinationPath, leads) {
  const dir = path.dirname(destinationPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const workbook = buildLeadsWorkbook(leads);
  await workbook.xlsx.writeFile(destinationPath);
  return destinationPath;
}

module.exports = {
  buildLeadsWorkbook,
  writeXlsxFile
};
