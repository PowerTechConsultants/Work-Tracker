// Document Type Configuration
// This file defines document-specific formatting and configuration options

export type ContactVariant = 'standard' | 'experience' | 'extended';
export type AccreditationType = 'default' | 'smera' | 'withSolar' | 'crisil' | 'smeraSme' | 'none';
export type SignatureType = 'regular' | 'blue' | 'none';
export type ManagerTitle = 'manager' | 'hr_admin' | 'hr_admn' | 'none';
export type DateFormat = 'ordinal' | 'dd_mm_yyyy' | 'mixed';
export type RefNumberFormat = 'standard' | 'short_year' | 'none';

export interface DocumentTypeConfig {
  docType: string;
  useAccreditation: boolean;
  accreditationType: AccreditationType;
  contactVariant: ContactVariant;
  signatureType: SignatureType;
  managerTitle: ManagerTitle;
  dateFormat: DateFormat;
  refNumberFormat: RefNumberFormat;
  includeRefNumber: boolean;
}

export const DOCUMENT_TYPE_CONFIGS: Record<string, DocumentTypeConfig> = {
  appointment_letter: {
    docType: 'appointment_letter',
    useAccreditation: true,
    accreditationType: 'withSolar',
    contactVariant: 'standard',
    signatureType: 'regular',
    managerTitle: 'manager',
    dateFormat: 'ordinal',
    refNumberFormat: 'standard',
    includeRefNumber: true
  },
  
  leaving_certificate: {
    docType: 'leaving_certificate',
    useAccreditation: true,
    accreditationType: 'withSolar',
    contactVariant: 'standard',
    signatureType: 'blue',
    managerTitle: 'hr_admin',
    dateFormat: 'mixed',
    refNumberFormat: 'short_year',
    includeRefNumber: true
  },
  
  experience_certificate: {
    docType: 'experience_certificate',
    useAccreditation: true,
    accreditationType: 'withSolar',
    contactVariant: 'experience',
    signatureType: 'blue',
    managerTitle: 'manager',
    dateFormat: 'ordinal',
    refNumberFormat: 'none',
    includeRefNumber: false
  },
  
  internship_certificate: {
    docType: 'internship_certificate',
    useAccreditation: true,
    accreditationType: 'withSolar',
    contactVariant: 'standard',
    signatureType: 'regular',
    managerTitle: 'hr_admn',
    dateFormat: 'dd_mm_yyyy',
    refNumberFormat: 'short_year',
    includeRefNumber: true
  },
  
  salary_slip: {
    docType: 'salary_slip',
    useAccreditation: true,
    accreditationType: 'withSolar',
    contactVariant: 'standard',
    signatureType: 'none',
    managerTitle: 'none',
    dateFormat: 'ordinal',
    refNumberFormat: 'standard',
    includeRefNumber: true
  }
};

export function getDocumentConfig(docType: string): DocumentTypeConfig {
  return DOCUMENT_TYPE_CONFIGS[docType] || DOCUMENT_TYPE_CONFIGS.appointment_letter;
}