import { Loader2 } from 'lucide-react';

export type SpinnerSize = 'sm' | 'md' | 'lg';

interface LoadingSpinnerProps {
  size?: SpinnerSize;
  className?: string;
  message?: string;
  fullScreen?: boolean;
}

export function LoadingSpinner({ 
  size = 'md', 
  className = '', 
  message, 
  fullScreen = false 
}: LoadingSpinnerProps) {
  
  // Map size to appropriate classes
  const sizeClassMap: Record<SpinnerSize, string> = {
    sm: 'h-4 w-4',
    md: 'h-8 w-8',
    lg: 'h-12 w-12'
  };
  
  const spinnerElement = (
    <div className={`flex flex-col items-center justify-center ${fullScreen ? 'h-full w-full min-h-[200px]' : ''}`}>
      <Loader2 className={`animate-spin text-primary dark:text-primary-light ${sizeClassMap[size]} ${className}`} />
      {message && (
        <p className="mt-4 text-sm text-gray-500 dark:text-gray-400">{message}</p>
      )}
    </div>
  );
  
  // If fullScreen is true, wrap the spinner in a full-screen container
  if (fullScreen) {
    return (
      <div className="fixed inset-0 bg-white/80 dark:bg-gray-900/80 flex items-center justify-center z-50">
        {spinnerElement}
      </div>
    );
  }
  
  return spinnerElement;
} 