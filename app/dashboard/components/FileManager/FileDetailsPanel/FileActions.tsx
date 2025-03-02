'use client';

import { useState } from 'react';
import { Trash2, Loader2 } from 'lucide-react';

// Define the FileObject interface (should match the one in FileManager)
interface FileObject {
  id: string;
  name: string;
  size: number;
  created_at: string;
  duration?: number; // Audio duration in seconds
  status?: 'ready' | 'processing' | 'error' | 'transcribed'; // File processing status
  metadata?: {
    [key: string]: any;
  };
}

interface FileActionsProps {
  file: FileObject;
  onDelete: () => void;
}

export default function FileActions({ file, onDelete }: FileActionsProps) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Handle delete confirmation
  const handleDeleteConfirm = () => {
    setShowDeleteConfirm(true);
  };

  // Execute delete
  const handleDeleteExecute = () => {
    setIsDeleting(true);
    onDelete();
    // We don't set isDeleting back to false because the panel will be closed after deletion
  };

  // Cancel delete
  const handleDeleteCancel = () => {
    setShowDeleteConfirm(false);
  };

  return (
    <div>
      <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">
        File Actions
      </h3>

      {showDeleteConfirm ? (
        <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900/30 rounded-md">
          <p className="text-sm text-red-800 dark:text-red-300 mb-3">
            Are you sure you want to delete this file? This action cannot be undone.
          </p>
          <div className="flex justify-end space-x-2">
            <button
              onClick={handleDeleteCancel}
              disabled={isDeleting}
              className="px-3 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded-md text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              Cancel
            </button>
            <button
              onClick={handleDeleteExecute}
              disabled={isDeleting}
              className="px-3 py-1 text-xs bg-red-600 hover:bg-red-700 text-white rounded-md flex items-center"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                  Deleting...
                </>
              ) : (
                'Delete'
              )}
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={handleDeleteConfirm}
          className="w-full flex items-center justify-center px-4 py-2 border border-red-300 dark:border-red-800 shadow-sm text-sm font-medium rounded-md text-red-700 dark:text-red-400 bg-white dark:bg-gray-800 hover:bg-red-50 dark:hover:bg-red-900/20 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
        >
          <Trash2 className="h-4 w-4 mr-2" />
          Delete File
        </button>
      )}
    </div>
  );
} 