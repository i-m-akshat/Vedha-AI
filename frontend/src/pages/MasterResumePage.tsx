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
  RotateCcw 
} from 'lucide-react';
import { Button, Card, Badge, Input, Textarea, Modal } from '../components/ui';
import { useResumeStore } from '../stores/useTailorStore';
import { ResumeSchema, WorkExperienceItem, ProjectItem, SkillCategory, EducationItem, CertificationItem } from '../types/resume';

export const MasterResumePage: React.FC = () => {
  const { 
    masterResume, 
    versions, 
    isLoading, 
    fetchMasterResume, 
    uploadMasterResume, 
    updateMasterResume, 
    fetchVersions, 
    revertVersion 
  } = useResumeStore();

  const [schema, setSchema] = useState<ResumeSchema | null>(null);
  const [activeTab, setActiveTab] = useState<'form' | 'json'>('form');
  const [jsonText, setJsonText] = useState('');
  const [isVersionModalOpen, setIsVersionModalOpen] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    fetchMasterResume();
    fetchVersions();
  }, []);

  useEffect(() => {
    if (masterResume) {
      setSchema(masterResume.schema);
      setJsonText(JSON.stringify(masterResume.schema, null, 2));
    }
  }, [masterResume]);

  const onDrop = async (acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      await uploadMasterResume(acceptedFiles[0]);
      fetchVersions();
    }
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'text/markdown': ['.md', '.markdown'],
    },
    maxFiles: 1,
  });

  const handleSave = async () => {
    if (!schema || !masterResume) return;
    let finalSchema = schema;
    if (activeTab === 'json') {
      try {
        finalSchema = JSON.parse(jsonText);
        setSchema(finalSchema);
      } catch (e) {
        alert('Invalid JSON syntax.');
        return;
      }
    }
    await updateMasterResume(masterResume.title, finalSchema, 'Saved changes via Master Resume Studio');
    fetchVersions();
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
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

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
            <FileText className="w-5 h-5 text-indigo-400" />
            Master Resume Center
          </h2>
          <p className="text-xs text-zinc-400 mt-0.5">
            Your single source of truth. Upload once in PDF, DOCX, or Markdown and manage structured data.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {masterResume && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsVersionModalOpen(true)}
                className="gap-1.5"
              >
                <History className="w-3.5 h-3.5" />
                <span>Versions ({versions.length})</span>
              </Button>
              <div className="border-l border-zinc-800 h-6 mx-1" />
              <div className="flex bg-zinc-900 border border-zinc-800 rounded-lg p-0.5">
                <button
                  onClick={() => setActiveTab('form')}
                  className={`px-3 py-1 text-xs rounded-md font-medium transition ${
                    activeTab === 'form' ? 'bg-indigo-600 text-white' : 'text-zinc-400 hover:text-zinc-200'
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
                    activeTab === 'json' ? 'bg-indigo-600 text-white' : 'text-zinc-400 hover:text-zinc-200'
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

      {/* Upload Dropzone */}
      <div
        {...getRootProps()}
        className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all ${
          isDragActive
            ? 'border-indigo-500 bg-indigo-500/10'
            : 'border-zinc-800 hover:border-zinc-700 bg-zinc-900/30'
        }`}
      >
        <input {...getInputProps()} />
        <div className="h-12 w-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center mx-auto mb-3">
          <UploadCloud className="w-6 h-6" />
        </div>
        <div className="font-semibold text-sm text-zinc-200">
          {masterResume ? 'Upload New Master Resume Version' : 'Drop your Master Resume here or click to browse'}
        </div>
        <div className="text-xs text-zinc-500 mt-1">
          Supports <strong>PDF, DOCX, Markdown (.md)</strong> • Converts automatically into structured JSON schema
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
                className="font-mono text-xs h-[600px] bg-zinc-950 text-zinc-200"
              />
            </Card>
          ) : (
            <div className="space-y-6">
              {/* Personal Info */}
              <Card className="space-y-4">
                <h3 className="font-bold text-sm text-white flex items-center gap-2">
                  Personal Information
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  <div>
                    <label className="text-[11px] font-medium text-zinc-400">Full Name</label>
                    <Input
                      value={schema.personalInfo.fullName}
                      onChange={(e) => updatePersonalInfo('fullName', e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-medium text-zinc-400">Professional Title</label>
                    <Input
                      value={schema.personalInfo.title || ''}
                      onChange={(e) => updatePersonalInfo('title', e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-medium text-zinc-400">Email Address</label>
                    <Input
                      value={schema.personalInfo.email}
                      onChange={(e) => updatePersonalInfo('email', e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-medium text-zinc-400">Phone</label>
                    <Input
                      value={schema.personalInfo.phone}
                      onChange={(e) => updatePersonalInfo('phone', e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-medium text-zinc-400">Location</label>
                    <Input
                      value={schema.personalInfo.location}
                      onChange={(e) => updatePersonalInfo('location', e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-medium text-zinc-400">LinkedIn URL</label>
                    <Input
                      value={schema.personalInfo.linkedInUrl || ''}
                      onChange={(e) => updatePersonalInfo('linkedInUrl', e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-medium text-zinc-400">GitHub URL</label>
                    <Input
                      value={schema.personalInfo.gitHubUrl || ''}
                      onChange={(e) => updatePersonalInfo('gitHubUrl', e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-medium text-zinc-400">Portfolio URL</label>
                    <Input
                      value={schema.personalInfo.portfolioUrl || ''}
                      onChange={(e) => updatePersonalInfo('portfolioUrl', e.target.value)}
                    />
                  </div>
                </div>
              </Card>

              {/* Summary */}
              <Card className="space-y-2">
                <h3 className="font-bold text-sm text-white">Executive Professional Summary</h3>
                <Textarea
                  value={schema.summary}
                  onChange={(e) => setSchema({ ...schema, summary: e.target.value })}
                  rows={3}
                />
              </Card>

              {/* Work Experience */}
              <Card className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-sm text-white">Work Experience</h3>
                  <Button variant="outline" size="sm" onClick={addExperience} className="gap-1 text-xs">
                    <Plus className="w-3.5 h-3.5" /> Add Experience
                  </Button>
                </div>

                <div className="space-y-4">
                  {schema.experience.map((exp, idx) => (
                    <div key={exp.id || idx} className="p-4 rounded-xl bg-zinc-950/70 border border-zinc-800 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 flex-1 mr-4">
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
                          className="text-rose-400 hover:text-rose-300"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>

                      {/* Bullet Highlights */}
                      <div className="space-y-1.5 pl-2 border-l-2 border-indigo-500/30">
                        <div className="text-[11px] font-semibold text-zinc-400 flex items-center justify-between">
                          <span>Highlights / STAR Bullet Points</span>
                          <button
                            onClick={() => addBullet(idx)}
                            className="text-indigo-400 hover:text-indigo-300 text-[11px] font-medium"
                          >
                            + Add Bullet
                          </button>
                        </div>
                        {exp.highlights.map((bullet, bIdx) => (
                          <div key={bIdx} className="flex items-center gap-2">
                            <span className="text-zinc-500 text-xs">•</span>
                            <Input
                              value={bullet}
                              onChange={(e) => updateBullet(idx, bIdx, e.target.value)}
                              className="text-xs h-8"
                            />
                            <button
                              onClick={() => deleteBullet(idx, bIdx)}
                              className="text-zinc-500 hover:text-rose-400 p-1"
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
                <h3 className="font-bold text-sm text-white">Technical Skills</h3>
                <div className="space-y-3">
                  {schema.skills.map((cat, idx) => (
                    <div key={idx} className="space-y-1">
                      <label className="text-[11px] font-medium text-zinc-400">{cat.categoryName}</label>
                      <Input
                        value={cat.skills.join(', ')}
                        onChange={(e) => {
                          const cats = [...schema.skills];
                          cats[idx].skills = e.target.value.split(',').map((s) => s.trim()).filter(Boolean);
                          setSchema({ ...schema, skills: cats });
                        }}
                        placeholder="Comma-separated skills (e.g. C#, TypeScript, PostgreSQL)"
                      />
                    </div>
                  ))}
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
          {versions.map((ver) => (
            <div
              key={ver.id}
              className="p-3 rounded-xl bg-zinc-950 border border-zinc-800 flex items-center justify-between"
            >
              <div>
                <div className="text-xs font-bold text-white flex items-center gap-2">
                  Version #{ver.versionNumber}
                  <span className="text-[10px] text-zinc-500 font-normal">
                    {new Date(ver.createdAtUtc).toLocaleString()}
                  </span>
                </div>
                <div className="text-xs text-zinc-400 mt-0.5">{ver.changeDescription}</div>
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
          ))}
        </div>
      </Modal>
    </div>
  );
};
