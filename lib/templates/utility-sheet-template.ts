import * as jspdfModule from 'jspdf';
import { AcroFormCheckBox, AcroFormTextField, GState, jsPDF } from 'jspdf';

import { DEFAULT_BUYER_STEPS, UTILITY_CATEGORIES } from '@/lib/constants';
import { sampleUtilitySheet } from '@/lib/templates/sample-utility-sheet';

/**
 * The free Utility Info Sheet offered on /utility-sheet-template. It mirrors
 * the sections of the product's own Utility Info Sheet (Home Basics, Utility
 * Providers, HOA, Buyer Next Steps) so the paper version and the product ask
 * for the same things.
 *
 * One layout, two outputs: the blank template, which prints as a plain form
 * and has fill-in fields (AcroForm) on every line and checkbox, and a sample
 * filled in with the fictional data in sample-utility-sheet.ts.
 *
 * This is a static marketing download, separate from the production packet
 * PDF builder in lib/pdf.
 */

export const utilitySheetTemplateFileName = 'utility-info-sheet-template.pdf';
export const utilitySheetSampleFileName = 'utility-info-sheet-sample.pdf';

const page = { width: 612, height: 792, margin: 40 };
const contentWidth = page.width - page.margin * 2;

const color = {
  navy: '#0a2c40',
  teal: '#176173',
  muted: '#5c686f',
  rule: '#9fb3b3',
  border: '#cbd9d9',
  band: '#eef3f1',
  // Filled-in answers on the sample, so they read as handwriting-in-ink
  // rather than part of the printed form.
  ink: '#23588a',
  sample: '#cc4932',
};

/** Top-left origin, in points. */
type Box = { x: number; y: number; width: number; height: number };

/** What goes on each line and checkbox: a form field, or a sample answer. */
interface SheetInputs {
  /** fontSize 0 lets the viewer shrink the text to fit the box. */
  text(name: string, label: string, box: Box, fontSize: number): void;
  checkbox(name: string, label: string, box: Box): void;
}

const checkboxGroups = {
  water_source: ['City / public', 'Well', 'HOA', 'Not sure'],
  sewer: ['Public sewer', 'Septic', 'HOA', 'Not sure'],
  primary_heating: ['Natural gas', 'Propane', 'Heating oil', 'Electric', 'Not sure'],
  hoa_member: ['Yes', 'No', 'Not sure'],
} as const;

function slug(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
}

export function checkboxFieldName(group: keyof typeof checkboxGroups, option: string) {
  return `${group}_${slug(option)}`;
}

function checkboxRow(
  doc: jsPDF,
  inputs: SheetInputs,
  x: number,
  y: number,
  label: string,
  group: keyof typeof checkboxGroups,
) {
  doc.setFont('helvetica', 'bold').setFontSize(9).setTextColor(color.navy);
  doc.text(label, x, y);
  let cursor = x + 104;
  doc.setFont('helvetica', 'normal');
  for (const option of checkboxGroups[group]) {
    doc.setDrawColor(color.navy).setLineWidth(0.8).rect(cursor, y - 7.5, 8, 8);
    inputs.checkbox(checkboxFieldName(group, option), `${label}: ${option}`, { x: cursor, y: y - 7.5, width: 8, height: 8 });
    doc.setFont('helvetica', 'normal').setFontSize(9).setTextColor(color.navy);
    doc.text(option, cursor + 12, y);
    cursor += 12 + doc.getTextWidth(option) + 16;
  }
}

function field(doc: jsPDF, inputs: SheetInputs, x: number, y: number, width: number, label: string, name: string) {
  doc.setFont('helvetica', 'normal').setFontSize(8).setTextColor(color.muted);
  doc.text(label, x, y);
  doc.setDrawColor(color.rule).setLineWidth(0.6).line(x, y + 14, x + width, y + 14);
  inputs.text(name, label, { x, y: y + 2, width, height: 12 }, 9);
}

function sectionHeading(doc: jsPDF, y: number, title: string) {
  doc.setFont('helvetica', 'bold').setFontSize(10.5).setTextColor(color.teal);
  doc.text(title.toUpperCase(), page.margin, y, { charSpace: 0.6 });
  doc.setDrawColor(color.teal).setLineWidth(1).line(page.margin, y + 5, page.margin + contentWidth, y + 5);
}

function drawSheet(doc: jsPDF, inputs: SheetInputs, sample: boolean) {
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
  if (sample) {
    const badgeX = left + doc.getTextWidth('Utility Info Sheet') + 12;
    doc.setFillColor(color.sample).roundedRect(badgeX, y - 15, 58, 18, 3, 3, 'F');
    doc.setFont('helvetica', 'bold').setFontSize(10).setTextColor('#ffffff');
    doc.text('SAMPLE', badgeX + 29, y - 2.5, { align: 'center', charSpace: 0.8 });
    doc.setFont('helvetica', 'bold').setFontSize(9).setTextColor(color.sample);
    doc.text('Sample with fictional details. Not a real property, seller, or provider.', left, y + 15);
  } else {
    doc.setFont('helvetica', 'normal').setFontSize(9).setTextColor(color.muted);
    doc.text('Completed by the seller for the buyer. Provider names and phone numbers only.', left, y + 15);
  }
  y += 34;

  // Property and seller
  field(doc, inputs, left, y, contentWidth, 'Property address', 'property_address');
  y += 30;
  const third = (contentWidth - gap * 2) / 3;
  field(doc, inputs, left, y, third, 'Seller name', 'seller_name');
  field(doc, inputs, left + third + gap, y, third, 'Seller phone', 'seller_phone');
  field(doc, inputs, left + (third + gap) * 2, y, third, 'Date completed', 'date_completed');
  y += 40;

  // Home basics
  sectionHeading(doc, y, 'Home basics');
  y += 22;
  checkboxRow(doc, inputs, left, y, 'Water source', 'water_source');
  y += 17;
  checkboxRow(doc, inputs, left, y, 'Sewer', 'sewer');
  y += 17;
  checkboxRow(doc, inputs, left, y, 'Primary heating', 'primary_heating');
  y += 24;

  // Utility providers table
  sectionHeading(doc, y, 'Utility providers');
  doc.setFont('helvetica', 'normal').setFontSize(8).setTextColor(color.muted);
  doc.text('Write "Not sure" or "None" rather than leaving a row blank.', right, y, { align: 'right' });
  y += 14;
  const columns = [
    { title: 'Utility', width: 104 },
    { title: 'Provider', width: 168, field: 'provider' },
    { title: 'Phone', width: 104, field: 'phone' },
    { title: 'Website or notes', width: contentWidth - 104 - 168 - 104, field: 'notes' },
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
  UTILITY_CATEGORIES.forEach((category, index) => {
    if (index % 2 === 1) {
      doc.setFillColor(color.band).rect(left, y, contentWidth, rowHeight, 'F');
    }
    doc.setFont('helvetica', 'bold').setFontSize(9).setTextColor(color.navy);
    doc.text(category.label, left + 6, y + 14);
    doc.setDrawColor(color.border).setLineWidth(0.6).line(left, y + rowHeight, right, y + rowHeight);
    x = left;
    for (const column of columns) {
      if (column.field) {
        inputs.text(`${category.key}_${column.field}`, `${category.label} ${column.title.toLowerCase()}`, {
          x: x + 3,
          y: y + 3,
          width: column.width - 6,
          height: rowHeight - 6,
        }, 0);
      }
      x += column.width;
    }
    y += rowHeight;
  });
  x = left;
  const tableTop = y - rowHeight * UTILITY_CATEGORIES.length;
  doc.setDrawColor(color.border).setLineWidth(0.6);
  for (const column of columns.slice(0, -1)) {
    x += column.width;
    doc.line(x, tableTop, x, y);
  }
  doc.rect(left, tableTop - headerHeight, contentWidth, y - tableTop + headerHeight);
  y += 20;
  field(doc, inputs, left, y, half(), 'Electric meter number (optional)', 'electric_meter_number');
  y += 32;

  // HOA
  sectionHeading(doc, y, 'HOA or condo association');
  y += 22;
  checkboxRow(doc, inputs, left, y, 'Part of an HOA?', 'hoa_member');
  doc.setFont('helvetica', 'normal').setFontSize(8).setTextColor(color.muted);
  doc.text('If yes, fill in what you know:', left + 300, y);
  y += 18;
  field(doc, inputs, left, y, half(), 'Association name', 'hoa_name');
  field(doc, inputs, left + half() + gap, y, half(), 'Management company and contact', 'hoa_management');
  y += 30;
  field(doc, inputs, left, y, third, 'Phone', 'hoa_phone');
  field(doc, inputs, left + third + gap, y, third, 'Email', 'hoa_email');
  field(doc, inputs, left + (third + gap) * 2, y, third, 'Dues amount and how often', 'hoa_dues');
  y += 30;
  field(doc, inputs, left, y, contentWidth, 'Where dues are paid or documents are found', 'hoa_payment_documents');
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
}

// --- Fillable form fields -------------------------------------------------
//
// jsPDF writes AcroForm fields but leaves out a few entries viewers rely on:
// text fields get no default appearance (/DA, the font to type in), the form
// gets no default resources (/DR, where that font lives), and its stock
// checkbox paints a white square over the printed box. These hooks add the
// missing entries to the objects jsPDF writes; the rest is stock jsPDF.

type PdfEntry = { key: string; value: string };
type PdfObjectWithEntries = { getKeyValueListForStream(): PdfEntry[] };
type FormXObject = { stream: string };
type AppearanceFactory = (field: unknown) => FormXObject;

// Not in jsPDF's type declarations, but exported by every build.
const checkBoxAppearance = (jspdfModule as unknown as {
  AcroFormAppearance: { CheckBox: { OffPushDown: AppearanceFactory } };
}).AcroFormAppearance.CheckBox;

function pdfString(value: string) {
  return `(${value.replace(/[\\()]/g, (match) => `\\${match}`)})`;
}

function addEntries(object: object, entries: () => PdfEntry[]) {
  const target = object as PdfObjectWithEntries;
  const base = target.getKeyValueListForStream.bind(target);
  target.getKeyValueListForStream = () => [...base(), ...entries()];
}

function rgb(hex: string) {
  return [1, 3, 5].map((start) => (parseInt(hex.slice(start, start + 2), 16) / 255).toFixed(3)).join(' ');
}

/** A checkbox appearance: a drawn check for On, nothing for Off. No fonts. */
function checkAppearance(on: boolean): AppearanceFactory {
  return (field) => {
    const xobject = checkBoxAppearance.OffPushDown(field);
    xobject.stream = on
      ? `q ${rgb(color.navy)} RG 1.3 w 1 J 1 j 1.7 4.2 m 3.3 2.2 l 6.4 6.1 l S Q`
      : // jsPDF drops an empty stream, which leaves an invalid XObject.
        'q Q';
    return xobject;
  };
}

function helvetica(doc: jsPDF): { id: string } {
  return (doc.internal as unknown as { getFont(name: string, style: string): { id: string } }).getFont('helvetica', 'normal');
}

function formFieldInputs(doc: jsPDF): SheetInputs {
  const fontKey = helvetica(doc).id;
  return {
    text(name, label, box, fontSize) {
      const textField = new AcroFormTextField();
      textField.fieldName = name;
      Object.assign(textField, box);
      addEntries(textField, () => [
        { key: 'TU', value: pdfString(label) },
        { key: 'DA', value: pdfString(`/${fontKey} ${fontSize} Tf ${rgb(color.navy)} rg`) },
      ]);
      doc.addField(textField);
    },
    checkbox(name, label, box) {
      const checkBox = new AcroFormCheckBox();
      checkBox.fieldName = name;
      Object.assign(checkBox, box);
      checkBox.value = 'Off';
      checkBox.appearanceState = 'Off';
      const appearance = { On: checkAppearance(true), Off: checkAppearance(false) };
      Object.assign(checkBox, { appearanceStreamContent: { N: appearance, D: appearance } });
      addEntries(checkBox, () => [{ key: 'TU', value: pdfString(label) }]);
      doc.addField(checkBox);
    },
  };
}

/**
 * Gives the form the page's own resources (which hold Helvetica) as its
 * default resources. jsPDF writes the form before it numbers the fonts, but
 * the page resource dictionary is always object 2: jsPDF's own field
 * appearances reference it the same way, and the tests check it.
 */
function addFormDefaults(doc: jsPDF) {
  const { acroformPlugin } = doc.internal as unknown as { acroformPlugin: { acroFormDictionaryRoot: object } };
  addEntries(acroformPlugin.acroFormDictionaryRoot, () => [
    { key: 'DR', value: '2 0 R' },
    { key: 'DA', value: pdfString(`/${helvetica(doc).id} 0 Tf 0 g`) },
  ]);
}

// --- Sample answers -------------------------------------------------------

/** The sample's answers, keyed by the field each one fills in. */
export function sampleFieldValues(): { text: Record<string, string>; checked: string[] } {
  const sheet = sampleUtilitySheet;
  const text: Record<string, string> = {
    property_address: sheet.propertyAddress,
    seller_name: sheet.sellerName,
    seller_phone: sheet.sellerPhone,
    date_completed: sheet.dateCompleted,
    electric_meter_number: sheet.electricMeterNumber,
    hoa_name: sheet.hoa.name,
    hoa_management: sheet.hoa.management,
    hoa_phone: sheet.hoa.phone,
    hoa_email: sheet.hoa.email,
    hoa_dues: sheet.hoa.dues,
    hoa_payment_documents: sheet.hoa.paymentAndDocuments,
  };
  for (const [category, row] of Object.entries(sheet.providers)) {
    text[`${category}_provider`] = row.provider;
    if ('phone' in row) text[`${category}_phone`] = row.phone;
    if ('notes' in row) text[`${category}_notes`] = row.notes;
  }
  const checked = [
    checkboxFieldName('water_source', sheet.homeBasics.water),
    checkboxFieldName('sewer', sheet.homeBasics.sewer),
    checkboxFieldName('primary_heating', sheet.homeBasics.heating),
    checkboxFieldName('hoa_member', sheet.hoa.member),
  ];
  return { text, checked };
}

function sampleInputs(doc: jsPDF): SheetInputs {
  const { text, checked } = sampleFieldValues();
  return {
    text(name, _label, box) {
      const value = text[name];
      if (!value) return;
      // Shrink long answers to fit their line rather than run past it.
      let size = 10;
      doc.setFont('helvetica', 'normal');
      while (size > 7 && doc.setFontSize(size).getTextWidth(value) > box.width - 2) size -= 0.5;
      doc.setTextColor(color.ink).text(value, box.x + 1, box.y + box.height - 3);
    },
    checkbox(name, _label, box) {
      if (!checked.includes(name)) return;
      doc.setDrawColor(color.ink).setLineWidth(1.3).setLineCap('round').setLineJoin('round');
      doc.lines([[1.6, 2], [3.1, -3.9]], box.x + 1.7, box.y + box.height - 4.2);
      doc.setLineCap('butt').setLineJoin('miter');
    },
  };
}

function drawSampleWatermark(doc: jsPDF) {
  doc.saveGraphicsState();
  doc.setGState(new GState({ opacity: 0.07 }));
  doc.setFont('helvetica', 'bold').setFontSize(130).setTextColor(color.sample);
  // Rotated about its start point; offset so the word sits across the middle.
  doc.text('SAMPLE', 110, 588, { angle: 35 });
  doc.restoreGraphicsState();
}

function createDocument(title: string, subject: string) {
  const doc = new jsPDF({ unit: 'pt', format: 'letter' });
  doc.setProperties({
    title,
    subject,
    author: 'UtilitySheet',
    creator: 'UtilitySheet (www.utilitysheet.com)',
    keywords: 'utility sheet template, seller utility information form, utility list for buyers',
  });
  return doc;
}

/** The blank template: prints as a plain form, and can be filled in on screen. */
export function buildUtilitySheetTemplatePdf(): ArrayBuffer {
  const doc = createDocument(
    'Utility Info Sheet (fillable template)',
    'Printable and fillable seller utility information sheet for real estate closings',
  );
  drawSheet(doc, formFieldInputs(doc), false);
  addFormDefaults(doc);
  return doc.output('arraybuffer');
}

/** The template filled in with obviously fictional details, marked SAMPLE. */
export function buildUtilitySheetSamplePdf(): ArrayBuffer {
  const doc = createDocument(
    'Utility Info Sheet (sample with fictional details)',
    'A sample of a completed seller utility information sheet. All details are fictional.',
  );
  drawSheet(doc, sampleInputs(doc), true);
  drawSampleWatermark(doc);
  return doc.output('arraybuffer');
}
