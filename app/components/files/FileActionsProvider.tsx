'use client';

import { createContext, useContext, useState, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { FileObject } from '@/contexts/FileContext';
import { FileService } from './FileService';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { FileDeleteModal } from './FileDeleteModal';
import { FileRenameModal } from './FileRenameModal';

interface FileActionsContextType {
  selectedFile: FileObject | null;
  isDeleteModalOpen: boolean;
  isRenameModalOpen: boolean;
  setSelectedFile: (file: FileObject | null) => void;
  openDeleteModal: (file: FileObject) => void;
  closeDeleteModal: () => void;
  openRenameModal: (file: FileObject) => void;
  closeRenameModal: () => void;
  handleDeleteFile: () => Promise<void>;
  handleRenameFile: (newName: string) => Promise<FileObject | undefined>;
  onFileUpdated?: (file: FileObject | undefined) => void;
  setOnFileUpdated: (callback: ((file: FileObject | undefined) => void) | undefined) => void;
}

const FileActionsContext = createContext<FileActionsContextType | undefined>(undefined);

export function FileActionsProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { user } = useAuth();
  const [selectedFile, setSelectedFile] = useState<FileObject | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isRenameModalOpen, setIsRenameModalOpen] = useState(false);
  const [newFileName, setNewFileName] = useState('');
  const [onFileUpdated, setOnFileUpdated] = useState<((file: FileObject | undefined) => void) | undefined>(undefined);

  const openDeleteModal = (file: FileObject) => {
    setSelectedFile(file);
    setIsDeleteModalOpen(true);
  };

  const closeDeleteModal = () => {
    setIsDeleteModalOpen(false);
    setSelectedFile(null);
  };

  const openRenameModal = (file: FileObject) => {
    setSelectedFile(file);
    setNewFileName(file.metadata?.display_name || file.name || file.file_name || '');
    setIsRenameModalOpen(true);
  };

  const closeRenameModal = () => {
    setIsRenameModalOpen(false);
    setSelectedFile(null);
  };

  const handleDeleteFile = async () => {
    if (!selectedFile) return;

    try {
      const success = await FileService.deleteFile(selectedFile.id);
      
      if (success) {
        toast.success('File deleted successfully');
        // Navigate based on context
        if (selectedFile.folder_id) {
          router.push(`/folders/${selectedFile.folder_id}`);
        } else {
          router.push('/dashboard');
        }
      } else {
        toast.error('Failed to delete file');
      }
    } catch (error) {
      console.error('Error deleting file:', error);
      toast.error('An error occurred while deleting the file');
    } finally {
      closeDeleteModal();
    }
  };

  const handleRenameFile = async (newName: string) => {
    if (!selectedFile || !user) return undefined;

    try {
      const updatedFile = await FileService.renameFile(
        selectedFile.id,
        selectedFile,
        newName,
        user.id
      );

      if (updatedFile) {
        if (updatedFile.name !== newName) {
          toast.success(`File display name changed to "${updatedFile.name}"`);
        } else {
          toast.success('File display name updated successfully');
        }
        setSelectedFile(updatedFile);
        closeRenameModal();
        
        // Notify parent components about the file update
        if (onFileUpdated) {
          onFileUpdated(updatedFile);
        }
        
        return updatedFile;
      }
      
      return undefined;
    } catch (error) {
      console.error('Error renaming file:', error);
      toast.error('An error occurred while renaming the file');
      return undefined;
    }
  };

  const value = {
    selectedFile,
    isDeleteModalOpen,
    isRenameModalOpen,
    setSelectedFile,
    openDeleteModal,
    closeDeleteModal,
    openRenameModal,
    closeRenameModal,
    handleDeleteFile,
    handleRenameFile,
    onFileUpdated,
    setOnFileUpdated
  };

  return (
    <FileActionsContext.Provider value={value}>
      {children}
      <FileDeleteModal 
        isOpen={isDeleteModalOpen}
        onOpenChange={setIsDeleteModalOpen}
        file={selectedFile}
        onSuccess={() => {
          // Refresh the current page instead of navigating
          window.location.reload();
        }}
      />
      <FileRenameModal
        isOpen={isRenameModalOpen}
        onOpenChange={setIsRenameModalOpen}
        file={selectedFile}
      />
    </FileActionsContext.Provider>
  );
}

export const useFileActions = () => {
  const context = useContext(FileActionsContext);
  if (context === undefined) {
    throw new Error('useFileActions must be used within a FileActionsProvider');
  }
  return context;
}; 