'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { AppLayout } from "@/app/components/layout/AppLayout";
import { Breadcrumbs } from "@/app/components/layout/Breadcrumbs";
import { PageHeader } from "@/app/components/layout/PageHeader";
import { FileText, StickyNote, Sparkles, Info } from "lucide-react";
import { TranscriptionColumn } from './components/TranscriptionColumn';
import { FileObject } from "@/contexts/FileContext";
import { useAuth } from "@/contexts/AuthContext";
import { FileService } from "@/app/components/files/FileService";
import { useFileActions } from "@/app/components/files/FileActionsProvider";
import { FileActionsMenu } from "@/app/components/files/FileActionsMenu";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { NotesTab } from './components/NotesTab';
import { AISummaryTab } from './components/AISummaryTab';
import { OverviewTab } from './components/OverviewTab';
import { AudioPlayerProvider } from "@/app/contexts/AudioPlayerContext";
import { AudioPlayer } from "@/app/components/audio/AudioPlayer";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import { useAudioPlayer } from "@/app/contexts/AudioPlayerContext";

interface ClientFileDetailsPageProps {
  fileId: string;
}

function FileDetailsContent({ fileId }: { fileId: string }) {
  const [fileName, setFileName] = useState("Loading...");
  const [isEditing, setIsEditing] = useState(false);
  const [editedName, setEditedName] = useState("");
  const [folderName, setFolderName] = useState("");
  const [folderId, setFolderId] = useState<string | null>(null);
  const [fileData, setFileData] = useState<FileObject | null>(null);
  const [activeTab, setActiveTab] = useState("transcription");
  const [transcriptionStatus, setTranscriptionStatus] = useState<'none' | 'pending' | 'processing' | 'completed' | 'failed'>('none');
  const router = useRouter();
  const { user } = useAuth();
  const { handleRenameFile, setSelectedFile, setOnFileUpdated } = useFileActions();
  const supabase = createClientComponentClient();
  const { setAudioUrl } = useAudioPlayer();
  
  // Function to get signed URL for audio file
  const getSignedUrl = async (filePath: string) => {
    try {
      const { data, error } = await supabase
        .storage
        .from('audio')
        .createSignedUrl(filePath, 3600); // 1 hour expiry

      if (error || !data) {
        console.error('Error getting signed URL:', error);
        return null;
      }

      return data.signedUrl;
    } catch (error) {
      console.error('Error in getSignedUrl:', error);
      return null;
    }
  };
  
  // Function to update file data when it changes
  const handleFileUpdate = async (updatedFile: FileObject | undefined) => {
    if (!updatedFile) return; // Guard against undefined values
    
    setFileName(updatedFile.metadata?.display_name || updatedFile.name || updatedFile.file_name || 'Unnamed File');
    setEditedName(updatedFile.metadata?.display_name || updatedFile.name || updatedFile.file_name || '');
    setFileData(updatedFile);

    // Get and set audio URL
    if (updatedFile.file_path) {
      const signedUrl = await getSignedUrl(updatedFile.file_path);
      if (signedUrl) {
        setAudioUrl(signedUrl);
      }
    }
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

        // Check transcription status
        try {
          const { data: transcriptionData } = await supabase
            .from('transcriptions')
            .select('status')
            .eq('file_id', fileData.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          if (transcriptionData) {
            setTranscriptionStatus(transcriptionData.status as any);
          } else {
            setTranscriptionStatus('none');
          }
        } catch (error) {
          console.error('Error fetching transcription status:', error);
          setTranscriptionStatus('none');
        }
      } else {
        setFileName("Unnamed File");
        setTranscriptionStatus('none');
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
  
  // Handle tab change
  const handleTabChange = (value: string) => {
    setActiveTab(value);
    // Optionally save the active tab to localStorage
    localStorage.setItem('fileDetailsActiveTab', value);
  };
  
  // Load saved tab preference
  useEffect(() => {
    const savedTab = localStorage.getItem('fileDetailsActiveTab');
    if (savedTab) {
      setActiveTab(savedTab);
    }
  }, []);
  
  return (
    <AppLayout>
      {/* Using flex and min-h-0 to ensure proper flex behavior */}
      <div className="flex flex-col h-full min-h-0 overflow-hidden">
        {/* Breadcrumbs - fixed height */}
        <div className="flex-shrink-0">
          <Breadcrumbs
            items={[
              { label: 'Dashboard', href: '/dashboard' },
              ...(folderId ? [{ label: folderName, href: `/folders/${folderId}` }] : []),
              { label: fileName, href: `/files/${fileId}` },
            ]}
          />
        </div>
        
        {/* Page Header - fixed height */}
        <div className="flex-shrink-0">
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
        </div>
        
        {/* Audio Player - fixed height */}
        <div className="px-4 flex-shrink-0 mb-4">
          <AudioPlayer transcriptionStatus={transcriptionStatus} />
        </div>
        
        {/* Tab layout - grows to fill remaining space */}
        <div className="flex-grow flex flex-col min-h-0">
          <Tabs defaultValue={activeTab} onValueChange={handleTabChange} className="w-full flex flex-col h-full min-h-0">
            {/* Tab navigation - always visible */}
            <div className="flex-shrink-0 mb-4">
              <TabsList className="w-full justify-start">
                <TabsTrigger value="transcription" className="flex items-center">
                  <FileText className="h-4 w-4 mr-2" />
                  Transcription
                </TabsTrigger>
                <TabsTrigger value="notes" className="flex items-center">
                  <StickyNote className="h-4 w-4 mr-2" />
                  Notes
                </TabsTrigger>
                <TabsTrigger value="ai-summary" className="flex items-center">
                  <Sparkles className="h-4 w-4 mr-2" />
                  AI Summary
                </TabsTrigger>
                <TabsTrigger value="overview" className="flex items-center">
                  <Info className="h-4 w-4 mr-2" />
                  Overview
                </TabsTrigger>
              </TabsList>
            </div>
            
            {/* Tab content - scrollable */}
            <div className="flex-grow overflow-auto min-h-0">
              <TabsContent value="transcription" className="h-full min-h-0">
                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                <TranscriptionColumn file={fileData as any} />
              </TabsContent>
              
              <TabsContent value="notes" className="h-full min-h-0">
                <NotesTab file={fileData} />
              </TabsContent>
              
              <TabsContent value="ai-summary" className="h-full min-h-0">
                <AISummaryTab file={fileData} />
              </TabsContent>
              
              <TabsContent value="overview" className="h-full min-h-0">
                <OverviewTab file={fileData} />
              </TabsContent>
            </div>
          </Tabs>
        </div>
      </div>
    </AppLayout>
  );
}

export default function ClientFileDetailsPage({ fileId }: ClientFileDetailsPageProps) {
  return (
    <AudioPlayerProvider>
      <FileDetailsContent fileId={fileId} />
    </AudioPlayerProvider>
  );
} 