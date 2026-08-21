import React, { useEffect, useState, useCallback } from 'react';
import { GlassCard } from '../../components/common/GlassCard';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import { Modal } from '../../components/common/Modal';
import { InitialsAvatar } from '../../components/common/InitialsAvatar';
import { userManagementService } from '../../services/api';
import {
    UserPlus, Search, Power, Edit3, KeyRound, Users, Filter,
    AlertCircle, CheckCircle2, Eye, EyeOff, Loader2
} from 'lucide-react';

interface DeveloperAccount {
    id: string;
    full_name: string;
    email: string;
    phone?: string;
    role: string;
    status: string;
    bio?: string;
    avatar_url?: string;
    created_at: string;
}

export const DeveloperAccounts: React.FC = () => {
    const [developers, setDevelopers] = useState<DeveloperAccount[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState<string>('all');

    // Create Modal state
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [createForm, setCreateForm] = useState({ full_name: '', email: '', password: '', confirm_password: '' });
    const [createErrors, setCreateErrors] = useState<Record<string, string>>({});
    const [isCreating, setIsCreating] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);

    // Edit Modal state
    const [isEditOpen, setIsEditOpen] = useState(false);
    const [editTarget, setEditTarget] = useState<DeveloperAccount | null>(null);
    const [editForm, setEditForm] = useState({ full_name: '', email: '', phone: '', bio: '' });
    const [editErrors, setEditErrors] = useState<Record<string, string>>({});
    const [isEditing, setIsEditing] = useState(false);

    // Reset Password Modal state
    const [isResetOpen, setIsResetOpen] = useState(false);
    const [resetTarget, setResetTarget] = useState<DeveloperAccount | null>(null);
    const [resetForm, setResetForm] = useState({ new_password: '', confirm_password: '' });
    const [resetErrors, setResetErrors] = useState<Record<string, string>>({});
    const [isResetting, setIsResetting] = useState(false);

    // Toast
    const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

    const showToast = (type: 'success' | 'error', message: string) => {
        setToast({ type, message });
        setTimeout(() => setToast(null), 4000);
    };

    const loadDevelopers = useCallback(async () => {
        setIsLoading(true);
        try {
            const params: Record<string, string> = {};
            if (searchQuery.trim()) params.search = searchQuery.trim();
            if (statusFilter !== 'all') params.status = statusFilter;
            const data = await userManagementService.getDevelopers(params);
            setDevelopers(data || []);
        } catch (e: any) {
            console.error('Failed to load developers:', e);
        } finally {
            setIsLoading(false);
        }
    }, [searchQuery, statusFilter]);

    useEffect(() => {
        loadDevelopers();
    }, [loadDevelopers]);

    // -- CREATE --
    const openCreateModal = () => {
        setCreateForm({ full_name: '', email: '', password: '', confirm_password: '' });
        setCreateErrors({});
        setShowPassword(false);
        setShowConfirmPassword(false);
        setIsCreateOpen(true);
    };

    const validateCreateForm = (): boolean => {
        const errors: Record<string, string> = {};
        if (!createForm.full_name.trim()) errors.full_name = 'Full name is required.';
        if (!createForm.email.trim()) errors.email = 'Email address is required.';
        else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(createForm.email)) errors.email = 'Please enter a valid email address.';
        if (!createForm.password) errors.password = 'Password is required.';
        else if (createForm.password.length < 8) errors.password = 'Password must be at least 8 characters.';
        if (createForm.password !== createForm.confirm_password) errors.confirm_password = 'Password confirmation does not match.';
        setCreateErrors(errors);
        return Object.keys(errors).length === 0;
    };

    const handleCreate = async () => {
        if (!validateCreateForm()) return;
        setIsCreating(true);
        try {
            await userManagementService.createDeveloper(createForm);
            setIsCreateOpen(false);
            showToast('success', `Developer account for ${createForm.full_name} created successfully.`);
            loadDevelopers();
        } catch (err: any) {
            const detail = err.response?.data?.detail || 'Unable to create developer account. Please try again.';
            setCreateErrors({ _server: detail });
        } finally {
            setIsCreating(false);
        }
    };

    // -- EDIT --
    const openEditModal = (d: DeveloperAccount) => {
        setEditTarget(d);
        setEditForm({ full_name: d.full_name, email: d.email, phone: d.phone || '', bio: d.bio || '' });
        setEditErrors({});
        setIsEditOpen(true);
    };

    const handleEdit = async () => {
        if (!editTarget) return;
        const errors: Record<string, string> = {};
        if (!editForm.full_name.trim()) errors.full_name = 'Full name is required.';
        if (!editForm.email.trim()) errors.email = 'Email is required.';
        setEditErrors(errors);
        if (Object.keys(errors).length > 0) return;

        setIsEditing(true);
        try {
            await userManagementService.updateDeveloper(editTarget.id, editForm);
            setIsEditOpen(false);
            showToast('success', 'Developer account updated successfully.');
            loadDevelopers();
        } catch (err: any) {
            const detail = err.response?.data?.detail || 'Unable to update developer account. Please try again.';
            setEditErrors({ _server: detail });
        } finally {
            setIsEditing(false);
        }
    };

    // -- TOGGLE STATUS --
    const handleToggleStatus = async (d: DeveloperAccount) => {
        const newStatus = d.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
        try {
            await userManagementService.toggleDeveloperStatus(d.id, newStatus);
            showToast('success', `${d.full_name} has been ${newStatus === 'ACTIVE' ? 'enabled' : 'disabled'}.`);
            loadDevelopers();
        } catch (err: any) {
            showToast('error', err.response?.data?.detail || 'Unable to update status. Please try again.');
        }
    };

    // -- RESET PASSWORD --
    const openResetModal = (d: DeveloperAccount) => {
        setResetTarget(d);
        setResetForm({ new_password: '', confirm_password: '' });
        setResetErrors({});
        setIsResetOpen(true);
    };

    const handleResetPassword = async () => {
        if (!resetTarget) return;
        const errors: Record<string, string> = {};
        if (!resetForm.new_password) errors.new_password = 'New password is required.';
        else if (resetForm.new_password.length < 8) errors.new_password = 'Password must be at least 8 characters.';
        if (resetForm.new_password !== resetForm.confirm_password) errors.confirm_password = 'Password confirmation does not match.';
        setResetErrors(errors);
        if (Object.keys(errors).length > 0) return;

        setIsResetting(true);
        try {
            await userManagementService.resetDeveloperPassword(resetTarget.id, resetForm);
            setIsResetOpen(false);
            showToast('success', `Password for ${resetTarget.full_name} has been reset.`);
        } catch (err: any) {
            const detail = err.response?.data?.detail || 'Unable to reset password. Please try again.';
            setResetErrors({ _server: detail });
        } finally {
            setIsResetting(false);
        }
    };

    const activeCount = developers.filter(d => d.status === 'ACTIVE').length;

    return (
        <div className="space-y-6">
            {/* Toast */}
            {toast && (
                <div
                    className={`fixed top-6 right-6 z-[60] flex items-center gap-3 px-5 py-3.5 rounded-xl shadow-2xl text-sm font-medium ${toast.type === 'success'
                            ? 'bg-emerald-600 text-white'
                            : 'bg-rose-600 text-white'
                        }`}
                    style={{ animation: 'slideInRight 0.3s ease-out' }}
                >
                    {toast.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
                    {toast.message}
                </div>
            )}

            {/* Page Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-extrabold tracking-tight" style={{ color: 'var(--role-text-heading)' }}>
                        Developer Accounts
                    </h1>
                    <p className="text-xs mt-1" style={{ color: 'var(--role-text-muted)' }}>
                        Create and manage Developer accounts for your team
                    </p>
                </div>
                <Button variant="manager" icon={<UserPlus className="w-4 h-4" />} onClick={openCreateModal}>
                    Create Developer
                </Button>
            </div>

            {/* Search + Filter Bar */}
            <GlassCard>
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                    <div className="relative flex-1 w-full">
                        <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--role-text-muted)' }} />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Search developers by name or email..."
                            className="w-full pl-10 pr-4 py-2.5 rounded-xl text-xs focus:outline-none role-input"
                            style={{ color: 'var(--role-text-heading)' }}
                        />
                    </div>
                    <div className="flex items-center gap-2">
                        <Filter className="w-4 h-4" style={{ color: 'var(--role-text-muted)' }} />
                        <select
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                            className="px-3 py-2 rounded-xl text-xs focus:outline-none role-input"
                            style={{ color: 'var(--role-text-heading)' }}
                        >
                            <option value="all">All Status</option>
                            <option value="ACTIVE">Active</option>
                            <option value="INACTIVE">Inactive</option>
                        </select>
                    </div>
                    <div className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold"
                        style={{ backgroundColor: 'var(--role-badge-bg)', border: '1px solid var(--role-badge-border)', color: 'var(--role-badge-text)' }}>
                        <Users className="w-3.5 h-3.5" />
                        {developers.length} developer{developers.length !== 1 ? 's' : ''} · {activeCount} active
                    </div>
                </div>
            </GlassCard>

            {/* Developer Table */}
            <GlassCard>
                <div className="overflow-x-auto">
                    <div className="max-h-[520px] overflow-y-auto">
                        <table className="w-full text-left text-xs">
                            <thead className="sticky top-0 z-10" style={{ background: 'var(--role-surface)' }}>
                                <tr style={{ borderBottom: '1px solid var(--role-border)' }}>
                                    <th className="py-3.5 px-4 font-semibold uppercase text-[10px] tracking-wider" style={{ color: 'var(--role-text-muted)' }}>Name</th>
                                    <th className="py-3.5 px-4 font-semibold uppercase text-[10px] tracking-wider" style={{ color: 'var(--role-text-muted)' }}>Email</th>
                                    <th className="py-3.5 px-4 font-semibold uppercase text-[10px] tracking-wider" style={{ color: 'var(--role-text-muted)' }}>Role</th>
                                    <th className="py-3.5 px-4 font-semibold uppercase text-[10px] tracking-wider" style={{ color: 'var(--role-text-muted)' }}>Status</th>
                                    <th className="py-3.5 px-4 font-semibold uppercase text-[10px] tracking-wider" style={{ color: 'var(--role-text-muted)' }}>Created Date</th>
                                    <th className="py-3.5 px-4 font-semibold uppercase text-[10px] tracking-wider text-right" style={{ color: 'var(--role-text-muted)' }}>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {isLoading ? (
                                    <tr>
                                        <td colSpan={6} className="py-16 text-center">
                                            <div className="flex flex-col items-center gap-2">
                                                <Loader2 className="w-6 h-6 animate-spin" style={{ color: 'var(--role-primary)' }} />
                                                <span className="text-xs" style={{ color: 'var(--role-text-muted)' }}>Loading developers...</span>
                                            </div>
                                        </td>
                                    </tr>
                                ) : developers.length === 0 ? (
                                    <tr>
                                        <td colSpan={6} className="py-16 text-center">
                                            <div className="flex flex-col items-center gap-2">
                                                <Users className="w-8 h-8" style={{ color: 'var(--role-text-muted)', opacity: 0.4 }} />
                                                <span className="text-sm font-medium" style={{ color: 'var(--role-text-muted)' }}>No developers found</span>
                                                <span className="text-xs" style={{ color: 'var(--role-text-muted)', opacity: 0.7 }}>
                                                    {searchQuery ? 'Try a different search term.' : 'Click "Create Developer" to add a new Developer.'}
                                                </span>
                                            </div>
                                        </td>
                                    </tr>
                                ) : (
                                    developers.map((d) => (
                                        <tr key={d.id} className="transition-colors hover:bg-[rgba(var(--role-primary-rgb),0.03)]"
                                            style={{ borderBottom: '1px solid var(--role-border-subtle)' }}>
                                            <td className="py-4 px-4">
                                                <div className="flex items-center gap-3">
                                                    <InitialsAvatar name={d.full_name} role="developer" size={34} className="ring-2 ring-slate-200" />
                                                    <span className="font-semibold" style={{ color: 'var(--role-text-heading)' }}>{d.full_name}</span>
                                                </div>
                                            </td>
                                            <td className="py-4 px-4 font-mono" style={{ color: 'var(--role-text-muted)' }}>{d.email}</td>
                                            <td className="py-4 px-4"><Badge variant="developer">DEVELOPER</Badge></td>
                                            <td className="py-4 px-4">
                                                <Badge variant={d.status === 'ACTIVE' ? 'healthy' : 'critical'}>{d.status}</Badge>
                                            </td>
                                            <td className="py-4 px-4" style={{ color: 'var(--role-text-muted)' }}>
                                                {new Date(d.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
                                            </td>
                                            <td className="py-4 px-4 text-right">
                                                <div className="flex items-center justify-end gap-1">
                                                    <button onClick={() => openEditModal(d)} className="p-2 rounded-lg transition-colors hover:bg-[rgba(var(--role-primary-rgb),0.10)]" title="Edit">
                                                        <Edit3 className="w-4 h-4" style={{ color: 'var(--role-primary)' }} />
                                                    </button>
                                                    <button onClick={() => handleToggleStatus(d)}
                                                        className={`p-2 rounded-lg transition-colors ${d.status === 'ACTIVE' ? 'hover:bg-rose-50 text-rose-500' : 'hover:bg-emerald-50 text-emerald-500'}`}
                                                        title={d.status === 'ACTIVE' ? 'Disable' : 'Enable'}>
                                                        <Power className="w-4 h-4" />
                                                    </button>
                                                    <button onClick={() => openResetModal(d)} className="p-2 rounded-lg transition-colors hover:bg-amber-50 text-amber-600" title="Reset Password">
                                                        <KeyRound className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </GlassCard>

            {/* CREATE DEVELOPER MODAL */}
            <Modal isOpen={isCreateOpen} onClose={() => setIsCreateOpen(false)} title="Create Developer" maxWidth="max-w-lg" footer={
                <>
                    <Button variant="outline" onClick={() => setIsCreateOpen(false)} disabled={isCreating}>Cancel</Button>
                    <Button variant="manager" onClick={handleCreate} isLoading={isCreating} icon={<UserPlus className="w-4 h-4" />}>
                        Create Developer
                    </Button>
                </>
            }>
                <div className="space-y-4">
                    {createErrors._server && (
                        <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs">
                            <AlertCircle className="w-4 h-4 shrink-0" />
                            {createErrors._server}
                        </div>
                    )}

                    <div className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium"
                        style={{ backgroundColor: 'var(--role-badge-bg)', border: '1px solid var(--role-badge-border)', color: 'var(--role-badge-text)' }}>
                        Role: <span className="font-bold">DEVELOPER</span> · Status: <span className="font-bold">ACTIVE</span>
                    </div>

                    <div>
                        <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--role-text-muted)' }}>Full Name *</label>
                        <input
                            type="text"
                            value={createForm.full_name}
                            onChange={(e) => setCreateForm(f => ({ ...f, full_name: e.target.value }))}
                            placeholder="e.g. Michael Chen"
                            className={`w-full px-4 py-2.5 rounded-xl text-xs focus:outline-none role-input ${createErrors.full_name ? 'border-rose-400' : ''}`}
                            style={{ color: 'var(--role-text-heading)' }}
                        />
                        {createErrors.full_name && <p className="text-[11px] text-rose-500 mt-1">{createErrors.full_name}</p>}
                    </div>

                    <div>
                        <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--role-text-muted)' }}>Email Address *</label>
                        <input
                            type="email"
                            value={createForm.email}
                            onChange={(e) => setCreateForm(f => ({ ...f, email: e.target.value }))}
                            placeholder="e.g. michael.chen@sprintiq.ai"
                            className={`w-full px-4 py-2.5 rounded-xl text-xs focus:outline-none role-input ${createErrors.email ? 'border-rose-400' : ''}`}
                            style={{ color: 'var(--role-text-heading)' }}
                        />
                        {createErrors.email && <p className="text-[11px] text-rose-500 mt-1">{createErrors.email}</p>}
                    </div>

                    <div>
                        <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--role-text-muted)' }}>Password *</label>
                        <div className="relative">
                            <input
                                type={showPassword ? 'text' : 'password'}
                                value={createForm.password}
                                onChange={(e) => setCreateForm(f => ({ ...f, password: e.target.value }))}
                                placeholder="Min 8 characters, uppercase, lowercase, number"
                                className={`w-full px-4 py-2.5 pr-10 rounded-xl text-xs focus:outline-none role-input ${createErrors.password ? 'border-rose-400' : ''}`}
                                style={{ color: 'var(--role-text-heading)' }}
                            />
                            <button type="button" onClick={() => setShowPassword(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--role-text-muted)' }}>
                                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                        </div>
                        {createErrors.password && <p className="text-[11px] text-rose-500 mt-1">{createErrors.password}</p>}
                    </div>

                    <div>
                        <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--role-text-muted)' }}>Confirm Password *</label>
                        <div className="relative">
                            <input
                                type={showConfirmPassword ? 'text' : 'password'}
                                value={createForm.confirm_password}
                                onChange={(e) => setCreateForm(f => ({ ...f, confirm_password: e.target.value }))}
                                placeholder="Re-enter the password"
                                className={`w-full px-4 py-2.5 pr-10 rounded-xl text-xs focus:outline-none role-input ${createErrors.confirm_password ? 'border-rose-400' : ''}`}
                                style={{ color: 'var(--role-text-heading)' }}
                            />
                            <button type="button" onClick={() => setShowConfirmPassword(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--role-text-muted)' }}>
                                {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                        </div>
                        {createErrors.confirm_password && <p className="text-[11px] text-rose-500 mt-1">{createErrors.confirm_password}</p>}
                    </div>
                </div>
            </Modal>

            {/* EDIT DEVELOPER MODAL */}
            <Modal isOpen={isEditOpen} onClose={() => setIsEditOpen(false)} title="Edit Developer" maxWidth="max-w-lg" footer={
                <>
                    <Button variant="outline" onClick={() => setIsEditOpen(false)} disabled={isEditing}>Cancel</Button>
                    <Button variant="manager" onClick={handleEdit} isLoading={isEditing}>Save Changes</Button>
                </>
            }>
                <div className="space-y-4">
                    {editErrors._server && (
                        <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs">
                            <AlertCircle className="w-4 h-4 shrink-0" />
                            {editErrors._server}
                        </div>
                    )}
                    <div>
                        <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--role-text-muted)' }}>Full Name *</label>
                        <input type="text" value={editForm.full_name}
                            onChange={(e) => setEditForm(f => ({ ...f, full_name: e.target.value }))}
                            className={`w-full px-4 py-2.5 rounded-xl text-xs focus:outline-none role-input ${editErrors.full_name ? 'border-rose-400' : ''}`}
                            style={{ color: 'var(--role-text-heading)' }} />
                        {editErrors.full_name && <p className="text-[11px] text-rose-500 mt-1">{editErrors.full_name}</p>}
                    </div>
                    <div>
                        <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--role-text-muted)' }}>Email *</label>
                        <input type="email" value={editForm.email}
                            onChange={(e) => setEditForm(f => ({ ...f, email: e.target.value }))}
                            className={`w-full px-4 py-2.5 rounded-xl text-xs focus:outline-none role-input ${editErrors.email ? 'border-rose-400' : ''}`}
                            style={{ color: 'var(--role-text-heading)' }} />
                        {editErrors.email && <p className="text-[11px] text-rose-500 mt-1">{editErrors.email}</p>}
                    </div>
                    <div>
                        <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--role-text-muted)' }}>Phone</label>
                        <input type="text" value={editForm.phone}
                            onChange={(e) => setEditForm(f => ({ ...f, phone: e.target.value }))}
                            className="w-full px-4 py-2.5 rounded-xl text-xs focus:outline-none role-input"
                            style={{ color: 'var(--role-text-heading)' }} />
                    </div>
                    <div>
                        <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--role-text-muted)' }}>Bio</label>
                        <textarea value={editForm.bio}
                            onChange={(e) => setEditForm(f => ({ ...f, bio: e.target.value }))}
                            rows={3}
                            className="w-full px-4 py-2.5 rounded-xl text-xs focus:outline-none role-input resize-none"
                            style={{ color: 'var(--role-text-heading)' }} />
                    </div>
                </div>
            </Modal>

            {/* RESET PASSWORD MODAL */}
            <Modal isOpen={isResetOpen} onClose={() => setIsResetOpen(false)} title={`Reset Password — ${resetTarget?.full_name || ''}`} maxWidth="max-w-lg" footer={
                <>
                    <Button variant="outline" onClick={() => setIsResetOpen(false)} disabled={isResetting}>Cancel</Button>
                    <Button variant="manager" onClick={handleResetPassword} isLoading={isResetting} icon={<KeyRound className="w-4 h-4" />}>
                        Reset Password
                    </Button>
                </>
            }>
                <div className="space-y-4">
                    {resetErrors._server && (
                        <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs">
                            <AlertCircle className="w-4 h-4 shrink-0" />
                            {resetErrors._server}
                        </div>
                    )}
                    <div>
                        <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--role-text-muted)' }}>New Password *</label>
                        <input type="password" value={resetForm.new_password}
                            onChange={(e) => setResetForm(f => ({ ...f, new_password: e.target.value }))}
                            placeholder="Min 8 characters"
                            className={`w-full px-4 py-2.5 rounded-xl text-xs focus:outline-none role-input ${resetErrors.new_password ? 'border-rose-400' : ''}`}
                            style={{ color: 'var(--role-text-heading)' }} />
                        {resetErrors.new_password && <p className="text-[11px] text-rose-500 mt-1">{resetErrors.new_password}</p>}
                    </div>
                    <div>
                        <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--role-text-muted)' }}>Confirm Password *</label>
                        <input type="password" value={resetForm.confirm_password}
                            onChange={(e) => setResetForm(f => ({ ...f, confirm_password: e.target.value }))}
                            placeholder="Re-enter the new password"
                            className={`w-full px-4 py-2.5 rounded-xl text-xs focus:outline-none role-input ${resetErrors.confirm_password ? 'border-rose-400' : ''}`}
                            style={{ color: 'var(--role-text-heading)' }} />
                        {resetErrors.confirm_password && <p className="text-[11px] text-rose-500 mt-1">{resetErrors.confirm_password}</p>}
                    </div>
                </div>
            </Modal>
        </div>
    );
};
