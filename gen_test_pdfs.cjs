
const { generateDocumentPdf } = require('./web/src/lib/documentTemplates.ts');
const fs = require('fs');
const path = require('path');

const testDir = path.join(__dirname, 'test-pdfs');
if (!fs.existsSync(testDir)) fs.mkdirSync(testDir, { recursive: true });

const tests = [
  {
    docType: 'appointment_letter',
    fields: {
      employeeName: 'Rahul Kumar',
      gender: 'male',
      dob: '1995-05-15',
      designation: 'Senior Energy Engineer',
      joiningDate: '2024-01-15',
      university: 'KIIT University, Bhubaneswar',
      qualification: 'B.Tech in Electrical Engineering',
      enrolmentNumber: 'EN2024001',
      permanentAddress: '123 Main Street, Bhubaneswar\nOdisha 751001',
      monthlySalary: 'Rs. 45,000/-',
      workingHours: '8 hours per day',
      responsibilities: '1. Lead energy audit projects\n2. Conduct PAT scheme assessments\n3. Prepare energy conservation reports\n4. Client presentations and recommendations\n5. Team coordination and project management\n6. Regulatory compliance documentation\n7. Risk assessment and mitigation planning\n8. Quality assurance and review processes',
      terms: '1. Probation period of 6 months\n2. Annual performance review\n3. Confidentiality agreement\n4. Non-compete clause for 12 months\n5. Company policies apply',
      content: 'Additional terms regarding work from home policy and flexible hours may be discussed during onboarding.'
    },
    docNumber: 'PTC/HR/2024/001',
    issueDate: '2024-01-10'
  },
  {
    docType: 'leaving_certificate',
    fields: {
      employeeName: 'Priya Sharma',
      gender: 'female',
      resignationDate: '2024-01-05',
      relievingDate: '2024-01-15',
      settlementDate: '2024-01-20',
      tenure: 'last 2 years',
      permanentAddress: '456 Park Road, Cuttack\nOdisha 753001',
      phone: '9876543210',
      email: 'priya.sharma@email.com'
    },
    docNumber: 'PTC/HR/2024/002',
    issueDate: '2024-01-15'
  },
  {
    docType: 'experience_certificate',
    fields: {
      employeeName: 'Amit Patel',
      gender: 'male',
      fatherName: 'Mr. Rajesh Patel',
      designation: 'Energy Consultant',
      employmentFrom: '2021-03-01',
      employmentTo: '2024-01-10',
      permanentAddress: '786 MG Road, Bhubaneswar\nOdisha 751001',
      projectRemarks: 'Led energy audit projects for major industrial clients. Conducted PAT scheme assessments for designated consumers. Prepared comprehensive energy conservation reports. Managed team of 5 engineers. Coordinated with DISCOM for DSM activities. Implemented ECBC compliance in commercial buildings.',
      conductRemark: 'He is sincere, hardworking and his conduct is good.',
      place: 'Bhubaneswar'
    },
    docNumber: 'PTC/HR/2024/003',
    issueDate: '2024-01-10'
  },
  {
    docType: 'internship_certificate',
    fields: {
      internName: 'Sneha Reddy',
      gender: 'female',
      institution: 'IIT Bhubaneswar',
      registrationNumber: 'IITBB2023001',
      fatherName: 'Mr. Krishna Reddy',
      domain: 'Full Stack Development',
      internshipFrom: '2023-12-01',
      internshipTo: '2023-12-31',
      completionRemark: 'Her contribution was outstanding. She demonstrated excellent technical skills and teamwork. She is sincere, hardworking and her conduct is good.'
    },
    docNumber: 'PTC/HR/2024/004',
    issueDate: '2023-12-31'
  },
  {
    docType: 'salary_slip',
    fields: {
      employeeName: 'Vikram Singh',
      employeeId: 'PTC001',
      designation: 'Project Engineer',
      department: 'Energy Services',
      month: 'January',
      year: 2024,
      daysWorked: 31,
      uan: '100123456789',
      joiningDate: '2023-06-01',
      basicPay: 35000,
      dearnessAllowance: 5000,
      variablePay: 3000,
      travellingAllowance: 2000,
      hra: 8000,
      projectAllowance: 2000,
      responsibilityAllowance: 1500,
      specialAllowance: 1000,
      performanceIncentive: 2500,
      annualBonus: 0,
      compensatoryAllowance: 0,
      pf: 4800,
      esi: 337,
      employerPf: 4800,
      employerEsi: 1087,
      advancePaid: 0,
      excessLeaveDeduction: 0
    },
    docNumber: 'PTC/SAL/2024/001',
    issueDate: '2024-02-01'
  }
];

for (const t of tests) {
  try {
    const doc = generateDocumentPdf(t);
    const outPath = path.join(testDir, `${t.docType}.pdf`);
    doc.save(outPath);
    console.log(`OK: ${t.docType} -> ${outPath}`);
  } catch (e) {
    console.error(`FAIL: ${t.docType}: ${e.message}`);
  }
}
console.log('DONE');
