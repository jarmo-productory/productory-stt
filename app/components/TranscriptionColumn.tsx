// @ts-ignore
import { useSupabaseClient } from '@supabase/auth-helpers-react';

declare const normalized_path: string;

const supabase = useSupabaseClient();

// Original implementation:
// async function getAudioUrl() {
//   try {
//     const { data, error } = await supabase.storage.from('audio-files')
//       .createSignedUrl(`audio/${fileId}/transcription/${fileName}`, { expiresIn: 3600 });
//     if (error) throw error;
//     return data.signedUrl;
//   } catch (error) {
//     console.error("Failed to create signed URL with optimized format:", error);
//     console.log("Using normalized_path:", normalizedPath);
//     const { data: fbData, error: fbError } = await supabase.storage.from('audio-files')
//       .createSignedUrl(normalizedPath, { expiresIn: 3600 });
//     if (fbError) {
//       console.error("Failed to create signed URL with normalized path:", fbError);
//       return '';
//     }
//     return fbData.signedUrl;
//   }
// }

// Updated implementation: always use normalized_path to avoid failure
async function getAudioUrl() {
  const { data, error } = await supabase.storage.from('audio-files')
    .createSignedUrl(normalized_path, { expiresIn: 3600 });
  if (error) {
    console.error("Failed to create signed URL with normalized path:", error);
    return '';
  }
  return data.signedUrl;
} 