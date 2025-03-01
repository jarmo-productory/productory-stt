import { ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Check, 
  X, 
  AlertCircle,
  Info
} from 'lucide-react';

export type NotificationType = 'success' | 'error' | 'info';

interface NotificationProps {
  show: boolean;
  type: NotificationType;
  message: string;
  onClose: () => void;
  autoClose?: boolean;
  autoCloseTime?: number;
}

export function Notification({ 
  show, 
  type, 
  message, 
  onClose, 
  autoClose = true,
  autoCloseTime = 5000 
}: NotificationProps) {
  
  // Set up auto-close effect
  if (show && autoClose) {
    setTimeout(() => {
      onClose();
    }, autoCloseTime);
  }
  
  // Determine icon and styles based on notification type
  const getNotificationStyles = (): { icon: ReactNode; classes: string } => {
    switch (type) {
      case 'success':
        return {
          icon: <Check className="h-5 w-5 text-green-500 dark:text-green-400 mr-3" />,
          classes: 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-900/30 text-green-800 dark:text-green-300'
        };
      case 'error':
        return {
          icon: <AlertCircle className="h-5 w-5 text-red-500 dark:text-red-400 mr-3" />,
          classes: 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-900/30 text-red-800 dark:text-red-300'
        };
      case 'info':
        return {
          icon: <Info className="h-5 w-5 text-blue-500 dark:text-blue-400 mr-3" />,
          classes: 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-900/30 text-blue-800 dark:text-blue-300'
        };
      default:
        return {
          icon: <Info className="h-5 w-5 text-gray-500 dark:text-gray-400 mr-3" />,
          classes: 'bg-gray-50 dark:bg-gray-900/20 border-gray-200 dark:border-gray-900/30 text-gray-800 dark:text-gray-300'
        };
    }
  };
  
  const { icon, classes } = getNotificationStyles();
  
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.2 }}
          className={`mb-4 p-4 border rounded-lg flex items-center ${classes}`}
        >
          {icon}
          <p className="text-sm flex-1">{message}</p>
          <button
            onClick={onClose}
            className="p-1 hover:bg-white/20 dark:hover:bg-black/20 rounded-full transition-colors"
            aria-label="Close notification"
          >
            <X className="h-4 w-4" />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
} 