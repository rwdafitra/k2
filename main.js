const supabaseUrl = 'https://ianpwqntmwqaycgvhukq.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlhbnB3cW50bXdxYXljZ3ZodWtxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc2NjcwMzcsImV4cCI6MjA4MzI0MzAzN30.A5f8Knc9Sgr56NGWlgAu72jVSXehR8Ew7xFuLBloYXc';

const client = supabase.createClient(
  supabaseUrl,
  supabaseAnonKey
);

const form = document.getElementById('login-form');
const emailInput = document.getElementById('emailInput');
const passwordInput = document.getElementById('passwordInput');
const info = document.getElementById('info');

form.addEventListener('submit', async (e) => {
  e.preventDefault();

  const { error } = await client.auth.signInWithPassword({
    email: emailInput.value,
    password: passwordInput.value
  });

  if (error) {
    info.innerText = error.message;
  } else {
    info.innerText = 'Login berhasil';
  }
});
