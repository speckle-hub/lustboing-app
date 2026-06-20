/* ═══════════════════════════════════════════════════
   LUSTBOING — app.js
   Video Data, Embed Logic, Filtering, Modal, UI
   Firebase Firestore + Auth Edition
═══════════════════════════════════════════════════ */

'use strict';

/* ── Backend server config ──────────────────────────── */
const BACKEND_URL = window.location.origin; // same origin as the page (server.js)

/* ── Fetch a fresh stream URL from the backend ────── */
async function fetchFreshStreamUrl(videoUrl) {
  try {
    const resp = await fetch(`${BACKEND_URL}/api/stream?url=${encodeURIComponent(videoUrl)}`, {
      signal: AbortSignal.timeout(5000),
    });
    if (!resp.ok) {
      console.warn('[stream] Backend returned', resp.status);
      return null;
    }
    const data = await resp.json();
    return data.streamUrl || null;
  } catch (err) {
    console.warn('[stream] Failed to fetch fresh stream URL:', err.message);
    return null;
  }
}

/* ══════════════════════════════════════════════════
   FIREBASE CONFIG  ← PASTE YOUR CONFIG HERE
   Get this from: Firebase Console → Project Settings → Your Apps
══════════════════════════════════════════════════ */
const FIREBASE_CONFIG = {
  apiKey:            "AIzaSyAf4tc_shnaxS4ExP5L9ajIpcJY_10BRYM",
  authDomain:        "lustboing.firebaseapp.com",
  projectId:         "lustboing",
  storageBucket:     "lustboing.firebasestorage.app",
  messagingSenderId: "366549525069",
  appId:             "1:366549525069:web:29508898addeca87667204",
};

/* Initialize Firebase */
let db = null;
let auth = null;
let firebaseReady = false;

(function initializeFirebase() {
  if (typeof firebase === 'undefined') {
    console.warn('Firebase SDK not loaded');
    return;
  }

  try {
    // Initialize app
    if (!firebase.apps || firebase.apps.length === 0) {
      firebase.initializeApp(FIREBASE_CONFIG);
    }
    
    // Get references
    auth = firebase.auth();
    db = firebase.firestore();
    
    firebaseReady = !!(auth && db);
    
    if (firebaseReady) {
      console.log('Firebase initialized');
    } else {
      console.warn('Firebase partial init');
    }
  } catch(e) {
    console.warn('Firebase error:', e.message);
  }
})();

/* ── Platform Config ─────────────────────────────── */
const PLATFORMS = {
  pornhub:  { name: 'Pornhub',  color: '#ff9000', icon: '🟠', embedBase: (id) => `https://www.pornhub.com/embed/${id}`,              sourceBase: (id) => `https://www.pornhub.com/view_video.php?viewkey=${id}` },
  xvideos:  { name: 'XVideos',  color: '#cc0000', icon: '🔴', embedBase: (id) => `https://www.xvideos.com/embedframe/${id}`,          sourceBase: (id) => `https://www.xvideos.com/video${id}` },
  xnxx:     { name: 'XNXX',     color: '#d63031', icon: '🔴', embedBase: (id) => `https://www.xnxx.com/embedframe/${id}`,             sourceBase: (id) => `https://www.xnxx.com/video-${id}` },
  xhamster: { name: 'xHamster', color: '#f9a825', icon: '🟡', embedBase: (id) => `https://xhamster.com/xembed.php?video=${id}`,       sourceBase: (id) => `https://xhamster.com/videos/${id}` },
  youporn:  { name: 'YouPorn',  color: '#e91e63', icon: '🩷', embedBase: (id) => `https://www.youporn.com/embed/${id}`,               sourceBase: (id) => `https://www.youporn.com/watch/${id}` },
  redtube:  { name: 'RedTube',  color: '#e53935', icon: '🔴', embedBase: (id) => `https://embed.redtube.com/?id=${id}&bgcolor=000000`, sourceBase: (id) => `https://www.redtube.com/${id}` },
};

/* ── In-memory video list (populated from Firestore) */
let VIDEO_DB = [];

const CATEGORY_DB = [
  { id: 'cat1',  title: 'Mature MILF',    bg: 'linear-gradient(135deg, #ff0055 0%, #30005a 100%)' },
  { id: 'cat2',  title: 'Cougar',         bg: 'linear-gradient(135deg, #ff9000 0%, #cc0000 100%)' },
  { id: 'cat3',  title: 'Amateur MILF',   bg: 'linear-gradient(135deg, #00d2ff 0%, #3a7bd5 100%)' },
  { id: 'cat4',  title: 'Step Mom',       bg: 'linear-gradient(135deg, #F09819 0%, #EDDE5D 100%)' },
  { id: 'cat5',  title: 'BBW MILF',       bg: 'linear-gradient(135deg, #8E2DE2 0%, #4A00E0 100%)' },
  { id: 'cat6',  title: 'MILF Threesome', bg: 'linear-gradient(135deg, #e53935 0%, #e35d5b 100%)' },
  { id: 'cat7',  title: 'Big Tits MILF',  bg: 'linear-gradient(135deg, #f953c6 0%, #b91d73 100%)' },
  { id: 'cat8',  title: 'Latina MILF',    bg: 'linear-gradient(135deg, #f7971e 0%, #ffd200 100%)' },
  { id: 'cat9',  title: 'Asian MILF',     bg: 'linear-gradient(135deg, #11998e 0%, #38ef7d 100%)' },
  { id: 'cat10', title: 'Ebony MILF',     bg: 'linear-gradient(135deg, #373b44 0%, #4286f4 100%)' },
];

const PORNSTAR_DB = [
  { id: 'ps01', name: 'Eva Notty',       icon: '⭐', videos: 0 },
  { id: 'ps02', name: 'Ava Addams',      icon: '⭐', videos: 0 },
  { id: 'ps03', name: 'Leigh Darby',     icon: '⭐', videos: 0 },
  { id: 'ps04', name: 'Natasha Nice',    icon: '⭐', videos: 0 },
  { id: 'ps05', name: 'Raegan Foxx',     icon: '⭐', videos: 0 },
  { id: 'ps06', name: 'Angela White',    icon: '⭐', videos: 0 },
  { id: 'ps07', name: 'Sara Jay',        icon: '⭐', videos: 0 },
  { id: 'ps08', name: 'YinyLeon',        icon: '⭐', videos: 0 },
  { id: 'ps09', name: 'Kendra Lust',     icon: '⭐', videos: 0 },
  { id: 'ps10', name: 'Lisa Ann',        icon: '⭐', videos: 0 },
  { id: 'ps11', name: 'Siri Dahl',       icon: '⭐', videos: 0 },
  { id: 'ps12', name: 'Brandi Love',     icon: '⭐', videos: 0 },
  { id: 'ps13', name: 'Lauren Phillips', icon: '⭐', videos: 0 },
  { id: 'ps14', name: 'Rose Monroe',     icon: '⭐', videos: 0 },
  { id: 'ps15', name: 'Violet Myers',    icon: '⭐', videos: 0 },
  { id: 'ps16', name: 'Sophie Dee',      icon: '⭐', videos: 0 },
  { id: 'ps17', name: 'Alison Tyler',    icon: '⭐', videos: 0 },
  { id: 'ps18', name: 'Phoenix Marie',   icon: '⭐', videos: 0 },
  { id: 'ps19', name: 'Bridgette B',     icon: '⭐', videos: 0 },
  { id: 'ps20', name: 'Julia Ann',       icon: '⭐', videos: 0 },
  { id: 'ps21', name: 'Ariella Ferrera', icon: '⭐', videos: 0 },
  { id: 'ps22', name: 'Dee Williams',    icon: '⭐', videos: 0 },
  { id: 'ps23', name: 'Hitomi Tanaka',   icon: '⭐', videos: 0 },
  { id: 'ps24', name: 'Alura Jenson',    icon: '⭐', videos: 0 },
  { id: 'ps25', name: 'Gianna Michaels', icon: '⭐', videos: 0 },
  { id: 'ps26', name: 'Romi Rain',       icon: '⭐', videos: 0 },
  { id: 'ps27', name: 'Britney Amber',   icon: '⭐', videos: 0 },
  { id: 'ps28', name: 'Brooklyn Chase',  icon: '⭐', videos: 0 },
];

/* ── State ─────────────────────────────────────── */
let state = {
  activePlatform: 'all',
  searchQuery:    '',
  sort:           'default',
  filteredVideos: [],
  activeVideo:    null,
  isAdmin:        false,
  currentUser:    null,
};

/* ══════════════════════════════════════════════════
   FIREBASE — Real-time Firestore listener
══════════════════════════════════════════════════ */

/* Sample video data for demo/testing */
const SAMPLE_VIDEOS = [];

function startFirestoreSync() {
  if (!firebaseReady || !db) {
    console.warn('Firebase not ready, using sample data');
    loadSampleVideos();
    return;
  }
  
  try {
    db.collection('videos')
      .orderBy('addedAt', 'desc')
      .onSnapshot(snapshot => {
        VIDEO_DB = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        /* Recompute performer counts */
        PORNSTAR_DB.forEach(ps => {
          ps.videos = VIDEO_DB.filter(v => v.pornstar === ps.name).length;
        });

        applyFilters();
        renderPornstars();
        renderCategories();
      }, err => {
        console.warn('Firestore sync error:', err);
        loadSampleVideos();
      });
  } catch(e) {
    console.warn('Firebase not initialized, using sample data');
    loadSampleVideos();
  }
}

function loadSampleVideos() {
  VIDEO_DB = [...SAMPLE_VIDEOS];
  
  /* Recompute performer counts */
  PORNSTAR_DB.forEach(ps => {
    ps.videos = VIDEO_DB.filter(v => v.pornstar === ps.name).length;
  });

  applyFilters();
  renderPornstars();
  renderCategories();
}

/* ══════════════════════════════════════════════════
   FIREBASE AUTH — Admin session management
══════════════════════════════════════════════════ */
if (auth) {
  auth.onAuthStateChanged(user => {
    state.isAdmin = !!user;
    state.currentUser = user;
    updateAdminUI();
  });
}

function updateAdminUI() {
  /* Show/hide admin-only elements */
  document.querySelectorAll('.admin-only').forEach(el => {
    el.classList.toggle('hidden', !state.isAdmin);
  });
  
  /* Toggle login/profile buttons */
  const loginBtn = document.getElementById('btn-login');
  const profileBtn = document.getElementById('btn-profile');
  
  if (loginBtn) loginBtn.classList.toggle('hidden', state.isAdmin);
  if (profileBtn) profileBtn.classList.toggle('hidden', !state.isAdmin);
  
  /* Update Add Embed button tooltip */
  const addBtn = document.getElementById('btn-add-embed');
  if (addBtn) {
    addBtn.title = state.isAdmin ? 'Add a video embed' : 'Admin login required to add videos';
  }
  
  /* Update delete button visibility in open player */
  const deleteBtn = document.getElementById('modal-delete-btn');
  if (deleteBtn) deleteBtn.classList.toggle('hidden', !state.isAdmin);
}

/* ── Admin Login Modal ── */
function openLoginModal() {
  const modal = document.getElementById('login-modal');
  if (!modal) return;
  modal.classList.remove('hidden');
  document.body.style.overflow = 'hidden';
  setTimeout(() => document.getElementById('login-email')?.focus(), 100);
}

function closeLoginModal() {
  const modal = document.getElementById('login-modal');
  if (!modal) return;
  modal.classList.add('hidden');
  document.body.style.overflow = '';
  document.getElementById('login-error')?.classList.add('hidden');
  setLoginMode('signin');
}

let loginMode = 'signin';

function setLoginMode(mode) {
  loginMode = mode;
  const titleEl = document.getElementById('login-modal-title');
  const btnEl = document.getElementById('btn-do-login');
  const tabSignin = document.getElementById('tab-mode-signin');
  const tabSignup = document.getElementById('tab-mode-signup');

  if (mode === 'signup') {
    if (titleEl) titleEl.textContent = 'Create Account';
    if (btnEl) btnEl.innerHTML = '<span>Sign Up</span><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M5 12h14M12 5l7 7-7 7"/></svg>';
    if (tabSignin) tabSignin.classList.remove('active');
    if (tabSignup) tabSignup.classList.add('active');
  } else {
    if (titleEl) titleEl.textContent = 'Admin Access';
    if (btnEl) btnEl.innerHTML = '<span>Sign In</span><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M5 12h14M12 5l7 7-7 7"/></svg>';
    if (tabSignin) tabSignin.classList.add('active');
    if (tabSignup) tabSignup.classList.remove('active');
  }
  document.getElementById('login-error')?.classList.add('hidden');
}

async function loginAdmin() {
  if (loginMode === 'signup') {
    await registerAdmin();
  } else {
    await signInAdmin();
  }
}

async function signInAdmin() {
  const email    = document.getElementById('login-email')?.value.trim();
  const password = document.getElementById('login-password')?.value;
  const btn      = document.getElementById('btn-do-login');

  if (!email || !password) { showLoginError('Please enter your email and password.'); return; }

  if (btn) { btn.disabled = true; btn.querySelector('span').textContent = 'Logging in'; }

  try {
    await auth.signInWithEmailAndPassword(email, password);
    closeLoginModal();
    showToast('Logged in as Admin!');
    openAddModal();
  } catch (e) {
    showLoginError('Invalid email or password.');
  } finally {
    if (btn) { btn.disabled = false; btn.querySelector('span').textContent = 'Sign In'; }
  }
}

async function registerAdmin() {
  const email    = document.getElementById('login-email')?.value.trim();
  const password = document.getElementById('login-password')?.value;
  const btn      = document.getElementById('btn-do-login');

  if (!email || !password) { showLoginError('Please enter your email and password.'); return; }

  if (btn) { btn.disabled = true; btn.querySelector('span').textContent = 'Creating account'; }

  try {
    await auth.createUserWithEmailAndPassword(email, password);
    closeLoginModal();
    showToast('Account registered & logged in!');
    openAddModal();
  } catch (e) {
    showLoginError(e.message || 'Failed to create account.');
  } finally {
    if (btn) { btn.disabled = false; btn.querySelector('span').textContent = 'Sign Up'; }
  }
}

async function loginWithGoogle() {
  if (!auth) return;
  const provider = new firebase.auth.GoogleAuthProvider();
  try {
    await auth.signInWithPopup(provider);
    closeLoginModal();
    showToast('Logged in with Google!');
    openAddModal();
  } catch (e) {
    showLoginError(e.message || 'Google sign-in failed.');
  }
}

function showLoginError(msg) {
  const errEl = document.getElementById('login-error');
  if (errEl) { errEl.textContent = msg; errEl.classList.remove('hidden'); }
}

async function logoutAdmin() {
  await auth.signOut();
  showToast('Logged out.');
}

function togglePasswordVisibility() {
  const passInput = document.getElementById('login-password');
  const eyeIcon = document.getElementById('eye-icon');
  if (!passInput) return;
  if (passInput.type === 'password') {
    passInput.type = 'text';
    if (eyeIcon) {
      eyeIcon.innerHTML = '<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line>';
    }
  } else {
    passInput.type = 'password';
    if (eyeIcon) {
      eyeIcon.innerHTML = '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>';
    }
  }
}

/* ── Profile Modal ── */
function openProfileModal() {
  if (!auth || !auth.currentUser) return;
  
  const modal = document.getElementById('profile-modal');
  if (!modal) return;
  
  /* Populate profile info */
  const emailEl = document.getElementById('profile-email');
  const userLabelEl = document.getElementById('profile-user-label');
  
  if (emailEl) emailEl.textContent = auth.currentUser.email || 'User';
  if (userLabelEl) userLabelEl.textContent = auth.currentUser.email?.split('@')[0] || 'Profile';
  
  /* Update join date */
  const joinDateEl = document.getElementById('profile-joined-date');
  if (joinDateEl && auth.currentUser.metadata?.creationTime) {
    const createdDate = new Date(auth.currentUser.metadata.creationTime);
    joinDateEl.textContent = createdDate.toLocaleDateString();
  }
  
  /* Count user's videos */
  if (firebaseReady && db) {
    db.collection('videos')
      .where('userId', '==', auth.currentUser.uid)
      .get()
      .then(snapshot => {
        const videosCountEl = document.getElementById('profile-videos-count');
        if (videosCountEl) videosCountEl.textContent = snapshot.size;
      });
  }
  
  modal.classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}

function closeProfileModal() {
  const modal = document.getElementById('profile-modal');
  if (!modal) return;
  modal.classList.add('hidden');
  document.body.style.overflow = '';
}

/* ══════════════════════════════════════════════════
   AGE GATE
══════════════════════════════════════════════════ */
function enterSite() {
  const gate = document.getElementById('age-gate');
  const site = document.getElementById('site');

  gate.style.transition = 'opacity .4s ease, transform .4s ease';
  gate.style.opacity    = '0';
  gate.style.transform  = 'scale(1.03)';

  setTimeout(() => {
    gate.classList.add('hidden');
    site.classList.remove('hidden');
    localStorage.setItem('lb_age_ok', '1');
    initParticles();
  }, 400);
}

/* Auto-skip age gate if already verified */
if (localStorage.getItem('lb_age_ok')) {
  document.getElementById('age-gate').classList.add('hidden');
  document.getElementById('site').classList.remove('hidden');
}

/* ══════════════════════════════════════════════════
   PARTICLES
══════════════════════════════════════════════════ */
function initParticles() {
  const container = document.getElementById('hero-particles');
  if (!container) return;
  for (let i = 0; i < 18; i++) {
    const p = document.createElement('div');
    p.className = 'particle';
    const size   = Math.random() * 4 + 2;
    const colors = ['rgba(230,0,92,.5)', 'rgba(123,0,212,.5)', 'rgba(255,77,143,.4)', 'rgba(255,144,0,.3)'];
    const color  = colors[Math.floor(Math.random() * colors.length)];
    p.style.cssText = `
      width: ${size}px;
      height: ${size}px;
      background: ${color};
      left: ${Math.random() * 100}%;
      top: ${50 + Math.random() * 50}%;
      animation-duration: ${4 + Math.random() * 6}s;
      animation-delay: ${Math.random() * 5}s;
      box-shadow: 0 0 ${size * 2}px ${color};
    `;
    container.appendChild(p);
  }
}

/* ══════════════════════════════════════════════════
   SIDEBAR
══════════════════════════════════════════════════ */
function openSidebar() {
  document.getElementById('sidebar')?.classList.add('open');
  document.getElementById('sidebar-overlay')?.classList.add('active');
  document.body.style.overflow = 'hidden';
}

function closeSidebar() {
  document.getElementById('sidebar')?.classList.remove('open');
  document.getElementById('sidebar-overlay')?.classList.remove('active');
  document.body.style.overflow = '';
}

/* ══════════════════════════════════════════════════
   FILTERING & SORTING
══════════════════════════════════════════════════ */
function applyFilters() {
  let videos = [...VIDEO_DB];

  if (state.activePlatform !== 'all') {
    videos = videos.filter(v => v.platform === state.activePlatform);
  }

  if (state.searchQuery.trim()) {
    const q = state.searchQuery.trim().toLowerCase();
    videos = videos.filter(v =>
      v.title.toLowerCase().includes(q) ||
      v.platform.toLowerCase().includes(q) ||
      (v.tags || []).some(t => t.toLowerCase().includes(q))
    );
  }

  if (state.sort === 'platform') {
    videos.sort((a, b) => a.platform.localeCompare(b.platform));
  } else if (state.sort === 'title') {
    videos.sort((a, b) => a.title.localeCompare(b.title));
  }

  state.filteredVideos = videos;
  renderGrid();
  updateResultsCount();
}

function updateResultsCount() {
  const el     = document.getElementById('results-count');
  const statEl = document.getElementById('stat-count');
  const n      = state.filteredVideos.length;
  const total  = VIDEO_DB.length;

  if (el) {
    el.textContent = state.activePlatform === 'all' && !state.searchQuery
      ? `Showing all ${n} videos`
      : `Showing ${n} of ${total} videos`;
  }
  if (statEl) statEl.textContent = VIDEO_DB.length;
}

/* ══════════════════════════════════════════════════
   RENDER GRID
══════════════════════════════════════════════════ */
function renderGrid() {
  const grid  = document.getElementById('video-grid');
  const empty = document.getElementById('empty-state');
  if (!grid) return;

  grid.innerHTML = '';

  if (state.filteredVideos.length === 0) {
    if (empty) empty.classList.remove('hidden');
    return;
  }
  if (empty) empty.classList.add('hidden');

  state.filteredVideos.forEach((video, i) => {
    const card = buildCard(video, i);
    grid.appendChild(card);
  });
}

/* ── Build a single video card ── */
function buildCard(video, index) {
  const platform = PLATFORMS[video.platform];
  const el       = document.createElement('div');
  el.className   = 'video-card';
  el.setAttribute('role', 'listitem');
  el.setAttribute('tabindex', '0');
  el.setAttribute('aria-label', `Play: ${video.title} on ${platform.name}`);
  el.id = `card-${video.id}`;
  el.style.animationDelay = `${index * 0.035}s`;

  const tagsHtml   = (video.tags || []).map(t => `<span class="card__tag">${t}</span>`).join('');
  const thumbStyle = video.thumbUrl
    ? `style="background-image: url('${escapeHtml(video.thumbUrl)}'); background-size: cover; background-position: center;"`
    : '';

  el.innerHTML = `
    <div class="card__thumb" data-platform="${video.platform}" ${thumbStyle}>
      <div class="card__thumb-bg" ${video.thumbUrl ? 'style="opacity: 0;"' : ''}>
        <div class="card__thumb-icon">${platform.icon}</div>
        <div class="card__thumb-platform-name">${platform.name}</div>
      </div>
      <div class="card__play-overlay">
        <div class="card__play-btn">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="white"><path d="M5 3l14 9-14 9V3z"/></svg>
        </div>
      </div>
      <span class="card__badge badge--${video.platform}">${platform.name}</span>
      <span class="card__duration">${video.duration || '--:--'}</span>
    </div>
    <div class="card__body">
      <h3 class="card__title">${escapeHtml(video.title)}</h3>
      ${tagsHtml ? `<div class="card__tags">${tagsHtml}</div>` : ''}
      <div class="card__meta">
        <span class="card__views">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/></svg>
          ${video.views || '—'}
        </span>
        <span>${video.duration || '--:--'}</span>
      </div>
    </div>
  `;

  el.addEventListener('click', () => openPlayer(video));
  el.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') openPlayer(video); });

  return el;
}

/* ══════════════════════════════════════════════════
   RENDER CATEGORIES & PORNSTARS
══════════════════════════════════════════════════ */
function renderCategories() {
  const grid = document.getElementById('category-grid');
  if (!grid) return;
  grid.innerHTML = '';
  CATEGORY_DB.forEach(cat => {
    const el = document.createElement('div');
    el.className    = 'category-card';
    el.style.background = cat.bg;
    el.innerHTML    = `<span class="category-card__title">${escapeHtml(cat.title)}</span>`;
    el.addEventListener('click', () => {
      window.location.href = `index.html?search=${encodeURIComponent(cat.title)}`;
    });
    grid.appendChild(el);
  });
}

function renderPornstars() {
  const grid = document.getElementById('pornstar-grid');
  if (!grid) return;
  grid.innerHTML = '';
  PORNSTAR_DB.forEach(ps => {
    const el = document.createElement('div');
    el.className = 'pornstar-card';
    el.innerHTML = `
      <div class="pornstar-card__avatar">${ps.icon}</div>
      <div class="pornstar-card__name">${escapeHtml(ps.name)}</div>
      <div class="pornstar-card__stats">${ps.videos} Videos</div>
    `;
    el.addEventListener('click', () => {
      window.location.href = `index.html?search=${encodeURIComponent(ps.name)}`;
    });
    grid.appendChild(el);
  });
}

/* ══════════════════════════════════════════════════
   PLAYER MODAL
══════════════════════════════════════════════════ */
function openPlayer(video) {
  state.activeVideo = video;
  const platform   = PLATFORMS[video.platform];
  const modal      = document.getElementById('player-modal');
  const iframeWrap = document.getElementById('modal-iframe-wrap');
  const titleEl    = document.getElementById('modal-video-title');
  const badgeEl    = document.getElementById('modal-platform-badge');
  const metaEl     = document.getElementById('modal-meta');
  const sourceLink = document.getElementById('modal-source-link');
  const deleteBtn  = document.getElementById('modal-delete-btn');

  titleEl.textContent  = video.title;
  badgeEl.textContent  = platform.name;
  badgeEl.className    = `modal__platform-badge badge--${video.platform}`;

  metaEl.innerHTML = `
    <span style="color: ${platform.color}; font-weight: 600;">${platform.name}</span>
    &nbsp;·&nbsp; ${video.duration || '--:--'}
    &nbsp;·&nbsp; ${video.views || '—'} views
    &nbsp;·&nbsp; ${(video.tags || []).join(', ')}
  `;

  sourceLink.href = video.videoUrl || platform.sourceBase(video.videoId);

  /* Show delete button only for admins */
  if (deleteBtn) deleteBtn.classList.toggle('hidden', !state.isAdmin);

  modal.classList.remove('hidden');
  document.body.style.overflow = 'hidden';

  requestAnimationFrame(() => {
    document.getElementById('btn-modal-close')?.focus();
  });

  /* Load the video player content (async) */
  loadPlayerContent(video, platform, iframeWrap);
}

let playerStalledTimeout = null;

/* Load video — tries backend proxy first, then fallbacks */
async function loadPlayerContent(video, platform, iframeWrap) {
  /* Show loading state immediately */
  iframeWrap.innerHTML = `
    <div class="player-loading" id="player-loading">
      <div class="loading-spinner"></div>
      <span class="loading-text">Loading stream...</span>
    </div>
  `;

  /* Global stalled timeout while loading */
  clearTimeout(playerStalledTimeout);
  playerStalledTimeout = setTimeout(() => {
    const loadingEl = document.getElementById('player-loading');
    if (loadingEl) {
      const textEl = loadingEl.querySelector('.loading-text');
      if (textEl) textEl.textContent = 'Still loading... check your connection';
    }
  }, 25000);

  const videoUrl = video.videoUrl || platform.sourceBase(video.videoId);

  try {
    /* 1) Try to get a FRESH stream URL from the backend (resolves expiry + CORS) */
    const freshStreamUrl = await fetchFreshStreamUrl(videoUrl);

    if (freshStreamUrl) {
      clearTimeout(playerStalledTimeout);
      /* Use the proxy endpoint to avoid CORS issues with CDNs */
      const proxyUrl = `${BACKEND_URL}/api/proxy?url=${encodeURIComponent(freshStreamUrl)}`;
      renderVideoPlayer(iframeWrap, proxyUrl, video.thumbUrl, video.title);
      return;
    }

    /* Last resort: iframe embed */
    clearTimeout(playerStalledTimeout);
    console.warn('[player] No stream URL, falling back to iframe embed');
    renderEmbedIframe(iframeWrap, platform, video);
  } catch (err) {
    clearTimeout(playerStalledTimeout);
    console.error('[player] Error loading video:', err);
    /* Final fallback to iframe */
    renderEmbedIframe(iframeWrap, platform, video);
  }
}

/* Render HTML5 video player */
function renderVideoPlayer(container, src, poster, title) {
  container.innerHTML = `
    <video
      id="embed-video"
      controls
      autoplay
      playsinline
      style="position:absolute;inset:0;width:100%;height:100%;background:#000;"
      poster="${escapeHtml(poster || '')}"
    >
      <source src="${escapeHtml(src)}" type="video/mp4">
      Your browser does not support HTML5 video.
    </video>
  `;

  const videoEl = document.getElementById('embed-video');

  /* Error handler: if video fails, try iframe fallback */
  videoEl.addEventListener('error', () => {
    clearTimeout(playerStalledTimeout);
    console.warn('[player] Video error, trying iframe fallback');
    const currentVideo = state.activeVideo;
    if (currentVideo) {
      const plat = PLATFORMS[currentVideo.platform];
      if (plat) {
        renderEmbedIframe(container, plat, currentVideo);
      }
    }
  }, { once: true });

  videoEl.addEventListener('playing', () => clearTimeout(playerStalledTimeout), { once: true });
}

/* Render iframe embed (final fallback) */
function renderEmbedIframe(container, platform, video) {
  container.innerHTML = `
    <iframe
      id="embed-iframe"
      src="${platform.embedBase(video.videoId)}"
      frameborder="0"
      scrolling="no"
      allowfullscreen
      allow="autoplay; fullscreen"
      title="${escapeHtml(video.title)}"
    ></iframe>
  `;
}

function closeModal() {
  clearTimeout(playerStalledTimeout);

  const modal      = document.getElementById('player-modal');
  const iframeWrap = document.getElementById('modal-iframe-wrap');

  /* Pause video if playing */
  const video = document.getElementById('embed-video');
  if (video) video.pause();

  modal.style.opacity = '0';
  setTimeout(() => {
    modal.classList.add('hidden');
    modal.style.opacity = '';
    iframeWrap.innerHTML = '';
    document.body.style.overflow = '';
  }, 220);
}

async function deleteActiveVideo() {
  if (!state.activeVideo || !state.isAdmin) return;
  const title = state.activeVideo.title;
  const id    = state.activeVideo.id;

  try {
    await db.collection('videos').doc(id).delete();
    state.activeVideo = null;
    closeModal();
    showToast(`"${title}" deleted!`);
  } catch (e) {
    showToast('Delete failed. Check your connection.');
    console.error(e);
  }
}

/* Keyboard: Escape to close */
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    closeModal();
    if (typeof closeAddModal === 'function') closeAddModal();
    if (typeof closeLoginModal === 'function') closeLoginModal();
    if (typeof closeProfileModal === 'function') closeProfileModal();
  }
});

/* ══════════════════════════════════════════════════
   ADD CUSTOM EMBED MODAL
══════════════════════════════════════════════════ */
const EMBED_HINTS = {
  pornhub:  'Embed ID: e.g. ph62d0b8f5b2897  |  or paste full video URL',
  xvideos:  'Embed ID: alphanumeric, e.g. hmakvhh9f1c  |  or paste full video URL',
  xnxx:     'Embed ID: alphanumeric, e.g. r36f87d  |  or paste full video URL',
  xhamster: 'Embed ID: numeric, e.g. 18540329  |  or paste full video URL',
  youporn:  'Embed ID: numeric, e.g. 17823916  |  or paste full video URL',
  redtube:  'Embed ID: numeric, e.g. 44830161  |  or paste full video URL',
};

function populateAddModalDropdowns() {
  const starSel = document.getElementById('add-pornstar');
  const catSel  = document.getElementById('add-category');
  if (starSel && starSel.options.length <= 1) {
    PORNSTAR_DB.slice().sort((a, b) => a.name.localeCompare(b.name))
      .forEach(ps => starSel.appendChild(new Option(ps.name, ps.name)));
  }
  if (catSel && catSel.options.length <= 1) {
    CATEGORY_DB.forEach(cat => catSel.appendChild(new Option(cat.title, cat.title)));
  }
}

function openAddModal() {
  /* Gate: must be admin */
  if (!state.isAdmin) {
    openLoginModal();
    return;
  }
  const modal = document.getElementById('add-modal');
  modal.classList.remove('hidden');
  document.body.style.overflow = 'hidden';
  populateAddModalDropdowns();
  updateEmbedHint();
  document.getElementById('add-title')?.focus();
}

function closeAddModal() {
  document.getElementById('add-modal').classList.add('hidden');
  document.body.style.overflow = '';
}

function updateEmbedHint() {
  const platform = document.getElementById('add-platform')?.value || 'pornhub';
  const hint     = document.getElementById('embed-hint');
  if (hint) hint.textContent = EMBED_HINTS[platform] || '';
}

/* Extract video ID from full URL or return raw if already an ID */
function extractVideoId(platform, input) {
  input = input.trim();
  
  // If user pasted an iframe embed code, extract the src URL
  const iframeMatch = input.match(/src=["'](.*?)["']/i);
  if (iframeMatch) {
    input = iframeMatch[1];
  }

  if (!input.includes('/') && !input.includes('?')) return input;

  try {
    const url    = new URL(input.startsWith('http') ? input : 'https://' + input);
    const params = url.searchParams;

    switch (platform) {
      case 'pornhub': {
        const key = params.get('viewkey');
        if (key) return key;
        const seg = url.pathname.split('/').filter(Boolean);
        if (seg.includes('embed')) return seg[seg.indexOf('embed') + 1] || input;
        return input;
      }
      case 'xvideos': {
        const m = url.pathname.match(/(?:video\.?|embedframe\/)([a-z0-9]+)/i);
        return m ? m[1] : input;
      }
      case 'xnxx': {
        const m = url.pathname.match(/(?:video-|embedframe\/?)([a-z0-9]+)/i);
        return m ? m[1] : input;
      }
      case 'xhamster': {
        const v = params.get('video');
        if (v) return v;
        const m = url.pathname.match(/x(\d+)/);
        return m ? m[1] : input;
      }
      case 'youporn': {
        const m = url.pathname.match(/\d+/);
        return m ? m[0] : input;
      }
      case 'redtube': {
        const id = params.get('id');
        if (id) return id;
        const m = url.pathname.match(/\d+/);
        return m ? m[0] : input;
      }
      default: return input;
    }
  } catch {
    return input;
  }
}

async function addCustomEmbed() {
  if (!state.isAdmin) { openLoginModal(); return; }

  const title    = document.getElementById('add-title')?.value.trim();
  const platform = document.getElementById('add-platform')?.value;
  const raw      = document.getElementById('add-videoid')?.value.trim();
  const tagsRaw  = document.getElementById('add-tags')?.value.trim();
  const catSel   = document.getElementById('add-category')?.value;
  const starSel  = document.getElementById('add-pornstar')?.value;
  const durVal   = document.getElementById('add-duration')?.value.trim() || '--:--';
  let thumbUrl   = document.getElementById('add-thumburl')?.value.trim() || null;

  if (!title) { showToast('Please enter a video title'); return; }
  if (!raw)   { showToast('Please enter a video ID or URL'); return; }

  if (thumbUrl && !thumbUrl.startsWith('http')) {
    thumbUrl = 'https://' + thumbUrl;
  }

  const videoId = extractVideoId(platform, raw);
  const tags    = tagsRaw ? tagsRaw.split(',').map(t => t.trim()).filter(Boolean) : [];
  if (!tags.includes('milf')) tags.push('milf');
  if (catSel  && catSel  !== 'none') tags.push(catSel.toLowerCase());
  if (starSel && starSel !== 'none') tags.push(starSel.toLowerCase());

  const newVideo = {
    platform,
    videoId,
    title,
    duration: durVal,
    views:    '—',
    tags,
    pornstar: starSel !== 'none' ? starSel : null,
    category: catSel  !== 'none' ? catSel  : null,
    thumbUrl: thumbUrl || null,
    userId:   state.currentUser?.uid || null,
    addedAt:  firebase.firestore.FieldValue.serverTimestamp(),
  };

  const btn = document.getElementById('btn-confirm-add');
  if (btn) { btn.textContent = 'Saving'; btn.disabled = true; }

  try {
    await db.collection('videos').add(newVideo);

    /* Reset form */
    ['add-title','add-videoid','add-tags','add-duration','add-thumburl'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = '';
    });
    ['add-category','add-pornstar'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = 'none';
    });

    closeAddModal();
    showToast(`"${title}" added!`);
    document.getElementById('main-content')?.scrollIntoView({ behavior: 'smooth' });
  } catch (e) {
    showToast('Failed to save. Check your Firebase config.');
    console.error(e);
  } finally {
    if (btn) { btn.textContent = 'Add Video'; btn.disabled = false; }
  }
}

/* ══════════════════════════════════════════════════
   SEARCH
══════════════════════════════════════════════════ */
const searchInput = document.getElementById('search-input');
if (searchInput) {
  let searchDebounce;
  searchInput.addEventListener('input', () => {
    clearTimeout(searchDebounce);
    searchDebounce = setTimeout(() => {
      state.searchQuery = searchInput.value;
      applyFilters();
    }, 220);
  });
}

document.getElementById('btn-clear-search')?.addEventListener('click', () => {
  const inp = document.getElementById('search-input');
  if (inp) { inp.value = ''; inp.focus(); }
  state.searchQuery = '';
  applyFilters();
});

/* ══════════════════════════════════════════════════
   PLATFORM TABS
══════════════════════════════════════════════════ */
document.getElementById('platform-tabs')?.querySelectorAll('.platform-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.platform-tab').forEach(t => {
      t.classList.remove('active');
      t.setAttribute('aria-selected', 'false');
    });
    tab.classList.add('active');
    tab.setAttribute('aria-selected', 'true');
    state.activePlatform = tab.dataset.platform;
    applyFilters();
  });
});

/* ══════════════════════════════════════════════════
   SORT
══════════════════════════════════════════════════ */
document.getElementById('sort-select')?.addEventListener('change', (e) => {
  state.sort = e.target.value;
  applyFilters();
});

/* ══════════════════════════════════════════════════
   RESET FILTERS
══════════════════════════════════════════════════ */
function resetFilters() {
  state.activePlatform = 'all';
  state.searchQuery    = '';
  state.sort           = 'default';

  const inp = document.getElementById('search-input');
  if (inp) inp.value = '';
  const sortSel = document.getElementById('sort-select');
  if (sortSel) sortSel.value = 'default';

  document.querySelectorAll('.platform-tab').forEach(t => {
    t.classList.remove('active');
    t.setAttribute('aria-selected', 'false');
  });
  const allTab = document.getElementById('tab-all');
  if (allTab) { allTab.classList.add('active'); allTab.setAttribute('aria-selected', 'true'); }

  applyFilters();
}

/* ══════════════════════════════════════════════════
   STICKY HEADER SHADOW
══════════════════════════════════════════════════ */
window.addEventListener('scroll', () => {
  const header = document.getElementById('header');
  if (!header) return;
  header.style.boxShadow = window.scrollY > 10 ? '0 4px 30px rgba(0,0,0,.6)' : '';
}, { passive: true });

/* ══════════════════════════════════════════════════
   TOAST NOTIFICATIONS
══════════════════════════════════════════════════ */
let toastTimeout;
function showToast(message, duration = 2800) {
  const toast = document.getElementById('toast');
  if (!toast) return;
  clearTimeout(toastTimeout);
  toast.textContent = message;
  toast.classList.remove('hidden');
  toastTimeout = setTimeout(() => {
    toast.style.opacity    = '0';
    toast.style.transition = 'opacity .3s';
    setTimeout(() => {
      toast.classList.add('hidden');
      toast.style.opacity    = '';
      toast.style.transition = '';
    }, 300);
  }, duration);
}

/* ══════════════════════════════════════════════════
   UTILS
══════════════════════════════════════════════════ */
function escapeHtml(str) {
  return String(str)
    .replace(/&/g,  '&amp;')
    .replace(/</g,  '&lt;')
    .replace(/>/g,  '&gt;')
    .replace(/"/g,  '&quot;')
    .replace(/'/g,  '&#039;');
}

/* Enter key on Login form */
document.getElementById('login-password')?.addEventListener('keydown', e => {
  if (e.key === 'Enter') loginAdmin();
});

/* ══════════════════════════════════════════════════
   INIT
══════════════════════════════════════════════════ */
(function init() {
  /* Start real-time Firestore sync immediately */
  startFirestoreSync();

  /* If age gate already passed, show particles */
  if (sessionStorage.getItem('lb_age_ok')) {
    initParticles();
  }

  updateEmbedHint();

  /* Parse URL search params */
  const params = new URLSearchParams(window.location.search);
  const q      = params.get('search');
  if (q && document.getElementById('search-input')) {
    document.getElementById('search-input').value = q;
    state.searchQuery = q;
    /* Filtering will happen automatically on first Firestore snapshot */
  }
})();
