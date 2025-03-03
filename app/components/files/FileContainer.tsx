'use client';

import { useState, useEffect, ReactNode } from 'react';
import { useFiles, FileObject, SortField, SortDirection } from '@/contexts/FileContext';
import { 
  Search,
  SortAsc,
  SortDesc,
  RefreshCw,
  Loader2,
  FileAudio,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Clock
} from 'lucide-react';

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

// Define container view types
export type ContainerViewType = 'dashboard' | 'folder';

// Define props for the FileContainer component
interface FileContainerProps {
  viewType: ContainerViewType;
  title?: string;
  description?: string;
  folderId?: string | null;
  children?: ReactNode;
  headerContent?: ReactNode;
  footerContent?: ReactNode;
  showSearch?: boolean;
  showSort?: boolean;
  showPagination?: boolean;
  itemsPerPage?: number;
  className?: string;
}

export function FileContainer({
  viewType = 'dashboard',
  title,
  description,
  folderId = null,
  children,
  headerContent,
  footerContent,
  showSearch = true,
  showSort = true,
  showPagination = true,
  itemsPerPage = 10,
  className = '',
}: FileContainerProps) {
  // Get file context
  const { 
    files,
    isLoading,
    error,
    sortField,
    sortDirection,
    searchQuery,
    fetchFiles,
    setSortField,
    setSortDirection,
    setSearchQuery,
    refreshFiles,
  } = useFiles();

  // Local UI state
  const [currentPage, setCurrentPage] = useState(1);
  const [localSearchTerm, setLocalSearchTerm] = useState('');
  
  // Fetch files when component mounts or folderId changes
  useEffect(() => {
    fetchFiles(folderId);
  }, [folderId]);

  // Handle search input
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setLocalSearchTerm(e.target.value);
  };

  // Apply search after a short delay
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearchQuery(localSearchTerm);
    }, 300);
    
    return () => clearTimeout(timer);
  }, [localSearchTerm]);

  // Handle sort changes
  const handleSortFieldChange = (value: string) => {
    setSortField(value as SortField);
  };

  const handleSortDirectionToggle = () => {
    setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
  };

  // Handle refresh
  const handleRefresh = () => {
    refreshFiles();
  };

  // Handle pagination
  const totalPages = Math.ceil(files.length / itemsPerPage);
  
  const handlePreviousPage = () => {
    setCurrentPage(prev => Math.max(prev - 1, 1));
  };
  
  const handleNextPage = () => {
    setCurrentPage(prev => Math.min(prev + 1, totalPages));
  };

  // Calculate pagination
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  
  // Filter and sort files
  const filteredFiles = files.filter(file => 
    file.name.toLowerCase().includes(searchQuery.toLowerCase())
  );
  
  const sortedFiles = [...filteredFiles].sort((a, b) => {
    if (sortField === 'name') {
      return sortDirection === 'asc' 
        ? a.name.localeCompare(b.name)
        : b.name.localeCompare(a.name);
    } else if (sortField === 'size') {
      return sortDirection === 'asc' 
        ? a.size - b.size
        : b.size - a.size;
    } else {
      // Default to created_at
      return sortDirection === 'asc' 
        ? new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        : new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    }
  });
  
  const paginatedFiles = sortedFiles.slice(startIndex, endIndex);

  // Render loading state
  if (isLoading) {
    return (
      <Card className={`w-full ${className}`}>
        <CardContent className="flex flex-col items-center justify-center p-8">
          <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
          <p className="text-muted-foreground">Loading files...</p>
        </CardContent>
      </Card>
    );
  }

  // Render error state
  if (error) {
    return (
      <Card className={`w-full ${className}`}>
        <CardContent className="flex flex-col items-center justify-center p-8">
          <AlertCircle className="h-8 w-8 text-destructive mb-4" />
          <p className="text-destructive font-medium mb-2">Error loading files</p>
          <p className="text-muted-foreground text-sm">{error}</p>
          <Button onClick={handleRefresh} variant="outline" className="mt-4">
            <RefreshCw className="h-4 w-4 mr-2" />
            Try Again
          </Button>
        </CardContent>
      </Card>
    );
  }

  // Render empty state
  if (files.length === 0) {
    return (
      <Card className={`w-full ${className}`}>
        <CardHeader>
          {title && <CardTitle>{title}</CardTitle>}
          {description && <p className="text-muted-foreground text-sm">{description}</p>}
          {headerContent}
        </CardHeader>
        <CardContent className="flex flex-col items-center justify-center p-8">
          <FileAudio className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-lg font-medium mb-2">No files found</p>
          <p className="text-muted-foreground text-sm mb-6">
            {viewType === 'dashboard' 
              ? 'Upload your first audio file to get started'
              : 'This folder is empty. Upload files or create a new folder.'}
          </p>
          {children}
        </CardContent>
      </Card>
    );
  }

  // Render main content
  return (
    <Card className={`w-full ${className}`}>
      <CardHeader>
        {title && <CardTitle>{title}</CardTitle>}
        {description && <p className="text-muted-foreground text-sm">{description}</p>}
        {headerContent}
        
        {/* Toolbar */}
        <div className="flex flex-col sm:flex-row gap-2 mt-4">
          {showSearch && (
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search files..."
                className="pl-8"
                value={localSearchTerm}
                onChange={handleSearchChange}
              />
            </div>
          )}
          
          <div className="flex gap-2">
            {showSort && (
              <>
                <Select
                  value={sortField}
                  onValueChange={handleSortFieldChange}
                >
                  <SelectTrigger className="w-[130px]">
                    <SelectValue placeholder="Sort by" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="name">Name</SelectItem>
                    <SelectItem value="size">Size</SelectItem>
                    <SelectItem value="created_at">Date</SelectItem>
                  </SelectContent>
                </Select>
                
                <Button
                  variant="outline"
                  size="icon"
                  onClick={handleSortDirectionToggle}
                  title={sortDirection === 'asc' ? 'Ascending' : 'Descending'}
                >
                  {sortDirection === 'asc' ? (
                    <SortAsc className="h-4 w-4" />
                  ) : (
                    <SortDesc className="h-4 w-4" />
                  )}
                </Button>
              </>
            )}
            
            <Button
              variant="outline"
              size="icon"
              onClick={handleRefresh}
              title="Refresh"
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      
      <CardContent>
        {/* Main content - will be provided by children */}
        {children}
        
        {/* Pagination */}
        {showPagination && totalPages > 1 && (
          <div className="flex items-center justify-between mt-4">
            <div className="text-sm text-muted-foreground">
              Showing {startIndex + 1}-{Math.min(endIndex, filteredFiles.length)} of {filteredFiles.length}
            </div>
            
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="icon"
                onClick={handlePreviousPage}
                disabled={currentPage === 1}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              
              <div className="text-sm px-2">
                Page {currentPage} of {totalPages}
              </div>
              
              <Button
                variant="outline"
                size="icon"
                onClick={handleNextPage}
                disabled={currentPage === totalPages}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
        
        {footerContent}
      </CardContent>
    </Card>
  );
}
