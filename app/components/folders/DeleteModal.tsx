'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { AlertTriangle } from 'lucide-react';

interface Folder {
  id: string;
  name: string;
}

interface DeleteModalProps {
  isOpen: boolean;
  onClose: () => void;
  folder: Folder | null;
  onSuccess?: () => void;
}

export function DeleteModal({ isOpen, onClose, folder, onSuccess }: DeleteModalProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const handleDelete = async () => {
    if (!folder) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      // Delete the folder
      const response = await fetch(`/api/folders/${folder.id}`, {
        method: 'DELETE',
        credentials: 'include', // Include cookies for authentication
      });
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to delete folder');
      }
      
      toast.success('Folder deleted successfully');
      onClose();
      if (onSuccess) onSuccess();
    } catch (error) {
      console.error('Folder deletion error:', error);
      setError(error instanceof Error ? error.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  };
  
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            Delete Folder
          </DialogTitle>
          <DialogDescription>
            Are you sure you want to delete the folder "{folder?.name}"? This action cannot be undone.
            {folder?.name === 'test' && (
              <div className="mt-2 text-amber-500">
                Note: This is your test folder. Deleting it may affect your testing environment.
              </div>
            )}
          </DialogDescription>
        </DialogHeader>
        <div className="py-4">
          {error && (
            <div className="text-sm text-red-500 mb-4">{error}</div>
          )}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button 
            type="button" 
            variant="destructive" 
            onClick={handleDelete} 
            disabled={isLoading}
          >
            {isLoading ? 'Deleting...' : 'Delete Folder'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
} 