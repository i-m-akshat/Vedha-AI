import { ResumeSchema, TemplateStyle } from './resume';

export interface SkillRoadmapItem {
  skillName: string;
  priority: 'High' | 'Medium' | 'Low';
  recommendedAction: string;
  estimatedLearningTime?: string;
}

export interface AtsScoreBreakdown {
  overallScore: number;
  keywordMatchScore: number;
  skillsMatchScore: number;
  experienceRelevanceScore: number;
  formattingAtsScore: number;
  matchingKeywords: string[];
  missingKeywords: string[];
  matchingSkills: string[];
  missingSkills: string[];
  strengths: string[];
  weaknesses: string[];
  recruiterFeedback: string;
  improvementSuggestions: string[];
  skillRoadmap: SkillRoadmapItem[];
}

export interface TailoredResumeResultDto {
  id: string;
  masterResumeId: string;
  jobDescriptionId: string;
  targetRole: string;
  targetCompany: string;
  selectedTemplate: TemplateStyle;
  masterSchema: ResumeSchema;
  tailoredSchema: ResumeSchema;
  atsAnalysis: AtsScoreBreakdown;
  createdAtUtc: string;
}

export interface GeneratedResumeSummaryDto {
  id: string;
  targetRole: string;
  targetCompany: string;
  matchScore: number;
  selectedTemplate: TemplateStyle;
  createdAtUtc: string;
}
