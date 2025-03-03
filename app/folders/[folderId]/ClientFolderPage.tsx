'use client';

import { AppLayout } from "@/app/components/layout/AppLayout";
import { Breadcrumbs } from "@/app/components/layout/Breadcrumbs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ChevronLeft, Upload, FolderPlus, MoreHorizontal, Pencil, Trash2, Check, X, FolderOpen } from "lucide-react";
import Link from "next/link";
import { FileProvider } from '@/contexts/FileContext';
import { FileList } from '@/app/components/files/FileList';
import { FileDetailsPanel } from '@/app/components/files/FileDetailsPanel';
import { FileUpload } from '@/app/components/files/FileUpload';
import { FolderModal } from '@/app/components/folders/FolderModal';
import { useState, useEffect, useRef } from "react";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import { useRouter } from "next/navigation";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface ClientFolderPageProps {
  folderId: string;
}

export default function ClientFolderPage({ folderId }: ClientFolderPageProps) {
  const [folderName, setFolderName] = useState("Loading...");
  const [isEditing, setIsEditing] = useState(false);
  const [editedName, setEditedName] = useState("");
  const [showUpload, setShowUpload] = useState(false);
  const [isCreateSubfolderModalOpen, setIsCreateSubfolderModalOpen] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [hasFiles, setHasFiles] = useState(true);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  
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
  
  // Check if folder has files and show upload if empty
  useEffect(() => {
    const checkForFiles = async () => {
      const supabase = createClientComponentClient();
      const { data, error } = await supabase
        .from('audio_files')
        .select('id')
        .eq('folder_id', folderId)
        .limit(1);
      
      const isEmpty = !data || data.length === 0;
      setHasFiles(!isEmpty);
      
      // Automatically show upload if folder is empty
      if (isEmpty) {
        setShowUpload(true);
      }
    };
    
    checkForFiles();
  }, [folderId, refreshTrigger]);
  
  const handleDeleteFolder = async () => {
    if (confirm("Are you sure you want to delete this folder? All files will remain in your account.")) {
      const supabase = createClientComponentClient();
      await supabase
        .from('folders')
        .update({ is_deleted: true })
        .eq('id', folderId);
      
      // Navigate back to folders page
      window.location.href = "/folders";
    }
  };
  
  const startEditing = () => {
    setEditedName(folderName);
    setIsEditing(true);
  };
  
  const cancelEditing = () => {
    setIsEditing(false);
  };
  
  const saveNewName = async () => {
    if (editedName.trim() === "") {
      return;
    }
    
    if (editedName === folderName) {
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
      
      // Force a complete page reload to update all components
      window.location.reload();
    }
    
    setIsEditing(false);
  };
  
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      saveNewName();
    } else if (e.key === 'Escape') {
      cancelEditing();
    }
  };
  
  return (
    <AppLayout>
      <FileProvider>
        <div className="space-y-4">
          <Breadcrumbs />
          
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <Link href="/folders">
                <Button variant="ghost" size="icon" className="mr-2">
                  <ChevronLeft className="h-4 w-4" />
                </Button>
              </Link>
              
              {isEditing ? (
                <div className="flex items-center">
                  <Input
                    ref={inputRef}
                    value={editedName}
                    onChange={(e) => setEditedName(e.target.value)}
                    onKeyDown={handleKeyDown}
                    className="text-xl font-bold h-10 mr-2 min-w-[200px]"
                  />
                  <Button variant="ghost" size="icon" onClick={saveNewName} className="h-8 w-8">
                    <Check className="h-4 w-4 text-green-500" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={cancelEditing} className="h-8 w-8">
                    <X className="h-4 w-4 text-red-500" />
                  </Button>
                </div>
              ) : (
                <h1 
                  className="text-3xl font-bold tracking-tight cursor-pointer hover:text-primary"
                  onClick={startEditing}
                  title="Click to rename"
                >
                  {folderName}
                </h1>
              )}
            </div>
            
            <div className="flex gap-2">
              <Button 
                onClick={() => setShowUpload(!showUpload)}
                variant={showUpload ? "secondary" : "default"}
              >
                <Upload className="h-4 w-4 mr-2" />
                {showUpload ? 'Hide Upload' : 'Upload'}
              </Button>
              
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon">
                    <MoreHorizontal className="h-5 w-5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => setIsCreateSubfolderModalOpen(true)}>
                    <FolderPlus className="h-4 w-4 mr-2" />
                    New Subfolder
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={startEditing}>
                    <Pencil className="h-4 w-4 mr-2" />
                    Rename Folder
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleDeleteFolder} className="text-destructive">
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete Folder
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
          
          {/* File Upload Section */}
          {showUpload && (
            <FileUpload 
              folderId={folderId}
              className="mb-4"
              onUploadComplete={() => {
                // Trigger a refresh of the file list
                setRefreshTrigger(prev => prev + 1);
              }}
            />
          )}
          
          {/* Files Section - No heading */}
          <div className="mt-6">
            <FileList 
              folderId={folderId} 
              key={`file-list-${refreshTrigger}`} 
              onShowUpload={() => setShowUpload(true)}
            />
            
            {/* Show a message when there are no files and upload is not showing */}
            {!hasFiles && !showUpload && (
              <div className="text-center py-12 border rounded-md bg-muted/10">
                <FolderOpen className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
                <h3 className="text-lg font-medium mb-2">No files in this folder</h3>
                <p className="text-muted-foreground mb-4">Upload audio files to get started with transcription</p>
                <Button 
                  variant="outline" 
                  className="mx-auto"
                  onClick={() => setShowUpload(true)}
                >
                  <Upload className="h-4 w-4 mr-2" />
                  Upload Files
                </Button>
              </div>
            )}
          </div>
          
          {/* File Details Panel */}
          <FileDetailsPanel />
        </div>
        
        {/* Subfolder Creation Modal */}
        <FolderModal 
          isOpen={isCreateSubfolderModalOpen} 
          onClose={() => setIsCreateSubfolderModalOpen(false)}
          parentId={folderId}
        />
      </FileProvider>
    </AppLayout>
  );
} 