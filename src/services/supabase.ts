import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Clean up potential stringified "undefined" or empty strings
let cleanUrl = (supabaseUrl && supabaseUrl !== 'undefined' && supabaseUrl !== 'null' && supabaseUrl !== '') ? supabaseUrl : undefined;
const cleanKey = (supabaseAnonKey && supabaseAnonKey !== 'undefined' && supabaseAnonKey !== 'null' && supabaseAnonKey !== '') ? supabaseAnonKey : undefined;

// Basic URL validation
if (cleanUrl && !cleanUrl.startsWith('http')) {
  console.warn('Supabase URL is missing protocol (http/https). Adding https://');
  cleanUrl = `https://${cleanUrl}`;
}

if (!cleanUrl || !cleanKey) {
  console.warn('Supabase URL or Anon Key is missing. Please check your environment variables.');
} else {
  // Log masked URL for debugging without exposing full key
  const maskedUrl = cleanUrl.replace(/(https?:\/\/)(.*)/, '$1***$2'.slice(0, 15) + '...');
  console.log(`Supabase initialized with URL: ${maskedUrl}`);
}

export const supabase = (cleanUrl && cleanKey) 
  ? createClient(cleanUrl, cleanKey)
  : null;
