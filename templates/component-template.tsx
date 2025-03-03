import React from 'react';
import { cn } from '@/lib/utils';

interface ComponentNameProps {
  // Define your props here
  className?: string;
  children?: React.ReactNode;
}

export function ComponentName({
  className,
  children,
  ...props
}: ComponentNameProps) {
  return (
    <div className={cn('', className)} {...props}>
      {children}
    </div>
  );
}

/**
 * Usage Instructions:
 * 
 * 1. Copy this template to the appropriate directory:
 *    - ShadCN UI components go to /components/ui/ (lowercase filename)
 *    - App-wide components go to /app/components/ (PascalCase filename)
 *    - Feature-specific components go to /app/[feature]/components/ (PascalCase filename)
 * 
 * 2. Rename ComponentName to your component's name
 * 
 * 3. For ShadCN components, prefer using the CLI command:
 *    npx shadcn@latest add <component-name>
 * 
 * 4. Remove these usage instructions in your actual component
 */ 