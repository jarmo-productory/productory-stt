/**
 * Utility function to conditionally join class names
 */
export function cn(...classes: (string | undefined | null | false | 0)[]) {
  return classes.filter(Boolean).join(' ');
} 