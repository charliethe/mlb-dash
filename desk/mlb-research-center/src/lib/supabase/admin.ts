import { createClient, type SupabaseClient } from '@supabase/supabase-js'

let adminInstance: SupabaseClient | null = null

export function getSupabaseAdmin() {
  if (adminInstance) return adminInstance

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !serviceKey) {
    console.warn(
      'Supabase admin env vars missing. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.'
    )
    return null
  }

  adminInstance = createClient(url, serviceKey, {
    auth: { persistSession: false },
  })

  return adminInstance
}
