const form = document.getElementById('login-form');
const emailInput = document.getElementById('emailInput');
const passwordInput = document.getElementById('passwordInput');
const info = document.getElementById('info');

form.addEventListener('submit', async (e) => {
  e.preventDefault();

  const { error } = await supabaseClient.auth.signInWithPassword({
    email: emailInput.value,
    password: passwordInput.value
  });

  if (error) {
    info.innerText = error.message;
  } else {
    window.location.href = 'dashboard.html';
  }
});
