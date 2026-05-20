import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = "https://iefnatpzvjoczbrqsytj.supabase.co"
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImllZm5hdHB6dmpvY3picnFzeXRqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg0Mjg5NzcsImV4cCI6MjA5NDAwNDk3N30.8KrXplbByNasfkBL6ruHslOfVQJb8-wfpWxRuj8zFTw"

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)