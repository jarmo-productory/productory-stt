"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight, Home } from "lucide-react";
import { cn } from "@/lib/utils";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";

interface Breadcrumb {
  label: string;
  href: string;
  active?: boolean;
}

interface FolderInfo {
  id: string;
  name: string;
  parent_id: string | null;
}

interface BreadcrumbsProps {
  items?: Breadcrumb[];
}

export function Breadcrumbs({ items }: BreadcrumbsProps = {}) {
  const pathname = usePathname();
  const [folders, setFolders] = useState<FolderInfo[]>([]);
  const [folderHierarchy, setFolderHierarchy] = useState<Breadcrumb[]>([]);
  
  // Fetch folder information for the current path
  useEffect(() => {
    // If custom items are provided, skip the automatic breadcrumb generation
    if (items) return;
    
    const fetchFolderInfo = async () => {
      const paths = pathname.split("/").filter(p => p);
      let currentFolderId: string | null = null;
      
      // Find folder ID in the path
      for (let i = 0; i < paths.length - 1; i++) {
        if (paths[i] === "folders" && paths[i + 1]) {
          currentFolderId = paths[i + 1];
          break;
        }
      }
      
      if (!currentFolderId) return;
      
      // Fetch all folders to build the hierarchy
      const supabase = createClientComponentClient();
      const { data, error } = await supabase
        .from('folders')
        .select('id, name, parent_id');
      
      if (data && !error) {
        setFolders(data);
        
        // Build folder hierarchy for the current folder
        const hierarchy: Breadcrumb[] = [];
        let folderId = currentFolderId;
        
        // Build the folder path from current folder up to root
        while (folderId) {
          const folder = data.find(f => f.id === folderId);
          if (!folder) break;
          
          hierarchy.unshift({
            label: folder.name,
            href: `/folders/${folder.id}`,
            active: folder.id === currentFolderId
          });
          
          folderId = folder.parent_id;
        }
        
        setFolderHierarchy(hierarchy);
      }
    };
    
    fetchFolderInfo();
  }, [pathname, items]);
  
  // Generate breadcrumbs based on the current path
  const generateBreadcrumbs = (): Breadcrumb[] => {
    const paths = pathname.split("/").filter(p => p);
    
    const breadcrumbs: Breadcrumb[] = [
      { label: "Home", href: "/dashboard", active: paths.length === 1 && paths[0] === "dashboard" }
    ];
    
    // Add folder hierarchy if we're in the folders section
    if (paths.includes("folders")) {
      // Skip the "Folders" breadcrumb and go directly to folder hierarchy
      if (folderHierarchy.length > 0) {
        breadcrumbs.push(...folderHierarchy);
      } else if (pathname === "/folders") {
        // Only show "Folders" if we're on the main folders page
        breadcrumbs.push({
          label: "Folders",
          href: "/folders",
          active: true
        });
      }
    } else if (paths[0] === "account") {
      breadcrumbs.push({
        label: "Account",
        href: "/account",
        active: pathname === "/account"
      });
      
      if (paths[1] === "pay") {
        breadcrumbs.push({
          label: "Billing",
          href: "/account/pay",
          active: true
        });
      }
    } else if (paths[0] === "files") {
      breadcrumbs.push({
        label: "Files",
        href: "/files",
        active: paths.length === 1
      });
      
      if (paths.length > 1) {
        breadcrumbs.push({
          label: "File Details",
          href: pathname,
          active: true
        });
      }
    }
    
    return breadcrumbs;
  };
  
  // Use either the provided items or the generated breadcrumbs
  const breadcrumbs = items || generateBreadcrumbs();
  
  // Don't show breadcrumbs for dashboard or account
  if (pathname === "/dashboard" || pathname === "/account") {
    return null;
  }
  
  return (
    <nav className="flex items-center space-x-1 text-sm text-muted-foreground mb-4">
      {breadcrumbs.map((crumb, index) => (
        <React.Fragment key={crumb.href}>
          {index > 0 && <ChevronRight className="h-4 w-4 mx-1" />}
          <Link
            href={crumb.href}
            className={cn(
              "hover:text-foreground transition-colors",
              crumb.active && "text-foreground font-medium"
            )}
          >
            {index === 0 && !items ? (
              <Home className="h-4 w-4" />
            ) : (
              crumb.label
            )}
          </Link>
        </React.Fragment>
      ))}
    </nav>
  );
} 