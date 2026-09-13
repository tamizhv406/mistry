import React, { useState, useEffect } from 'react';
import { X, Save, UserCheck } from 'lucide-react';
import { db } from '../db/db';
import type { LabourWorker, LabourCategory } from '../db/types';
import { VoiceInputField } from './VoiceInputField';

interface WorkerModalProps {
  isOpen: boolean;
  siteId: string;
  workerToEdit?: LabourWorker | null;
  onClose: () => void;
  onSuccess: (message: string) => void;
}

export const WorkerModal: React.FC<WorkerModalProps> = ({
  isOpen,
  siteId,
  workerToEdit,
  onClose,
  onSuccess,
}) => {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [category, setCategory] = useState<LabourCategory>('PERIYAAL');
  const [customCategory, setCustomCategory] = useState('');
  const [dailyWage, setDailyWage] = useState<string>('900');
  const [joiningDate, setJoiningDate] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (workerToEdit) {
      setName(workerToEdit.name || '');
      setPhone(workerToEdit.phone || '');
      if (['SITHAAL', 'PERIYAAL', 'MISTRY'].includes(workerToEdit.category)) {
        setCategory(workerToEdit.category);
        setCustomCategory('');
      } else {
        setCategory('Other');
        setCustomCategory(workerToEdit.category);
      }
      setDailyWage(workerToEdit.dailyWage.toString());
      setJoiningDate(workerToEdit.joiningDate || '');
      setNotes(workerToEdit.notes || '');
    } else {
      setName('');
      setPhone('');
      setCategory('PERIYAAL');
      setCustomCategory('');
      setDailyWage('900');
      setJoiningDate(new Date().toISOString().slice(0, 10));
      setNotes('');
      setError('');
      setIsSubmitting(false);
    }
  }, [workerToEdit, isOpen]);

  // Adjust default wage based on standard category
  const handleCategoryChange = (newCat: string) => {
    setCategory(newCat);
    if (!workerToEdit) {
      if (newCat === 'SITHAAL') setDailyWage('600');
      else if (newCat === 'PERIYAAL') setDailyWage('900');
      else if (newCat === 'MISTRY') setDailyWage('1200');
    }
  };

  if (!isOpen) return null;

  const numWage = Math.max(0, parseFloat(dailyWage) || 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    if (!name.trim()) {
      setError('Please enter the worker name.');
      return;
    }
    if (numWage <= 0) {
      setError('Daily wage must be greater than ₹0.');
      return;
    }

    const finalCategory = category === 'Other' ? (customCategory.trim() || 'Worker') : category;
    const now = new Date().toISOString();
    const id = workerToEdit ? workerToEdit.id : `worker-${Date.now()}`;

    const record: LabourWorker = {
      id,
      siteId,
      name: name.trim(),
      phone: phone.trim(),
      category: finalCategory,
      dailyWage: numWage,
      joiningDate: joiningDate || now.slice(0, 10),
      notes: notes.trim(),
      isDeleted: false,
      createdAt: workerToEdit ? workerToEdit.createdAt : now,
      updatedAt: now,
    };

    setIsSubmitting(true);
    try {
      await db.workers.put(record);
      onSuccess(workerToEdit ? `Worker "${record.name}" updated` : `Worker "${record.name}" added to roster`);
      onClose();
    } catch (err: any) {
      setError('Failed to save worker: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-dialog" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <UserCheck size={22} color="#f59e0b" />
            {workerToEdit ? 'Edit Construction Worker' : 'Add Construction Worker'}
          </h3>
          <button className="modal-close-btn" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {error && (
              <div style={{
                backgroundColor: '#fee2e2',
                color: '#991b1b',
                padding: '10px 14px',
                borderRadius: '8px',
                fontSize: '0.88rem',
                fontWeight: 600,
              }}>
                {error}
              </div>
            )}

            <div className="form-grid-2">
              <VoiceInputField
                label="Worker Full Name"
                tamilLabel="தொழிலாளி பெயர்"
                placeholder="e.g. M. Senthil Kumar"
                value={name}
                onChange={setName}
                required
              />

              <div className="form-group">
                <label>Phone Number</label>
                <input
                  type="tel"
                  placeholder="e.g. 94432 12345"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                />
              </div>
            </div>

            <div className="form-grid-2">
              <div className="form-group">
                <label>Labour Category <span className="required">*</span></label>
                <select value={category} onChange={e => handleCategoryChange(e.target.value)}>
                  <option value="SITHAAL">SITHAAL (Helper / Mortar Mixer / Carrier)</option>
                  <option value="PERIYAAL">PERIYAAL (Mason / Bricklayer)</option>
                  <option value="MISTRY">MISTRY (Head Mason / Master Craftsman)</option>
                  <option value="Other">+ Custom Category</option>
                </select>
              </div>

              {category === 'Other' && (
                <div className="form-group">
                  <label>Custom Category Name</label>
                  <input
                    type="text"
                    placeholder="e.g. Bar Bender / Carpenter / Plumber"
                    value={customCategory}
                    onChange={e => setCustomCategory(e.target.value)}
                  />
                </div>
              )}

              <div className="form-group">
                <label>Daily Wage Rate (₹ / Day) <span className="required">*</span></label>
                <input
                  type="number"
                  step="any"
                  min="50"
                  value={dailyWage}
                  onChange={e => setDailyWage(e.target.value)}
                />
              </div>
            </div>

            <div className="form-grid-2">
              <div className="form-group">
                <label>Joining Date</label>
                <input
                  type="date"
                  value={joiningDate}
                  onChange={e => setJoiningDate(e.target.value)}
                />
              </div>

              <VoiceInputField
                label="Notes / Skills / Native Place"
                tamilLabel="குறிப்புகள்"
                placeholder="e.g. Plastering expert, from Villupuram"
                value={notes}
                onChange={setNotes}
              />
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-outline" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
              <Save size={18} />
              <span>{isSubmitting ? 'Saving...' : (workerToEdit ? 'Save Changes' : 'Add Worker')}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
