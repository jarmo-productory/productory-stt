'use server';

import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

export async function createClient(useServiceRole = false) {
  if (useServiceRole) {
    // Use service role for worker API
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing Supabase service role credentials');
    }
    
    return createSupabaseClient(supabaseUrl, supabaseServiceKey);
  }
  
  // Use normal client for authenticated users
  return createServerComponentClient({ cookies });
} 