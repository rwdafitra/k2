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

// ===============================
// AUTH STATE DEBUG (AMAN DIBIARKAN)
// ===============================
supabaseClient.auth.onAuthStateChange((event, session) => {
  console.log('AUTH EVENT:', event, session);
});

// ===============================
// AUTH GUARD + NAVBAR
// ===============================
document.addEventListener('DOMContentLoaded', async () => {
  const { data, error } = await supabaseClient.auth.getSession();
  console.log('SESSION:', data, error);

  const user = data?.session?.user;

  const isLoginPage =
    location.pathname === '/' ||
    location.pathname.endsWith('index.html');

  // ===============================
  // PROTEKSI HALAMAN
  // ===============================
  if (!user && !isLoginPage) {
    location.replace('index.html');
    return;
  }

  if (user && isLoginPage) {
    location.replace('dashboard.html');
    return;
  }

  // ===============================
  // NAVBAR (HANYA JIKA LOGIN)
  // ===============================
  if (user) {
    const navContainer = document.getElementById('navbar');

    if (navContainer) {
      navContainer.innerHTML = `
        <nav class="bg-white border-b border-slate-200 shadow-sm">
          <div class="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
            <div class="text-xl font-extrabold text-slate-800">
              MiningInspect
            </div>

            <div class="flex items-center gap-4">
              <span class="text-sm text-slate-600 hidden sm:block">
                ${user.email}
              </span>

              <button
                id="btnLogout"
                class="px-4 py-2 rounded-lg bg-red-600 text-white font-bold hover:bg-red-700 transition"
              >
                Logout
              </button>
            </div>
          </div>
        </nav>
      `;

      const btnLogout = document.getElementById('btnLogout');

      btnLogout.addEventListener('click', async () => {
        await supabaseClient.auth.signOut();
        location.replace('index.html');
      });
    }
  }
});
