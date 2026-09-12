export enum JobSource {
  DirectText = 'DirectText',
  LinkedIn = 'LinkedIn',
  Greenhouse = 'Greenhouse',
  Lever = 'Lever',
  Workday = 'Workday',
  Ashby = 'Ashby',
  Wellfound = 'Wellfound',
  Indeed = 'Indeed',
  CompanyCareers = 'CompanyCareers',
  Other = 'Other'
}

export interface JobDescriptionSchema {
  title: string;
  company: string;
  location: string;
  employmentType: string;
  seniority: string;
  experienceRequired?: string;
  salary?: string;
  responsibilities: string[];
  mustHaveSkills: string[];
  niceToHaveSkills: string[];
  tools: string[];
  frameworks: string[];
  databases: string[];
  cloud: string[];
  certifications: string[];
  softSkills: string[];
  keywords: string[];
  benefits: string[];
}

export interface JobDescriptionDto {
  id: string;
  source: JobSource;
  sourceUrl?: string;
  targetCompany: string;
  targetRole: string;
  cleanedText: string;
  extractedSchema: JobDescriptionSchema;
  createdAtUtc: string;
}
