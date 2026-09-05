// Boilerplate document templates + PDF/DOCX (Word) rendering for the Documents module.
// Letterhead constants live here; adjust COMPANY to match your organisation.
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { AlignmentType, BorderStyle, Packer, Paragraph, ShadingType, Table, TableCell, TableRow, TextRun, WidthType, Document as DocxDocument } from 'docx';

export type DocumentDocType =
  | 'appointment_letter'
  | 'experience_certificate'
  | 'internship_certificate'
  | 'leaving_certificate'
  | 'salary_slip';

export const DOC_TYPES: { value: DocumentDocType; label: string }[] = [
  { value: 'appointment_letter', label: 'Appointment Letter' },
  { value: 'experience_certificate', label: 'Experience Certificate' },
  { value: 'internship_certificate', label: 'Internship Certificate' },
  { value: 'leaving_certificate', label: 'Leaving Certificate' },
  { value: 'salary_slip', label: 'Salary Slip' },
];

export const docTypeLabel = (t: string) => DOC_TYPES.find((d) => d.value === t)?.label ?? t;

export const COMPANY = {
  name: 'WorkTracker Technologies Pvt. Ltd.',
  address: '123 Business Park, MG Road, Bengaluru, Karnataka 560001',
  cin: 'U72900KA2020PTC000000',
};

export interface DocFieldDef {
  key: string;
  label: string;
  type?: 'text' | 'date' | 'number' | 'textarea' | 'select';
  prefill?: string; // key in the employee snapshot used as the default value
  placeholder?: string;
  options?: string[]; // choices for select inputs
}

export interface DocTemplateDef {
  type: DocumentDocType;
  label: string;
  description: string;
  fields: DocFieldDef[];
}

// Employee fields (name/ID/designation/department/joining date) are prefilled
// from the employee record; the remaining fields are filled by HR/Admin.
export const DOC_TEMPLATES: Record<DocumentDocType, DocTemplateDef> = {
  appointment_letter: {
    type: 'appointment_letter',
    label: 'Appointment Letter',
    description: 'Formal appointment letter with role, CTC and probation terms',
    fields: [
      { key: 'employeeName', label: 'Employee Name', prefill: 'name' },
      { key: 'employeeId', label: 'Employee ID', prefill: 'employeeId' },
      { key: 'designation', label: 'Designation', prefill: 'designation' },
      { key: 'department', label: 'Department', prefill: 'department' },
      { key: 'joiningDate', label: 'Joining Date', type: 'date', prefill: 'joiningDate' },
      { key: 'ctc', label: 'Annual CTC (e.g. Rs. 6,00,000 per annum)', type: 'text' },
      { key: 'workingHours', label: 'Working Hours (e.g. 9:30 AM - 6:30 PM, Mon-Fri)', type: 'text' },
      { key: 'probationMonths', label: 'Probation Period (months)', type: 'number' },
    ],
  },
  experience_certificate: {
    type: 'experience_certificate',
    label: 'Experience Certificate',
    description: 'Certifies employment duration and conduct on leaving',
    fields: [
      { key: 'employeeName', label: 'Employee Name', prefill: 'name' },
      { key: 'designation', label: 'Designation', prefill: 'designation' },
      { key: 'department', label: 'Department', prefill: 'department' },
      { key: 'employmentFrom', label: 'Employment From', type: 'date', prefill: 'joiningDate' },
      { key: 'employmentTo', label: 'Employment To (Last Working Date)', type: 'date' },
      { key: 'conductRemark', label: 'Conduct Remark (optional)', type: 'textarea' },
    ],
  },
  internship_certificate: {
    type: 'internship_certificate',
    label: 'Internship Certificate',
    description: 'Certifies internship completion for a student/trainee',
    fields: [
      { key: 'internName', label: 'Intern Name', prefill: 'name' },
      { key: 'institution', label: 'Institution / College', type: 'text' },
      { key: 'domain', label: 'Internship Domain (e.g. Full Stack Development)', type: 'text' },
      { key: 'internshipFrom', label: 'Internship From', type: 'date', prefill: 'joiningDate' },
      { key: 'internshipTo', label: 'Internship To', type: 'date' },
      { key: 'completionRemark', label: 'Completion Remark (optional)', type: 'textarea' },
    ],
  },
  leaving_certificate: {
    type: 'leaving_certificate',
    label: 'Leaving Certificate',
    description: 'Relieving letter confirming resignation and handover',
    fields: [
      { key: 'employeeName', label: 'Employee Name', prefill: 'name' },
      { key: 'employeeId', label: 'Employee ID', prefill: 'employeeId' },
      { key: 'designation', label: 'Designation', prefill: 'designation' },
      { key: 'department', label: 'Department', prefill: 'department' },
      { key: 'joiningDate', label: 'Joining Date', type: 'date', prefill: 'joiningDate' },
      { key: 'relievingDate', label: 'Relieving Date', type: 'date' },
      { key: 'conductRemark', label: 'Conduct Remark (optional)', type: 'textarea' },
    ],
  },
  salary_slip: {
    type: 'salary_slip',
    label: 'Salary Slip',
    description: 'Monthly payslip with earnings, deductions and net pay',
    fields: [
      { key: 'employeeName', label: 'Employee Name', prefill: 'name' },
      { key: 'employeeId', label: 'Employee ID', prefill: 'employeeId' },
      { key: 'designation', label: 'Designation', prefill: 'designation' },
      { key: 'department', label: 'Department', prefill: 'department' },
      { key: 'month', label: 'Salary Month (e.g. August)', type: 'text' },
      { key: 'year', label: 'Year', type: 'number' },
      { key: 'paidDays', label: 'Paid Days', type: 'number' },
      { key: 'lopDays', label: 'LOP Days', type: 'number' },
      { key: 'basic', label: 'Basic Salary (Rs.)', type: 'number' },
      { key: 'hra', label: 'HRA (Rs.)', type: 'number' },
      { key: 'conveyance', label: 'Conveyance Allowance (Rs.)', type: 'number' },
      { key: 'medicalAllowance', label: 'Medical Allowance (Rs.)', type: 'number' },
      { key: 'specialAllowance', label: 'Special Allowance (Rs.)', type: 'number' },
      { key: 'pf', label: 'Provident Fund (Rs.)', type: 'number' },
      { key: 'professionalTax', label: 'Professional Tax (Rs.)', type: 'number' },
      { key: 'tds', label: 'TDS (Rs.)', type: 'number' },
      { key: 'otherDeductions', label: 'Other Deductions (Rs.)', type: 'number' },
    ],
  },
};

// ---------- formatting helpers ----------

const fmtDate = (v: unknown): string => {
  if (!v) return '—';
  const d = new Date(String(v));
  if (Number.isNaN(d.getTime())) return String(v);
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
};

const fmtINR = (v: unknown): string => {
  const n = Number(v ?? 0) || 0;
  return `Rs. ${n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

export interface DocumentRenderInput {
  docType: DocumentDocType;
  fields: Record<string, unknown>;
  docNumber: string;
  issueDate: string; // ISO date
  issuedBy?: string | null;
}

/** @deprecated Use DocumentRenderInput (shared by PDF and DOCX renderers). */
export type DocumentPdfInput = DocumentRenderInput;

// ---------- shared letterhead / signature / footer ----------

function drawLetterhead(doc: jsPDF) {
  const w = doc.internal.pageSize.getWidth();
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(30, 30, 60);
  doc.text(COMPANY.name, w / 2, 20, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(90, 90, 110);
  doc.text(COMPANY.address, w / 2, 26, { align: 'center' });
  doc.text(`CIN: ${COMPANY.cin}`, w / 2, 31, { align: 'center' });
  doc.setDrawColor(30, 30, 60);
  doc.setLineWidth(0.8);
  doc.line(14, 35, w - 14, 35);
  doc.setTextColor(0, 0, 0);
}

function drawTitle(doc: jsPDF, title: string, issueDate: string, docNumber: string) {
  const w = doc.internal.pageSize.getWidth();
  let y = 48;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(200, 30, 30);
  doc.text(title.toUpperCase(), w / 2, y, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(80, 80, 80);
  y += 7;
  doc.text(`Date: ${fmtDate(issueDate)}`, w - 14, y, { align: 'right' });
  doc.text(`Ref No: ${docNumber}`, 14, y);
  doc.setTextColor(0, 0, 0);
  return y + 10;
}

function drawParagraph(doc: jsPDF, text: string, y: number): number {
  const w = doc.internal.pageSize.getWidth();
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10.5);
  const lines = doc.splitTextToSize(text, w - 28) as string[];
  for (const line of lines) {
    if (y > doc.internal.pageSize.getHeight() - 45) {
      doc.addPage();
      y = 25;
    }
    doc.text(line, 14, y);
    y += 6;
  }
  return y;
}

function drawSignature(doc: jsPDF, issuedBy?: string | null) {
  const pageHeight = doc.internal.pageSize.getHeight();
  const w = doc.internal.pageSize.getWidth();
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10.5);
  doc.text(`For ${COMPANY.name}`, w - 14, pageHeight - 38, { align: 'right' });
  doc.setDrawColor(120, 120, 120);
  doc.setLineWidth(0.3);
  doc.line(w - 74, pageHeight - 22, w - 14, pageHeight - 22);
  doc.text(issuedBy || 'Authorised Signatory', w - 14, pageHeight - 17, { align: 'right' });
  doc.setFont('helvetica', 'bold');
  doc.text('Authorised Signatory', w - 14, pageHeight - 12, { align: 'right' });
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(8);
  doc.setTextColor(120, 120, 120);
  doc.text('This is a computer generated document and does not require a physical signature.', w / 2, pageHeight - 6, { align: 'center' });
  doc.setTextColor(0, 0, 0);
}

function drawKeyValueGrid(doc: jsPDF, pairs: [string, string][], y: number): number {
  const w = doc.internal.pageSize.getWidth();
  const colW = (w - 28) / 2;
  let x = 14;
  let row = y;
  doc.setFontSize(10);
  for (let i = 0; i < pairs.length; i++) {
    const [k, v] = pairs[i];
    if (i > 0 && i % 2 === 0) {
      x = 14;
      row += 9;
    }
    doc.setFont('helvetica', 'bold');
    doc.text(`${k}:`, x, row);
    doc.setFont('helvetica', 'normal');
    doc.text(v || '—', x + colW * 0.42, row);
    x += colW;
  }
  return row + 12;
}

// ---------- per-type document bodies ----------

function buildAppointmentLetter(doc: jsPDF, input: DocumentPdfInput) {
  const f = input.fields;
  let y = drawTitle(doc, 'Appointment Letter', input.issueDate, input.docNumber);
  y = drawParagraph(doc, `To,\n${String(f.employeeName ?? '—')}`, y + 2) + 4;
  doc.setFont('helvetica', 'bold');
  doc.text(`Subject: Appointment as ${f.designation ?? 'Employee'}`, 14, y);
  doc.setFont('helvetica', 'normal');
  y += 10;
  y = drawParagraph(doc, `Dear ${String(f.employeeName ?? '').split(' ')[0] || 'Candidate'},`, y) + 2;
  y = drawParagraph(
    doc,
    `We are pleased to appoint you as ${f.designation ?? 'Employee'} in the ${f.department ?? '—'} department of ${COMPANY.name}, with effect from ${fmtDate(f.joiningDate)}. You will report to your designated manager and be responsible for the duties assigned to you from time to time.`,
    y,
  ) + 4;
  y = drawParagraph(
    doc,
    `Your annual cost to company (CTC) will be ${f.ctc ?? '—'}. Your working hours will be ${f.workingHours ?? '—'}. You will be on probation for the first ${f.probationMonths ?? 6} month(s), during which your performance and conduct will be reviewed before confirmation of employment.`,
    y,
  ) + 4;
  y = drawParagraph(
    doc,
    `During your employment you will be governed by the company policies, rules and regulations in force, which may be amended from time to time. You are requested to sign the copy of this letter as a token of your acceptance of the above terms and conditions.`,
    y,
  ) + 4;
  drawParagraph(doc, `We welcome you to ${COMPANY.name} and wish you a rewarding career with us.`, y);
}

function buildExperienceCertificate(doc: jsPDF, input: DocumentPdfInput) {
  const f = input.fields;
  let y = drawTitle(doc, 'Experience Certificate', input.issueDate, input.docNumber);
  y = drawParagraph(doc, 'TO WHOMSOEVER IT MAY CONCERN', y + 2) + 4;
  y = drawParagraph(
    doc,
    `This is to certify that ${f.employeeName ?? '—'} was employed with ${COMPANY.name} as ${f.designation ?? '—'} in the ${f.department ?? '—'} department from ${fmtDate(f.employmentFrom)} to ${fmtDate(f.employmentTo)}.`,
    y,
  ) + 4;
  y = drawParagraph(
    doc,
    `During their tenure with us, we found them sincere, hardworking and dedicated to their responsibilities.${f.conductRemark ? ` ${f.conductRemark}` : ''}`,
    y,
  ) + 4;
  drawParagraph(doc, 'We wish them all the best in their future endeavours.', y);
}

function buildInternshipCertificate(doc: jsPDF, input: DocumentPdfInput) {
  const f = input.fields;
  let y = drawTitle(doc, 'Internship Certificate', input.issueDate, input.docNumber);
  y = drawParagraph(doc, 'TO WHOMSOEVER IT MAY CONCERN', y + 2) + 4;
  y = drawParagraph(
    doc,
    `This is to certify that ${f.internName ?? '—'}${f.institution ? ` of ${f.institution}` : ''} has successfully completed an internship in ${f.domain ?? '—'} at ${COMPANY.name} from ${fmtDate(f.internshipFrom)} to ${fmtDate(f.internshipTo)}.`,
    y,
  ) + 4;
  y = drawParagraph(
    doc,
    `During the internship, they were actively involved in project work and demonstrated strong learning ability, professionalism and a keen interest in their domain.${f.completionRemark ? ` ${f.completionRemark}` : ''}`,
    y,
  ) + 4;
  drawParagraph(doc, 'We wish them great success in their future career.', y);
}

function buildLeavingCertificate(doc: jsPDF, input: DocumentPdfInput) {
  const f = input.fields;
  let y = drawTitle(doc, 'Leaving Certificate', input.issueDate, input.docNumber);
  y = drawParagraph(doc, 'TO WHOMSOEVER IT MAY CONCERN', y + 2) + 4;
  y = drawParagraph(
    doc,
    `This is to certify that ${f.employeeName ?? '—'} (Employee ID: ${f.employeeId ?? '—'}) served ${COMPANY.name} as ${f.designation ?? '—'} in the ${f.department ?? '—'} department from ${fmtDate(f.joiningDate)} to ${fmtDate(f.relievingDate)}.`,
    y,
  ) + 4;
  y = drawParagraph(
    doc,
    `They have been relieved from their duties effective ${fmtDate(f.relievingDate)}, after completing all necessary exit formalities and handing over their responsibilities.${f.conductRemark ? ` ${f.conductRemark}` : ''}`,
    y,
  ) + 4;
  drawParagraph(doc, 'We thank them for their contributions and wish them success in all their future pursuits.', y);
}

function buildSalarySlip(doc: jsPDF, input: DocumentPdfInput) {
  const f = input.fields as Record<string, any>;
  let y = drawTitle(doc, `Salary Slip - ${f.month ?? ''} ${f.year ?? ''}`, input.issueDate, input.docNumber);
  y = drawKeyValueGrid(doc, [
    ['Employee Name', f.employeeName ?? ''],
    ['Employee ID', f.employeeId ?? ''],
    ['Designation', f.designation ?? ''],
    ['Department', f.department ?? ''],
    ['Salary Month', `${f.month ?? '—'} ${f.year ?? ''}`],
    ['Paid Days / LOP', `${f.paidDays ?? 0} / ${f.lopDays ?? 0}`],
  ], y);
  autoTable(doc, {
    startY: y,
    head: [['Earnings', 'Amount', 'Deductions', 'Amount']],
    body: [
      ['Basic Salary', fmtINR(f.basic), 'Provident Fund', fmtINR(f.pf)],
      ['House Rent Allowance', fmtINR(f.hra), 'Professional Tax', fmtINR(f.professionalTax)],
      ['Conveyance Allowance', fmtINR(f.conveyance), 'TDS', fmtINR(f.tds)],
      ['Medical Allowance', fmtINR(f.medicalAllowance), 'Other Deductions', fmtINR(f.otherDeductions)],
      ['Special Allowance', fmtINR(f.specialAllowance), '', ''],
      ['Gross Earnings', fmtINR(f.grossEarnings), 'Total Deductions', fmtINR(f.totalDeductions)],
    ],
    theme: 'grid',
    styles: { fontSize: 9.5, cellPadding: 2.5 },
    headStyles: { fillColor: [30, 30, 60], textColor: 255, fontStyle: 'bold' },
    columnStyles: { 1: { halign: 'right' }, 3: { halign: 'right' } },
    margin: { left: 14, right: 14 },
  });
  const endY = (doc as any).lastAutoTable?.finalY ?? y + 40;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text(`Net Pay: ${fmtINR(f.netPay)}`, 14, endY + 10);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(120, 120, 120);
  doc.text('Note: This is a computer generated salary slip.', 14, endY + 16);
  doc.setTextColor(0, 0, 0);
}

function buildBody(doc: jsPDF, input: DocumentPdfInput) {
  switch (input.docType) {
    case 'appointment_letter': return buildAppointmentLetter(doc, input);
    case 'experience_certificate': return buildExperienceCertificate(doc, input);
    case 'internship_certificate': return buildInternshipCertificate(doc, input);
    case 'leaving_certificate': return buildLeavingCertificate(doc, input);
    case 'salary_slip': return buildSalarySlip(doc, input);
  }
}

// ---------- public API ----------

export function generateDocumentPdf(input: DocumentPdfInput): jsPDF {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  drawLetterhead(doc);
  buildBody(doc, input);
  drawSignature(doc, input.issuedBy);
  return doc;
}

export function downloadDocumentPdf(input: DocumentPdfInput) {
  const doc = generateDocumentPdf(input);
  const name = input.docNumber || docTypeLabel(input.docType).replace(/\s+/g, '-');
  doc.save(`${name}.pdf`);
}

export function documentPdfPreviewUrl(input: DocumentPdfInput): string {
  return generateDocumentPdf(input).output('datauristring');
}

// ---------- DOCX (Word) rendering ----------

const pt = (n: number) => n * 2; // docx uses half-points for font sizes

type DocxAlignment = (typeof AlignmentType)[keyof typeof AlignmentType];

interface DocxParaOpts {
  bold?: boolean;
  italics?: boolean;
  size?: number; // pt
  align?: DocxAlignment;
  spacingAfter?: number; // twips
  color?: string;
}

function docxP(text: string, opts: DocxParaOpts = {}): Paragraph {
  return new Paragraph({
    alignment: opts.align,
    spacing: { after: opts.spacingAfter ?? 160, line: 300 },
    children: [new TextRun({ text, bold: opts.bold, italics: opts.italics, size: pt(opts.size ?? 11), color: opts.color })],
  });
}

function docxBody(text: string, spacingAfter = 220): Paragraph {
  return new Paragraph({
    alignment: AlignmentType.JUSTIFIED,
    spacing: { after: spacingAfter, line: 320 },
    children: [new TextRun({ text, size: pt(11) })],
  });
}

function docxSpacer(after = 240): Paragraph {
  return new Paragraph({ spacing: { after }, children: [] });
}

const DOCX_TABLE_BORDERS = (() => {
  const b = { style: BorderStyle.SINGLE, size: 4, color: 'B7B4CC' };
  return { top: b, bottom: b, left: b, right: b, insideHorizontal: b, insideVertical: b };
})();

function docxCell(text: string, opts: { bold?: boolean; fill?: string; widthPct?: number; align?: DocxAlignment } = {}): TableCell {
  return new TableCell({
    width: opts.widthPct !== undefined ? { size: opts.widthPct, type: WidthType.PERCENTAGE } : undefined,
    shading: opts.fill ? { type: ShadingType.CLEAR, color: 'auto', fill: opts.fill } : undefined,
    margins: { top: 60, bottom: 60, left: 120, right: 120 },
    children: [docxP(text, { bold: opts.bold, size: 10, align: opts.align, spacingAfter: 0 })],
  });
}

function docxKeyValueTable(pairs: [string, string][]): Table {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: DOCX_TABLE_BORDERS,
    rows: pairs.map(([k, v]) => new TableRow({
      children: [
        docxCell(k, { bold: true, fill: 'F3F1FA', widthPct: 35 }),
        docxCell(v, { widthPct: 65 }),
      ],
    })),
  });
}

function docxLetterhead(): Paragraph[] {
  return [
    docxP(COMPANY.name, { bold: true, size: 18, align: AlignmentType.CENTER, spacingAfter: 60, color: '1F2937' }),
    docxP(COMPANY.address, { size: 9, align: AlignmentType.CENTER, spacingAfter: 40, color: '6B7280' }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 240 },
      border: { bottom: { style: BorderStyle.SINGLE, size: 12, color: '4C1D95', space: 4 } },
      children: [new TextRun({ text: `CIN: ${COMPANY.cin}`, size: pt(8), color: '9CA3AF' })],
    }),
  ];
}

function docxTitleBlock(title: string, issueDate: string, docNumber: string): Paragraph[] {
  return [
    docxP(title, { bold: true, size: 14, align: AlignmentType.CENTER, spacingAfter: 80 }),
    docxP(`Ref No: ${docNumber || '—'}`, { size: 9, align: AlignmentType.RIGHT, spacingAfter: 40, color: '6B7280' }),
    docxP(`Date: ${fmtDate(issueDate)}`, { size: 9, align: AlignmentType.RIGHT, spacingAfter: 280, color: '6B7280' }),
  ];
}

function docxSignature(issuedBy?: string | null): Paragraph[] {
  return [
    docxSpacer(400),
    docxP(`For ${COMPANY.name}`, { align: AlignmentType.RIGHT, spacingAfter: 500 }),
    docxP(issuedBy || 'Authorised Signatory', { bold: true, align: AlignmentType.RIGHT, spacingAfter: 40 }),
    docxP('Authorised Signatory', { size: 9, align: AlignmentType.RIGHT, color: '6B7280', spacingAfter: 300 }),
    docxP('This is a computer generated document and does not require a physical signature.', { size: 8, italics: true, align: AlignmentType.CENTER, color: '9CA3AF' }),
  ];
}

function docxAppointmentLetter(f: Record<string, unknown>): Paragraph[] {
  return [
    docxP('To,', { spacingAfter: 20 }),
    docxP(String(f.employeeName ?? '—'), { spacingAfter: 240 }),
    docxP(`Subject: Appointment as ${f.designation ?? 'Employee'}`, { bold: true, spacingAfter: 240 }),
    docxP(`Dear ${String(f.employeeName ?? '').split(' ')[0] || 'Candidate'},`, { spacingAfter: 120 }),
    docxBody(`We are pleased to appoint you as ${f.designation ?? 'Employee'} in the ${f.department ?? '—'} department of ${COMPANY.name}, with effect from ${fmtDate(f.joiningDate)}. You will report to your designated manager and be responsible for the duties assigned to you from time to time.`),
    docxBody(`Your annual cost to company (CTC) will be ${f.ctc ?? '—'}. Your working hours will be ${f.workingHours ?? '—'}. You will be on probation for the first ${f.probationMonths ?? 6} month(s), during which your performance and conduct will be reviewed before confirmation of employment.`),
    docxBody(`During your employment you will be governed by the company policies, rules and regulations in force, which may be amended from time to time. You are requested to sign the copy of this letter as a token of your acceptance of the above terms and conditions.`),
    docxBody(`We welcome you to ${COMPANY.name} and wish you a rewarding career with us.`),
  ];
}

function docxExperienceCertificate(f: Record<string, unknown>): Paragraph[] {
  return [
    docxP('TO WHOMSOEVER IT MAY CONCERN', { bold: true, spacingAfter: 240 }),
    docxBody(`This is to certify that ${f.employeeName ?? '—'} was employed with ${COMPANY.name} as ${f.designation ?? '—'} in the ${f.department ?? '—'} department from ${fmtDate(f.employmentFrom)} to ${fmtDate(f.employmentTo)}.`),
    docxBody(`During their tenure with us, we found them sincere, hardworking and dedicated to their responsibilities.${f.conductRemark ? ` ${f.conductRemark}` : ''}`),
    docxBody('We wish them all the best in their future endeavours.'),
  ];
}

function docxInternshipCertificate(f: Record<string, unknown>): Paragraph[] {
  return [
    docxP('TO WHOMSOEVER IT MAY CONCERN', { bold: true, spacingAfter: 240 }),
    docxBody(`This is to certify that ${f.internName ?? '—'}${f.institution ? ` of ${f.institution}` : ''} has successfully completed an internship in ${f.domain ?? '—'} at ${COMPANY.name} from ${fmtDate(f.internshipFrom)} to ${fmtDate(f.internshipTo)}.`),
    docxBody(`During the internship, they were actively involved in project work and demonstrated strong learning ability, professionalism and a keen interest in their domain.${f.completionRemark ? ` ${f.completionRemark}` : ''}`),
    docxBody('We wish them great success in their future career.'),
  ];
}
function docxLeavingCertificate(f: Record<string, unknown>): Paragraph[] {
  return [
    docxP('TO WHOMSOEVER IT MAY CONCERN', { bold: true, spacingAfter: 240 }),
    docxBody(`This is to certify that ${f.employeeName ?? '—'} (Employee ID: ${f.employeeId ?? '—'}) served ${COMPANY.name} as ${f.designation ?? '—'} in the ${f.department ?? '—'} department from ${fmtDate(f.joiningDate)} to ${fmtDate(f.relievingDate)}.`),
    docxBody(`They have been relieved from their duties effective ${fmtDate(f.relievingDate)}, after completing all necessary exit formalities and handing over their responsibilities.${f.conductRemark ? ` ${f.conductRemark}` : ''}`),
    docxBody('We thank them for their contributions and wish them success in all their future pursuits.'),
  ];
}

function docxSalarySlip(f: Record<string, any>): (Paragraph | Table)[] {
  const salaryRows: [string, string, string, string][] = [
    ['Basic Salary', fmtINR(f.basic), 'Provident Fund', fmtINR(f.pf)],
    ['House Rent Allowance', fmtINR(f.hra), 'Professional Tax', fmtINR(f.professionalTax)],
    ['Conveyance Allowance', fmtINR(f.conveyance), 'TDS', fmtINR(f.tds)],
    ['Medical Allowance', fmtINR(f.medicalAllowance), 'Other Deductions', fmtINR(f.otherDeductions)],
    ['Special Allowance', fmtINR(f.specialAllowance), '', ''],
    ['Gross Earnings', fmtINR(f.grossEarnings), 'Total Deductions', fmtINR(f.totalDeductions)],
  ];
  return [
    docxKeyValueTable([
      ['Employee Name', String(f.employeeName ?? '—')],
      ['Employee ID', String(f.employeeId ?? '—')],
      ['Designation', String(f.designation ?? '—')],
      ['Department', String(f.department ?? '—')],
      ['Salary Month', `${f.month ?? '—'} ${f.year ?? ''}`],
      ['Paid Days / LOP', `${f.paidDays ?? 0} / ${f.lopDays ?? 0}`],
    ]),
    docxSpacer(200),
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: DOCX_TABLE_BORDERS,
      rows: [
        new TableRow({
          tableHeader: true,
          children: [
            docxCell('Earnings', { bold: true, fill: 'E9E4F5', widthPct: 32 }),
            docxCell('Amount', { bold: true, fill: 'E9E4F5', widthPct: 18, align: AlignmentType.RIGHT }),
            docxCell('Deductions', { bold: true, fill: 'E9E4F5', widthPct: 32 }),
            docxCell('Amount', { bold: true, fill: 'E9E4F5', widthPct: 18, align: AlignmentType.RIGHT }),
          ],
        }),
        ...salaryRows.map(([a, b, c, d], i) => new TableRow({
          children: [
            docxCell(a, { bold: i === salaryRows.length - 1, widthPct: 32 }),
            docxCell(b, { bold: i === salaryRows.length - 1, widthPct: 18, align: AlignmentType.RIGHT }),
            docxCell(c, { bold: i === salaryRows.length - 1, widthPct: 32 }),
            docxCell(d, { bold: i === salaryRows.length - 1, widthPct: 18, align: AlignmentType.RIGHT }),
          ],
        })),
      ],
    }),
    docxSpacer(120),
    docxP(`Net Pay: ${fmtINR(f.netPay)}`, { bold: true, size: 12, spacingAfter: 120 }),
    docxP('Note: This is a computer generated salary slip.', { size: 8, italics: true, color: '9CA3AF' }),
  ];
}

function docxBuildBody(docType: DocumentDocType, f: Record<string, unknown>): (Paragraph | Table)[] {
  switch (docType) {
    case 'appointment_letter': return docxAppointmentLetter(f);
    case 'experience_certificate': return docxExperienceCertificate(f);
    case 'internship_certificate': return docxInternshipCertificate(f);
    case 'leaving_certificate': return docxLeavingCertificate(f);
    case 'salary_slip': return docxSalarySlip(f);
  }
}
export async function generateDocumentDocxBlob(input: DocumentRenderInput): Promise<Blob> {
  const children: (Paragraph | Table)[] = [
    ...docxLetterhead(),
    ...docxTitleBlock(docTypeLabel(input.docType), input.issueDate, input.docNumber),
    ...docxBuildBody(input.docType, input.fields),
    ...docxSignature(input.issuedBy),
  ];
  const doc = new DocxDocument({
    styles: { default: { document: { run: { font: 'Calibri', size: pt(11) } } } },
    sections: [{
      properties: { page: { margin: { top: 720, bottom: 720, left: 900, right: 900 } } },
      children,
    }],
  });
  return Packer.toBlob(doc);
}

export async function downloadDocumentDoc(input: DocumentRenderInput): Promise<void> {
  const blob = await generateDocumentDocxBlob(input);
  const name = input.docNumber || docTypeLabel(input.docType).replace(/\s+/g, '-');
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${name}.docx`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}