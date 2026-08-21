import React, { useState } from 'react';
import { GlassCard } from '../../components/common/GlassCard';
import { Button } from '../../components/common/Button';
import { reportService } from '../../services/api';
import { FileText, Download, FileSpreadsheet, FileCode } from 'lucide-react';

export const ManagerReports: React.FC = () => {
  const [title, setTitle] = useState('Sprint Velocity & Delivery Report');
  const [reportType, setReportType] = useState('SPRINT');
  const [format, setFormat] = useState('PDF');
  const [isGenerating, setIsGenerating] = useState(false);

  const handleDownload = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsGenerating(true);
    try {
      await reportService.download({
        title,
        report_type: reportType,
        format,
      });
    } catch (e) {
      alert("Failed to export report");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Sprint & Team Reports</h1>
        <p className="text-xs text-slate-500 mt-1">Export PDF, CSV, and Excel velocity reports for your assigned projects</p>
      </div>

      <GlassCard>
        <form onSubmit={handleDownload} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Report Title</label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-900 text-xs focus:outline-none focus:border-[var(--role-primary)]"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Report Type</label>
            <select
              value={reportType}
              onChange={(e) => setReportType(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-900 text-xs focus:outline-none focus:border-[var(--role-primary)]"
            >
              <option value="SPRINT">Sprint Burndown & Velocity</option>
              <option value="DEVELOPER">Developer Task Allocation</option>
              <option value="WEEKLY">Weekly Team Summary</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Format</label>
            <div className="grid grid-cols-3 gap-2">
              {['PDF', 'CSV', 'EXCEL'].map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setFormat(f)}
                  className={`py-2.5 rounded-xl border text-xs font-semibold transition-all ${format === f
                      ? 'bg-emerald-600/20 border-emerald-500 text-emerald-300'
                      : 'bg-white border-slate-200 text-slate-500'
                    }`}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>

          <Button
            type="submit"
            variant="manager"
            size="lg"
            isLoading={isGenerating}
            icon={<Download className="w-4 h-4" />}
            className="w-full mt-2"
          >
            Export Report ({format})
          </Button>
        </form>
      </GlassCard>
    </div>
  );
};
