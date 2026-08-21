import React from 'react';
import { GlassCard } from '../../components/common/GlassCard';
import { Button } from '../../components/common/Button';
import { useNotifications } from '../../contexts/NotificationContext';
import { Bell, CheckCircle2, Clock, AlertTriangle } from 'lucide-react';

export const NotificationsPage: React.FC = () => {
  const { notifications, unreadCount, markAsRead, markAllRead } = useNotifications();

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-3">
            Notifications Center <Bell className="w-6 h-6" style={{ color: 'var(--role-primary)' }} />
          </h1>
          <p className="text-xs text-slate-500 mt-1">Real-time alerts for task assignments, manager approvals, and sprint deadlines</p>
        </div>
        {unreadCount > 0 && (
          <Button variant="outline" size="sm" onClick={markAllRead}>
            Mark All as Read
          </Button>
        )}
      </div>

      <GlassCard className="space-y-3">
        {notifications.length === 0 ? (
          <p className="text-xs text-slate-500 text-center py-8">No notifications in your inbox.</p>
        ) : (
          notifications.map((n) => (
            <div
              key={n.id}
              onClick={() => markAsRead(n.id)}
              className={`p-4 rounded-xl border text-xs cursor-pointer transition-all ${
                n.is_read
                  ? 'bg-slate-50 border-slate-200 text-slate-500'
                  : 'bg-white text-slate-800 font-medium border-[var(--role-border)]'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <h4 className="font-semibold text-slate-900 text-sm">{n.title}</h4>
                <span className="text-[10px] text-slate-500">{new Date(n.created_at).toLocaleString()}</span>
              </div>
              <p className="text-slate-600">{n.message}</p>
            </div>
          ))
        )}
      </GlassCard>
    </div>
  );
};
