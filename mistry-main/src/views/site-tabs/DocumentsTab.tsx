import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/db';
import {
  FileText,
  Upload,
  Download,
  Trash2,
  Share2,
  Eye,
  CheckCircle2,
  Calendar,
  PlusCircle,
  Search,
  BookOpen,
  MessageSquare,
  AlertTriangle,
  Sun,
  Shield,
  Clock,
  Printer,
} from 'lucide-react';
import type {
  Site,
  ProjectDocument,
  DocumentCategory,
  SiteDiaryRecord,
  SiteComment,
} from '../../db/types';
import { generateDailySiteReportPdfBlob, downloadFile } from '../../utils/pdfGenerator';

interface DocumentsTabProps {
  site: Site;
  comments: SiteComment[];
  onOpenCommentModal: (comment?: SiteComment) => void;
  onDeleteComment: (comment: SiteComment) => void;
  onNotify?: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export const DocumentsTab: React.FC<DocumentsTabProps> = ({
  site,
  comments,
  onOpenCommentModal,
  onDeleteComment,
  onNotify,
}) => {
  const [activeSection, setActiveSection] = useState<'documents' | 'diary' | 'notes'>('documents');
  const [docCategoryFilter, setDocCategoryFilter] = useState<string>('All');
  const [search, setSearch] = useState('');

  // Document Upload Modal state
  const [showDocModal, setShowDocModal] = useState(false);
  const [docTitle, setDocTitle] = useState('');
  const [docCategory, setDocCategory] = useState<DocumentCategory>('Architectural Drawing');
  const [docDescription, setDocDescription] = useState('');
  const [docSharedWithClient, setDocSharedWithClient] = useState(true);
  const [docFile, setDocFile] = useState<File | null>(null);

  // Site Diary Modal state
  const [showDiaryModal, setShowDiaryModal] = useState(false);
  const [editingDiary, setEditingDiary] = useState<SiteDiaryRecord | null>(null);
  const [diaryDate, setDiaryDate] = useState(new Date().toISOString().split('T')[0]);
  const [diaryWorkDone, setDiaryWorkDone] = useState('');
  const [diaryWorkersCount, setDiaryWorkersCount] = useState(1);
  const [diaryMaterials, setDiaryMaterials] = useState('');
  const [diaryEquipment, setDiaryEquipment] = useState('');
  const [diaryIssues, setDiaryIssues] = useState('');
  const [diaryRemarks, setDiaryRemarks] = useState('');
  const [diaryNotes, setDiaryNotes] = useState('');
  const [diaryProgress, setDiaryProgress] = useState(0);
  const [diaryWeather, setDiaryWeather] = useState('Clear / Sunny');

  // Live Queries
  const documents = useLiveQuery(
    () => db.documents.filter(d => d.siteId === site.id && !d.isDeleted).toArray(),
    [site.id]
  ) || [];

  const siteDiaries = useLiveQuery(
    () => db.siteDiaries.filter(d => d.siteId === site.id && !d.isDeleted).toArray(),
    [site.id]
  ) || [];

  // Handle Document Upload
  const handleSaveDocument = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!docTitle.trim()) {
      onNotify?.('Document title is required', 'error');
      return;
    }

    const now = new Date().toISOString();
    let fileData: string | undefined = undefined;
    let fileName = 'Document.pdf';
    let fileType = 'application/pdf';
    let fileSize = 0;

    if (docFile) {
      fileName = docFile.name;
      fileType = docFile.type || 'application/octet-stream';
      fileSize = docFile.size;
      // Read as base64 for local storage
      fileData = await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.readAsDataURL(docFile);
      });
    }

    const newDoc: ProjectDocument = {
      id: `doc-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      userId: site.userId,
      siteId: site.id,
      title: docTitle.trim(),
      category: docCategory,
      fileName,
      fileType,
      fileSize,
      fileData,
      version: 1,
      description: docDescription.trim() || undefined,
      isSharedWithClient: docSharedWithClient,
      isDeleted: false,
      createdAt: now,
      updatedAt: now,
    };

    await db.documents.put(newDoc);
    setShowDocModal(false);
    setDocTitle('');
    setDocDescription('');
    setDocFile(null);
    onNotify?.('Document uploaded successfully', 'success');
  };

  // Delete Document
  const handleDeleteDocument = async (docId: string) => {
    if (window.confirm('Move this document to trash?')) {
      const now = new Date().toISOString();
      await db.documents.update(docId, { isDeleted: true, deletedAt: now, updatedAt: now });
      onNotify?.('Document moved to trash', 'info');
    }
  };

  // Toggle client sharing
  const handleToggleShare = async (doc: ProjectDocument) => {
    const updatedStatus = !doc.isSharedWithClient;
    await db.documents.update(doc.id, { isSharedWithClient: updatedStatus, updatedAt: new Date().toISOString() });
    onNotify?.(updatedStatus ? 'Document shared with client portal' : 'Document unshared from client portal', 'info');
  };

  // Open Diary Modal
  const openDiaryModal = (diary?: SiteDiaryRecord) => {
    if (diary) {
      setEditingDiary(diary);
      setDiaryDate(diary.date);
      setDiaryWorkDone(diary.workCompleted);
      setDiaryWorkersCount(diary.workersPresentCount || 1);
      setDiaryMaterials(diary.materialsUsed || '');
      setDiaryEquipment(diary.equipmentUsed || '');
      setDiaryIssues(diary.siteIssuesAndDelays || '');
      setDiaryRemarks(diary.engineerRemarks || '');
      setDiaryNotes(diary.supervisorNotes || '');
      setDiaryProgress(diary.dailyProgressPercent || 0);
      setDiaryWeather(diary.weather || 'Clear / Sunny');
    } else {
      setEditingDiary(null);
      setDiaryDate(new Date().toISOString().split('T')[0]);
      setDiaryWorkDone('');
      setDiaryWorkersCount(1);
      setDiaryMaterials('');
      setDiaryEquipment('');
      setDiaryIssues('');
      setDiaryRemarks('');
      setDiaryNotes('');
      setDiaryProgress(0);
      setDiaryWeather('Clear / Sunny');
    }
    setShowDiaryModal(true);
  };

  // Save Site Diary
  const handleSaveDiary = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!diaryDate || !diaryWorkDone.trim()) {
      onNotify?.('Date and work description are required', 'error');
      return;
    }

    const now = new Date().toISOString();
    const diaryData: SiteDiaryRecord = {
      id: editingDiary ? editingDiary.id : `diary-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      userId: site.userId,
      siteId: site.id,
      date: diaryDate,
      workCompleted: diaryWorkDone.trim(),
      workersPresentCount: Number(diaryWorkersCount) || 1,
      materialsUsed: diaryMaterials.trim() || undefined,
      equipmentUsed: diaryEquipment.trim() || undefined,
      siteIssuesAndDelays: diaryIssues.trim() || undefined,
      engineerRemarks: diaryRemarks.trim() || undefined,
      supervisorNotes: diaryNotes.trim() || undefined,
      dailyProgressPercent: Number(diaryProgress) || 0,
      weather: diaryWeather,
      isDeleted: false,
      createdAt: editingDiary ? editingDiary.createdAt : now,
      updatedAt: now,
    };

    await db.siteDiaries.put(diaryData);
    setShowDiaryModal(false);
    onNotify?.(editingDiary ? 'Site diary updated' : 'Daily site diary entry saved', 'success');
  };

  // Export Daily Site Diary PDF
  const handleDownloadDiaryPdf = (diary: SiteDiaryRecord) => {
    const pdfBlob = generateDailySiteReportPdfBlob({
      projectName: site.name,
      clientName: site.ownerName,
      location: site.area || site.address,
      date: diary.date,
      workCompleted: diary.workCompleted,
      workersPresentCount: diary.workersPresentCount,
      materialsUsed: diary.materialsUsed,
      equipmentUsed: diary.equipmentUsed,
      siteIssuesAndDelays: diary.siteIssuesAndDelays,
      engineerRemarks: diary.engineerRemarks,
      supervisorNotes: diary.supervisorNotes,
      dailyProgressPercent: diary.dailyProgressPercent,
      weather: diary.weather,
    });

    const filename = `Site_Diary_${site.name.replace(/\s+/g, '_')}_${diary.date}.pdf`;
    downloadFile(pdfBlob, filename);
    onNotify?.('Daily Site Report PDF downloaded', 'success');
  };

  // Filter documents
  const filteredDocuments = documents.filter(d => {
    const matchesCat = docCategoryFilter === 'All' || d.category === docCategoryFilter;
    const matchesSearch =
      d.title.toLowerCase().includes(search.toLowerCase()) ||
      d.fileName.toLowerCase().includes(search.toLowerCase());
    return matchesCat && matchesSearch;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Sub-tab navigation */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', gap: '8px', background: '#F1F5F9', padding: '4px', borderRadius: '8px' }}>
          <button
            type="button"
            className={`btn-subtab ${activeSection === 'documents' ? 'active' : ''}`}
            onClick={() => setActiveSection('documents')}
            style={{
              padding: '6px 16px',
              borderRadius: '6px',
              fontSize: '0.82rem',
              fontWeight: 600,
              border: 'none',
              background: activeSection === 'documents' ? '#FFFFFF' : 'transparent',
              color: activeSection === 'documents' ? '#0F172A' : '#64748B',
              boxShadow: activeSection === 'documents' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
              cursor: 'pointer',
            }}
          >
            Project Documents ({documents.length})
          </button>
          <button
            type="button"
            className={`btn-subtab ${activeSection === 'diary' ? 'active' : ''}`}
            onClick={() => setActiveSection('diary')}
            style={{
              padding: '6px 16px',
              borderRadius: '6px',
              fontSize: '0.82rem',
              fontWeight: 600,
              border: 'none',
              background: activeSection === 'diary' ? '#FFFFFF' : 'transparent',
              color: activeSection === 'diary' ? '#0F172A' : '#64748B',
              boxShadow: activeSection === 'diary' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
              cursor: 'pointer',
            }}
          >
            Daily Site Diary ({siteDiaries.length})
          </button>
          <button
            type="button"
            className={`btn-subtab ${activeSection === 'notes' ? 'active' : ''}`}
            onClick={() => setActiveSection('notes')}
            style={{
              padding: '6px 16px',
              borderRadius: '6px',
              fontSize: '0.82rem',
              fontWeight: 600,
              border: 'none',
              background: activeSection === 'notes' ? '#FFFFFF' : 'transparent',
              color: activeSection === 'notes' ? '#0F172A' : '#64748B',
              boxShadow: activeSection === 'notes' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
              cursor: 'pointer',
            }}
          >
            Site Notes ({comments.length})
          </button>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          {activeSection === 'documents' && (
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => setShowDocModal(true)}
              style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', fontSize: '0.85rem' }}
            >
              <Upload size={16} />
              <span>Upload Document</span>
            </button>
          )}

          {activeSection === 'diary' && (
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => openDiaryModal()}
              style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', fontSize: '0.85rem' }}
            >
              <PlusCircle size={16} />
              <span>New Daily Report</span>
            </button>
          )}

          {activeSection === 'notes' && (
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => onOpenCommentModal()}
              style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', fontSize: '0.85rem' }}
            >
              <PlusCircle size={16} />
              <span>Add Site Note</span>
            </button>
          )}
        </div>
      </div>

      {/* SECTION 1: PROJECT DOCUMENTS */}
      {activeSection === 'documents' && (
        <div style={{ background: '#FFFFFF', borderRadius: '14px', border: '1px solid #E2E8F0', padding: '20px' }}>
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '18px' }}>
            <div className="search-input-wrapper" style={{ flex: 1, minWidth: '240px' }}>
              <Search size={16} className="search-icon" />
              <input
                type="text"
                placeholder="Search architectural drawings, structural plans, bills..."
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>

            <select
              value={docCategoryFilter}
              onChange={e => setDocCategoryFilter(e.target.value)}
              style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '0.85rem' }}
            >
              <option value="All">All Categories</option>
              <option value="Architectural Drawing">Architectural Drawings</option>
              <option value="Structural Drawing">Structural Drawings</option>
              <option value="Agreement">Agreements</option>
              <option value="Approval">Approvals & Permits</option>
              <option value="Quotation">Quotations</option>
              <option value="Bill / Invoice">Bills / Invoices</option>
              <option value="Site Photograph">Site Photographs</option>
              <option value="Report">Reports</option>
              <option value="Other">Other</option>
            </select>
          </div>

          {filteredDocuments.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 20px', color: '#64748B' }}>
              <FileText size={36} style={{ color: '#94A3B8', margin: '0 auto 10px' }} />
              <h4 style={{ margin: '0 0 4px', color: '#1E293B', fontSize: '1rem' }}>No documents uploaded yet</h4>
              <p style={{ margin: 0, fontSize: '0.85rem' }}>
                Upload CAD prints, approval certificates, client agreements, bills, and progress photographs.
              </p>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '14px' }}>
              {filteredDocuments.map(doc => (
                <div
                  key={doc.id}
                  style={{
                    border: '1px solid #E2E8F0',
                    borderRadius: '10px',
                    padding: '16px',
                    background: '#FFFFFF',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                      <span
                        style={{
                          fontSize: '0.68rem',
                          fontWeight: 700,
                          padding: '3px 8px',
                          borderRadius: '4px',
                          background: '#EFF6FF',
                          color: '#1D4ED8',
                          textTransform: 'uppercase',
                        }}
                      >
                        {doc.category}
                      </span>

                      <button
                        type="button"
                        onClick={() => handleToggleShare(doc)}
                        style={{
                          border: 'none',
                          background: doc.isSharedWithClient ? '#DCFCE7' : '#F1F5F9',
                          color: doc.isSharedWithClient ? '#15803D' : '#64748B',
                          padding: '2px 8px',
                          borderRadius: '4px',
                          fontSize: '0.7rem',
                          fontWeight: 600,
                          cursor: 'pointer',
                        }}
                        title={doc.isSharedWithClient ? 'Click to unshare from client' : 'Click to share with client portal'}
                      >
                        {doc.isSharedWithClient ? 'Shared with Client' : 'Internal Only'}
                      </button>
                    </div>

                    <strong style={{ fontSize: '0.92rem', color: '#0F172A', display: 'block', marginBottom: '4px' }}>
                      {doc.title}
                    </strong>

                    {doc.description && (
                      <p style={{ fontSize: '0.78rem', color: '#64748B', margin: '0 0 8px' }}>
                        {doc.description}
                      </p>
                    )}

                    <div style={{ fontSize: '0.72rem', color: '#94A3B8' }}>
                      File: {doc.fileName} • Rev {doc.version}
                    </div>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '14px', paddingTop: '10px', borderTop: '1px solid #F1F5F9' }}>
                    <span style={{ fontSize: '0.7rem', color: '#94A3B8' }}>
                      {new Date(doc.createdAt).toLocaleDateString()}
                    </span>

                    <div style={{ display: 'flex', gap: '6px' }}>
                      {doc.fileData && (
                        <a
                          href={doc.fileData}
                          download={doc.fileName}
                          style={{
                            padding: '4px 8px',
                            borderRadius: '6px',
                            background: '#EFF6FF',
                            color: '#2563EB',
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            textDecoration: 'none',
                          }}
                        >
                          <Download size={13} />
                          <span>Download</span>
                        </a>
                      )}
                      <button
                        type="button"
                        onClick={() => handleDeleteDocument(doc.id)}
                        style={{
                          padding: '4px 8px',
                          borderRadius: '6px',
                          border: 'none',
                          background: '#FEF2F2',
                          color: '#DC2626',
                          cursor: 'pointer',
                        }}
                        title="Delete document"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* SECTION 2: DAILY SITE DIARY */}
      {activeSection === 'diary' && (
        <div style={{ background: '#FFFFFF', borderRadius: '14px', border: '1px solid #E2E8F0', padding: '20px' }}>
          {siteDiaries.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 20px', color: '#64748B' }}>
              <BookOpen size={36} style={{ color: '#94A3B8', margin: '0 auto 10px' }} />
              <h4 style={{ margin: '0 0 4px', color: '#1E293B', fontSize: '1rem' }}>No site diary reports logged</h4>
              <p style={{ margin: 0, fontSize: '0.85rem' }}>
                Keep a practical daily record of work completed, manpower present, materials used, equipment, and delays.
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {siteDiaries
                .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                .map(diary => (
                  <div
                    key={diary.id}
                    style={{
                      border: '1px solid #E2E8F0',
                      borderRadius: '12px',
                      padding: '18px',
                      background: '#FFFFFF',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', marginBottom: '12px', borderBottom: '1px solid #F1F5F9', paddingBottom: '10px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <Calendar size={18} color="#2563EB" />
                        <strong style={{ fontSize: '1rem', color: '#0F172A' }}>
                          Daily Site Diary: {diary.date}
                        </strong>
                        <span style={{ fontSize: '0.75rem', padding: '2px 8px', borderRadius: '4px', background: '#F1F5F9', color: '#475569' }}>
                          {diary.weather || 'Clear Weather'}
                        </span>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <button
                          type="button"
                          className="btn btn-outline"
                          onClick={() => handleDownloadDiaryPdf(diary)}
                          style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '5px 12px', fontSize: '0.78rem' }}
                        >
                          <Printer size={14} />
                          <span>Download PDF Report</span>
                        </button>
                        <button
                          type="button"
                          className="btn btn-outline"
                          onClick={() => openDiaryModal(diary)}
                          style={{ padding: '5px 10px', fontSize: '0.78rem' }}
                        >
                          Edit
                        </button>
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', marginBottom: '14px', background: '#F8FAFC', padding: '12px', borderRadius: '8px' }}>
                      <div>
                        <span style={{ fontSize: '0.7rem', color: '#64748B', display: 'block', textTransform: 'uppercase', fontWeight: 600 }}>Workers Present</span>
                        <strong style={{ fontSize: '0.92rem', color: '#0F172A' }}>{diary.workersPresentCount} Person(s)</strong>
                      </div>
                      <div>
                        <span style={{ fontSize: '0.7rem', color: '#64748B', display: 'block', textTransform: 'uppercase', fontWeight: 600 }}>Daily Progress</span>
                        <strong style={{ fontSize: '0.92rem', color: '#16A34A' }}>{diary.dailyProgressPercent || 0}%</strong>
                      </div>
                      <div>
                        <span style={{ fontSize: '0.7rem', color: '#64748B', display: 'block', textTransform: 'uppercase', fontWeight: 600 }}>Equipment</span>
                        <strong style={{ fontSize: '0.85rem', color: '#334155' }}>{diary.equipmentUsed || 'None'}</strong>
                      </div>
                    </div>

                    <div style={{ marginBottom: '10px' }}>
                      <strong style={{ fontSize: '0.8rem', color: '#475569', display: 'block', marginBottom: '4px' }}>Work Completed Today:</strong>
                      <p style={{ margin: 0, fontSize: '0.88rem', color: '#1E293B', lineHeight: 1.5 }}>
                        {diary.workCompleted}
                      </p>
                    </div>

                    {diary.materialsUsed && (
                      <div style={{ marginBottom: '10px', fontSize: '0.82rem', color: '#475569' }}>
                        <strong>Materials Consumed: </strong>
                        <span>{diary.materialsUsed}</span>
                      </div>
                    )}

                    {diary.siteIssuesAndDelays && (
                      <div style={{ marginBottom: '10px', padding: '8px 12px', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '6px', fontSize: '0.82rem', color: '#991B1B' }}>
                        <strong>Site Issues / Delays: </strong>
                        <span>{diary.siteIssuesAndDelays}</span>
                      </div>
                    )}

                    {(diary.engineerRemarks || diary.supervisorNotes) && (
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '10px', fontSize: '0.8rem', color: '#475569' }}>
                        {diary.engineerRemarks && (
                          <div>
                            <strong>Engineer Remarks: </strong>
                            <span>{diary.engineerRemarks}</span>
                          </div>
                        )}
                        {diary.supervisorNotes && (
                          <div>
                            <strong>Supervisor Notes: </strong>
                            <span>{diary.supervisorNotes}</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
            </div>
          )}
        </div>
      )}

      {/* SECTION 3: SITE NOTES */}
      {activeSection === 'notes' && (
        <div style={{ background: '#FFFFFF', borderRadius: '14px', border: '1px solid #E2E8F0', padding: '20px' }}>
          {comments.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 20px', color: '#64748B' }}>
              <MessageSquare size={36} style={{ color: '#94A3B8', margin: '0 auto 10px' }} />
              <h4 style={{ margin: '0 0 4px', color: '#1E293B', fontSize: '1rem' }}>No site notes recorded</h4>
              <p style={{ margin: 0, fontSize: '0.85rem' }}>
                Add safety notes, inspection observations, client instructions, or site comments.
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {comments.map(c => (
                <div
                  key={c.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '14px 18px',
                    borderRadius: '8px',
                    border: '1px solid #E2E8F0',
                    background: '#FFFFFF',
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                      <span
                        style={{
                          fontSize: '0.68rem',
                          fontWeight: 700,
                          padding: '2px 8px',
                          borderRadius: '4px',
                          background: '#F1F5F9',
                          color: '#475569',
                          textTransform: 'uppercase',
                        }}
                      >
                        {c.category}
                      </span>
                      <span style={{ fontSize: '0.72rem', color: '#94A3B8' }}>
                        {new Date(c.dateTime).toLocaleString()}
                      </span>
                    </div>
                    <p style={{ margin: 0, fontSize: '0.88rem', color: '#1E293B' }}>{c.commentText}</p>
                  </div>

                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button
                      type="button"
                      className="btn-icon"
                      onClick={() => onOpenCommentModal(c)}
                      style={{ padding: '6px', borderRadius: '6px', border: '1px solid #CBD5E1', background: '#FFFFFF', cursor: 'pointer', color: '#475569' }}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      className="btn-icon"
                      onClick={() => onDeleteComment(c)}
                      style={{ padding: '6px', borderRadius: '6px', border: '1px solid #FCA5A5', background: '#FEF2F2', cursor: 'pointer', color: '#DC2626' }}
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* UPLOAD DOCUMENT MODAL */}
      {showDocModal && (
        <div className="modal-backdrop">
          <div className="modal-card" style={{ maxWidth: '500px' }}>
            <h3 style={{ margin: '0 0 16px', fontSize: '1.1rem', fontWeight: 800 }}>Upload Project Document</h3>

            <form onSubmit={handleSaveDocument} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Document Title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Ground Floor Electrical & Plumbing Plan"
                  value={docTitle}
                  onChange={e => setDocTitle(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #CBD5E1' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Category *</label>
                <select
                  value={docCategory}
                  onChange={e => setDocCategory(e.target.value as DocumentCategory)}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #CBD5E1' }}
                >
                  <option value="Architectural Drawing">Architectural Drawing</option>
                  <option value="Structural Drawing">Structural Drawing</option>
                  <option value="Agreement">Agreement</option>
                  <option value="Approval">Approval & Permits</option>
                  <option value="Quotation">Quotation</option>
                  <option value="Bill / Invoice">Bill / Invoice</option>
                  <option value="Site Photograph">Site Photograph</option>
                  <option value="Report">Report</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Description</label>
                <textarea
                  rows={2}
                  placeholder="Revision details, engineer notes..."
                  value={docDescription}
                  onChange={e => setDocDescription(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #CBD5E1' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Select File (PDF, DWG, Image)</label>
                <input
                  type="file"
                  onChange={e => setDocFile(e.target.files ? e.target.files[0] : null)}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #CBD5E1' }}
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input
                  type="checkbox"
                  id="chkClientShare"
                  checked={docSharedWithClient}
                  onChange={e => setDocSharedWithClient(e.target.checked)}
                />
                <label htmlFor="chkClientShare" style={{ fontSize: '0.82rem', color: '#334155', cursor: 'pointer' }}>
                  Share with Client in Client Portal
                </label>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() => setShowDocModal(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Upload Document
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CREATE / EDIT SITE DIARY MODAL */}
      {showDiaryModal && (
        <div className="modal-backdrop">
          <div className="modal-card" style={{ maxWidth: '580px' }}>
            <h3 style={{ margin: '0 0 16px', fontSize: '1.1rem', fontWeight: 800 }}>
              {editingDiary ? 'Edit Daily Site Diary' : 'Daily Construction Site Diary'}
            </h3>

            <form onSubmit={handleSaveDiary} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Report Date *</label>
                  <input
                    type="date"
                    required
                    value={diaryDate}
                    onChange={e => setDiaryDate(e.target.value)}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #CBD5E1' }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Workers Present *</label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={diaryWorkersCount}
                    onChange={e => setDiaryWorkersCount(Number(e.target.value))}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #CBD5E1' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Work Completed Today *</label>
                <textarea
                  rows={3}
                  required
                  placeholder="Detail activities: foundation excavation, bar bending, brickwork up to lintel, plastering..."
                  value={diaryWorkDone}
                  onChange={e => setDiaryWorkDone(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #CBD5E1' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Materials Used</label>
                  <input
                    type="text"
                    placeholder="e.g. 30 bags cement, 150 cft sand"
                    value={diaryMaterials}
                    onChange={e => setDiaryMaterials(e.target.value)}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #CBD5E1' }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Equipment / Machinery Used</label>
                  <input
                    type="text"
                    placeholder="e.g. Concrete Mixer, JCB, Vibrator"
                    value={diaryEquipment}
                    onChange={e => setDiaryEquipment(e.target.value)}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #CBD5E1' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Site Issues / Delays (if any)</label>
                <input
                  type="text"
                  placeholder="e.g. Heavy rain delayed concrete pour, water tanker delayed..."
                  value={diaryIssues}
                  onChange={e => setDiaryIssues(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #CBD5E1' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Engineer Remarks</label>
                  <input
                    type="text"
                    placeholder="Quality inspection notes..."
                    value={diaryRemarks}
                    onChange={e => setDiaryRemarks(e.target.value)}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #CBD5E1' }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Supervisor Notes</label>
                  <input
                    type="text"
                    placeholder="Site supervisor remarks..."
                    value={diaryNotes}
                    onChange={e => setDiaryNotes(e.target.value)}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #CBD5E1' }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Weather Conditions</label>
                  <input
                    type="text"
                    placeholder="e.g. Sunny / Rain / Overcast"
                    value={diaryWeather}
                    onChange={e => setDiaryWeather(e.target.value)}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #CBD5E1' }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Progress ({diaryProgress}%)</label>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={diaryProgress}
                    onChange={e => setDiaryProgress(Number(e.target.value))}
                    style={{ width: '100%', marginTop: '6px' }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() => setShowDiaryModal(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  {editingDiary ? 'Save Report' : 'Submit Site Diary'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
