'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';

interface Folder {
  id: string;
  name: string;
  parent_id: string | null;
  // Add other folder properties as needed
}

interface FolderModalProps {
  isOpen: boolean;
  onClose: () => void;
  folder?: Folder; // If provided, we're editing an existing folder
  parentId?: string | null; // If provided, we're creating a subfolder
  initialName?: string; // Initial name for renaming
  folderId?: string; // Folder ID for renaming
  isRenaming?: boolean; // Whether we're renaming a folder
}

export function FolderModal({ 
  isOpen, 
  onClose, 
  folder, 
  parentId,
  initialName,
  folderId,
  isRenaming = false
}: FolderModalProps) {
  const [name, setName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  
  // Set initial name if editing or renaming
  useEffect(() => {
    if (folder) {
      setName(folder.name);
    } else if (initialName && isRenaming) {
      setName(initialName);
    } else {
      setName('');
    }
  }, [folder, initialName, isRenaming, isOpen]);
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name.trim()) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      // Determine which folder ID to use
      const targetFolderId = folder?.id || folderId;
      
      if (targetFolderId && (folder || isRenaming)) {
        // Update existing folder
        const response = await fetch(`/api/folders/${targetFolderId}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ name: name.trim() }),
        });
        
        const responseData = await response.json();
        
        if (!response.ok) {
          console.error('Folder update error details:', {
            status: response.status,
            statusText: response.statusText,
            data: responseData
          });
          throw new Error(responseData.error || 'Failed to update folder');
        }
        
        toast.success('Folder updated successfully');
      } else {
        // Create new folder
        console.log('Attempting to create folder:', {
          name: name.trim(),
          parent_id: parentId || null,
        });
        
        const response = await fetch('/api/folders', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            name: name.trim(),
            parent_id: parentId || null,
          }),
          credentials: 'include', // Include cookies for authentication
        });
        
        const responseData = await response.json();
        
        if (!response.ok) {
          console.error('Folder creation error details:', {
            status: response.status,
            statusText: response.statusText,
            data: responseData
          });
          
          // Check for specific USER_NOT_FOUND error
          if (responseData.code === 'USER_NOT_FOUND') {
            throw new Error('Please complete your profile setup before creating folders');
          }
          
          throw new Error(responseData.error || 'Failed to create folder');
        }
        
        console.log('Folder created successfully:', responseData);
        toast.success('Folder created successfully');
      }
      
      onClose();
      // Refresh the page to show the updated folder
      router.refresh();
    } catch (error) {
      console.error('Folder operation error:', error);
      setError(error instanceof Error ? error.message : 'An error occurred');
      
      // If it's a user profile error, we could potentially redirect to profile setup
      if (error instanceof Error && error.message.includes('profile setup')) {
        toast.error('Profile setup required', {
          description: 'You need to complete your profile before creating folders'
        });
        // Redirect to profile setup page
        router.push('/account/profile-setup');
      }
    } finally {
      setIsLoading(false);
    }
  };
  
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>
            {isRenaming ? 'Rename Folder' : folder ? 'Edit Folder' : 'Create New Folder'}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="name" className="text-right">
                Name
              </Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="col-span-3"
                placeholder="Enter folder name"
                autoFocus
              />
            </div>
            {error && (
              <div className="text-sm text-red-500 col-span-4">{error}</div>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={isLoading}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading || !name.trim()}>
              {isLoading ? 'Saving...' : isRenaming ? 'Rename' : folder ? 'Save Changes' : 'Create Folder'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
} 