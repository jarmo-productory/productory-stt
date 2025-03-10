import { FileObject } from '@/contexts/FileContext';
import { useFileActions } from './FileActionsProvider';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { MoreHorizontal, Pencil, Trash2 } from "lucide-react";

interface FileActionsMenuProps {
  file: FileObject;
  onStartRename?: () => void;
}

export function FileActionsMenu({ file, onStartRename }: FileActionsMenuProps) {
  const { openDeleteModal, openRenameModal, setSelectedFile } = useFileActions();

  // Handlers for specific actions with separate functions to make debugging easier
  const handleRenameClick = () => {
    setSelectedFile(file);
    openRenameModal(file);
  };

  const handleDeleteClick = () => {
    setSelectedFile(file);
    openDeleteModal(file);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
        <Button variant="ghost" size="icon" className="h-6 w-6">
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={handleRenameClick}>
          <Pencil className="h-4 w-4 mr-2" />
          Rename
        </DropdownMenuItem>
        <DropdownMenuItem 
          onSelect={handleDeleteClick}
          className="text-destructive"
        >
          <Trash2 className="h-4 w-4 mr-2" />
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
} 