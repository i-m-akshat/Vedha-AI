import React, { useState, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import { 
  UploadCloud, 
  FileText, 
  Plus, 
  Trash2, 
  Save, 
  History, 
  Check, 
  Code, 
  List, 
  Sparkles, 
  RotateCcw,
  AlertTriangle,
  CheckCircle2,
  FolderGit2,
  GraduationCap,
  Award,
  Trophy
} from 'lucide-react';
import { Button, Card, Badge, Input, Textarea, Modal } from '../components/ui';
import { useResumeStore } from '../stores/useTailorStore';
import { 
  ResumeSchema, 
  WorkExperienceItem, 
  ProjectItem, 
  SkillCategory, 
  EducationItem, 
  CertificationItem,
  AchievementItem 
} from '../types/resume';

export const MasterResumePage: React.FC = () => {
  const { 
    masterResume, 
    versions, 
    isLoading, 
    fetchMasterResume, 
    uploadMasterResume, 
    updateMasterResume, 
    fetchVersions, 
    revertVersion,
    deleteMasterResume
  } = useResumeStore();

  const [schema, setSchema] = useState<ResumeSchema | null>(null);
  const [activeTab, setActiveTab] = useState<'form' | 'json'>('form');
  const [jsonText, setJsonText] = useState('');
  const [isVersionModalOpen, setIsVersionModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [inlineError, setInlineError] = useState<string | null>(null);
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [uploadMessage, setUploadMessage] = useState<string>('');

  useEffect(() => {
    fetchMasterResume();
    fetchVersions();
  }, []);

  useEffect(() => {
    if (masterResume) {
      setSchema({
        ...masterResume.schema,
        experience: masterResume.schema.experience || [],
        projects: masterResume.schema.projects || [],
        skills: masterResume.schema.skills || [],
        education: masterResume.schema.education || [],
        certifications: masterResume.schema.certifications || [],
        achievements: masterResume.schema.achievements || [],
      });
      setJsonText(JSON.stringify(masterResume.schema, null, 2));
    } else {
      setSchema(null);
      setJsonText('');
    }
  }, [masterResume]);

  const onDrop = async (acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      const file = acceptedFiles[0];
      setUploadStatus('idle');
      try {
        await uploadMasterResume(file);
        await fetchVersions();
        setUploadStatus('success');
        setUploadMessage(`"${file.name}" uploaded and parsed by AI successfully. Review your structured resume details below.`);
        setTimeout(() => setUploadStatus('idle'), 6000);
      } catch (e: any) {
        setUploadStatus('error');
        setUploadMessage(e?.response?.data?.error || 'Failed to upload and parse resume. Please check your file.');
      }
    }
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'text/markdown': ['.md', '.markdown'],
      'text/plain': ['.txt'],
    },
    maxFiles: 1,
  });

  const handleSave = async () => {
    if (!schema || !masterResume) return;
    setInlineError(null);
    let finalSchema = schema;
    if (activeTab === 'json') {
      try {
        finalSchema = JSON.parse(jsonText);
        setSchema(finalSchema);
      } catch (e) {
        setInlineError('Invalid JSON syntax. Please fix the JSON editor before saving.');
        return;
      }
    }
    try {
      await updateMasterResume(masterResume.title, finalSchema, 'Saved changes via Master Resume Studio');
      fetchVersions();
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (e: any) {
      setInlineError(e?.response?.data?.error || 'Failed to save the master resume. Please try again.');
    }
  };

  const handleDeleteMasterResume = async () => {
    setIsDeleting(true);
    try {
      await deleteMasterResume();
      setSchema(null);
      setJsonText('');
      setIsDeleteModalOpen(false);
    } catch (e: any) {
      setInlineError(e.response?.data?.error || 'Failed to delete master resume. Please try again.');
    } finally {
      setIsDeleting(false);
    }
  };

  // Helpers for editing schema
  const updatePersonalInfo = (field: string, val: string) => {
    if (!schema) return;
    setSchema({
      ...schema,
      personalInfo: { ...schema.personalInfo, [field]: val },
    });
  };

  const addExperience = () => {
    if (!schema) return;
    const newExp: WorkExperienceItem = {
      id: crypto.randomUUID(),
      company: 'Company Name',
      role: 'Role Title',
      location: 'City, Country',
      startDate: '2022',
      endDate: 'Present',
      isCurrent: true,
      highlights: ['Built and optimized core services.'],
    };
    setSchema({ ...schema, experience: [newExp, ...schema.experience] });
  };

  const updateExperience = (idx: number, field: keyof WorkExperienceItem, val: any) => {
    if (!schema) return;
    const exps = [...schema.experience];
    exps[idx] = { ...exps[idx], [field]: val };
    setSchema({ ...schema, experience: exps });
  };

  const addBullet = (expIdx: number) => {
    if (!schema) return;
    const exps = [...schema.experience];
    exps[expIdx].highlights.push('Quantified achievement with measurable business result.');
    setSchema({ ...schema, experience: exps });
  };

  const updateBullet = (expIdx: number, bIdx: number, val: string) => {
    if (!schema) return;
    const exps = [...schema.experience];
    exps[expIdx].highlights[bIdx] = val;
    setSchema({ ...schema, experience: exps });
  };

  const deleteBullet = (expIdx: number, bIdx: number) => {
    if (!schema) return;
    const exps = [...schema.experience];
    exps[expIdx].highlights.splice(bIdx, 1);
    setSchema({ ...schema, experience: exps });
  };

  const deleteExperience = (idx: number) => {
    if (!schema) return;
    const exps = [...schema.experience];
    exps.splice(idx, 1);
    setSchema({ ...schema, experience: exps });
  };

  // Projects Helpers
  const addProject = () => {
    if (!schema) return;
    const newProj: ProjectItem = {
      id: crypto.randomUUID(),
      title: 'Project Title',
      description: 'Project description',
      technologies: 'C#, React, PostgreSQL',
      url: '',
      highlights: ['Key achievement or metric delivered in this project.'],
    };
    setSchema({ ...schema, projects: [newProj, ...(schema.projects || [])] });
  };

  const updateProject = (idx: number, field: keyof ProjectItem, val: any) => {
    if (!schema) return;
    const projs = [...(schema.projects || [])];
    projs[idx] = { ...projs[idx], [field]: val };
    setSchema({ ...schema, projects: projs });
  };

  const deleteProject = (idx: number) => {
    if (!schema) return;
    const projs = [...(schema.projects || [])];
    projs.splice(idx, 1);
    setSchema({ ...schema, projects: projs });
  };

  const addProjectBullet = (projIdx: number) => {
    if (!schema) return;
    const projs = [...(schema.projects || [])];
    projs[projIdx] = {
      ...projs[projIdx],
      highlights: [...(projs[projIdx].highlights || []), 'Quantified project metric or accomplishment.'],
    };
    setSchema({ ...schema, projects: projs });
  };

  const updateProjectBullet = (projIdx: number, bIdx: number, val: string) => {
    if (!schema) return;
    const projs = [...(schema.projects || [])];
    const updatedHighlights = [...(projs[projIdx].highlights || [])];
    updatedHighlights[bIdx] = val;
    projs[projIdx] = { ...projs[projIdx], highlights: updatedHighlights };
    setSchema({ ...schema, projects: projs });
  };

  const deleteProjectBullet = (projIdx: number, bIdx: number) => {
    if (!schema) return;
    const projs = [...(schema.projects || [])];
    const updatedHighlights = [...(projs[projIdx].highlights || [])];
    updatedHighlights.splice(bIdx, 1);
    projs[projIdx] = { ...projs[projIdx], highlights: updatedHighlights };
    setSchema({ ...schema, projects: projs });
  };

  // Education Helpers
  const addEducation = () => {
    if (!schema) return;
    const newEdu: EducationItem = {
      id: crypto.randomUUID(),
      institution: 'University / College Name',
      degree: 'Degree (e.g. B.Tech, M.S., BCA, MCA)',
      fieldOfStudy: 'Computer Science',
      graduationYear: new Date().getFullYear().toString(),
      gpa: '',
      honors: '',
    };
    setSchema({ ...schema, education: [newEdu, ...(schema.education || [])] });
  };

  const updateEducation = (idx: number, field: keyof EducationItem, val: any) => {
    if (!schema) return;
    const edus = [...(schema.education || [])];
    edus[idx] = { ...edus[idx], [field]: val };
    setSchema({ ...schema, education: edus });
  };

  const deleteEducation = (idx: number) => {
    if (!schema) return;
    const edus = [...(schema.education || [])];
    edus.splice(idx, 1);
    setSchema({ ...schema, education: edus });
  };

  // Certifications Helpers
  const addCertification = () => {
    if (!schema) return;
    const newCert: CertificationItem = {
      id: crypto.randomUUID(),
      name: 'Certification Name',
      issuer: 'Issuing Organization',
      issueDate: 'MMM YYYY',
      expirationDate: '',
      credentialId: '',
      url: '',
    };
    setSchema({ ...schema, certifications: [newCert, ...(schema.certifications || [])] });
  };

  const updateCertification = (idx: number, field: keyof CertificationItem, val: any) => {
    if (!schema) return;
    const certs = [...(schema.certifications || [])];
    certs[idx] = { ...certs[idx], [field]: val };
    setSchema({ ...schema, certifications: certs });
  };

  const deleteCertification = (idx: number) => {
    if (!schema) return;
    const certs = [...(schema.certifications || [])];
    certs.splice(idx, 1);
    setSchema({ ...schema, certifications: certs });
  };

  // Achievements Helpers
  const addAchievement = () => {
    if (!schema) return;
    const newAch: AchievementItem = {
      id: crypto.randomUUID(),
      title: 'Achievement or Honor',
      description: 'Description of recognition, award, or hackathon placement',
      date: new Date().getFullYear().toString(),
    };
    setSchema({ ...schema, achievements: [newAch, ...(schema.achievements || [])] });
  };

  const updateAchievement = (idx: number, field: keyof AchievementItem, val: any) => {
    if (!schema) return;
    const achs = [...(schema.achievements || [])];
    achs[idx] = { ...achs[idx], [field]: val };
    setSchema({ ...schema, achievements: achs });
  };

  const deleteAchievement = (idx: number) => {
    if (!schema) return;
    const achs = [...(schema.achievements || [])];
    achs.splice(idx, 1);
    setSchema({ ...schema, achievements: achs });
  };

  // Skill Category Helpers
  const addSkillCategory = () => {
    if (!schema) return;
    const newCat: SkillCategory = {
      categoryName: 'New Category',
      skills: ['Skill 1', 'Skill 2'],
    };
    setSchema({ ...schema, skills: [...(schema.skills || []), newCat] });
  };

  const deleteSkillCategory = (idx: number) => {
    if (!schema) return;
    const cats = [...(schema.skills || [])];
    cats.splice(idx, 1);
    setSchema({ ...schema, skills: cats });
  };

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h2 className="flex items-center gap-2 text-xl font-bold tracking-tight text-slate-900 dark:text-white">
            <FileText className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            Master Resume Center
          </h2>
          <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
            Your single source of truth. Upload once in PDF, DOCX, or Markdown and manage structured data.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {masterResume && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsDeleteModalOpen(true)}
                className="gap-1.5 text-rose-600 dark:text-rose-400 hover:text-rose-700 dark:hover:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-500/10 border-rose-200 dark:border-rose-900/40"
                title="Delete Master Resume and all saved versions"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete</span>
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  fetchVersions();
                  setIsVersionModalOpen(true);
                }}
                className="gap-1.5"
              >
                <History className="w-3.5 h-3.5" />
                <span>Versions ({versions.length})</span>
              </Button>

              <div className="h-6 mx-1 border-l border-slate-200 dark:border-zinc-800" />

              <div className="flex bg-slate-100 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-lg p-0.5">
                <button
                  onClick={() => setActiveTab('form')}
                  className={`px-3 py-1 text-xs rounded-md font-medium transition ${
                    activeTab === 'form' ? 'bg-indigo-600 text-white' : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200'
                  }`}
                >
                  <List className="w-3.5 h-3.5 inline mr-1" /> Form
                </button>
                <button
                  onClick={() => {
                    setJsonText(JSON.stringify(schema, null, 2));
                    setActiveTab('json');
                  }}
                  className={`px-3 py-1 text-xs rounded-md font-medium transition ${
                    activeTab === 'json' ? 'bg-indigo-600 text-white' : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200'
                  }`}
                >
                  <Code className="w-3.5 h-3.5 inline mr-1" /> JSON
                </button>
              </div>

              <Button
                variant="primary"
                size="sm"
                onClick={handleSave}
                className="gap-1.5"
              >
                {saveSuccess ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Save className="w-3.5 h-3.5" />}
                <span>{saveSuccess ? 'Saved!' : 'Save Master'}</span>
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Inline Error Banner */}
      {inlineError && (
        <div className="flex items-start gap-2.5 p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/40 text-xs text-rose-700 dark:text-rose-300">
          <AlertTriangle className="w-4 h-4 shrink-0 text-rose-500 dark:text-rose-400 mt-0.5" />
          <span>{inlineError}</span>
          <button
            onClick={() => setInlineError(null)}
            className="ml-auto text-rose-400 dark:text-rose-500 hover:text-rose-700 dark:hover:text-rose-300 shrink-0"
            aria-label="Dismiss error"
          >✕</button>
        </div>
      )}

      {/* Upload Status Banner */}
      {uploadStatus !== 'idle' && (
        <div className={`flex items-start gap-2.5 p-3.5 rounded-xl border text-xs ${
          uploadStatus === 'success'
            ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-900/40 text-emerald-700 dark:text-emerald-300'
            : 'bg-rose-50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-900/40 text-rose-700 dark:text-rose-300'
        }`}>
          {uploadStatus === 'success'
            ? <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-500 mt-0.5" />
            : <AlertTriangle className="w-4 h-4 shrink-0 text-rose-500 mt-0.5" />}
          <span>{uploadMessage}</span>
          <button onClick={() => setUploadStatus('idle')} className="ml-auto shrink-0" aria-label="Dismiss">✕</button>
        </div>
      )}

      {/* Upload Dropzone */}
      <div
        {...getRootProps()}
        className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all ${
          isDragActive
            ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-500/10'
            : 'border-slate-300 hover:border-indigo-400 bg-white/90 dark:border-zinc-800 dark:hover:border-zinc-700 dark:bg-zinc-900/30 shadow-sm'
        }`}
      >
        <input {...getInputProps()} />
        <div className="flex items-center justify-center w-12 h-12 mx-auto mb-3 text-indigo-600 border border-indigo-200 rounded-2xl bg-indigo-50 dark:bg-indigo-500/10 dark:border-indigo-500/20 dark:text-indigo-400">
          <UploadCloud className="w-6 h-6" />
        </div>
        <div className="text-sm font-semibold text-slate-800 dark:text-zinc-200">
          {masterResume ? 'Upload New Master Resume Document' : 'Drop your Master Resume here or click to browse'}
        </div>
        <div className="mt-1 text-xs text-slate-500 dark:text-zinc-500">
          Supports <strong>PDF (including Scanned/Designer), DOCX, Markdown (.md)</strong> • Powered by Multimodal AI
        </div>
      </div>

      {/* Schema Editor View */}
      {schema && (
        <div className="space-y-6">
          {activeTab === 'json' ? (
            <Card className="p-4">
              <Textarea
                value={jsonText}
                onChange={(e) => setJsonText(e.target.value)}
                className="font-mono text-xs h-[600px] bg-slate-50 text-slate-900 dark:bg-zinc-950 dark:text-zinc-200"
              />
            </Card>
          ) : (
            <div className="space-y-6">
              {/* Personal Info */}
              <Card className="space-y-4">
                <h3 className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white">
                  Personal Information
                </h3>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <div>
                    <label className="text-[11px] font-medium text-slate-600 dark:text-zinc-400">Full Name</label>
                    <Input
                      value={schema.personalInfo.fullName}
                      onChange={(e) => updatePersonalInfo('fullName', e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-medium text-slate-600 dark:text-zinc-400">Professional Title</label>
                    <Input
                      value={schema.personalInfo.title || ''}
                      onChange={(e) => updatePersonalInfo('title', e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-medium text-slate-600 dark:text-zinc-400">Email Address</label>
                    <Input
                      value={schema.personalInfo.email}
                      onChange={(e) => updatePersonalInfo('email', e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-medium text-slate-600 dark:text-zinc-400">Phone</label>
                    <Input
                      value={schema.personalInfo.phone}
                      onChange={(e) => updatePersonalInfo('phone', e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-medium text-slate-600 dark:text-zinc-400">Location</label>
                    <Input
                      value={schema.personalInfo.location}
                      onChange={(e) => updatePersonalInfo('location', e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-medium text-slate-600 dark:text-zinc-400">LinkedIn URL</label>
                    <Input
                      value={schema.personalInfo.linkedInUrl || ''}
                      onChange={(e) => updatePersonalInfo('linkedInUrl', e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-medium text-slate-600 dark:text-zinc-400">GitHub URL</label>
                    <Input
                      value={schema.personalInfo.gitHubUrl || ''}
                      onChange={(e) => updatePersonalInfo('gitHubUrl', e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-medium text-slate-600 dark:text-zinc-400">Portfolio URL</label>
                    <Input
                      value={schema.personalInfo.portfolioUrl || ''}
                      onChange={(e) => updatePersonalInfo('portfolioUrl', e.target.value)}
                    />
                  </div>
                </div>
              </Card>

              {/* Summary */}
              <Card className="space-y-2">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">Executive Professional Summary</h3>
                <Textarea
                  value={schema.summary}
                  onChange={(e) => setSchema({ ...schema, summary: e.target.value })}
                  rows={3}
                />
              </Card>

              {/* Work Experience */}
              <Card className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">Work Experience</h3>
                  <Button variant="outline" size="sm" onClick={addExperience} className="gap-1 text-xs">
                    <Plus className="w-3.5 h-3.5" /> Add Experience
                  </Button>
                </div>

                <div className="space-y-4">
                  {schema.experience.map((exp, idx) => (
                    <div key={exp.id || idx} className="p-4 space-y-3 border rounded-xl bg-slate-50/80 border-slate-200 dark:bg-zinc-950/70 dark:border-zinc-800">
                      <div className="flex items-center justify-between">
                        <div className="grid flex-1 grid-cols-1 gap-2 mr-4 sm:grid-cols-4">
                          <Input
                            placeholder="Role"
                            value={exp.role}
                            onChange={(e) => updateExperience(idx, 'role', e.target.value)}
                          />
                          <Input
                            placeholder="Company"
                            value={exp.company}
                            onChange={(e) => updateExperience(idx, 'company', e.target.value)}
                          />
                          <Input
                            placeholder="Start Date"
                            value={exp.startDate}
                            onChange={(e) => updateExperience(idx, 'startDate', e.target.value)}
                          />
                          <Input
                            placeholder="End Date"
                            value={exp.endDate}
                            onChange={(e) => updateExperience(idx, 'endDate', e.target.value)}
                          />
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deleteExperience(idx)}
                          className="text-rose-600 dark:text-rose-400 hover:text-rose-700 dark:hover:text-rose-300"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>

                      {/* Bullet Highlights */}
                      <div className="space-y-1.5 pl-2 border-l-2 border-indigo-500/30">
                        <div className="text-[11px] font-semibold text-slate-600 dark:text-zinc-400 flex items-center justify-between">
                          <span>Highlights / STAR Bullet Points</span>
                          <button
                            onClick={() => addBullet(idx)}
                            className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 text-[11px] font-medium"
                          >
                            + Add Bullet
                          </button>
                        </div>
                        {exp.highlights.map((bullet, bIdx) => (
                          <div key={bIdx} className="flex items-center gap-2">
                            <span className="text-xs text-slate-400 dark:text-zinc-500">•</span>
                            <Input
                              value={bullet}
                              onChange={(e) => updateBullet(idx, bIdx, e.target.value)}
                              className="h-8 text-xs"
                            />
                            <button
                              onClick={() => deleteBullet(idx, bIdx)}
                              className="p-1 text-slate-400 hover:text-rose-600 dark:text-zinc-500 dark:hover:text-rose-400"
                            >
                              ✕
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </Card>

              {/* Skills */}
              <Card className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">Technical Skills</h3>
                  <Button variant="outline" size="sm" onClick={addSkillCategory} className="gap-1 text-xs">
                    <Plus className="w-3.5 h-3.5" /> Add Category
                  </Button>
                </div>
                <div className="space-y-3">
                  {(schema.skills || []).map((cat, idx) => (
                    <div key={idx} className="p-3 space-y-1 border rounded-lg bg-slate-50 dark:bg-zinc-950/50 border-slate-200 dark:border-zinc-800">
                      <div className="flex items-center justify-between">
                        <Input
                          value={cat.categoryName}
                          onChange={(e) => {
                            const cats = [...(schema.skills || [])];
                            cats[idx] = { ...cats[idx], categoryName: e.target.value };
                            setSchema({ ...schema, skills: cats });
                          }}
                          className="text-xs font-semibold h-7 max-w-[200px]"
                          placeholder="Category Name"
                        />
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deleteSkillCategory(idx)}
                          className="text-rose-500 hover:text-rose-700 h-6 px-1.5 text-xs"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                      <Input
                        value={cat.skills.join(', ')}
                        onChange={(e) => {
                          const cats = [...(schema.skills || [])];
                          cats[idx] = { ...cats[idx], skills: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) };
                          setSchema({ ...schema, skills: cats });
                        }}
                        placeholder="Comma-separated skills (e.g. C#, TypeScript, PostgreSQL)"
                        className="text-xs"
                      />
                    </div>
                  ))}
                </div>
              </Card>

              {/* Projects */}
              <Card className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white">
                    <FolderGit2 className="w-4 h-4 text-indigo-500" />
                    Key Projects
                  </h3>
                  <Button variant="outline" size="sm" onClick={addProject} className="gap-1 text-xs">
                    <Plus className="w-3.5 h-3.5" /> Add Project
                  </Button>
                </div>

                <div className="space-y-4">
                  {(schema.projects || []).map((proj, idx) => (
                    <div key={proj.id || idx} className="p-4 space-y-3 border rounded-xl bg-slate-50/80 border-slate-200 dark:bg-zinc-950/70 dark:border-zinc-800">
                      <div className="flex items-center justify-between">
                        <div className="grid flex-1 grid-cols-1 gap-2 mr-4 sm:grid-cols-3">
                          <Input
                            placeholder="Project Title"
                            value={proj.title}
                            onChange={(e) => updateProject(idx, 'title', e.target.value)}
                          />
                          <Input
                            placeholder="Technologies Used"
                            value={proj.technologies || ''}
                            onChange={(e) => updateProject(idx, 'technologies', e.target.value)}
                          />
                          <Input
                            placeholder="Project URL (Optional)"
                            value={proj.url || ''}
                            onChange={(e) => updateProject(idx, 'url', e.target.value)}
                          />
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deleteProject(idx)}
                          className="text-rose-600 dark:text-rose-400 hover:text-rose-700 dark:hover:text-rose-300"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>

                      <Textarea
                        placeholder="Brief overview of project scope, problem solved, and architecture..."
                        value={proj.description}
                        onChange={(e) => updateProject(idx, 'description', e.target.value)}
                        rows={2}
                        className="text-xs"
                      />

                      {/* Project Bullet Highlights */}
                      <div className="space-y-1.5 pl-2 border-l-2 border-indigo-500/30">
                        <div className="text-[11px] font-semibold text-slate-600 dark:text-zinc-400 flex items-center justify-between">
                          <span>Key Metrics & Deliverables</span>
                          <button
                            onClick={() => addProjectBullet(idx)}
                            className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 text-[11px] font-medium"
                          >
                            + Add Bullet
                          </button>
                        </div>
                        {(proj.highlights || []).map((bullet, bIdx) => (
                          <div key={bIdx} className="flex items-center gap-2">
                            <span className="text-xs text-slate-400 dark:text-zinc-500">•</span>
                            <Input
                              value={bullet}
                              onChange={(e) => updateProjectBullet(idx, bIdx, e.target.value)}
                              className="h-8 text-xs"
                            />
                            <button
                              onClick={() => deleteProjectBullet(idx, bIdx)}
                              className="p-1 text-slate-400 hover:text-rose-600 dark:text-zinc-500 dark:hover:text-rose-400"
                            >
                              ✕
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                  {(schema.projects || []).length === 0 && (
                    <div className="py-4 text-xs text-center text-slate-400 dark:text-zinc-500">
                      No standalone projects listed yet. Click "+ Add Project" to record architectural showcases.
                    </div>
                  )}
                </div>
              </Card>

              {/* Education */}
              <Card className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white">
                    <GraduationCap className="w-4 h-4 text-indigo-500" />
                    Education
                  </h3>
                  <Button variant="outline" size="sm" onClick={addEducation} className="gap-1 text-xs">
                    <Plus className="w-3.5 h-3.5" /> Add Education
                  </Button>
                </div>

                <div className="space-y-3">
                  {(schema.education || []).map((edu, idx) => (
                    <div key={edu.id || idx} className="p-3.5 rounded-xl bg-slate-50/80 border border-slate-200 dark:bg-zinc-950/70 dark:border-zinc-800 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="grid flex-1 grid-cols-1 gap-2 mr-4 sm:grid-cols-3">
                          <Input
                            placeholder="Degree (e.g. MCA, B.Tech, M.S.)"
                            value={edu.degree}
                            onChange={(e) => updateEducation(idx, 'degree', e.target.value)}
                            className="font-semibold"
                          />
                          <Input
                            placeholder="Institution / University"
                            value={edu.institution}
                            onChange={(e) => updateEducation(idx, 'institution', e.target.value)}
                          />
                          <Input
                            placeholder="Field of Study / Major"
                            value={edu.fieldOfStudy}
                            onChange={(e) => updateEducation(idx, 'fieldOfStudy', e.target.value)}
                          />
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deleteEducation(idx)}
                          className="text-rose-600 dark:text-rose-400 hover:text-rose-700 dark:hover:text-rose-300"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                      <div className="grid max-w-lg grid-cols-1 gap-2 sm:grid-cols-3">
                        <div>
                          <label className="text-[10px] text-slate-500 dark:text-zinc-400">Graduation Year</label>
                          <Input
                            placeholder="Year (e.g. 2024)"
                            value={edu.graduationYear}
                            onChange={(e) => updateEducation(idx, 'graduationYear', e.target.value)}
                            className="text-xs h-7"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-slate-500 dark:text-zinc-400">GPA / Percentage</label>
                          <Input
                            placeholder="e.g. 3.8 / 82%"
                            value={edu.gpa || ''}
                            onChange={(e) => updateEducation(idx, 'gpa', e.target.value)}
                            className="text-xs h-7"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-slate-500 dark:text-zinc-400">Honors / Distinctions</label>
                          <Input
                            placeholder="e.g. First Division"
                            value={edu.honors || ''}
                            onChange={(e) => updateEducation(idx, 'honors', e.target.value)}
                            className="text-xs h-7"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                  {(schema.education || []).length === 0 && (
                    <div className="py-4 text-xs text-center text-slate-400 dark:text-zinc-500">
                      No education records added yet. Click "+ Add Education" to add university degrees.
                    </div>
                  )}
                </div>
              </Card>

              {/* Certifications */}
              <Card className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white">
                    <Award className="w-4 h-4 text-indigo-500" />
                    Certifications & Licenses
                  </h3>
                  <Button variant="outline" size="sm" onClick={addCertification} className="gap-1 text-xs">
                    <Plus className="w-3.5 h-3.5" /> Add Certification
                  </Button>
                </div>

                <div className="space-y-3">
                  {(schema.certifications || []).map((cert, idx) => (
                    <div key={cert.id || idx} className="p-3.5 rounded-xl bg-slate-50/80 border border-slate-200 dark:bg-zinc-950/70 dark:border-zinc-800 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="grid flex-1 grid-cols-1 gap-2 mr-4 sm:grid-cols-4">
                          <Input
                            placeholder="Certification Name"
                            value={cert.name}
                            onChange={(e) => updateCertification(idx, 'name', e.target.value)}
                            className="font-semibold"
                          />
                          <Input
                            placeholder="Issuer (e.g. Microsoft, AWS)"
                            value={cert.issuer}
                            onChange={(e) => updateCertification(idx, 'issuer', e.target.value)}
                          />
                          <Input
                            placeholder="Issue Date (e.g. Jun 2024)"
                            value={cert.issueDate}
                            onChange={(e) => updateCertification(idx, 'issueDate', e.target.value)}
                          />
                          <Input
                            placeholder="Credential ID / URL"
                            value={cert.credentialId || cert.url || ''}
                            onChange={(e) => updateCertification(idx, 'credentialId', e.target.value)}
                          />
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deleteCertification(idx)}
                          className="text-rose-600 dark:text-rose-400 hover:text-rose-700 dark:hover:text-rose-300"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                  {(schema.certifications || []).length === 0 && (
                    <div className="py-4 text-xs text-center text-slate-400 dark:text-zinc-500">
                      No certifications listed.
                    </div>
                  )}
                </div>
              </Card>

              {/* Achievements */}
              <Card className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white">
                    <Trophy className="w-4 h-4 text-indigo-500" />
                    Achievements & Honors
                  </h3>
                  <Button variant="outline" size="sm" onClick={addAchievement} className="gap-1 text-xs">
                    <Plus className="w-3.5 h-3.5" /> Add Achievement
                  </Button>
                </div>

                <div className="space-y-3">
                  {(schema.achievements || []).map((ach, idx) => (
                    <div key={ach.id || idx} className="p-3.5 rounded-xl bg-slate-50/80 border border-slate-200 dark:bg-zinc-950/70 dark:border-zinc-800 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="grid flex-1 grid-cols-1 gap-2 mr-4 sm:grid-cols-3">
                          <Input
                            placeholder="Achievement Title"
                            value={ach.title}
                            onChange={(e) => updateAchievement(idx, 'title', e.target.value)}
                            className="font-semibold"
                          />
                          <Input
                            placeholder="Description / Impact"
                            value={ach.description}
                            onChange={(e) => updateAchievement(idx, 'description', e.target.value)}
                            className="sm:col-span-2"
                          />
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deleteAchievement(idx)}
                          className="text-rose-600 dark:text-rose-400 hover:text-rose-700 dark:hover:text-rose-300"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                  {(schema.achievements || []).length === 0 && (
                    <div className="py-4 text-xs text-center text-slate-400 dark:text-zinc-500">
                      No standalone achievements recorded.
                    </div>
                  )}
                </div>
              </Card>
            </div>
          )}
        </div>
      )}

      {/* Version History Modal */}
      <Modal
        isOpen={isVersionModalOpen}
        onClose={() => setIsVersionModalOpen(false)}
        title="Master Resume Version History"
        description="Roll back to any previous version of your master resume."
      >
        <div className="space-y-3">
          {versions.length === 0 ? (
            <div className="py-6 text-xs text-center text-slate-500 dark:text-zinc-400">
              No previous saved versions yet. Click <strong>"Save Master"</strong> to record your first version snapshot.
            </div>
          ) : (
            versions.map((ver) => (
              <div
                key={ver.id}
                className="p-3.5 rounded-xl bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 flex items-center justify-between"
              >
                <div>
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-900 dark:text-white">
                    Version #{ver.versionNumber}
                    <span className="text-[10px] text-slate-500 dark:text-zinc-500 font-normal">
                      {new Date(ver.createdAtUtc).toLocaleString()}
                    </span>
                  </div>
                  <div className="text-xs text-slate-600 dark:text-zinc-400 mt-0.5">{ver.changeDescription}</div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={async () => {
                    await revertVersion(ver.id);
                    setIsVersionModalOpen(false);
                  }}
                  className="gap-1 text-xs"
                >
                  <RotateCcw className="w-3.5 h-3.5" /> Revert
                </Button>
              </div>
            ))
          )}
        </div>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        title="Delete Master Resume & Version History"
        description="Permanently delete your active master resume and all historical versions."
      >
        <div className="space-y-4">
          <div className="p-4 space-y-2 text-xs border rounded-xl bg-rose-50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-900/40 text-rose-800 dark:text-rose-300">
            <div className="font-bold flex items-center gap-1.5 text-rose-700 dark:text-rose-200">
              <Trash2 className="w-4 h-4 text-rose-600 dark:text-rose-400" />
              This action is permanent and irreversible.
            </div>
            <p className="leading-relaxed">
              Deleting your master resume will permanently erase:
            </p>
            <ul className="pl-5 space-y-1 list-disc">
              <li>The current active master resume schema (<strong>{masterResume?.title}</strong>).</li>
              <li>All <strong>{versions.length}</strong> historical version snapshots.</li>
              <li>Derived tailoring associations and cached document analyses.</li>
            </ul>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <Button
              variant="outline"
              size="sm"
              disabled={isDeleting}
              onClick={() => setIsDeleteModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              size="sm"
              disabled={isDeleting}
              onClick={handleDeleteMasterResume}
              className="gap-1.5 bg-rose-600 hover:bg-rose-700 text-white"
            >
              {isDeleting ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Deleting...</span>
                </>
              ) : (
                <>
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Confirm & Purge All</span>
                </>
              )}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
