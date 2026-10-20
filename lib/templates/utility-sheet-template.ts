import { jsPDF } from 'jspdf';

import { DEFAULT_BUYER_STEPS, UTILITY_CATEGORIES } from '@/lib/constants';

/**
 * The free, blank, printable Utility Info Sheet offered on
 * /utility-sheet-template. It mirrors the sections of the product's own
 * Utility Info Sheet (Home Basics, Utility Providers, HOA, Buyer Next Steps)
 * so the paper version and the product ask for the same things.
 *
 * This is a static marketing download, separate from the production packet
 * PDF builder in lib/pdf.
 */

export const utilitySheetTemplateFileName = 'utility-info-sheet-template.pdf';

const page = { width: 612, height: 792, margin: 40 };
const contentWidth = page.width - page.margin * 2;

const color = {
  navy: '#0a2c40',
  teal: '#176173',
  muted: '#5c686f',
  rule: '#9fb3b3',
  border: '#cbd9d9',
  band: '#eef3f1',
};

function checkboxRow(doc: jsPDF, x: number, y: number, label: string, options: string[]) {
  doc.setFont('helvetica', 'bold').setFontSize(9).setTextColor(color.navy);
  doc.text(label, x, y);
  let cursor = x + 104;
  doc.setFont('helvetica', 'normal');
  for (const option of options) {
    doc.setDrawColor(color.navy).setLineWidth(0.8).rect(cursor, y - 7.5, 8, 8);
    doc.text(option, cursor + 12, y);
    cursor += 12 + doc.getTextWidth(option) + 16;
  }
}

function field(doc: jsPDF, x: number, y: number, width: number, label: string) {
  doc.setFont('helvetica', 'normal').setFontSize(8).setTextColor(color.muted);
  doc.text(label, x, y);
  doc.setDrawColor(color.rule).setLineWidth(0.6).line(x, y + 14, x + width, y + 14);
}

function sectionHeading(doc: jsPDF, y: number, title: string) {
  doc.setFont('helvetica', 'bold').setFontSize(10.5).setTextColor(color.teal);
  doc.text(title.toUpperCase(), page.margin, y, { charSpace: 0.6 });
  doc.setDrawColor(color.teal).setLineWidth(1).line(page.margin, y + 5, page.margin + contentWidth, y + 5);
}

export function buildUtilitySheetTemplatePdf(): ArrayBuffer {
  const doc = new jsPDF({ unit: 'pt', format: 'letter' });
  doc.setProperties({
    title: 'Utility Info Sheet (blank template)',
    subject: 'Printable seller utility information sheet for real estate closings',
    author: 'UtilitySheet',
    creator: 'UtilitySheet (www.utilitysheet.com)',
    keywords: 'utility sheet template, seller utility information form, utility list for buyers',
  });

  const left = page.margin;
  const right = page.margin + contentWidth;
  const gap = 16;
  const half = () => (contentWidth - gap) / 2;
  let y = page.margin + 8;

  // Brand line and title
  doc.setFont('helvetica', 'bold').setFontSize(10).setTextColor(color.navy);
  doc.text('UtilitySheet', left, y);
  doc.setFont('helvetica', 'normal').setFontSize(8).setTextColor(color.muted);
  doc.text('Free template from www.utilitysheet.com', right, y, { align: 'right' });
  y += 30;
  doc.setFont('helvetica', 'bold').setFontSize(22).setTextColor(color.navy);
  doc.text('Utility Info Sheet', left, y);
  doc.setFont('helvetica', 'normal').setFontSize(9).setTextColor(color.muted);
  doc.text('Completed by the seller for the buyer. Provider names and phone numbers only.', left, y + 15);
  y += 34;

  // Property and seller
  field(doc, left, y, contentWidth, 'Property address');
  y += 30;
  const third = (contentWidth - gap * 2) / 3;
  field(doc, left, y, third, 'Seller name');
  field(doc, left + third + gap, y, third, 'Seller phone');
  field(doc, left + (third + gap) * 2, y, third, 'Date completed');
  y += 40;

  // Home basics
  sectionHeading(doc, y, 'Home basics');
  y += 22;
  checkboxRow(doc, left, y, 'Water source', ['City / public', 'Well', 'HOA', 'Not sure']);
  y += 17;
  checkboxRow(doc, left, y, 'Sewer', ['Public sewer', 'Septic', 'HOA', 'Not sure']);
  y += 17;
  checkboxRow(doc, left, y, 'Primary heating', ['Natural gas', 'Propane', 'Heating oil', 'Electric', 'Not sure']);
  y += 24;

  // Utility providers table
  sectionHeading(doc, y, 'Utility providers');
  doc.setFont('helvetica', 'normal').setFontSize(8).setTextColor(color.muted);
  doc.text('Write "Not sure" or "None" rather than leaving a row blank.', right, y, { align: 'right' });
  y += 14;
  const columns = [
    { title: 'Utility', width: 104 },
    { title: 'Provider', width: 168 },
    { title: 'Phone', width: 104 },
    { title: 'Website or notes', width: contentWidth - 104 - 168 - 104 },
  ];
  const headerHeight = 18;
  const rowHeight = 21;
  doc.setFillColor(color.navy).rect(left, y, contentWidth, headerHeight, 'F');
  doc.setFont('helvetica', 'bold').setFontSize(8.5).setTextColor('#ffffff');
  let x = left;
  for (const column of columns) {
    doc.text(column.title, x + 6, y + 12);
    x += column.width;
  }
  y += headerHeight;
  doc.setDrawColor(color.border).setLineWidth(0.6);
  UTILITY_CATEGORIES.forEach((category, index) => {
    if (index % 2 === 1) {
      doc.setFillColor(color.band).rect(left, y, contentWidth, rowHeight, 'F');
    }
    doc.setFont('helvetica', 'bold').setFontSize(9).setTextColor(color.navy);
    doc.text(category.label, left + 6, y + 14);
    doc.line(left, y + rowHeight, right, y + rowHeight);
    y += rowHeight;
  });
  x = left;
  const tableTop = y - rowHeight * UTILITY_CATEGORIES.length;
  for (const column of columns.slice(0, -1)) {
    x += column.width;
    doc.line(x, tableTop, x, y);
  }
  doc.rect(left, tableTop - headerHeight, contentWidth, y - tableTop + headerHeight);
  y += 20;
  field(doc, left, y, half(), 'Electric meter number (optional)');
  y += 32;

  // HOA
  sectionHeading(doc, y, 'HOA or condo association');
  y += 22;
  checkboxRow(doc, left, y, 'Part of an HOA?', ['Yes', 'No', 'Not sure']);
  doc.setFont('helvetica', 'normal').setFontSize(8).setTextColor(color.muted);
  doc.text('If yes, fill in what you know:', left + 300, y);
  y += 18;
  field(doc, left, y, half(), 'Association name');
  field(doc, left + half() + gap, y, half(), 'Management company and contact');
  y += 30;
  field(doc, left, y, third, 'Phone');
  field(doc, left + third + gap, y, third, 'Email');
  field(doc, left + (third + gap) * 2, y, third, 'Dues amount and how often');
  y += 30;
  field(doc, left, y, contentWidth, 'Where dues are paid or documents are found');
  y += 36;

  // Buyer next steps
  sectionHeading(doc, y, 'Buyer next steps');
  y += 20;
  doc.setFont('helvetica', 'normal').setFontSize(9).setTextColor(color.navy);
  DEFAULT_BUYER_STEPS.forEach((step, index) => {
    doc.text(`${index + 1}.`, left, y);
    doc.text(step, left + 14, y, { maxWidth: contentWidth - 14 });
    y += 14;
  });

  // Footer
  const footerY = page.height - page.margin + 6;
  doc.setDrawColor(color.border).setLineWidth(0.6).line(left, footerY - 16, right, footerY - 16);
  doc.setFont('helvetica', 'bold').setFontSize(8).setTextColor(color.navy);
  doc.text('Never write account numbers, passwords, or PINs on this sheet.', left, footerY);
  doc.setFont('helvetica', 'normal').setTextColor(color.muted);
  doc.text('Sellers can fill this in on their phone instead: www.utilitysheet.com', right, footerY, { align: 'right' });

  return doc.output('arraybuffer');
}
