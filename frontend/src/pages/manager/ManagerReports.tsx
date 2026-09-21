import React, { useState, useEffect, useCallback } from 'react';
import { GlassCard } from '../../components/common/GlassCard';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import { reportService, managerService, sprintService } from '../../services/api';
import {
  FileText, Download, FileSpreadsheet, FolderKanban, Layers,
  TrendingUp, Users, Calendar, Sparkles, RefreshCw, Eye
} from 'lucide-react';
import { ResponsiveContainer, LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';

export const ManagerReports: React.FC = () => {
  const [projects, setProjects] = useState<any[]>([]);
  const [sprints, setSprints] = useState<any[]>([]);
  const [selectedProject, setSelectedProject] = useState<string>('');
  const [selectedSprint, setSelectedSprint] = useState<string>('');
  const [reportType, setReportType] = useState<string>('SPRINT');
  const [format, setFormat] = useState<string>('PDF');
  const [title, setTitle] = useState<string>('Sprint Burndown & Velocity Report');
  
  const [previewData, setPreviewData] = useState<any>(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState<boolean>(false);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);

  // Load Projects on Mount
  useEffect(() => {
    const loadProjects = async () => {
      try {
        const pList = await managerService.getProjects();
        setProjects(pList || []);
        if (pList && pList.length > 0) {
          setSelectedProject(pList[0].id);
        }
      } catch (e) {
        console.error("Failed to load projects:", e);
      }
    };
    loadProjects();
  }, []);

  // Load Sprints when Selected Project changes
  useEffect(() => {
    if (!selectedProject) {
      setSprints([]);
      setSelectedSprint('');
      return;
    }
    const loadSprints = async () => {
      try {
        const sList = await sprintService.getAll(selectedProject);
        setSprints(sList || []);
        if (sList && sList.length > 0) {
          setSelectedSprint(sList[0].id);
        } else {
          setSelectedSprint('');
        }
      } catch (e) {
        console.error("Failed to load sprints for project:", e);
      }
    };
    loadSprints();
  }, [selectedProject]);

  // Update default title when report type or sprint changes
  useEffect(() => {
    const proj = projects.find(p => p.id === selectedProject);
    const sprint = sprints.find(s => s.id === selectedSprint);
    const pName = proj ? proj.name : 'Platform';

    if (reportType === 'SPRINT') {
      setTitle(`${sprint ? sprint.name : 'Sprint 1'} — Velocity & Burndown Report`);
    } else if (reportType === 'DEVELOPER') {
      setTitle(`Developer Task Allocation Report — ${pName}`);
    } else {
      setTitle(`Weekly Engineering Summary — ${pName}`);
    }
  }, [reportType, selectedProject, selectedSprint, projects, sprints]);

  // Fetch Live Preview Data
  const fetchPreview = useCallback(async () => {
    setIsLoadingPreview(true);
    try {
      const data = await reportService.getPreview({
        report_type: reportType,
        project_id: selectedProject || undefined,
        sprint_id: selectedSprint || undefined,
      });
      setPreviewData(data);
    } catch (e) {
      console.error("Failed to load report preview:", e);
      setPreviewData(null);
    } finally {
      setIsLoadingPreview(false);
    }
  }, [reportType, selectedProject, selectedSprint]);

  useEffect(() => {
    fetchPreview();
  }, [fetchPreview]);

  const handleDownload = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsGenerating(true);
    try {
      await reportService.download({
        title,
        report_type: reportType,
        format,
        project_id: selectedProject || undefined,
        sprint_id: selectedSprint || undefined,
      });
    } catch (e) {
      alert("Failed to export report. Please verify connection.");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-3">
            Sprint & Team Reports <Badge variant="manager">Export Center</Badge>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Generate and export tailored PDF, CSV, and Excel velocity reports for your assigned engineering projects
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" icon={<RefreshCw className={`w-3.5 h-3.5 ${isLoadingPreview ? 'animate-spin' : ''}`} />} onClick={fetchPreview}>
            Refresh Preview
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Filter and Configuration Form */}
        <div className="space-y-6">
          <GlassCard>
            <h3 className="text-sm font-bold text-slate-900 mb-4 flex items-center gap-2">
              <FolderKanban className="w-4 h-4 text-[var(--role-primary)]" />
              Report Configuration
            </h3>

            <form onSubmit={handleDownload} className="space-y-4">
              {/* Project Selector */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Target Project</label>
                <select
                  value={selectedProject}
                  onChange={(e) => setSelectedProject(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl bg-white border border-slate-200 text-slate-900 text-xs focus:outline-none focus:border-[var(--role-primary)] font-medium"
                >
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>{p.name} ({p.key || 'PROJ'})</option>
                  ))}
                </select>
              </div>

              {/* Sprint Selector (Relevant for Sprint Burndown) */}
              {reportType === 'SPRINT' && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Target Sprint</label>
                  <select
                    value={selectedSprint}
                    onChange={(e) => setSelectedSprint(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl bg-white border border-slate-200 text-slate-900 text-xs focus:outline-none focus:border-[var(--role-primary)] font-medium"
                  >
                    {sprints.length === 0 ? (
                      <option value="">No Sprints Available</option>
                    ) : (
                      sprints.map((s) => (
                        <option key={s.id} value={s.id}>{s.name} ({s.status})</option>
                      ))
                    )}
                  </select>
                </div>
              )}

              {/* Report Type */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Report Focus</label>
                <select
                  value={reportType}
                  onChange={(e) => setReportType(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl bg-white border border-slate-200 text-slate-900 text-xs focus:outline-none focus:border-[var(--role-primary)] font-medium"
                >
                  <option value="SPRINT">Sprint Burndown & Velocity</option>
                  <option value="DEVELOPER">Developer Task Allocation</option>
                  <option value="WEEKLY">Weekly Team Summary</option>
                </select>
              </div>

              {/* Report Title */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Report Title</label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl bg-white border border-slate-200 text-slate-900 text-xs focus:outline-none focus:border-[var(--role-primary)]"
                />
              </div>

              {/* Export Format */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Export Format</label>
                <div className="grid grid-cols-3 gap-2">
                  {['PDF', 'CSV', 'EXCEL'].map((f) => (
                    <button
                      key={f}
                      type="button"
                      onClick={() => setFormat(f)}
                      className={`py-2 rounded-xl border text-xs font-bold transition-all ${
                        format === f
                          ? 'bg-[var(--role-primary)] text-slate-900 border-transparent shadow-sm'
                          : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      {f}
                    </button>
                  ))}
                </div>
              </div>

              {/* Export Button */}
              <Button
                type="submit"
                variant="manager"
                size="lg"
                isLoading={isGenerating}
                icon={<Download className="w-4 h-4" />}
                className="w-full mt-3"
              >
                Export Report ({format})
              </Button>
            </form>
          </GlassCard>

          {/* Report Metadata Summary */}
          {previewData?.summary && (
            <GlassCard className="space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">Summary Metrics</h4>
              <div className="space-y-2">
                {Object.entries(previewData.summary).map(([key, val]: [string, any]) => (
                  <div key={key} className="flex items-center justify-between text-xs py-1 border-b border-slate-100 last:border-0">
                    <span className="text-slate-500">{key}:</span>
                    <span className="font-semibold text-slate-800">{String(val)}</span>
                  </div>
                ))}
              </div>
            </GlassCard>
          )}
        </div>

        {/* Right Column: Live Data Preview and Visualizations */}
        <div className="lg:col-span-2 space-y-6">
          <GlassCard className="space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Eye className="w-4 h-4 text-[var(--role-primary)]" />
                <h3 className="text-sm font-bold text-slate-900">
                  Live Preview: {previewData?.title || title}
                </h3>
              </div>
              <Badge variant="healthy">Live Database Backed</Badge>
            </div>

            {/* Visual Charts */}
            {previewData?.chart_data && previewData.chart_data.length > 0 && (
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200">
                <p className="text-xs font-bold text-slate-700 mb-3">
                  {reportType === 'SPRINT' ? 'Sprint Velocity Burndown (Ideal vs Actual)' :
                   reportType === 'DEVELOPER' ? 'Developer Allocated Workload (Hours)' : 'Deliverables Execution Status'}
                </p>
                <div className="h-52 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    {reportType === 'SPRINT' ? (
                      <LineChart data={previewData.chart_data}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                        <XAxis dataKey="day" stroke="#94a3b8" fontSize={10} axisLine={false} tickLine={false} />
                        <YAxis stroke="#94a3b8" fontSize={10} axisLine={false} tickLine={false} />
                        <Tooltip />
                        <Line type="monotone" dataKey="ideal" stroke="#94a3b8" strokeDasharray="4 4" strokeWidth={2} name="Ideal" />
                        <Line type="monotone" dataKey="actual" stroke="#0ea5e9" strokeWidth={3} name="Actual" dot={{ r: 3 }} />
                      </LineChart>
                    ) : reportType === 'DEVELOPER' ? (
                      <BarChart data={previewData.chart_data}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                        <XAxis dataKey="name" stroke="#94a3b8" fontSize={10} axisLine={false} tickLine={false} />
                        <YAxis stroke="#94a3b8" fontSize={10} axisLine={false} tickLine={false} />
                        <Tooltip />
                        <Bar dataKey="hours" fill="#0ea5e9" radius={[4, 4, 0, 0]} name="Workload (Hours)" />
                      </BarChart>
                    ) : (
                      <BarChart data={previewData.chart_data}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                        <XAxis dataKey="status" stroke="#94a3b8" fontSize={10} axisLine={false} tickLine={false} />
                        <YAxis stroke="#94a3b8" fontSize={10} axisLine={false} tickLine={false} />
                        <Tooltip />
                        <Bar dataKey="count" fill="#10b981" radius={[4, 4, 0, 0]} name="Items" />
                      </BarChart>
                    )}
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {/* Preview Data Table */}
            {isLoadingPreview ? (
              <div className="text-center py-12 text-slate-400 text-xs animate-pulse">Loading report preview table...</div>
            ) : !previewData || !previewData.rows || previewData.rows.length === 0 ? (
              <div className="text-center py-10 text-slate-500 text-xs">
                No data records match this project/sprint selection.
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 text-slate-600 uppercase text-[10px] font-bold">
                    <tr>
                      {previewData.headers.map((h: string, idx: number) => (
                        <th key={idx} className="py-2.5 px-3 whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {previewData.rows.map((row: any[], rIdx: number) => (
                      <tr key={rIdx} className="hover:bg-slate-50 transition-colors">
                        {row.map((cell: any, cIdx: number) => (
                          <td key={cIdx} className="py-2.5 px-3 text-slate-700 whitespace-nowrap">
                            {cell}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </GlassCard>
        </div>
      </div>
    </div>
  );
};
