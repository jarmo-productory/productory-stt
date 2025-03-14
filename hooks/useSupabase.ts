'use client';

import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { useState } from 'react';

export function useSupabase() {
  const [supabase] = useState(() => createClientComponentClient());
  
  return supabase;
} 