import React, { useState, useEffect } from 'react';
import { GlassCard } from '../../components/common/GlassCard';
import { Button } from '../../components/common/Button';
import { reportService } from '../../services/api';
import { FileText, Download, FileSpreadsheet, FileCode, CheckCircle2 } from 'lucide-react';

export const ReportsPage: React.FC = () => {
  const [reportsList, setReportsList] = useState<any[]>([]);
  const [reportTitle, setReportTitle] = useState('Executive Weekly Engineering Report');
  const [reportType, setReportType] = useState('WEEKLY');
  const [format, setFormat] = useState('PDF');
  const [isGenerating, setIsGenerating] = useState(false);

  const loadReports = async () => {
    try {
      const data = await reportService.list();
      setReportsList(data);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    loadReports();
  }, []);

  const handleDownloadReport = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsGenerating(true);
    try {
      await reportService.download({
        title: reportTitle,
        report_type: reportType,
        format: format,
      });
      loadReports();
    } catch (err) {
      alert("Failed to generate and download report");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Executive Report Generator</h1>
        <p className="text-xs text-slate-500 mt-1">Export PDF, CSV, and Excel reports for weekly milestones, sprint velocity, and developer performance</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Generator Form */}
        <GlassCard className="lg:col-span-1 space-y-5">
          <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <FileText className="w-5 h-5" style={{ color: 'var(--role-primary)' }} /> Export Custom Report
          </h3>

          <form onSubmit={handleDownloadReport} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Report Title</label>
              <input
                type="text"
                required
                value={reportTitle}
                onChange={(e) => setReportTitle(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-900 text-xs focus:outline-none focus:border-[var(--role-primary)]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Report Focus</label>
              <select
                value={reportType}
                onChange={(e) => setReportType(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-900 text-xs focus:outline-none focus:border-[var(--role-primary)]"
              >
                <option value="WEEKLY">Weekly Summary Report</option>
                <option value="SPRINT">Sprint Velocity & Burndown</option>
                <option value="PROJECT">Project Health Portfolio</option>
                <option value="DEVELOPER">Developer Productivity Audit</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Export Format</label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'PDF', label: 'PDF Document', icon: FileText, color: 'text-rose-400' },
                  { id: 'CSV', label: 'CSV Spreadsheet', icon: FileCode, color: 'text-emerald-400' },
                  { id: 'EXCEL', label: 'Excel Workbook', icon: FileSpreadsheet, color: 'text-teal-400' },
                ].map((f) => {
                  const Icon = f.icon;
                  return (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => setFormat(f.id)}
                      className={`p-3 rounded-xl border text-center flex flex-col items-center gap-1.5 transition-all ${format === f.id
                          ? 'bg-[rgba(var(--role-primary-rgb),0.20)] border-[rgba(var(--role-primary-rgb),0.50)] text-slate-900 font-semibold'
                          : 'bg-slate-50 border-slate-200 text-slate-500 hover:text-slate-900'
                        }`}
                    >
                      <Icon className={`w-5 h-5 ${f.color}`} />
                      <span className="text-[10px]">{f.id}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <Button
              type="submit"
              variant="admin"
              size="lg"
              isLoading={isGenerating}
              icon={<Download className="w-4 h-4" />}
              className="w-full mt-2"
            >
              Generate & Download {format}
            </Button>
          </form>
        </GlassCard>

        {/* History Table */}
        <GlassCard className="lg:col-span-2">
          <h3 className="text-lg font-bold text-slate-900 mb-4">Generated Reports Log</h3>
          <div className="space-y-3">
            {reportsList.map((rep) => (
              <div key={rep.id} className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between text-xs">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-[rgba(var(--role-primary-rgb),0.10)] text-[var(--role-primary)]">
                    <FileText className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-slate-900">{rep.title}</h4>
                    <p className="text-slate-500 text-[11px] mt-0.5">
                      Type: <span className="text-slate-600 font-mono">{rep.report_type}</span> • Format: <span className="font-bold" style={{ color: 'var(--role-primary)' }}>{rep.format}</span>
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-slate-500 text-[11px] block">{new Date(rep.created_at).toLocaleDateString()}</span>
                  <span className="text-emerald-400 text-[10px] font-semibold">Generated by {rep.generated_by_name}</span>
                </div>
              </div>
            ))}
          </div>
        </GlassCard>
      </div>
    </div>
  );
};
