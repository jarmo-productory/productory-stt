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
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
  
  // Fetch the file details
  useEffect(() => {
    const fetchFileDetails = async () => {
      const supabase = createClientComponentClient();
      const { data, error } = await supabase
        .from('audio_files')
        .select('*')
        .eq('id', fileId)
        .single();
      
      if (data && !error) {
        setFileName(data.file_name);
        setEditedName(data.file_name);
        setFolderId(data.folder_id);
        
        // Convert database record to FileObject format
        const fileObject: FileObject = {
          id: data.id,
          name: data.file_name,
          size: data.size || 0,
          created_at: data.created_at,
          duration: data.duration,
          status: data.status as any,
          metadata: data.metadata,
          folder_id: data.folder_id,
          file_name: data.file_name,
          file_path: data.file_path,
          format: data.format
        };
        
        setFileData(fileObject);
        
        // If there's a folder_id, fetch the folder name
        if (data.folder_id) {
          const { data: folderData, error: folderError } = await supabase
            .from('folders')
            .select('name')
            .eq('id', data.folder_id)
            .single();
          
          if (folderData && !folderError) {
            setFolderName(folderData.name);
          }
        }
      } else {
        setFileName("Unnamed File");
        console.error("Error fetching file details:", error);
      }
    };
    
    fetchFileDetails();
  }, [fileId]);
  
  // Handle file rename
  const handleRename = async () => {
    if (isEditing) {
      // Save the new name
      const supabase = createClientComponentClient();
      const { error } = await supabase
        .from('audio_files')
        .update({ file_name: editedName })
        .eq('id', fileId);
      
      if (!error) {
        setFileName(editedName);
      } else {
        console.error("Error renaming file:", error);
        // Revert to original name
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
    const supabase = createClientComponentClient();
    const { error } = await supabase
      .from('audio_files')
      .update({ status: 'deleted' })
      .eq('id', fileId);
    
    if (!error) {
      // Navigate back to the folder or dashboard
      if (folderId) {
        router.push(`/folders/${folderId}`);
      } else {
        router.push('/dashboard');
      }
    } else {
      console.error("Error deleting file:", error);
    }
    
    setIsDeleteDialogOpen(false);
  };
  
  // Handle export (placeholder for now)
  const handleExport = () => {
    alert("Export functionality will be implemented in task 6.6");
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