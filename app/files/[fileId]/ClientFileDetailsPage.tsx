'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { AppLayout } from "@/app/components/layout/AppLayout";
import { Breadcrumbs } from "@/app/components/layout/Breadcrumbs";
import { PageHeader } from "@/app/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  ChevronLeft, 
  MoreHorizontal, 
  Pencil, 
  Trash2, 
  Check, 
  X, 
  Download,
  FileAudio
} from "lucide-react";
import Link from "next/link";
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
import { OverviewColumn } from './components/OverviewColumn';
import { TranscriptionColumn } from './components/TranscriptionColumn';
import { FileObject } from "@/contexts/FileContext";
import { useAuth } from "@/contexts/AuthContext";
import { FileService } from "@/app/components/files";

interface ClientFileDetailsPageProps {
  fileId: string;
}

export default function ClientFileDetailsPage({ fileId }: ClientFileDetailsPageProps) {
  const [fileName, setFileName] = useState("Loading...");
  const [isEditing, setIsEditing] = useState(false);
  const [editedName, setEditedName] = useState("");
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [folderName, setFolderName] = useState("");
  const [folderId, setFolderId] = useState<string | null>(null);
  const [fileData, setFileData] = useState<FileObject | null>(null);
  const router = useRouter();
  const { user } = useAuth();
  
  // Fetch the file details
  useEffect(() => {
    const loadFileDetails = async () => {
      const { fileData, folderName, folderId } = await FileService.fetchFileDetails(fileId);
      
      if (fileData) {
        // Check if the file is deleted
        if (fileData.status === 'deleted') {
          // Redirect to the folder or dashboard
          if (folderId) {
            router.push(`/folders/${folderId}`);
          } else {
            router.push('/dashboard');
          }
          return;
        }
        
        setFileName(fileData.name);
        setEditedName(fileData.name);
        setFileData(fileData);
        setFolderName(folderName);
        setFolderId(folderId);
      } else {
        setFileName("Unnamed File");
      }
    };
    
    loadFileDetails();
  }, [fileId, router]);
  
  // Handle file rename
  const handleRename = async () => {
    if (isEditing && user && fileData) {
      const updatedFileData = await FileService.renameFile(
        fileId,
        fileData,
        editedName,
        user.id
      );
      
      if (updatedFileData) {
        setFileName(updatedFileData.name);
        setFileData(updatedFileData);
      } else {
        // Revert to original name on error
        setEditedName(fileName);
      }
    }
    
    setIsEditing(!isEditing);
  };
  
  const startEditing = () => {
    setEditedName(fileName);
    setIsEditing(true);
  };
  
  const cancelEditing = () => {
    setIsEditing(false);
    setEditedName(fileName);
  };
  
  // Handle file delete
  const handleDelete = async () => {
    const success = await FileService.deleteFile(fileId);
    
    if (success) {
      // Navigate back to the folder or dashboard
      if (folderId) {
        router.push(`/folders/${folderId}`);
      } else {
        router.push('/dashboard');
      }
    }
    
    setIsDeleteDialogOpen(false);
  };
  
  // Handle export
  const handleExport = () => {
    FileService.exportFile(fileId);
  };
  
  return (
    <AppLayout>
      {/* Breadcrumbs */}
      <Breadcrumbs
        items={[
          { label: 'Dashboard', href: '/dashboard' },
          ...(folderId ? [{ label: folderName, href: `/folders/${folderId}` }] : []),
          { label: fileName, href: `/files/${fileId}` },
        ]}
      />
      
      {/* Use the shared PageHeader component */}
      <PageHeader
        title={fileName}
        backHref={folderId ? `/folders/${folderId}` : '/dashboard'}
        isEditing={isEditing}
        editedName={editedName}
        onEditChange={(value) => setEditedName(value)}
        onStartEditing={startEditing}
        onSave={handleRename}
        onCancel={cancelEditing}
        type="file"
        menuItems={[
          {
            label: 'Rename',
            icon: <Pencil className="h-4 w-4 mr-2" />,
            onClick: startEditing
          },
          {
            label: 'Delete',
            icon: <Trash2 className="h-4 w-4 mr-2" />,
            onClick: () => setIsDeleteDialogOpen(true)
          },
          {
            label: 'Export',
            icon: <Download className="h-4 w-4 mr-2" />,
            onClick: handleExport
          }
        ]}
      />
      
      {/* Two-column layout */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4">
        <OverviewColumn file={fileData} />
        <TranscriptionColumn file={fileData} />
      </div>
      
      {/* Delete confirmation dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will delete the file "{fileName}". This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
} 