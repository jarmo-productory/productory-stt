"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { 
  Home, 
  Folder, 
  FolderPlus,
  ChevronDown, 
  ChevronRight, 
  UserCircle, 
  CreditCard,
  LogOut,
  Plus,
  MoreVertical,
  Pencil,
  Trash2
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { FolderModal } from "@/app/components/folders/FolderModal";
import { RenameModal } from "@/app/components/folders/RenameModal";
import { DeleteModal } from "@/app/components/folders/DeleteModal";

interface NavItemProps {
  href: string;
  label: string;
  icon: React.ReactNode;
  active?: boolean;
  className?: string;
}

function NavItem({ href, label, icon, active, className }: NavItemProps) {
  return (
    <Link 
      href={href} 
      className={cn(
        "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-all hover:bg-accent hover:text-accent-foreground",
        active ? "bg-accent text-accent-foreground font-medium" : "text-muted-foreground",
        className
      )}
    >
      {icon}
      <span>{label}</span>
    </Link>
  );
}

interface FolderItemProps {
  id: string;
  name: string;
  active?: boolean;
  onClick?: () => void;
  onRename?: () => void;
  onDelete?: () => void;
}

function FolderItem({ id, name, active, onClick, onRename, onDelete }: FolderItemProps) {
  const [showActions, setShowActions] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  
  return (
    <div 
      className="relative flex items-center w-full group"
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => {
        if (!isDropdownOpen) {
          setShowActions(false);
        }
      }}
    >
      <Link
        href={`/folders/${id}`}
        className={cn(
          "flex items-center flex-1 gap-2 py-2 px-3 text-sm transition-colors w-full",
          active ? "text-accent-foreground font-medium" : "text-muted-foreground"
        )}
        onClick={onClick}
      >
        <Folder className="h-4 w-4 shrink-0" />
        <span className="truncate">{name}</span>
      </Link>
      
      {(showActions || isDropdownOpen) && (
        <DropdownMenu open={isDropdownOpen} onOpenChange={setIsDropdownOpen}>
          <DropdownMenuTrigger asChild>
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-7 w-7 absolute right-1 opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
              }}
            >
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-40" onCloseAutoFocus={(e) => e.preventDefault()}>
            <DropdownMenuItem onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              if (onRename) onRename();
              setIsDropdownOpen(false);
            }}>
              <Pencil className="mr-2 h-4 w-4" />
              <span>Rename</span>
            </DropdownMenuItem>
            <DropdownMenuItem 
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                if (onDelete) onDelete();
                setIsDropdownOpen(false);
              }} 
              className="text-destructive focus:text-destructive"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              <span>Delete</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
}

export function SidebarNav() {
  const pathname = usePathname();
  const router = useRouter();
  const [foldersExpanded, setFoldersExpanded] = useState(true);
  const { user, signOut } = useAuth();
  const [folders, setFolders] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({});
  const [folderToRename, setFolderToRename] = useState<any | null>(null);
  const [folderToDelete, setFolderToDelete] = useState<any | null>(null);
  const [isRenameModalOpen, setIsRenameModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const prevPathRef = useRef<string | null>(null);
  
  // Function to refresh folders
  const refreshFolders = async () => {
    if (!user) return;
    
    setIsLoading(true);
    try {
      const response = await fetch('/api/folders');
      
      if (response.status === 404) {
        // Check if it's a USER_NOT_FOUND error
        const data = await response.json();
        if (data.code === 'USER_NOT_FOUND') {
          console.log('User profile not found, redirecting to profile setup');
          // Redirect to profile setup page
          router.push('/account/profile-setup');
          return;
        }
      }
      
      if (!response.ok) {
        throw new Error('Failed to fetch folders');
      }
      
      const data = await response.json();
      setFolders(data.folders || []);
    } catch (error) {
      console.error('Error fetching folders:', error);
    } finally {
      setIsLoading(false);
    }
  };
  
  // Fetch folders from API
  useEffect(() => {
    refreshFolders();
  }, [user]);

  // Remove the problematic useEffect that was causing the loop
  // Instead, use a more targeted approach that only refreshes when needed
  useEffect(() => {
    // Only refresh when navigating to a different folder page
    // This prevents the infinite loop while still updating when needed
    if (pathname.includes('/folders/') && pathname !== prevPathRef.current) {
      // Extract the folder ID from the pathname
      const pathSegments = pathname.split('/');
      const folderIndex = pathSegments.indexOf('folders');
      
      if (folderIndex !== -1 && folderIndex + 1 < pathSegments.length) {
        const currentFolderId = pathSegments[folderIndex + 1];
        
        // Check if this folder already exists in our list
        const folderExists = folders.some(folder => folder.id === currentFolderId);
        
        // Only refresh if the folder doesn't exist in our current list
        // This prevents unnecessary refreshes when navigating to known folders
        if (!folderExists) {
          refreshFolders();
        }
      }
    }
    
    // Update the previous path reference
    prevPathRef.current = pathname;
  }, [pathname, folders, refreshFolders]);

  // Auto-expand parent folders when a subfolder is active
  useEffect(() => {
    if (pathname.includes('/folders/') && folders.length > 0) {
      const folderId = pathname.split('/').pop();
      
      if (folderId) {
        // Ensure the current folder is expanded to show its subfolders
        setExpandedFolders(prev => ({
          ...prev,
          [folderId]: true
        }));
        
        // Find the current folder
        const currentFolder = folders.find(f => f.id === folderId);
        
        if (currentFolder && currentFolder.parent_id) {
          // Ensure parent folder is expanded
          setExpandedFolders(prev => ({
            ...prev,
            [currentFolder.parent_id]: true
          }));
          
          // Check if there's a grandparent folder that needs to be expanded
          const parentFolder = folders.find(f => f.id === currentFolder.parent_id);
          if (parentFolder && parentFolder.parent_id) {
            setExpandedFolders(prev => ({
              ...prev,
              [parentFolder.parent_id]: true
            }));
          }
        }
      }
    }
  }, [pathname, folders]);

  // Toggle folder expansion
  const toggleFolder = (folderId: string) => {
    setExpandedFolders(prev => ({
      ...prev,
      [folderId]: !prev[folderId]
    }));
  };

  // Get user initials for avatar fallback
  const getUserInitials = () => {
    if (!user?.email) return "U";
    return user.email.charAt(0).toUpperCase();
  };

  // Get display name (email or name if available)
  const getDisplayName = () => {
    if (user?.user_metadata?.full_name) return user.user_metadata.full_name;
    if (user?.email) {
      const emailName = user.email.split('@')[0];
      return emailName.charAt(0).toUpperCase() + emailName.slice(1);
    }
    return "User";
  };

  // Recursive function to render folder tree
  const renderFolders = (folderList: any[], parentId: string | null = null, level = 0) => {
    return folderList
      .filter(folder => folder.parent_id === parentId)
      .map(folder => {
        const isExpanded = !!expandedFolders[folder.id];
        const isActive = pathname === `/folders/${folder.id}`;
        const hasChildren = folderList.some(f => f.parent_id === folder.id);
        
        // Calculate left padding based on level: 8px per level
        const leftPadding = level * 8;
        
        // Check if this is the active folder or a parent of the active folder
        const currentFolderId = pathname.includes('/folders/') ? pathname.split('/').pop() : null;
        const isActiveFolder = folder.id === currentFolderId;
        
        // Always show children of active folder
        const shouldShowChildren = (isExpanded || isActiveFolder) && hasChildren;
        
        return (
          <React.Fragment key={folder.id}>
            <div className="w-full">
              <div className={cn(
                "flex items-center w-full rounded-md transition-colors",
                isActive ? "bg-accent" : "hover:bg-accent/40"
              )}>
                {/* Apply padding based on level */}
                <div style={{ width: `${leftPadding}px` }} className="shrink-0"></div>
                
                <div className="flex-1">
                  <FolderItem
                    id={folder.id}
                    name={folder.name}
                    active={isActive}
                    onClick={() => {
                      // Only toggle expansion, navigation is handled by the Link
                      if (hasChildren) {
                        toggleFolder(folder.id);
                      }
                    }}
                    onRename={() => {
                      setFolderToRename(folder);
                      setIsRenameModalOpen(true);
                    }}
                    onDelete={() => {
                      setFolderToDelete(folder);
                      setIsDeleteModalOpen(true);
                    }}
                  />
                </div>
              </div>
            </div>
            
            {/* Render children if folder is expanded or is the active folder */}
            {shouldShowChildren && (
              renderFolders(folderList, folder.id, level + 1)
            )}
          </React.Fragment>
        );
      });
  };

  return (
    <TooltipProvider>
      <>
        <div className="flex flex-col h-full">
          <div className="px-4 py-6 mb-2">
            <h2 className="text-xl font-semibold">Productory STT</h2>
          </div>
          
          <div className="px-4 mb-2">
            {/* Dashboard Link with New Folder Button */}
            <div className="flex items-center">
              <NavItem 
                href="/dashboard" 
                label="Dashboard" 
                icon={<Home className="h-4 w-4" />} 
                active={pathname === "/dashboard"}
                className="flex-1"
              />
              
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-7 w-7 ml-1" 
                    onClick={() => setIsCreateModalOpen(true)}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Create new folder</TooltipContent>
              </Tooltip>
            </div>
            
            {/* Folders directly in the sidebar */}
            <div className="mt-2">
              {isLoading ? (
                <div className="py-1.5 text-sm text-muted-foreground">
                  Loading...
                </div>
              ) : folders.length === 0 ? (
                <div className="py-3 text-sm text-muted-foreground flex flex-col items-center w-full">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="flex items-center gap-1.5 w-full justify-center"
                    onClick={() => setIsCreateModalOpen(true)}
                  >
                    <FolderPlus className="h-3.5 w-3.5" />
                    <span>Create your first folder</span>
                  </Button>
                </div>
              ) : (
                <div className="space-y-1">
                  {folders
                    .filter(folder => folder.parent_id === null)
                    .map(folder => {
                      const isExpanded = !!expandedFolders[folder.id];
                      const isActive = pathname === `/folders/${folder.id}`;
                      const hasChildren = folders.some(f => f.parent_id === folder.id);
                      
                      return (
                        <React.Fragment key={folder.id}>
                          <div className="w-full">
                            <div className={cn(
                              "flex items-center w-full rounded-md transition-colors",
                              isActive ? "bg-accent" : "hover:bg-accent/40"
                            )}>
                              <div className="flex-1">
                                <FolderItem
                                  id={folder.id}
                                  name={folder.name}
                                  active={isActive}
                                  onClick={() => {
                                    // Only toggle expansion, navigation is handled by the Link
                                    if (hasChildren) {
                                      toggleFolder(folder.id);
                                    }
                                  }}
                                  onRename={() => {
                                    setFolderToRename(folder);
                                    setIsRenameModalOpen(true);
                                  }}
                                  onDelete={() => {
                                    setFolderToDelete(folder);
                                    setIsDeleteModalOpen(true);
                                  }}
                                />
                              </div>
                            </div>
                          </div>
                          
                          {/* Render children at the same level, not nested */}
                          {isExpanded && hasChildren && (
                            renderFolders(folders, folder.id, 1)
                          )}
                        </React.Fragment>
                      );
                    })}
                </div>
              )}
            </div>
          </div>
          
          {/* Account Section */}
          <div className="px-4 mt-auto mb-6 pt-4">
            {/* Account and Billing links removed from here */}
          </div>

          {/* User Account Badge */}
          <div className="mt-auto border-t pt-4 px-3 pb-4">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="w-full justify-start px-2 hover:bg-accent">
                  <div className="flex items-center gap-2">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={user?.user_metadata?.avatar_url || ""} />
                      <AvatarFallback>{getUserInitials()}</AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col items-start text-left">
                      <span className="text-sm font-medium truncate max-w-[120px]">{getDisplayName()}</span>
                      {user?.email && (
                        <span className="text-xs text-muted-foreground truncate max-w-[120px]">{user.email}</span>
                      )}
                    </div>
                  </div>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <Link href="/account">
                  <DropdownMenuItem>
                    <UserCircle className="mr-2 h-4 w-4" />
                    <span>Account</span>
                  </DropdownMenuItem>
                </Link>
                <Link href="/account/pay">
                  <DropdownMenuItem>
                    <CreditCard className="mr-2 h-4 w-4" />
                    <span>Billing</span>
                  </DropdownMenuItem>
                </Link>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => signOut()}>
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Log out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
        
        {/* Folder Creation Modal */}
        <FolderModal 
          isOpen={isCreateModalOpen} 
          onClose={() => {
            setIsCreateModalOpen(false);
            refreshFolders(); // Refresh folders after modal is closed
          }} 
        />
        
        {/* Rename Modal */}
        <RenameModal
          isOpen={isRenameModalOpen}
          onClose={() => {
            setIsRenameModalOpen(false);
            setFolderToRename(null);
          }}
          folder={folderToRename}
          onSuccess={refreshFolders}
        />
        
        {/* Delete Modal */}
        <DeleteModal
          isOpen={isDeleteModalOpen}
          onClose={() => {
            setIsDeleteModalOpen(false);
            setFolderToDelete(null);
          }}
          folder={folderToDelete}
          onSuccess={refreshFolders}
        />
      </>
    </TooltipProvider>
  );
} 