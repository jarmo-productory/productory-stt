import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import { FileObject } from "@/contexts/FileContext";

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
          name: data.metadata?.display_name || data.file_name,
          size: data.size || 0,
          created_at: data.created_at,
          duration: data.duration,
          status: data.status as FileObject['status'],
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
   * Renames a file by updating its display name in metadata
   * @param fileId The ID of the file to rename
   * @param fileData The current file data
   * @param newName The new display name for the file
   * @returns The updated file data if successful
   */
  static async renameFile(
    fileId: string,
    fileData: FileObject,
    newName: string
  ): Promise<FileObject | null> {
    const supabase = createClientComponentClient();
    
    try {
      console.log('Renaming file display name:', { 
        fileId, 
        currentName: fileData.name || fileData.file_name, 
        newName
      });
      
      // Get current metadata or initialize empty object
      const metadata = fileData.metadata || {};
      
      // Update the display_name in metadata
      const updatedMetadata = {
        ...metadata,
        display_name: newName
      };
      
      // Only update the metadata field, not file_name or file_path
      const { data: updatedData, error: updateError } = await supabase
        .from('audio_files')
        .update({ 
          metadata: updatedMetadata
        })
        .eq('id', fileId)
        .select()
        .single();
      
      if (updateError) {
        console.error("Error updating file record:", updateError);
        throw updateError;
      }
      
      console.log('Database update successful:', updatedData);
      
      // Return updated file data
      return {
        ...fileData,
        name: newName, // Update the name property for UI
        metadata: updatedMetadata,
        // Keep original file_name and file_path unchanged
        file_name: fileData.file_name,
        file_path: fileData.file_path,
        normalized_path: fileData.normalized_path
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