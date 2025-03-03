'use client';

import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { useEffect, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';

export function useSupabase() {
  const [supabase] = useState(() => createClientComponentClient());
  
  return supabase;
} 