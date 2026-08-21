import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, RoleType } from '../types';
import { authService } from '../services/api';

interface AuthContextType {
  user: User | null;
  role: RoleType | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (accessToken: string, refreshToken: string, userData: User) => void;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('sprintiq_user');
    return saved ? JSON.parse(saved) : null;
  });
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const role: RoleType | null = user ? user.role : null;

  // Theme class management is handled by ThemeContext/ThemeProvider

  useEffect(() => {
    const initAuth = async () => {
      const token = localStorage.getItem('sprintiq_access_token');
      if (token) {
        try {
          const fetchedUser = await authService.getMe();
          setUser(fetchedUser);
          localStorage.setItem('sprintiq_user', JSON.stringify(fetchedUser));
        } catch (e) {
          console.error("Session verification failed:", e);
        }
      }
      setIsLoading(false);
    };
    initAuth();
  }, []);

  const login = (accessToken: string, refreshToken: string, userData: User) => {
    localStorage.setItem('sprintiq_access_token', accessToken);
    localStorage.setItem('sprintiq_refresh_token', refreshToken);
    localStorage.setItem('sprintiq_user', JSON.stringify(userData));
    setUser(userData);
  };

  const logout = () => {
    localStorage.removeItem('sprintiq_access_token');
    localStorage.removeItem('sprintiq_refresh_token');
    localStorage.removeItem('sprintiq_user');
    setUser(null);
  };

  const refreshUser = async () => {
    try {
      const updated = await authService.getMe();
      setUser(updated);
      localStorage.setItem('sprintiq_user', JSON.stringify(updated));
    } catch (e) {
      console.error("Refresh user failed", e);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        role,
        isAuthenticated: !!user,
        isLoading,
        login,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
