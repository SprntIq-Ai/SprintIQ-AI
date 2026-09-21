import React, { useState, useEffect, useCallback } from 'react';
import { GlassCard } from '../../components/common/GlassCard';
import { Button } from '../../components/common/Button';
import { reportService } from '../../services/api';
import { FileText, Download, FileSpreadsheet, FileCode, Eye, CheckCircle2, AlertTriangle, RefreshCw } from 'lucide-react';

export const ReportsPage: React.FC = () => {
  const [reportsList, setReportsList] = useState<any[]>([]);
  const [reportTitle, setReportTitle] = useState('Executive Weekly Engineering Report');
  const [reportType, setReportType] = useState('PROJECT');
  const [format, setFormat] = useState('PDF');
  const [isGenerating, setIsGenerating] = useState(false);
  const [preview, setPreview] = useState<any>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const loadReports = useCallback(async () => {
    try {
      const data = await reportService.list();
      setReportsList(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error(e);
      setReportsList([]);
    }
  }, []);

  const loadPreview = useCallback(async (type: string) => {
    setPreviewLoading(true);
    try {
      const p = await reportService.getPreview({ report_type: type });
      setPreview(p);
    } catch (e) {
      console.error("Preview failed:", e);
      setPreview(null);
    } finally {
      setPreviewLoading(false);
    }
  }, []);

  useEffect(() => {
    loadReports();
    loadPreview(reportType);

    const handleMutation = () => {
      loadReports();
      loadPreview(reportType);
    };
    window.addEventListener('sprintiq:mutation', handleMutation);
    return () => window.removeEventListener('sprintiq:mutation', handleMutation);
  }, [loadReports, loadPreview, reportType]);

  const handleTypeChange = (newType: string) => {
    setReportType(newType);
    if (newType === 'PROJECT') setReportTitle('Executive Project Health Portfolio');
    else if (newType === 'WEEKLY') setReportTitle('Executive Weekly Engineering Report');
    else if (newType === 'SPRINT') setReportTitle('Sprint Velocity & Burndown Report');
    else if (newType === 'DEVELOPER') setReportTitle('Developer Productivity Audit');
  };

  const handleDownloadReport = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsGenerating(true);
    setStatusMsg(null);
    try {
      await reportService.download({
        title: reportTitle,
        report_type: reportType,
        format: format,
      });
      setStatusMsg({ type: 'success', text: `Report successfully generated and downloaded as ${format}.` });
      loadReports();
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: err?.response?.data?.detail || "Failed to generate and download report" });
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

      {statusMsg && (
        <div className={`p-4 rounded-xl text-xs font-semibold flex items-center gap-2 ${
          statusMsg.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-rose-50 text-rose-700 border border-rose-200'
        }`}>
          {statusMsg.type === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertTriangle className="w-4 h-4 shrink-0" />}
          {statusMsg.text}
        </div>
      )}

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
                onChange={(e) => handleTypeChange(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-900 text-xs focus:outline-none focus:border-[var(--role-primary)] cursor-pointer"
              >
                <option value="PROJECT">Project Health Portfolio</option>
                <option value="WEEKLY">Weekly Summary Report</option>
                <option value="SPRINT">Sprint Velocity & Burndown</option>
                <option value="DEVELOPER">Developer Productivity Audit</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Export Format</label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'PDF', label: 'PDF Document', icon: FileText, color: 'text-rose-500' },
                  { id: 'CSV', label: 'CSV Spreadsheet', icon: FileCode, color: 'text-emerald-500' },
                  { id: 'EXCEL', label: 'Excel Workbook', icon: FileSpreadsheet, color: 'text-teal-500' },
                ].map((f) => {
                  const Icon = f.icon;
                  return (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => setFormat(f.id)}
                      className={`p-3 rounded-xl border text-center flex flex-col items-center gap-1.5 transition-all ${format === f.id
                          ? 'bg-[rgba(var(--role-primary-rgb),0.15)] border-[rgba(var(--role-primary-rgb),0.50)] text-slate-900 font-semibold'
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

        {/* Live Preview Table */}
        <GlassCard className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Eye className="w-5 h-5 text-[var(--role-primary)]" /> Live Data Preview
            </h3>
            {previewLoading && <RefreshCw className="w-4 h-4 animate-spin text-[var(--role-primary)]" />}
          </div>

          {preview && preview.summary && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {Object.entries(preview.summary).slice(0, 6).map(([k, v]: [string, any]) => (
                <div key={k} className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                  <span className="text-[10px] uppercase font-semibold text-slate-400 block">{k}</span>
                  <span className="text-xs font-bold text-slate-800 truncate block mt-0.5">{String(v)}</span>
                </div>
              ))}
            </div>
          )}

          {preview && preview.headers && preview.rows ? (
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                  <tr>
                    {preview.headers.map((h: string, idx: number) => (
                      <th key={idx} className="p-2.5 whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {preview.rows.length === 0 ? (
                    <tr>
                      <td colSpan={preview.headers.length} className="p-6 text-center text-slate-400">
                        No records found for this report scope.
                      </td>
                    </tr>
                  ) : (
                    preview.rows.slice(0, 6).map((row: any[], rIdx: number) => (
                      <tr key={rIdx} className="hover:bg-slate-50/50">
                        {row.map((cell: any, cIdx: number) => (
                          <td key={cIdx} className="p-2.5 whitespace-nowrap text-slate-700">{String(cell)}</td>
                        ))}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="py-12 text-center text-slate-400 text-xs">
              Preview unavailable for selected configuration.
            </div>
          )}
        </GlassCard>
      </div>

      {/* History Table */}
      <GlassCard>
        <h3 className="text-lg font-bold text-slate-900 mb-4">Generated Reports History</h3>
        {reportsList.length === 0 ? (
          <div className="text-center py-10 text-slate-400 text-xs">
            No previous reports logged. Generated exports will be tracked here.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {reportsList.map((rep) => (
              <div key={rep.id} className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between text-xs">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="p-2 rounded-lg bg-[rgba(var(--role-primary-rgb),0.10)] text-[var(--role-primary)] shrink-0">
                    <FileText className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <h4 className="font-semibold text-slate-900 truncate">{rep.title}</h4>
                    <p className="text-slate-500 text-[11px] mt-0.5">
                      Type: <span className="text-slate-600 font-mono">{rep.report_type}</span> • Format: <span className="font-bold" style={{ color: 'var(--role-primary)' }}>{rep.format}</span>
                    </p>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <span className="text-slate-500 text-[11px] block">{new Date(rep.created_at).toLocaleDateString()}</span>
                  <span className="text-emerald-500 text-[10px] font-semibold">Generated by {rep.generated_by_name || 'Admin'}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </GlassCard>
    </div>
  );
};

