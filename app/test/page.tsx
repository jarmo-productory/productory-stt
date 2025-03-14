'use client';

import { FileList } from '@/app/components/files/FileList';
import { useFiles } from '@/contexts/FileContext';
import { FileProvider } from '@/contexts/FileContext';

export default function TestPage() {
  const { files } = useFiles();
  
  return (
    <FileProvider>
      <div className="container mx-auto py-6">
        <h1 className="text-2xl font-bold mb-4">Test Page</h1>
        <FileList
          files={files}
        />
      </div>
    </FileProvider>
  );
} 