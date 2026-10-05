import React, { createContext, useContext, useState, useEffect } from 'react';
import { RoleCode, Permission, UserDto } from '@workdesk/shared';

interface AuthContextType {
  user: UserDto | null;
  permissions: Permission[];
  isLoading: boolean;
  login: (email: string, fullName: string, roleCode?: RoleCode) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  hasPermission: (permission: Permission) => boolean;
  hasRole: (role: RoleCode) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserDto | null>(null);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchCurrentUser = async () => {
    try {
      const res = await fetch('/api/v1/auth/me');
      if (res.ok) {
        const data = await res.json();
        setUser(data.user);
        setPermissions(data.permissions || []);
      } else {
        setUser(null);
        setPermissions([]);
      }
    } catch {
      setUser(null);
      setPermissions([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCurrentUser();
  }, []);

  const login = async (email: string, fullName: string, roleCode?: RoleCode) => {
    const res = await fetch('/api/v1/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, fullName, roleCode }),
    });

    const text = await res.text();
    let data: any = {};
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      data = { message: text || `HTTP ${res.status} ${res.statusText}` };
    }

    if (!res.ok) {
      throw new Error(data.message || 'Login failed');
    }

    setUser(data.user);
    setPermissions(data.permissions || []);
  };


  const logout = async () => {
    try {
      await fetch('/api/v1/auth/logout', { method: 'POST' });
    } finally {
      setUser(null);
      setPermissions([]);
    }
  };

  const hasPermission = (permission: Permission) => permissions.includes(permission);
  const hasRole = (role: RoleCode) => user?.roleCode === role;

  return (
    <AuthContext.Provider
      value={{
        user,
        permissions,
        isLoading,
        login,
        logout,
        refreshUser: fetchCurrentUser,
        hasPermission,
        hasRole,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};
