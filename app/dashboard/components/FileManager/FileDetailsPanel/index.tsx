'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, FileAudio, Calendar, Clock, HardDrive, FileType, AlertCircle } from 'lucide-react';
import { formatFileSize } from '../../utils/fileHelpers';
import FileInfo from './FileInfo';
import FileActions from './FileActions';
import AudioPreview from './AudioPreview';

// Define the FileObject interface (should match the one in FileManager)
interface FileObject {
  id: string;
  name: string;         // Display name (original filename)
  storage_name?: string; // Name in storage (formatted filename)
  size: number;
  created_at: string;
  duration?: number; // Audio duration in seconds
  status?: 'ready' | 'processing' | 'error' | 'transcribed'; // File processing status
  metadata?: {
    [key: string]: any;
  };
}

interface FileDetailsPanelProps {
  file: FileObject | null;
  onClose: () => void;
  onDelete: (file: FileObject) => void;
  onRename: (file: FileObject, newName: string) => Promise<boolean>;
}

export default function FileDetailsPanel({ 
  file, 
  onClose, 
  onDelete,
  onRename
}: FileDetailsPanelProps) {
  const [isVisible, setIsVisible] = useState(false);

  // Handle escape key to close panel
  useEffect(() => {
    const handleEscKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        handleClose();
      }
    };

    if (file) {
      document.addEventListener('keydown', handleEscKey);
      // Set visible after a small delay to ensure animation works
      const timer = setTimeout(() => setIsVisible(true), 10);
      return () => {
        document.removeEventListener('keydown', handleEscKey);
        clearTimeout(timer);
      };
    }
    return undefined;
  }, [file]);

  // Handle close with animation
  const handleClose = () => {
    setIsVisible(false);
    // Wait for animation to complete before calling onClose
    setTimeout(() => {
      onClose();
    }, 300); // Match this with animation duration
  };

  // Handle file rename
  const handleRename = async (newName: string): Promise<boolean> => {
    if (!file) return false;
    return await onRename(file, newName);
  };

  if (!file) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <div 
        className={`absolute inset-0 bg-black transition-opacity duration-300 ${
          isVisible ? 'bg-opacity-50' : 'bg-opacity-0'
        }`}
        onClick={handleClose}
      />
      
      {/* Panel */}
      <div className="absolute inset-y-0 right-0 max-w-full flex">
        <motion.div 
          className="relative w-screen max-w-md"
          initial={{ x: '100%' }}
          animate={{ x: isVisible ? 0 : '100%' }}
          transition={{ duration: 0.3, ease: 'easeInOut' }}
        >
          <div className="h-full flex flex-col bg-white dark:bg-gray-800 shadow-xl overflow-y-auto">
            {/* Header */}
            <div className="px-4 py-6 sm:px-6 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-start justify-between">
                <h2 className="text-lg font-medium text-gray-900 dark:text-gray-100">
                  File Details
                </h2>
                <button
                  type="button"
                  className="rounded-md text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  onClick={handleClose}
                >
                  <span className="sr-only">Close panel</span>
                  <X className="h-6 w-6" aria-hidden="true" />
                </button>
              </div>
            </div>
            
            {/* Content */}
            <div className="relative flex-1 px-4 sm:px-6">
              <div className="py-6">
                {/* File Info Component */}
                <FileInfo file={file} onRename={handleRename} />
                
                {/* Divider */}
                <div className="my-6 border-t border-gray-200 dark:border-gray-700" />
                
                {/* Audio Preview Component */}
                <AudioPreview file={file} />
                
                {/* Divider */}
                <div className="my-6 border-t border-gray-200 dark:border-gray-700" />
                
                {/* File Actions Component */}
                <FileActions 
                  file={file} 
                  onDelete={() => onDelete(file)} 
                />
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
} 