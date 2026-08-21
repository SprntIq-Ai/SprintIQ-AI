import React from 'react';
import { UserCheck } from 'lucide-react';
import { authService } from '../../services/api';
import { RoleLogin, RoleLoginConfig } from './RoleLogin';

const config: RoleLoginConfig = {
  role: 'manager',
  title: 'Project Manager Portal',
  subtitle: 'Sprint Management & Team Intelligence Workspace',
  icon: <UserCheck className="w-8 h-8 text-white" />,
  emailLabel: 'Manager Email Address',
  loginLabel: 'Authenticate Manager Login',
  defaultEmail: 'manager@sprintiq.ai',
  defaultPassword: 'Manager@123',
  loginFn: authService.login,
  redirectPath: '/manager/dashboard',
  variant: 'manager',
  portalLinks: [
    { to: '/login/admin', label: 'Admin Portal' },
    { to: '/login/developer', label: 'Developer Portal' },
  ],
  forgotColor: 'text-[var(--role-action)]',
  iconGradient: 'linear-gradient(135deg, var(--role-primary), var(--role-action))',
};

export const ManagerLogin: React.FC = () => <RoleLogin {...config} />;