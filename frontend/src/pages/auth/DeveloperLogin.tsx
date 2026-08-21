import React from 'react';
import { Code2 } from 'lucide-react';
import { authService } from '../../services/api';
import { RoleLogin, RoleLoginConfig } from './RoleLogin';

const config: RoleLoginConfig = {
  role: 'developer',
  title: 'Developer Task Engine',
  subtitle: 'Sprint Tasks Execution & Progress Workbench',
  icon: <Code2 className="w-8 h-8 text-white" />,
  emailLabel: 'Developer Email Address',
  loginLabel: 'Authenticate Developer Login',
  defaultEmail: 'dev@sprintiq.ai',
  defaultPassword: 'Dev@123',
  loginFn: authService.login,
  redirectPath: '/developer/dashboard',
  variant: 'developer',
  portalLinks: [
    { to: '/login/admin', label: 'Admin Portal' },
    { to: '/login/manager', label: 'Manager Portal' },
  ],
  forgotColor: 'text-[var(--role-secondary)]',
  iconGradient: 'linear-gradient(135deg, var(--role-login-gradient-from), var(--role-login-gradient-to))',
};

export const DeveloperLogin: React.FC = () => <RoleLogin {...config} />;