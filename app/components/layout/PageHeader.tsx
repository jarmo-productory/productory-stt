'use client';

import { useState, useRef, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  ChevronLeft, 
  Check, 
  X, 
  MoreHorizontal,
  FolderOpen,
  FileAudio
} from "lucide-react";
import Link from "next/link";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface PageHeaderProps {
  title: string;
  backHref: string;
  isEditing: boolean;
  editedName: string;
  onEditChange: (value: string) => void;
  onStartEditing?: () => void;
  onSave: () => void;
  onCancel: () => void;
  type: 'folder' | 'file';
  actions?: React.ReactNode;
  menuItems?: {
    label: string;
    icon: React.ReactNode;
    onClick: () => void;
  }[];
}

export function PageHeader({
  title,
  backHref,
  isEditing,
  editedName,
  onEditChange,
  onStartEditing,
  onSave,
  onCancel,
  type,
  actions,
  menuItems
}: PageHeaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isEditing]);
  
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      onSave();
    } else if (e.key === 'Escape') {
      onCancel();
    }
  };
  
  const TypeIcon = type === 'folder' ? FolderOpen : FileAudio;
  
  return (
    <div className="flex items-center justify-between mb-4">
      <div className="flex items-center">
        <Link href={backHref}>
          <Button variant="ghost" size="icon" className="mr-2">
            <ChevronLeft className="h-4 w-4" />
          </Button>
        </Link>
        
        {isEditing ? (
          <div className="flex items-center">
            <Input
              ref={inputRef}
              value={editedName}
              onChange={(e) => onEditChange(e.target.value)}
              onKeyDown={handleKeyDown}
              className="text-xl font-bold h-10 mr-2 min-w-[200px]"
            />
            <Button variant="ghost" size="icon" onClick={onSave} className="h-8 w-8">
              <Check className="h-4 w-4 text-green-500" />
            </Button>
            <Button variant="ghost" size="icon" onClick={onCancel} className="h-8 w-8">
              <X className="h-4 w-4 text-red-500" />
            </Button>
          </div>
        ) : (
          <div 
            className="flex items-center cursor-pointer group"
            onClick={onStartEditing}
            title="Click to rename"
          >
            <TypeIcon className="h-6 w-6 mr-2 text-muted-foreground group-hover:text-primary transition-colors" />
            <h1 className="text-3xl font-bold tracking-tight group-hover:text-primary transition-colors">
              {title}
            </h1>
          </div>
        )}
      </div>
      
      <div className="flex gap-2">
        {actions}
        
        {menuItems && menuItems.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon">
                <MoreHorizontal className="h-5 w-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {menuItems.map((item, index) => (
                <DropdownMenuItem key={index} onClick={item.onClick}>
                  {item.icon}
                  {item.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </div>
  );
} 