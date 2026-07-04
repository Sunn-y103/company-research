import PDFDocument from 'pdfkit';
import logger from '../utils/logger.js';

/**
 * Generate a professional company research PDF report and pipe it to the response.
 *
 * @param {Object} data - The research report object
 * @param {import('express').Response} res - Express response stream
 */
export const generateReport = (data, res) => {
  const {
    companyName,
    officialWebsite,
    phone,
    address,
    summary,
    productsServices,
    painPoints,
    competitors,
    industry,
    founded,
    headquarters,
    swot,
    sources,
  } = data;

  if (!companyName) {
    throw new Error('companyName is required to generate a PDF');
  }

  logger.info(`[PdfService] Generating PDF for: "${companyName}"`);

  const doc = new PDFDocument({ margin: 50 });

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="${companyName.replace(/\s+/g, '_')}_research.pdf"`
  );

  doc.pipe(res);

  // ── Running Header (Page 2+) ────────────────────────────────────────────
  doc.on('pageAdded', () => {
    // Keep the current Y position to restore after drawing header
    const currentY = doc.y;
    doc
      .fontSize(8)
      .font('Helvetica')
      .fillColor('#9ca3af')
      .text(`Company Research Report — ${companyName}`, 50, 30, { align: 'right' });
    
    // Set Y below the header so body content doesn't overlap
    doc.y = 60;
  });

  // ── Header ──────────────────────────────────────────────────────────────
  doc.rect(0, 0, doc.page.width, 100).fill('#1a1a2e');

  doc
    .fillColor('#e2e8f0')
    .fontSize(24)
    .font('Helvetica-Bold')
    .text('Company Research Report', 50, 30, { align: 'center' });

  doc
    .fontSize(14)
    .font('Helvetica')
    .text(companyName, 50, 62, { align: 'center' });

  doc.moveDown(3);

  // Helper for rendering section headers
  const sectionHeader = (title) => {
    // add page break if getting close to bottom
    if (doc.y > doc.page.height - 120) {
      doc.addPage();
    }
    doc.moveDown();
    doc.fillColor('#1a1a2e').fontSize(14).font('Helvetica-Bold').text(title);
    doc.moveDown(0.5);
  };

  // Helper for bullet points
  const bulletPoint = (text, indent = 10) => {
    doc.fontSize(10).font('Helvetica').fillColor('#374151').text(`• ${text}`, { indent });
  };

  // ── Meta ─────────────────────────────────────────────────────────────────
  doc.fillColor('#1a1a2e').fontSize(10).font('Helvetica');
  const meta = [
    ['Website', officialWebsite || 'N/A'],
    ['Phone', phone || 'N/A'],
    ['Address', address || headquarters || 'N/A'],
    ['Industry', industry || 'N/A'],
    ['Founded', founded || 'N/A'],
    [
      'Generated',
      new Date().toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      }),
    ],
  ];
  meta.forEach(([label, value]) => {
    doc
      .font('Helvetica-Bold')
      .text(`${label}: `, { continued: true })
      .font('Helvetica')
      .text(value);
  });

  doc.moveDown();
  doc.moveTo(50, doc.y).lineTo(doc.page.width - 50, doc.y).strokeColor('#cbd5e1').stroke();
  doc.moveDown();

  // ── Executive Summary ────────────────────────────────────────────────────
  if (summary) {
    sectionHeader('Executive Summary');
    doc.fontSize(10).font('Helvetica').fillColor('#374151').text(summary, { align: 'justify' });
  }

  // ── SWOT Analysis ────────────────────────────────────────────────────────
  if (swot) {
    sectionHeader('SWOT Analysis');
    const swotItems = [
      { label: 'Strengths', data: swot.strengths, color: '#10b981' },
      { label: 'Weaknesses', data: swot.weaknesses, color: '#f59e0b' },
      { label: 'Opportunities', data: swot.opportunities, color: '#3b82f6' },
      { label: 'Threats', data: swot.threats, color: '#ef4444' },
    ];

    swotItems.forEach(item => {
      if (item.data && item.data.length > 0) {
        // Space check
        if (doc.y > doc.page.height - doc.page.margins.bottom - 60) doc.addPage();
        doc.fontSize(11).font('Helvetica-Bold').fillColor(item.color).text(item.label, { indent: 10 });
        item.data.forEach(bullet => {
          doc.fontSize(10).font('Helvetica').fillColor('#374151').text(`• ${bullet}`, { indent: 20 });
        });
        doc.moveDown(0.5);
      }
    });
  }

  // ── Products & Services ──────────────────────────────────────────────────
  if (productsServices?.length) {
    sectionHeader('Products & Services');
    productsServices.forEach((prod) => {
      doc.fontSize(10).font('Helvetica-Bold').fillColor('#1a1a2e').text(prod.name, { indent: 10 });
      if (prod.description) {
        doc.fontSize(10).font('Helvetica').fillColor('#374151').text(prod.description, { indent: 20 });
      }
      doc.moveDown(0.5);
    });
  }

  // ── Pain Points ──────────────────────────────────────────────────────────
  if (painPoints?.length) {
    sectionHeader('Pain Points & Challenges');
    painPoints.forEach((pt) => bulletPoint(pt));
  }

  // ── Competitors ──────────────────────────────────────────────────────────
  if (competitors?.length) {
    sectionHeader('Key Competitors');
    competitors.forEach((comp) => {
      // PAGE BREAK FIX: check space to avoid splitting a competitor block
      // 80 is roughly the height of the competitor title + description block + margins
      if (doc.y > doc.page.height - doc.page.margins.bottom - 80) {
        doc.addPage();
      }

      let title = comp.name;
      if (comp.website) title += ` (${comp.website})`;
      doc.fontSize(10).font('Helvetica-Bold').fillColor('#1a1a2e').text(title, { indent: 10 });
      if (comp.description) {
        doc.fontSize(10).font('Helvetica').fillColor('#374151').text(comp.description, { indent: 20 });
      }
      doc.moveDown(0.5);
    });
  }

  // ── Sources ──────────────────────────────────────────────────────────────
  if (sources?.length) {
    sectionHeader('Sources');
    sources.forEach((src, i) => {
      if (doc.y > doc.page.height - doc.page.margins.bottom - 60) {
        doc.addPage();
      }
      doc.fontSize(10).font('Helvetica-Bold').fillColor('#1a1a2e').text(`[${i + 1}] ${src.title}`, { indent: 10 });
      doc.fontSize(9).font('Helvetica').fillColor('#6b7280').text(src.link, { indent: 20 });
      doc.moveDown(0.5);
    });
  }

  // ── Footer ───────────────────────────────────────────────────────────────
  // A global event listener on pageAdded could add footers to all pages,
  // but for simplicity we'll just put it on the final page as the original did.
  const drawFooter = () => {
    const footerY = doc.page.height - 60;
    doc
      .moveTo(50, footerY)
      .lineTo(doc.page.width - 50, footerY)
      .strokeColor('#cbd5e1')
      .stroke();
    doc
      .fontSize(8)
      .font('Helvetica')
      .fillColor('#9ca3af')
      .text('Generated by Company Research Assistant', 50, footerY + 10, { align: 'center' });
  };
  
  drawFooter();

  doc.end();
};
