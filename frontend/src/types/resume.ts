export interface PersonalInfo {
  fullName: string;
  email: string;
  phone: string;
  location: string;
  title?: string;
  linkedInUrl?: string;
  gitHubUrl?: string;
  portfolioUrl?: string;
}

export interface WorkExperienceItem {
  id: string;
  company: string;
  role: string;
  location: string;
  startDate: string;
  endDate: string;
  isCurrent: boolean;
  highlights: string[];
}

export interface ProjectItem {
  id: string;
  title: string;
  description: string;
  technologies?: string;
  url?: string;
  highlights: string[];
}

export interface SkillCategory {
  categoryName: string;
  skills: string[];
}

export interface EducationItem {
  id: string;
  institution: string;
  degree: string;
  fieldOfStudy: string;
  graduationYear: string;
  gpa?: string;
  honors?: string;
}

export interface CertificationItem {
  id: string;
  name: string;
  issuer: string;
  issueDate: string;
  expirationDate?: string;
  credentialId?: string;
  url?: string;
}

export interface AchievementItem {
  id: string;
  title: string;
  description: string;
  date?: string;
}

export interface ResumeSchema {
  personalInfo: PersonalInfo;
  summary: string;
  experience: WorkExperienceItem[];
  projects: ProjectItem[];
  skills: SkillCategory[];
  education: EducationItem[];
  certifications: CertificationItem[];
  achievements: AchievementItem[];
}

export enum ResumeFormat {
  Pdf = 'Pdf',
  Docx = 'Docx',
  Markdown = 'Markdown',
  Json = 'Json'
}

export enum TemplateStyle {
  ClassicAts = 'ClassicAts',
  ModernMinimalist = 'ModernMinimalist',
  ExecutiveClean = 'ExecutiveClean',
  TechnicalPro = 'TechnicalPro'
}

export interface MasterResumeDto {
  id: string;
  title: string;
  originalFileName: string;
  format: ResumeFormat;
  versionNumber: number;
  schema: ResumeSchema;
  createdAtUtc: string;
  updatedAtUtc?: string;
}

export interface ResumeVersionDto {
  id: string;
  versionNumber: number;
  changeDescription: string;
  createdAtUtc: string;
}
