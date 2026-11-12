
const SUPABASE_URL = 'https://qxcpyvhdxzijtozqlycv.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_NbDxrLQLCeUdwdZilhuptA_QJ2lxcg0';

const supabaseClient = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY
);

const $ = (id) => document.getElementById(id);

$('year').textContent = new Date().getFullYear();

const loginView = $('login-view');
const dashboardView = $('dashboard-view');

function showLogin(message = '') {
  dashboardView.classList.add('hidden');
  loginView.classList.remove('hidden');
  $('login-message').textContent = message;
}

function showDashboard(user) {
  loginView.classList.add('hidden');
  dashboardView.classList.remove('hidden');
  $('admin-email').textContent = user.email || '';
}

async function verifyAdministrator(user) {
  const { data, error } = await supabaseClient
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();

  if (error) throw error;

  if (!data || data.role !== 'super_admin') {
    await supabaseClient.auth.signOut();
    throw new Error('Accès réservé au Super Administrateur.');
  }

  showDashboard(user);
  await loadDashboard();
}

async function loadDashboard() {
  $('dashboard-message').textContent = 'Chargement...';
  $('refresh-button').disabled = true;

  try {
    const results = await Promise.all([
      supabaseClient.from('applications')
        .select('id', { count: 'exact', head: true }),

      supabaseClient.from('applications')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'Nouvelle candidature'),

      supabaseClient.from('applications')
        .select('id', { count: 'exact', head: true })
        .in('status', ['En cours', 'En traitement', 'En cours de traitement']),

      supabaseClient.from('applications')
        .select('id', { count: 'exact', head: true })
        .in('status', ['Admis', 'Admise', 'Acceptée', 'Accepté']),

      supabaseClient.from('departments')
        .select('id, name')
        .order('name'),

      supabaseClient.from('applications')
        .select('full_name, department, desired_training, status, created_at')
        .order('created_at', { ascending: false })
        .limit(8),

      supabaseClient.from('applications')
        .select('department')
    ]);

    for (const result of results) {
      if (result.error) throw result.error;
    }

    $('total-count').textContent = results[0].count ?? 0;
    $('new-count').textContent = results[1].count ?? 0;
    $('progress-count').textContent = results[2].count ?? 0;
    $('admitted-count').textContent = results[3].count ?? 0;

    const departments = results[4].data || [];
    const applications = results[6].data || [];
    const counts = {};

    applications.forEach(app => {
      const name = app.department || 'Non précisé';
      counts[name] = (counts[name] || 0) + 1;
    });

    const departmentContainer = $('department-stats');
    departmentContainer.replaceChildren();

    departments.forEach(department => {
      const line = document.createElement('div');
      line.className = 'department-row';

      const name = document.createElement('span');
      name.textContent = department.name;

      const count = document.createElement('strong');
      count.textContent = counts[department.name] || 0;

      line.append(name, count);
      departmentContainer.appendChild(line);
    });

    const recentBody = $('recent-applications');
    recentBody.replaceChildren();

    (results[5].data || []).forEach(app => {
      const row = document.createElement('tr');

      [
        app.full_name,
        app.department,
        app.desired_training,
        app.status
      ].forEach(value => {
        const cell = document.createElement('td');
        cell.textContent = value || '—';
        row.appendChild(cell);
      });

      recentBody.appendChild(row);
    });

    if (!recentBody.children.length) {
      const row = document.createElement('tr');
      const cell = document.createElement('td');
      cell.colSpan = 4;
      cell.textContent = 'Aucune candidature.';
      row.appendChild(cell);
      recentBody.appendChild(row);
    }

    $('updated-at').textContent = new Date().toLocaleString('fr-FR');
    $('dashboard-message').textContent = '';

  } catch (error) {
    $('dashboard-message').textContent =
      'Erreur : ' + (error.message || 'Chargement impossible.');
  } finally {
    $('refresh-button').disabled = false;
  }
}

$('login-form').addEventListener('submit', async (event) => {
  event.preventDefault();

  const button = $('login-button');
  button.disabled = true;
  button.textContent = 'Connexion...';

  try {
    const { data, error } = await supabaseClient.auth.signInWithPassword({
      email: $('email').value.trim(),
      password: $('password').value
    });

    if (error) throw error;

    await verifyAdministrator(data.user);

  } catch (error) {
    $('login-message').textContent = error.message;
  } finally {
    button.disabled = false;
    button.textContent = 'Se connecter';
  }
});

$('logout-button').addEventListener('click', async () => {
  const { error } = await supabaseClient.auth.signOut();

  if (error) {
    $('dashboard-message').textContent = error.message;
    return;
  }

  showLogin('Vous êtes déconnecté.');
});

$('refresh-button').addEventListener('click', loadDashboard);

$('forgot-password-button').addEventListener('click', () => {
  $('reset-request-form').classList.toggle('hidden');
  $('reset-email').value = $('email').value.trim();
});

$('reset-request-form').addEventListener('submit', async (event) => {
  event.preventDefault();

  const email = $('reset-email').value.trim();
  const message = $('reset-request-message');

  if (!email) {
    message.textContent = 'Saisissez votre adresse e-mail.';
    return;
  }

  const button = $('reset-request-button');
  button.disabled = true;

  try {
    const { error } = await supabaseClient.auth.resetPasswordForEmail(email, {
      redirectTo: 'https://online-admission-b7s.pages.dev/admin.html?mode=reset'
    });

    if (error) throw error;

    message.textContent =
      'Si le compte existe, un lien sera envoyé par e-mail.';

  } catch (error) {
    message.textContent = error.message;
  } finally {
    button.disabled = false;
  }
});

supabaseClient.auth.onAuthStateChange((event, session) => {
  if (event === 'PASSWORD_RECOVERY' && session) {
    loginView.classList.remove('hidden');
    dashboardView.classList.add('hidden');

    $('login-form').classList.add('hidden');
    $('forgot-password-button').classList.add('hidden');
    $('reset-request-form').classList.add('hidden');
    $('new-password-form').classList.remove('hidden');
  }
});

$('new-password-form').addEventListener('submit', async (event) => {
  event.preventDefault();

  const password = $('new-password').value;
  const confirmation = $('confirm-password').value;
  const message = $('new-password-message');

  if (password.length < 8) {
    message.textContent = 'Minimum 8 caractères.';
    return;
  }

  if (password !== confirmation) {
    message.textContent = 'Les mots de passe ne correspondent pas.';
    return;
  }

  $('save-password-button').disabled = true;

  try {
    const { error } = await supabaseClient.auth.updateUser({
      password
    });

    if (error) throw error;

    message.textContent = 'Mot de passe modifié avec succès.';

    $('new-password-form').classList.add('hidden');
    $('login-form').classList.remove('hidden');
    $('forgot-password-button').classList.remove('hidden');

  } catch (error) {
    message.textContent = error.message;
  } finally {
    $('save-password-button').disabled = false;
  }
});
async function loadCandidates() {
  const body = $('candidates-list');
  const message = $('candidates-message');

  body.innerHTML = '<tr><td colspan="6">Chargement...</td></tr>';

  try {
    const { data, error } = await supabaseClient
      .from('applications')
      .select('id, full_name, phone, email, department, commune, desired_training, status, birth_date, age, gender, education_level, last_school, availability, reason, other_info, whatsapp, created_at')
      .order('created_at', { ascending: false });

    if (error) throw error;

    window.allCandidates = data || [];
    displayCandidates();

    message.textContent = window.allCandidates.length + ' candidature(s) trouvée(s).';

  } catch (error) {
    body.innerHTML = '<tr><td colspan="6">Erreur de chargement.</td></tr>';
    message.textContent = error.message;
  }
}

function displayCandidates() {
  const body = $('candidates-list');
  const search = $('candidate-search').value.toLowerCase().trim();
  const department = $('candidate-department').value;
  const status = $('candidate-status').value;

  body.replaceChildren();

  const filtered = (window.allCandidates || []).filter(candidate => {
    const matchesSearch =
      (candidate.full_name || '').toLowerCase().includes(search) ||
      (candidate.phone || '').toLowerCase().includes(search);

    return matchesSearch &&
      (!department || candidate.department === department) &&
      (!status || candidate.status === status);
  });

  filtered.forEach(candidate => {
    const row = document.createElement('tr');

    [
      candidate.full_name,
      candidate.phone,
      candidate.department,
      candidate.desired_training,
      candidate.status
    ].forEach(value => {
      const cell = document.createElement('td');
      cell.textContent = value || '—';
      row.appendChild(cell);
    });

    const actionCell = document.createElement('td');
    const button = document.createElement('button');

    button.textContent = 'Voir détails';
    button.type = 'button';

    button.addEventListener('click', () => {
      showCandidateDetails(candidate);
    });

    actionCell.appendChild(button);
    row.appendChild(actionCell);
    body.appendChild(row);
  });

  if (!filtered.length) {
    const row = document.createElement('tr');
    const cell = document.createElement('td');
    cell.colSpan = 6;
    cell.textContent = 'Aucun candidat trouvé.';
    row.appendChild(cell);
    body.appendChild(row);
  }

  $('candidates-message').textContent =
    filtered.length + ' candidature(s) affichée(s).';
}

function showCandidateDetails(candidate) {
  const details = [
    'Nom : ' + (candidate.full_name || '—'),
    'Téléphone : ' + (candidate.phone || '—'),
    'WhatsApp : ' + (candidate.whatsapp || '—'),
    'Email : ' + (candidate.email || '—'),
    'Département : ' + (candidate.department || '—'),
    'Commune : ' + (candidate.commune || '—'),
    'Formation : ' + (candidate.desired_training || '—'),
    'Date de naissance : ' + (candidate.birth_date || '—'),
    'Âge : ' + (candidate.age || '—'),
    'Genre : ' + (candidate.gender || '—'),
    'Niveau scolaire : ' + (candidate.education_level || '—'),
    'Dernière école : ' + (candidate.last_school || '—'),
    'Disponibilité : ' + (candidate.availability || '—'),
    'Motivation : ' + (candidate.reason || '—'),
    'Autres informations : ' + (candidate.other_info || '—'),
    'Statut : ' + (candidate.status || '—')
  ];

  alert(details.join('\n'));
}

$('candidate-search').addEventListener('input', displayCandidates);
$('candidate-department').addEventListener('change', displayCandidates);
$('candidate-status').addEventListener('change', displayCandidates);
async function restoreSession() {
  const isRecovery =
    window.location.hash.includes('type=recovery') ||
    new URLSearchParams(window.location.search).get('mode') === 'reset';

  if (isRecovery) {
    loginView.classList.remove('hidden');
    dashboardView.classList.add('hidden');

    $('login-form').classList.add('hidden');
    $('forgot-password-button').classList.add('hidden');
    $('reset-request-form').classList.add('hidden');
    $('new-password-form').classList.remove('hidden');

    return;
  }

  const { data, error } = await supabaseClient.auth.getSession();

  if (error || !data.session) return;

  try {
    await verifyAdministrator(data.session.user);
  } catch (error) {
    showLogin(error.message);
  }
}

restoreSession();
                              
