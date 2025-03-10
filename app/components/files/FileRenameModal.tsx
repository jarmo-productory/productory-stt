'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FileObject } from '@/contexts/FileContext';
import { useFileActions } from './FileActionsProvider';

interface FileRenameModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  file: FileObject | null;
}

export function FileRenameModal({ isOpen, onOpenChange, file }: FileRenameModalProps) {
  const [newName, setNewName] = useState('');
  const [isRenaming, setIsRenaming] = useState(false);
  const { handleRenameFile } = useFileActions();
  
  useEffect(() => {
    if (file && isOpen) {
      const displayName = file.metadata?.display_name || file.name || file.file_name || '';
      setNewName(displayName);
    }
  }, [file, isOpen]);
  
  const handleRename = async () => {
    if (!file || !newName.trim()) return;
    
    setIsRenaming(true);
    
    try {
      await handleRenameFile(newName.trim());
      onOpenChange(false);
    } finally {
      setIsRenaming(false);
    }
  };
  
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Change Display Name</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="name">Display Name</Label>
            <Input
              id="name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleRename();
                }
              }}
              autoFocus
            />
          </div>
          {file?.file_name && (
            <div className="text-xs text-muted-foreground">
              Storage name: {file.file_name} (unchanged)
            </div>
          )}
        </div>
        <DialogFooter>
          <Button 
            variant="secondary" 
            onClick={() => onOpenChange(false)}
            disabled={isRenaming}
          >
            Cancel
          </Button>
          <Button
            onClick={handleRename}
            disabled={isRenaming || !newName.trim() || newName === (file?.metadata?.display_name || file?.name || file?.file_name)}
          >
            {isRenaming ? 'Updating...' : 'Update Display Name'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
} 