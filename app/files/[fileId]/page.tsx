import { AppLayout } from "@/app/components/layout/AppLayout";
import { Breadcrumbs } from "@/app/components/layout/Breadcrumbs";
import ClientFileDetailsPage from './ClientFileDetailsPage';

export default async function FileDetailsPage({ params }: { params: { fileId: string } }) {
  // In server components, we need to await params
  const unwrappedParams = await Promise.resolve(params);
  const fileId = unwrappedParams.fileId;
  
  // Pass the fileId to the client component
  return <ClientFileDetailsPage fileId={fileId} />;
}
