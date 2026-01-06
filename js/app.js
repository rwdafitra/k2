// === SUPABASE CLIENT ===
const supabaseUrl = 'https://ianpwqntmwqaycgvhukq.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlhbnB3cW50bXdxYXljZ3ZodWtxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc2NjcwMzcsImV4cCI6MjA4MzI0MzAzN30.A5f8Knc9Sgr56NGWlgAu72jVSXehR8Ew7xFuLBloYXc';

window.supabaseClient = supabase.createClient(supabaseUrl, supabaseAnonKey);

// === AUTH GUARD & INITIALIZATION ===
document.addEventListener('DOMContentLoaded', async () => {
    // 1. Cek Sesi User
    const { data: { session }, error: authError } = await window.supabaseClient.auth.getSession();
    const user = session?.user;

    // 2. Proteksi Halaman
    const isLoginPage = window.location.pathname.endsWith('index.html') || window.location.pathname === '/';
    
    if (!user && !isLoginPage) {
        window.location.href = 'index.html';
        return;
    }

    if (user && isLoginPage) {
        window.location.href = 'dashboard.html';
        return;
    }

    // 3. Load Navbar (jika user login)
    if (user) {
        const navContainer = document.getElementById('navbar');
        if (navContainer) {
            try {
                const res = await fetch('components/navbar.html');
                navContainer.innerHTML = await res.text();
                
                // Aktifkan tombol logout setelah navbar dimuat
                const btnLogout = document.getElementById('btnLogout');
                if (btnLogout) {
                    btnLogout.addEventListener('click', async () => {
                        await window.supabaseClient.auth.signOut();
                        window.location.href = 'index.html';
                    });
                }
            } catch (err) {
                console.error("Gagal memuat navbar:", err);
            }
        }
    }
});