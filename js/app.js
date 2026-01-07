const supabaseUrl = 'https://ianpwqntmwqaycgvhukq.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlhbnB3cW50bXdxYXljZ3ZodWtxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc2NjcwMzcsImV4cCI6MjA4MzI0MzAzN30.A5f8Knc9Sgr56NGWlgAu72jVSXehR8Ew7xFuLBloYXc';

// Gunakan window agar bisa diakses script lain
window.supabaseClient = supabase.createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true
  }
});

document.addEventListener('DOMContentLoaded', async () => {
  const { data: { session } } = await window.supabaseClient.auth.getSession();
  const user = session?.user;

  const isLoginPage = location.pathname.endsWith('index.html') || location.pathname === '/';

  // Proteksi Halaman: Jika belum login, tendang ke index.html
  if (!user && !isLoginPage) {
    location.replace('index.html');
    return;
  }

  // Jika sudah login, jangan biarkan ke halaman login
  if (user && isLoginPage) {
    location.replace('dashboard.html');
    return;
  }

  // Render Navbar jika user login
  if (user) {
    const nav = document.getElementById('navbar');
    if (nav) {
      nav.innerHTML = `
        <nav class="bg-white border-b border-slate-200 shadow-sm mb-6">
          <div class="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
            <div class="text-xl font-extrabold text-blue-700">MiningInspect</div>
            <div class="flex items-center gap-4">
              <span class="text-sm text-slate-500 hidden sm:block">${user.email}</span>
              <button id="btnLogout" class="px-4 py-2 bg-red-600 text-white rounded-lg font-bold hover:bg-red-700 transition">Logout</button>
            </div>
          </div>
        </nav>
      `;
      document.getElementById('btnLogout').addEventListener('click', async () => {
        await window.supabaseClient.auth.signOut();
        location.replace('index.html');
      });
    }
  }
});