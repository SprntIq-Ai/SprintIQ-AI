import React, { useState, useEffect } from 'react';
import { Search, Bell, Sparkles, ShieldCheck, X, FolderKanban, ListTodo, Users, FileText, Loader2, Menu } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useNotifications } from '../../contexts/NotificationContext';
import { motion, AnimatePresence } from 'framer-motion';
import { searchService } from '../../services/api';
import { GlobalSearchResult } from '../../types';
import { useNavigate } from 'react-router-dom';
import { InitialsAvatar } from '../common/InitialsAvatar';

interface HeaderProps {
  onOpenAIChat?: () => void;
  onToggleSidebar?: () => void;
}

const ROLE_LABEL: Record<string, string> = {
  admin: 'ADMIN',
  manager: 'PROJECT MANAGER',
  developer: 'DEVELOPER',
};

export const Header: React.FC<HeaderProps> = ({ onOpenAIChat, onToggleSidebar }) => {
  const { user, role } = useAuth();
  const navigate = useNavigate();
  const { notifications, unreadCount, markAsRead, markAllRead } = useNotifications();
  const [showNotifications, setShowNotifications] = useState(false);

  // Global Search State
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<GlobalSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // Keyboard shortcut for Cmd+K / Ctrl+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setShowSearchModal((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Live search handler
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const res = await searchService.globalSearch(searchQuery);
        setSearchResults(res.results || []);
      } catch (e) {
        console.error(e);
      } finally {
        setIsSearching(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleSelectResult = (result: GlobalSearchResult) => {
    setShowSearchModal(false);
    setSearchQuery('');
    navigate(result.link);
  };

  const roleLabel = role ? (ROLE_LABEL[role] || role.toUpperCase()) : 'PORTAL';

  return (
    <>
      <header
        className="h-16 lg:h-[72px] sticky top-0 z-30 px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-4"
        style={{
          background: 'var(--role-surface)',
          borderBottom: '1px solid var(--role-header-border)',
        }}
      >
        {/* Left: Mobile toggle + Search */}
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <button
            onClick={onToggleSidebar}
            className="lg:hidden p-2 rounded-xl transition-colors shrink-0"
            style={{
              backgroundColor: 'var(--role-bg-subtle)',
              border: '1px solid var(--role-border)',
              color: 'var(--role-text-body)',
            }}
            aria-label="Toggle navigation menu"
          >
            <Menu className="w-5 h-5" />
          </button>

          <button
            onClick={() => setShowSearchModal(true)}
            className="w-full max-w-md flex items-center gap-3 px-4 py-2.5 rounded-xl cursor-pointer transition-all duration-200 hover:border-[var(--role-primary)] text-sm group"
            style={{
              backgroundColor: 'var(--role-bg-subtle)',
              border: '1px solid var(--role-border)',
              color: 'var(--role-text-muted)',
            }}
          >
            <Search className="w-4 h-4 group-hover:text-[var(--role-primary)] transition-colors" />
            <span className="truncate">Search projects, tasks, developers...</span>
            <kbd className="role-kbd ml-auto hidden sm:inline-flex">Ctrl K</kbd>
          </button>
        </div>

        {/* Right Controls */}
        <div className="flex items-center gap-2.5 sm:gap-3">
          {/* Gemini AI Copilot Trigger */}
          <button
            onClick={onOpenAIChat}
            className="hidden md:flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all duration-200 hover:scale-[1.03]"
            style={{
              backgroundColor: 'var(--role-ai)',
              border: '1px solid rgba(var(--role-ai-rgb), 0.30)',
              color: '#ffffff',
              boxShadow: '0 4px 14px rgba(var(--role-ai-rgb), 0.24)',
            }}
          >
            <Sparkles className="w-4 h-4" />
            <span>AI Copilot</span>
          </button>
          <button
            onClick={onOpenAIChat}
            className="md:hidden p-2.5 rounded-xl transition-all duration-200"
            style={{
              backgroundColor: 'var(--role-ai)',
              border: '1px solid rgba(var(--role-ai-rgb), 0.30)',
              color: '#ffffff',
            }}
            aria-label="Open AI Copilot"
          >
            <Sparkles className="w-4 h-4" />
          </button>

          {/* Notifications */}
          <div className="relative">
            <button
              onClick={() => setShowNotifications(!showNotifications)}
              className="p-2.5 rounded-xl transition-all duration-200 hover:border-[var(--role-primary)]"
              style={{
                backgroundColor: 'var(--role-bg-subtle)',
                border: '1px solid var(--role-border)',
                color: 'var(--role-text-body)',
              }}
              aria-label="Notifications"
              aria-expanded={showNotifications}
            >
              <Bell className="w-[18px] h-[18px]" />
              {unreadCount > 0 && (
                <span
                  className="absolute -top-1 -right-1 w-[18px] h-[18px] text-white text-[10px] font-bold rounded-full flex items-center justify-center"
                  style={{ backgroundColor: 'var(--role-primary)' }}
                >
                  {unreadCount}
                </span>
              )}
            </button>

            <AnimatePresence>
              {showNotifications && (
                <motion.div
                  initial={{ opacity: 0, y: 8, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 8, scale: 0.97 }}
                  transition={{ duration: 0.18 }}
                  className="absolute right-0 mt-3 w-80 sm:w-96 glass-panel p-0 z-50 max-h-[480px] flex flex-col"
                  style={{ boxShadow: 'var(--role-shadow-lg)' }}
                >
                  <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid var(--role-border-subtle)' }}>
                    <h4 className="font-bold text-sm flex items-center gap-2" style={{ color: 'var(--role-text-heading)' }}>
                      <Bell className="w-4 h-4" style={{ color: 'var(--role-primary)' }} /> Notifications
                    </h4>
                    {unreadCount > 0 && (
                      <button
                        onClick={markAllRead}
                        className="text-xs font-medium hover:underline"
                        style={{ color: 'var(--role-primary)' }}
                      >
                        Mark all as read
                      </button>
                    )}
                  </div>

                  <div className="flex-1 overflow-y-auto py-2 px-3 space-y-2 max-h-80">
                    {notifications.length === 0 ? (
                      <p className="text-xs text-center py-6" style={{ color: 'var(--role-text-muted)' }}>No notifications yet.</p>
                    ) : (
                      notifications.map((n) => (
                        <div
                          key={n.id}
                          onClick={() => markAsRead(n.id)}
                          className="p-3 rounded-xl border text-xs cursor-pointer transition-all duration-150"
                          style={{
                            backgroundColor: n.is_read ? 'var(--role-bg-muted)' : 'var(--role-bg-subtle)',
                            borderColor: n.is_read ? 'var(--role-border-subtle)' : 'var(--role-border)',
                          }}
                        >
                          <div className="flex items-start justify-between gap-2 mb-1">
                            <p className="font-semibold text-xs" style={{ color: 'var(--role-text-heading)' }}>{n.title}</p>
                            <span className="text-[10px] shrink-0" style={{ color: 'var(--role-text-muted)' }}>
                              {new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                          <p className="leading-relaxed text-[11px]" style={{ color: 'var(--role-text-body)' }}>{n.message}</p>
                        </div>
                      ))
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* User Profile + Role Indicator */}
          <div className="hidden lg:flex items-center gap-3 pl-3" style={{ borderLeft: '1px solid var(--role-border-subtle)' }}>
            <div className="text-right">
              <p className="text-xs font-semibold leading-tight" style={{ color: 'var(--role-text-heading)' }}>
                {user?.full_name || 'User'}
              </p>
              <span
                className="inline-flex items-center gap-1 text-[10px] font-bold tracking-wider px-1.5 py-px rounded mt-0.5"
                style={{
                  backgroundColor: 'var(--role-badge-bg)',
                  border: '1px solid var(--role-badge-border)',
                  color: 'var(--role-badge-text)',
                }}
              >
                <ShieldCheck className="w-2.5 h-2.5" />
                {roleLabel}
              </span>
            </div>
            <InitialsAvatar
              name={user?.full_name}
              role={role}
              size={36}
              style={{ boxShadow: '0 0 0 2px var(--role-primary)' }}
            />
          </div>

          {/* Mobile profile initials */}
          <div className="lg:hidden">
            <InitialsAvatar
              name={user?.full_name}
              role={role}
              size={32}
              style={{ boxShadow: '0 0 0 2px var(--role-primary)' }}
            />
          </div>
        </div>
      </header>

      {/* Global Search Overlay Modal */}
      <AnimatePresence>
        {showSearchModal && (
          <div className="fixed inset-0 z-50 flex items-start justify-center pt-16 sm:pt-24 px-4 bg-slate-950/40 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.97, y: -8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.97, y: -8 }}
              transition={{ duration: 0.18 }}
              className="w-full max-w-2xl glass-panel overflow-hidden"
              style={{ boxShadow: 'var(--role-shadow-lg)' }}
            >
              {/* Input Header */}
              <div className="flex items-center gap-3 px-5 py-4" style={{ borderBottom: '1px solid var(--role-border-subtle)' }}>
                <Search className="w-5 h-5" style={{ color: 'var(--role-text-muted)' }} />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Type to search projects, tasks, developers, reports..."
                  className="flex-1 bg-transparent text-sm focus:outline-none"
                  style={{ color: 'var(--role-text-heading)' }}
                  autoFocus
                />
                {isSearching && <Loader2 className="w-4 h-4 animate-spin" style={{ color: 'var(--role-primary)' }} />}
                <button
                  onClick={() => setShowSearchModal(false)}
                  className="p-1 rounded-lg transition-colors hover:bg-[var(--role-bg-subtle)]"
                  style={{ color: 'var(--role-text-muted)' }}
                  aria-label="Close search"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Search Results List */}
              <div className="max-h-96 overflow-y-auto p-4 space-y-2">
                {!searchQuery.trim() ? (
                  <p className="text-xs text-center py-8" style={{ color: 'var(--role-text-muted)' }}>
                    Start typing to search across SprintIQ AI database...
                  </p>
                ) : searchResults.length === 0 && !isSearching ? (
                  <p className="text-xs text-center py-8" style={{ color: 'var(--role-text-muted)' }}>
                    No matching records found for "{searchQuery}".
                  </p>
                ) : (
                  searchResults.map((res) => (
                    <div
                      key={res.id}
                      onClick={() => handleSelectResult(res)}
                      className="p-3.5 rounded-xl text-xs cursor-pointer transition-all duration-150 hover:border-[var(--role-primary)] flex items-center justify-between gap-3"
                      style={{
                        backgroundColor: 'var(--role-bg-muted)',
                        border: '1px solid var(--role-border-subtle)',
                      }}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="p-2 rounded-lg shrink-0" style={{ backgroundColor: 'var(--role-bg-subtle)', color: 'var(--role-text-body)' }}>
                          {res.type === 'PROJECT' && <FolderKanban className="w-4 h-4" style={{ color: 'var(--role-primary)' }} />}
                          {res.type === 'TASK' && <ListTodo className="w-4 h-4" style={{ color: 'var(--role-secondary)' }} />}
                          {(res.type === 'DEVELOPER' || res.type === 'MANAGER') && <Users className="w-4 h-4" style={{ color: 'var(--role-accent)' }} />}
                          {res.type === 'REPORT' && <FileText className="w-4 h-4 text-amber-500" />}
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold truncate text-xs" style={{ color: 'var(--role-text-heading)' }}>{res.title}</p>
                          <p className="text-[11px] truncate" style={{ color: 'var(--role-text-muted)' }}>{res.subtitle}</p>
                        </div>
                      </div>
                      <span className="text-[10px] px-2 py-0.5 rounded font-mono uppercase shrink-0" style={{ backgroundColor: 'var(--role-bg-subtle)', color: 'var(--role-badge-text)' }}>
                        {res.type}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
};