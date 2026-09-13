import React, { useState, useEffect } from 'react';
import { X, Building2, Save, Mic, MicOff, Sparkles, CheckCircle2 } from 'lucide-react';
import { db } from '../db/db';
import type { Site, SiteStatus } from '../db/types';
import { getCurrentUser } from '../services/auth';
import {
  parseSiteVoiceInput,
  startVoiceRecognition,
  isSpeechRecognitionSupported,
} from '../utils/voiceParser';
import { VoiceInputField } from './VoiceInputField';
import { compressImageFile, SITE_VISUAL } from '../utils/constructionVisuals';
import { SafeImage } from './ui/SafeImage';

interface SiteModalProps {
  isOpen: boolean;
  siteToEdit?: Site | null;
  onClose: () => void;
  onSuccess: (message: string, siteId: string) => void;
}

export const SiteModal: React.FC<SiteModalProps> = ({
  isOpen,
  siteToEdit,
  onClose,
  onSuccess,
}) => {
  const [name, setName] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [ownerPhone, setOwnerPhone] = useState('');
  const [address, setAddress] = useState('');
  const [area, setArea] = useState('');
  const [district, setDistrict] = useState('');
  const [buildingType, setBuildingType] = useState('Residential House');
  const [startDate, setStartDate] = useState('');
  const [expectedCompletionDate, setExpectedCompletionDate] = useState('');
  const [status, setStatus] = useState<SiteStatus>('Active');
  const [notes, setNotes] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Voice Assistant State
  const [isVoiceListening, setIsVoiceListening] = useState(false);
  const [voiceTranscript, setVoiceTranscript] = useState<string | null>(null);
  const [voiceNotes, setVoiceNotes] = useState<string[]>([]);

  const currentUser = getCurrentUser();

  useEffect(() => {
    if (siteToEdit) {
      setName(siteToEdit.name || '');
      setOwnerName(siteToEdit.ownerName || '');
      setOwnerPhone(siteToEdit.ownerPhone || '');
      setAddress(siteToEdit.address || '');
      setArea(siteToEdit.area || '');
      setDistrict(siteToEdit.district || '');
      setBuildingType(siteToEdit.buildingType || 'Residential House');
      setStartDate(siteToEdit.startDate || '');
      setExpectedCompletionDate(siteToEdit.expectedCompletionDate || '');
      setStatus(siteToEdit.status || 'Active');
      setNotes(siteToEdit.notes || '');
      setImageUrl(siteToEdit.imageUrl || '');
    } else {
      setName('');
      setOwnerName('');
      setOwnerPhone('');
      setAddress('');
      setArea('');
      setDistrict('');
      setBuildingType('Residential House');
      setStartDate(new Date().toISOString().slice(0, 10));
      setExpectedCompletionDate('');
      setStatus('Active');
      setNotes('');
      setImageUrl('');
    }
    setError('');
    setIsSaving(false);
    setVoiceTranscript(null);
    setVoiceNotes([]);
  }, [siteToEdit, isOpen]);

  if (!isOpen) return null;

  const handleVoiceFill = () => {
    if (!isSpeechRecognitionSupported()) {
      setError('Speech recognition is not supported in this browser.');
      return;
    }

    if (isVoiceListening) return;

    setIsVoiceListening(true);
    setError('');

    startVoiceRecognition({
      onResult: (transcript: string) => {
        setIsVoiceListening(false);
        setVoiceTranscript(transcript);

        const parsed = parseSiteVoiceInput(transcript);
        if (parsed.name) setName(parsed.name);
        if (parsed.ownerName) setOwnerName(parsed.ownerName);
        if (parsed.ownerPhone) setOwnerPhone(parsed.ownerPhone);
        if (parsed.area) setArea(parsed.area);
        if (parsed.district) setDistrict(parsed.district);
        if (parsed.address) setAddress(parsed.address);
        if (parsed.buildingType) setBuildingType(parsed.buildingType);

        setVoiceNotes(parsed.confidenceNotes);
      },
      onError: (err: string) => {
        setIsVoiceListening(false);
        setError('Voice assistant error: ' + err);
      },
      onEnd: () => {
        setIsVoiceListening(false);
      },
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      setError('Please enter the Site Name.');
      return;
    }
    if (!ownerName.trim()) {
      setError('Please enter the Owner Name.');
      return;
    }

    setIsSaving(true);
    setError('');

    const now = new Date().toISOString();
    const siteId = siteToEdit ? siteToEdit.id : `site-${Date.now()}`;
    const targetUserId = siteToEdit?.userId || currentUser?.id || 'user-admin-default';

    const siteData: Site = {
      id: siteId,
      userId: targetUserId,
      name: name.trim(),
      ownerName: ownerName.trim(),
      ownerPhone: ownerPhone.trim(),
      address: address.trim(),
      area: area.trim(),
      district: district.trim() || undefined,
      buildingType: buildingType.trim(),
      startDate: startDate || now.slice(0, 10),
      expectedCompletionDate: expectedCompletionDate || '',
      status,
      notes: notes.trim(),
      imageUrl: imageUrl || undefined,
      isDeleted: false,
      createdAt: siteToEdit ? siteToEdit.createdAt : now,
      updatedAt: now,
    };

    try {
      await db.sites.put(siteData);
      await db.logActivity(
        siteId,
        siteData.name,
        siteToEdit ? 'UPDATE_SITE' : 'CREATE_SITE',
        siteToEdit ? `Updated site details: ${siteData.name}` : `Created new site: ${siteData.name}`
      );
      onSuccess(
        siteToEdit ? `Site "${siteData.name}" updated successfully` : `Site "${siteData.name}" created successfully`,
        siteId
      );
      onClose();
    } catch (err: any) {
      // Keep all entered values in state and show actual error
      setError('Failed to save site: ' + (err?.message || String(err)));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div className="modal-dialog" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
            <Building2 size={22} color="#f59e0b" />
            <span>{siteToEdit ? 'Edit Construction Site' : 'Add New Construction Site'}</span>
          </h3>
          <button className="modal-close-btn" onClick={onClose} type="button" aria-label="Close">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="modal-form-container">
          <div className="modal-body space-y-4">
            {/* Voice Assistant Banner */}
            <div className="bg-gradient-to-r from-amber-500/15 via-orange-500/10 to-transparent border border-amber-500/30 rounded-2xl p-3.5 flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold">
                    <Sparkles className="w-4 h-4 text-amber-400" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-100 uppercase tracking-wider">
                      Voice Auto-Fill Assistant (குரல் உதவி)
                    </h4>
                    <p className="text-[11px] text-slate-400">
                      Tap mic and say site name, owner, phone, area in Tamil or English!
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleVoiceFill}
                  className={`px-3 py-1.5 rounded-xl font-bold text-xs flex items-center gap-2 transition-all shadow-md ${
                    isVoiceListening
                      ? 'bg-rose-500 text-white animate-pulse shadow-rose-500/40 ring-4 ring-rose-500/20'
                      : 'bg-amber-500 text-slate-950 hover:bg-amber-400 active:scale-95 shadow-amber-500/20'
                  }`}
                >
                  {isVoiceListening ? (
                    <>
                      <MicOff className="w-4 h-4" />
                      <span>Listening...</span>
                    </>
                  ) : (
                    <>
                      <Mic className="w-4 h-4" />
                      <span>Fill by Voice</span>
                    </>
                  )}
                </button>
              </div>

              {voiceTranscript && (
                <div className="bg-slate-900/80 border border-slate-700/60 rounded-xl p-2.5 space-y-1.5">
                  <div className="text-[11px] text-slate-400 italic">
                    Heard: "{voiceTranscript}"
                  </div>
                  {voiceNotes.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {voiceNotes.map((note, idx) => (
                        <span
                          key={idx}
                          className="inline-flex items-center gap-1 bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-full text-[10px] font-semibold"
                        >
                          <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                          {note}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {error && (
              <div
                style={{
                  backgroundColor: '#fee2e2',
                  border: '1px solid #ef4444',
                  color: '#991b1b',
                  padding: '12px 16px',
                  borderRadius: '8px',
                  fontSize: '0.88rem',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                <span>⚠️</span>
                <span>{error}</span>
              </div>
            )}

            <VoiceInputField
              label="Site / Project Name"
              tamilLabel="தளத்தின் பெயர்"
              value={name}
              onChange={setName}
              placeholder="e.g. Sri Murugan Illam (G+1)"
              required
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <VoiceInputField
                label="Owner Name"
                tamilLabel="உரிமையாளர் பெயர்"
                value={ownerName}
                onChange={setOwnerName}
                placeholder="e.g. R. Sundaram"
                required
              />

              <VoiceInputField
                label="Owner Phone Number"
                tamilLabel="தொலைபேசி எண்"
                type="text"
                value={ownerPhone}
                onChange={setOwnerPhone}
                placeholder="e.g. 98401 23456"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <VoiceInputField
                label="Area / Location"
                tamilLabel="இடம் / ஏரியா"
                value={area}
                onChange={setArea}
                placeholder="e.g. Tambaram East, Chennai"
              />

              <div className="form-group space-y-1.5">
                <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                  <span>Building Type</span>
                  <span className="text-[11px] font-normal text-amber-400 bg-amber-400/10 px-1.5 py-0.5 rounded">
                    கட்டட வகை
                  </span>
                </label>
                <select
                  value={buildingType}
                  onChange={e => setBuildingType(e.target.value)}
                  className="w-full bg-slate-800/80 border border-slate-700/80 rounded-xl px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                >
                  <option value="Residential House">Residential House</option>
                  <option value="Residential Villa (G+1)">Residential Villa (G+1)</option>
                  <option value="Duplex Villa (G+1)">Duplex Villa (G+1)</option>
                  <option value="Commercial Building">Commercial Building</option>
                  <option value="Apartment (G+3)">Apartment (G+3)</option>
                  <option value="Factory / Industrial Shed">Factory / Industrial Shed</option>
                  <option value="Renovation / Remodeling">Renovation / Remodeling</option>
                  <option value="Compound Wall & Gate">Compound Wall & Gate</option>
                  <option value="Other">Other</option>
                </select>
              </div>
            </div>

            <VoiceInputField
              label="Site Full Address"
              tamilLabel="முழு முகவரி"
              type="textarea"
              rows={2}
              value={address}
              onChange={setAddress}
              placeholder="Plot number, street name, landmarks..."
            />

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="form-group space-y-1.5">
                <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                  <span>Start Date</span>
                  <span className="text-[11px] font-normal text-amber-400 bg-amber-400/10 px-1.5 py-0.5 rounded">
                    துவக்க தேதி
                  </span>
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={e => setStartDate(e.target.value)}
                  className="w-full bg-slate-800/80 border border-slate-700/80 rounded-xl px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                />
              </div>

              <div className="form-group space-y-1.5">
                <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                  <span>Expected Completion</span>
                  <span className="text-[11px] font-normal text-amber-400 bg-amber-400/10 px-1.5 py-0.5 rounded">
                    முடிவு தேதி
                  </span>
                </label>
                <input
                  type="date"
                  value={expectedCompletionDate}
                  onChange={e => setExpectedCompletionDate(e.target.value)}
                  className="w-full bg-slate-800/80 border border-slate-700/80 rounded-xl px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                />
              </div>

              <div className="form-group space-y-1.5">
                <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                  <span>Status</span>
                  <span className="text-[11px] font-normal text-amber-400 bg-amber-400/10 px-1.5 py-0.5 rounded">
                    நிலை
                  </span>
                </label>
                <select
                  value={status}
                  onChange={e => setStatus(e.target.value as SiteStatus)}
                  className="w-full bg-slate-800/80 border border-slate-700/80 rounded-xl px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                >
                  <option value="Planning">Planning</option>
                  <option value="Active">Active</option>
                  <option value="On Hold">On Hold</option>
                  <option value="Completed">Completed</option>
                </select>
              </div>
            </div>

            {/* Site Photo / Blueprint Visual */}
            <div className="form-group space-y-1.5">
              <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <span>Site Photo / Elevation Plan</span>
                <span className="text-[11px] font-normal text-amber-400 bg-amber-400/10 px-1.5 py-0.5 rounded">
                  கட்டட புகைப்படம்
                </span>
              </label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                <div style={{
                  width: '80px',
                  height: '60px',
                  borderRadius: '10px',
                  overflow: 'hidden',
                  border: '1px solid rgba(245, 158, 11, 0.4)',
                  backgroundColor: '#0f172a',
                  flexShrink: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  <SafeImage
                    src={imageUrl || SITE_VISUAL}
                    alt="Site Preview"
                    fallbackCategory="site"
                    fallbackSrc={SITE_VISUAL}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <input
                    type="file"
                    accept="image/*"
                    id="site-photo-input"
                    style={{ display: 'none' }}
                    onChange={async e => {
                      const file = e.target.files?.[0];
                      if (file) {
                        try {
                          const compressed = await compressImageFile(file, 800, 600, 0.75);
                          setImageUrl(compressed);
                        } catch (err) {
                          console.error('Failed to compress site image', err);
                        }
                      }
                    }}
                  />
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <label
                      htmlFor="site-photo-input"
                      className="btn btn-sm btn-outline cursor-pointer"
                      style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                    >
                      <Sparkles size={14} />
                      <span>{imageUrl ? 'Change Photo' : 'Upload Site Photo'}</span>
                    </label>
                    {imageUrl && (
                      <button
                        type="button"
                        className="btn btn-sm btn-danger"
                        onClick={() => setImageUrl('')}
                      >
                        Remove
                      </button>
                    )}
                  </div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginTop: '4px' }}>
                    Optional building elevation or site photo (auto-compressed for offline storage)
                  </span>
                </div>
              </div>
            </div>

            <VoiceInputField
              label="Notes / Specifications"
              tamilLabel="குறிப்புகள்"
              type="textarea"
              rows={2}
              value={notes}
              onChange={setNotes}
              placeholder="Square footage, structural engineer details, key notes..."
            />
          </div>

          <div className="modal-footer">
            <button
              type="button"
              className="btn btn-outline"
              onClick={onClose}
              disabled={isSaving}
              style={{ minWidth: '110px' }}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={isSaving}
              style={{ minWidth: '130px' }}
            >
              <Save size={18} />
              <span>{isSaving ? 'Saving...' : 'Save Site'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
