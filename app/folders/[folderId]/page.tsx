import { FileProvider } from '@/contexts/FileContext';

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
