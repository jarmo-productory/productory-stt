import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

type OwnershipResult = {
  isOwner: boolean;
  fileExists: boolean;
  error?: string;
  status?: number;
};

/**
 * Verifies if a user owns a specific file
 * @param userId The ID of the user
 * @param fileId The ID of the file to check
 * @returns Object containing ownership status and file existence
 */
export async function verifyFileOwnership(userId: string, fileId: string): Promise<OwnershipResult> {
  if (!userId || !fileId) {
    return {
      isOwner: false,
      fileExists: false,
      error: 'Invalid user ID or file ID',
      status: 400
    };
  }

  try {
    const cookieStore = cookies();
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore });

    // Check if the file exists and belongs to the user
    const { data, error } = await supabase
      .from('audio_files')
      .select('id, user_id')
      .eq('id', fileId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // PGRST116 is the error code for "no rows returned"
        return {
          isOwner: false,
          fileExists: false,
          error: 'File not found',
          status: 404
        };
      }
      
      return {
        isOwner: false,
        fileExists: false,
        error: 'Database error',
        status: 500
      };
    }

    if (!data) {
      return {
        isOwner: false,
        fileExists: false,
        error: 'File not found',
        status: 404
      };
    }

    const isOwner = data.user_id === userId;

    return {
      isOwner,
      fileExists: true,
      ...(isOwner ? {} : {
        error: 'You do not have permission to access this file',
        status: 403
      })
    };
  } catch (error) {
    console.error('Error verifying file ownership:', error);
    return {
      isOwner: false,
      fileExists: false,
      error: 'Server error',
      status: 500
    };
  }
}

/**
 * Creates a response for file ownership errors
 * @param result The ownership verification result
 * @returns NextResponse with appropriate error status and message
 */
export function createOwnershipErrorResponse(result: OwnershipResult): NextResponse {
  return NextResponse.json(
    { error: result.error || 'Access denied' },
    { status: result.status || 403 }
  );
} 