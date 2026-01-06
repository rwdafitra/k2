const form = document.getElementById('login-form');

form.addEventListener('submit', async (e) => {
  e.preventDefault();

  const { data, error } = await supabaseClient.auth.signInWithPassword({
    email: emailInput.value,
    password: passwordInput.value
  });

  console.log('LOGIN RESULT:', data, error);

  if (error) {
    info.innerText = error.message;
    return;
  }

  location.replace('dashboard.html');
});
