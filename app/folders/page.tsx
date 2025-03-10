'use client';

import { AppLayout } from "@/app/components/layout/AppLayout";
import { Breadcrumbs } from "@/app/components/layout/Breadcrumbs";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Folder } from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { FileProvider } from '@/contexts/FileContext';
import { FileList } from '@/app/components/files/FileList';
import { useFiles } from '@/contexts/FileContext';

// Mock folders data - in a real app, this would come from an API
const mockFolders = [
  { id: 'personal', name: 'Personal', fileCount: 4 },
  { id: 'work', name: 'Work', fileCount: 5 },
  { id: 'projects', name: 'Projects', fileCount: 3 },
];

export default function FoldersPage() {
  const router = useRouter();
  const [showCreateFolder, setShowCreateFolder] = useState(false);
  const { files, deleteFile } = useFiles();
  
  const handleFolderClick = (folderId: string) => {
    router.push(`/folders/${folderId}`);
  };
  
  return (
    <AppLayout>
      <FileProvider>
        <div className="space-y-6">
          <Breadcrumbs />
          
          <div className="flex items-center justify-between">
            <h1 className="text-3xl font-bold tracking-tight">Folders</h1>
            <Button onClick={() => setShowCreateFolder(!showCreateFolder)}>
              <Plus className="h-4 w-4 mr-2" />
              New Folder
            </Button>
          </div>
          
          {/* Create Folder UI would go here */}
          {showCreateFolder && (
            <Card className="mb-6">
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground mb-4">
                  Folder creation functionality will be implemented in a future update.
                </p>
              </CardContent>
            </Card>
          )}
          
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {mockFolders.map((folder) => (
              <Card 
                key={folder.id}
                className="hover:bg-accent/50 cursor-pointer transition-colors"
                onClick={() => handleFolderClick(folder.id)}
              >
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg flex items-center">
                    <Folder className="h-5 w-5 mr-2 text-muted-foreground" />
                    {folder.name}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-sm text-muted-foreground">{folder.fileCount} files</div>
                </CardContent>
              </Card>
            ))}
          </div>
          
          {/* Root Files Section */}
          <div className="mt-8">
            <h2 className="text-xl font-semibold mb-4">Root Files</h2>
            <FileList
              files={files}
            />
          </div>
        </div>
      </FileProvider>
    </AppLayout>
  );
}
