'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

interface Folder {
  id: string;
  name: string;
}

interface RenameModalProps {
  isOpen: boolean;
  onClose: () => void;
  folder: Folder | null;
  onSuccess?: () => void;
}

export function RenameModal({ isOpen, onClose, folder, onSuccess }: RenameModalProps) {
  const [name, setName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Set initial name when folder changes
  useEffect(() => {
    if (folder) {
      setName(folder.name);
    } else {
      setName('');
    }
  }, [folder, isOpen]);
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name.trim() || !folder) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      // Update existing folder
      const response = await fetch(`/api/folders/${folder.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: name.trim() }),
        credentials: 'include', // Include cookies for authentication
      });
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to rename folder');
      }
      
      toast.success('Folder renamed successfully');
      onClose();
      if (onSuccess) onSuccess();
    } catch (error) {
      console.error('Folder rename error:', error);
      setError(error instanceof Error ? error.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  };
  
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Rename Folder</DialogTitle>
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
              {isLoading ? 'Saving...' : 'Rename Folder'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
} 