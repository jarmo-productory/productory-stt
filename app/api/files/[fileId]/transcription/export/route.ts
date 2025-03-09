import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest, createAuthErrorResponse } from '@/lib/auth';
import { verifyFileOwnership, createOwnershipErrorResponse } from '@/lib/files';
import { exportTranscription } from '@/lib/transcriptions';

/**
 * GET /api/files/:fileId/transcription/export
 * Exports transcription data in the specified format
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { fileId: string } }
) {
  // Authenticate the request
  const authResult = await authenticateRequest(req);
  if (!authResult.userId) {
    return createAuthErrorResponse(authResult);
  }

  const { fileId } = params;

  // Verify file ownership
  const ownershipResult = await verifyFileOwnership(authResult.userId, fileId);
  if (!ownershipResult.isOwner) {
    return createOwnershipErrorResponse(ownershipResult);
  }

  // Get format from query parameters
  const searchParams = req.nextUrl.searchParams;
  const format = (searchParams.get('format') || 'txt') as 'txt' | 'srt';

  // Validate format
  if (format !== 'txt' && format !== 'srt') {
    return NextResponse.json(
      { error: 'Unsupported export format' },
      { status: 400 }
    );
  }

  try {
    // Export the transcription
    const exportedData = await exportTranscription(fileId, authResult.userId, format);
    
    // Set appropriate content type and filename
    const contentType = format === 'txt' ? 'text/plain' : 'application/x-subrip';
    const filename = `transcription-${fileId}.${format}`;
    
    // Create response with appropriate headers
    const response = new NextResponse(exportedData, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${filename}"`
      }
    });
    
    return response;
  } catch (error) {
    console.error('Error exporting transcription:', error);
    
    if (error instanceof Error && error.message === 'No transcription data available for export') {
      return NextResponse.json(
        { error: 'No transcription data available for export' },
        { status: 404 }
      );
    }
    
    return NextResponse.json(
      { error: 'Failed to export transcription' },
      { status: 500 }
    );
  }
} 