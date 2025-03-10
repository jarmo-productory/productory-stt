import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import { FileObject } from "@/contexts/FileContext";
import { storagePathUtil } from "@/lib/utils/storage";

/**
 * Service for handling file-related operations
 */
export class FileService {
  /**
   * Fetches file details by ID
   * @param fileId The ID of the file to fetch
   * @returns The file details and folder name if applicable
   */
  static async fetchFileDetails(fileId: string): Promise<{
    fileData: FileObject | null;
    folderName: string;
    folderId: string | null;
  }> {
    const supabase = createClientComponentClient();
    let fileData: FileObject | null = null;
    let folderName = "";
    let folderId: string | null = null;

    try {
      const { data, error } = await supabase
        .from('audio_files')
        .select('*')
        .eq('id', fileId)
        .single();
      
      if (data && !error) {
        folderId = data.folder_id;
        
        // Convert database record to FileObject format
        fileData = {
          id: data.id,
          name: data.file_name,
          size: data.size || 0,
          created_at: data.created_at,
          duration: data.duration,
          status: data.status as any,
          metadata: data.metadata,
          folder_id: data.folder_id,
          file_name: data.file_name,
          file_path: data.file_path,
          format: data.format,
          // Include these fields for the trigger to work correctly
          storage_prefix: data.storage_prefix,
          bucket_name: data.bucket_name,
          normalized_path: data.normalized_path
        };
        
        // If there's a folder_id, fetch the folder name
        if (data.folder_id) {
          const { data: folderData, error: folderError } = await supabase
            .from('folders')
            .select('name')
            .eq('id', data.folder_id)
            .single();
          
          if (folderData && !folderError) {
            folderName = folderData.name;
          }
        }
      } else {
        console.error("Error fetching file details:", error);
      }
    } catch (error) {
      console.error("Exception fetching file details:", error);
    }

    return { fileData, folderName, folderId };
  }

  /**
   * Renames a file
   * @param fileId The ID of the file to rename
   * @param fileData The current file data
   * @param newName The new name for the file
   * @param userId The ID of the user performing the rename
   * @returns The updated file data if successful
   */
  static async renameFile(
    fileId: string,
    fileData: FileObject,
    newName: string,
    userId: string
  ): Promise<FileObject | null> {
    const supabase = createClientComponentClient();
    
    try {
      console.log('Renaming file:', { 
        fileId, 
        currentName: fileData.file_name, 
        newName,
        currentPath: fileData.file_path,
        storagePrefix: fileData.storage_prefix,
        normalizedPath: fileData.normalized_path
      });
      
      // First, update the file_name in the database
      // The database trigger will handle updating the file_path
      const { data: updatedData, error: updateError } = await supabase
        .from('audio_files')
        .update({ file_name: newName })
        .eq('id', fileId)
        .select()
        .single();
      
      if (updateError) {
        console.error("Error updating file record:", updateError);
        throw updateError;
      }
      
      console.log('Database update successful:', updatedData);
      
      // If we have file paths, try to handle the storage operations
      // But don't fail the rename if storage operations fail
      if (fileData.file_path && updatedData.file_path && fileData.file_path !== updatedData.file_path) {
        try {
          // Try different possible paths for the source file
          const possibleSourcePaths = [
            fileData.file_path,
            fileData.normalized_path,
            // If the path doesn't include the storage prefix, try with it
            fileData.file_path.includes('audio/') ? fileData.file_path : `audio/${userId}/${fileData.file_path}`
          ].filter(Boolean); // Remove any undefined/null values
          
          const newPath = updatedData.file_path;
          let copySuccessful = false;
          
          console.log('Trying possible source paths:', possibleSourcePaths);
          
          // Try each possible source path until one works
          for (const sourcePath of possibleSourcePaths) {
            if (!sourcePath) continue;
            
            try {
              console.log(`Attempting to copy from ${sourcePath} to ${newPath}`);
              const { data: copyData, error: copyError } = await supabase
                .storage
                .from(fileData.bucket_name || 'audio-files')
                .copy(sourcePath, newPath);
                
              if (!copyError) {
                console.log('File copied successfully:', copyData);
                copySuccessful = true;
                
                // Try to delete the original file
                try {
                  const { error: deleteError } = await supabase
                    .storage
                    .from(fileData.bucket_name || 'audio-files')
                    .remove([sourcePath]);
                    
                  if (deleteError) {
                    console.warn("Warning: Could not delete original file from storage:", deleteError);
                  } else {
                    console.log(`Successfully deleted original file: ${sourcePath}`);
                  }
                } catch (deleteErr) {
                  console.warn("Exception deleting original file:", deleteErr);
                }
                
                break; // Exit the loop if copy was successful
              } else {
                console.warn(`Failed to copy from ${sourcePath}:`, copyError);
              }
            } catch (err) {
              console.warn(`Exception copying from ${sourcePath}:`, err);
            }
          }
          
          if (!copySuccessful) {
            console.warn("Could not copy file to new location. The file may need to be re-uploaded.");
          }
        } catch (storageErr) {
          console.error("Exception during storage operations:", storageErr);
          // Don't throw, just log the error
        }
      }
      
      // Return updated file data
      return {
        ...fileData,
        name: newName,
        file_name: newName,
        file_path: updatedData.file_path,
        normalized_path: updatedData.normalized_path
      };
    } catch (error) {
      console.error("Error during file rename process:", error);
      return null;
    }
  }

  /**
   * Deletes a file (marks it as deleted)
   * @param fileId The ID of the file to delete
   * @returns True if the deletion was successful, false otherwise
   */
  static async deleteFile(fileId: string): Promise<boolean> {
    const supabase = createClientComponentClient();
    
    try {
      const { error } = await supabase
        .from('audio_files')
        .update({ status: 'deleted' })
        .eq('id', fileId);
      
      if (error) {
        console.error("Error deleting file:", error);
        return false;
      }
      
      return true;
    } catch (error) {
      console.error("Exception deleting file:", error);
      return false;
    }
  }

  /**
   * Exports a file (placeholder for now)
   * @param fileId The ID of the file to export
   */
  static async exportFile(fileId: string): Promise<void> {
    // This is a placeholder for the export functionality
    // Will be implemented in task 6.6
    console.log(`Export functionality for file ${fileId} will be implemented in task 6.6`);
    alert("Export functionality will be implemented in task 6.6");
  }
} 