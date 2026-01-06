const supabaseUrl = 'https://ianpwqntmwqaycgvhukq.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlhbnB3cW50bXdxYXljZ3ZodWtxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc2NjcwMzcsImV4cCI6MjA4MzI0MzAzN30.A5f8Knc9Sgr56NGWlgAu72jVSXehR8Ew7xFuLBloYXc';

window.supabaseClient = supabase.createClient(supabaseUrl, supabaseAnonKey);

document.addEventListener('DOMContentLoaded', async () => {
  const { data: { user } } = await window.supabaseClient.auth.getUser();

  // Auth Guard
  const isLoginPage = window.location.pathname.endsWith('index.html') || window.location.pathname === '/';
  if (!user && !isLoginPage) {
    window.location.href = 'index.html';
    return;
  }

  // Load Navbar
  const navContainer = document.getElementById('navbar');
  if (navContainer) {
    const res = await fetch('components/navbar.html');
    if (res.ok) navContainer.innerHTML = await res.text();
  }

  // Login Logic (hanya jika di index.html)
  const loginForm = document.getElementById('login-form');
  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = document.getElementById('emailInput').value;
      const password = document.getElementById('passwordInput').value;
      const { error } = await window.supabaseClient.auth.signInWithPassword({ email, password });
      
      if (error) {
        document.getElementById('info').innerText = error.message;
      } else {
        window.location.href = 'dashboard.html';
      }
    });
  }
});

// Logout global
document.addEventListener('click', async (e) => {
  if (e.target.id === 'btnLogout') {
    await window.supabaseClient.auth.signOut();
    window.location.href = 'index.html';
  }
});