
const SUPABASE_URL = 'https://qxcpyvhdxzijtozqlycv.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_NbDxrLQLCeUdwdZilhuptA_QJ2lxcg0';

const supabaseClient = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY
);

const $ = (id) => document.getElementById(id);
console.log('LVA ADMIN JS CHARGÉ - VERSION TEST 2026');

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

  // Charger le tableau de bord et les candidatures indépendamment
  const results = await Promise.allSettled([
    loadDashboard(),
    loadCandidates()
  ]);

  results.forEach((result, index) => {
    if (result.status === 'rejected') {
      const message = result.reason?.message || 'Erreur inconnue';

      if (index === 0) {
        $('dashboard-message').textContent =
          'Erreur Dashboard : ' + message;
      } else {
        $('candidates-message').textContent =
          'Erreur Candidatures : ' + message;
      }
    }
  });
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

$('refresh-button').addEventListener('click', async () => {
  await loadDashboard();
  await loadCandidates();
});

$('forgot-password-button').addEventListener('click', () => {
  $('reset-request-view').classList.toggle('hidden');
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

  window.allCandidates = [];

  body.innerHTML =
    '<tr><td colspan="6">Chargement des candidatures...</td></tr>';

  message.textContent = 'Connexion à Supabase...';

  try {
    const response = await supabaseClient
      .from('applications')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(200);

    if (response.error) {
      throw response.error;
    }

    window.allCandidates = response.data || [];

    displayCandidates();

    message.textContent =
      window.allCandidates.length +
      ' candidature(s) trouvée(s).';

  } catch (error) {
    console.error('Erreur loadCandidates:', error);

    body.innerHTML =
      '<tr><td colspan="6">Impossible de charger les candidatures.</td></tr>';

    message.textContent =
      'Erreur : ' + (error.message || 'Erreur inconnue');
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


async function showCandidateDetails(candidate) {
  // Retire ansyen fenèt detay la si li egziste
  document.getElementById('candidate-details-modal')?.remove();

  const modal = document.createElement('div');
  modal.id = 'candidate-details-modal';

  Object.assign(modal.style, {
    position: 'fixed',
    inset: '0',
    background: 'rgba(0,0,0,0.75)',
    zIndex: '99999',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    padding: '15px',
    overflowY: 'auto'
  });

  const panel = document.createElement('div');

  Object.assign(panel.style, {
    background: '#fff',
    color: '#222',
    width: '100%',
    maxWidth: '650px',
    maxHeight: '90vh',
    overflowY: 'auto',
    padding: '22px',
    borderRadius: '12px'
  });

  const title = document.createElement('h2');
  title.textContent = 'Dossier du candidat';
  panel.appendChild(title);

  const close = document.createElement('button');
  close.textContent = 'Fermer ✕';
  close.type = 'button';
  close.style.cssText =
    'float:right;padding:10px 15px;cursor:pointer;';

  close.addEventListener('click', () => modal.remove());
  panel.appendChild(close);

  const photoTitle = document.createElement('h3');
  photoTitle.textContent = 'Photo du candidat';
  panel.appendChild(photoTitle);

  const photoContainer = document.createElement('div');
  photoContainer.textContent = 'Chargement de la photo...';
  panel.appendChild(photoContainer);

  const fields = [
    ['Nom complet', candidate.full_name],
    ['Téléphone', candidate.phone],
    ['WhatsApp', candidate.whatsapp],
    ['Email', candidate.email],
    ['Département', candidate.department],
    ['Commune', candidate.commune],
    ['Formation', candidate.desired_training],
    ['Date de naissance', candidate.birth_date],
    ['Âge', candidate.age],
    ['Genre', candidate.gender],
    ['Niveau scolaire', candidate.education_level],
    ['Dernière école', candidate.last_school],
    ['Disponibilité', candidate.availability],
    ['Motivation', candidate.reason],
    ['Autres informations', candidate.other_info],
    ['Statut', candidate.status]
  ];

  const infoTitle = document.createElement('h3');
  infoTitle.textContent = 'Informations personnelles';
  panel.appendChild(infoTitle);

  fields.forEach(([label, value]) => {
    const line = document.createElement('p');
    const strong = document.createElement('strong');
    strong.textContent = label + ' : ';

    line.appendChild(strong);
    line.appendChild(
      document.createTextNode(value || 'Non renseigné')
    );

    panel.appendChild(line);
  });

  const docsTitle = document.createElement('h3');
  docsTitle.textContent = 'Documents du candidat';
  panel.appendChild(docsTitle);

  const documents = [
    ['Document d’identité', candidate.identity_document_path],
    ['Acte de naissance', candidate.birth_document_path]
  ];

  const documentContainer = document.createElement('div');
  panel.appendChild(documentContainer);

  modal.appendChild(panel);
  document.body.appendChild(modal);

  modal.addEventListener('click', (event) => {
    if (event.target === modal) modal.remove();
  });

  async function getSecureUrl(path) {
    if (!path) return null;

    const { data, error } = await supabaseClient
      .storage
      .from('candidate-documents')
      .createSignedUrl(path, 300);

    if (error) throw error;

    return data.signedUrl;
  }

  try {
    if (candidate.applicant_photo_path) {
      const photoUrl = await getSecureUrl(
        candidate.applicant_photo_path
      );

      const photo = document.createElement('img');
      photo.src = photoUrl;
      photo.alt = 'Photo du candidat';

      photo.style.cssText =
        'width:150px;height:170px;object-fit:cover;' +
        'border-radius:8px;margin:10px 0;';

      photoContainer.replaceChildren(photo);
    } else {
      photoContainer.textContent = 'Aucune photo disponible.';
    }
  } catch (error) {
    photoContainer.textContent = 'Photo indisponible : ' + error.message;
  }

  for (const [label, path] of documents) {
    const line = document.createElement('p');
    const strong = document.createElement('strong');
    strong.textContent = label + ' : ';
    line.appendChild(strong);

    if (!path) {
      line.appendChild(
        document.createTextNode('Document non fourni.')
      );
    } else {
      const link = document.createElement('span');
      link.textContent = 'Chargement...';
      line.appendChild(link);

      try {
        const url = await getSecureUrl(path);
        const button = document.createElement('a');

        button.href = url;
        button.target = '_blank';
        button.rel = 'noopener noreferrer';
        button.textContent = 'Ouvrir le document';
        button.style.cssText =
          'color:#145da0;font-weight:bold;';

        link.replaceWith(button);
      } catch (error) {
        link.textContent = 'Indisponible : ' + error.message;
      }
    }

    documentContainer.appendChild(line);
  }
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
                              
