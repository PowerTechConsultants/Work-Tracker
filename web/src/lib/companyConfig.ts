// Company Configuration for Power Tech Consultants
// This file contains all company-specific details and formatting configurations
// (Letterhead & footer per the supplied Power Tech Consultants letterhead image)

export const COMPANY_CONFIG = {
  name: 'Power Tech Consultants',
  website: 'www.powerbazar.in',
  cin: '',
  
  corporateOffice: {
    address: 'K-8-82, Kalinga Nagar, Ghatikia, Bhubaneswar-751029, Odisha',
    phones: {
      standard: ['0674-2954256', '9937112760'],
      experience: ['0674-2954256', '9937112760'],
      withWhatsapp: ['0674-2954256', '9937112760', 'Whatsapp- 9437155337']
    },
    emails: ['pwrtch@gmail.com'],
    website: 'www.pwrtch.com'
  },
  
  registeredOffice: {
    address: 'Regd. Office: 1/A-6, Swati Villa, Surya Vihar, Link Road, Cuttack - 753012, Odisha',
    phone: '0674-2954256, 9937159760'
  },
  
  accreditations: {
    default: '',
    smera: '',
    withSolar: '',
    crisil: '',
    smeraSme: ''
  },
  
  management: {
    name: 'Bibhu Charana Swain',
    title: 'Sr.Consultant,AEA-0121',
    hrTitle: 'Sr.Consultant,AEA-0121',
    hrAdmnTitle: 'Sr.Consultant,AEA-0121',
    phone: 'Phone: 0674-2954256, Mobile No: 9438747172',
    email: 'Email: hr@pwrtch.com',
    web: 'Web: www.pwrtch.com'
  }
};

// Color scheme based on the letterhead image
export const COLORS = {
  companyRed: [192, 0, 0],      // RGB for company name
  corporateBlue: [0, 32, 96],   // RGB for corporate details
  black: [0, 0, 0],             // Body text
  darkGray: [80, 80, 80],       // Secondary text
  dividerBlue: [0, 32, 96],     // Divider lines
};

// Font specifications based on the letterhead image
export const FONTS = {
  company: { family: 'helvetica', style: 'bold', size: 15 },
  accreditation: { family: 'helvetica', style: 'normal', size: 7.5 },
  corporate: { family: 'helvetica', style: 'bold', size: 8 },
  body: { family: 'helvetica', style: 'normal', size: 9 },
  title: { family: 'helvetica', style: 'bold', size: 12 },
  signature: { family: 'helvetica', style: 'bold', size: 8.5 }
};

// Layout dimensions based on the letterhead image
export const LAYOUT = {
  margins: { top: 14, bottom: 14, left: 14, right: 14 },
  headerHeight: 35,
  footerHeight: 15,
  lineHeight: 4,
  sectionSpacing: 8
};
