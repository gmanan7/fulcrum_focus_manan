import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import apiClient from '@/integrations/api/client';

export type AppRole = 'super_admin' | 'factory_manager' | 'department_head' | 'team_member' | 'shop_floor' | 'task_only';

export interface Profile {
  id: string;
  full_name: string;
  email: string;
  employee_id: string | null;
  designation: string | null;
}

interface AuthContextType {
  user: any | null;
  profile: Profile | null;
  roles: AppRole[];
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  hasRole: (role: AppRole) => boolean;
  hasAnyRole: (...roles: AppRole[]) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<any | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [loading, setLoading] = useState(true);

  const initAuth = async () => {
    try {
      const data = await apiClient.getMe();
      if (data) {
        setUser(data);
        setProfile(data);
        setRoles(data.roles || []);
      }
    } catch {
      setUser(null);
      setProfile(null);
      setRoles([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    initAuth();
  }, []);

  const signIn = async (email: string, password: string) => {
    try {
      const res = await apiClient.login(email, password);
      setUser(res.user);
      setProfile(res.user);
      setRoles(res.user.roles || []);
      return { error: null };
    } catch (err: any) {
      return { error: err.message || 'Login failed' };
    }
  };

  const signOut = async () => {
    await apiClient.logout();
    setUser(null);
    setProfile(null);
    setRoles([]);
  };

  const hasRole = (role: AppRole) => roles.includes(role);
  const hasAnyRole = (...r: AppRole[]) => r.some((role) => roles.includes(role));

  return (
    <AuthContext.Provider value={{ user, profile, roles, loading, signIn, signOut, hasRole, hasAnyRole }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
