export type Database = {
  public: {
    Tables: {
      folders: {
        Row: {
          id: string;
          name: string;
          user_id: string;
          parent_id: string | null;
          created_at: string;
          updated_at: string;
          is_deleted: boolean;
          deleted_at: string | null;
          metadata: any | null;
        };
        Insert: {
          id?: string;
          name: string;
          user_id: string;
          parent_id?: string | null;
          created_at?: string;
          updated_at?: string;
          is_deleted?: boolean;
          deleted_at?: string | null;
          metadata?: any | null;
        };
        Update: {
          id?: string;
          name?: string;
          user_id?: string;
          parent_id?: string | null;
          created_at?: string;
          updated_at?: string;
          is_deleted?: boolean;
          deleted_at?: string | null;
          metadata?: any | null;
        };
      };
      audio_files: {
        Row: {
          id: string;
          user_id: string;
          file_name: string;
          file_path: string;
          duration: number | null;
          size: number | null;
          format: string | null;
          created_at: string;
          updated_at: string;
          status: string;
          metadata: any | null;
          folder_id: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          file_name: string;
          file_path: string;
          duration?: number | null;
          size?: number | null;
          format?: string | null;
          created_at?: string;
          updated_at?: string;
          status?: string;
          metadata?: any | null;
          folder_id?: string | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          file_name?: string;
          file_path?: string;
          duration?: number | null;
          size?: number | null;
          format?: string | null;
          created_at?: string;
          updated_at?: string;
          status?: string;
          metadata?: any | null;
          folder_id?: string | null;
        };
      };
      users: {
        Row: {
          id: string;
          email: string;
          created_at: string;
          updated_at: string;
          full_name: string | null;
          avatar_url: string | null;
          metadata: any | null;
        };
        Insert: {
          id: string;
          email: string;
          created_at?: string;
          updated_at?: string;
          full_name?: string | null;
          avatar_url?: string | null;
          metadata?: any | null;
        };
        Update: {
          id?: string;
          email?: string;
          created_at?: string;
          updated_at?: string;
          full_name?: string | null;
          avatar_url?: string | null;
          metadata?: any | null;
        };
      };
      user_trials: {
        Row: {
          id: string;
          user_id: string;
          trial_start_time: string;
          trial_end_time: string;
          is_trial_used: boolean;
        };
        Insert: {
          id?: string;
          user_id: string;
          trial_start_time?: string;
          trial_end_time?: string;
          is_trial_used?: boolean;
        };
        Update: {
          id?: string;
          user_id?: string;
          trial_start_time?: string;
          trial_end_time?: string;
          is_trial_used?: boolean;
        };
      };
    };
  };
}; 