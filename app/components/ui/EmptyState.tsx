import { ReactNode } from 'react';
import { FileAudio, Search } from 'lucide-react';

interface EmptyStateProps {
  title: string;
  description?: string;
  icon?: ReactNode;
  action?: ReactNode;
  type?: 'default' | 'search' | 'audio';
}

export function EmptyState({ 
  title, 
  description, 
  icon, 
  action,
  type = 'default'
}: EmptyStateProps) {
  
  // Determine the icon based on type if one isn't provided
  const getIcon = (): ReactNode => {
    if (icon) return icon;
    
    switch (type) {
      case 'search':
        return <Search className="h-12 w-12 text-gray-400 dark:text-gray-500" />;
      case 'audio':
        return <FileAudio className="h-12 w-12 text-gray-400 dark:text-gray-500" />;
      default:
        return (
          <div className="h-12 w-12 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
            <span className="text-gray-400 dark:text-gray-500 text-xl">?</span>
          </div>
        );
    }
  };
  
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="mb-4">{getIcon()}</div>
      
      <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-1">
        {title}
      </h3>
      
      {description && (
        <p className="text-sm text-gray-500 dark:text-gray-400 max-w-md mb-6">
          {description}
        </p>
      )}
      
      {action && action}
    </div>
  );
} 