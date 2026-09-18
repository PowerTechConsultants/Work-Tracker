// Render sample documents with the new Power Tech Consultants letterhead (runs in Node via tsx).
// Output: sample-output/*.pdf + .docx — for manual visual inspection.
import { generateDocumentPdf } from '../src/lib/documentTemplates';
import { generateDocumentDocxBlob } from '../src/lib/documentTemplates';
import * as fs from 'fs';
import * as path from 'path';

const outDir = path.join(import.meta.dirname, 'sample-output');
fs.mkdirSync(outDir, { recursive: true });

const baseFields = {
  employeeName: 'Rahul Sharma',
  designation: 'Junior Engineer',
  joiningDate: '2026-09-01',
  employmentFrom: '2025-09-01',
  employmentTo: '2026-09-01',
  resignDate: '2026-08-15',
  relievingDate: '2026-09-01',
  internName: 'Rahul Sharma',
  institution: 'DRIEMS UNIVERSITY, Cuttack',
  internshipFrom: '2026-06-01',
  internshipTo: '2026-08-31',
  domain: 'Full Stack Development',
};

const docs = [
  { type: 'appointment_letter', fields: { ...baseFields, monthlySalary: 'Rs. 20000/-', workingHours: '8 hours per day' } },
  { type: 'experience_certificate', fields: baseFields },
  { type: 'internship_certificate', fields: baseFields },
  { type: 'leaving_certificate', fields: baseFields },
  { type: 'salary_slip', fields: { month: 'August 2026', basicSalary: 30000 } },
];

for (const d of docs) {
  const input = {
    docType: d.type,
    fields: d.fields,
    docNumber: 'PTC/2026/001',
    issueDate: '2026-09-11',
    issuedBy: 'Manager (HR & Admin.)',
  };
  const pdf = generateDocumentPdf(input as never);
  fs.writeFileSync(path.join(outDir, `${d.type}.pdf`), Buffer.from(pdf.output('arraybuffer')));
  console.log(`PDF: ${d.type} -> ${pdf.getNumberOfPages()} page(s)`);
}

const docxInput = {
  docType: 'appointment_letter',
  fields: { ...baseFields, monthlySalary: 'Rs. 20000/-', workingHours: '8 hours per day' },
  docNumber: 'PTC/2026/001',
  issueDate: '2026-09-11',
  issuedBy: 'Manager (HR & Admin.)',
};
const blob = await generateDocumentDocxBlob(docxInput as never);
fs.writeFileSync(path.join(outDir, 'appointment_letter.docx'), Buffer.from(await blob.arrayBuffer()));
console.log('DOCX: appointment_letter written');
console.log('DONE');
