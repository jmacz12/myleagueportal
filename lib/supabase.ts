import { createClient } from '@supabase/supabase-js'
import { useAuth } from '@clerk/nextjs'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// Basic client — for public pages (registration form, league join, stream box score realtime, etc.)
export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Authenticated client — for dashboard (attaches Clerk token so RLS works)
export function useSupabaseClient() {
  const { getToken } = useAuth()

  return createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      fetch: async (url, options = {}) => {
        const token = await getToken({ template: 'supabase' })
        return fetch(url, {
          ...options,
          headers: {
            ...options.headers,
            Authorization: `Bearer ${token}`,
          },
        })
      },
    },
  })
}