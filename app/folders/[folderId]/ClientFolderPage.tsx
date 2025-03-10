'use client';

import { AppLayout } from "@/app/components/layout/AppLayout";
import { Breadcrumbs } from "@/app/components/layout/Breadcrumbs";
import { PageHeader } from "@/app/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ChevronLeft, Upload, FolderPlus, Pencil, Trash2, Loader2 } from "lucide-react";
import { useFiles, FileObject } from '@/contexts/FileContext';
import { FileList } from '@/app/components/files/FileList';
import { FileUpload } from '@/app/components/files/FileUpload';
import { FileDeleteModal } from '@/app/components/files/FileDeleteModal';
import { FolderModal } from '@/app/components/folders/FolderModal';
import { DeleteModal } from '@/app/components/folders/DeleteModal';
import { useState, useEffect, useRef, useCallback } from "react";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useFileActions } from '@/app/components/files/FileActionsProvider';

interface ClientFolderPageProps {
  folderId: string;
}

export default function ClientFolderPage({ folderId }: ClientFolderPageProps) {
  const [folderName, setFolderName] = useState("Loading...");
  const [isEditing, setIsEditing] = useState(false);
  const [editedName, setEditedName] = useState("");
  const [showUpload, setShowUpload] = useState(false);
  const [isCreateSubfolderModalOpen, setIsCreateSubfolderModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const { files, isLoading, error, refreshFiles } = useFiles();
  const { setSelectedFile } = useFileActions();

  // Fetch the actual folder name
  useEffect(() => {
    const fetchFolderDetails = async () => {
      const supabase = createClientComponentClient();
      const { data, error } = await supabase
        .from('folders')
        .select('name')
        .eq('id', folderId)
        .single();
      
      if (data && !error) {
        setFolderName(data.name);
      } else {
        setFolderName("Unnamed Folder");
      }
    };
    
    fetchFolderDetails();
  }, [folderId]);

  // Focus the input when editing starts
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleDeleteFolder = () => {
    setIsDeleteModalOpen(true);
  };

  const handleDeleteSuccess = () => {
    router.push('/folders');
  };

  const startEditing = () => {
    setEditedName(folderName);
    setIsEditing(true);
  };

  const cancelEditing = () => {
    setIsEditing(false);
  };

  const saveNewName = async () => {
    if (editedName.trim() === "" || editedName === folderName) {
      setIsEditing(false);
      return;
    }

    const supabase = createClientComponentClient();
    const { error } = await supabase
      .from('folders')
      .update({ name: editedName })
      .eq('id', folderId);

    if (!error) {
      setFolderName(editedName);
      window.location.reload();
    }

    setIsEditing(false);
  };

  // Handle file upload complete
  const handleUploadComplete = useCallback(() => {
    toast.success(
      <div className="flex flex-col">
        <div className="font-medium">File uploaded successfully!</div>
        <div className="text-xs mt-1">
          Files were uploaded to "{folderName}"
        </div>
      </div>,
      {
        duration: 4000,
        position: "top-right"
      }
    );
    
    setIsRefreshing(true);
    refreshFiles();
    setShowUpload(false);
    
    setTimeout(() => {
      setIsRefreshing(false);
    }, 1000);
  }, [refreshFiles, folderName]);

  // Handle manual refresh
  const handleRefresh = useCallback(() => {
    setIsRefreshing(true);
    refreshFiles();
    setTimeout(() => setIsRefreshing(false), 1000);
  }, [refreshFiles]);

  return (
    <AppLayout>
      <div className="space-y-4">
        <Breadcrumbs />
        
        <PageHeader
          title={folderName}
          backHref="/folders"
          isEditing={isEditing}
          editedName={editedName}
          onEditChange={(value) => setEditedName(value)}
          onStartEditing={startEditing}
          onSave={saveNewName}
          onCancel={cancelEditing}
          type="folder"
          actions={
            <Button 
              onClick={() => setShowUpload(!showUpload)}
              variant={showUpload ? "secondary" : "default"}
            >
              <Upload className="h-4 w-4 mr-2" />
              {showUpload ? 'Hide Upload' : 'Upload'}
            </Button>
          }
          menuItems={[
            {
              label: 'Rename',
              icon: <Pencil className="h-4 w-4 mr-2" />,
              onClick: startEditing
            },
            {
              label: 'Create Subfolder',
              icon: <FolderPlus className="h-4 w-4 mr-2" />,
              onClick: () => setIsCreateSubfolderModalOpen(true)
            },
            {
              label: 'Delete',
              icon: <Trash2 className="h-4 w-4 mr-2" />,
              onClick: handleDeleteFolder
            }
          ]}
        />
        
        {/* File Upload Section */}
        {showUpload && (
          <div className="mb-6">
            <FileUpload 
              folderId={folderId} 
              onUploadComplete={handleUploadComplete}
              uploadContext={`Files will be uploaded to "${folderName}"`}
            />
          </div>
        )}
        
        {/* File List */}
        {isRefreshing || isLoading ? (
          <div className="flex justify-center items-center py-8 bg-background rounded-lg border">
            <Loader2 className="h-8 w-8 animate-spin text-primary mr-2" />
            <span>Loading files...</span>
          </div>
        ) : (
          <FileList
            files={files}
            folderId={folderId}
          />
        )}
        
        {/* Create Subfolder Modal */}
        <FolderModal
          isOpen={isCreateSubfolderModalOpen}
          onClose={() => setIsCreateSubfolderModalOpen(false)}
          parentId={folderId}
        />

        {/* Delete Folder Modal */}
        <DeleteModal
          isOpen={isDeleteModalOpen}
          onClose={() => setIsDeleteModalOpen(false)}
          folder={{ id: folderId, name: folderName }}
          onSuccess={handleDeleteSuccess}
        />
      </div>
    </AppLayout>
  );
} 