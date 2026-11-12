/* Les Vainqueurs Academy - administration login
   Uses only the Supabase publishable key in the browser.
   Never place a service_role or secret key in this file. */

const SUPABASE_URL = 'https://qxcpyvhdxzijtozqlycv.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_NbDxrLQLCeUdwdZilhuptA_QJ2lxcg0';

const supabaseClient = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY
);

const loginView = document.getElementById('login-view');
const dashboardView = document.getElementById('dashboard-view');
const loginForm = document.getElementById('login-form');
const loginButton = document.getElementById('login-button');
const loginMessage = document.getElementById('login-message');
const dashboardMessage = document.getElementById('dashboard-message');

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
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();

  if (error) throw error;

  if (!profile || profile.role !== 'super_admin') {
    await supabaseClient.auth.signOut();
    throw new Error('Ce compte ne possède pas le rôle Super Administrateur.');
  }

  const { count, error: departmentError } = await supabaseClient
    .from('departments')
    .select('*', { count: 'exact', head: true });

  if (departmentError) throw departmentError;

  showDashboard(user, count ?? 0);
}

loginForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  loginButton.disabled = true;
  loginButton.textContent = 'Connexion...';
  loginMessage.textContent = '';

  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;

  try {
    const { data, error } = await supabaseClient.auth.signInWithPassword({
      email,
      password
    });

    if (error) throw error;
    await verifyAdministrator(data.user);
  } catch (error) {
    loginMessage.textContent = error.message || 'Connexion impossible. Réessayez.';
  } finally {
    loginButton.disabled = false;
    loginButton.textContent = 'Se connecter';
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

async function restoreSession() {
  const { data: { session }, error } = await supabaseClient.auth.getSession();
  if (error) {
    showLogin('Impossible de vérifier la session.');
    return;
  }
  if (!session) return;

  try {
    await verifyAdministrator(session.user);
  } catch (error) {
    showLogin(error.message || 'Accès non autorisé.');
  }
}

restoreSession();
