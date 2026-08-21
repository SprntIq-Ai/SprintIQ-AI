import React from 'react';
import { ShieldCheck } from 'lucide-react';
import { authService } from '../../services/api';
import { RoleLogin, RoleLoginConfig } from './RoleLogin';

const config: RoleLoginConfig = {
  role: 'admin',
  title: 'Admin Governance Portal',
  subtitle: 'System Administration & Executive Project Intelligence',
  icon: <ShieldCheck className="w-8 h-8 text-white" />,
  emailLabel: 'Admin Email Address',
  loginLabel: 'Authenticate Admin Login',
  defaultEmail: 'admin@sprintiq.ai',
  defaultPassword: 'Admin@123',
  loginFn: authService.login,
  redirectPath: '/admin/dashboard',
  variant: 'admin',
  portalLinks: [
    { to: '/login/manager', label: 'Manager Portal' },
    { to: '/login/developer', label: 'Developer Portal' },
  ],
  forgotColor: 'text-[var(--role-secondary)]',
  iconGradient: 'linear-gradient(135deg, var(--role-login-gradient-from), var(--role-login-gradient-to))',
};

export const AdminLogin: React.FC = () => <RoleLogin {...config} />;