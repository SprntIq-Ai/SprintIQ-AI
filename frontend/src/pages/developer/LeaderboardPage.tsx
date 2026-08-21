import React, { useEffect, useState } from 'react';
import { GlassCard } from '../../components/common/GlassCard';
import { Badge } from '../../components/common/Badge';
import { analyticsService, developerFeatureService } from '../../services/api';
import { LeaderboardItem, DeveloperBadge as DevBadgeType } from '../../types';
import { Award, Trophy, Zap, Bug, Sparkles, CheckCircle2, Star, ShieldCheck } from 'lucide-react';
import { InitialsAvatar } from '../../components/common/InitialsAvatar';

export const LeaderboardPage: React.FC = () => {
  const [leaderboard, setLeaderboard] = useState<LeaderboardItem[]>([]);
  const [myBadges, setMyBadges] = useState<DevBadgeType[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      analyticsService.getLeaderboard(),
      developerFeatureService.getBadges()
    ]).then(([lb, bd]) => {
      setLeaderboard(lb);
      setMyBadges(bd);
      setIsLoading(false);
    }).catch(e => {
      console.error(e);
      setIsLoading(false);
    });
  }, []);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-64 bg-slate-100 rounded animate-pulse" />
        <div className="h-64 bg-slate-50 rounded-2xl animate-pulse" />
      </div>
    );
  }

  const badgeIcons: Record<string, any> = {
    Zap: Zap,
    Bug: Bug,
    Sparkles: Sparkles,
    Trophy: Trophy,
    Star: Star
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-3">
          Developer Leaderboard & Achievements <Badge variant="developer">Top Gamification</Badge>
        </h1>
        <p className="text-xs text-slate-500 mt-1">Ranking developers by completed tasks, story points, code quality, on-time delivery, and unlocked badges</p>
      </div>

      {/* Developer Badges Grid */}
      <GlassCard className="space-y-4">
        <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
          <Award className="w-5 h-5 text-[var(--role-primary)]" /> Unlocked Achievement Badges ({myBadges.length})
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {myBadges.map((b) => {
            const IconComp = badgeIcons[b.icon_name || 'Trophy'] || Trophy;
            return (
              <div key={b.id} className="p-4 rounded-xl bg-slate-50 border border-[rgba(var(--role-primary-rgb),0.30)] flex items-start gap-3">
                <div className="p-3 rounded-2xl bg-[rgba(var(--role-primary-rgb),0.20)] text-[var(--role-secondary)] border border-[rgba(var(--role-primary-rgb),0.30)] shrink-0">
                  <IconComp className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="font-bold text-slate-900 text-sm">{b.badge_title}</h4>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-mono">UNLOCKED</span>
                  </div>
                  <p className="text-slate-500 text-xs mt-1">{b.description || 'Achievement unlocked in active sprint'}</p>
                </div>
              </div>
            );
          })}
        </div>
      </GlassCard>

      {/* Leaderboard Rankings Table */}
      <GlassCard className="space-y-4">
        <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
          <Trophy className="w-5 h-5 text-amber-400" /> Organization Developer Leaderboard
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500 uppercase text-[10px]">
                <th className="py-3 px-4">Rank</th>
                <th className="py-3 px-4">Developer</th>
                <th className="py-3 px-4 text-center">Tasks Completed</th>
                <th className="py-3 px-4 text-center">Story Points</th>
                <th className="py-3 px-4 text-center">Task Quality</th>
                <th className="py-3 px-4 text-center">On-Time Delivery</th>
                <th className="py-3 px-4 text-center">Overall Score</th>
                <th className="py-3 px-4 text-right">Badges</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/60">
              {leaderboard.map((item) => (
                <tr key={item.developer_id} className="hover:bg-slate-100/40">
                  <td className="py-3 px-4 font-bold text-slate-900">
                    {item.rank_position === 1 ? (
                      <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-400 font-mono">🥇 #1</span>
                    ) : item.rank_position === 2 ? (
                      <span className="px-2 py-0.5 rounded bg-slate-200/20 text-slate-600 font-mono">🥈 #2</span>
                    ) : item.rank_position === 3 ? (
                      <span className="px-2 py-0.5 rounded bg-amber-700/20 text-amber-500 font-mono">🥉 #3</span>
                    ) : (
                      <span className="font-mono text-slate-500">#{item.rank_position}</span>
                    )}
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-3">
                      <InitialsAvatar name={item.developer_name} role="developer" size={32} className="ring-2 ring-slate-200" />
                      <span className="font-bold text-slate-900">{item.developer_name}</span>
                    </div>
                  </td>
                  <td className="py-3 px-4 text-center font-bold text-teal-400">{item.completed_tasks}</td>
                  <td className="py-3 px-4 text-center font-bold text-[var(--role-primary)]">{item.story_points} SP</td>
                  <td className="py-3 px-4 text-center font-bold text-emerald-400">{item.task_quality_score}%</td>
                  <td className="py-3 px-4 text-center font-bold" style={{ color: 'var(--role-primary)' }}>{item.on_time_delivery_rate}%</td>
                  <td className="py-3 px-4 text-center font-mono font-extrabold text-amber-400 text-sm">{item.overall_productivity_score}</td>
                  <td className="py-3 px-4 text-right">
                    <div className="flex justify-end gap-1 flex-wrap">
                      {item.badges.map((bg, i) => (
                        <span key={i} className="px-2 py-0.5 rounded text-[10px] bg-[rgba(var(--role-primary-rgb),0.15)] text-[var(--role-secondary)] border border-[rgba(var(--role-primary-rgb),0.30)]">
                          {bg}
                        </span>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </GlassCard>
    </div>
  );
};
