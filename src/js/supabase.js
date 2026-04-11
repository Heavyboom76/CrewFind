import { createClient } from '@supabase/supabase-js'

export const sb = createClient(
  'https://sfozlgthgvphkntxbhgn.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNmb3psZ3RoZ3ZwaGtudHhiaGduIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM5MDA5MzAsImV4cCI6MjA4OTQ3NjkzMH0.aPPT8O29hEQKw3uf29FWSyyBJxv1GT7_YtF83dRx2n4'
)