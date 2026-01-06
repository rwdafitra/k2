const supabaseUrl = 'https://ianpwqntmwqaycgvhukq.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlhbnB3cW50bXdxYXljZ3ZodWtxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc2NjcwMzcsImV4cCI6MjA4MzI0MzAzN30.A5f8Knc9Sgr56NGWlgAu72jVSXehR8Ew7xFuLBloYXc';

window.supabaseClient = supabase.createClient(
  supabaseUrl,
  supabaseAnonKey,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true
    }
  }
);

supabaseClient.auth.onAuthStateChange((event, session) => {
  console.log('AUTH EVENT:', event, session);
});

document.addEventListener('DOMContentLoaded', async () => {
  const { data, error } = await supabaseClient.auth.getSession();
  console.log('SESSION:', data, error);

  const user = data?.session?.user;
  const isLoginPage =
    location.pathname === '/' ||
    location.pathname.endsWith('index.html');

  if (!user && !isLoginPage) {
    location.replace('index.html');
    return;
  }

  if (user && isLoginPage) {
    location.replace('dashboard.html');
  }
});
