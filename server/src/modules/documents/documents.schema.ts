import { z } from 'zod';

export const DOC_TYPES = ['appointment_letter', 'experience_certificate', 'internship_certificate', 'leaving_certificate', 'salary_slip'] as const;

export type DocType = (typeof DOC_TYPES)[number];

export const DOC_TYPE_LABELS: Record<DocType, string> = {
  appointment_letter: 'Appointment Letter',
  experience_certificate: 'Experience Certificate',
  internship_certificate: 'Internship Certificate',
  leaving_certificate: 'Leaving Certificate',
  salary_slip: 'Salary Slip',
};

export const DOC_TYPE_CODES: Record<DocType, string> = {
  appointment_letter: 'AL',
  experience_certificate: 'EC',
  internship_certificate: 'IC',
  leaving_certificate: 'LC',
  salary_slip: 'SS',
};

export const createDocumentRequestSchema = z.object({
  docType: z.enum(DOC_TYPES),
  note: z.string().trim().max(1000, 'Note too long (max 1000 characters)').optional(),
  userId: z.string().trim().min(1).optional(),
});

export const listDocumentsSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  status: z.enum(['pending', 'issued', 'rejected', 'cancelled']).optional(),
  docType: z.enum(DOC_TYPES).optional(),
  userId: z.string().trim().min(1).optional(),
});

export const issueDocumentBodySchema = z.object({
  fields: z.record(z.string(), z.unknown()).default({}),
});

export const rejectDocumentSchema = z.object({
  reason: z.string().trim().max(1000, 'Reason too long (max 1000 characters)').optional(),
});

const dateString = z.string().trim().min(1, 'Date is required');

const money = z.coerce.number().min(0, 'Amount cannot be negative').default(0);

// Per-type validation for the template fields filled by director/HR.
export const documentFieldSchemas: Record<DocType, z.ZodTypeAny> = {
  appointment_letter: z.object({
    employeeName: z.string().trim().min(1, 'Employee name is required'),
    employeeId: z.string().trim().min(1, 'Employee ID is required'),
    designation: z.string().trim().min(1, 'Designation is required'),
    department: z.string().trim().min(1, 'Department is required'),
    joiningDate: dateString.optional(),
    ctc: z.string().trim().min(1, 'Annual CTC is required'),
    workingHours: z.string().trim().min(1, 'Working hours are required'),
    probationMonths: z.coerce.number().int().min(0, 'Probation cannot be negative').max(24, 'Probation cannot exceed 24 months').default(6),
  }),
  experience_certificate: z.object({
    employeeName: z.string().trim().min(1, 'Employee name is required'),
    designation: z.string().trim().min(1, 'Designation is required'),
    department: z.string().trim().min(1, 'Department is required'),
    employmentFrom: dateString,
    employmentTo: dateString,
    conductRemark: z.string().trim().max(500).optional(),
  }).refine((d) => d.employmentTo >= d.employmentFrom, {
    message: 'Employment end date must be on or after the start date',
    path: ['employmentTo'],
  }),
  internship_certificate: z.object({
    internName: z.string().trim().min(1, 'Intern name is required'),
    institution: z.string().trim().min(1, 'Institution/college name is required'),
    domain: z.string().trim().min(1, 'Internship domain is required'),
    internshipFrom: dateString,
    internshipTo: dateString,
    completionRemark: z.string().trim().max(500).optional(),
  }).refine((d) => d.internshipTo >= d.internshipFrom, {
    message: 'Internship end date must be on or after the start date',
    path: ['internshipTo'],
  }),
  leaving_certificate: z.object({
    employeeName: z.string().trim().min(1, 'Employee name is required'),
    employeeId: z.string().trim().min(1, 'Employee ID is required'),
    designation: z.string().trim().min(1, 'Designation is required'),
    department: z.string().trim().min(1, 'Department is required'),
    joiningDate: dateString.optional(),
    relievingDate: dateString,
    conductRemark: z.string().trim().max(500).optional(),
  }).refine((d) => !d.joiningDate || d.relievingDate >= d.joiningDate, {
    message: 'Relieving date must be on or after the joining date',
    path: ['relievingDate'],
  }),
  salary_slip: z.object({
    employeeName: z.string().trim().min(1, 'Employee name is required'),
    employeeId: z.string().trim().min(1, 'Employee ID is required'),
    designation: z.string().trim().min(1, 'Designation is required'),
    department: z.string().trim().min(1, 'Department is required'),
    month: z.string().trim().min(1, 'Salary month is required'),
    year: z.coerce.number().int().min(2000).max(2100, 'Invalid year'),
    paidDays: z.coerce.number().min(0, 'Paid days cannot be negative').max(31, 'Paid days cannot exceed 31'),
    lopDays: z.coerce.number().min(0, 'LOP days cannot be negative').max(31, 'LOP days cannot exceed 31').default(0),
    basic: z.coerce.number().min(0, 'Basic salary cannot be negative'),
    hra: money,
    conveyance: money,
    medicalAllowance: money,
    specialAllowance: money,
    pf: money,
    professionalTax: money,
    tds: money,
    otherDeductions: money,
  }),
};

export type CreateDocumentRequestInput = z.infer<typeof createDocumentRequestSchema>;
export type ListDocumentsInput = z.infer<typeof listDocumentsSchema>;
export type IssueDocumentInput = z.infer<typeof issueDocumentBodySchema>;