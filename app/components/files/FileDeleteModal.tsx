'use client';

import { useState } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from 'sonner';
import { FileObject } from '@/contexts/FileContext';
import { FileService } from './FileService';

interface FileDeleteModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  file: FileObject | null;
  onSuccess?: () => void;
}

export function FileDeleteModal({ isOpen, onOpenChange, file, onSuccess }: FileDeleteModalProps) {
  const [isDeleting, setIsDeleting] = useState(false);
  
  const handleDelete = async () => {
    if (!file) return;
    
    setIsDeleting(true);
    
    try {
      const success = await FileService.deleteFile(file.id);
      
      if (success) {
        toast.success('File deleted successfully');
        if (onSuccess) onSuccess();
      } else {
        toast.error('Failed to delete file');
      }
    } catch (error) {
      console.error('Error deleting file:', error);
      toast.error('An error occurred while deleting the file');
    } finally {
      setIsDeleting(false);
      onOpenChange(false);
    }
  };
  
  return (
    <AlertDialog open={isOpen} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete File</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to delete the file &quot;{file?.name || file?.file_name}&quot;? This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
          <AlertDialogAction 
            onClick={(e) => {
              e.preventDefault();
              handleDelete();
            }}
            disabled={isDeleting}
          >
            {isDeleting ? 'Deleting...' : 'Delete'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
} 