export enum ApplicationStatus {
  Saved = 'Saved',
  Applied = 'Applied',
  Interviewing = 'Interviewing',
  Offered = 'Offered',
  Rejected = 'Rejected',
  Archived = 'Archived'
}

export interface ApplicationRecordDto {
  id: string;
  generatedResumeId?: string;
  companyName: string;
  jobTitle: string;
  jobUrl?: string;
  location?: string;
  salaryRange?: string;
  status: ApplicationStatus;
  appliedDate?: string;
  nextInterviewDate?: string;
  notes?: string;
  contactPerson?: string;
  contactEmail?: string;
  createdAtUtc: string;
}

export interface CreateApplicationRequest {
  companyName: string;
  jobTitle: string;
  jobUrl?: string;
  location?: string;
  salaryRange?: string;
  status?: ApplicationStatus;
  generatedResumeId?: string;
  notes?: string;
}
