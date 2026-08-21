import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { GitPullRequest, GitCommit, GitMerge, AlertCircle, RefreshCw, ExternalLink, FolderKanban } from 'lucide-react';
import { githubService } from '../../services/api';

export const GitHubAnalyticsPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const projectId = id || '';

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [githubData, setGithubData] = useState<any>(null);

  useEffect(() => {
    if (!projectId) {
      setLoading(false);
      return;
    }
    githubService.getProjectAnalytics(projectId)
      .then(setGithubData)
      .catch((e) => setError(e?.response?.data?.detail || 'Failed to load GitHub analytics.'))
      .finally(() => setLoading(false));
  }, [projectId]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[300px] text-slate-500">
        <RefreshCw className="w-7 h-7 animate-spin mb-2" style={{ color: 'var(--role-primary)' }} />
        <p className="text-xs">Fetching GitHub Engineering Analytics...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white border border-rose-500/30 rounded-2xl p-6 flex items-center gap-3 text-rose-400">
        <AlertCircle className="w-5 h-5" />
        <p className="text-sm">{error}</p>
      </div>
    );
  }

  const metrics = githubData?.metrics || {};
  const trends = githubData?.engineering_trends || [];

  return (
    <div className="space-y-6">
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xl flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <span className="role-icon-chip p-2.5 rounded-xl">
            <GitPullRequest className="w-6 h-6" />
          </span>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">GitHub Engineering Analytics</h1>
            <p className="text-sm text-slate-500">
              {githubData?.repo_connected ? (
                <a href={githubData.html_url} target="_blank" rel="noreferrer" className="underline font-mono" style={{ color: 'var(--role-primary)' }}>
                  {githubData.repo_name}
                </a>
              ) : (
                'No repository connected for this project.'
              )}
            </p>
          </div>
        </div>
        {githubData?.repo_connected && (
          <a
            href={githubData.html_url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 text-xs font-semibold px-4 py-2 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <ExternalLink className="w-4 h-4" /> View on GitHub
          </a>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 p-5 rounded-2xl">
          <p className="text-xs text-slate-500 mb-1">PR Cycle Time</p>
          <p className="text-3xl font-black text-slate-900">{metrics.pr_cycle_time_avg_hours ?? 0} <span className="text-xs text-slate-500 font-normal">hrs</span></p>
        </div>
        <div className="bg-white border border-slate-200 p-5 rounded-2xl">
          <p className="text-xs text-slate-500 mb-1">Review Latency</p>
          <p className="text-3xl font-black text-slate-900">{metrics.pr_review_time_avg_hours ?? 0} <span className="text-xs text-slate-500 font-normal">hrs</span></p>
        </div>
        <div className="bg-white border border-slate-200 p-5 rounded-2xl">
          <p className="text-xs text-slate-500 mb-1">Issue Resolution</p>
          <p className="text-3xl font-black text-slate-900">{metrics.issue_resolution_avg_hours ?? 0} <span className="text-xs text-slate-500 font-normal">hrs</span></p>
        </div>
        <div className="bg-white border border-slate-200 p-5 rounded-2xl">
          <p className="text-xs text-slate-500 mb-1">Weekly Commits</p>
          <p className="text-3xl font-black text-slate-900">{metrics.commit_frequency_weekly ?? 0}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 p-5 rounded-2xl">
          <p className="text-xs text-slate-500 mb-1 flex items-center gap-1"><GitPullRequest className="w-3.5 h-3.5" /> Open PRs</p>
          <p className="text-3xl font-black text-slate-900">{metrics.open_prs_count ?? 0}</p>
        </div>
        <div className="bg-white border border-slate-200 p-5 rounded-2xl">
          <p className="text-xs text-slate-500 mb-1 flex items-center gap-1"><GitMerge className="w-3.5 h-3.5" /> Merged PRs</p>
          <p className="text-3xl font-black text-slate-900">{metrics.merged_prs_count ?? 0}</p>
        </div>
        <div className="bg-white border border-slate-200 p-5 rounded-2xl">
          <p className="text-xs text-slate-500 mb-1 flex items-center gap-1"><AlertCircle className="w-3.5 h-3.5" /> Open Issues</p>
          <p className="text-3xl font-black text-slate-900">{metrics.open_issues_count ?? 0}</p>
        </div>
        <div className="bg-white border border-slate-200 p-5 rounded-2xl">
          <p className="text-xs text-slate-500 mb-1 flex items-center gap-1"><FolderKanban className="w-3.5 h-3.5" /> Sync Status</p>
          <p className="text-3xl font-black text-slate-900">{githubData?.sync_status || 'NOT_CONNECTED'}</p>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl p-6">
        <h2 className="text-sm font-bold text-slate-900 mb-1 flex items-center gap-2">
          <GitCommit className="w-4 h-4" style={{ color: 'var(--role-primary)' }} /> Commit Activity (last 30 days)
        </h2>
        {trends.length === 0 ? (
          <p className="text-xs text-slate-500 mt-4">No commit activity in the last 30 days.</p>
        ) : (
          <div className="flex items-end gap-1 mt-4 h-32">
            {trends.map((t: any, i: number) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-1">
                <span className="text-[10px] text-slate-500">{t.commits || ''}</span>
                <div
                  className="w-full rounded-t"
                  style={{
                    height: `${Math.min(100, Math.max(4, ((t.commits || 0) / (Math.max(...trends.map((x: any) => x.commits || 0), 1))) * 100))}%`,
                    backgroundColor: 'var(--role-primary)',
                    opacity: 0.85,
                  }}
                />
                <span className="text-[9px] text-slate-600 rotate-[-40deg] origin-top-left whitespace-nowrap">{t.date?.slice(5)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};