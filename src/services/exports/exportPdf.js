/**
 * PDF Export Service for Knotiq Rugs
 * Renders an executive branded HTML dossier to PDF using Playwright headless browser.
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const logger = require('../../config/logger');

/**
 * Builds the standalone HTML template for the lead dossier
 * @param {Array<object>} leads
 * @returns {string}
 */
function buildPdfHtml(leads) {
  const totalLeads = leads.length;
  const highFitLeads = leads.filter((l) => (l.score || 0) >= 70).length;
  const rugSignalLeads = leads.filter((l) => l.sellsRugsSignal).length;
  const avgScore = totalLeads > 0 ? Math.round(leads.reduce((s, l) => s + (l.score || 0), 0) / totalLeads) : 0;
  const generatedDate = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  const leadRows = leads.slice(0, 150).map((l, index) => {
    const raw = typeof l.toJSON === 'function' ? l.toJSON() : l;
    const score = raw.score || 0;
    const badgeClass = score >= 70 ? 'badge-high' : score >= 40 ? 'badge-med' : 'badge-low';
    const contacts = [raw.phone, raw.email, raw.website].filter(Boolean).join(' • ');

    return `
      <tr>
        <td class="col-idx">${index + 1}</td>
        <td>
          <div class="biz-name">${escapeHtml(raw.businessName)}</div>
          <div class="biz-sub">${escapeHtml(raw.leadType || '')} — ${escapeHtml(raw.city || '')}, ${escapeHtml(raw.country || '')}</div>
          ${raw.address ? `<div class="biz-addr">${escapeHtml(raw.address)}</div>` : ''}
        </td>
        <td class="col-center">
          <span class="badge ${badgeClass}">${score}</span>
        </td>
        <td class="col-contacts">
          ${raw.phone ? `<div><strong>Phone:</strong> ${escapeHtml(raw.phone)}</div>` : ''}
          ${raw.whatsapp ? `<div><strong>WA:</strong> ${escapeHtml(raw.whatsapp)}</div>` : ''}
          ${raw.email ? `<div><strong>Email:</strong> ${escapeHtml(raw.email)}</div>` : ''}
          ${raw.website ? `<div><strong>Web:</strong> <a href="${escapeHtml(raw.website)}">${escapeHtml(raw.website.replace(/^https?:\/\//, '').slice(0, 30))}</a></div>` : ''}
        </td>
        <td class="col-notes">
          <div>${escapeHtml(raw.scoreReason || '')}</div>
          ${raw.sellsRugsSignal ? '<span class="pill-signal">Rugs Signal Verified</span>' : ''}
        </td>
      </tr>
    `;
  }).join('');

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Knotiq Rugs — B2B Lead Intelligence Report</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 15mm 12mm 15mm 12mm;
    }
    * { box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      color: #0f172a;
      background: #ffffff;
      margin: 0;
      padding: 0;
      font-size: 11px;
      line-height: 1.4;
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      border-bottom: 2px solid #0f172a;
      padding-bottom: 12px;
      margin-bottom: 16px;
    }
    .brand-title {
      font-size: 20px;
      font-weight: 800;
      letter-spacing: -0.5px;
      color: #0f172a;
    }
    .brand-subtitle {
      font-size: 12px;
      color: #64748b;
      margin-top: 2px;
    }
    .meta-box {
      text-align: right;
      font-size: 10px;
      color: #475569;
    }
    .kpi-container {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 10px;
      margin-bottom: 16px;
    }
    .kpi-card {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      padding: 10px 12px;
    }
    .kpi-label {
      font-size: 9px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #64748b;
      font-weight: 600;
    }
    .kpi-val {
      font-size: 18px;
      font-weight: 800;
      color: #0f172a;
      margin-top: 2px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      page-break-inside: auto;
    }
    tr {
      page-break-inside: avoid;
      page-break-after: auto;
    }
    th {
      background: #0f172a;
      color: #ffffff;
      text-align: left;
      font-size: 9px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      padding: 8px 6px;
      font-weight: 700;
    }
    td {
      padding: 8px 6px;
      border-bottom: 1px solid #e2e8f0;
      vertical-align: top;
    }
    .col-idx { width: 24px; color: #94a3b8; font-weight: 600; }
    .col-center { text-align: center; width: 55px; }
    .col-contacts { width: 180px; font-size: 10px; }
    .col-notes { width: 200px; font-size: 10px; color: #475569; }
    .biz-name { font-weight: 700; font-size: 11px; color: #0f172a; }
    .biz-sub { font-size: 9.5px; color: #64748b; }
    .biz-addr { font-size: 9px; color: #94a3b8; margin-top: 2px; }
    .badge {
      display: inline-block;
      padding: 2px 7px;
      border-radius: 12px;
      font-size: 11px;
      font-weight: 700;
    }
    .badge-high { background: #dcfce7; color: #166534; }
    .badge-med { background: #fef3c7; color: #92400e; }
    .badge-low { background: #fee2e2; color: #991b1b; }
    .pill-signal {
      display: inline-block;
      margin-top: 4px;
      background: #ede9fe;
      color: #6b21a8;
      font-size: 8.5px;
      font-weight: 600;
      padding: 1px 6px;
      border-radius: 4px;
    }
    a { color: #2563eb; text-decoration: none; }
    .footer {
      margin-top: 20px;
      padding-top: 8px;
      border-top: 1px solid #e2e8f0;
      font-size: 9px;
      color: #94a3b8;
      display: flex;
      justify-content: space-between;
    }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <div class="brand-title">KNOTIQ RUGS</div>
      <div class="brand-subtitle">B2B Lead Intelligence & Export Dossier</div>
    </div>
    <div class="meta-box">
      <div>Report Date: ${generatedDate}</div>
      <div>Confidential • Internal Sales Strategy</div>
    </div>
  </div>

  <div class="kpi-container">
    <div class="kpi-card">
      <div class="kpi-label">Total Leads</div>
      <div class="kpi-val">${totalLeads}</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">High-Fit Targets (≥70)</div>
      <div class="kpi-val">${highFitLeads}</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">Rugs Verified</div>
      <div class="kpi-val">${rugSignalLeads}</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">Average Score</div>
      <div class="kpi-val">${avgScore} / 100</div>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th class="col-idx">#</th>
        <th>Company & Location</th>
        <th class="col-center">Score</th>
        <th class="col-contacts">Direct Contacts</th>
        <th class="col-notes">AI Qualification & Signals</th>
      </tr>
    </thead>
    <tbody>
      ${leadRows}
    </tbody>
  </table>

  <div class="footer">
    <div>Generated by Knotiq Rugs Lead Scraper Bot Platform</div>
    <div>Page 1 of 1</div>
  </div>
</body>
</html>
  `.trim();
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Writes leads to a branded PDF file using Playwright
 * @param {string} destinationPath
 * @param {Array<object>} leads
 * @returns {Promise<string>}
 */
async function writePdfFile(destinationPath, leads) {
  const dir = path.dirname(destinationPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const htmlContent = buildPdfHtml(leads);

  let browser = null;
  try {
    browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.setContent(htmlContent, { waitUntil: 'load' });
    await page.pdf({
      path: destinationPath,
      format: 'A4',
      printBackground: true,
      margin: { top: '12mm', bottom: '12mm', left: '10mm', right: '10mm' }
    });
    await browser.close();
    return destinationPath;
  } catch (err) {
    logger.warn({ err: err.message }, 'Playwright PDF generation failed; creating fallback styled HTML file');
    if (browser) {
      try { await browser.close(); } catch (_) {}
    }
    // Write fallback HTML if browser PDF fails
    const fallbackHtmlPath = destinationPath.replace(/\.pdf$/i, '.html');
    await fs.promises.writeFile(fallbackHtmlPath, htmlContent, 'utf8');
    return fallbackHtmlPath;
  }
}

module.exports = {
  buildPdfHtml,
  writePdfFile
};
