'use client';

import { AuthProvider } from '../../../contexts/AuthContext';

interface ClientLayoutProps {
  children: React.ReactNode;
}

export function ClientLayout({ children }: ClientLayoutProps) {
  return <AuthProvider>{children}</AuthProvider>;
} 