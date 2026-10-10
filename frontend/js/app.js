/* --- dom.js --- */
function h(tag, attrs, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs ?? {})) {
    if (v === false || v == null) continue;
    if (k === 'class') el.className = v;
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
    else if (v === true) el.setAttribute(k, '');
    else el.setAttribute(k, v);
  }
  el.append(...children.flat().filter((c) => c != null && c !== false));
  return el;
}
const clear = (el) => (el.replaceChildren(), el);


/* --- icons.js --- */
const NS = 'http://www.w3.org/2000/svg';
const PATHS = {
  dashboard: 'M4 4h7v7H4zM13 4h7v4h-7zM13 11h7v9h-7zM4 14h7v6H4z',
  clients: 'M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM3 20c0-3.3 2.7-6 6-6s6 2.7 6 6M16 8a3 3 0 1 1 0 6M16 14c2.5 0 5 1.8 5 6',
  cases: 'M4 7h16v13H4zM4 7l2-3h12l2 3M9 11h6',
  documents: 'M7 3h7l4 4v14H7zM14 3v4h4M9 13h6M9 16h6',
  billing: 'M4 6h16v12H4zM4 10h16M8 15h3',
  messages: 'M4 5h16v11H8l-4 4z',
  bell: 'M6 9a6 6 0 1 1 12 0c0 5 2 6 2 6H4s2-1 2-6zM10 19a2 2 0 0 0 4 0',
  audit: 'M5 4h14v16H5zM9 4v16M13 9h4M13 13h4M13 17h4',
  users: 'M8 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM2 20c0-3.3 2.6-6 6-6s6 2.7 6 6M16 8a3 3 0 1 1 0 6M16 14c2.5 0 6 1.5 6 6',
  search: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zm9 16-4-4',
  chevronDown: 'm6 9.5 6 6 6-6',
  chevronLeft: 'm14.5 6-6 6 6 6',
  plus: 'M12 5v14M5 12h14',
  logout: 'M9 4H5v16h4M14 8l4 4-4 4M18 12H9',
  lock: 'M7 10V7a5 5 0 0 1 10 0v3M6 10h12v10H6zM12 14v3',
  sun: 'M12 4V2M12 22v-2M4 12H2M22 12h-2M5 5 3.5 3.5M19 19l-1.5-1.5M5 19l-1.5 1.5M19 5l1.5-1.5M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10z',
  moon: 'M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z',
  download: 'M12 4v11M7 11l5 5 5-5M5 19h14',
  trash: 'M5 7h14M9 7V5h6v2M7 7l1 13h8l1-13',
  check: 'm5 12 5 5 9-9',
  close: 'm6 6 12 12M18 6 6 18',
  file: 'M7 3h7l4 4v14H7z',
  sliders: 'M4 7h16M4 17h16M9 4v6M15 14v6',
  calendar: 'M5 6h14v13H5zM5 10h14M9 3v4M15 3v4',
  kanban: 'M5 5h4v14H5zM10 5h4v9h-4zM15 5h4v6h-4z',
  clock: 'M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16zM12 8v4l3 2',
  heart: 'M12 20s-7-4.3-7-9.5A4.5 4.5 0 0 1 12 7a4.5 4.5 0 0 1 7 3.5C19 15.7 12 20 12 20z',
  chat: 'M4 5h16v11H8l-4 4z',
  send: 'M4 12 20 4l-4 7 4 7zM20 4 9 13M13 20l-4-7',
  bookmark: 'M7 4h10v16l-5-4-5 4z',
  dots: 'M12 5.5a1.5 1.5 0 1 0 0 .01M12 12a1.5 1.5 0 1 0 0 .01M12 18.5a1.5 1.5 0 1 0 0 .01',
  chevronRight: 'm9.5 6 6 6-6 6',
  menu: 'M4 6h16M4 12h16M4 18h16',
  phone: 'M5 4h4l2 5-3 2a12 12 0 0 0 5 5l2-3 5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z',
  mail: 'M4 6h16v12H4zM4 7l8 6 8-6',
  pin: 'M12 21s-7-6-7-11a7 7 0 0 1 14 0c0 5-7 11-7 11zM12 12a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z',
  alignLeft: 'M4 6h16M4 10h10M4 14h16M4 18h10',
  alignCenter: 'M4 6h16M7 10h10M4 14h16M7 18h10',
  alignRight: 'M4 6h16M10 10h10M4 14h16M10 18h10',
  alignJustify: 'M4 6h16M4 10h16M4 14h16M4 18h16',
  listBullet: 'M9 6h11M9 12h11M9 18h11M4.5 6h1M4.5 12h1M4.5 18h1',
  listNumbered: 'M10 6h10M10 12h10M10 18h10M4 5.5 6 6v1M4 11.5 6 12v1M4 17.5 6 18v1',
  quote: 'M8 6C5 8 4 10 4 13v5h6v-6H6.5C6.5 10 7 9 8 8.5zM18 6c-3 2-4 4-4 7v5h6v-6h-3.5c0-2 .5-3 1.5-3.5z',
  linkIcon: 'M10 14a4 4 0 0 0 6 0l2.5-2.5a4 4 0 0 0-5.7-5.7L11.5 7M14 10a4 4 0 0 0-6 0l-2.5 2.5a4 4 0 0 0 5.7 5.7L12.5 17',
  imageIcon: 'M4 5h16v14H4zM4 16l4.5-4.5 3.5 3.5 3-3L20 17M9.5 10a1.5 1.5 0 1 0 0-.01',
  clearFormat: 'M6 20 12 4l6 16M8.5 14h7M4 4l16 16',
};
function icon(name, cls = 'icon') {
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('class', cls);
  svg.setAttribute('aria-hidden', 'true');
  const path = document.createElementNS(NS, 'path');
  path.setAttribute('d', PATHS[name] ?? '');
  svg.append(path);
  return svg;
}


/* --- session.js --- */
// Session : le jeton d'accès et le refresh token sont conservés en mémoire + localStorage
// pour survivre à un rechargement de page. Dans un déploiement de production, on préférerait
// un cookie httpOnly signé côté serveur ; ce choix est documenté dans le README (simplicité de démo).
const KEY = 'cej:session';

function read() {
  try {
    return JSON.parse(localStorage.getItem(KEY) || 'null');
  } catch {
    return null;
  }
}

let session = read();

const getSession = () => session;
const getUser = () => session?.user ?? null;

function setSession(next) {
  session = next;
  try {
    if (next) localStorage.setItem(KEY, JSON.stringify(next));
    else localStorage.removeItem(KEY);
  } catch {
    /* stockage indisponible : la session reste valable pour cet onglet */
  }
}

function updateTokens(accessToken, refreshToken) {
  if (!session) return;
  setSession({ ...session, accessToken, refreshToken });
}


/* --- api.js --- */

class ApiError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

// API backend. Le frontend peut être servi séparément (ex. Live Server sur :5500)
// tandis que l'API tourne sur http://localhost:4000.
const API_BASE_URL = (globalThis.__CEJ_API_URL__ || `${location.protocol}//${location.host}`).replace(/\/$/, '');

function apiUrl(path) {
  return `${API_BASE_URL}/api${path}`;
}

/** URL absolue vers un fichier servi statiquement (hors /api), ex. une image de publication. */
function mediaUrl(path) {
  return path ? `${API_BASE_URL}${path}` : null;
}

let refreshing = null;

async function doRefresh() {
  const current = getSession();
  if (!current?.refreshToken) throw new ApiError(401, 'no_session', t('errNoSession'));
  const res = await fetch(apiUrl('/auth/refresh'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken: current.refreshToken }),
  });
  const body = await res.json().catch(() => null);
  if (!res.ok || !body?.accessToken) {
    // Ne supprime jamais la session ici. Une erreur réseau temporaire ne doit
    // pas déconnecter l'utilisateur. La route de navigation décide ensuite
    // si la session est réellement invalide.
    throw new ApiError(res.status || 401, body?.error?.code ?? 'refresh_failed', body?.error?.message ?? 'Impossible de renouveler la session.');
  }
  // Le backend peut retourner ou non un nouveau refresh token.
  updateTokens(body.accessToken, body.refreshToken || current.refreshToken);
  return body.accessToken;
}

async function request(path, { method = 'GET', body, isForm = false, retry = true } = {}) {
  const makeRequest = async () => {
    const current = getSession();
    const headers = {};
    if (current?.accessToken) headers.Authorization = `Bearer ${current.accessToken}`;
    let payload = body;
    if (body && !isForm) {
      headers['Content-Type'] = 'application/json';
      payload = JSON.stringify(body);
    }
    return fetch(apiUrl(path), { method, headers, body: payload });
  };

  let res = await makeRequest();

  if (res.status === 401 && retry && getSession()?.refreshToken) {
    refreshing ??= doRefresh().finally(() => { refreshing = null; });
    try {
      await refreshing;
      res = await makeRequest();
    } catch (err) {
      // Une seule requête décide de déconnecter après un refresh réellement
      // refusé. Les erreurs réseau restent affichées sans effacer la session.
      if (err?.status === 401 && err?.code === 'invalid_refresh') {
        setSession(null);
        window.dispatchEvent(new CustomEvent('cej:session-expired'));
      }
      throw err;
    }
  }

  if (res.status === 204) return null;
  const contentType = res.headers.get('content-type') ?? '';
  const data = contentType.includes('application/json') ? await res.json().catch(() => null) : null;

  if (!res.ok) {
    if (res.status === 401) window.dispatchEvent(new CustomEvent('cej:session-expired'));
    throw new ApiError(res.status, data?.error?.code ?? 'error', data?.error?.message ?? res.statusText);
  }
  return data;
}

const api = {
  login: (email, password) => request('/auth/login', { method: 'POST', body: { email, password }, retry: false }),
  me: () => request('/auth/me'),
  changePassword: (currentPassword, newPassword) => request('/auth/change-password', { method: 'POST', body: { currentPassword, newPassword } }),

  dashboard: () => request('/dashboard'),

  clients: (q = '') => request(`/clients${q ? `?q=${encodeURIComponent(q)}` : ''}`),
  client: (id) => request(`/clients/${id}`),
  createClient: (body) => request('/clients', { method: 'POST', body }),
  updateClient: (id, body) => request(`/clients/${id}`, { method: 'PATCH', body }),
  deleteClient: (id) => request(`/clients/${id}`, { method: 'DELETE' }),

  cases: (params = {}) => request(`/cases?${new URLSearchParams(params)}`),
  case: (id) => request(`/cases/${id}`),
  createCase: (body) => request('/cases', { method: 'POST', body }),
  updateCase: (id, body) => request(`/cases/${id}`, { method: 'PATCH', body }),
  caseNotes: (id) => request(`/cases/${id}/notes`),
  addCaseNote: (id, content) => request(`/cases/${id}/notes`, { method: 'POST', body: { content } }),

  documents: (caseId) => request(`/cases/${caseId}/documents`),
  uploadDocument: (caseId, file) => {
    const form = new FormData();
    form.append('file', file);
    return request(`/cases/${caseId}/documents`, { method: 'POST', body: form, isForm: true });
  },
  deleteDocument: (id) => request(`/documents/${id}`, { method: 'DELETE' }),

  invoices: (params = {}) => request(`/invoices?${new URLSearchParams(params)}`),
  createInvoice: (body) => request('/invoices', { method: 'POST', body }),
  setInvoiceStatus: (id, status) => request(`/invoices/${id}/status`, { method: 'PATCH', body: { status } }),

  notifications: () => request('/notifications'),
  unreadCount: () => request('/notifications/unread-count'),
  markNotificationRead: (id) => request(`/notifications/${id}/read`, { method: 'POST' }),
  markAllRead: () => request('/notifications/read-all', { method: 'POST' }),

  users: () => request('/users'),
  createUser: (body) => request('/users', { method: 'POST', body }),
  updateUser: (id, body) => request(`/users/${id}`, { method: 'PATCH', body }),

  auditLogs: (params = {}) => request(`/audit-logs?${new URLSearchParams(params)}`),

  search: (q) => request(`/search?q=${encodeURIComponent(q)}`),

  calendar: (from, to) => request(`/calendar?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`),

  timeEntries: (params = {}) => request(`/time-entries?${new URLSearchParams(params)}`),
  caseTimeTotals: (caseId) => request(`/time-entries/case/${caseId}/totals`),
  createTimeEntry: (body) => request('/time-entries', { method: 'POST', body }),
  updateTimeEntry: (id, body) => request(`/time-entries/${id}`, { method: 'PATCH', body }),
  deleteTimeEntry: (id) => request(`/time-entries/${id}`, { method: 'DELETE' }),

  templates: () => request('/document-templates'),
  createTemplate: (body) => request('/document-templates', { method: 'POST', body }),
  updateTemplate: (id, body) => request(`/document-templates/${id}`, { method: 'PATCH', body }),
  deleteTemplate: (id) => request(`/document-templates/${id}`, { method: 'DELETE' }),
  renderTemplate: (id, variables) => request(`/document-templates/${id}/render`, { method: 'POST', body: { variables } }),

  myDocuments: () => request('/documents/mine'),
  declarePayment: (invoiceId) => request(`/invoices/${invoiceId}/declare-payment`, { method: 'POST' }),

  savedFilters: () => request('/saved-filters'),
  createSavedFilter: (body) => request('/saved-filters', { method: 'POST', body }),
  deleteSavedFilter: (id) => request(`/saved-filters/${id}`, { method: 'DELETE' }),

  publicPosts: () => request('/social/public/posts'),
  publicBlogPosts: (limit = 3) => request(`/blog/public?limit=${limit}`),
  practiceAreas: () => request('/practice-areas'),
  createPracticeArea: (body) => request('/practice-areas', { method: 'POST', body }),
  updatePracticeArea: (id, body) => request(`/practice-areas/${id}`, { method: 'PUT', body }),
  deletePracticeArea: (id) => request(`/practice-areas/${id}`, { method: 'DELETE' }),
  sendContact: (body) => request('/contact', { method: 'POST', body }),
  testimonials: () => request('/testimonials'),
  createTestimonial: (body, photoFile) => {
    if (!photoFile) return request('/testimonials', { method: 'POST', body });
    const form = new FormData();
    for (const [k, v] of Object.entries(body)) if (v != null) form.append(k, v);
    form.append('photo', photoFile);
    return request('/testimonials', { method: 'POST', body: form, isForm: true });
  },
  updateTestimonial: (id, body, photoFile, removePhoto = false) => {
    if (!photoFile && !removePhoto) return request(`/testimonials/${id}`, { method: 'PUT', body });
    const form = new FormData();
    for (const [k, v] of Object.entries(body)) if (v != null) form.append(k, v);
    if (photoFile) form.append('photo', photoFile);
    if (removePhoto) form.append('removePhoto', 'true');
    return request(`/testimonials/${id}`, { method: 'PUT', body: form, isForm: true });
  },
  deleteTestimonial: (id) => request(`/testimonials/${id}`, { method: 'DELETE' }),
  siteStats: () => request('/site-stats'),
  createSiteStat: (body) => request('/site-stats', { method: 'POST', body }),
  updateSiteStat: (id, body) => request(`/site-stats/${id}`, { method: 'PUT', body }),
  deleteSiteStat: (id) => request(`/site-stats/${id}`, { method: 'DELETE' }),
  uploadAboutPhoto: (file) => {
    const form = new FormData();
    form.append('photo', file);
    return request('/site-settings/about-photo', { method: 'POST', body: form, isForm: true });
  },
  removeAboutPhoto: () => request('/site-settings/about-photo', { method: 'DELETE' }),
  uploadHeroImage: (slot, file) => {
    const form = new FormData();
    form.append('photo', file);
    return request(`/site-settings/hero-images/${slot}`, { method: 'POST', body: form, isForm: true });
  },
  removeHeroImage: (slot) => request(`/site-settings/hero-images/${slot}`, { method: 'DELETE' }),
  posts: (q = {}) => {
    const qs = new URLSearchParams(Object.entries(q).filter(([, v]) => v !== undefined && v !== null).map(([k, v]) => [k, String(v)])).toString();
    return request(`/social/posts${qs ? `?${qs}` : ''}`);
  },
  createPost: (body, imageFiles = []) => {
    if (!imageFiles.length) return request('/social/posts', { method: 'POST', body });
    const form = new FormData();
    for (const [k, v] of Object.entries(body)) form.append(k, v);
    for (const f of imageFiles) form.append('images', f);
    return request('/social/posts', { method: 'POST', body: form, isForm: true });
  },
  updatePost: (id, body, newFiles = [], removedIds = [], removeAll = false) => {
    if (!newFiles.length && !removedIds.length && !removeAll) return request(`/social/posts/${id}`, { method: 'PATCH', body });
    const form = new FormData();
    for (const [k, v] of Object.entries(body)) form.append(k, v);
    for (const f of newFiles) form.append('images', f);
    if (removedIds.length) form.append('removeImageIds', JSON.stringify(removedIds));
    if (removeAll) form.append('removeImage', 'true');
    return request(`/social/posts/${id}`, { method: 'PATCH', body: form, isForm: true });
  },
  deletePost: (id) => request(`/social/posts/${id}`, { method: 'DELETE' }),
  userProfile: (id) => request(`/users/${id}/profile`),
  toggleLike: (id) => request(`/social/posts/${id}/like`, { method: 'POST' }),
  postComments: (id) => request(`/social/posts/${id}/comments`),
  addComment: (id, content) => request(`/social/posts/${id}/comments`, { method: 'POST', body: { content } }),
  messageUsers: () => request('/social/messages/users'),
  messages: (userId) => request(`/social/messages/${userId}`),
  sendMessage: (recipientId, content, attachmentDocumentId) => request('/social/messages', { method: 'POST', body: { recipientId, content, ...(attachmentDocumentId ? { attachmentDocumentId } : {}) } }),
  unreadCount: () => request('/social/messages/unread-count'),
  msgSearch: (q) => request(`/social/messages/search?q=${encodeURIComponent(q)}`),
  sendTyping: (userId) => request(`/social/messages/typing/${userId}`, { method: 'POST' }).catch(() => null),
  getTyping: (userId) => request(`/social/messages/typing/${userId}`).catch(() => ({ typing: false })),
  attachFile: (messageId, file) => {
    const fd = new FormData();
    fd.append('file', file);
    return request(`/social/messages/${messageId}/attachment`, { method: 'POST', body: fd, isForm: true });
  },
  conversations: (caseId) => request(`/social/conversations${caseId ? `?caseId=${caseId}` : ''}`),
  createConversation: (body) => request('/social/conversations', { method: 'POST', body }),
  convMessages: (id) => request(`/social/conversations/${id}/messages`),
  sendConvMessage: (id, content, attachmentDocumentId) => request(`/social/conversations/${id}/messages`, { method: 'POST', body: { content, ...(attachmentDocumentId ? { attachmentDocumentId } : {}) } }),
  convSendTyping: (id) => request(`/social/conversations/${id}/typing`, { method: 'POST' }).catch(() => null),
  convGetTyping: (id) => request(`/social/conversations/${id}/typing`).catch(() => ({ typing: [] })),
  aiStatus: () => request('/ai/status'),
  askAI: (question, caseId, lang) => request('/ai/ask', { method: 'POST', body: { question, ...(caseId ? { caseId } : {}), ...(lang ? { lang } : {}) } }),
  indexDocument: (id) => request(`/ai/index-document/${id}`, { method: 'POST' }),
  registerRequest: (body) => request('/registration-requests', { method: 'POST', body }),
  siteSettings: () => request('/site-settings'),
  updateSiteSettings: (body) => request('/site-settings', { method: 'PUT', body }),
  uploadLogo: (file) => {
    const form = new FormData();
    form.append('logo', file);
    return request('/site-settings/logo', { method: 'POST', body: form, isForm: true });
  },
  removeLogo: () => request('/site-settings/logo', { method: 'DELETE' }),

  blogPosts: (params = {}) => request(`/blog?${new URLSearchParams(params)}`),
  createBlogPost: (body, coverFile) => {
    if (!coverFile) return request('/blog', { method: 'POST', body });
    const form = new FormData();
    for (const [k, v] of Object.entries(body)) if (v != null) form.append(k, v);
    form.append('cover', coverFile);
    return request('/blog', { method: 'POST', body: form, isForm: true });
  },
  updateBlogPost: (id, body, coverFile, removeCover = false) => {
    if (!coverFile && !removeCover) return request(`/blog/${id}`, { method: 'PUT', body });
    const form = new FormData();
    for (const [k, v] of Object.entries(body)) if (v != null) form.append(k, v);
    if (coverFile) form.append('cover', coverFile);
    if (removeCover) form.append('removeCover', 'true');
    return request(`/blog/${id}`, { method: 'PUT', body: form, isForm: true });
  },
  deleteBlogPost: (id) => request(`/blog/${id}`, { method: 'DELETE' }),
  uploadBlogImage: (file) => {
    const form = new FormData();
    form.append('image', file);
    return request('/blog/images', { method: 'POST', body: form, isForm: true });
  },
};

/**
 * Télécharge un fichier protégé (le jeton doit passer par l'en-tête Authorization, pas par l'URL)
 * et déclenche l'enregistrement côté navigateur.
 */
async function downloadFile(path, fallbackName) {
  const session = getSession();
  const res = await fetch(apiUrl(path), { headers: { Authorization: `Bearer ${session?.accessToken ?? ''}` } });
  if (!res.ok) throw new ApiError(res.status, 'download_failed', t('errDownloadFailed'));
  const blob = await res.blob();
  const disposition = res.headers.get('content-disposition') ?? '';
  const match = disposition.match(/filename="([^"]+)"/);
  const name = match?.[1] ?? fallbackName;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

/** Comme downloadFile, mais ouvre le PDF dans un nouvel onglet plutôt que de l'enregistrer. */
async function openFile(path) {
  const session = getSession();
  const res = await fetch(apiUrl(path), { headers: { Authorization: `Bearer ${session?.accessToken ?? ''}` } });
  if (!res.ok) throw new ApiError(res.status, 'open_failed', "L'ouverture du fichier a échoué.");
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  window.open(url, '_blank', 'noopener');
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}


/* --- app.js --- */

const root = document.getElementById('root');

/* ------------------------------------------------------------------ */
/* Aides générales                                                     */
/* ------------------------------------------------------------------ */

const $ = (sel, r = document) => r.querySelector(sel);

let toastTimer;
function toast(message, kind = 'info') {
  const el = document.getElementById('toast');
  el.textContent = message;
  el.className = `toast show ${kind}`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (el.className = 'toast'), 3200);
}

const fmtLocale = () => (getLang() === 'fr' ? 'fr-CA' : 'en-CA');
const fmtMoney = (cents) => (cents / 100).toLocaleString(fmtLocale(), { style: 'currency', currency: 'CAD' });
const fmtMoneyShort = (cents) => (cents / 100).toLocaleString(fmtLocale(), { style: 'currency', currency: 'CAD', maximumFractionDigits: 0 });
const fmtDate = (d) => (d ? new Date(d).toLocaleDateString(fmtLocale()) : '—');
const fmtDateTime = (d) => (d ? new Date(d).toLocaleString(fmtLocale()) : '—');
const initials = (first, last) => `${(first?.[0] ?? '').toUpperCase()}${(last?.[0] ?? '').toUpperCase()}`;

/* Libellés localisés (reconstruits à chaque appel pour suivre la langue active). */
const CASE_STATUS = () => ({ NOUVEAU: t('caseStatus_NOUVEAU'), EN_COURS: t('caseStatus_EN_COURS'), EN_ATTENTE: t('caseStatus_EN_ATTENTE'), TERMINE: t('caseStatus_TERMINE'), ARCHIVE: t('caseStatus_ARCHIVE') });
const CASE_PRIORITY = () => ({ BASSE: t('casePriority_BASSE'), NORMALE: t('casePriority_NORMALE'), HAUTE: t('casePriority_HAUTE'), URGENTE: t('casePriority_URGENTE') });
const INVOICE_STATUS = () => ({
  BROUILLON: t('invoiceStatus_BROUILLON'), ENVOYEE: t('invoiceStatus_ENVOYEE'), PAYEE: t('invoiceStatus_PAYEE'),
  PARTIELLEMENT_PAYEE: t('invoiceStatus_PARTIELLEMENT_PAYEE'), EN_RETARD: t('invoiceStatus_EN_RETARD'), ANNULEE: t('invoiceStatus_ANNULEE'),
});
const ROLE_LABEL = () => ({
  SUPER_ADMIN: t('role_SUPER_ADMIN'), ADMIN: t('role_ADMIN'), LAWYER: t('role_LAWYER'),
  ASSISTANT: t('role_ASSISTANT'), ACCOUNTANT: t('role_ACCOUNTANT'), CLIENT: t('role_CLIENT'),
});

function statusDot(status, map) {
  return h('span', { class: `status status-${status}` }, h('span', { class: 'status-dot' }), map[status] ?? status);
}

function errorMessage(err) {
  return err instanceof ApiError ? err.message : t('errGeneric');
}

async function guarded(fn, { onError } = {}) {
  try {
    return await fn();
  } catch (err) {
    (onError ?? toast)(errorMessage(err), 'error');
    return undefined;
  }
}

/* ------------------------------------------------------------------ */
/* Modale générique                                                    */
/* ------------------------------------------------------------------ */

function openModal(title, contentEl, { wide = false } = {}) {
  const overlay = h(
    'div',
    { class: 'overlay', onclick: (e) => e.target === overlay && close() },
    h(
      'div',
      { class: `modal${wide ? ' wide' : ''}`, role: 'dialog', 'aria-modal': 'true', 'aria-label': title },
      h('header', null, h('h2', null, title), h('button', { class: 'icon-btn', type: 'button', 'aria-label': t('close'), onclick: () => close() }, icon('close'))),
      contentEl,
    ),
  );
  function close() {
    overlay.remove();
    document.removeEventListener('keydown', onKey);
  }
  function onKey(e) {
    if (e.key === 'Escape') close();
  }
  document.addEventListener('keydown', onKey);
  document.body.append(overlay);
  return close;
}

function field(labelText, inputEl) {
  return h('label', { class: 'field' }, h('span', null, labelText), inputEl);
}

/* ------------------------------------------------------------------ */
/* Personnalisation white-label                                         */
/* ------------------------------------------------------------------ */

/** Paramètres du cabinet (un déploiement = un cabinet), chargés au démarrage. */
let siteSettings = null;

async function loadSiteSettings() {
  try {
    siteSettings = await api.siteSettings();
  } catch {
    siteSettings = null;
  }
  applySiteSettings();
}

/** Applique les couleurs et le titre du cabinet, sans rechargement. */
function applySiteSettings() {
  const root = document.documentElement;
  const primary = siteSettings?.primaryColor || '#0f1e33';
  const accent = siteSettings?.accentColor || '#b08d3e';
  root.style.setProperty('--brand-primary', primary);
  root.style.setProperty('--brand-accent', accent);
  root.style.setProperty('--accent', accent);
  document.title = firmName();
}

function firmName() {
  return siteSettings?.firmName || t('brand');
}

/** URL absolue du logo téléversé, ou null. */
function logoUrl() {
  return siteSettings?.logoPath ? mediaUrl(`/uploads/${siteSettings.logoPath}`) : null;
}

function aboutPhotoUrl() {
  return siteSettings?.aboutPhotoPath ? mediaUrl(`/uploads/${siteSettings.aboutPhotoPath}`) : null;
}

/**
 * Adresse structurée du cabinet → lignes d'affichage.
 * Format canadien : rue / ville province code postal / pays.
 * Repli sur l'ancien champ unique `address` si les champs structurés sont vides.
 */
function addressLines(s) {
  const street = (s.addressStreet || '').trim();
  const cityProv = [s.addressCity, s.addressProvince].map((x) => (x || '').trim()).filter(Boolean).join(' ');
  const postal = (s.addressPostal || '').trim();
  const line2 = [cityProv, postal].filter(Boolean).join('  ');
  const country = (s.addressCountry || '').trim();
  const lines = [street, line2, country].filter(Boolean);
  if (lines.length) return lines;
  const legacy = (s.address || '').trim();
  return legacy ? [legacy] : [];
}

/** Signature BB24 — le nom ouvre l'email de l'auteur avec un message prêt à envoyer. */
function bb24Credit() {
  const lang = getLang();
  const subject = encodeURIComponent('Contact via Cabinet Élite Juridique');
  const body = encodeURIComponent(lang === 'en'
    ? 'Hello,\n\nI am contacting you from the Cabinet Élite Juridique website.\n\nBest regards,'
    : 'Bonjour,\n\nJe vous contacte depuis le site du Cabinet Élite Juridique.\n\nCordialement,');
  return [
    'BUILT WITH LOVE AND CAFFEINE BY ',
    h('a', { href: `mailto:tshibambabenoni@gmail.com?subject=${subject}&body=${body}`, class: 'bb24-link' }, 'BB24'),
  ];
}
/** Adresse en une seule ligne, pour Google Maps et les textes compacts. */
function addressQuery(s) {
  return addressLines(s).join(', ');
}

/** La carte ne s'affiche que si une rue est renseignée (adresse précise). */
function hasMapAddress(s) {
  return Boolean((s.addressStreet || '').trim());
}

/**
 * Marque du cabinet : logo téléversé ou monogramme (initiale du nom).
 * `small` pour la barre latérale, taille normale pour la page publique.
 */
function firmMark(small = false) {
  const url = logoUrl();
  if (url) {
    return h('img', { class: small ? 'firm-logo-sm' : 'firm-logo', src: url, alt: firmName() });
  }
  const initial = (firmName().trim()[0] || 'C').toUpperCase();
  return h('span', { class: `firm-monogram${small ? ' firm-monogram-sm' : ''}`, 'aria-hidden': 'true' }, initial);
}

/* ------------------------------------------------------------------ */
/* Routage                                                             */
/* ------------------------------------------------------------------ */

function parseHash() {
  const parts = location.hash.replace(/^#\/?/, '').split('/').filter(Boolean).map(decodeURIComponent);
  return { name: parts[0] || 'home', id: parts[1] };
}

/** Paramètres de requête éventuels dans le hash (ex. #/reset-password?token=…). */
function hashQuery() {
  const idx = location.hash.indexOf('?');
  if (idx < 0) return {};
  return Object.fromEntries(new URLSearchParams(location.hash.slice(idx + 1)));
}

let currentUser = null;

async function route() {
  const { name: rawName, id: rawId } = parseHash();
  const name = rawName.split('?')[0];
  const id = rawId ? rawId.split('?')[0] : rawId;
  const q = hashQuery();
  clearMsgPoll();
  clearTimerTick();

  // La connexion est une vraie route. Cela évite les boutons qui ne déclenchent
  // rien et permet d'ouvrir directement la page de connexion via #/login.
  if (name === 'login') {
    return renderLogin();
  }

  // Réinitialisation du mot de passe (lien reçu par courriel).
  if (name === 'reset-password') {
    return renderResetPassword(q.token);
  }

  // Retour de la connexion Google (échange du code contre une session).
  if (name === 'oauth' && id === 'callback') {
    return handleOauthCallback(q.code);
  }

  // Page publique "L'application" (vitrine du logiciel), accessible à tous.
  if (name === 'web-app') {
    currentUser = getSession()?.user ?? null;
    syncChatWidget();
    return renderWebAppPage(currentUser);
  }

  const session = getSession();

  // L'accueil est désormais la même page publique avant et après connexion.
  // Nous n'appelons volontairement pas /me ici : l'utilisateur vient de se connecter
  // et son identité/permissions sont déjà stockées dans la session locale. Cela évite
  // qu'une erreur de refresh/token fasse disparaître l'accueil.
  if (!session?.user?.id) {
    currentUser = null;
    syncChatWidget();
    return renderPublicHome(null);
  }

  currentUser = session.user;
  if (!name || name === 'home' || name === 'social') {
    syncChatWidget();
    refreshMsgNavBadge();
    return renderPublicHome(currentUser);
  }

  // Les autres écrans restent privés et utilisent /me pour vérifier la session.
  try {
    currentUser = await api.me();
  } catch (err) {
    const cached = getSession()?.user;
    if (cached?.id && Array.isArray(cached.permissions)) {
      currentUser = cached;
    } else {
      setSession(null);
      currentUser = null;
      syncChatWidget();
      return renderPublicHome(null);
    }
  }

  const perms = new Set(currentUser.permissions ?? []);
  renderShell(perms);
  const main = $('#main');
  clear(main).append(h('p', { class: 'loading' }, t('loading')));

  const views = {
    dashboard: () => viewDashboard(main),
    profile: () => viewProfile(main, id),
    blog: () => viewBlog(main),
    messages: () => viewMessages(main),
    ai: () => viewAI(main),
    clients: () => (id ? viewClientDetail(main, id) : viewClients(main)),
    cases: () => (id ? viewCaseDetail(main, id) : viewCases(main)),
    kanban: () => viewKanban(main),
    calendar: () => viewCalendar(main),
    time: () => viewTime(main),
    templates: () => viewTemplates(main),
    invoices: () => viewInvoices(main),
    users: () => viewUsers(main),
    audit: () => viewAudit(main),
    customize: () => viewCustomize(main),
    'contact-messages': () => viewContactMessages(main),
  };
  (views[name] ?? views.dashboard)();
  highlightNav(name);
  refreshMsgNavBadge();
  syncChatWidget();
}

window.addEventListener('hashchange', route);
window.addEventListener('cej:session-expired', () => {
  setSession(null);
  currentUser = null;
  toast(t('errSessionExpired'), 'error');
  renderPublicHome(null);
});

/* ------------------------------------------------------------------ */
/* Connexion                                                           */
/* ------------------------------------------------------------------ */


/** Fait défiler la page jusqu'à une section, sans passer par le routeur (qui écoute #hashchange). */
function scrollToId(id) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/* --- i18n.js : chargé séparément (voir index.html) : getLang/setLang/toggleLang/STRINGS/t --- */



const LANDING_FEATURES = [
  { icon: 'cases', titleKey: 'landF1T', textKey: 'landF1D' },
  { icon: 'calendar', titleKey: 'landF2T', textKey: 'landF2D' },
  { icon: 'clock', titleKey: 'landF3T', textKey: 'landF3D' },
  { icon: 'file', titleKey: 'landF4T', textKey: 'landF4D' },
  { icon: 'billing', titleKey: 'landF5T', textKey: 'landF5D' },
  { icon: 'users', titleKey: 'landF6T', textKey: 'landF6D' },
  { icon: 'search', titleKey: 'landF7T', textKey: 'landF7D' },
  { icon: 'kanban', titleKey: 'landF8T', textKey: 'landF8D' },
  { icon: 'audit', titleKey: 'landF9T', textKey: 'landF9D' },
  { icon: 'bell', titleKey: 'landF10T', textKey: 'landF10D' },
];

/* ------------------------------------------------------------------ */
/* Site public — style cabinet d'avocats classique (navy/gold)         */
/* ------------------------------------------------------------------ */

/** En-tête + pied de page partagés par les pages publiques. */
function publicChrome(loggedUser, s, areas, contactEmail, contactPhone, addressText) {
  const topbar = h('div', { class: 'public-topbar' },
    h('div', { class: 'public-topbar-contact' },
      h('span', null, icon('mail', 'icon icon-sm'), ' ', h('a', { href: `mailto:${contactEmail}` }, contactEmail)),
      h('span', null, icon('phone', 'icon icon-sm'), ' ', contactPhone),
      h('span', null, t('topbarHours')),
    ),
  );

  // Menu déroulant (desktop : survol + clic ; mobile : replié dans le tiroir).
  const navDropdown = (label, items) => {
    const menu = h('div', { class: 'nav-drop-menu', hidden: true });
    for (const it of items) menu.append(it);
    const btn = h('button', { class: 'public-nav-link', type: 'button', 'aria-haspopup': 'true', 'aria-expanded': 'false' },
      label, ' ', icon('chevronDown', 'icon icon-sm'));
    const wrap = h('div', { class: 'nav-drop' }, btn, menu);
    btn.onclick = (e) => {
      e.stopPropagation();
      const willOpen = menu.hidden;
      document.querySelectorAll('.nav-drop-menu').forEach((m) => { m.hidden = true; });
      menu.hidden = !willOpen;
      btn.setAttribute('aria-expanded', String(willOpen));
      if (willOpen) setTimeout(() => document.addEventListener('click', () => { menu.hidden = true; btn.setAttribute('aria-expanded', 'false'); }, { once: true }), 0);
    };
    return wrap;
  };
  const dropLink = (label, onclick) => h('button', { class: 'nav-drop-item', type: 'button', onclick }, label);
  const dropAnchor = (label, href) => h('a', { class: 'nav-drop-item', href }, label);

  const navMain = [
    h('button', { class: 'public-nav-link', type: 'button', onclick: () => scrollToId('accueil') }, t('navHome')),
    h('button', { class: 'public-nav-link', type: 'button', onclick: () => scrollToId('apropos') }, t('navAbout')),
    navDropdown(t('navPractice'), areas.length
      ? areas.map((a) => dropLink(a.title, () => scrollToId('domaines')))
      : [dropLink(t('navPractice'), () => scrollToId('domaines'))]),
    navDropdown(t('navServices'), [
      dropLink(t('svcConsultation'), () => scrollToId('contact')),
      dropLink(t('svcClientSpace'), () => { location.hash = '#/login'; }),
      dropLink(t('svcWebApp'), () => { location.hash = '#/web-app'; }),
    ]),
    h('a', { class: 'public-nav-link', href: '/blog' }, t('navBlog')),
    h('button', { class: 'public-nav-link', type: 'button', onclick: () => scrollToId('contact') }, t('navContact')),
  ];

  const themeBtn = h('button', {
    class: 'icon-btn', type: 'button', 'aria-label': t('changerTheme'), title: t('changerTheme'),
    onclick: toggleTheme,
  }, icon(document.documentElement.dataset.theme === 'dark' ? 'sun' : 'moon'));
  const langBtn = h('button', {
    class: 'btn btn-secondary lang-toggle', type: 'button', 'aria-label': t('changerLangue'), title: t('changerLangue'),
    onclick: toggleLang,
  }, getLang() === 'fr' ? 'EN' : 'FR');

  const accountBtns = loggedUser
    ? [
        h('button', { class: 'btn btn-secondary', type: 'button', onclick: async () => { location.hash = '#/dashboard'; await route(); } }, t('monEspace')),
        h('button', { class: 'btn btn-primary', type: 'button', onclick: () => openPostModal() }, icon('plus'), t('ajouterPublication')),
      ]
    : [
        h('button', { class: 'btn btn-ghost', type: 'button', onclick: () => { location.hash = '#/login'; } }, t('seConnecter')),
        h('button', { class: 'btn btn-primary login-top-btn', type: 'button', onclick: openRegistrationModal }, t('landDemo')),
      ];

  // Tiroir mobile (fond navy, liens centrés, contact + langue en bas).
  const scrim = h('button', { class: 'drawer-scrim', type: 'button', hidden: true, 'aria-hidden': 'true', tabindex: '-1' });
  const drawer = h('div', { class: 'mobile-drawer', role: 'dialog', 'aria-label': t('navHome') });
  const closeDrawer = () => { drawer.classList.remove('open'); scrim.hidden = true; document.body.style.overflow = ''; };
  const openDrawer = () => { drawer.classList.add('open'); scrim.hidden = false; document.body.style.overflow = 'hidden'; };
  scrim.onclick = closeDrawer;
  const goDrawer = (fn) => () => { closeDrawer(); fn(); };
  drawer.append(
    h('button', { class: 'drawer-close', type: 'button', 'aria-label': t('close'), onclick: closeDrawer }, '×'),
    h('nav', { class: 'drawer-nav' },
      h('button', { type: 'button', onclick: goDrawer(() => scrollToId('accueil')) }, t('navHome')),
      h('button', { type: 'button', onclick: goDrawer(() => scrollToId('apropos')) }, t('navAbout')),
      h('button', { type: 'button', onclick: goDrawer(() => scrollToId('domaines')) }, t('navPractice')),
      h('button', { type: 'button', onclick: goDrawer(() => scrollToId('contact')) }, t('svcConsultation')),
      h('a', { href: '/blog', onclick: closeDrawer }, t('navBlog')),
      h('button', { type: 'button', onclick: goDrawer(() => scrollToId('contact')) }, t('navContact')),
      h('button', { type: 'button', onclick: goDrawer(() => { location.hash = '#/web-app'; }) }, t('svcWebApp')),
      h('button', { type: 'button', onclick: goDrawer(() => { location.hash = '#/login'; }) }, t('seConnecter')),
    ),
    h('div', { class: 'drawer-contact' },
      h('p', null, h('a', { href: `mailto:${contactEmail}` }, contactEmail)),
      h('p', null, contactPhone),
      h('p', null, t('topbarHours')),
    ),
    h('div', { class: 'drawer-foot' },
      h('button', { class: 'btn btn-secondary', type: 'button', onclick: () => { setLang('fr'); closeDrawer(); route(); } }, 'FR'),
      h('button', { class: 'btn btn-secondary', type: 'button', onclick: () => { setLang('en'); closeDrawer(); route(); } }, 'EN'),
    ),
  );
  const burger = h('button', { class: 'icon-btn burger', type: 'button', 'aria-label': t('navHome'), onclick: openDrawer }, icon('menu'));

  const header = h('header', { class: 'public-header' },
    h('div', { class: 'public-brand' }, firmMark(), h('span', null, firmName())),
    h('nav', { class: 'public-nav' }, ...navMain),
    h('div', { class: 'public-header-actions' }, themeBtn, langBtn, ...accountBtns, burger),
  );

  const footerNav = [
    h('button', { class: 'link-btn', type: 'button', onclick: () => scrollToId('accueil') }, t('navHome')),
    h('button', { class: 'link-btn', type: 'button', onclick: () => scrollToId('apropos') }, t('navAbout')),
    h('button', { class: 'link-btn', type: 'button', onclick: () => scrollToId('domaines') }, t('navPractice')),
    h('a', { class: 'link-btn', href: '/blog' }, t('navBlog')),
    h('a', { class: 'link-btn', href: '#/web-app' }, t('svcWebApp')),
    h('button', { class: 'link-btn', type: 'button', onclick: () => scrollToId('contact') }, t('navContact')),
  ];
  const footer = h('footer', { class: 'public-footer' },
    h('div', { class: 'public-footer-grid' },
      h('div', { class: 'public-footer-col' },
        h('div', { class: 'public-brand' }, firmMark(), h('span', null, firmName())),
        h('p', { class: 'muted' }, s.footerText || s.heroSubtitle || t('landHeroText')),
      ),
      h('div', { class: 'public-footer-col' },
        h('h4', null, t('footerAccessTitle')),
        ...footerNav,
      ),
      h('div', { class: 'public-footer-col' },
        h('h4', null, t('footerInfo')),
        h('p', { class: 'muted' }, addressText),
        h('p', { class: 'muted' }, `${contactPhone} · ${contactEmail}`),
        loggedUser
          ? h('button', { class: 'link-btn', type: 'button', onclick: logout }, t('seDeconnecter'))
          : h('button', { class: 'link-btn', type: 'button', onclick: () => { location.hash = '#/login'; } }, t('seConnecter')),
      )
    ),
    h('div', { class: 'public-footer-bottom' },
      h('span', null, `© ${firmName()} ${new Date().getFullYear()}`),
      h('span', null, t('footerInfo'))
    ),
    h('div', { class: 'public-footer-credit' }, ...bb24Credit())
  );

  return { topbar, header, drawer, footer };
}

/** Formulaire de contact public. Après l'enregistrement, ouvre l'app email du visiteur
 *  avec un message pré-rempli vers le courriel du cabinet (aucun SMTP requis). */
function contactForm(contactEmail) {
  const f = {
    name: h('input', { required: true, maxlength: '120', placeholder: t('formNamePh') }),
    email: h('input', { required: true, type: 'email', maxlength: '180', placeholder: t('formEmailPh') }),
    phone: h('input', { type: 'tel', maxlength: '40', placeholder: t('formPhonePh') }),
    message: h('textarea', { required: true, rows: 5, maxlength: '5000', placeholder: t('formMessagePh') }),
  };
  const errorBox = h('p', { class: 'form-error', hidden: true });
  const form = h('form', {
    class: 'contact-form', onsubmit: async (e) => {
      e.preventDefault();
      errorBox.hidden = true;
      const btn = form.querySelector('button[type="submit"]');
      btn.disabled = true;
      const label = btn.textContent;
      btn.textContent = t('formSending');
      try {
        const fields = { name: f.name.value.trim(), email: f.email.value.trim(), phone: f.phone.value.trim() || null, message: f.message.value.trim() };
        await api.sendContact(fields);
        // Le message part aussi directement dans la boîte du cabinet via l'app email du visiteur.
        if (contactEmail) window.location.href = buildContactMailto(contactEmail, fields, getLang());
        form.reset();
        toast(t('contactSent'));
      } catch (err) { errorBox.textContent = errorMessage(err); errorBox.hidden = false; }
      finally { btn.disabled = false; btn.textContent = label; }
    },
  },
    h('div', { class: 'form-row' }, field(t('formName'), f.name), field(t('formEmail'), f.email)),
    field(t('formPhone'), f.phone),
    field(t('formMessage'), f.message),
    errorBox,
    h('button', { class: 'btn btn-primary btn-large', type: 'submit' }, t('formSend')));
  return form;
}

/** Diaporama d'accueil : rotation toutes les 60 s, pause si l'onglet est caché. */
function startHeroSlideshow(heroEl) {
  const slides = [...heroEl.querySelectorAll('.hero-slide')];
  const dots = [...heroEl.querySelectorAll('.hero-dot')];
  if (slides.length < 2) return;
  let idx = 0;
  let timer = null;
  const show = (n) => {
    idx = (n + slides.length) % slides.length;
    slides.forEach((sl, i) => sl.classList.toggle('active', i === idx));
    dots.forEach((d, i) => d.classList.toggle('active', i === idx));
  };
  heroEl._heroGo = show;
  const tick = () => show(idx + 1);
  const arm = () => { clearInterval(timer); timer = setInterval(tick, 60000); };
  const disarm = () => clearInterval(timer);
  arm();
  document.addEventListener('visibilitychange', () => { document.hidden ? disarm() : arm(); });
  // Nettoyage si la page d'accueil est remplacée (évite les intervalles fantômes).
  new MutationObserver(() => { if (!document.contains(heroEl)) { disarm(); } })
    .observe(document.getElementById('root'), { childList: true });
}
function heroGo(i, dotEl) {
  const heroEl = dotEl?.closest('.public-hero');
  if (heroEl && typeof heroEl._heroGo === 'function') heroEl._heroGo(i);
}

async function renderPublicHome(loggedUser = null) {
  document.title = `${t('navHome')} — ${firmName()}`;
  const s = siteSettings ?? {};
  const contactEmail = s.contactEmail || t('courrielValue');
  const contactPhone = s.contactPhone || t('telephoneValue');
  const addressText = addressQuery(s) || t('adresseValue');
  shellBuilt = false;

  let areas = [];
  try { areas = await api.practiceAreas() ?? []; } catch { areas = []; }
  let latestPosts = [];
  try { latestPosts = await api.publicBlogPosts(3) ?? []; } catch { latestPosts = []; }
  let testimonials = [];
  try { testimonials = await api.testimonials() ?? []; } catch { testimonials = []; }
  let stats = [];
  try { stats = await api.siteStats() ?? []; } catch { stats = []; }

  const chrome = publicChrome(loggedUser, s, areas, contactEmail, contactPhone, addressText);
  const show = (key, el) => (s[key] !== false ? el : null);

  // Diaporama d'accueil : 5 images max, fondu enchaîné, rotation toutes les 60 s
  // (pause quand l'onglet est caché), pastilles pour naviguer manuellement.
  const heroImgs = (s.heroImages ?? []).filter(Boolean).map((p) => mediaUrl(`/uploads/${p}`));
  const heroSection = h('section', { class: 'public-hero', id: 'accueil' },
    heroImgs.length ? h('div', { class: 'hero-slides', 'aria-hidden': 'true' },
      ...heroImgs.map((src, i) => h('div', { class: `hero-slide${i === 0 ? ' active' : ''}` },
        h('img', { src, alt: '', loading: i === 0 ? 'eager' : 'lazy' })))
    ) : null,
    heroImgs.length > 1 ? h('div', { class: 'hero-dots', role: 'tablist', 'aria-label': t('heroSlideshow') },
      ...heroImgs.map((_, i) => h('button', {
        class: `hero-dot${i === 0 ? ' active' : ''}`, type: 'button', role: 'tab',
        'aria-label': `${t('heroSlide')} ${i + 1}`,
        onclick: (e) => heroGo(i, e.currentTarget),
      }))
    ) : null,
    h('div', { class: 'public-hero-content' },
      h('span', { class: 'public-kicker' }, s.tagline || t('kicker')),
      h('h1', null, s.heroTitle || t('landHeroTitle')),
      h('p', null, s.heroSubtitle || t('landHeroText')),
      h('div', { class: 'public-hero-actions' },
        h('button', { class: 'btn btn-primary btn-large', type: 'button', onclick: () => scrollToId('contact') }, t('landHeroCtaContact')),
        h('button', { class: 'btn btn-ghost btn-large', type: 'button', onclick: () => { location.hash = '#/login'; } }, t('svcClientSpace')),
      ),
    )
  );
  const hero = heroSection;
  if (heroImgs.length > 1) startHeroSlideshow(heroSection);

  const aboutPhoto = aboutPhotoUrl() ? h('img', { class: 'about-photo', src: aboutPhotoUrl(), alt: '' }) : null;
  const aboutSection = h('section', { class: 'public-section', id: 'apropos' },
    h('div', { class: 'public-section-head' },
      h('div', null,
        h('span', { class: 'section-kicker' }, t('navAbout')),
        h('h2', null, t('landAboutTitle')),
      )
    ),
    h('div', { class: 'about-layout' },
      aboutPhoto,
      h('div', { class: 'about-body' },
        h('h3', null, s.aboutTitle || firmName()),
        h('p', null, s.aboutText || t('landAboutDefault')),
      ),
    ),
    stats.length ? h('dl', { class: 'stats-band' },
      ...stats.map((st) => h('div', { class: 'stat' }, h('dt', null, st.value), h('dd', null, st.label)))) : null
  );

  const areasSection = h('section', { class: 'public-section', id: 'domaines' },
    h('div', { class: 'public-section-head' },
      h('div', null,
        h('span', { class: 'section-kicker' }, t('navPractice')),
        h('h2', null, s.practiceTitle || t('landPracticeTitle')),
        h('p', { class: 'muted' }, t('landPracticeIntro')),
      )
    ),
    areas.length
      ? h('div', { class: 'practice-grid' },
          ...areas.map((a, i) => h('article', { class: 'panel practice-card' },
            h('span', { class: 'practice-num' }, String(i + 1).padStart(2, '0')),
            h('h3', null, a.title),
            a.description ? h('p', { class: 'muted' }, a.description) : null,
          )))
      : h('p', { class: 'empty-state' }, t('landPracticeEmpty'))
  );

  // Publications du cabinet : visibles sur l'accueil pour les utilisateurs connectés
  // ayant la permission posts.read (le fil utilise les mêmes cartes que partout).
  const loggedPerms = loggedUser ? new Set(loggedUser.permissions ?? []) : new Set();
  const showPubSection = !!loggedUser && loggedPerms.has('posts.read') && s.showPosts !== false;
  const pubFeed = h('div', { class: 'feed' });
  const pubSection = showPubSection ? h('section', { class: 'public-section', id: 'publications' },
    h('div', { class: 'public-section-head' },
      h('div', null,
        h('span', { class: 'section-kicker' }, t('navPublications')),
        h('h2', null, t('publicationsTitle')),
      ),
      loggedPerms.has('posts.create')
        ? h('button', { class: 'btn btn-primary', type: 'button', onclick: () => openPostModal() }, icon('plus'), t('ajouterPublication'))
        : null
    ),
    pubFeed
  ) : null;

  const blogSection = latestPosts.length ? h('section', { class: 'public-section', id: 'blogapercu' },
    h('div', { class: 'public-section-head' },
      h('div', null,
        h('span', { class: 'section-kicker' }, t('navBlog')),
        h('h2', null, t('landBlogTitle')),
        h('p', { class: 'muted' }, t('landBlogIntro')),
      ),
      h('a', { class: 'btn btn-secondary', href: '/blog' }, t('landBlogViewAll')),
    ),
    h('div', { class: 'blog-preview-grid' },
      ...latestPosts.map((p) => h('article', { class: 'panel blog-preview-card' },
        p.coverUrl ? h('a', { href: `/blog/${p.slug}` }, h('img', { src: p.coverUrl, alt: '', loading: 'lazy', class: 'blog-preview-cover' })) : null,
        h('div', { class: 'blog-preview-body' },
          h('p', { class: 'muted blog-preview-date' }, fmtDate(p.publishedAt)),
          h('h3', null, h('a', { href: `/blog/${p.slug}` }, p.title)),
          p.excerpt ? h('p', { class: 'muted' }, p.excerpt) : null,
          h('a', { class: 'link-btn', href: `/blog/${p.slug}` }, t('landBlogReadMore')),
        ))))
  ) : null;

  const testiSection = testimonials.length ? h('section', { class: 'public-section', id: 'temoignages' },
    h('div', { class: 'public-section-head' },
      h('div', null,
        h('span', { class: 'section-kicker' }, t('navTestimonials')),
        h('h2', null, s.testiTitle || t('landTestiTitle')),
        h('p', { class: 'muted' }, t('landTestiIntro'))
      )
    ),
    h('div', { class: 'testi-grid' },
      ...testimonials.map((tm) => h('figure', { class: 'panel testi-card' },
        h('blockquote', null, tm.content),
        h('figcaption', { class: 'testi-who' },
          tm.photoUrl ? h('img', { class: 'testi-photo', src: mediaUrl(tm.photoUrl), alt: '' }) : null,
          h('span', null, h('strong', null, tm.name), tm.roleText ? h('span', { class: 'muted' }, ` — ${tm.roleText}`) : null),
        ),
      ))
    )
  ) : null;

  const ctaBand = h('section', { class: 'public-cta' },
    h('div', { class: 'public-cta-inner' },
      h('h2', null, s.ctaTitle || t('landCtaTitle')),
      h('p', null, s.ctaText || t('landCtaText')),
      h('button', { class: 'btn btn-primary btn-large', type: 'button', onclick: () => scrollToId('contact') }, s.ctaButton || t('landHeroCtaContact')),
    )
  );

  // Carte publique : visible par tous, sans connexion. Iframe Google Maps sans clé API
  // + bouton d'itinéraire. Affichée seulement si une rue est renseignée.
  const mapQuery = addressQuery(s);
  const mapBlock = hasMapAddress(s) ? h('div', { class: 'map-wrap' },
    h('iframe', {
      title: t('adresseLabel'),
      src: `https://www.google.com/maps?q=${encodeURIComponent(mapQuery)}&output=embed`,
      loading: 'lazy',
    }),
    h('a', {
      class: 'btn btn-secondary', href: `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(mapQuery)}`,
      target: '_blank', rel: 'noopener',
    }, icon('pin', 'icon icon-sm'), ' ', t('mapDirections')),
  ) : null;

  const contactSection = h('section', { class: 'public-section public-contact', id: 'contact' },
    h('div', { class: 'public-section-head' },
      h('div', null,
        h('span', { class: 'section-kicker' }, t('navContact')),
        h('h2', null, t('contactTitle')),
        h('p', { class: 'muted' }, t('contactIntro'))
      )
    ),
    h('div', { class: 'contact-layout' },
      h('div', { class: 'panel contact-panel' },
        h('div', { class: 'contact-detail' }, h('strong', null, t('adresseLabel')), h('span', null, addressText)),
        h('div', { class: 'contact-detail' }, h('strong', null, t('telephoneLabel')), h('span', null, contactPhone)),
        h('div', { class: 'contact-detail' }, h('strong', null, t('courrielLabel')), h('span', null, contactEmail)),
        h('p', { class: 'muted' }, t('topbarHours')),
      ),
      h('div', { class: 'panel' }, contactForm(contactEmail)),
    ),
    mapBlock,
  );

  clear(root).append(
    h('div', { class: 'public-home' },
      chrome.topbar,
      chrome.header,
      chrome.drawer,
      chrome.scrim,
      show('showHero', hero),
      h('main', { class: 'public-main' },
        show('showAbout', aboutSection),
        show('showPracticeAreas', areasSection),
        pubSection,
        blogSection,
        show('showTestimonials', testiSection),
        ctaBand,
        show('showContact', contactSection)),
      chrome.footer
    )
  );

  // Fil des publications (utilisateurs connectés uniquement) : chargé après le rendu.
  if (showPubSection) renderPostFeed(pubFeed, loggedPerms, () => route(), { limit: 10 });
}

/** Page vitrine "L'application" : le marketing du logiciel, séparé du site du cabinet. */
async function renderWebAppPage(loggedUser = null) {
  document.title = `${t('svcWebApp')} — ${firmName()}`;
  const s = siteSettings ?? {};
  const contactEmail = s.contactEmail || t('courrielValue');
  const contactPhone = s.contactPhone || t('telephoneValue');
  const addressText = addressQuery(s) || t('adresseValue');
  shellBuilt = false;
  let areas = [];
  try { areas = await api.practiceAreas() ?? []; } catch { areas = []; }
  const chrome = publicChrome(loggedUser, s, areas, contactEmail, contactPhone, addressText);

  const hero = h('section', { class: 'public-hero', id: 'accueil' },
    h('div', { class: 'public-hero-content' },
      h('span', { class: 'public-kicker' }, firmName()),
      h('h1', null, t('webAppTitle')),
      h('p', null, t('webAppIntro')),
      h('div', { class: 'public-hero-actions' },
        h('button', { class: 'btn btn-primary btn-large', type: 'button', onclick: openRegistrationModal }, t('landDemo')),
        h('a', { class: 'btn btn-ghost btn-large', href: '#/' }, t('webAppBack')),
      ),
    )
  );

  const featuresSection = h('section', { class: 'public-section' },
    h('div', { class: 'public-section-head' },
      h('div', null,
        h('h2', null, t('landFeaturesTitle')),
        h('p', { class: 'muted' }, t('landFeaturesIntro'))
      )
    ),
    h('div', { class: 'feature-grid' },
      ...LANDING_FEATURES.map((f, i) => h('article', { class: 'panel feature-card' },
        h('div', { class: 'feature-top' }, h('span', { class: 'feature-icon' }, icon(f.icon)), h('span', { class: 'feature-num' }, String(i + 1).padStart(2, '0'))),
        h('h3', null, t(f.titleKey)),
        h('p', { class: 'muted' }, t(f.textKey)),
      )))
  );

  const stepsSection = h('section', { class: 'public-section' },
    h('div', { class: 'public-section-head' },
      h('div', null,
        h('h2', null, t('landHowTitle')),
        h('p', { class: 'muted' }, t('landHowIntro'))
      )
    ),
    h('ol', { class: 'steps-grid' },
      ...[1, 2, 3].map((n) => h('li', { class: 'panel step-card' },
        h('span', { class: 'step-num' }, String(n).padStart(2, '0')),
        h('h3', null, t(`landS${n}T`)),
        h('p', { class: 'muted' }, t(`landS${n}D`)),
      )))
  );

  const ctaBand = h('section', { class: 'public-cta' },
    h('div', { class: 'public-cta-inner' },
      h('h2', null, s.ctaTitle || t('landCtaTitle')),
      h('p', null, s.ctaText || t('landCtaText')),
      h('button', { class: 'btn btn-primary btn-large', type: 'button', onclick: openRegistrationModal }, s.ctaButton || t('landDemo')),
    )
  );

  clear(root).append(
    h('div', { class: 'public-home' },
      chrome.topbar,
      chrome.header,
      chrome.drawer,
      chrome.scrim,
      hero,
      h('main', { class: 'public-main' }, featuresSection, stepsSection, ctaBand),
      chrome.footer
    )
  );
}



function renderLogin() {
  document.title = t('authTitle');
  const email = h('input', { type: 'email', name: 'email', required: true, autocomplete: 'username' });
  const password = h('input', { type: 'password', name: 'password', required: true, autocomplete: 'current-password' });
  const errorBox = h('p', { class: 'form-error', hidden: true });
  const submitBtn = h('button', { class: 'btn btn-primary btn-block', type: 'submit' }, t('seConnecter'));
  const registerBtn = h('button', { class: 'btn btn-link btn-block', type: 'button', onclick: () => openRegistrationModal() }, t('demanderAcces'));
  const forgotBtn = h('button', { class: 'btn btn-link btn-block', type: 'button', onclick: () => openForgotPasswordModal() }, t('forgotPassword'));
  const googleWrap = h('div');

  function completeLogin(body) {
    setSession({ accessToken: body.accessToken, refreshToken: body.refreshToken, user: body.user });
    // Direction explicite vers le tableau de bord : rester sur #/home donnait
    // l'impression que la connexion n'avait rien fait, car c'est la même page
    // publique (juste avec un bouton « Mon espace » en plus, facile à manquer).
    location.hash = '#/dashboard';
    if (location.hash === '#/dashboard') route();
  }

  // Seconde étape : code 2FA (après mot de passe ou Google).
  function renderTwofaStep(tempToken) {
    const code = h('input', { type: 'text', inputmode: 'numeric', autocomplete: 'one-time-code', required: true, maxlength: 10, placeholder: '123456' });
    const err = h('p', { class: 'form-error', hidden: true });
    const btn = h('button', { class: 'btn btn-primary btn-block', type: 'submit' }, t('twofaVerify'));
    const form = h('form', {
      class: 'login-form',
      onsubmit: async (e) => {
        e.preventDefault();
        err.hidden = true;
        btn.disabled = true;
        try {
          const body = await api.twofaLogin(tempToken, code.value.trim());
          completeLogin(body);
        } catch (e2) {
          err.textContent = errorMessage(e2);
          err.hidden = false;
        } finally {
          btn.disabled = false;
        }
      },
    }, h('p', { class: 'auth-tagline' }, t('twofaLoginIntro')), field(t('twofaCode'), code), err, btn);
    clear(root).append(
      h('div', { class: 'auth-screen' },
        h('div', { class: 'auth-card' },
          h('div', { class: 'brand' }, h('span', { class: 'brand-mark' }, '⚖'), h('span', { class: 'brand-name' }, t('brand'))),
          h('p', { class: 'auth-tagline' }, t('twofaLoginTitle')),
          form,
        ),
      ),
    );
    code.focus();
  }

  const form = h(
    'form',
    {
      class: 'login-form',
      onsubmit: async (e) => {
        e.preventDefault();
        errorBox.hidden = true;
        submitBtn.disabled = true;
        submitBtn.textContent = t('authConnecting');
        try {
          const body = await api.login(email.value.trim(), password.value);
          if (body.twoFactorRequired) {
            renderTwofaStep(body.tempToken);
            return;
          }
          completeLogin(body);
        } catch (err) {
          errorBox.textContent = errorMessage(err);
          errorBox.hidden = false;
        } finally {
          submitBtn.disabled = false;
          submitBtn.textContent = t('seConnecter');
        }
      },
    },
    field(t('authEmail'), email),
    field(t('authPassword'), password),
    errorBox,
    submitBtn,
    forgotBtn,
    googleWrap,
    registerBtn,
  );

  clear(root).append(
    h(
      'div',
      { class: 'auth-screen' },
      h(
        'div',
        { class: 'auth-card' },
        h('div', { class: 'brand' }, h('span', { class: 'brand-mark' }, '⚖'), h('span', { class: 'brand-name' }, t('brand'))),
        h('p', { class: 'auth-tagline' }, t('authTagline')),
        form,
      ),
    ),
  );
  email.focus();

  // Bouton Google : affiché seulement si l'OAuth est configuré côté serveur.
  api.oauthGoogleStatus()
    .then((s) => {
      if (s?.enabled) {
        googleWrap.append(
          h('button', { class: 'btn btn-secondary btn-block', type: 'button', onclick: () => { location.href = '/api/auth/oauth/google'; } },
            h('span', { 'aria-hidden': 'true' }, 'G '), t('googleLogin')),
        );
      }
    })
    .catch(() => { /* OAuth indisponible : on n'affiche rien */ });

  // Retour du callback Google avec 2FA : on affiche directement l'étape du code.
  const q = hashQuery();
  if (q.twofa) {
    history.replaceState(null, '', '#/login');
    renderTwofaStep(q.twofa);
  }
}

/** Modale « mot de passe oublié » : demande l'email, réponse toujours générique. */
function openForgotPasswordModal() {
  const f = { email: h('input', { type: 'email', required: true, autocomplete: 'email' }) };
  const errorBox = h('p', { class: 'form-error', hidden: true });
  const okBox = h('p', { class: 'form-ok', hidden: true });
  const sendBtn = h('button', { class: 'btn btn-primary', type: 'submit' }, t('forgotSend'));
  const form = h('form', {
    class: 'stacked-form',
    onsubmit: async (e) => {
      e.preventDefault();
      errorBox.hidden = true;
      okBox.hidden = true;
      sendBtn.disabled = true;
      try {
        await api.forgotPassword(f.email.value.trim());
        okBox.textContent = t('forgotSent');
        okBox.hidden = false;
        f.email.value = '';
      } catch (err) {
        errorBox.textContent = errorMessage(err);
        errorBox.hidden = false;
      } finally {
        sendBtn.disabled = false;
      }
    },
  },
    h('p', { class: 'muted' }, t('forgotIntro')),
    field(t('authEmail'), f.email),
    errorBox,
    okBox,
    sendBtn,
  );
  openModal(t('forgotTitle'), form);
}

/** Page de réinitialisation (lien reçu par courriel : #/reset-password?token=…). */
function renderResetPassword(token) {
  document.title = t('resetTitle');
  const pwd = h('input', { type: 'password', required: true, minlength: 10, autocomplete: 'new-password', 'aria-describedby': 'pwd-reset-hint' });
  const errorBox = h('p', { class: 'form-error', hidden: true });
  const submitBtn = h('button', { class: 'btn btn-primary btn-block', type: 'submit' }, t('resetSubmit'));
  const body = token
    ? h('form', {
        class: 'login-form',
        onsubmit: async (e) => {
          e.preventDefault();
          errorBox.hidden = true;
          submitBtn.disabled = true;
          try {
            await api.resetPassword(token, pwd.value);
            toast(t('resetDone'));
            location.hash = '#/login';
          } catch (err) {
            errorBox.textContent = errorMessage(err);
            errorBox.hidden = false;
          } finally {
            submitBtn.disabled = false;
          }
        },
      },
        h('label', { class: 'field' }, h('span', null, t('resetNew')), pwd, h('small', { class: 'muted', id: 'pwd-reset-hint' }, t('pwdRule'))),
        errorBox,
        submitBtn)
    : h('p', { class: 'form-error' }, t('errGeneric'));
  clear(root).append(
    h('div', { class: 'auth-screen' },
      h('div', { class: 'auth-card' },
        h('div', { class: 'brand' }, h('span', { class: 'brand-mark' }, '⚖'), h('span', { class: 'brand-name' }, t('brand'))),
        h('p', { class: 'auth-tagline' }, t('resetTitle')),
        body,
      ),
    ),
  );
  pwd?.focus?.();
}

/** Retour du callback Google : échange le code contre une session. */
async function handleOauthCallback(code) {
  document.title = t('authTitle');
  clear(root).append(
    h('div', { class: 'auth-screen' },
      h('div', { class: 'auth-card' }, h('p', { class: 'auth-tagline' }, t('authConnecting')))),
  );
  history.replaceState(null, '', '#/login');
  if (!code) {
    location.hash = '#/login';
    return;
  }
  try {
    const body = await api.oauthGoogleComplete(code);
    setSession({ accessToken: body.accessToken, refreshToken: body.refreshToken, user: body.user });
    location.hash = '#/dashboard';
    if (location.hash === '#/dashboard') await route();
  } catch {
    location.hash = '#/login';
    await route();
    toast(t('errGeneric'), 'error');
  }
}

/* ------------------------------------------------------------------ */
/* Coquille applicative : barre latérale + barre supérieure            */
/* ------------------------------------------------------------------ */

const NAV = [
  { key: 'home', label: t('navHome'), icon: 'dashboard', perm: 'posts.read' },
  { key: 'blog', label: t('navBlog'), icon: 'file', perm: 'posts.create' },
  { key: 'ai', label: t('navAI'), icon: 'search', perm: 'ai.ask', hideFor: ['CLIENT'] },
  { key: 'messages', label: t('navMessages'), icon: 'messages', perm: 'messages.read' },
  { key: 'contact-messages', label: t('navContactMessages'), icon: 'bell', perm: 'contact.read' },
  { key: 'dashboard', label: t('navDashboard'), icon: 'dashboard', perm: 'dashboard.read' },
  { key: 'clients', label: t('navClients'), icon: 'clients', perm: 'clients.read' },
  { key: 'cases', label: t('navCases'), icon: 'cases', perm: 'cases.read', clientLabel: t('navMyCases') },
  { key: 'kanban', label: t('navKanban'), icon: 'kanban', perm: 'cases.read' },
  { key: 'calendar', label: t('navCalendar'), icon: 'calendar', perm: 'cases.read' },
  { key: 'time', label: t('navTime'), icon: 'clock', perm: 'time.read' },
  { key: 'templates', label: t('navTemplates'), icon: 'file', perm: 'templates.read' },
  { key: 'invoices', label: t('navInvoices'), icon: 'billing', perm: 'billing.read', clientLabel: t('navMyInvoices') },
  { key: 'users', label: t('navUsers'), icon: 'users', perm: 'users.read' },
  { key: 'audit', label: t('navAudit'), icon: 'audit', perm: 'audit.read' },
  { key: 'customize', label: t('navCustomize'), icon: 'sliders', perm: 'users.update' },
];

function highlightNav(name) {
  for (const a of document.querySelectorAll('.nav a')) {
    a.classList.toggle('is-active', a.dataset.key === name);
    if (a.dataset.key === name) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  }
}

let shellBuilt = false;

/** Met à jour le logo/nom du cabinet dans la barre latérale après une personnalisation. */
function refreshShellBrand() {
  const brand = document.querySelector('.sidebar .brand');
  if (brand) clear(brand).append(firmMark(true), h('span', { class: 'brand-name' }, firmName()));
  document.title = firmName();
}

function renderShell(perms) {
  document.title = firmName();
  if (shellBuilt) {
    $('#user-name').textContent = `${currentUser.firstName} ${currentUser.lastName}`;
    $('#user-role').textContent = ROLE_LABEL()[currentUser.role] ?? currentUser.role;
    refreshUnreadBadge();
    return;
  }
  shellBuilt = true;

  const navList = h(
    'nav',
    { class: 'nav' },
    NAV.filter((n) => perms.has(n.perm) && !(n.hideFor ?? []).includes(currentUser.role)).map((n) =>
      h(
        'a',
        { href: `#/${n.key}`, 'data-key': n.key, onclick: () => setTimeout(() => highlightNav(n.key), 0) },
        icon(n.icon),
        h('span', null, currentUser.role === 'CLIENT' && n.clientLabel ? n.clientLabel : n.label),
        n.key === 'messages' ? h('span', { class: 'nav-badge', id: 'nav-msg-badge', hidden: true }) : null,
      ),
    ),
  );

  const searchInput = h('input', { type: 'search', placeholder: t('searchPlaceholder') });
  const searchResults = h('div', { class: 'search-results', hidden: true });
  let searchDebounce;
  searchInput.addEventListener('input', () => {
    clearTimeout(searchDebounce);
    const q = searchInput.value.trim();
    if (!q) return void (searchResults.hidden = true);
    searchDebounce = setTimeout(async () => {
      const res = await guarded(() => api.search(q));
      if (!res) return;
      renderSearchResults(searchResults, res);
    }, 250);
  });
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.search-box')) searchResults.hidden = true;
  });

  const notifBell = h('button', { class: 'icon-btn notif-btn', type: 'button', 'aria-label': t('notifTitle'), onclick: toggleNotifPanel }, icon('bell'), h('span', { class: 'notif-badge', id: 'notif-badge', hidden: true }));
  const notifPanel = h('div', { class: 'notif-panel', id: 'notif-panel', hidden: true });

  const themeBtn = h('button', { class: 'icon-btn', type: 'button', 'aria-label': t('changerTheme'), onclick: toggleTheme }, icon(document.documentElement.dataset.theme === 'dark' ? 'sun' : 'moon'));

  clear(root).append(
    h(
      'div',
      { class: 'shell' },
      h(
        'aside',
        { class: 'sidebar' },
        h('div', { class: 'brand' }, firmMark(true), h('span', { class: 'brand-name' }, firmName())),
        navList,
        h(
          'div',
          { class: 'sidebar-user' },
          h('button', { class: 'avatar-btn', type: 'button', 'aria-label': t('profileTitle'), title: t('profileTitle'), onclick: openProfileModal }, userAvatar(currentUser)),
          h('div', { class: 'sidebar-user-info' }, h('strong', { id: 'user-name' }, `${currentUser.firstName} ${currentUser.lastName}`), h('span', { id: 'user-role' }, ROLE_LABEL()[currentUser.role] ?? currentUser.role)),
          h('button', { class: 'icon-btn', type: 'button', 'aria-label': t('pwdChange'), title: t('pwdChange'), onclick: openChangePasswordModal }, icon('lock')),
          h('button', { class: 'icon-btn', type: 'button', 'aria-label': t('twofaTitle'), title: t('twofaTitle'), onclick: openTwoFactorModal }, icon('shield')),
          h('button', { class: 'icon-btn', type: 'button', 'aria-label': t('seDeconnecter'), onclick: logout }, icon('logout')),
        ),
        h('div', { class: 'sidebar-credit' }, ...bb24Credit()),
      ),
      h(
        'div',
        { class: 'content-col' },
        h(
          'header',
          { class: 'topbar' },
          h('div', { class: 'search-box' }, icon('search'), searchInput, searchResults),
          h('div', { class: 'topbar-actions' }, themeBtn, h('div', { class: 'notif-wrap' }, notifBell, notifPanel)),
        ),
        h('main', { id: 'main', tabindex: '-1' }),
      ),
    ),
  );

  refreshUnreadBadge();
}

function renderSearchResults(container, res) {
  clear(container).hidden = false;
  const groups = [
    ['clients', 'Clients', (r) => `#/clients/${r.id}`],
    ['cases', 'Dossiers', (r) => `#/cases/${r.id}`],
    ['documents', 'Documents', (r) => `#/cases/${r.caseId}`],
  ];
  let any = false;
  for (const [key, label, hrefFn] of groups) {
    const items = res[key] ?? [];
    if (!items.length) continue;
    any = true;
    container.append(
      h('div', { class: 'search-group-label' }, label),
      ...items.map((it) => h('a', { class: 'search-item', href: hrefFn(it), onclick: () => (container.hidden = true) }, h('strong', null, it.label), h('span', null, it.meta ?? ''))),
    );
  }
  if (!any) container.append(h('p', { class: 'search-empty' }, t('searchNoResults')));
}

function toggleTheme() {
  const html = document.documentElement;
  const next = html.dataset.theme === 'dark' ? 'light' : 'dark';
  html.dataset.theme = next;
  try {
    localStorage.setItem('cej:theme', next);
  } catch {}
  if (currentUser) {
    shellBuilt = false;
    renderShell(new Set(currentUser.permissions));
  }
  route();
}

async function refreshUnreadBadge() {
  const res = await guarded(() => api.unreadCount(), { onError: () => {} });
  const badge = document.getElementById('notif-badge');
  if (!badge) return;
  if (res?.count) {
    badge.textContent = res.count > 9 ? '9+' : String(res.count);
    badge.hidden = false;
  } else {
    badge.hidden = true;
  }
}

async function toggleNotifPanel() {
  const panel = document.getElementById('notif-panel');
  panel.hidden = !panel.hidden;
  if (panel.hidden) return;
  clear(panel).append(h('p', { class: 'loading' }, t('loading')));
  const items = await guarded(() => api.notifications());
  clear(panel);
  if (!items?.length) {
    panel.append(h('p', { class: 'notif-empty' }, t('notifEmpty')));
    return;
  }
  panel.append(
    h(
      'div',
      { class: 'notif-header' },
      h('span', null, t('notifTitle')),
      h('button', { class: 'link-btn', type: 'button', onclick: async () => { await guarded(() => api.markAllRead()); toggleNotifPanel(); toggleNotifPanel(); refreshUnreadBadge(); } }, t('notifMarkAll')),
    ),
    ...items.map((n) =>
      h(
        'a',
        {
          class: `notif-item${n.isRead ? '' : ' unread'}`,
          href: n.caseId ? `#/cases/${n.caseId}` : '#/dashboard',
          onclick: async () => { if (!n.isRead) { await guarded(() => api.markNotificationRead(n.id)); refreshUnreadBadge(); } panel.hidden = true; },
        },
        h('span', { class: 'notif-title' }, n.title),
        h('span', { class: 'notif-date' }, fmtDateTime(n.createdAt)),
      ),
    ),
  );
}

function logout() {
  setSession(null);
  shellBuilt = false;
  currentUser = null;
  syncChatWidget();
  location.hash = '';
  renderPublicHome();
}

/** L'utilisateur connecté change son propre mot de passe (politique renforcée). */
function openChangePasswordModal() {  const f = {
    current: h('input', { type: 'password', required: true, autocomplete: 'current-password' }),
    next: h('input', { type: 'password', required: true, minlength: 10, autocomplete: 'new-password', 'aria-describedby': 'pwd-change-hint' }),
  };
  const errorBox = h('p', { class: 'form-error', hidden: true });
  const form = h('form', {
    class: 'stacked-form', onsubmit: async (e) => {
      e.preventDefault();
      errorBox.hidden = true;
      try {
        await api.changePassword(f.current.value, f.next.value);
        close();
        toast(t('pwdChanged'));
      } catch (err) {
        errorBox.textContent = errorMessage(err);
        errorBox.hidden = false;
      }
    },
  },
    field(t('pwdCurrent'), f.current),
    h('label', { class: 'field' }, h('span', null, t('pwdNew')), f.next, h('small', { class: 'muted', id: 'pwd-change-hint' }, t('pwdRule'))),
    errorBox,
    h('button', { class: 'btn btn-primary', type: 'submit' }, t('pwdChange')),
  );
  const close = openModal(t('pwdChange'), form);
}

/** Modale « Sécurité » : activation / désactivation de l'authentification à deux facteurs (TOTP). */
async function openTwoFactorModal() {
  const wrap = h('div', { class: 'stacked-form' }, h('p', { class: 'loading' }, t('loading')));
  const close = openModal(t('twofaTitle'), wrap);
  const errBox = h('p', { class: 'form-error', hidden: true });

  function showError(err) {
    errBox.textContent = errorMessage(err);
    errBox.hidden = false;
  }

  async function render() {
    clear(wrap);
    wrap.append(errBox);
    errBox.hidden = true;
    let status;
    try {
      status = await api.twofaStatus();
    } catch (err) {
      showError(err);
      return;
    }
    wrap.append(h('p', { class: 'muted' }, t('twofaIntro')));
    if (status?.enabled) {
      wrap.append(
        h('p', { class: 'form-ok' }, t('twofaStatusOn')),
        h('button', { class: 'btn btn-secondary', type: 'button', onclick: () => renderDisable() }, t('twofaDisable')),
      );
      return;
    }
    wrap.append(
      h('p', { class: 'muted' }, t('twofaStatusOff')),
      h('button', { class: 'btn btn-primary', type: 'button', onclick: async () => {
        try {
          const setup = await api.twofaSetup();
          renderVerify(setup);
        } catch (err) { showError(err); }
      } }, t('twofaSetup')),
    );
  }

  function renderVerify(setup) {
    const code = h('input', { type: 'text', inputmode: 'numeric', autocomplete: 'one-time-code', required: true, maxlength: 10, placeholder: '123456' });
    const btn = h('button', { class: 'btn btn-primary', type: 'submit' }, t('twofaVerify'));
    const form = h('form', {
      class: 'stacked-form',
      onsubmit: async (e) => {
        e.preventDefault();
        errBox.hidden = true;
        btn.disabled = true;
        try {
          await api.twofaVerify(code.value.trim());
          toast(t('twofaEnabled'));
          render();
        } catch (err) {
          showError(err);
        } finally {
          btn.disabled = false;
        }
      },
    },
      h('p', { class: 'muted' }, t('twofaScan')),
      h('div', { style: 'text-align:center' }, h('img', { src: setup.qrDataUrl, alt: 'QR code', style: 'max-width:220px' })),
      h('p', { class: 'muted' }, t('twofaManual'), ' ', h('code', null, setup.secret)),
      field(t('twofaCode'), code),
      btn,
    );
    clear(wrap);
    wrap.append(errBox, form);
    code.focus();
  }

  function renderDisable() {
    const pwd = h('input', { type: 'password', required: true, autocomplete: 'current-password' });
    const btn = h('button', { class: 'btn btn-secondary', type: 'submit' }, t('twofaDisable'));
    const form = h('form', {
      class: 'stacked-form',
      onsubmit: async (e) => {
        e.preventDefault();
        errBox.hidden = true;
        btn.disabled = true;
        try {
          await api.twofaDisable(pwd.value);
          toast(t('twofaDisabled'));
          render();
        } catch (err) {
          showError(err);
        } finally {
          btn.disabled = false;
        }
      },
    },
      h('p', { class: 'muted' }, t('twofaDisableConfirm')),
      field(t('authPassword'), pwd),
      btn,
    );
    clear(wrap);
    wrap.append(errBox, form);
    pwd.focus();
  }

  await render();
}

/** Modale profil : photo de profil (aperçu instantané, changer / retirer). */
function openProfileModal() {
  const preview = h('div', { class: 'profile-avatar-wrap' });
  const fileInput = h('input', { type: 'file', accept: 'image/png,image/jpeg,image/gif,image/webp', hidden: true });
  const errorBox = h('p', { class: 'form-error', hidden: true });

  const renderPreview = (src) => {
    clear(preview).append(
      src
        ? h('img', { class: 'avatar profile-avatar-big avatar-img', src, alt: '' })
        : h('span', { class: 'avatar profile-avatar-big', 'aria-hidden': 'true' }, initialsOf(currentUser.firstName, currentUser.lastName)),
      h('div', { class: 'profile-avatar-actions' },
        h('button', { class: 'btn btn-small', type: 'button', onclick: () => fileInput.click() }, t('avatarChange')),
        currentUser.avatarUrl ? h('button', { class: 'btn btn-small btn-ghost danger', type: 'button', onclick: removeAvatar }, t('avatarRemove')) : null,
      ),
    );
  };

  async function removeAvatar() {
    errorBox.hidden = true;
    try {
      const r = await api.removeAvatar();
      currentUser.avatarUrl = r.avatarUrl;
      try { const s = getSession(); setSession({ ...s, user: currentUser }); } catch {}
      renderPreview(null);
      toast(t('avatarRemoved'));
      refreshSidebarAvatar();
    } catch (err) { errorBox.textContent = errorMessage(err); errorBox.hidden = false; }
  }

  fileInput.onchange = async () => {
    const file = fileInput.files?.[0];
    if (!file) return;
    // Aperçu instantané avant l'envoi.
    const previewUrl = URL.createObjectURL(file);
    renderPreview(previewUrl);
    errorBox.hidden = true;
    try {
      const r = await api.uploadAvatar(file);
      currentUser.avatarUrl = r.avatarUrl;
      try { const s = getSession(); setSession({ ...s, user: currentUser }); } catch {}
      URL.revokeObjectURL(previewUrl);
      renderPreview(mediaUrl(r.avatarUrl));
      toast(t('avatarUpdated'));
      refreshSidebarAvatar();
    } catch (err) {
      URL.revokeObjectURL(previewUrl);
      renderPreview(currentUser.avatarUrl ? mediaUrl(currentUser.avatarUrl) : null);
      errorBox.textContent = errorMessage(err); errorBox.hidden = false;
    }
    fileInput.value = '';
  };

  renderPreview(currentUser.avatarUrl ? mediaUrl(currentUser.avatarUrl) : null);
  const body = h('div', null,
    h('p', null, h('strong', null, `${currentUser.firstName} ${currentUser.lastName}`), h('br'), h('span', { class: 'muted' }, `${currentUser.email} · ${ROLE_LABEL()[currentUser.role] ?? currentUser.role}`)),
    preview,
    fileInput,
    errorBox,
    h('button', { class: 'btn btn-primary', type: 'button', onclick: () => { close(); openChangePasswordModal(); } }, t('pwdChange')),
  );
  const close = openModal(t('profileTitle'), body);
}

/** Met à jour l'avatar affiché dans la barre latérale après un changement. */
function refreshSidebarAvatar() {
  const btn = document.querySelector('.sidebar-user .avatar-btn');
  if (btn) { clear(btn).append(userAvatar(currentUser)); }
}

/* ------------------------------------------------------------------ */
/* Accueil social / AI / Messagerie                                    */

function openRegistrationModal() {
  const f={firstName:h('input',{required:true}),lastName:h('input',{required:true}),email:h('input',{type:'email',required:true}),message:h('textarea',{rows:4,placeholder: t('regMessagePh')})};
  const form=h('form',{class:'stacked-form',onsubmit:async e=>{e.preventDefault();try{await api.registerRequest({firstName:f.firstName.value.trim(),lastName:f.lastName.value.trim(),email:f.email.value.trim(),message:f.message.value.trim()});close();toast(t('regRequestSent'));}catch(err){toast(errorMessage(err),'error');}}},field(t('formFirstName'),f.firstName),field(t('formLastName'),f.lastName),field(t('formEmail'),f.email),field(t('formMessage'),f.message),h('button',{class:'btn btn-primary',type:'submit'},t('regSubmit')));
  const close=openModal(t('demanderAcces'),form);
}

/** Remplit un conteneur avec le fil des publications (cartes postCard).
 *  query : filtres optionnels transmis à l'API (ex. { limit: 10 }, { author_id: 3 }). */
async function renderPostFeed(feed, perms, onRetry, query) {
  feed.append(h('section', { class: 'panel' }, h('p', { class: 'loading' }, t('chargementPublications'))));
  try {
    const posts = await api.posts(query ?? {});
    clear(feed);
    if (!posts?.length) {
      feed.append(h('section', { class: 'panel' },
        h('p', { class: 'empty-state' }, perms.has('posts.create')
          ? t('socialEmptyCreate')
          : t('aucunePublication'))
      ));
      return;
    }
    feed.append(...posts.map(postCard));
  } catch (err) {
    clear(feed).append(
      h('section', { class: 'panel' },
        h('p', { class: 'form-error' }, errorMessage(err)),
        h('button', { class: 'btn', type: 'button', onclick: onRetry }, t('retry'))
      )
    );
  }
}
/** Après une publication : ré-afficher la page courante (le nouveau post est visible). */
function refreshPublications() {
  route();
}
function openPostModal(existing=null, refresh=refreshPublications){
  const f={title:h('input',{required:true,value:existing?.title||'',placeholder: t('postTitlePh')}),content:h('textarea',{required:true,rows:9,placeholder: t('postContentPh')},existing?.content||''),type:h('select',null,h('option',{value:'POST',selected:(existing?.type||'POST')==='POST'},t('postTypePost')),h('option',{value:'ARTICLE',selected:existing?.type==='ARTICLE'},t('postTypeArticle')))};
  const existingImages = [...(existing?.images ?? (existing?.imageUrl ? [{ id: 0, url: existing.imageUrl }] : []))];
  let newFiles = [];
  const removedIds = new Set();
  const thumbs = h('div', { class: 'post-thumbs' });
  const thumbEl = (src, onRemove, onCrop) => {
    const el = h('div', { class: 'post-thumb' }, h('img', { src, alt: '' }),
      h('button', { class: 'post-thumb-x', type: 'button', 'aria-label': t('postRemoveImage'), onclick: onRemove }, '×'));
    if (onCrop) el.append(h('button', { class: 'post-thumb-crop', type: 'button', title: t('postAdjustImage'), 'aria-label': t('postAdjustImage'), onclick: onCrop }, t('postAdjustImage')));
    return el;
  };
  const renderThumbs = () => {
    clear(thumbs);
    for (const img of existingImages) {
      if (removedIds.has(img.id)) continue;
      thumbs.append(thumbEl(mediaUrl(img.url), () => { removedIds.add(img.id); renderThumbs(); }));
    }
    newFiles.forEach((file) => {
      const url = URL.createObjectURL(file);
      const onRemove = () => { URL.revokeObjectURL(url); newFiles = newFiles.filter((f) => f !== file); renderThumbs(); };
      const onCrop = () => openCropModal(file, (cropped) => {
        const idx = newFiles.indexOf(file);
        if (idx !== -1) newFiles[idx] = cropped;
        URL.revokeObjectURL(url);
        renderThumbs();
      });
      thumbs.append(thumbEl(url, onRemove, onCrop));
    });
    thumbs.hidden = !thumbs.children.length;
    countHint.textContent = t('postImagesCount', { n: existingImages.filter((im) => !removedIds.has(im.id)).length + newFiles.length });
  };
  const countHint = h('p', { class: 'muted post-images-count' });
  const imageInput = h('input', { type: 'file', accept: 'image/png,image/jpeg,image/gif,image/webp', multiple: true, onchange: () => {
    const remaining = 10 - (existingImages.filter((im) => !removedIds.has(im.id)).length + newFiles.length);
    const picked = [...imageInput.files].slice(0, Math.max(0, remaining));
    if (imageInput.files.length > picked.length) toast(t('postImagesMax'), 'error');
    newFiles = newFiles.concat(picked);
    imageInput.value = '';
    renderThumbs();
  }});
  renderThumbs();
  const form=h('form',{class:'stacked-form',onsubmit:async e=>{e.preventDefault();try{
    const body={title:f.title.value.trim(),content:f.content.value.trim(),type:f.type.value};
    if(existing) await api.updatePost(existing.id, body, newFiles, [...removedIds]);
    else await api.createPost(body, newFiles);
    close();toast(existing ? t('postUpdated') : t('postPublished'));refresh($('#main'));
  }catch(err){toast(errorMessage(err),'error');}}},
    field(t('postTitle'),f.title),field(t('postType'),f.type),field(t('postContent'),f.content),
    field(t('postImages'),imageInput),countHint,thumbs,
    h('button',{class:'btn btn-primary',type:'submit'},existing ? t('save') : t('postPublish')));
  const close=openModal(existing ? t('postEdit') : t('postNew'),form,{wide:true});
}
/* ------------------------------------------------------------------ */
/* Ajustement d'image (crop 16:9) pour le composer de publications     */
/* ------------------------------------------------------------------ */

/**
 * Calcule le rectangle de crop en pixels source.
 * o = { fw, fh } taille du cadre (px CSS) ; { dw, dh } taille affichée de
 * l'image (px CSS) ; { ix, iy } coin haut-gauche de l'image relativement au
 * cadre ; { srcW, srcH } taille naturelle de l'image.
 * Le ratio est préservé (l'image couvre toujours le cadre).
 * Pure — testée dans backend/test/crop-math.test.js.
 */
/* --- Minuteurs de suivi du temps (helpers purs, couverts par les tests) --- */

/** Convertit une durée démarrée à `startedAt` (ms) en heures, arrondi à 2 décimales. */
function timerHours(startedAt, nowMs) {
  const secs = Math.max(0, Math.floor((nowMs - startedAt) / 1000));
  return Math.round(secs / 36) / 100;
}

/** Formate un nombre de secondes en HH:MM:SS. */
function fmtElapsed(totalSecs) {
  const s = Math.max(0, Math.floor(totalSecs));
  const hh = String(Math.floor(s / 3600)).padStart(2, '0');
  const mm = String(Math.floor((s % 3600) / 60)).padStart(2, '0');
  const ss = String(s % 60).padStart(2, '0');
  return `${hh}:${mm}:${ss}`;
}

/* Registre persistant des minuteurs en cours. `storage` est injecté
 * (localStorage en prod, objet factice dans les tests) pour rester pur.
 * Chaque dossier a sa propre entrée : démarrer/arrêter un minuteur ne
 * touche JAMAIS l'entrée d'un autre dossier. */
function timerStore(storage) {
  const KEY = 'cej:timers';
  return {
    read() {
      try { return JSON.parse(storage.getItem(KEY)) ?? []; } catch { return []; }
    },
    /** Démarre (ou remplace) l'entrée du dossier — les autres sont inchangées. */
    add(caseId, startedAt) {
      const list = this.read().filter((s) => String(s.caseId) !== String(caseId));
      list.push({ caseId: Number(caseId), startedAt });
      try { storage.setItem(KEY, JSON.stringify(list)); } catch {}
      return list;
    },
    /** Retire uniquement l'entrée du dossier — les autres sont inchangées. */
    remove(caseId) {
      const list = this.read().filter((s) => String(s.caseId) !== String(caseId));
      try { storage.setItem(KEY, JSON.stringify(list)); } catch {}
      return list;
    },
  };
}

function cropRect(o) {
  const k = o.srcW / o.dw;
  const sx = Math.max(0, -o.ix * k);
  const sy = Math.max(0, -o.iy * k);
  const cw = Math.min(o.srcW - sx, o.fw * k);
  const ch = Math.min(o.srcH - sy, o.fh * k);
  return { sx, sy, cw, ch };
}

/**
 * Modale de crop 16:9 (ratio d'affichage du fil) pour un File image.
 * Glisser-déposer (souris + tactile), zoom curseur/molette, aperçu en direct.
 * onDone(File) reçoit le fichier recadré (JPEG) qui remplace l'original.
 */
function openCropModal(file, onDone) {
  const frame = h('div', { class: 'crop-frame' });
  const img = h('img', { draggable: 'false', alt: '' });
  frame.append(img);
  const zoom = h('input', { type: 'range', min: '1', max: '4', step: '0.01', value: '1', 'aria-label': t('cropZoom') });
  const applyBtn = h('button', { class: 'btn btn-primary', type: 'button' }, t('cropApply'));
  const cancelBtn = h('button', { class: 'btn', type: 'button' }, t('cropCancel'));
  const body = h('div', null,
    frame,
    h('div', { class: 'crop-controls' }, h('span', { class: 'muted' }, t('cropZoom')), zoom),
    h('p', { class: 'muted' }, t('cropHint')),
    h('div', { class: 'btn-row', style: 'justify-content:flex-end;margin-top:0.5rem' }, cancelBtn, applyBtn),
  );
  const closeCrop = openModal(t('cropTitle'), body, { wide: true });
  // Échap ne doit pas fermer aussi la modale de publication sous-jacente.
  const onKeyCap = (e) => {
    if (!frame.isConnected) { document.removeEventListener('keydown', onKeyCap, true); return; }
    if (e.key === 'Escape') { e.stopPropagation(); closeCrop(); }
  };
  document.addEventListener('keydown', onKeyCap, true);

  let nw = 0, nh = 0, fw = 0, fh = 0, baseW = 0, baseH = 0;
  let scale = 1, x = 0, y = 0, drag = null;

  const render = () => {
    const dw = baseW * scale, dh = baseH * scale;
    img.style.width = dw + 'px';
    img.style.height = dh + 'px';
    img.style.left = (fw / 2 + x - dw / 2) + 'px';
    img.style.top = (fh / 2 + y - dh / 2) + 'px';
    if (document.activeElement !== zoom) zoom.value = String(scale);
  };
  const clampCrop = () => {
    const dw = baseW * scale, dh = baseH * scale;
    const mx = Math.max(0, (dw - fw) / 2), my = Math.max(0, (dh - fh) / 2);
    x = Math.min(mx, Math.max(-mx, x));
    y = Math.min(my, Math.max(-my, y));
  };
  const setScale = (s) => { scale = Math.min(4, Math.max(1, s)); clampCrop(); render(); };

  zoom.oninput = () => setScale(Number(zoom.value));
  frame.onwheel = (e) => { e.preventDefault(); setScale(scale * (e.deltaY < 0 ? 1.12 : 1 / 1.12)); };
  img.onpointerdown = (e) => {
    img.setPointerCapture(e.pointerId);
    drag = { sx: e.clientX - x, sy: e.clientY - y };
    frame.style.cursor = 'grabbing';
  };
  img.onpointermove = (e) => {
    if (!drag) return;
    x = e.clientX - drag.sx; y = e.clientY - drag.sy;
    clampCrop(); render();
  };
  const endDrag = () => { drag = null; frame.style.cursor = 'grab'; };
  img.onpointerup = endDrag;
  img.onpointercancel = endDrag;
  cancelBtn.onclick = () => closeCrop();

  const objUrl = URL.createObjectURL(file);
  img.onload = () => {
    nw = img.naturalWidth; nh = img.naturalHeight;
    fw = frame.clientWidth; fh = frame.clientHeight;
    if (!nw || !nh || !fw || !fh) { toast(t('cropError'), 'error'); closeCrop(); return; }
    const cover = Math.max(fw / nw, fh / nh);
    baseW = nw * cover; baseH = nh * cover;
    render();
  };
  img.onerror = () => { toast(t('cropError'), 'error'); closeCrop(); };
  img.src = objUrl;

  applyBtn.onclick = () => {
    applyBtn.disabled = true;
    try {
      const dw = baseW * scale, dh = baseH * scale;
      const r = cropRect({ fw, fh, dw, dh, ix: fw / 2 + x - dw / 2, iy: fh / 2 + y - dh / 2, srcW: nw, srcH: nh });
      const outW = Math.min(1600, Math.max(1, Math.round(r.cw)));
      const outH = Math.max(1, Math.round(outW * 9 / 16));
      const canvas = document.createElement('canvas');
      canvas.width = outW; canvas.height = outH;
      canvas.getContext('2d').drawImage(img, r.sx, r.sy, r.cw, r.ch, 0, 0, outW, outH);
      canvas.toBlob((blob) => {
        if (!blob) { toast(t('cropError'), 'error'); applyBtn.disabled = false; return; }
        const name = (file.name || 'image').replace(/\.[a-z0-9]+$/i, '') + '-crop.jpg';
        onDone(new File([blob], name, { type: 'image/jpeg' }));
        URL.revokeObjectURL(objUrl);
        closeCrop();
      }, 'image/jpeg', 0.92);
    } catch (err) {
      toast(t('cropError'), 'error');
      applyBtn.disabled = false;
    }
  };
}
/* ------------------------------------------------------------------ */
/* Publication style Instagram (thème navy/gold)                       */
/* ------------------------------------------------------------------ */

const SAVED_POSTS_KEY = 'cej:saved-posts';
function savedPostIds() {
  try { return new Set(JSON.parse(localStorage.getItem(SAVED_POSTS_KEY) || '[]')); } catch { return new Set(); }
}
function toggleSavedPost(id) {
  const s = savedPostIds();
  if (s.has(id)) s.delete(id); else s.add(id);
  try { localStorage.setItem(SAVED_POSTS_KEY, JSON.stringify([...s])); } catch {}
  return s.has(id);
}
function initialsOf(first, last) {
  return `${(first || '').trim()[0] || ''}${(last || '').trim()[0] || ''}`.toUpperCase() || '?';
}

/** Avatar d'un utilisateur : sa photo si définie, sinon le cercle d'initiales. */
function userAvatar(user, cls = 'avatar') {
  const fallback = h('span', { class: cls, 'aria-hidden': 'true' }, initialsOf(user?.firstName, user?.lastName));
  if (user?.avatarUrl) {
    const img = h('img', { class: `${cls} avatar-img`, src: mediaUrl(user.avatarUrl), alt: '' });
    img.onerror = () => img.replaceWith(fallback);
    return img;
  }
  return fallback;
}
/** Temps relatif court ("5 min", "2 h") avec repli sur la date complète. */
function timeAgo(iso) {
  const ms = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(ms) || ms < 0) return fmtDate(iso);
  const s = Math.floor(ms / 1000);
  if (s < 60) return t('timeNow');
  const m = Math.floor(s / 60);
  if (m < 60) return t('timeMin', { n: m });
  const hh = Math.floor(m / 60);
  if (hh < 24) return t('timeHour', { n: hh });
  const d = Math.floor(hh / 24);
  if (d < 7) return t('timeDay', { n: d });
  return fmtDate(iso);
}
function postImagesOf(p) {
  return p.images?.length ? p.images : (p.imageUrl ? [{ id: 0, url: p.imageUrl }] : []);
}

/** Carrousel photo (défilement horizontal + points + compteur). */
function igCarousel(images) {
  const track = h('div', { class: 'ig-track' });
  for (const img of images) track.append(h('img', { class: 'ig-photo', src: mediaUrl(img.url), alt: '', loading: 'lazy' }));
  const dots = h('div', { class: 'ig-dots' });
  for (let i = 0; i < images.length; i++) dots.append(h('span', { class: `ig-dot${i === 0 ? ' on' : ''}` }));
  const counter = h('span', { class: 'ig-counter', hidden: images.length < 2 }, `1/${images.length}`);
  let ticking = false;
  const sync = () => {
    ticking = false;
    const w = track.clientWidth || 1;
    const i = Math.min(images.length - 1, Math.max(0, Math.round(track.scrollLeft / w)));
    [...dots.children].forEach((d, j) => d.classList.toggle('on', j === i));
    counter.textContent = `${i + 1}/${images.length}`;
  };
  track.addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(sync); } }, { passive: true });
  const go = (dir) => track.scrollBy({ left: dir * (track.clientWidth || 300), behavior: 'smooth' });
  const prev = h('button', { class: 'ig-nav ig-prev', type: 'button', 'aria-label': t('postPrevPhoto'), hidden: images.length < 2, onclick: () => go(-1) }, icon('chevronLeft'));
  const next = h('button', { class: 'ig-nav ig-next', type: 'button', 'aria-label': t('postNextPhoto'), hidden: images.length < 2, onclick: () => go(1) }, icon('chevronRight'));
  return h('div', { class: 'ig-media' }, track, prev, next, dots, counter);
}

function postCard(p){
  const images = postImagesOf(p);
  const authorName = `${p.author.firstName} ${p.author.lastName}`;
  const typeLabel = p.type === 'ARTICLE' ? t('postTypeArticle') : t('postTypePost');

  // En-tête : avatar (initiales, anneau gold), nom + rôle · heure, menu ••• (propriétaire).
  let menuBtn = null;
  if (p.canEdit || p.canDelete) {
    const menu = h('div', { class: 'ig-menu', hidden: true });
    if (p.canEdit) menu.append(h('button', { type: 'button', onclick: () => { menu.hidden = true; openPostModal(p, () => route()); } }, t('edit')));
    if (p.canDelete) menu.append(h('button', { class: 'danger', type: 'button', onclick: async () => { menu.hidden = true; if (confirm(t('postDeleteConfirm'))) { await api.deletePost(p.id); route(); } } }, t('delete')));
    const btn = h('button', { class: 'ig-icon-btn', type: 'button', 'aria-label': t('postOptions'), 'aria-haspopup': 'true' }, icon('dots'));
    btn.onclick = (e) => {
      e.stopPropagation();
      const willOpen = menu.hidden;
      menu.hidden = !willOpen;
      if (willOpen) setTimeout(() => document.addEventListener('click', () => { menu.hidden = true; }, { once: true }), 0);
    };
    menuBtn = h('div', { class: 'ig-menu-wrap' }, btn, menu);
  }
  // Nom et avatar de l'auteur : cliquables vers le profil public de l'auteur.
  const goProfile = () => { location.hash = `#/profile/${p.author.id}`; };
  const head = h('div', { class: 'ig-head' },
    h('button', { class: 'ig-profile-link', type: 'button', 'aria-label': authorName, onclick: goProfile }, userAvatar(p.author, 'ig-avatar')),
    h('div', { class: 'ig-who' },
      h('button', { class: 'ig-name-link', type: 'button', onclick: goProfile }, h('strong', null, authorName)),
      h('div', { class: 'muted ig-sub' }, `${ROLE_LABEL()[p.author.role] ?? p.author.role} · ${timeAgo(p.createdAt)} · ${typeLabel}`)),
    menuBtn);

  // Barre d'actions : like, commenter, envoyer | sauvegarder.
  const likeCount = h('p', { class: 'ig-likes' }, t('postLikes', { n: p.likes }));
  const likeBtn = h('button', { class: `ig-icon-btn${p.likedByMe ? ' liked' : ''}`, type: 'button', 'aria-label': t('postLike') }, icon('heart'));
  likeBtn.onclick = async () => {
    const r = await api.toggleLike(p.id);
    p.likedByMe = r.liked; p.likes = r.likes;
    likeBtn.classList.toggle('liked', r.liked);
    likeCount.textContent = t('postLikes', { n: r.likes });
  };
  const comments = h('div', { class: 'post-comments', hidden: true });
  const commentInput = h('input', { placeholder: t('commentPh') });
  const commentCount = h('span', null, String(p.comments));
  const loadComments = async () => {
    const rows = await guarded(() => api.postComments(p.id));
    clear(comments);
    for (const c of rows || []) comments.append(h('div', { class: 'comment' }, userAvatar(c.user, 'avatar avatar-xs'), h('div', null, h('strong', null, `${c.user.firstName} ${c.user.lastName}`), h('span', null, c.content))));
  };
  const commentBtn = h('button', { class: 'ig-icon-btn', type: 'button', 'aria-label': t('postComment') }, icon('chat'), commentCount);
  commentBtn.onclick = async () => {
    comments.hidden = !comments.hidden;
    commentForm.hidden = comments.hidden;
    if (!comments.hidden) await loadComments();
  };
  const sendBtn = h('button', { class: 'ig-icon-btn', type: 'button', 'aria-label': t('postSend') }, icon('send'));
  sendBtn.onclick = () => openSendMessage(p);
  let isSaved = savedPostIds().has(p.id);
  const saveBtn = h('button', { class: `ig-icon-btn ig-save${isSaved ? ' saved' : ''}`, type: 'button', 'aria-label': t('postSave') }, icon('bookmark'));
  saveBtn.onclick = () => { isSaved = toggleSavedPost(p.id); saveBtn.classList.toggle('saved', isSaved); };
  const actions = h('div', { class: 'ig-actions' },
    h('div', { class: 'ig-actions-left' }, likeBtn, commentBtn, sendBtn), saveBtn);

  // Légende : titre + texte tronqué avec "plus".
  const full = p.content || '';
  const LIMIT = 160;
  const needsMore = full.length > LIMIT;
  const captionText = h('span', null, needsMore ? `${full.slice(0, LIMIT)}…` : full);
  const moreBtn = needsMore ? h('button', { class: 'link-btn', type: 'button' }, t('postMoreText')) : null;
  if (moreBtn) moreBtn.onclick = () => { captionText.textContent = full; moreBtn.hidden = true; };
  const caption = h('div', { class: 'ig-caption' },
    h('h2', { class: 'ig-title' }, p.title),
    h('p', null, h('strong', null, authorName), ' ', captionText, moreBtn ? ' ' : null, moreBtn));

  // Commentaires : "Voir les N commentaires" + liste + formulaire.
  const commentForm = h('form', { class: 'comment-form', hidden: true, onsubmit: async (e) => {
    e.preventDefault();
    if (!commentInput.value.trim()) return;
    await api.addComment(p.id, commentInput.value.trim());
    commentInput.value = '';
    p.comments++;
    commentCount.textContent = String(p.comments);
    viewAllBtn.textContent = t('postViewAll', { n: p.comments });
    await loadComments();
  } }, commentInput, h('button', { class: 'btn btn-small', type: 'submit' }, t('commentSubmit')));
  const viewAllBtn = p.comments > 0 ? h('button', { class: 'link-btn ig-viewall', type: 'button' }, t('postViewAll', { n: p.comments })) : null;
  if (viewAllBtn) viewAllBtn.onclick = async () => {
    const willShow = comments.hidden;
    comments.hidden = !willShow;
    commentForm.hidden = !willShow;
    if (willShow) await loadComments();
  };

  return h('article', { class: 'panel ig-post' },
    head,
    images.length ? igCarousel(images) : null,
    h('div', { class: 'ig-body' }, actions, likeCount, caption, viewAllBtn, comments, commentForm));
}
async function openSendMessage(post){const users=await api.messageUsers();const sel=h('select',null,...users.map(u=>h('option',{value:u.id},`${u.first_name} ${u.last_name} — ${ROLE_LABEL()[u.role] ?? u.role}`)));const msg=h('textarea',{rows:4},t('msgExplainPh',{title: post.title}));const form=h('form',{class:'stacked-form',onsubmit:async e=>{e.preventDefault();await api.sendMessage(Number(sel.value),msg.value.trim());close();toast(t('msgSent'));}},field(t('msgFieldTo'),sel),field(t('msgFieldMessage'),msg),h('button',{class:'btn btn-primary',type:'submit'},t('msgSend'))) ;const close=openModal(t('msgExplainTitle'),form);}

let msgPollTimer = null;
function clearMsgPoll() { if (msgPollTimer) { clearInterval(msgPollTimer); msgPollTimer = null; } }

/* Tick d'affichage des minuteurs de suivi du temps (un seul intervalle global). */
let timerTickId = null;
function clearTimerTick() { if (timerTickId) { clearInterval(timerTickId); timerTickId = null; } }
let pendingConvOpen = null; // conversation de groupe à ouvrir (depuis la fiche dossier)

async function refreshMsgNavBadge() {
  const badge = document.getElementById('nav-msg-badge');
  if (!badge) return;
  if (!currentUser || !new Set(currentUser.permissions ?? []).has('messages.read')) { badge.hidden = true; return; }
  try {
    const { total } = await api.unreadCount();
    badge.hidden = !total;
    badge.textContent = total > 9 ? '9+' : String(total);
  } catch { /* silencieux */ }
}

async function viewMessages(main) {
  clearMsgPoll();
  const users = await api.messageUsers();
  let convs = [];
  try { convs = await api.conversations(); } catch { convs = []; }

  let selected = null; // {kind:'direct', user} | {kind:'group', conv}
  let lastIds = '';
  let pendingAttachment = null; // {kind:'document', id, name} | {kind:'upload', file, name}

  const body = h('div', { class: 'message-body' });
  body.append(h('p', { class: 'message-empty' }, t('msgSelectConvo')));
  const typingBar = h('div', { class: 'msg-typing', hidden: true });
  const threadHead = h('div', { class: 'msg-thread-head', hidden: true });

  const showTyping = (people) => {
    if (!people || !people.length) { typingBar.hidden = true; return; }
    typingBar.textContent = t('msgTyping', { name: people.map((p) => `${p.firstName} ${p.lastName}`).join(', ') });
    typingBar.hidden = false;
  };

  const attachChip = h('div', { class: 'msg-attach-chip', hidden: true });
  const renderAttachChip = () => {
    clear(attachChip);
    if (!pendingAttachment) { attachChip.hidden = true; return; }
    attachChip.hidden = false;
    attachChip.append(
      h('span', { class: 'msg-attach-name' }, pendingAttachment.name),
      h('button', { class: 'link-btn', type: 'button', 'aria-label': t('msgAttachRemove'), onclick: () => { pendingAttachment = null; renderAttachChip(); } }, '×'),
    );
  };

  function renderMsg(m) {
    const wrap = h('div', { class: `message${m.mine ? ' mine' : ''}` });
    if (selected?.kind === 'group' && !m.mine) wrap.append(h('small', { class: 'msg-sender' }, `${m.sender.firstName} ${m.sender.lastName}`));
    wrap.append(h('div', { class: 'msg-text' }, m.content));
    if (m.attachment) {
      const btn = h('button', { class: 'msg-attachment', type: 'button' }, icon('download'), h('span', null, m.attachment.name));
      btn.addEventListener('click', async () => {
        try {
          const path = m.attachment.kind === 'document'
            ? `/documents/${m.attachment.id}/download`
            : `/social/messages/attachments/${m.attachment.id}`;
          await downloadFile(path, m.attachment.name);
        } catch (err) { toast(errorMessage(err), 'error'); }
      });
      wrap.append(btn);
    }
    wrap.append(h('small', { class: 'muted' }, fmtDateTime(m.createdAt)));
    if (m.mine) {
      const seen = selected.kind === 'group' ? m.readCount > 0 : m.readAt;
      const label = selected.kind === 'group'
        ? (m.readCount > 0 ? t('msgSeenBy', { n: m.readCount }) : t('msgDelivered'))
        : (m.readAt ? t('msgSeen') : t('msgDelivered'));
      wrap.append(h('small', { class: `msg-receipt${seen ? ' seen' : ''}` }, `${seen ? '✓✓' : '✓'} ${label}`));
    }
    return wrap;
  }

  const renderThread = (rows) => {
    clear(body);
    if (!rows.length) body.append(h('p', { class: 'message-empty' }, t('msgNoMessages')));
    for (const m of rows) body.append(renderMsg(m));
    body.scrollTop = body.scrollHeight;
  };

  const renderHead = () => {
    clear(threadHead);
    if (!selected) { threadHead.hidden = true; return; }
    threadHead.hidden = false;
    if (selected.kind === 'direct') {
      threadHead.append(h('strong', null, `${selected.user.first_name} ${selected.user.last_name}`));
    } else {
      const c = selected.conv;
      threadHead.append(
        h('strong', null, c.name),
        h('span', { class: 'muted' }, ` · ${(c.members || []).length} ${t('msgGroupMembers').toLowerCase()}`),
        c.caseNumber ? h('button', { class: 'chip is-active', type: 'button', onclick: () => { location.hash = `#/cases/${c.caseId}`; } }, c.caseNumber) : null,
        h('button', { class: 'link-btn', type: 'button', onclick: () => openMembersModal(c) }, t('msgManageMembers')),
      );
    }
  };

  const markSelected = () => {
    list.querySelectorAll('.message-user').forEach((el) => {
      const k = el.dataset.sel;
      el.classList.toggle('is-active',
        (selected?.kind === 'direct' && k === `u:${selected.user.id}`) ||
        (selected?.kind === 'group' && k === `c:${selected.conv.id}`));
    });
  };

  const loadSelected = async () => {
    if (!selected) return;
    showTyping([]);
    try {
      if (selected.kind === 'direct') {
        const rows = await api.messages(selected.user.id);
        lastIds = rows.map((r) => r.id).join(',');
        renderThread(rows);
      } else {
        const rows = await api.convMessages(selected.conv.id);
        lastIds = rows.map((r) => r.id).join(',');
        renderThread(rows);
      }
    } catch (err) { toast(errorMessage(err), 'error'); }
    refreshBadges();
  };

  const openDirect = (user) => { selected = { kind: 'direct', user }; pendingAttachment = null; renderAttachChip(); renderHead(); markSelected(); loadSelected(); startPoll(); };
  const openGroup = (conv) => { selected = { kind: 'group', conv }; pendingAttachment = null; renderAttachChip(); renderHead(); markSelected(); loadSelected(); startPoll(); };

  // --- Liste : recherche, groupes, badges ---
  const directList = h('div', { class: 'message-users' });
  const groupList = h('div', { class: 'message-users' });
  const searchResults = h('div', { class: 'msg-search-results', hidden: true });

  const renderLists = (unreadMap) => {
    clear(directList); clear(groupList);
    for (const u of users) {
      const n = unreadMap[u.id] ?? 0;
      directList.append(h('button', {
        class: 'message-user', type: 'button', 'data-sel': `u:${u.id}`,
        onclick: () => openDirect(u),
      }, userAvatar({ firstName: u.first_name, lastName: u.last_name, avatarUrl: u.avatarUrl }, 'avatar avatar-xs'),
        h('span', null, `${u.first_name} ${u.last_name}`),
        n ? h('span', { class: 'msg-unread' }, n > 9 ? '9+' : String(n)) : null));
    }
    for (const c of convs) {
      const n = unreadMap[`conv:${c.id}`] ?? 0;
      groupList.append(h('button', {
        class: 'message-user', type: 'button', 'data-sel': `c:${c.id}`,
        onclick: () => openGroup(c),
      },
        h('span', { class: 'msg-group-name' }, c.name,
          c.caseNumber ? h('span', { class: 'chip msg-case-chip' }, c.caseNumber) : null),
        n ? h('span', { class: 'msg-unread' }, n > 9 ? '9+' : String(n)) : null));
    }
    markSelected();
  };

  let lastUnreadJson = '';
  const refreshBadges = async (force = false) => {
    try {
      const { total, byUser } = await api.unreadCount();
      const j = JSON.stringify(byUser || {});
      if (force || j !== lastUnreadJson) { lastUnreadJson = j; renderLists(byUser || {}); }
      const badge = document.getElementById('nav-msg-badge');
      if (badge) { badge.hidden = !total; badge.textContent = total > 9 ? '9+' : String(total); }
    } catch { /* silencieux */ }
  };

  const searchInput = h('input', { type: 'search', class: 'msg-search', placeholder: t('msgSearchPh'), 'aria-label': t('msgSearchPh') });
  let searchTimer;
  searchInput.addEventListener('input', () => {
    clearTimeout(searchTimer);
    const q = searchInput.value.trim();
    if (q.length < 2) { searchResults.hidden = true; return; }
    searchTimer = setTimeout(async () => {
      try {
        const results = await api.msgSearch(q);
        clear(searchResults);
        searchResults.hidden = false;
        if (!results.length) searchResults.append(h('p', { class: 'msg-search-empty' }, t('msgNoResults')));
        for (const r of results.slice(0, 20)) {
          const label = r.kind === 'group' ? `${t('msgGroups')}: ${r.peer.name}` : r.peer.name;
          searchResults.append(h('button', {
            class: 'msg-search-item', type: 'button',
            onclick: () => {
              searchResults.hidden = true; searchInput.value = '';
              if (r.kind === 'group') {
                const c = convs.find((x) => x.id === r.peer.conversationId);
                if (c) openGroup(c);
              } else {
                const u = users.find((x) => x.id === r.peer.userId);
                if (u) openDirect(u);
              }
            },
          }, h('span', null, label), h('small', { class: 'muted' }, r.snippet)));
        }
      } catch { /* silencieux */ }
    }, 300);
  });

  const openGroupModal = async () => {
    const nameInput = h('input', { placeholder: t('msgGroupNamePh'), maxlength: 120 });
    const memberBox = h('div', { class: 'msg-member-pick' });
    for (const u of users) {
      const cb = h('input', { type: 'checkbox', value: String(u.id), id: `gm-${u.id}` });
      memberBox.append(h('label', { class: 'msg-member-row', for: `gm-${u.id}` }, cb, h('span', null, `${u.first_name} ${u.last_name}`)));
    }
    let caseSelect = null;
    try {
      const cases = await api.cases({});
      caseSelect = h('select', null, h('option', { value: '' }, t('msgNoCase')));
      for (const c of cases || []) caseSelect.append(h('option', { value: String(c.id) }, `${c.caseNumber} — ${c.title}`));
    } catch { /* pas de dossiers accessibles */ }
    const form = h('form', { class: 'stacked-form', onsubmit: async (e) => {
      e.preventDefault();
      const name = nameInput.value.trim();
      const memberIds = [...memberBox.querySelectorAll('input:checked')].map((el) => Number(el.value));
      if (!name || !memberIds.length) { toast(t('msgGroupNeedNameMembers'), 'error'); return; }
      try {
        const created = await api.createConversation({
          name, memberIds, ...(caseSelect?.value ? { caseId: Number(caseSelect.value) } : {}),
        });
        close();
        convs = await api.conversations().catch(() => convs);
        refreshBadges(true);
        toast(t('msgGroupCreated'));
        const full = convs.find((x) => x.id === created.id);
        if (full) openGroup(full);
      } catch (err) { toast(errorMessage(err), 'error'); }
    } },
      field(t('msgGroupNamePh'), nameInput),
      h('div', { class: 'field' }, h('label', null, t('msgGroupMembers')), memberBox),
      caseSelect ? field(t('msgCaseLabel'), caseSelect) : null,
      h('button', { class: 'btn btn-primary', type: 'submit' }, t('msgCreate')));
    const close = openModal(t('msgNewGroup'), form);
  };

  const openMembersModal = async (conv) => {
    const listEl = h('div', { class: 'msg-member-pick' });
    const draw = (members) => {
      clear(listEl);
      for (const m of members) {
        listEl.append(h('div', { class: 'msg-member-row' },
          h('span', null, `${m.firstName} ${m.lastName}${m.id === conv.createdBy ? ' · ' + t('msgGroupOwner') : ''}`),
          m.id !== currentUser.id ? h('button', { class: 'link-btn danger', type: 'button', onclick: async () => {
            try {
              await request(`/social/conversations/${conv.id}/members/${m.id}`, { method: 'DELETE' });
              const d = await api.conversations().catch(() => []);
              convs = d;
              const updated = await request(`/social/conversations/${conv.id}`).catch(() => null);
              if (updated) { selected.conv = { ...updated, members: updated.members }; draw(updated.members); renderHead(); }
              refreshBadges(true);
            } catch (err) { toast(errorMessage(err), 'error'); }
          } }, t('msgRemove')) : null));
      }
    };
    draw(conv.members || []);
    const addSel = h('select', null, h('option', { value: '' }, t('msgAddMember')));
    const memberIds = new Set((conv.members || []).map((m) => m.id));
    for (const u of users) if (!memberIds.has(u.id)) addSel.append(h('option', { value: String(u.id) }, `${u.first_name} ${u.last_name}`));
    const addBtn = h('button', { class: 'btn btn-secondary btn-small', type: 'button', onclick: async () => {
      if (!addSel.value) return;
      try {
        const r = await request(`/social/conversations/${conv.id}/members`, { method: 'POST', body: { userId: Number(addSel.value) } });
        selected.conv = { ...selected.conv, members: r.members };
        draw(r.members); refreshBadges(true);
      } catch (err) { toast(errorMessage(err), 'error'); }
    } }, t('msgAdd'));
    openModal(conv.name, h('div', { class: 'stacked-form' }, listEl, h('div', { class: 'field' }, h('label', null, t('msgAddMember')), h('div', { class: 'msg-add-row' }, addSel, addBtn))));
  };

  // --- Polling temps réel (5 s) ---
  const startPoll = () => {
    clearMsgPoll();
    msgPollTimer = setInterval(async () => {
      if (!selected) return;
      try {
        if (selected.kind === 'direct') {
          const rows = await api.messages(selected.user.id);
          const ids = rows.map((r) => r.id).join(',');
          if (ids !== lastIds) { lastIds = ids; renderThread(rows); }
          const tp = await api.getTyping(selected.user.id);
          showTyping(tp.typing ? [selected.user] : []);
        } else {
          const rows = await api.convMessages(selected.conv.id);
          const ids = rows.map((r) => r.id).join(',');
          if (ids !== lastIds) { lastIds = ids; renderThread(rows); }
          const tp = await api.convGetTyping(selected.conv.id);
          showTyping(tp.typing || []);
        }
        refreshBadges();
      } catch { /* silencieux */ }
    }, 5000);
  };

  // --- Composeur ---
  const input = h('input', { placeholder: t('msgPh'), 'aria-label': t('msgPh') });
  const fileInput = h('input', { type: 'file', hidden: true });
  const attachMenu = h('div', { class: 'msg-attach-menu', hidden: true });
  const toggleMenu = () => { attachMenu.hidden = !attachMenu.hidden; };
  const pickExistingDoc = async () => {
    attachMenu.hidden = true;
    try {
      const docs = await api.myDocuments();
      if (!docs?.length) { toast(t('msgNoDocs'), 'error'); return; }
      const sel = h('select', null, h('option', { value: '' }, t('msgAttachExisting')));
      for (const d of docs) sel.append(h('option', { value: String(d.id) }, d.originalName || d.name));
      const go = h('button', { class: 'btn btn-primary btn-small', type: 'button', onclick: () => {
        if (!sel.value) return;
        const d = docs.find((x) => String(x.id) === sel.value);
        pendingAttachment = { kind: 'document', id: Number(sel.value), name: d.originalName || d.name };
        renderAttachChip(); close();
      } }, t('msgAttach'));
      const close = openModal(t('msgAttachExisting'), h('div', { class: 'stacked-form' }, field(t('msgAttachExisting'), sel), go));
    } catch (err) { toast(errorMessage(err), 'error'); }
  };
  attachMenu.append(
    h('button', { type: 'button', onclick: pickExistingDoc }, icon('file'), h('span', null, t('msgAttachExisting'))),
    h('button', { type: 'button', onclick: () => { attachMenu.hidden = true; fileInput.click(); } }, icon('download'), h('span', null, t('msgAttachUpload'))),
  );
  fileInput.addEventListener('change', () => {
    const f = fileInput.files?.[0];
    fileInput.value = '';
    if (!f) return;
    pendingAttachment = { kind: 'upload', file: f, name: f.name };
    renderAttachChip();
  });
  const attachBtn = h('button', { class: 'icon-btn', type: 'button', 'aria-label': t('msgAttach'), title: t('msgAttach'), onclick: toggleMenu }, icon('plus'));

  let lastTypingSent = 0;
  input.addEventListener('input', () => {
    const now = Date.now();
    if (!selected || now - lastTypingSent < 4000) return;
    lastTypingSent = now;
    if (selected.kind === 'direct') api.sendTyping(selected.user.id);
    else api.convSendTyping(selected.conv.id);
  });

  const doSend = async () => {
    if (!selected) return;
    let text = input.value.trim();
    if (!text && !pendingAttachment) return;
    if (!text && pendingAttachment) text = pendingAttachment.name;
    const att = pendingAttachment;
    pendingAttachment = null; renderAttachChip();
    input.value = '';
    try {
      let msgId;
      if (selected.kind === 'direct') {
        const r = await api.sendMessage(selected.user.id, text, att?.kind === 'document' ? att.id : undefined);
        msgId = r.id;
      } else {
        const r = await api.sendConvMessage(selected.conv.id, text, att?.kind === 'document' ? att.id : undefined);
        msgId = r.id;
      }
      if (att?.kind === 'upload') await api.attachFile(msgId, att.file);
      await loadSelected();
    } catch (err) { toast(errorMessage(err), 'error'); }
  };
  const form = h('form', { class: 'message-compose', onsubmit: async (e) => { e.preventDefault(); doSend(); } },
    attachBtn, attachMenu, input, h('button', { class: 'btn btn-primary', type: 'submit' }, t('msgSend')));

  const list = h('div', { class: 'msg-sidebar' },
    searchInput, searchResults,
    h('div', { class: 'msg-list-head' }, h('span', { class: 'msg-section-label' }, t('msgGroups')), h('button', { class: 'btn btn-secondary btn-small', type: 'button', onclick: openGroupModal }, t('msgNewGroup'))),
    groupList,
    h('div', { class: 'msg-section-label' }, t('msgDirect')),
    directList);

  clear(main).append(
    h('div', { class: 'page' },
      h('div', { class: 'page-head' }, h('h1', null, t('msgTitle'))),
      h('div', { class: 'messenger' }, list,
        h('section', { class: 'message-window' }, threadHead, body, typingBar, attachChip, form)),
    ),
  );
  refreshBadges(true);
  if (pendingConvOpen) {
    const c = convs.find((x) => x.id === pendingConvOpen);
    pendingConvOpen = null;
    if (c) openGroup(c);
  }
}

async function viewAI(main){
  const caseSelect=h('select',null,h('option',{value:''},t('aiAllDocs')));
  const question=h('textarea',{rows:5,placeholder:t('aiQuestionPh')});
  const answer=h('div',{class:'ai-answer'});
  const statusBox=h('div',{class:'panel ai-status'},h('p',{class:'loading'},t('aiChecking')));
  const cases=await guarded(()=>api.cases({}));
  for(const c of cases||[])caseSelect.append(h('option',{value:c.id},`${c.caseNumber} — ${c.title}`));

  try {
    const status=await api.aiStatus();
    clear(statusBox).append(
      h('h3',null,t('aiTitle')),
      h('p',null,status.configured
        ? t('aiReady',{provider: status.provider || 'Gemini', chat: status.chatModel, emb: status.embeddingModel})
        : t('aiNotReady',{provider: status.provider || 'Gemini', chat: status.chatModel, emb: status.embeddingModel}))
    );
  } catch(err) {
    clear(statusBox).append(h('h3',null,t('aiTitle')),h('p',{class:'form-error'},errorMessage(err)));
  }

  const form=h('form',{class:'stacked-form',onsubmit:async e=>{
    e.preventDefault();
    if(!question.value.trim()) return;
    clear(answer).append(h('p',{class:'loading'},t('aiSearching')));
    try{
      const r=await api.askAI(question.value,caseSelect.value?Number(caseSelect.value):undefined);
      clear(answer).append(h('p',null,r.answer));
      if((r.sources||[]).length){
        answer.append(h('h3',null,t('aiSources')),...(r.sources||[]).map(s=>h('div',{class:'source-item'},`[Source ${s.number}] ${s.name} — ${s.caseNumber}`)));
      }
    }catch(err){clear(answer).append(h('p',{class:'form-error'},errorMessage(err)));}
  }},field(t('aiCase'),caseSelect),field(t('aiQuestion'),question),h('button',{class:'btn btn-primary',type:'submit'},t('aiAsk')));
  clear(main).append(h('div',{class:'page'},h('div',{class:'page-head'},h('h1',null,t('navAI')),h('p',{class:'muted'},t('aiSubtitle'))),statusBox,h('section',{class:'panel'},form),h('section',{class:'panel'},h('h2',null,t('aiAnswer')),answer)));
}


/* ------------------------------------------------------------------ */
/* Widget de chat flottant — Assistant IA (bulle en bas à droite)      */
/* Visible pour tout rôle disposant de la permission ai.ask.           */
/* ------------------------------------------------------------------ */

let chatBootedFor = null;

function syncChatWidget() {
  const existing = document.getElementById('cej-chat');
  const canChat = !!(currentUser && new Set(currentUser.permissions ?? []).has('ai.ask'));
  if (!canChat) { existing?.remove(); chatBootedFor = null; return; }
  if (!existing) mountChatWidget();
}

function chatIconSvg() {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('class', 'cej-chat-icon');
  svg.setAttribute('aria-hidden', 'true');
  svg.innerHTML = '<path d="M4 5h16a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H9l-5 4V6a1 1 0 0 1 1-1z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>'
    + '<circle cx="9" cy="11" r="1.1" fill="currentColor"/><circle cx="13" cy="11" r="1.1" fill="currentColor"/><circle cx="17" cy="11" r="1.1" fill="currentColor"/>';
  return svg;
}

function mountChatWidget() {
  const msgs = h('div', { class: 'cej-chat-msgs', role: 'log', 'aria-live': 'polite' });
  const input = h('input', { type: 'text', class: 'cej-chat-input', placeholder: t('chatPlaceholder'), 'aria-label': t('chatTitle'), maxlength: 5000 });
  const sendBtn = h('button', { class: 'cej-chat-send', type: 'button' }, t('chatSend'));
  const panel = h('div', { class: 'cej-chat-panel', hidden: true },
    h('div', { class: 'cej-chat-head' },
      h('span', { class: 'cej-chat-title' }, t('chatTitle')),
      h('button', { class: 'cej-chat-close', type: 'button', 'aria-label': '×', onclick: () => toggleChat(false) }, '×')),
    msgs,
    h('div', { class: 'cej-chat-form' }, input, sendBtn));
  const bubble = h('button', { class: 'cej-chat-bubble', type: 'button', 'aria-label': t('chatTitle'), 'aria-expanded': 'false', onclick: () => toggleChat() });
  bubble.append(chatIconSvg());
  const root = h('div', { id: 'cej-chat', class: 'cej-chat' }, panel, bubble);
  document.body.append(root);

  let sending = false;
  async function doSend() {
    const q = input.value.trim();
    if (!q || sending) return;
    sending = true;
    input.value = '';
    msgs.append(h('div', { class: 'cej-chat-msg user' }, h('p', null, q)));
    const typing = h('div', { class: 'cej-chat-msg assistant typing' }, h('p', null, t('chatTyping')));
    msgs.append(typing);
    msgs.scrollTop = msgs.scrollHeight;
    try {
      const r = await api.askAI(q, undefined, getLang());
      typing.remove();
      msgs.append(h('div', { class: 'cej-chat-msg assistant' }, h('p', null, r.answer)));
      if ((r.sources || []).length) {
        msgs.append(h('div', { class: 'cej-chat-sources' },
          h('span', { class: 'cej-chat-sources-label' }, `${t('chatSources')} :`),
          ...(r.sources || []).map((s) => h('span', { class: 'cej-chat-chip' }, `[${s.number}] ${s.name}`))));
      }
    } catch (err) {
      typing.remove();
      msgs.append(h('div', { class: 'cej-chat-msg assistant error' }, h('p', null, errorMessage(err))));
    }
    sending = false;
    msgs.scrollTop = msgs.scrollHeight;
  }
  sendBtn.addEventListener('click', doSend);
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') doSend(); });

  async function toggleChat(force) {
    const open = force ?? panel.hidden;
    panel.hidden = !open;
    bubble.setAttribute('aria-expanded', String(open));
    if (open && chatBootedFor !== getLang()) {
      chatBootedFor = getLang();
      clear(msgs);
      try {
        const status = await api.aiStatus();
        if (!status.configured) {
          msgs.append(h('div', { class: 'cej-chat-msg assistant' }, h('p', null, t('aiNotReady'))));
          input.disabled = true;
          sendBtn.disabled = true;
        } else {
          input.disabled = false;
          sendBtn.disabled = false;
          msgs.append(h('div', { class: 'cej-chat-msg assistant' }, h('p', null, t('chatWelcome'))));
        }
      } catch (err) {
        msgs.append(h('div', { class: 'cej-chat-msg assistant error' }, h('p', null, errorMessage(err))));
      }
    }
    if (open) setTimeout(() => input.focus(), 60);
  }
}

/* ------------------------------------------------------------------ */
/* Tableau de bord                                                     */
/* ------------------------------------------------------------------ */

/* Graphiques SVG légers (aucune dépendance). */
const CHART_COLORS = ['#8A6A2C', '#46536A', '#9A8F7A', '#B98A2F', '#5F6B7A', '#7A6A3A'];
const escAttr = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function barChart(items, formatValue) {
  const W = 560, H = 230, padB = 46, padT = 22, padX = 10;
  const max = Math.max(1, ...items.map((i) => i.value));
  const bw = (W - padX * 2) / Math.max(1, items.length);
  const bars = items.map((it, i) => {
    const hgt = Math.max(0, ((H - padB - padT) * it.value) / max);
    const x = padX + i * bw + bw * 0.2;
    const w = bw * 0.6;
    const y = H - padB - hgt;
    return `<g><rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${w.toFixed(1)}" height="${hgt.toFixed(1)}" class="chart-bar" rx="2"/>`
      + `<text x="${(x + w / 2).toFixed(1)}" y="${H - padB + 18}" class="chart-label" text-anchor="middle">${escAttr(it.label)}</text>`
      + (it.value ? `<text x="${(x + w / 2).toFixed(1)}" y="${(y - 7).toFixed(1)}" class="chart-value" text-anchor="middle">${escAttr(formatValue(it.value))}</text>` : '')
      + `</g>`;
  }).join('');
  return `<svg viewBox="0 0 ${W} ${H}" class="chart" role="img" aria-hidden="true">${bars}</svg>`;
}

function donutChart(entries) {
  const total = entries.reduce((s, e) => s + e.value, 0) || 1;
  const R = 64, C = 2 * Math.PI * R;
  let acc = 0;
  const segs = entries.filter((e) => e.value > 0).map((e, i) => {
    const frac = e.value / total;
    const s = `<circle cx="90" cy="90" r="${R}" fill="none" stroke="${CHART_COLORS[i % CHART_COLORS.length]}" stroke-width="30" `
      + `stroke-dasharray="${(frac * C).toFixed(1)} ${C.toFixed(1)}" stroke-dashoffset="${(-acc * C).toFixed(1)}" transform="rotate(-90 90 90)"/>`;
    acc += frac;
    return s;
  }).join('');
  const legend = entries.map((e, i) => `<li><span class="legend-dot" style="background:${CHART_COLORS[i % CHART_COLORS.length]}"></span>${escAttr(e.label)} <strong>${e.value}</strong></li>`).join('');
  return `<div class="donut-wrap"><svg viewBox="0 0 180 180" class="donut" role="img" aria-hidden="true">`
    + `<circle cx="90" cy="90" r="${R}" fill="none" stroke="var(--rule)" stroke-width="30"/>${segs}`
    + `<text x="90" y="96" text-anchor="middle" class="donut-total">${total}</text></svg>`
    + `<ul class="chart-legend">${legend}</ul></div>`;
}

function chartPanel(title, svgHtml, link) {
  const wrap = h('section', { class: 'panel' }, h('h2', null, link ? h('a', { href: link, class: 'panel-link' }, title) : title));
  const div = h('div', { class: 'chart-wrap' });
  div.innerHTML = svgHtml;
  wrap.append(div);
  return wrap;
}

/** Portail client : onglets Mes dossiers / Mes documents / Mes factures. */
async function viewClientPortal(main) {
  const tabs = h('div', { class: 'tabs', role: 'tablist' });
  const panel = h('div', { class: 'tab-panel' });
  let active = 'cases';

  function setTab(name) {
    active = name;
    for (const b of tabs.children) {
      const on = b.dataset.tab === name;
      b.classList.toggle('is-active', on);
      b.setAttribute('aria-selected', on ? 'true' : 'false');
    }
    if (name === 'cases') renderPortalCases();
    else if (name === 'docs') renderPortalDocs();
    else renderPortalInvoices();
  }

  async function renderPortalCases() {
    const rows = await guarded(() => api.cases());
    clear(panel);
    if (!rows?.length) {
      panel.append(h('p', { class: 'empty-state' }, t('portalNoCases')));
      return;
    }
    const tb = h('tbody');
    for (const c of rows) {
      tb.append(h('tr', { class: 'row-link', tabindex: '0', onclick: () => (location.hash = `#/cases/${c.id}`) },
        h('td', null, h('span', { class: 'mono' }, c.caseNumber)),
        h('td', null, h('strong', null, c.title)),
        h('td', null, c.lawyerName ?? '—'),
        h('td', null, statusDot(c.status, CASE_STATUS())),
        h('td', null, c.dueDate ? fmtDate(c.dueDate) : '—')));
    }
    panel.append(h('div', { class: 'table-wrap' }, h('table', null,
      h('thead', null, h('tr', null, h('th', null, t('caseNumber')), h('th', null, t('caseTitle')), h('th', null, t('caseLawyer')), h('th', null, t('caseStatus')), h('th', null, t('caseDueDate')))), tb)));
  }

  async function renderPortalDocs() {
    const rows = await guarded(() => api.myDocuments());
    clear(panel);
    if (!rows?.length) {
      panel.append(h('p', { class: 'empty-state' }, t('portalNoDocs')));
      return;
    }
    const tb = h('tbody');
    for (const d of rows) {
      tb.append(h('tr', null,
        h('td', null, h('strong', null, d.originalName ?? d.name)),
        h('td', null, h('a', { href: `#/cases/${d.caseId}` }, d.caseTitle ?? '')),
        h('td', { class: 'muted' }, fmtDate(d.createdAt)),
        h('td', { class: 'row-actions' }, h('button', { class: 'btn btn-small', type: 'button', onclick: () => guarded(() => downloadFile(`/documents/${d.id}/download`, d.originalName ?? d.name)) }, icon('download'), t('portalDownload')))));
    }
    panel.append(h('div', { class: 'table-wrap' }, h('table', null,
      h('thead', null, h('tr', null, h('th', null, t('docName')), h('th', null, t('docCase')), h('th', null, t('docDate')), h('th', null, t('timeActions')))), tb)));
  }

  async function renderPortalInvoices() {
    const rows = await guarded(() => api.invoices());
    clear(panel);
    if (!rows?.length) {
      panel.append(h('p', { class: 'empty-state' }, t('portalNoInvoices')));
      return;
    }
    const tb = h('tbody');
    for (const i of rows) {
      const canDeclare = !['PAYEE', 'ANNULEE'].includes(i.status);
      tb.append(h('tr', null,
        h('td', null, h('span', { class: 'mono' }, i.invoiceNumber)),
        h('td', null, i.caseTitle ?? '—'),
        h('td', { class: 'num' }, fmtMoney(i.totalCents)),
        h('td', null, statusDot(i.status, INVOICE_STATUS())),
        h('td', null, i.dueAt ? fmtDate(i.dueAt) : '—'),
        h('td', { class: 'row-actions' },
          h('button', { class: 'icon-btn', type: 'button', 'aria-label': t('invViewPdf'), title: t('invViewPdf'), onclick: () => guarded(() => openFile(`/invoices/${i.id}/pdf`)) }, icon('file')),
          canDeclare ? h('button', { class: 'btn btn-small', type: 'button', onclick: async () => {
            if (!confirm(t('portalDeclareConfirm'))) return;
            const ok = await guarded(() => api.declarePayment(i.id));
            if (ok) { toast(t('portalPaymentDeclared')); renderPortalInvoices(); }
          } }, t('portalDeclarePayment')) : null)));
    }
    panel.append(h('div', { class: 'table-wrap' }, h('table', null,
      h('thead', null, h('tr', null, h('th', null, t('invNumber')), h('th', null, t('invCase')), h('th', { class: 'num' }, t('invTotal')), h('th', null, t('invStatus')), h('th', null, t('invDueAt')), h('th', null, t('timeActions')))), tb)));
  }

  for (const [key, label] of [['cases', t('portalTabCases')], ['docs', t('portalTabDocs')], ['invoices', t('portalTabInvoices')]]) {
    tabs.append(h('button', { class: 'tab', role: 'tab', 'data-tab': key, type: 'button', onclick: () => setTab(key) }, label));
  }

  clear(main).append(
    h('div', { class: 'page' },
      h('div', { class: 'page-head' }, h('div', null, h('h1', { tabindex: '-1' }, t('portalTitle')), h('p', { class: 'muted' }, t('portalSubtitle', { name: currentUser.firstName })))),
      tabs,
      panel),
  );
  setTab(active);
  main.focus({ preventScroll: true });
}

async function viewDashboard(main) {
  // Le portail client remplace le tableau de bord KPI pour le rôle CLIENT.
  if (currentUser.role === 'CLIENT') return viewClientPortal(main);

  const data = await guarded(() => api.dashboard());
  if (!data) return;

  const kpi = (label, value, iconName, target) => h('div', {
    class: `kpi${target ? ' kpi-link' : ''}`,
    ...(target ? {
      role: 'link',
      tabindex: '0',
      'aria-label': label,
      onclick: () => { location.hash = target; },
      onkeydown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); location.hash = target; } },
    } : {}),
  }, h('div', { class: 'kpi-icon' }, icon(iconName)), h('div', { class: 'kpi-text' }, h('div', { class: 'kpi-value' }, value), h('div', { class: 'kpi-label' }, label)));

  /* --- Échéances : 7 prochains jours + en retard --- */
  const deadlineItems = (data.upcomingDeadlines ?? []).map((d) => h(
    'li',
    { class: d.overdue ? 'overdue' : '' },
    h('a', { href: `#/cases/${d.id}` }, h('strong', null, d.caseNumber), ` — ${d.title}`),
    h('span', { class: 'deadline-date' }, fmtDate(d.dueDate)),
  ));
  const overdueInvItems = (data.overdueInvoices ?? []).map((i) => h(
    'li',
    { class: 'overdue' },
    h('a', { href: '#/invoices' }, h('strong', null, i.invoiceNumber)),
    h('span', { class: 'deadline-date' }, `${fmtDate(i.dueAt)} · ${fmtMoney(i.totalCents)}`),
  ));
  const deadlinesPanel = h(
    'section',
    { class: 'panel deadlines-panel' },
    h('h2', null, h('a', { href: '#/calendar', class: 'panel-link' }, t('dashDeadlines'))),
    (data.upcomingDeadlines ?? []).length
      ? h('ul', { class: 'deadline-list' }, ...deadlineItems)
      : h('p', { class: 'empty-state' }, t('dashNoDeadlines')),
    (data.overdueInvoices ?? []).length
      ? [h('h3', null, t('dashOverdueInvoices')), h('ul', { class: 'deadline-list' }, ...overdueInvItems)]
      : null,
  );

  /* --- Graphiques --- */
  const monthLabel = (ym) => {
    const [y, m] = ym.split('-').map(Number);
    return new Date(y, m - 1, 1).toLocaleDateString(fmtLocale(), { month: 'short' });
  };
  const revenuePanel = chartPanel(
    t('dashRevenue'),
    (data.revenueByMonth ?? []).some((r) => r.totalCents > 0)
      ? barChart(data.revenueByMonth.map((r) => ({ label: monthLabel(r.month), value: r.totalCents })), (v) => fmtMoneyShort(v))
      : `<p class="empty-state">${escAttr(t('dashNoData'))}</p>`,
    '#/invoices',
  );
  const donutPanel = chartPanel(
    t('dashCasesByStatus'),
    donutChart(Object.entries(data.cases.byStatus).map(([k, v]) => ({ label: CASE_STATUS()[k] ?? k, value: v }))),
    '#/cases',
  );
  const lawyerPanel = chartPanel(
    t('dashOpenByLawyer'),
    (data.openCasesByLawyer ?? []).length
      ? barChart(data.openCasesByLawyer.map((r) => ({ label: r.lawyerName, value: r.count })), (v) => String(v))
      : `<p class="empty-state">${escAttr(t('dashNoData'))}</p>`,
    '#/cases',
  );

  /* --- Mes publications : toutes les publications de l'utilisateur connecté --- */
  const dashPerms = new Set(currentUser.permissions ?? []);
  const myFeed = h('div', { class: 'feed' });
  const myPostsSection = dashPerms.has('posts.create')
    ? h('section', { class: 'panel' }, h('h2', null, t('myPosts')), myFeed)
    : null;

  clear(main).append(
    h(
      'div',
      { class: 'page' },
      h('div', { class: 'page-head' }, h('h1', { tabindex: '-1' }, t('dashTitle')), h('p', { class: 'muted' }, t('dashWelcome', { name: currentUser.firstName }))),
      h(
        'div',
        { class: 'kpi-grid' },
        kpi(t('dashActiveCases'), data.cases.active, 'cases', '#/cases'),
        kpi(t('dashClients'), data.clients.total, 'clients', '#/clients'),
        kpi(t('dashUnpaid', { n: data.billing.unpaidCount }), fmtMoneyShort(data.billing.unpaidCents), 'billing', '#/invoices'),
        kpi(t('dashDocuments'), data.documents.total, 'documents', '#/cases'),
      ),
      deadlinesPanel,
      h('div', { class: 'grid-2' }, revenuePanel, donutPanel),
      h(
        'div',
        { class: 'grid-2' },
        lawyerPanel,
        h(
          'section',
          { class: 'panel' },
          h('h2', null, h('a', { href: '#/cases', class: 'panel-link' }, t('dashRecentActivity'))),
          data.recentCases.length
            ? h('ul', { class: 'activity-list' }, data.recentCases.map((c) => h('li', null, h('a', { href: `#/cases/${c.id}` }, c.title), h('span', { class: 'muted' }, `${c.clientName} · ${fmtDate(c.updatedAt)}`), statusDot(c.status, CASE_STATUS()))))
            : h('p', { class: 'empty-state' }, t('dashNoActivity')),
        ),
      ),
      myPostsSection,
    ),
  );
  if (myPostsSection) renderPostFeed(myFeed, dashPerms, () => route(), { author_id: currentUser.id });
  main.focus({ preventScroll: true });
}

/* ------------------------------------------------------------------ */
/* Profil public d'un utilisateur : en-tête + toutes ses publications  */
/* ------------------------------------------------------------------ */

async function viewProfile(main, id) {
  const perms = new Set(currentUser?.permissions ?? []);
  if (!currentUser || !perms.has('posts.read')) {
    clear(main).append(h('div', { class: 'page' }, h('p', { class: 'form-error' }, t('errGeneric'))));
    return;
  }
  clear(main).append(h('p', { class: 'loading' }, t('loading')));
  let profile = null;
  try {
    profile = await api.userProfile(id);
  } catch (err) {
    clear(main).append(
      h('div', { class: 'page' },
        h('div', { class: 'page-head' }, h('h1', { tabindex: '-1' }, t('profileTitle'))),
        h('section', { class: 'panel' }, h('p', { class: 'empty-state' }, t('profileNotFound'))),
      )
    );
    return;
  }
  document.title = `${profile.firstName} ${profile.lastName} — ${firmName()}`;
  const feed = h('div', { class: 'feed' });
  clear(main).append(
    h('div', { class: 'page' },
      h('div', { class: 'page-head profile-head' },
        userAvatar(profile, 'avatar avatar-lg'),
        h('div', null,
          h('h1', { tabindex: '-1' }, `${profile.firstName} ${profile.lastName}`),
          h('p', { class: 'muted' }, `${ROLE_LABEL()[profile.role] ?? profile.role} · ${t('profilePostCount', { n: profile.postCount })}`),
        ),
      ),
      h('section', { class: 'panel' }, h('h2', null, t('profilePosts')), feed),
    )
  );
  renderPostFeed(feed, perms, () => route(), { author_id: profile.id });
  main.focus({ preventScroll: true });
}

/* ------------------------------------------------------------------ */
/* Clients                                                             */
/* ------------------------------------------------------------------ */

function clientForm(existing, onSubmit) {
  const f = {
    firstName: h('input', { required: true, value: existing?.firstName ?? '' }),
    lastName: h('input', { required: true, value: existing?.lastName ?? '' }),
    email: h('input', { type: 'email', value: existing?.email ?? '' }),
    phone: h('input', { value: existing?.phone ?? '' }),
    company: h('input', { value: existing?.company ?? '' }),
    address: h('input', { value: existing?.address ?? '' }),
    notes: h('textarea', { rows: 3 }, existing?.notes ?? ''),
  };
  const errorBox = h('p', { class: 'form-error', hidden: true });
  const submitBtn = h('button', { class: 'btn btn-primary', type: 'submit' }, existing ? t('save') : t('clientCreate'));
  const form = h(
    'form',
    {
      class: 'stacked-form',
      onsubmit: async (e) => {
        e.preventDefault();
        errorBox.hidden = true;
        try {
          await onSubmit({
            firstName: f.firstName.value.trim(),
            lastName: f.lastName.value.trim(),
            email: f.email.value.trim(),
            phone: f.phone.value.trim(),
            company: f.company.value.trim(),
            address: f.address.value.trim(),
            notes: f.notes.value.trim(),
          });
        } catch (err) {
          errorBox.textContent = errorMessage(err);
          errorBox.hidden = false;
        }
      },
    },
    h('div', { class: 'form-row' }, field(t('formFirstName'), f.firstName), field(t('formLastName'), f.lastName)),
    h('div', { class: 'form-row' }, field(t('formEmail'), f.email), field(t('formPhone'), f.phone)),
    field(t('formCompany'), f.company),
    field(t('formAddress'), f.address),
    field(t('formNotes'), f.notes),
    errorBox,
    submitBtn,
  );
  return form;
}

async function viewClients(main) {
  const perms = new Set(currentUser.permissions);
  const searchInput = h('input', { type: 'search', placeholder: t('searchShortPh'), class: 'inline-search' });
  const tableBody = h('tbody');

  async function load(q = '') {
    const rows = await guarded(() => api.clients(q));
    clear(tableBody);
    if (!rows?.length) {
      tableBody.append(h('tr', null, h('td', { colspan: 5, class: 'empty-state' }, t('clientsEmpty'))));
      return;
    }
    for (const c of rows) {
      tableBody.append(
        h(
          'tr',
          { class: 'row-link', tabindex: '0', onclick: () => (location.hash = `#/clients/${c.id}`) },
          h('td', null, h('strong', null, `${c.firstName} ${c.lastName}`)),
          h('td', null, c.company || '—'),
          h('td', null, c.email || '—'),
          h('td', null, c.phone || '—'),
          h('td', { class: 'muted' }, fmtDate(c.createdAt)),
        ),
      );
    }
  }

  let debounce;
  searchInput.addEventListener('input', () => {
    clearTimeout(debounce);
    debounce = setTimeout(() => load(searchInput.value.trim()), 220);
  });

  const newBtn = perms.has('clients.create')
    ? h('button', { class: 'btn btn-primary', type: 'button', onclick: () => {
        const form = clientForm(null, async (body) => {
          const created = await api.createClient(body);
          close();
          toast(t('clientCreated'));
          location.hash = `#/clients/${created.id}`;
        });
        const close = openModal(t('clientNew'), form);
      } }, icon('plus'), t('clientNew'))
    : null;

  clear(main).append(
    h(
      'div',
      { class: 'page' },
      h('div', { class: 'page-head' }, h('h1', { tabindex: '-1' }, t('clientsTitle')), h('div', { class: 'page-actions' }, searchInput, newBtn)),
      h(
        'div',
        { class: 'table-wrap' },
        h(
          'table',
          null,
          h('thead', null, h('tr', null, h('th', null, t('formLastName')), h('th', null, t('formCompany')), h('th', null, t('formEmail')), h('th', null, t('formPhone')), h('th', null, t('createdAt')))),
          tableBody,
        ),
      ),
    ),
  );
  await load();
  main.focus({ preventScroll: true });
}

async function viewClientDetail(main, id) {
  const perms = new Set(currentUser.permissions);
  const [client, cases, invoices] = await Promise.all([
    guarded(() => api.client(id)),
    guarded(() => api.cases({ q: '' })),
    perms.has('billing.read') ? guarded(() => api.invoices()) : Promise.resolve([]),
  ]);
  if (!client) return;

  const clientCases = (cases ?? []).filter((c) => c.clientId === Number(id));
  const clientInvoices = (invoices ?? []).filter((i) => i.clientId === Number(id));

  clear(main).append(
    h(
      'div',
      { class: 'page' },
      h('a', { class: 'back-link', href: '#/clients' }, icon('chevronLeft'), t('clientsTitle')),
      h(
        'div',
        { class: 'page-head' },
        h('h1', { tabindex: '-1' }, `${client.firstName} ${client.lastName}`),
        perms.has('clients.update') &&
          h('button', { class: 'btn', type: 'button', onclick: () => {
            const form = clientForm(client, async (body) => { await api.updateClient(id, body); close(); toast(t('clientUpdated')); viewClientDetail(main, id); });
            const close = openModal(t('clientEdit'), form);
          } }, t('edit')),
      ),
      h(
        'div',
        { class: 'grid-2' },
        h(
          'section',
          { class: 'panel' },
          h('h2', null, t('clientContact')),
          h('dl', { class: 'definition-list' },
            h('dt', null, t('formCompany')), h('dd', null, client.company || '—'),
            h('dt', null, t('formEmail')), h('dd', null, client.email || '—'),
            h('dt', null, t('formPhone')), h('dd', null, client.phone || '—'),
            h('dt', null, t('formAddress')), h('dd', null, client.address || '—'),
          ),
          client.notes && h('p', { class: 'notes-box' }, client.notes),
        ),
        h(
          'section',
          { class: 'panel' },
          h('h2', null, t('clientCases')),
          clientCases.length
            ? h('ul', { class: 'activity-list' }, clientCases.map((c) => h('li', null, h('a', { href: `#/cases/${c.id}` }, c.title), statusDot(c.status, CASE_STATUS()))))
            : h('p', { class: 'empty-state' }, t('casesEmpty')),
        ),
      ),
      perms.has('billing.read') &&
        h(
          'section',
          { class: 'panel' },
          h('h2', null, t('clientInvoices')),
          clientInvoices.length
            ? h('ul', { class: 'activity-list' }, clientInvoices.map((i) => h('li', null, h('span', null, i.invoiceNumber), h('span', { class: 'muted' }, fmtMoney(i.totalCents)), statusDot(i.status, INVOICE_STATUS()))))
            : h('p', { class: 'empty-state' }, t('invoicesEmpty')),
        ),
    ),
  );
  main.focus({ preventScroll: true });
}

/* ------------------------------------------------------------------ */
/* Dossiers                                                             */
/* ------------------------------------------------------------------ */

async function caseForm(existing, onSubmit) {
  const perms = new Set(currentUser.permissions);
  const [clients, lawyers] = await Promise.all([
    guarded(() => api.clients()),
    perms.has('users.read') ? guarded(() => api.users()) : Promise.resolve([]),
  ]);
  const lawyerOptions = (lawyers ?? []).filter((u) => u.role === 'LAWYER' && u.isActive);

  const f = {
    title: h('input', { required: true, value: existing?.title ?? '' }),
    clientId: h(
      'select', { required: true, disabled: !!existing },
      h('option', { value: '' }, t('selectPlaceholder')),
      ...(clients ?? []).map((c) => h('option', { value: c.id, selected: existing?.clientId === c.id }, `${c.firstName} ${c.lastName}`)),
    ),
    lawyerId: h(
      'select', null,
      h('option', { value: '' }, t('unassigned')),
      ...lawyerOptions.map((u) => h('option', { value: u.id, selected: existing?.lawyerId === u.id }, `${u.firstName} ${u.lastName}`)),
    ),
    caseType: h('input', { value: existing?.caseType ?? '' }),
    priority: h(
      'select', null,
      ...Object.entries(CASE_PRIORITY()).map(([v, l]) => h('option', { value: v, selected: (existing?.priority ?? 'NORMALE') === v }, l)),
    ),
    dueDate: h('input', { type: 'date', value: existing?.dueDate ? existing.dueDate.slice(0, 10) : '' }),
    description: h('textarea', { rows: 3 }, existing?.description ?? ''),
  };
  const errorBox = h('p', { class: 'form-error', hidden: true });
  const form = h(
    'form',
    {
      class: 'stacked-form',
      onsubmit: async (e) => {
        e.preventDefault();
        errorBox.hidden = true;
        try {
          await onSubmit({
            title: f.title.value.trim(),
            clientId: Number(f.clientId.value),
            lawyerId: f.lawyerId.value ? Number(f.lawyerId.value) : null,
            caseType: f.caseType.value.trim(),
            priority: f.priority.value,
            dueDate: f.dueDate.value || null,
            description: f.description.value.trim(),
          });
        } catch (err) {
          errorBox.textContent = errorMessage(err);
          errorBox.hidden = false;
        }
      },
    },
    field(t('caseTitlePh'), f.title),
    h('div', { class: 'form-row' }, field(t('caseClient'), f.clientId), field(t('caseLawyer'), f.lawyerId)),
    h('div', { class: 'form-row' }, field(t('caseType'), f.caseType), field(t('casePriority'), f.priority)),
    field(t('caseDueDate'), f.dueDate),
    field(t('caseDescription'), f.description),
    errorBox,
    h('button', { class: 'btn btn-primary', type: 'submit' }, existing ? t('save') : t('caseCreate')),
  );
  return form;
}

async function viewCases(main) {
  const perms = new Set(currentUser.permissions);
  let statusFilter = '';
  const tableBody = h('tbody');

  const fLawyer = h('select', null, h('option', { value: '' }, t('filterAllLawyers')));
  const fPriority = h('select', null,
    h('option', { value: '' }, t('filterAllPriorities')),
    ...Object.entries(CASE_PRIORITY()).map(([v, l]) => h('option', { value: v }, l)));
  const fDateFrom = h('input', { type: 'date' });
  const fDateTo = h('input', { type: 'date' });

  function currentFilters() {
    const f = {};
    if (statusFilter) f.status = statusFilter;
    if (fLawyer.value) f.lawyerId = Number(fLawyer.value);
    if (fPriority.value) f.priority = fPriority.value;
    if (fDateFrom.value) f.dateFrom = fDateFrom.value;
    if (fDateTo.value) f.dateTo = fDateTo.value;
    return f;
  }

  async function load() {
    const rows = await guarded(() => api.cases(currentFilters()));
    clear(tableBody);
    if (!rows?.length) {
      tableBody.append(h('tr', null, h('td', { colspan: 6, class: 'empty-state' }, t('casesEmpty'))));
      return;
    }
    // Alimente le filtre avocat à partir des dossiers visibles.
    const seen = new Map();
    for (const c of rows) if (c.lawyerId && !seen.has(c.lawyerId)) seen.set(c.lawyerId, c.lawyerName);
    const keep = fLawyer.value;
    clear(fLawyer).append(h('option', { value: '' }, t('filterAllLawyers')),
      ...[...seen.entries()].map(([id, name]) => h('option', { value: id, selected: String(id) === keep }, name ?? t('filterUnassigned'))));
    for (const c of rows) {
      tableBody.append(
        h(
          'tr',
          { class: 'row-link', tabindex: '0', onclick: () => (location.hash = `#/cases/${c.id}`) },
          h('td', null, h('span', { class: 'mono' }, c.caseNumber)),
          h('td', null, h('strong', null, c.title)),
          h('td', null, c.clientName ?? '—'),
          h('td', null, c.lawyerName ?? '—'),
          h('td', null, statusDot(c.status, CASE_STATUS())),
          h('td', null, CASE_PRIORITY()[c.priority] ?? c.priority),
        ),
      );
    }
  }

  const chips = h(
    'div',
    { class: 'chips' },
    h('button', { class: 'chip is-active', type: 'button', onclick: (e) => selectChip(e, '') }, t('all')),
    ...Object.entries(CASE_STATUS()).map(([v, l]) => h('button', { class: 'chip', type: 'button', onclick: (e) => selectChip(e, v) }, l)),
  );
  function selectChip(e, value) {
    statusFilter = value;
    for (const c of chips.children) c.classList.toggle('is-active', c === e.currentTarget);
    load();
  }

  function applyFilters(f) {
    statusFilter = f.status ?? '';
    const vals = ['', ...Object.keys(CASE_STATUS())];
    [...chips.children].forEach((chip, i) => {
      chip.classList.toggle('is-active', (vals[i] ?? '') === statusFilter);
    });
    fLawyer.value = f.lawyerId ? String(f.lawyerId) : '';
    fPriority.value = f.priority ?? '';
    fDateFrom.value = f.dateFrom ?? '';
    fDateTo.value = f.dateTo ?? '';
    load();
  }

  /* --- Filtres sauvegardés --- */
  const savedSelect = h('select', { 'aria-label': t('savedFilters') });
  async function loadSavedFilters() {
    const list = (await guarded(() => api.savedFilters())) ?? [];
    clear(savedSelect).append(
      h('option', { value: '' }, t('savedFilters')),
      ...list.map((s) => h('option', { value: s.id }, s.name)),
    );
    savedSelect._items = list;
  }
  savedSelect.addEventListener('change', () => {
    const item = (savedSelect._items ?? []).find((s) => String(s.id) === savedSelect.value);
    if (item) applyFilters(item.filters ?? {});
  });
  async function saveCurrentFilter() {
    const nameInput = h('input', { required: true, placeholder: t('filterNamePh'), maxlength: 80 });
    let closeModal;
    const form = h(
      'form',
      {
        class: 'stacked-form',
        onsubmit: async (e) => {
          e.preventDefault();
          if (!nameInput.value.trim()) return;
          const ok = await guarded(() => api.createSavedFilter({ name: nameInput.value.trim(), filters: currentFilters() }));
          if (ok) { closeModal(); toast(t('filterSaved')); loadSavedFilters(); }
        },
      },
      field(t('filterName'), nameInput),
      h('button', { class: 'btn btn-primary', type: 'submit' }, t('filterSave')),
    );
    closeModal = openModal(t('filterSaveTitle'), form);
  }
  async function deleteSavedFilter() {
    if (!savedSelect.value) return;
    if (!confirm(t('filterDeleteConfirm'))) return;
    const ok = await guarded(() => api.deleteSavedFilter(savedSelect.value));
    if (ok) { toast(t('filterDeleted')); loadSavedFilters(); }
  }

  const newBtn = perms.has('cases.create')
    ? h('button', { class: 'btn btn-primary', type: 'button', onclick: async () => {
        let closeModal;
        const form = await caseForm(null, async (body) => {
          const created = await api.createCase(body);
          closeModal();
          toast(t('caseCreated'));
          location.hash = `#/cases/${created.id}`;
        });
        closeModal = openModal(t('caseNew'), form, { wide: true });
      } }, icon('plus'), t('caseNew'))
    : null;

  clear(main).append(
    h(
      'div',
      { class: 'page' },
      h(
        'div',
        { class: 'page-head' },
        h('div', null, h('h1', { tabindex: '-1' }, t('casesTitle')),
          h('a', { class: 'link-btn', href: '#/kanban' }, t('casesKanbanView'))),
        h('div', { class: 'btn-row' }, newBtn),
      ),
      chips,
      h(
        'div',
        { class: 'filters-row panel' },
        h('label', null, h('span', null, t('filterLawyer')), fLawyer),
        h('label', null, h('span', null, t('filterPriority')), fPriority),
        h('label', null, h('span', null, t('filterDateFrom')), fDateFrom),
        h('label', null, h('span', null, t('filterDateTo')), fDateTo),
        h('button', { class: 'btn', type: 'button', onclick: () => load() }, t('filterApply')),
        h('button', { class: 'btn btn-ghost', type: 'button', onclick: () => { applyFilters({}); } }, t('filterReset')),
      ),
      h(
        'div',
        { class: 'filters-row' },
        h('label', null, h('span', null, t('savedFilters')), savedSelect),
        h('button', { class: 'btn btn-small', type: 'button', onclick: saveCurrentFilter }, t('filterSave')),
        h('button', { class: 'btn btn-small btn-ghost', type: 'button', onclick: deleteSavedFilter }, t('filterDelete')),
      ),
      h(
        'div',
        { class: 'table-wrap' },
        h('table', null, h('thead', null, h('tr', null, h('th', null, t('caseNumber')), h('th', null, t('caseTitle')), h('th', null, t('caseClient')), h('th', null, t('caseLawyer')), h('th', null, t('caseStatus')), h('th', null, t('casePriority')))), tableBody),
      ),
    ),
  );
  for (const el of [fLawyer, fPriority, fDateFrom, fDateTo]) el.addEventListener('change', load);
  await loadSavedFilters();
  await load();
  main.focus({ preventScroll: true });
}

async function viewCaseDetail(main, id) {
  const perms = new Set(currentUser.permissions);
  const c = await guarded(() => api.case(id));
  if (!c) return;

  const tabs = h('div', { class: 'tabs', role: 'tablist' });
  const panel = h('div', { class: 'tab-panel' });
  const tabDefs = [
    ['overview', t('tabOverview'), () => renderOverview()],
    perms.has('documents.read') && ['documents', t('tabDocuments'), () => renderDocuments()],
    ['notes', t('tabNotes'), () => renderNotes()],
  ].filter(Boolean);

  function setTab(key) {
    for (const btn of tabs.children) btn.setAttribute('aria-selected', String(btn.dataset.key === key));
    clear(panel);
    tabDefs.find((t) => t[0] === key)[2]();
  }
  tabs.append(...tabDefs.map(([key, label]) => h('button', { type: 'button', role: 'tab', 'data-key': key, onclick: () => setTab(key) }, label)));

  function renderOverview() {
    panel.append(
      h(
        'div',
        { class: 'grid-2' },
        h('dl', { class: 'definition-list' },
          h('dt', null, t('caseClient')), h('dd', null, h('a', { href: `#/clients/${c.clientId}` }, c.clientName)),
          h('dt', null, t('caseLawyer')), h('dd', null, c.lawyerName ?? t('unassigned')),
          h('dt', null, t('caseType')), h('dd', null, c.caseType || '—'),
          h('dt', null, t('casePriority')), h('dd', null, CASE_PRIORITY()[c.priority] ?? c.priority),
          h('dt', null, t('caseDueDate')), h('dd', null, fmtDate(c.dueDate)),
          h('dt', null, t('createdAt')), h('dd', null, fmtDate(c.createdAt)),
        ),
        h('div', null, h('h3', null, t('caseDescription')), h('p', { class: 'notes-box' }, c.description || t('caseNoDesc'))),
      ),
    );
  }

  async function renderDocuments() {
    panel.append(h('p', { class: 'loading' }, t('loading')));
    const docs = await guarded(() => api.documents(id));
    clear(panel);

    const list = h('div', { class: 'doc-list' });
    function renderList(items) {
      clear(list);
      if (!items.length) return list.append(h('p', { class: 'empty-state' }, t('docsEmpty')));
      for (const d of items) {
        list.append(
          h(
            'div',
            { class: 'doc-row' },
            icon('file'),
            h('div', { class: 'doc-info' }, h('strong', null, d.originalName), h('span', { class: 'muted' }, `v${d.version} · ${(d.sizeBytes / 1024).toFixed(0)} Ko · ${d.uploadedBy} · ${fmtDate(d.createdAt)}`)),
            h('button', { class: 'icon-btn', type: 'button', 'aria-label': t('docDownload'), onclick: () => guarded(() => downloadFile(`/documents/${d.id}/download`, d.originalName)) }, icon('download')),
            h('span', { class: `badge ${d.indexedAt ? 'badge-success' : ''}` }, d.indexedAt ? t('docIndexed') : t('docPendingAnalysis')),
            perms.has('ai.manage') && !d.indexedAt && h('button', { class: 'btn btn-small', type: 'button', onclick: async () => { try { await api.indexDocument(d.id); toast(t('docAnalyzedToast', { name: d.originalName })); renderDocuments(); } catch (err) { toast(errorMessage(err), 'error'); } } }, t('docAnalyzeNow')),
            perms.has('documents.delete') &&
              h('button', { class: 'icon-btn danger', type: 'button', 'aria-label': t('delete'), onclick: async () => {
                if (!confirm(t('docDeleteConfirm'))) return;
                await guarded(() => api.deleteDocument(d.id));
                renderList(items.filter((x) => x.id !== d.id));
                toast(t('docDeleted'));
              } }, icon('trash')),
          ),
        );
      }
    }
    renderList(docs ?? []);

    if (perms.has('documents.upload')) {
      const fileInput = h('input', { type: 'file', id: 'doc-upload', class: 'sr-only' });
      fileInput.addEventListener('change', async () => {
        const file = fileInput.files[0];
        if (!file) return;
        try {
          const uploaded = await api.uploadDocument(id, file);
          const fresh = await api.documents(id);
          renderList(fresh);
          toast(uploaded?.indexing?.status === 'ready' ? t('docUploadedReady', { name: uploaded.originalName }) : t('docUploaded', { name: uploaded.originalName }), uploaded?.indexing?.status === 'ready' ? 'success' : 'info');
        } catch (err) {
          toast(errorMessage(err), 'error');
        }
        fileInput.value = '';
      });
      panel.append(h('label', { class: 'btn btn-primary upload-btn', for: 'doc-upload' }, icon('plus'), t('docUpload')), fileInput, list);
    } else {
      panel.append(list);
    }
  }

  async function renderNotes() {
    panel.append(h('p', { class: 'loading' }, t('loading')));
    const notes = await guarded(() => api.caseNotes(id));
    clear(panel);
    const list = h('div', { class: 'note-list' });
    function renderList(items) {
      clear(list);
      if (!items.length) return list.append(h('p', { class: 'empty-state' }, t('notesEmpty')));
      for (const n of items) list.append(h('div', { class: 'note-card' }, h('p', null, n.content), h('span', { class: 'muted' }, `${n.authorName} · ${fmtDateTime(n.createdAt)}`)));
    }
    renderList(notes ?? []);

    if (perms.has('cases.update')) {
      const textarea = h('textarea', { rows: 2, placeholder: t('notePh') });
      const addForm = h(
        'form',
        { class: 'note-form', onsubmit: async (e) => {
          e.preventDefault();
          const content = textarea.value.trim();
          if (!content) return;
          const created = await guarded(() => api.addCaseNote(id, content));
          if (!created) return;
          textarea.value = '';
          const fresh = await api.caseNotes(id);
          renderList(fresh);
        } },
        textarea,
        h('button', { class: 'btn btn-primary', type: 'submit' }, t('noteAdd')),
      );
      panel.append(addForm, list);
    } else {
      panel.append(list);
    }
  }

  const statusSelect = perms.has('cases.update')
    ? h(
        'select', { class: 'status-select', onchange: async (e) => {
          await guarded(() => api.updateCase(id, { status: e.target.value }));
          toast(t('statusUpdated'));
        } },
        ...Object.entries(CASE_STATUS()).map(([v, l]) => h('option', { value: v, selected: c.status === v }, l)),
      )
    : statusDot(c.status, CASE_STATUS());

  clear(main).append(
    h(
      'div',
      { class: 'page' },
      h('a', { class: 'back-link', href: '#/cases' }, icon('chevronLeft'), 'Dossiers'),
      h(
        'div',
        { class: 'page-head' },
        h('div', null, h('span', { class: 'mono muted' }, c.caseNumber), h('h1', { tabindex: '-1' }, c.title)),
        h('div', { class: 'page-actions' }, statusSelect, perms.has('cases.update') && h('button', { class: 'btn', type: 'button', onclick: async () => {
          const form = await caseForm(c, async (body) => { await api.updateCase(id, body); close(); toast(t('caseUpdated')); viewCaseDetail(main, id); });
          const close = openModal(t('caseEdit'), form, { wide: true });
        } }, t('edit')), perms.has('cases.update') && h('button', { class: 'btn btn-secondary', type: 'button', onclick: () => openShareCaseModal(c) }, icon('share'), t('caseShare'))),
      ),
      tabs,
      panel,
      perms.has('messages.read') ? h('section', { class: 'panel', id: 'case-discussions' }) : null,
    ),
  );
  setTab('overview');
  if (perms.has('messages.read')) loadCaseDiscussions(id);
  main.focus({ preventScroll: true });
}

/** Modale de partage d'un dossier avec un autre avocat. */
async function openShareCaseModal(c) {
  const list = h('div', { class: 'share-list' });
  const select = h('select');
  const errorBox = h('p', { class: 'form-error', hidden: true });

  async function reload() {
    const shares = await guarded(() => api.caseShares(c.id));
    clear(list);
    if (!shares?.length) {
      list.append(h('p', { class: 'empty-state' }, t('caseShareEmpty')));
    } else {
      for (const s of shares) {
        list.append(h('div', { class: 'share-row' },
          userAvatar({ firstName: s.lawyerName.split(' ')[0], lastName: s.lawyerName.split(' ').slice(1).join(' '), avatarUrl: null }, 'avatar avatar-xs'),
          h('div', { class: 'share-info' }, h('strong', null, s.lawyerName), h('span', { class: 'muted' }, s.lawyerEmail)),
          h('button', { class: 'icon-btn danger', type: 'button', 'aria-label': t('caseUnshare'), title: t('caseUnshare'), onclick: async () => {
            if (!confirm(t('caseUnshareConfirm'))) return;
            await guarded(() => api.unshareCase(c.id, s.lawyerId));
            toast(t('caseUnshared'));
            reload();
          } }, icon('close')),
        ));
      }
    }
    // Candidats : avocats actifs non déjà partagés et non responsables.
    const users = await guarded(() => api.lawyers()) ?? [];
    clear(select);
    const candidates = users.filter((u) => u.role === 'LAWYER' && u.isActive && u.id !== c.lawyerId && !(shares || []).some((s) => s.lawyerId === u.id));
    if (!candidates.length) select.append(h('option', { value: '' }, t('caseShareNoCandidate')));
    else {
      select.append(h('option', { value: '' }, t('caseShareChoose')));
      for (const u of candidates) select.append(h('option', { value: u.id }, `${u.firstName} ${u.lastName} (${u.email})`));
    }
  }

  const form = h('form', { class: 'stacked-form', onsubmit: async (e) => {
    e.preventDefault();
    errorBox.hidden = true;
    if (!select.value) return;
    try {
      await api.shareCase(c.id, Number(select.value));
      toast(t('caseShared'));
      reload();
    } catch (err) { errorBox.textContent = errorMessage(err); errorBox.hidden = false; }
  } },
    h('h3', null, t('caseShareWith')),
    list,
    field(t('caseShareLawyer'), select),
    errorBox,
    h('button', { class: 'btn btn-primary', type: 'submit' }, t('caseShareAdd')),
  );
  openModal(t('caseShare'), form);
  reload();
}

async function loadCaseDiscussions(caseId) {
  const section = document.getElementById('case-discussions');
  if (!section) return;
  let convs = [];
  try { convs = await api.conversations(caseId); } catch { /* silencieux */ }
  clear(section).append(
    h('h2', null, t('msgDiscussions')),
    convs.length
      ? h('div', { class: 'msg-member-pick' }, ...convs.map((c) =>
          h('div', { class: 'msg-member-row' },
            h('span', null, h('strong', null, c.name), h('span', { class: 'muted' }, ` · ${(c.members || []).length} ${t('msgGroupMembers')}`)),
            h('button', { class: 'btn btn-secondary btn-small', type: 'button', onclick: () => {
              pendingConvOpen = c.id;
              if (location.hash === '#/messages') route();
              else location.hash = '#/messages';
            } }, t('msgOpenChat')))))
      : h('p', { class: 'muted' }, t('msgNoMessages')),
  );
}

/* ------------------------------------------------------------------ */
/* Kanban des dossiers                                                 */
/* ------------------------------------------------------------------ */

/** Date locale AAAA-MM-JJ (sans décalage UTC). */
const dayStr = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

async function viewKanban(main) {
  const perms = new Set(currentUser.permissions);
  const canUpdate = perms.has('cases.update');
  const board = h('div', { class: 'kanban' });
  const todayStr = dayStr(new Date());

  async function load() {
    const rows = await guarded(() => api.cases());
    if (!rows) return;
    clear(board);
    for (const [status, label] of Object.entries(CASE_STATUS())) {
      const cards = rows.filter((c) => c.status === status);
      const list = h('div', { class: 'kanban-cards', 'data-status': status });
      for (const c of cards) {
        const card = h(
          'div',
          {
            class: 'kanban-card', tabindex: '0', role: 'link',
            draggable: canUpdate ? 'true' : 'false', 'data-id': String(c.id),
            onclick: () => { location.hash = `#/cases/${c.id}`; },
            onkeydown: (e) => { if (e.key === 'Enter') location.hash = `#/cases/${c.id}`; },
          },
          h('strong', null, c.title),
          h('div', { class: 'muted' }, h('span', { class: 'mono' }, c.caseNumber)),
          h('div', { class: 'kanban-meta' },
            h('span', null, c.clientName ?? '—'),
            c.dueDate ? h('span', { class: c.dueDate < todayStr ? 'overdue' : 'muted' }, fmtDate(c.dueDate)) : null),
        );
        if (canUpdate) {
          card.addEventListener('dragstart', (e) => {
            e.dataTransfer.setData('text/plain', String(c.id));
            e.dataTransfer.effectAllowed = 'move';
            card.classList.add('dragging');
          });
          card.addEventListener('dragend', () => card.classList.remove('dragging'));
        }
        list.append(card);
      }
      const col = h(
        'div',
        { class: 'kanban-col' },
        h('div', { class: 'kanban-col-head' }, h('span', null, label), h('span', { class: 'kanban-count' }, String(cards.length))),
        list,
      );
      if (canUpdate) {
        list.addEventListener('dragover', (e) => { e.preventDefault(); list.classList.add('drag-over'); });
        list.addEventListener('dragleave', () => list.classList.remove('drag-over'));
        list.addEventListener('drop', async (e) => {
          e.preventDefault();
          list.classList.remove('drag-over');
          const id = e.dataTransfer.getData('text/plain');
          if (!id) return;
          const ok = await guarded(() => api.updateCase(Number(id), { status }));
          if (ok) {
            toast(t('kanbanMoved'));
            load();
          }
        });
      }
      board.append(col);
    }
  }

  clear(main).append(
    h(
      'div',
      { class: 'page' },
      h(
        'div',
        { class: 'page-head' },
        h('div', null, h('h1', { tabindex: '-1' }, t('kanbanTitle')), h('p', { class: 'muted' }, canUpdate ? t('kanbanSubtitle') : t('kanbanSubtitleReadonly'))),
        h('a', { class: 'btn', href: '#/cases' }, t('kanbanListView')),
      ),
      board,
    ),
  );
  await load();
  main.focus({ preventScroll: true });
}

/* ------------------------------------------------------------------ */
/* Calendrier des échéances                                            */
/* ------------------------------------------------------------------ */

async function viewCalendar(main) {
  const cursor = new Date();
  cursor.setDate(1);
  const titleEl = h('h2', { class: 'cal-title' });
  const grid = h('div', { class: 'cal-grid' });
  const weekdays = h('div', { class: 'cal-weekdays' }, ...t('calWeekdays').map((d) => h('span', null, d)));

  async function load() {
    const y = cursor.getFullYear();
    const m = cursor.getMonth();
    titleEl.textContent = new Date(y, m, 1).toLocaleDateString(fmtLocale(), { month: 'long', year: 'numeric' });
    const startOffset = (new Date(y, m, 1).getDay() + 6) % 7; // lundi = 0
    const start = new Date(y, m, 1 - startOffset);
    const lastDay = new Date(y, m + 1, 0);
    const endOffset = 6 - ((lastDay.getDay() + 6) % 7);
    const finish = new Date(y, m, 1 + lastDay.getDate() + endOffset - 1);
    const events = await guarded(() => api.calendar(dayStr(start), dayStr(finish)));
    if (!events) return;
    const byDate = {};
    for (const e of events) (byDate[e.dueDate] ??= []).push(e);
    const todayStr = dayStr(new Date());
    clear(grid);
    for (let d = new Date(start); d <= finish; d.setDate(d.getDate() + 1)) {
      const ds = dayStr(d);
      const dayEvents = byDate[ds] ?? [];
      const cell = h(
        'div',
        { class: `cal-day${d.getMonth() !== m ? ' cal-out' : ''}${ds === todayStr ? ' cal-today' : ''}` },
        h('span', { class: 'cal-num' }, String(d.getDate())),
        ...dayEvents.slice(0, 3).map((e) => h(
          'button',
          {
            class: `cal-event${e.type === 'invoice' ? ' cal-invoice' : ' cal-case'}${e.overdue ? ' cal-overdue' : ''}`,
            type: 'button', title: e.title,
            onclick: () => { location.hash = e.type === 'case' ? `#/cases/${e.id}` : '#/invoices'; },
          },
          e.title,
        )),
        dayEvents.length > 3 ? h('span', { class: 'cal-more' }, `+${dayEvents.length - 3}`) : null,
      );
      grid.append(cell);
    }
  }

  const prevBtn = h('button', { class: 'btn', type: 'button', 'aria-label': t('calPrev'), onclick: () => { cursor.setMonth(cursor.getMonth() - 1); load(); } }, '‹');
  const nextBtn = h('button', { class: 'btn', type: 'button', 'aria-label': t('calNext'), onclick: () => { cursor.setMonth(cursor.getMonth() + 1); load(); } }, '›');
  const todayBtn = h('button', { class: 'btn', type: 'button', onclick: () => { const n = new Date(); cursor.setFullYear(n.getFullYear(), n.getMonth(), 1); load(); } }, t('calToday'));

  clear(main).append(
    h(
      'div',
      { class: 'page' },
      h(
        'div',
        { class: 'page-head' },
        h('div', null, h('h1', { tabindex: '-1' }, t('calTitle')), h('p', { class: 'muted' }, t('calSubtitle'))),
        h('div', { class: 'cal-nav' }, prevBtn, todayBtn, nextBtn),
      ),
      h('div', { class: 'panel cal-panel' },
        titleEl,
        weekdays,
        grid,
        h('div', { class: 'cal-legend' },
          h('span', null, h('span', { class: 'cal-chip cal-case' }), t('calLegendCase')),
          h('span', null, h('span', { class: 'cal-chip cal-invoice' }), t('calLegendInvoice')),
          h('span', null, h('span', { class: 'cal-chip cal-overdue' }), t('calLegendOverdue'))),
      ),
    ),
  );
  await load();
  main.focus({ preventScroll: true });
}

/* ------------------------------------------------------------------ */
/* Suivi du temps (timesheet)                                          */
/* ------------------------------------------------------------------ */

function downloadText(filename, text, mime = 'text/plain;charset=utf-8') {
  const blob = new Blob([text], { type: mime });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}

async function viewTime(main) {
  const perms = new Set(currentUser.permissions);
  const canCreate = perms.has('time.create');
  const canUpdate = perms.has('time.update');
  const canDelete = perms.has('time.delete');
  const canBill = perms.has('billing.create');

  const cases = (await guarded(() => api.cases())) ?? [];
  const caseOptions = (sel) => [
    h('option', { value: '' }, t('timeAllCases')),
    ...cases.map((c) => h('option', { value: c.id, selected: sel === String(c.id) }, `${c.caseNumber} — ${c.title}`)),
  ];

  /* --- Formulaire de saisie --- */
  let formSection = null;
  if (canCreate) {
    const f = {
      caseId: h('select', { required: true }, h('option', { value: '' }, t('timeSelectCase')), ...cases.map((c) => h('option', { value: c.id }, `${c.caseNumber} — ${c.title}`))),
      date: h('input', { type: 'date', required: true, value: dayStr(new Date()) }),
      hours: h('input', { type: 'number', min: '0.25', max: '24', step: '0.25', required: true, placeholder: '2.5' }),
      rate: h('input', { type: 'number', min: '0', step: '0.01', placeholder: '150.00' }),
      description: h('input', { placeholder: t('timeDescriptionPh') }),
    };
    const form = h(
      'form',
      {
        class: 'inline-form',
        onsubmit: async (e) => {
          e.preventDefault();
          const ok = await guarded(() => api.createTimeEntry({
            caseId: Number(f.caseId.value),
            date: f.date.value,
            hours: Number(f.hours.value),
            rate: f.rate.value ? Number(f.rate.value) : 0,
            description: f.description.value.trim() || undefined,
          }));
          if (ok) {
            toast(t('timeLogged'));
            f.hours.value = '';
            f.description.value = '';
            loadList();
          }
        },
      },
      field(t('timeCase'), f.caseId),
      field(t('timeDate'), f.date),
      field(t('timeHours'), f.hours),
      field(t('timeRate'), f.rate),
      field(t('timeDescription'), f.description),
      h('button', { class: 'btn btn-primary', type: 'submit' }, t('timeSave')),
    );
    formSection = h('section', { class: 'panel' }, h('h2', null, t('timeLogTitle')), form);
  }

  /* --- Minuteurs (démarrer / arrêter, enregistrement automatique) --- */
  let timerSection = null;
  const store = timerStore(localStorage);
  if (canCreate) {
    const rowsBox = h('div', { class: 'timer-rows' });
    const rows = [];

    const runningCaseIds = () => new Set(rows.filter((r) => r.startedAt).map((r) => String(r.sel.value)));

    function refreshTimerUI() {
      const running = runningCaseIds();
      for (const r of rows) {
        const mine = r.startedAt ? String(r.sel.value) : null;
        for (const opt of r.sel.options) {
          if (!opt.value) { opt.disabled = false; continue; }
          opt.disabled = running.has(opt.value) && opt.value !== mine;
        }
      }
    }

    function tickAll() {
      const now = Date.now();
      for (const r of rows) {
        if (r.startedAt) r.elapsedEl.textContent = fmtElapsed(Math.floor((now - r.startedAt) / 1000));
      }
    }

    function resetRow(r) {
      r.startedAt = null;
      r.sel.disabled = false;
      r.sel.value = '';
      r.elapsedEl.textContent = fmtElapsed(0);
      r.toggleBtn.textContent = t('timeTimerStart');
      r.toggleBtn.classList.remove('danger');
    }

    async function stopRow(r) {
      const caseId = String(r.sel.value);
      const now = Date.now();
      const secs = Math.floor((now - r.startedAt) / 1000);
      const hours = timerHours(r.startedAt, now);
      r.startedAt = null;
      store.remove(caseId);
      if (secs < 30) {
        toast(t('timeTimerTooShort'), 'error');
      } else {
        const ok = await guarded(() => api.createTimeEntry({
          caseId: Number(caseId),
          date: dayStr(new Date()),
          hours,
          description: t('timeTimerDesc'),
        }));
        if (ok) { toast(t('timeTimerSaved')); loadList(); }
      }
      resetRow(r);
      refreshTimerUI();
    }

    function startRow(r) {
      if (!r.sel.value) { toast(t('timeTimerPickCase'), 'error'); return; }
      if (runningCaseIds().has(String(r.sel.value))) { toast(t('timeTimerAlreadyRunning'), 'error'); return; }
      r.startedAt = Date.now();
      store.add(r.sel.value, r.startedAt);
      r.sel.disabled = true;
      r.toggleBtn.textContent = t('timeTimerStop');
      r.toggleBtn.classList.add('danger');
      tickAll();
      refreshTimerUI();
    }

    function removeRow(r) {
      if (r.startedAt && !confirm(t('timeTimerRemoveConfirm'))) return;
      if (r.startedAt) store.remove(String(r.sel.value));
      rows.splice(rows.indexOf(r), 1);
      r.row.remove();
      refreshTimerUI();
    }

    function addTimerRow(stored) {
      const r = {};
      r.sel = h(
        'select',
        { 'aria-label': t('timeCase'), onchange: refreshTimerUI },
        h('option', { value: '' }, t('timeSelectCase')),
        ...cases.map((c) => h('option', { value: c.id }, `${c.caseNumber} — ${c.title}`)),
      );
      r.elapsedEl = h('span', { class: 'timer-elapsed mono' }, fmtElapsed(0));
      r.toggleBtn = h('button', { class: 'btn btn-small btn-primary', type: 'button', onclick: () => (r.startedAt ? stopRow(r) : startRow(r)) }, t('timeTimerStart'));
      r.removeBtn = h('button', { class: 'icon-btn danger', type: 'button', 'aria-label': t('timeTimerRemove'), title: t('timeTimerRemove'), onclick: () => removeRow(r) }, '×');
      r.row = h('div', { class: 'timer-row' }, r.sel, r.elapsedEl, r.toggleBtn, r.removeBtn);
      r.startedAt = null;
      rows.push(r);
      rowsBox.append(r.row);
      if (stored) {
        r.sel.value = String(stored.caseId);
        r.startedAt = stored.startedAt;
        r.sel.disabled = true;
        r.toggleBtn.textContent = t('timeTimerStop');
        r.toggleBtn.classList.add('danger');
        tickAll();
      }
      refreshTimerUI();
      return r;
    }

    timerSection = h(
      'section',
      { class: 'panel' },
      h('h2', null, t('timeTimersTitle')),
      rowsBox,
      h('button', { class: 'btn btn-small', type: 'button', onclick: () => addTimerRow(null) }, `+ ${t('timeTimerAdd')}`),
    );

    // Restaure les minuteurs en cours (même dossier encore présent dans la liste).
    const valid = store.read().filter((s) => cases.some((c) => String(c.id) === String(s.caseId)));
    if (valid.length) valid.forEach((s) => addTimerRow(s));
    else addTimerRow(null);

    clearTimerTick();
    timerTickId = setInterval(tickAll, 1000);
  }

  /* --- Liste + filtres --- */
  const filterCase = h('select', { onchange: () => loadList() }, ...caseOptions(''));
  const filterUnbilled = h('input', { type: 'checkbox', id: 'unbilled-only', onchange: () => loadList() });
  const tableBody = h('tbody');

  function entryRow(e) {
    const actions = [];
    if (canUpdate) {
      actions.push(h('button', { class: 'btn btn-small', type: 'button', onclick: () => openTimeEditModal(e) }, t('edit')));
    }
    if (canDelete) {
      actions.push(h('button', { class: 'btn btn-small danger', type: 'button', onclick: async () => {
        if (!confirm(t('timeDeleteConfirm'))) return;
        const ok = await guarded(() => api.deleteTimeEntry(e.id));
        if (ok) { toast(t('timeEntryDeleted')); loadList(); }
      } }, t('delete')));
    }
    return h(
      'tr',
      null,
      h('td', null, fmtDate(e.date)),
      h('td', null, h('a', { href: `#/cases/${e.caseId}` }, e.caseNumber ?? ''), h('div', { class: 'muted' }, e.caseTitle ?? '')),
      h('td', null, e.description ?? '—'),
      h('td', null, e.userName ?? '—'),
      h('td', { class: 'num' }, e.hours.toFixed(2)),
      h('td', { class: 'num' }, fmtMoney(e.amountCents)),
      h('td', null, e.invoiceId ? h('span', { class: 'badge' }, t('timeBilled')) : h('span', { class: 'badge badge-warn' }, t('timeUnbilled'))),
      actions.length ? h('td', { class: 'row-actions' }, ...actions) : null,
    );
  }

  async function loadList() {
    const params = {};
    if (filterCase.value) params.caseId = filterCase.value;
    if (filterUnbilled.checked) params.unbilled = '1';
    const rows = await guarded(() => api.timeEntries(params));
    clear(tableBody);
    if (!rows?.length) {
      tableBody.append(h('tr', null, h('td', { colspan: 8, class: 'empty-state' }, t('timeNoEntries'))));
      return;
    }
    let totalH = 0;
    let totalC = 0;
    for (const e of rows) {
      totalH += e.hours;
      totalC += e.amountCents;
      tableBody.append(entryRow(e));
    }
    tableBody.append(h(
      'tr',
      { class: 'total-row' },
      h('td', { colspan: 4 }, h('strong', null, t('timeTotal'))),
      h('td', { class: 'num' }, h('strong', null, totalH.toFixed(2))),
      h('td', { class: 'num' }, h('strong', null, fmtMoney(totalC))),
      h('td', { colspan: 2 }),
    ));
  }

  async function openTimeEditModal(e) {
    const f = {
      date: h('input', { type: 'date', required: true, value: e.date }),
      hours: h('input', { type: 'number', min: '0.25', max: '24', step: '0.25', required: true, value: String(e.hours) }),
      rate: h('input', { type: 'number', min: '0', step: '0.01', value: String(e.rate) }),
      description: h('input', { value: e.description ?? '' }),
    };
    let closeModal;
    const form = h(
      'form',
      {
        class: 'stacked-form',
        onsubmit: async (ev) => {
          ev.preventDefault();
          const ok = await guarded(() => api.updateTimeEntry(e.id, {
            date: f.date.value,
            hours: Number(f.hours.value),
            rate: f.rate.value ? Number(f.rate.value) : 0,
            description: f.description.value.trim() || null,
          }));
          if (ok) { closeModal(); toast(t('timeEntryUpdated')); loadList(); }
        },
      },
      field(t('timeDate'), f.date),
      field(t('timeHours'), f.hours),
      field(t('timeRate'), f.rate),
      field(t('timeDescription'), f.description),
      h('button', { class: 'btn btn-primary', type: 'submit' }, t('save')),
    );
    closeModal = openModal(t('timeEditEntry'), form);
  }

  /* --- Totaux par dossier + facturation --- */
  const totalsCase = h('select', ...caseOptions(''));
  const totalsBox = h('div', { class: 'time-totals' });
  async function loadTotals() {
    clear(totalsBox);
    if (!totalsCase.value) return;
    const tot = await guarded(() => api.caseTimeTotals(totalsCase.value));
    if (!tot) return;
    totalsBox.append(
      h('div', { class: 'kpi-grid' },
        h('div', { class: 'kpi' }, h('div', { class: 'kpi-text' }, h('div', { class: 'kpi-value' }, tot.totalHours.toFixed(2)), h('div', { class: 'kpi-label' }, t('timeTotalHours')))),
        h('div', { class: 'kpi' }, h('div', { class: 'kpi-text' }, h('div', { class: 'kpi-value' }, fmtMoney(tot.totalCents)), h('div', { class: 'kpi-label' }, t('timeTotalAmount')))),
        h('div', { class: 'kpi' }, h('div', { class: 'kpi-text' }, h('div', { class: 'kpi-value' }, tot.unbilledHours.toFixed(2)), h('div', { class: 'kpi-label' }, t('timeUnbilledHours')))),
        h('div', { class: 'kpi' }, h('div', { class: 'kpi-text' }, h('div', { class: 'kpi-value' }, fmtMoney(tot.unbilledCents)), h('div', { class: 'kpi-label' }, t('timeUnbilledAmount')))),
      ),
    );
    if (canBill && tot.unbilledCents > 0) {
      totalsBox.append(h(
        'button',
        {
          class: 'btn btn-primary', type: 'button',
          onclick: async () => {
            const entries = (await guarded(() => api.timeEntries({ caseId: totalsCase.value, unbilled: '1' }))) ?? [];
            if (!entries.length) return;
            const due = new Date();
            due.setDate(due.getDate() + 30);
            const inv = await guarded(() => api.createInvoice({
              clientId: entries[0].clientId,
              caseId: Number(totalsCase.value),
              amountCents: tot.unbilledCents,
              taxCents: 0,
              dueAt: dayStr(due),
            }));
            if (!inv) return;
            for (const en of entries) {
              await guarded(() => api.updateTimeEntry(en.id, { invoiceId: inv.id }));
            }
            toast(t('timeInvoiceCreated'));
            loadList();
            loadTotals();
          },
        },
        t('timeCreateInvoice'),
      ));
    }
  }
  totalsCase.addEventListener('change', loadTotals);

  clear(main).append(
    h(
      'div',
      { class: 'page' },
      h('div', { class: 'page-head' }, h('div', null, h('h1', { tabindex: '-1' }, t('timeTitle')), h('p', { class: 'muted' }, t('timeSubtitle')))),
      formSection,
      timerSection,
      h(
        'section',
        { class: 'panel' },
        h('h2', null, t('timeEntriesTitle')),
        h('div', { class: 'filters-row' },
          h('label', null, h('span', null, t('timeFilterCase')), filterCase),
          h('label', { class: 'check-label' }, filterUnbilled, h('span', null, t('timeUnbilledOnly')))),
        h('div', { class: 'table-wrap' },
          h('table', null,
            h('thead', null, h('tr', null,
              h('th', null, t('timeDate')), h('th', null, t('timeCase')), h('th', null, t('timeDescription')),
              h('th', null, t('timeUser')), h('th', { class: 'num' }, t('timeHours')), h('th', { class: 'num' }, t('timeAmount')),
              h('th', null, t('timeStatus')), (canUpdate || canDelete) ? h('th', null, t('timeActions')) : null)),
            tableBody)),
      ),
      h('section', { class: 'panel' }, h('h2', null, t('timeTotalsTitle')), h('div', { class: 'filters-row' }, h('label', null, h('span', null, t('timeCase')), totalsCase)), totalsBox),
    ),
  );
  await loadList();
  main.focus({ preventScroll: true });
}

/* ------------------------------------------------------------------ */
/* Modèles de documents                                                */
/* ------------------------------------------------------------------ */

const TEMPLATE_VARS = ['client_nom', 'dossier_numero', 'date', 'avocat_nom'];

async function viewTemplates(main) {
  const perms = new Set(currentUser.permissions);
  const canCreate = perms.has('templates.create');
  const canUpdate = perms.has('templates.update');
  const canDelete = perms.has('templates.delete');
  const tableBody = h('tbody');

  function varHint() {
    return h('p', { class: 'muted form-hint' }, `${t('tplVariablesHint')} : ${TEMPLATE_VARS.map((v) => `{{${v}}}`).join(' · ')}`);
  }

  function editorForm(existing, onDone) {
    const f = {
      name: h('input', { required: true, value: existing?.name ?? '', placeholder: t('tplNamePh') }),
      category: h('input', { value: existing?.category ?? '', placeholder: t('tplCategoryPh') }),
      content: h('textarea', { rows: 14, required: true, class: 'mono-area', placeholder: t('tplContentPh') }, existing?.content ?? ''),
    };
    return h(
      'form',
      {
        class: 'stacked-form',
        onsubmit: async (e) => {
          e.preventDefault();
          const body = { name: f.name.value.trim(), category: f.category.value.trim() || undefined, content: f.content.value };
          const ok = await guarded(() => (existing ? api.updateTemplate(existing.id, body) : api.createTemplate(body)));
          if (ok) {
            toast(existing ? t('tplUpdated') : t('tplCreated'));
            onDone();
          }
        },
      },
      field(t('tplName'), f.name),
      field(t('tplCategory'), f.category),
      field(t('tplContent'), f.content),
      varHint(),
      h('button', { class: 'btn btn-primary', type: 'submit' }, existing ? t('save') : t('tplCreate')),
    );
  }

  function openTemplateEditor(existing, onDone) {
    let closeModal;
    const form = editorForm(existing, () => { closeModal(); onDone(); });
    closeModal = openModal(existing ? t('tplEdit') : t('tplNew'), form, { wide: true });
  }

  function openGenerateModal(tpl) {
    const today = dayStr(new Date());
    const f = {
      client_nom: h('input', { placeholder: t('tplVarClientPh') }),
      dossier_numero: h('input', { placeholder: t('tplVarCasePh') }),
      date: h('input', { type: 'date', value: today }),
      avocat_nom: h('input', { value: `${currentUser.firstName} ${currentUser.lastName}` }),
    };
    const preview = h('pre', { class: 'tpl-preview' }, t('tplPreviewEmpty'));
    async function refresh() {
      const vars = {
        client_nom: f.client_nom.value.trim(),
        dossier_numero: f.dossier_numero.value.trim(),
        date: f.date.value ? fmtDate(f.date.value) : '',
        avocat_nom: f.avocat_nom.value.trim(),
      };
      const r = await guarded(() => api.renderTemplate(tpl.id, vars));
      if (r) preview.textContent = r.rendered;
    }
    const form = h(
      'div',
      { class: 'stacked-form' },
      field(t('tplVarClient'), f.client_nom),
      field(t('tplVarCase'), f.dossier_numero),
      field(t('tplVarDate'), f.date),
      field(t('tplVarLawyer'), f.avocat_nom),
      h('div', { class: 'btn-row' },
        h('button', { class: 'btn', type: 'button', onclick: refresh }, t('tplRefreshPreview')),
        h('button', { class: 'btn', type: 'button', onclick: async () => { await refresh(); downloadText(`${tpl.name}.txt`, preview.textContent); } }, t('tplDownloadTxt')),
        h('button', { class: 'btn', type: 'button', onclick: async () => { await refresh(); downloadText(`${tpl.name}.md`, preview.textContent, 'text/markdown;charset=utf-8'); } }, t('tplDownloadMd'))),
      h('h3', null, t('tplPreview')),
      preview,
    );
    openModal(t('tplGenerateTitle', { name: tpl.name }), form, { wide: true });
    refresh();
  }

  async function load() {
    const rows = await guarded(() => api.templates());
    clear(tableBody);
    if (!rows?.length) {
      tableBody.append(h('tr', null, h('td', { colspan: 5, class: 'empty-state' }, t('tplNoTemplates'))));
      return;
    }
    for (const tplItem of rows) {
      const actions = [h('button', { class: 'btn btn-small btn-primary', type: 'button', onclick: () => openGenerateModal(tplItem) }, t('tplGenerate'))];
      if (canUpdate) actions.push(h('button', { class: 'btn btn-small', type: 'button', onclick: () => openTemplateEditor(tplItem, load) }, t('edit')));
      if (canDelete) actions.push(h('button', { class: 'btn btn-small danger', type: 'button', onclick: async () => {
        if (!confirm(t('tplDeleteConfirm'))) return;
        const ok = await guarded(() => api.deleteTemplate(tplItem.id));
        if (ok) { toast(t('tplDeleted')); load(); }
      } }, t('delete')));
      tableBody.append(h(
        'tr',
        null,
        h('td', null, h('strong', null, tplItem.name)),
        h('td', null, tplItem.category ?? '—'),
        h('td', { class: 'muted' }, tplItem.authorName ?? '—'),
        h('td', { class: 'muted' }, fmtDate(tplItem.updatedAt)),
        h('td', { class: 'row-actions' }, ...actions),
      ));
    }
  }

  const newBtn = canCreate
    ? h('button', { class: 'btn btn-primary', type: 'button', onclick: () => openTemplateEditor(null, load) }, icon('plus'), t('tplNew'))
    : null;

  clear(main).append(
    h(
      'div',
      { class: 'page' },
      h('div', { class: 'page-head' }, h('div', null, h('h1', { tabindex: '-1' }, t('tplTitle')), h('p', { class: 'muted' }, t('tplSubtitle'))), newBtn),
      h('div', { class: 'table-wrap' },
        h('table', null,
          h('thead', null, h('tr', null, h('th', null, t('tplName')), h('th', null, t('tplCategory')), h('th', null, t('tplAuthor')), h('th', null, t('tplUpdatedAt')), h('th', null, t('timeActions')))),
          tableBody)),
    ),
  );
  await load();
  main.focus({ preventScroll: true });
}

/* ------------------------------------------------------------------ */
/* Facturation                                                         */
/* ------------------------------------------------------------------ */

async function viewInvoices(main) {
  const perms = new Set(currentUser.permissions);
  const tableBody = h('tbody');

  async function load() {
    const rows = await guarded(() => api.invoices());
    clear(tableBody);
    if (!rows?.length) {
      tableBody.append(h('tr', null, h('td', { colspan: 6, class: 'empty-state' }, t('invoicesEmpty'))));
      return;
    }
    for (const i of rows) {
      tableBody.append(
        h(
          'tr',
          null,
          h('td', null, h('span', { class: 'mono' }, i.invoiceNumber)),
          h('td', null, i.clientName ?? '—'),
          h('td', null, i.caseTitle ?? '—'),
          h('td', null, fmtMoney(i.totalCents)),
          h('td', null, perms.has('billing.update')
            ? h('select', { onchange: async (e) => { await guarded(() => api.setInvoiceStatus(i.id, e.target.value)); toast(t('statusUpdated')); load(); } },
                ...Object.entries(INVOICE_STATUS()).map(([v, l]) => h('option', { value: v, selected: i.status === v }, l)))
            : statusDot(i.status, INVOICE_STATUS())),
          h('td', null, h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Voir le PDF', onclick: () => guarded(() => openFile(`/invoices/${i.id}/pdf`)) }, icon('file'))),
        ),
      );
    }
  }

  const newBtn = perms.has('billing.create')
    ? h('button', { class: 'btn btn-primary', type: 'button', onclick: async () => {
        const clients = await guarded(() => api.clients());
        const cases = await guarded(() => api.cases());
        const f = {
          clientId: h('select', { required: true }, h('option', { value: '' }, t('selectPlaceholder')), ...(clients ?? []).map((c) => h('option', { value: c.id }, `${c.firstName} ${c.lastName}`))),
          caseId: h('select', null, h('option', { value: '' }, t('none')), ...(cases ?? []).map((c) => h('option', { value: c.id }, c.title))),
          amount: h('input', { type: 'number', min: '0', step: '0.01', required: true, placeholder: '0.00' }),
          tax: h('input', { type: 'number', min: '0', step: '0.01', placeholder: '0.00' }),
          dueAt: h('input', { type: 'date' }),
        };
        const errorBox = h('p', { class: 'form-error', hidden: true });
        const form = h(
          'form', { class: 'stacked-form', onsubmit: async (e) => {
            e.preventDefault();
            errorBox.hidden = true;
            try {
              await api.createInvoice({
                clientId: Number(f.clientId.value),
                caseId: f.caseId.value ? Number(f.caseId.value) : null,
                amountCents: Math.round(Number(f.amount.value) * 100),
                taxCents: Math.round(Number(f.tax.value || 0) * 100),
                dueAt: f.dueAt.value || null,
              });
              close();
              toast(t('invCreated'));
              load();
            } catch (err) {
              errorBox.textContent = errorMessage(err);
              errorBox.hidden = false;
            }
          } },
          field(t('invClient'), f.clientId), field(t('invCaseOpt'), f.caseId),
          h('div', { class: 'form-row' }, field(t('invAmount'), f.amount), field(t('invTax'), f.tax)),
          field(t('invDueDate'), f.dueAt),
          errorBox,
          h('button', { class: 'btn btn-primary', type: 'submit' }, t('invCreate')),
        );
        const close = openModal(t('invNew'), form);
      } }, icon('plus'), t('invNew'))
    : null;

  clear(main).append(
    h(
      'div',
      { class: 'page' },
      h('div', { class: 'page-head' }, h('h1', { tabindex: '-1' }, t('invoicesTitle')), newBtn),
      h(
        'div',
        { class: 'table-wrap' },
        h('table', null, h('thead', null, h('tr', null, h('th', null, t('invNumber')), h('th', null, t('invClient')), h('th', null, t('invCase')), h('th', { class: 'num' }, t('invTotal')), h('th', null, t('invStatus')), h('th', null, 'PDF'))), tableBody),
      ),
    ),
  );
  await load();
  main.focus({ preventScroll: true });
}

/* ------------------------------------------------------------------ */
/* Utilisateurs (admin)                                                */
/* ------------------------------------------------------------------ */

async function viewUsers(main) {
  const tableBody = h('tbody');
  const perms = new Set(currentUser?.permissions ?? []);
  const canDelete = perms.has('users.delete');
  const canUpdate = perms.has('users.update');

  async function load() {
    const rows = await guarded(() => api.users());
    clear(tableBody);
    for (const u of rows ?? []) {
      const actions = [];
      if (u.isActive) {
        if (canDelete) {
          actions.push(h('button', { class: 'link-btn', type: 'button', onclick: async () => {
            if (!confirm(t('userDeactivateConfirm'))) return;
            const r = await guarded(() => api.deleteUser(u.id));
            if (r !== undefined) {
              toast(t('userDeactivated'));
              load();
            }
          } }, t('userDeactivate')));
        }
      } else if (canUpdate) {
        actions.push(h('button', { class: 'link-btn', type: 'button', onclick: async () => {
          await guarded(() => api.updateUser(u.id, { isActive: true }));
          load();
        } }, t('userActivate')));
      }
      tableBody.append(
        h(
          'tr',
          null,
          h('td', null, h('strong', null, `${u.firstName} ${u.lastName}`)),
          h('td', null, u.email),
          h('td', null, ROLE_LABEL()[u.role] ?? u.role),
          h('td', null, h('span', { class: `status status-${u.isActive ? 'active' : 'inactive'}` }, h('span', { class: 'status-dot' }), u.isActive ? t('userActive') : t('userDisabled'))),
          h('td', null, ...actions),
        ),
      );
    }
  }

  const newBtn = h('button', { class: 'btn btn-primary', type: 'button', onclick: () => {
    const f = {
      firstName: h('input', { required: true }), lastName: h('input', { required: true }),
      email: h('input', { type: 'email', required: true }), password: h('input', { type: 'password', required: true, minlength: 10, 'aria-describedby': 'pwd-hint' }),
      role: h('select', null, ...['ADMIN', 'LAWYER', 'ASSISTANT', 'ACCOUNTANT', 'CLIENT'].map((r) => h('option', { value: r }, ROLE_LABEL()[r]))),
    };
    const clientSelect = h('select', { required: true });
    const clientField = h('div', { class: 'field', hidden: true }, h('span', null, t('userClientRecord')), clientSelect);
    let clientsCache = null;
    const syncClientField = async () => {
      const isClient = f.role.value === 'CLIENT';
      clientField.hidden = !isClient;
      clientSelect.required = isClient;
      if (!isClient) return;
      if (!clientsCache) {
        try {
          clientsCache = await api.clients();
        } catch {
          clientsCache = [];
        }
      }
      clientSelect.replaceChildren(
        h('option', { value: '' }, t('userClientPick')),
        ...(clientsCache ?? []).map((c) => h('option', { value: String(c.id) }, `${c.firstName} ${c.lastName}${c.company ? ` — ${c.company}` : ''}`)),
      );
    };
    f.role.addEventListener('change', syncClientField);
    const errorBox = h('p', { class: 'form-error', hidden: true });
    const form = h(
      'form', { class: 'stacked-form', onsubmit: async (e) => {
        e.preventDefault();
        errorBox.hidden = true;
        try {
          const body = { firstName: f.firstName.value.trim(), lastName: f.lastName.value.trim(), email: f.email.value.trim(), password: f.password.value, role: f.role.value };
          if (body.role === 'CLIENT') body.clientId = Number(clientSelect.value);
          await api.createUser(body);
          close();
          toast(t('userCreated'));
          load();
        } catch (err) {
          errorBox.textContent = errorMessage(err);
          errorBox.hidden = false;
        }
      } },
      h('div', { class: 'form-row' }, field(t('formFirstName'), f.firstName), field(t('formLastName'), f.lastName)),
      field(t('formEmail'), f.email),
      h('label', { class: 'field' }, h('span', null, t('authPassword')), f.password, h('small', { class: 'muted', id: 'pwd-hint' }, t('pwdRule'))),
      field(t('formRole'), f.role),
      clientField,
      errorBox,
      h('button', { class: 'btn btn-primary', type: 'submit' }, t('userNew')),
    );
    const close = openModal(t('userNew'), form);
    syncClientField();
  } }, icon('plus'), t('userNew'));

  clear(main).append(
    h(
      'div',
      { class: 'page' },
      h('div', { class: 'page-head' }, h('h1', { tabindex: '-1' }, t('usersTitle')), newBtn),
      h(
        'div',
        { class: 'table-wrap' },
        h('table', null, h('thead', null, h('tr', null, h('th', null, t('formLastName')), h('th', null, t('formEmail')), h('th', null, t('formRole')), h('th', null, t('userStatus')), h('th', null, ''))), tableBody),
      ),
    ),
  );
  await load();
  main.focus({ preventScroll: true });
}

/* ------------------------------------------------------------------ */
/* Messages du formulaire de contact (admin)                           */
/* ------------------------------------------------------------------ */

async function viewContactMessages(main) {
  const list = h('div', { class: 'contact-msg-list' });
  clear(main).append(
    h('div', { class: 'page' },
      h('div', { class: 'page-head' }, h('div', null, h('h1', { tabindex: '-1' }, t('contactMsgTitle')), h('p', { class: 'muted' }, t('contactMsgSubtitle')))),
      h('section', { class: 'panel' }, list),
    ),
  );

  const msgs = await guarded(() => api.contactMessages());
  clear(list);
  if (!msgs?.length) {
    list.append(h('p', { class: 'empty-state' }, t('contactMsgEmpty')));
    return;
  }
  for (const m of msgs) {
    const toggleBtn = h('button', { class: 'btn btn-small btn-secondary', type: 'button' }, m.isRead ? t('contactMsgMarkUnread') : t('contactMsgMarkRead'));
    toggleBtn.onclick = async () => {
      const r = await guarded(() => api.markContactRead(m.id, !m.isRead));
      if (r) { m.isRead = r.isRead; card.classList.toggle('unread', !m.isRead); toggleBtn.textContent = m.isRead ? t('contactMsgMarkUnread') : t('contactMsgMarkRead'); }
    };
    const card = h('article', { class: `panel contact-msg${m.isRead ? '' : ' unread'}` },
      h('div', { class: 'contact-msg-head' },
        h('div', null, h('strong', null, m.name), h('span', { class: 'muted' }, ` · ${m.email}${m.phone ? ` · ${m.phone}` : ''}`)),
        h('span', { class: 'muted' }, fmtDate(m.createdAt)),
      ),
      h('p', null, m.message),
      h('div', { class: 'contact-msg-actions' },
        h('a', { class: 'btn btn-small', href: `mailto:${m.email}?subject=${encodeURIComponent(t('contactMsgReplySubject'))}` }, t('contactMsgReply')),
        toggleBtn,
      ),
    );
    list.append(card);
  }
}

/* ------------------------------------------------------------------ */
/* Journal d'audit (admin)                                             */
/* ------------------------------------------------------------------ */

async function viewAudit(main) {
  const tableBody = h('tbody');
  let offset = 0;
  const LIMIT = 40;
  const moreBtn = h('button', { class: 'btn more', type: 'button' }, t('auditMore'));

  async function load(reset = true) {
    if (reset) offset = 0;
    const rows = await guarded(() => api.auditLogs({ limit: LIMIT, offset }));
    if (reset) clear(tableBody);
    if (reset && !rows?.length) {
      tableBody.append(h('tr', null, h('td', { colspan: 5, class: 'empty-state' }, t('auditEmpty'))));
    }
    for (const a of rows ?? []) {
      tableBody.append(
        h(
          'tr',
          null,
          h('td', { class: 'muted' }, fmtDateTime(a.createdAt)),
          h('td', null, a.userName),
          h('td', null, h('span', { class: 'mono' }, a.action)),
          h('td', null, `${a.resourceType}${a.resourceId ? ` #${a.resourceId}` : ''}`),
          h('td', { class: 'muted' }, a.ipAddress ?? '—'),
        ),
      );
    }
    offset += LIMIT;
    moreBtn.hidden = (rows?.length ?? 0) < LIMIT;
  }
  moreBtn.addEventListener('click', () => load(false));

  clear(main).append(
    h(
      'div',
      { class: 'page' },
      h('div', { class: 'page-head' }, h('h1', { tabindex: '-1' }, t('auditTitle'))),
      h(
        'div',
        { class: 'table-wrap' },
        h('table', null, h('thead', null, h('tr', null, h('th', null, t('auditDate')), h('th', null, t('auditUser')), h('th', null, t('auditAction')), h('th', null, t('auditResource')), h('th', null, t('auditIp')))), tableBody),
      ),
      moreBtn,
    ),
  );
  await load();
  main.focus({ preventScroll: true });
}

/* ------------------------------------------------------------------ */
/* Personnalisation white-label (admin)                                */
/* ------------------------------------------------------------------ */

async function viewCustomize(main) {
  const s = await guarded(() => api.siteSettings());
  if (!s) {
    clear(main).append(h('div', { class: 'page' }, h('p', { class: 'empty-state' }, t('errGeneric'))));
    return;
  }

  const f = {};
  const mkInput = (name, value, attrs = {}) => {
    const el = h('input', { name, value: value ?? '', ...attrs });
    f[name] = el;
    return el;
  };
  const mkTextarea = (name, value, attrs = {}) => {
    const el = h('textarea', { name, ...attrs }, value ?? '');
    f[name] = el;
    return el;
  };

  // --- Aperçu en direct : reconstruit depuis les valeurs du formulaire ---
  const preview = h('div', { class: 'cust-preview-frame' });
  const paintPreview = () => {
    const v = (n) => f[n]?.value ?? '';
    const primary = f.primaryColorText.value || '#0f1e33';
    const accent = f.accentColorText.value || '#b08d3e';
    const name = v('firmName').trim() || t('brand');
    const logoSrc = previewLogoSrc || (siteSettings?.logoPath ? mediaUrl(`/uploads/${siteSettings.logoPath}`) : null);
    const mark = logoSrc
      ? h('img', { class: 'firm-logo-sm', src: logoSrc, alt: name })
      : h('span', { class: 'firm-monogram firm-monogram-sm', 'aria-hidden': 'true' }, (name[0] || 'C').toUpperCase());
    clear(preview).append(
      h('div', { class: 'cust-preview-bar' }, mark, h('strong', null, name)),
      h('div', { class: 'cust-preview-hero', style: `background:${primary}` },
        h('span', { class: 'public-kicker', style: `color:${accent}` }, v('tagline') || t('kicker')),
        h('h2', null, v('heroTitle') || t('landHeroTitle')),
        h('p', null, v('heroSubtitle') || t('landHeroText')),
      ),
      h('div', { class: 'cust-preview-contact' },
        h('div', null, `✉ ${v('contactEmail') || t('courrielValue')}`),
        h('div', null, `☎ ${v('contactPhone') || t('telephoneValue')}`),
        h('div', null, [v('addrStreet'), [v('addrCity'), v('addrProvince')].filter(Boolean).join(' '), v('addrPostal'), v('addrCountry')].map((x) => (x || '').trim()).filter(Boolean).join(', ') || t('adresseValue')),
      ),
    );
  };

  let previewLogoSrc = null;
  const logoBox = h('div', { class: 'cust-logo-row' });

  // Diaporama d'accueil : 5 emplacements d'images (téléversement + aperçu + retrait).
  const heroSlotsBox = h('div', { class: 'hero-slots' });
  const paintHeroSlots = () => {
    const imgs = siteSettings?.heroImages ?? [null, null, null, null, null];
    clear(heroSlotsBox);
    for (let i = 0; i < 5; i++) {
      const slot = i + 1;
      const src = imgs[i] ? mediaUrl(`/uploads/${imgs[i]}`) : null;
      const fileInput = h('input', {
        type: 'file', accept: '.png,.jpg,.jpeg,.webp', hidden: true,
        onchange: async (e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          if (!file) return;
          try {
            const updated = await api.uploadHeroImage(slot, file);
            siteSettings = updated;
            paintHeroSlots();
            toast(t('custSaved'));
          } catch (err) { toast(errorMessage(err), 'error'); }
        },
      });
      heroSlotsBox.append(
        h('div', { class: 'hero-slot' },
          h('span', { class: 'hero-slot-num' }, String(slot)),
          src ? h('img', { class: 'hero-slot-thumb', src, alt: '' }) : h('span', { class: 'muted' }, t('custNoPhoto')),
          h('div', { class: 'hero-slot-actions' },
            h('label', { class: 'btn btn-secondary btn-small' }, t('custLogoUpload'), fileInput),
            src ? h('button', {
              class: 'btn btn-ghost btn-small', type: 'button',
              onclick: async () => {
                try {
                  const updated = await api.removeHeroImage(slot);
                  siteSettings = updated;
                  paintHeroSlots();
                  toast(t('custSaved'));
                } catch (err) { toast(errorMessage(err), 'error'); }
              },
            }, t('remove')) : null,
          ),
        )
      );
    }
  };
  paintHeroSlots();

  // Photo de la section "À propos".
  let previewAboutSrc = null;
  const aboutPhotoBox = h('div', { class: 'cust-logo-row' });
  const paintAboutPhotoBox = () => {
    const src = previewAboutSrc || aboutPhotoUrl();
    clear(aboutPhotoBox).append(
      src ? h('img', { class: 'about-photo-thumb', src, alt: '' }) : h('span', { class: 'muted' }, t('custNoPhoto')),
      h('div', null,
        h('label', { class: 'btn btn-secondary', for: 'cust-about-file' }, t('custLogoUpload')),
        h('input', {
          id: 'cust-about-file', type: 'file', accept: '.png,.jpg,.jpeg,.webp', hidden: true,
          onchange: async (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            try {
              const updated = await api.uploadAboutPhoto(file);
              siteSettings = updated;
              refreshShellBrand();
              previewAboutSrc = aboutPhotoUrl();
              paintAboutPhotoBox();
              toast(t('custSaved'));
            } catch (err) {
              toast(errorMessage(err), 'error');
            } finally {
              e.target.value = '';
            }
          },
        }),
        src ? h('button', {
          class: 'btn btn-ghost', type: 'button',
          onclick: async () => {
            try {
              const updated = await api.removeAboutPhoto();
              siteSettings = updated;
              refreshShellBrand();
              previewAboutSrc = null;
              paintAboutPhotoBox();
              toast(t('custSaved'));
            } catch (err) { toast(errorMessage(err), 'error'); }
          },
        }, t('custLogoRemove')) : null,
      ),
    );
  };
  const paintLogoBox = () => {
    const src = previewLogoSrc || (siteSettings?.logoPath ? mediaUrl(`/uploads/${siteSettings.logoPath}`) : null);
    const name = (f.firmName?.value || '').trim() || t('brand');
    clear(logoBox).append(
      src
        ? h('img', { class: 'firm-logo', src, alt: name })
        : h('span', { class: 'firm-monogram', 'aria-hidden': 'true' }, (name[0] || 'C').toUpperCase()),
      h('div', null,
        h('label', { class: 'btn btn-secondary', for: 'cust-logo-file' }, t('custLogoUpload')),
        h('input', {
          id: 'cust-logo-file', type: 'file', accept: '.png,.jpg,.jpeg,.svg', hidden: true,
          onchange: async (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            try {
              const updated = await api.uploadLogo(file);
              siteSettings = updated;
              refreshShellBrand();
              previewLogoSrc = mediaUrl(`/uploads/${updated.logoPath}`);
              applySiteSettings();
              paintLogoBox();
              paintPreview();
              toast(t('custSaved'));
            } catch (err) {
              toast(errorMessage(err), 'error');
            } finally {
              e.target.value = '';
            }
          },
        }),
        src ? h('button', {
          class: 'btn btn-ghost', type: 'button', style: 'margin-left:0.5rem',
          onclick: async () => {
            try {
              const updated = await api.removeLogo();
              siteSettings = updated;
              refreshShellBrand();
              previewLogoSrc = null;
              applySiteSettings();
              paintLogoBox();
              paintPreview();
              toast(t('custSaved'));
            } catch (err) {
              toast(errorMessage(err), 'error');
            }
          },
        }, t('custLogoRemove')) : null,
      ),
    );
  };

  // --- Couleurs : sélecteur + champ texte synchronisés ---
  const colorPair = (colorKey, textKey, labelKey) => {
    const color = h('input', { type: 'color', value: s[colorKey] || '#0f1e33', 'aria-label': t(labelKey) });
    const text = h('input', { type: 'text', value: s[colorKey] || '#0f1e33', maxlength: '7', spellcheck: 'false' });
    f[colorKey] = color;
    f[`${textKey}`] = text;
    const hexOk = (v) => /^#[0-9a-fA-F]{6}$/.test(v);
    color.addEventListener('input', () => { text.value = color.value; paintPreview(); });
    text.addEventListener('input', () => { if (hexOk(text.value)) { color.value = text.value; paintPreview(); } });
    return h('div', { class: 'color-row' }, color, text);
  };

  const form = h('form', {
    class: 'stacked-form',
    onsubmit: async (e) => {
      e.preventDefault();
      const saveBtn = form.querySelector('button[type="submit"]');
      saveBtn.disabled = true;
      saveBtn.textContent = t('custSaving');
      try {
        const body = {
          firm_name: f.firmName.value.trim(),
          tagline: f.tagline.value.trim(),
          primary_color: f.primaryColorText.value.trim(),
          accent_color: f.accentColorText.value.trim(),
          hero_title: f.heroTitle.value.trim(),
          hero_subtitle: f.heroSubtitle.value.trim(),
          about_title: f.aboutTitle.value.trim(),
          about_text: f.aboutText.value.trim(),
          cta_title: f.ctaTitle.value.trim(),
          cta_text: f.ctaText.value.trim(),
          cta_button: f.ctaButton.value.trim(),
          practice_title: f.practiceTitle.value.trim(),
          testi_title: f.testiTitle.value.trim(),
          show_hero: f.showHero.checked,
          show_about: f.showAbout.checked,
          show_practice_areas: f.showPracticeAreas.checked,
          show_testimonials: f.showTestimonials.checked,
          show_contact: f.showContact.checked,
          contact_email: f.contactEmail.value.trim(),
          contact_phone: f.contactPhone.value.trim(),
          address_street: f.addrStreet.value.trim(),
          address_city: f.addrCity.value.trim(),
          address_province: f.addrProvince.value.trim(),
          address_postal: f.addrPostal.value.trim(),
          address_country: f.addrCountry.value.trim(),
          footer_text: f.footerText.value.trim(),
        };
        const updated = await api.updateSiteSettings(body);
        siteSettings = updated;
        refreshShellBrand();
        applySiteSettings();
        paintPreview();
        toast(t('custSaved'));
      } catch (err) {
        toast(errorMessage(err), 'error');
      } finally {
        saveBtn.disabled = false;
        saveBtn.textContent = t('custSave');
      }
    },
  });

  form.append(
    h('h2', null, t('custIdentity')),
    field(t('custFirmName'), mkInput('firmName', s.firmName, { required: true, maxlength: '120' })),
    field(t('custTagline'), mkInput('tagline', s.tagline, { maxlength: '200' })),
    h('div', { class: 'field' }, h('span', null, t('custLogo')), logoBox, h('small', { class: 'muted' }, t('custLogoHint'))),
    h('h2', null, t('custColors')),
    field(t('custPrimary'), colorPair('primaryColor', 'primaryColorText', 'custPrimary')),
    field(t('custAccent'), colorPair('accentColor', 'accentColorText', 'custAccent')),
    h('div', null, h('button', {
      class: 'btn btn-ghost', type: 'button',
      onclick: () => {
        f.primaryColor.value = '#0f1e33'; f.primaryColorText.value = '#0f1e33';
        f.accentColor.value = '#b08d3e'; f.accentColorText.value = '#b08d3e';
        paintPreview();
      },
    }, t('custResetColors'))),
    h('h2', null, t('custHomepage')),
    field(t('custHeroTitle'), mkInput('heroTitle', s.heroTitle, { required: true, maxlength: '160' })),
    field(t('custHeroSubtitle'), mkTextarea('heroSubtitle', s.heroSubtitle, { rows: '3', maxlength: '500' })),
    h('div', { class: 'field' }, h('span', null, t('custHeroImages')), heroSlotsBox, h('small', { class: 'muted' }, t('custHeroImagesHint'))),
    h('h2', null, t('custAbout')),
    field(t('custAboutTitle'), mkInput('aboutTitle', s.aboutTitle, { maxlength: '160' })),
    field(t('custAboutText'), mkTextarea('aboutText', s.aboutText, { rows: '4', maxlength: '2000' })),
    h('div', { class: 'field' }, h('span', null, t('custAboutPhoto')), aboutPhotoBox, h('small', { class: 'muted' }, t('custLogoHint'))),
    h('h2', null, t('custCta')),
    field(t('custCtaTitle'), mkInput('ctaTitle', s.ctaTitle, { maxlength: '160' })),
    field(t('custCtaText'), mkTextarea('ctaText', s.ctaText, { rows: '2', maxlength: '500' })),
    field(t('custCtaButton'), mkInput('ctaButton', s.ctaButton, { maxlength: '60' })),
    h('h2', null, t('custSectionTitles')),
    field(t('custPracticeTitle'), mkInput('practiceTitle', s.practiceTitle, { maxlength: '160' })),
    field(t('custTestiTitle'), mkInput('testiTitle', s.testiTitle, { maxlength: '160' })),
    h('h2', null, t('custSections')),
    h('p', { class: 'muted', style: 'margin-top:-0.5rem' }, t('custSectionsIntro')),
    ...[
      ['showHero', 'custShowHero'],
      ['showAbout', 'custShowAbout'],
      ['showPracticeAreas', 'custShowPracticeAreas'],
      ['showTestimonials', 'custShowTestimonials'],
      ['showContact', 'custShowContact'],
    ].map(([name, labelKey]) => {
      const cb = h('input', { type: 'checkbox', checked: s[name] !== false });
      f[name] = cb;
      return h('label', { class: 'check-row' }, cb, h('span', null, t(labelKey)));
    }),
    h('h2', null, t('custContact')),
    field(t('custEmail'), mkInput('contactEmail', s.contactEmail, { type: 'email', maxlength: '160' })),
    field(t('custPhone'), mkInput('contactPhone', s.contactPhone, { type: 'tel', maxlength: '40' })),
    field(t('custAddrStreet'), mkInput('addrStreet', s.addressStreet, { maxlength: '160', autocomplete: 'street-address', placeholder: t('custAddrStreetPh') })),
    h('div', { class: 'form-row' },
      field(t('custAddrCity'), mkInput('addrCity', s.addressCity, { maxlength: '80', autocomplete: 'address-level2', placeholder: t('custAddrCityPh') })),
      field(t('custAddrProvince'), mkInput('addrProvince', s.addressProvince, { maxlength: '80', autocomplete: 'address-level1', placeholder: t('custAddrProvincePh') })),
    ),
    h('div', { class: 'form-row' },
      field(t('custAddrPostal'), mkInput('addrPostal', s.addressPostal, { maxlength: '20', autocomplete: 'postal-code', placeholder: t('custAddrPostalPh') })),
      field(t('custAddrCountry'), mkInput('addrCountry', s.addressCountry, { maxlength: '80', autocomplete: 'country-name', placeholder: t('custAddrCountryPh') })),
    ),
    field(t('custFooterText'), mkTextarea('footerText', s.footerText, { rows: '2', maxlength: '300' })),
    h('div', null, h('button', { class: 'btn btn-primary', type: 'submit' }, t('custSave'))),
  );

  // --- Gestionnaires de contenu de la page d'accueil ---
  const managers = h('div', { class: 'cust-managers' });

  /** Fabrique un gestionnaire de liste générique (CRUD). */
  const makeManager = ({ titleKey, emptyKey, addKey, columns, load, onAdd, onEdit, onDelete, onMove }) => {
    const box = h('section', { class: 'panel cust-manager' }, h('h2', null, t(titleKey)));
    const list = h('div', { class: 'cust-manager-list' });
    const refresh = async () => {
      clear(list).append(h('p', { class: 'loading' }, t('loading')));
      const rows = await guarded(() => load());
      clear(list);
      if (!rows?.length) { list.append(h('p', { class: 'empty-state' }, t(emptyKey))); return; }
      rows.forEach((r, i) => {
        const row = h('div', { class: 'cust-manager-row' },
          h('div', { class: 'cust-manager-main' },
            ...columns.map((c) => h(c.tag || 'div', { class: c.cls }, c.render(r)))),
          h('div', { class: 'cust-manager-actions' },
            onMove ? h('button', { class: 'btn btn-small', type: 'button', disabled: i === 0, onclick: () => onMove(r, -1, refresh), 'aria-label': '↑' }, '↑') : null,
            onMove ? h('button', { class: 'btn btn-small', type: 'button', disabled: i === rows.length - 1, onclick: () => onMove(r, 1, refresh), 'aria-label': '↓' }, '↓') : null,
            h('button', { class: 'btn btn-small', type: 'button', onclick: () => onEdit(r, refresh) }, t('edit')),
            h('button', { class: 'btn btn-small danger', type: 'button', onclick: async () => { if (confirm(t('paDeleteConfirm'))) { await onDelete(r); refresh(); } } }, t('delete')),
          ));
        list.append(row);
      });
    };
    box.append(list, h('button', { class: 'btn btn-secondary', type: 'button', onclick: () => onAdd(refresh) }, icon('plus'), t(addKey)));
    refresh();
    return box;
  };

  const areaModal = (existing, refresh) => {
    const f2 = {
      title: h('input', { required: true, maxlength: '120', value: existing?.title || '' }),
      description: h('textarea', { rows: 3, maxlength: '2000' }, existing?.description || ''),
    };
    const form = h('form', { class: 'stacked-form', onsubmit: async (e) => {
      e.preventDefault();
      try {
        const body = { title: f2.title.value.trim(), description: f2.description.value.trim() };
        if (existing) await api.updatePracticeArea(existing.id, body);
        else await api.createPracticeArea(body);
        close(); toast(t('custSaved')); refresh();
      } catch (err) { toast(errorMessage(err), 'error'); }
    } }, field(t('paTitle'), f2.title), field(t('paDescription'), f2.description),
      h('button', { class: 'btn btn-primary', type: 'submit' }, t('save')));
    const close = openModal(existing ? t('paEdit') : t('paNew'), form);
  };

  const testiModal = (existing, refresh) => {
    const f2 = {
      name: h('input', { required: true, maxlength: '120', value: existing?.name || '' }),
      role: h('input', { maxlength: '160', value: existing?.roleText || '', placeholder: t('testiRolePh') }),
      content: h('textarea', { required: true, rows: 4, maxlength: '2000' }, existing?.content || ''),
    };
    let photoFile = null;
    const photoInput = h('input', { type: 'file', accept: 'image/png,image/jpeg,image/gif,image/webp', onchange: () => { photoFile = photoInput.files[0] || null; } });
    const form = h('form', { class: 'stacked-form', onsubmit: async (e) => {
      e.preventDefault();
      try {
        const body = { name: f2.name.value.trim(), role_text: f2.role.value.trim(), content: f2.content.value.trim() };
        if (existing) await api.updateTestimonial(existing.id, body, photoFile);
        else await api.createTestimonial(body, photoFile);
        close(); toast(t('custSaved')); refresh();
      } catch (err) { toast(errorMessage(err), 'error'); }
    } }, field(t('testiName'), f2.name), field(t('testiRole'), f2.role), field(t('testiContent'), f2.content),
      field(t('testiPhoto'), photoInput),
      h('button', { class: 'btn btn-primary', type: 'submit' }, t('save')));
    const close = openModal(existing ? t('testiEdit') : t('testiNew'), form);
  };

  const statModal = (existing, refresh) => {
    const f2 = {
      value: h('input', { required: true, maxlength: '40', value: existing?.value || '', placeholder: t('statValuePh') }),
      label: h('input', { required: true, maxlength: '80', value: existing?.label || '', placeholder: t('statLabelPh') }),
    };
    const form = h('form', { class: 'stacked-form', onsubmit: async (e) => {
      e.preventDefault();
      try {
        const body = { value: f2.value.value.trim(), label: f2.label.value.trim() };
        if (existing) await api.updateSiteStat(existing.id, body);
        else await api.createSiteStat(body);
        close(); toast(t('custSaved')); refresh();
      } catch (err) { toast(errorMessage(err), 'error'); }
    } }, field(t('statValue'), f2.value), field(t('statLabel'), f2.label),
      h('button', { class: 'btn btn-primary', type: 'submit' }, t('save')));
    const close = openModal(existing ? t('statEdit') : t('statNew'), form);
  };

  const moveBy = async (api2, rows, r, dir, refresh) => {
    const sorted = [...rows].sort((a, b) => a.position - b.position);
    const i = sorted.findIndex((x) => x.id === r.id);
    const j = i + dir;
    if (j < 0 || j >= sorted.length) return;
    const a = sorted[i], b = sorted[j];
    await api2.update(a.id, { position: b.position });
    await api2.update(b.id, { position: a.position });
    refresh();
  };

  managers.append(
    makeManager({
      titleKey: 'paManage', emptyKey: 'paEmpty', addKey: 'paNew',
      columns: [{ render: (r) => h('strong', null, r.title) }, { cls: 'muted', render: (r) => r.description }],
      load: () => api.practiceAreas(),
      onAdd: (refresh) => areaModal(null, refresh),
      onEdit: (r, refresh) => areaModal(r, refresh),
      onDelete: (r) => api.deletePracticeArea(r.id),
      onMove: async (r, dir, refresh) => {
        const rows = await api.practiceAreas();
        await moveBy({ update: (id, b) => api.updatePracticeArea(id, b) }, rows, r, dir, refresh);
      },
    }),
    makeManager({
      titleKey: 'testiManage', emptyKey: 'testiEmpty', addKey: 'testiNew',
      columns: [{ render: (r) => h('strong', null, r.name) }, { cls: 'muted', render: (r) => r.content.slice(0, 80) }],
      load: () => api.testimonials(),
      onAdd: (refresh) => testiModal(null, refresh),
      onEdit: (r, refresh) => testiModal(r, refresh),
      onDelete: (r) => api.deleteTestimonial(r.id),
      onMove: async (r, dir, refresh) => {
        const rows = await api.testimonials();
        await moveBy({ update: (id, b) => api.updateTestimonial(id, b) }, rows, r, dir, refresh);
      },
    }),
    makeManager({
      titleKey: 'statManage', emptyKey: 'statEmpty', addKey: 'statNew',
      columns: [{ render: (r) => h('strong', null, r.value) }, { cls: 'muted', render: (r) => r.label }],
      load: () => api.siteStats(),
      onAdd: (refresh) => statModal(null, refresh),
      onEdit: (r, refresh) => statModal(r, refresh),
      onDelete: (r) => api.deleteSiteStat(r.id),
      onMove: async (r, dir, refresh) => {
        const rows = await api.siteStats();
        await moveBy({ update: (id, b) => api.updateSiteStat(id, b) }, rows, r, dir, refresh);
      },
    }),
  );

  // L'aperçu se rafraîchit à chaque frappe.
  form.addEventListener('input', (e) => {
    if (e.target.type !== 'color' && e.target.type !== 'file') paintPreview();
  });

  clear(main).append(
    h('div', { class: 'page' },
      h('div', { class: 'page-head' }, h('h1', { tabindex: '-1' }, t('custTitle')), h('p', { class: 'muted' }, t('custIntro'))),
      h('div', { class: 'cust-layout' },
        h('section', { class: 'panel' }, form),
        h('section', { class: 'panel cust-preview' }, h('h2', null, t('custPreview')), preview),
      ),
      managers,
    ),
  );
  paintLogoBox();
  paintAboutPhotoBox();
  paintPreview();
  main.querySelector('h1')?.focus({ preventScroll: true });
}

/* ------------------------------------------------------------------ */
/* Démarrage                                                           */
/* ------------------------------------------------------------------ */

(async () => {
  await loadSiteSettings();
  route();
})();

/* ------------------------------------------------------------------ */
/* Blog SEO (articles des avocats, rendus côté serveur pour Google)     */
/* ------------------------------------------------------------------ */

/* ------------------------------------------------------------------ */
/* Éditeur WYSIWYG du blog (contenteditable, sans dépendance)          */
/* ------------------------------------------------------------------ */

const RTE_FONTS = [
  { key: 'rteFontSerif', value: `Georgia,'Times New Roman',serif` },
  { key: 'rteFontSans', value: `-apple-system,'Segoe UI',Roboto,Arial,sans-serif` },
  { key: 'rteFontMono', value: `'SFMono-Regular',Consolas,'Courier New',monospace` },
];
const RTE_SIZES = [
  { key: 'rteSizeS', px: '12px' },
  { key: 'rteSizeM', px: '16px' },
  { key: 'rteSizeL', px: '21px' },
  { key: 'rteSizeXL', px: '30px' },
];
const RTE_TEXT_COLORS = ['#0f1e33', '#2c3440', '#5a6472', '#b08d3e', '#b3372f', '#2e7d4f', '#1d5fa8'];
const RTE_HL_COLORS = ['#f6ecd4', '#fbe3b0', '#dbe7f3', '#dff0e3', '#f6dfe0', '#e8e4da'];
const RTE_IMG_SIZES = [
  { key: 'rteImgS', cls: 'img-sm' },
  { key: 'rteImgM', cls: 'img-md' },
  { key: 'rteImgL', cls: 'img-lg' },
  { key: 'rteImgFull', cls: 'img-full' },
];
const RTE_IMG_ALIGNS = [
  { key: 'rteImgAlignLeft', cls: 'align-left' },
  { key: 'rteImgAlignCenter', cls: 'align-center' },
  { key: 'rteImgAlignRight', cls: 'align-right' },
];

/** Normalise le HTML produit par execCommand (<font>, <b>, <i>) en balises propres. */
function normalizeRte(area) {
  area.querySelectorAll('font').forEach((el) => {
    const span = document.createElement('span');
    const sizeMap = { 1: '10px', 2: '13px', 3: '16px', 4: '18px', 5: '24px', 6: '32px', 7: '48px' };
    const sz = sizeMap[el.getAttribute('size')];
    if (sz) span.style.fontSize = sz;
    if (el.getAttribute('face')) span.style.fontFamily = el.getAttribute('face');
    if (el.getAttribute('color')) span.style.color = el.getAttribute('color');
    span.innerHTML = el.innerHTML;
    el.replaceWith(span);
  });
  for (const [from, to] of [['b', 'strong'], ['i', 'em']]) {
    area.querySelectorAll(from).forEach((el) => {
      const n = document.createElement(to);
      n.innerHTML = el.innerHTML;
      el.replaceWith(n);
    });
  }
  // justify* d'execCommand produit <div style="text-align:…"> : on convertit
  // en classes d'alignement (seules autorisées par le nettoyage serveur).
  area.querySelectorAll('div[style],p[style],h1[style],h2[style],h3[style]').forEach((el) => {
    const m = /text-align\s*:\s*(left|center|right|justify)/i.exec(el.getAttribute('style') || '');
    el.removeAttribute('style');
    if (m) el.classList.add(`align-${m[1].toLowerCase()}`);
  });
}

/**
 * Construit l'éditeur riche. Retourne { wrap, getHtml }.
 * @param {string} initialHtml HTML initial (déjà nettoyé côté serveur).
 */
function buildRichEditor(initialHtml) {
  const wrap = h('div', { class: 'rte-wrap' });
  const area = h('div', {
    class: 'rte-area', contenteditable: 'true', role: 'textbox',
    'aria-label': t('blogContent'), 'aria-multiline': 'true',
  });
  area.innerHTML = initialHtml || '';

  const exec = (cmd, arg = null) => {
    area.focus();
    document.execCommand(cmd, false, arg);
    normalizeRte(area);
    syncStates();
  };

  const group = (...kids) => h('span', { class: 'rte-group' }, ...kids);
  const btn = (inner, title, onclick, cmdName = null) => {
    const b = h('button', {
      class: 'rte-btn', type: 'button', title, 'aria-label': title,
      onmousedown: (e) => e.preventDefault(),
      onclick: () => { onclick(); },
    }, inner);
    if (cmdName) { b.dataset.cmd = cmdName; stateBtns.push({ el: b, cmd: cmdName }); }
    return b;
  };
  const stateBtns = [];

  const syncStates = () => {
    for (const { el, cmd: c } of stateBtns) {
      try { el.classList.toggle('is-active', document.queryCommandState(c)); } catch { /* noop */ }
    }
  };

  // --- Bloc : paragraphe / titres
  const blockSel = h('select', {
    class: 'rte-select', title: t('rteBlock'), 'aria-label': t('rteBlock'),
    onmousedown: (e) => e.stopPropagation(),
    onchange: () => { exec('formatBlock', blockSel.value); },
  },
    h('option', { value: 'p' }, t('rteParagraph')),
    h('option', { value: 'h1' }, t('rteH1')),
    h('option', { value: 'h2' }, t('rteH2')),
    h('option', { value: 'h3' }, t('rteH3')));
  // --- Police
  const fontSel = h('select', {
    class: 'rte-select', title: t('rteFont'), 'aria-label': t('rteFont'),
    onmousedown: (e) => e.stopPropagation(),
    onchange: () => { exec('fontName', fontSel.value); fontSel.selectedIndex = 0; },
  }, ...RTE_FONTS.map((f) => h('option', { value: f.value }, t(f.key))));
  // --- Taille
  const sizeSel = h('select', {
    class: 'rte-select', title: t('rteSize'), 'aria-label': t('rteSize'),
    onmousedown: (e) => e.stopPropagation(),
    onchange: () => {
      const px = sizeSel.value;
      sizeSel.selectedIndex = 0;
      area.focus();
      // fontSize=7 produit <font size="7">, converti aussitôt en <span style>.
      document.execCommand('fontSize', false, '7');
      area.querySelectorAll('font[size="7"]').forEach((el) => {
        const span = document.createElement('span');
        span.style.fontSize = px;
        span.innerHTML = el.innerHTML;
        el.replaceWith(span);
      });
      syncStates();
    },
  }, h('option', { value: '' }, t('rteSize')), ...RTE_SIZES.map((s) => h('option', { value: s.px }, t(s.key))));

  // --- Couleurs : pastilles prédéfinies + sélecteur libre
  const colorRow = (colors, title, apply) => {
    const custom = h('input', {
      class: 'rte-color', type: 'color', title: `${title} (${t('rteCustom')})`, 'aria-label': `${title} (${t('rteCustom')})`,
      onmousedown: (e) => e.stopPropagation(),
      onchange: () => apply(custom.value),
    });
    return group(
      ...colors.map((c) => h('button', {
        class: 'rte-swatch', type: 'button', title: `${title} — ${c}`, 'aria-label': `${title} — ${c}`,
        style: `background:${c}`,
        onmousedown: (e) => e.preventDefault(),
        onclick: () => apply(c),
      })),
      custom,
    );
  };

  // --- Barre d'outils flottante des images
  const imgBar = h('div', { class: 'rte-imgbar', hidden: true });
  let selectedImg = null;
  const setImgClass = (img, cls, allowed) => {
    img.classList.remove(...allowed);
    img.classList.add(cls);
  };
  const hideImgBar = () => { imgBar.hidden = true; if (selectedImg) { selectedImg.classList.remove('rte-img-selected'); selectedImg = null; } };
  for (const s of RTE_IMG_SIZES) {
    imgBar.append(h('button', {
      type: 'button', title: t(s.key), 'aria-label': t(s.key),
      onmousedown: (e) => e.preventDefault(),
      onclick: () => { if (selectedImg) setImgClass(selectedImg, s.cls, RTE_IMG_SIZES.map((x) => x.cls)); },
    }, t(s.key)));
  }
  imgBar.append(h('span', { class: 'rte-sep' }));
  for (const a of RTE_IMG_ALIGNS) {
    imgBar.append(h('button', {
      type: 'button', title: t(a.key), 'aria-label': t(a.key),
      onmousedown: (e) => e.preventDefault(),
      onclick: () => { if (selectedImg) setImgClass(selectedImg, a.cls, RTE_IMG_ALIGNS.map((x) => x.cls)); },
    }, t(a.key)));
  }
  imgBar.append(h('span', { class: 'rte-sep' }));
  imgBar.append(h('button', {
    class: 'danger', type: 'button', title: t('rteImgDelete'), 'aria-label': t('rteImgDelete'),
    onmousedown: (e) => e.preventDefault(),
    onclick: () => { if (selectedImg) { selectedImg.remove(); hideImgBar(); } },
  }, t('rteImgDelete')));

  const positionImgBar = (img) => {
    const wr = wrap.getBoundingClientRect();
    const ir = img.getBoundingClientRect();
    const top = ir.bottom - wr.top + 8;
    const left = Math.max(8, Math.min(ir.left - wr.left, wr.width - 260));
    imgBar.style.top = `${top}px`;
    imgBar.style.left = `${left}px`;
  };

  area.addEventListener('click', (e) => {
    const img = e.target.closest ? e.target.closest('img') : null;
    if (img && area.contains(img)) {
      hideImgBar();
      selectedImg = img;
      img.classList.add('rte-img-selected');
      positionImgBar(img);
      imgBar.hidden = false;
    } else {
      hideImgBar();
    }
    syncStates();
  });
  area.addEventListener('keyup', syncStates);

  // --- Insertion d'image : téléversement ou URL
  const imgFileInput = h('input', {
    type: 'file', accept: 'image/png,image/jpeg,image/gif,image/webp', hidden: true,
    onchange: async () => {
      const file = imgFileInput.files[0];
      imgFileInput.value = '';
      if (!file) return;
      const r = await guarded(() => api.uploadBlogImage(file));
      if (!r?.url) return;
      area.focus();
      document.execCommand('insertHTML', false, `<img src="${r.url.replace(/"/g, '')}" alt="" class="img-full">`);
    },
  });
  const insertImageUrl = () => {
    const url = prompt(t('rteImageUrlPrompt'), 'https://');
    if (!url || !url.trim()) return;
    area.focus();
    document.execCommand('insertHTML', false, `<img src="${url.trim().replace(/"/g, '')}" alt="" class="img-full">`);
  };

  const toolbar = h('div', { class: 'rte-toolbar', role: 'toolbar', 'aria-label': t('blogContent') },
    group(blockSel, fontSel, sizeSel),
    group(
      btn(h('b', null, 'B'), t('rteBold'), () => exec('bold'), 'bold'),
      btn(h('i', null, 'I'), t('rteItalic'), () => exec('italic'), 'italic'),
      btn(h('u', null, 'U'), t('rteUnderline'), () => exec('underline'), 'underline'),
      btn(h('s', null, 'S'), t('rteStrike'), () => exec('strikeThrough'), 'strikeThrough'),
    ),
    colorRow(RTE_TEXT_COLORS, t('rteTextColor'), (c) => exec('foreColor', c)),
    colorRow(RTE_HL_COLORS, t('rteHighlight'), (c) => exec('hiliteColor', c)),
    group(
      btn(icon('alignLeft'), t('rteAlignLeft'), () => exec('justifyLeft')),
      btn(icon('alignCenter'), t('rteAlignCenter'), () => exec('justifyCenter')),
      btn(icon('alignRight'), t('rteAlignRight'), () => exec('justifyRight')),
      btn(icon('alignJustify'), t('rteAlignJustify'), () => exec('justifyFull')),
    ),
    group(
      btn(icon('listBullet'), t('rteBullet'), () => exec('insertUnorderedList')),
      btn(icon('listNumbered'), t('rteNumbered'), () => exec('insertOrderedList')),
      btn(icon('quote'), t('rteQuote'), () => exec('formatBlock', 'blockquote')),
    ),
    group(
      btn(icon('linkIcon'), t('rteLink'), () => {
        const url = prompt(t('rteLinkPrompt'), 'https://');
        if (!url || !url.trim()) return;
        const clean = url.trim();
        const full = /^(https?:\/\/|mailto:|#)/i.test(clean) ? clean : `https://${clean}`;
        exec('createLink', full);
      }),
      btn(icon('imageIcon'), t('rteImageUpload'), () => imgFileInput.click()),
      btn(icon('imageIcon'), t('rteImageUrl'), insertImageUrl),
    ),
    group(
      btn(icon('clearFormat'), t('rteClear'), () => exec('removeFormat')),
    ),
  );

  wrap.append(toolbar, area, imgBar, imgFileInput);
  return { wrap, getHtml: () => { normalizeRte(area); hideImgBar(); return area.innerHTML; } };
}

function openBlogEditor(existing = null, refresh) {
  const f = {
    title: h('input', { required: true, value: existing?.title || '', placeholder: t('blogTitlePh') }),
    excerpt: h('textarea', { rows: 2, maxlength: 500, placeholder: t('blogExcerptPh') }, existing?.excerpt || ''),
  };
  const editor = buildRichEditor(existing?.content_html || '');
  let coverFile = null;
  const coverPreview = h('div', { class: 'post-thumbs', hidden: !existing?.coverUrl },
    existing?.coverUrl ? h('div', { class: 'post-thumb' }, h('img', { src: mediaUrl(existing.coverUrl), alt: '' })) : null);
  const coverInput = h('input', {
    type: 'file', accept: 'image/png,image/jpeg,image/gif,image/webp', onchange: () => {
      coverFile = coverInput.files[0] || null;
      clear(coverPreview);
      if (coverFile) coverPreview.append(h('div', { class: 'post-thumb' }, h('img', { src: URL.createObjectURL(coverFile), alt: '' })));
      coverPreview.hidden = !coverFile;
    },
  });
  const errorBox = h('p', { class: 'form-error', hidden: true });
  const save = async (status) => {
    errorBox.hidden = true;
    try {
      const body = { title: f.title.value.trim(), excerpt: f.excerpt.value.trim(), content_html: editor.getHtml(), status };
      if (existing) await api.updateBlogPost(existing.id, body, coverFile);
      else await api.createBlogPost(body, coverFile);
      close();
      toast(status === 'published' ? t('blogPublished') : t('blogDraftSaved'));
      refresh();
    } catch (err) { errorBox.textContent = errorMessage(err); errorBox.hidden = false; }
  };
  const form = h('form', { class: 'stacked-form', onsubmit: (e) => { e.preventDefault(); save(existing?.status === 'published' ? 'published' : 'draft'); } },
    field(t('blogTitle'), f.title),
    field(t('blogExcerpt'), f.excerpt),
    field(t('blogContent'), editor.wrap),
    field(t('blogCover'), coverInput), coverPreview,
    errorBox,
    h('div', { class: 'form-row' },
      h('button', { class: 'btn btn-secondary', type: 'submit' }, t('blogSaveDraft')),
      h('button', { class: 'btn btn-primary', type: 'button', onclick: () => save('published') }, t('blogPublish'))));
  const close = openModal(existing ? t('blogEdit') : t('blogNew'), form, { wide: true });
}


async function viewBlog(main) {
  const tabs = h('div', { class: 'tabs' });
  const list = h('div', { class: 'blog-list' });
  let tab = 'published';
  const load = async () => {
    clear(list).append(h('p', { class: 'loading' }, t('loading')));
    const rows = await guarded(() => api.blogPosts(tab === 'all' ? {} : { status: tab }));
    clear(list);
    if (!rows?.length) { list.append(h('p', { class: 'empty-state' }, t('blogEmpty'))); return; }
    for (const b of rows) {
      const cover = b.coverUrl ? h('img', { class: 'blog-row-cover', src: mediaUrl(b.coverUrl), alt: '' }) : null;
      const actions = h('div', { class: 'blog-row-actions' });
      if (b.status === 'published') {
        actions.append(h('a', { class: 'link-btn', href: `${location.protocol}//${location.host}/blog/${b.slug}`, target: '_blank', rel: 'noopener' }, t('blogViewPublic')));
      }
      actions.append(
        h('button', { class: 'btn btn-small', type: 'button', onclick: () => openBlogEditor(b, load) }, t('edit')),
        h('button', { class: 'btn btn-small danger', type: 'button', onclick: async () => { if (confirm(t('blogDeleteConfirm'))) { await api.deleteBlogPost(b.id); load(); } } }, t('delete')));
      list.append(h('article', { class: 'panel blog-row' }, cover,
        h('div', { class: 'blog-row-body' },
          h('div', { class: 'blog-row-head' },
            h('h3', null, b.title),
            h('span', { class: `badge ${b.status === 'published' ? 'badge-ok' : ''}` }, b.status === 'published' ? t('blogStatusPublished') : t('blogStatusDraft'))),
          h('p', { class: 'muted' }, `/${b.slug} · ${b.author.firstName} ${b.author.lastName} · ${fmtDateTime(b.updatedAt)}`),
          b.excerpt ? h('p', { class: 'blog-row-excerpt' }, b.excerpt) : null,
          actions)));
    }
  };
  const setTab = (v) => { tab = v; [...tabs.children].forEach((b) => b.classList.toggle('is-active', b.dataset.tab === v)); load(); };
  for (const [v, label] of [['published', t('blogTabPublished')], ['draft', t('blogTabDraft')], ['all', t('blogTabAll')]]) {
    tabs.append(h('button', { class: `btn btn-secondary${v === tab ? ' is-active' : ''}`, type: 'button', dataset: { tab: v }, onclick: () => setTab(v) }, label));
  }
  const newBtn = h('button', { class: 'btn btn-primary', type: 'button', onclick: () => openBlogEditor(null, load) }, icon('plus'), t('blogNew'));
  const viewPublic = h('a', { class: 'btn btn-secondary', href: '/blog', target: '_blank', rel: 'noopener' }, t('blogViewBlog'));
  clear(main).append(
    h('div', { class: 'page' },
      h('div', { class: 'page-head' }, h('h1', { tabindex: '-1' }, t('navBlog')), h('div', { class: 'page-actions' }, viewPublic, newBtn)),
      tabs, list),
  );
  await load();
  main.focus({ preventScroll: true });
}
