'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { AppLayout } from "@/app/components/layout/AppLayout";
import { Breadcrumbs } from "@/app/components/layout/Breadcrumbs";
import { PageHeader } from "@/app/components/layout/PageHeader";
import { FileAudio } from "lucide-react";
import { OverviewColumn } from './components/OverviewColumn';
import { TranscriptionColumn } from './components/TranscriptionColumn';
import { FileObject } from "@/contexts/FileContext";
import { useAuth } from "@/contexts/AuthContext";
import { FileService } from "@/app/components/files/FileService";
import { useFileActions } from "@/app/components/files/FileActionsProvider";
import { FileActionsMenu } from "@/app/components/files/FileActionsMenu";

interface ClientFileDetailsPageProps {
  fileId: string;
}

export default function ClientFileDetailsPage({ fileId }: ClientFileDetailsPageProps) {
  const [fileName, setFileName] = useState("Loading...");
  const [isEditing, setIsEditing] = useState(false);
  const [editedName, setEditedName] = useState("");
  const [folderName, setFolderName] = useState("");
  const [folderId, setFolderId] = useState<string | null>(null);
  const [fileData, setFileData] = useState<FileObject | null>(null);
  const router = useRouter();
  const { user } = useAuth();
  const { handleRenameFile, setSelectedFile, setOnFileUpdated } = useFileActions();
  
  // Function to update file data when it changes
  const handleFileUpdate = (updatedFile: FileObject | undefined) => {
    if (!updatedFile) return; // Guard against undefined values
    
    setFileName(updatedFile.metadata?.display_name || updatedFile.name || updatedFile.file_name || 'Unnamed File');
    setEditedName(updatedFile.metadata?.display_name || updatedFile.name || updatedFile.file_name || '');
    setFileData(updatedFile);
  };
  
  // Register the callback when component mounts
  useEffect(() => {
    setOnFileUpdated(handleFileUpdate);
    
    // Clean up when component unmounts
    return () => {
      setOnFileUpdated(undefined);
    };
  }, [setOnFileUpdated]);
  
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
        
        // Use the name which should already prioritize metadata.display_name from FileService
        setFileName(fileData.name);
        setEditedName(fileData.name);
        setFileData(fileData);
        setFolderName(folderName);
        setFolderId(folderId);
        setSelectedFile(fileData);
      } else {
        setFileName("Unnamed File");
      }
    };
    
    loadFileDetails();
  }, [fileId, router, setSelectedFile]);
  
  // Handle file rename
  const handleRename = async () => {
    if (isEditing && user && fileData) {
      const updatedFile = await handleRenameFile(editedName);
      if (updatedFile) {
        // File update will be handled by the callback
        // No need to manually update state here
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
        actions={fileData && <FileActionsMenu file={fileData} onStartRename={startEditing} />}
      />
      
      {/* Two-column layout */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4">
        <OverviewColumn file={fileData} />
        <TranscriptionColumn file={fileData as any} />
      </div>
    </AppLayout>
  );
} 