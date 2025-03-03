'use client';

import { useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { usePathname } from 'next/navigation';
import { Loader2 } from 'lucide-react';

/**
 * Simple protected route component that only shows a loading state
 * during authentication. The actual protection logic is handled by middleware.
 */
export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isLoading } = useAuth();
  const pathname = usePathname();
  
  // Public routes that don't require authentication
  const publicRoutes = [
    '/',
    '/login',
    '/signup',
    '/verify-email',
    '/reset-password',
    '/update-password',
    '/auth/callback'
  ];
  
  // Only show loading indicator for protected routes
  if (isLoading && !publicRoutes.includes(pathname)) {
    return (
      <div className="min-h-screen flex flex-col space-y-4 items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <div className="text-foreground">Loading...</div>
      </div>
    );
  }

  // Render children for all routes
  return <>{children}</>;
} 