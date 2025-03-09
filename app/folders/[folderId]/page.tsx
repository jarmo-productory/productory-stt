import { AppLayout } from "@/app/components/layout/AppLayout";
import { Breadcrumbs } from "@/app/components/layout/Breadcrumbs";
import { Button } from "@/components/ui/button";
import { ChevronLeft, Upload, FolderPlus } from "lucide-react";
import Link from "next/link";
import { FileProvider } from '@/contexts/FileContext';
import { FileList } from '@/app/components/files/FileList';
import { FileUpload } from '@/app/components/files/FileUpload';
import { FolderModal } from '@/app/components/folders/FolderModal';
import { useState } from "react";

// Import necessary components
import ClientFolderPage from './ClientFolderPage';

export default async function FolderDetailPage({ params }: { params: { folderId: string } }) {
  // In server components, we need to await params
  const unwrappedParams = await Promise.resolve(params);
  const folderId = unwrappedParams.folderId;
  
  // Pass the folderId to the client component wrapped in FileProvider
  return (
    <FileProvider>
      <ClientFolderPage folderId={folderId} />
    </FileProvider>
  );
}
