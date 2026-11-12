/* Les Vainqueurs Academy - administration login and password recovery
   Uses only the Supabase publishable key in the browser.
   Never place a service_role or secret key in this file. */
const SUPABASE_URL = 'https://qxcpyvhdxzijtozqlycv.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_NbDxrLQLCeUdwdZilhuptA_QJ2lxcg0';

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
const loginView = document.getElementById('login-view');
const dashboardView = document.getElementById('dashboard-view');
const loginForm = document.getElementById('login-form');
const loginButton = document.getElementById('login-button');
const loginMessage = document.getElementById('login-message');
const dashboardMessage = document.getElementById('dashboard-message');
const resetRequestView = document.getElementById('reset-request-view');
const newPasswordView = document.getElementById('new-password-view');

document.getElementById('year').textContent = new Date().getFullYear();

function showLogin(message = '') {
  dashboardView.classList.add('hidden');
  loginView.classList.remove('hidden');
  loginMessage.textContent = message;
}
function showDashboard(user, departmentCount) {
  loginView.classList.add('hidden');
  dashboardView.classList.remove('hidden');
  document.getElementById('admin-email').textContent = user.email || '';
  document.getElementById('department-count').textContent = departmentCount;
  dashboardMessage.textContent = '';
}
async function verifyAdministrator(user) {
  const { data: profile, error } = await supabaseClient
    .from('profiles').select('role').eq('id', user.id).maybeSingle();
  if (error) throw error;
  if (!profile || profile.role !== 'super_admin') {
    await supabaseClient.auth.signOut();
    throw new Error('Ce compte ne possède pas le rôle Super Administrateur.');
  }
  const { count, error: departmentError } = await supabaseClient
    .from('departments').select('*', { count: 'exact', head: true });
  if (departmentError) throw departmentError;
  showDashboard(user, count ?? 0);
}

loginForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  loginButton.disabled = true;
  loginButton.textContent = 'Connexion...';
  loginMessage.textContent = '';
  try {
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;
    const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
    if (error) throw error;
    await verifyAdministrator(data.user);
  } catch (error) {
    loginMessage.textContent = error.message || 'Connexion impossible. Réessayez.';
  } finally {
    loginButton.disabled = false;
    loginButton.textContent = 'Se connecter';
  }
});

document.getElementById('forgot-password-button').addEventListener('click', () => {
  resetRequestView.classList.toggle('hidden');
  newPasswordView.classList.add('hidden');
  const currentEmail = document.getElementById('email').value.trim();
  if (currentEmail) document.getElementById('reset-email').value = currentEmail;
});

document.getElementById('reset-request-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const button = document.getElementById('reset-request-button');
  const message = document.getElementById('reset-request-message');
  button.disabled = true;
  message.textContent = 'Envoi en cours...';
  try {
    const email = document.getElementById('reset-email').value.trim();
    const redirectTo = `${window.location.origin}${window.location.pathname}?mode=reset`;
    const { error } = await supabaseClient.auth.resetPasswordForEmail(email, { redirectTo });
    if (error) throw error;
    message.textContent = 'Si ce compte existe, un lien de réinitialisation sera envoyé par e-mail.';
  } catch (error) {
    message.textContent = error.message || 'Impossible d’envoyer le lien.';
  } finally {
    button.disabled = false;
  }
});

document.getElementById('new-password-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const button = document.getElementById('new-password-button');
  const message = document.getElementById('new-password-message');
  const password = document.getElementById('new-password').value;
  const confirmation = document.getElementById('confirm-password').value;
  if (password.length < 8) {
    message.textContent = 'Le mot de passe doit contenir au moins 8 caractères.';
    return;
  }
  if (password !== confirmation) {
    message.textContent = 'Les deux mots de passe ne correspondent pas.';
    return;
  }
  button.disabled = true;
  message.textContent = 'Enregistrement en cours...';
  try {
    const { error } = await supabaseClient.auth.updateUser({ password });
    if (error) throw error;
    await supabaseClient.auth.signOut();
    newPasswordView.classList.add('hidden');
    resetRequestView.classList.add('hidden');
    showLogin('Mot de passe modifié. Vous pouvez maintenant vous connecter.');
  } catch (error) {
    message.textContent = error.message || 'Impossible de modifier le mot de passe.';
  } finally {
    button.disabled = false;
  }
});

document.getElementById('logout-button').addEventListener('click', async () => {
  const { error } = await supabaseClient.auth.signOut();
  if (error) {
    dashboardMessage.textContent = error.message;
    return;
  }
  showLogin('Vous êtes déconnecté.');
});

// Supabase JS reads the recovery session from the email redirect URL.
// Only display the password form after a valid PASSWORD_RECOVERY event.
supabaseClient.auth.onAuthStateChange((event, session) => {
  if (event === 'PASSWORD_RECOVERY' && session) {
    loginView.classList.remove('hidden');
    dashboardView.classList.add('hidden');
    resetRequestView.classList.add('hidden');
    newPasswordView.classList.remove('hidden');
    loginMessage.textContent = '';
  }
});

async function restoreSession() {
  const { data: { session }, error } = await supabaseClient.auth.getSession();
  if (error) {
    showLogin('Impossible de vérifier la session.');
    return;
  }
  if (!session) return;
  // Recovery sessions are handled by PASSWORD_RECOVERY above.
  if (new URLSearchParams(window.location.search).get('mode') === 'reset') return;
  try {
    await verifyAdministrator(session.user);
  } catch (error) {
    showLogin(error.message || 'Accès non autorisé.');
  }
}
restoreSession();
