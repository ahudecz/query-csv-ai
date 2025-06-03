
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://kvxxdejpqvwwgisluhbs.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt2eHhkZWpwcXZ3d2dpc2x1aGJzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDg4NzQ3OTEsImV4cCI6MjA2NDQ1MDc5MX0.jGw4sLOKASiPFvm7IckX34USYMGPItqHngB9aLlvCMc'

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: typeof window !== 'undefined' ? window.localStorage : undefined,
    persistSession: true,
    autoRefreshToken: true,
  }
})
