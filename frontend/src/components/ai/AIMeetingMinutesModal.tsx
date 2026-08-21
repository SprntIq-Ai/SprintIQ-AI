import React, { useState } from 'react';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { FileText, Sparkles, CheckCircle2, UserCheck, Calendar } from 'lucide-react';
import { aiService } from '../../services/api';
import { AIMeetingMinutes } from '../../types';

interface AIMeetingMinutesModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId?: string;
}

export const AIMeetingMinutesModal: React.FC<AIMeetingMinutesModalProps> = ({ isOpen, onClose, projectId }) => {
  const [title, setTitle] = useState('');
  const [rawNotes, setRawNotes] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [minutes, setMinutes] = useState<AIMeetingMinutes | null>(null);

  const handleGenerateMinutes = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !rawNotes.trim()) return;
    setIsGenerating(true);
    try {
      const res = await aiService.createMeetingMinutes({ title, raw_notes: rawNotes, project_id: projectId });
      setMinutes(res);
    } catch (e) {
      console.error(e);
      alert("Failed to generate meeting minutes with AI");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="AI Meeting Minutes Generator" maxWidth="max-w-2xl">
      <div className="space-y-5">
        <form onSubmit={handleGenerateMinutes} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Meeting Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Sprint 2 Planning & Architecture Alignment"
              className="w-full px-4 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-900 text-xs focus:outline-none focus:border-[var(--role-ai)] transition-colors"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Raw Meeting Notes or Transcript</label>
            <textarea
              rows={4}
              value={rawNotes}
              onChange={(e) => setRawNotes(e.target.value)}
              placeholder="Paste bullet points, discussion notes, audio transcript..."
              className="w-full px-4 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-900 text-xs focus:outline-none focus:border-[var(--role-ai)] transition-colors"
              required
            />
          </div>

          <div className="flex justify-end">
            <Button type="submit" variant="ai" isLoading={isGenerating} icon={<Sparkles className="w-4 h-4" />}>
              Extract AI Meeting Minutes
            </Button>
          </div>
        </form>

        {minutes && (
          <div className="space-y-4 p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs">
            <div className="border-b border-slate-200 pb-2">
              <h4 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <FileText className="w-4 h-4" style={{ color: 'var(--role-ai)' }} /> {minutes.title}
              </h4>
              <p className="text-slate-500 text-xs mt-1">{minutes.summary}</p>
            </div>

            <div>
              <p className="font-semibold text-slate-600 mb-1">Key Discussion Points:</p>
              <ul className="list-disc list-inside space-y-1 text-slate-500">
                {minutes.discussion_points.map((p, idx) => (
                  <li key={idx}>{p}</li>
                ))}
              </ul>
            </div>

            <div>
              <p className="font-semibold text-slate-600 mb-2">Action Items & Owners:</p>
              <div className="space-y-2">
                {minutes.action_items.map((item, idx) => (
                  <div key={idx} className="p-3 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-between text-xs">
                    <div>
                      <p className="font-semibold text-slate-900">{item.task_title}</p>
                      <p className="text-slate-500 text-[11px]">Owner: <span className="font-semibold" style={{ color: 'var(--role-ai)' }}>{item.owner}</span></p>
                    </div>
                    <span className="px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 font-mono text-[10px]">Due: {item.deadline}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};
