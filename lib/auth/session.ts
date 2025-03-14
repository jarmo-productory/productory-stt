'use server';

import { createClient } from '@/lib/supabase/server';

export async function getUser() {
  const supabase = await createClient();
  
  try {
    const { data: { user }, error } = await supabase.auth.getUser();
    
    if (error || !user) {
      return null;
    }
    
    return user;
  } catch (error) {
    console.error('Error getting user session:', error);
    return null;
  }
} 