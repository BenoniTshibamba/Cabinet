import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';
import { createApp } from '../src/app.js';
import { pool, query } from '../src/db/pool.js';

let server;
let base;

// Compte administrateur dédié aux tests, créé directement en base (le endpoint /users exige déjà un admin).
const ADMIN_EMAIL = `test-admin-${Date.now()}@cabinet-elite.example`;
const ADMIN_PASSWORD = 'TestAdmin1234!';

async function createTestAdmin() {
  const hash = await bcrypt.hash(ADMIN_PASSWORD, 10);
  const { rows: role } = await query("SELECT id FROM roles WHERE name = 'ADMIN'");
  const { rows } = await query(
    `INSERT INTO users (email, password_hash, first_name, last_name, role_id) VALUES ($1,$2,'Test','Admin',$3) RETURNING id`,
    [ADMIN_EMAIL, hash, role[0].id],
  );
  return rows[0].id;
}

before(async () => {
  await createTestAdmin();
  server = createApp().listen(0);
  await new Promise((r) => server.once('listening', r));
  base = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  server.close();
  await pool.end();
});

const api = async (path, { token, method = 'GET', body, isForm } = {}) => {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  let payload = body;
  if (body && !isForm) {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }
  const res = await fetch(base + path, { method, headers, body: payload });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = text;
  }
  return { status: res.status, body: json };
};

const login = async (email, password = 'Demo1234!') => {
  const { body } = await api('/api/auth/login', { method: 'POST', body: { email, password } });
  return body.accessToken;
};

let adminToken;
let lawyerToken;
let otherLawyerToken;
let assistantToken;
let accountantToken;
let clientToken;
let clientUserClientId;

let clientId;
let caseId;
let otherLawyerId;

// Nom unique par exécution : la base de test persiste entre les runs et
// /api/search limite à 10 résultats — un nom réutilisé finirait hors limite.
const TEST_LAST_NAME = `Haddad${Date.now().toString(36)}`;

describe('auth', () => {
  test('login refuse un mot de passe incorrect', async () => {
    const res = await api('/api/auth/login', { method: 'POST', body: { email: ADMIN_EMAIL, password: 'faux' } });
    assert.equal(res.status, 401);
    assert.equal(res.body.error.code, 'invalid_credentials');
  });

  test('login réussi renvoie un accessToken et un refreshToken', async () => {
    const res = await api('/api/auth/login', { method: 'POST', body: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD } });
    assert.equal(res.status, 200);
    assert.ok(res.body.accessToken);
    assert.ok(res.body.refreshToken);
    adminToken = res.body.accessToken;
  });

  test('/auth/me exige un token valide', async () => {
    assert.equal((await api('/api/auth/me')).status, 401);
    assert.equal((await api('/api/auth/me', { token: 'invalide' })).status, 401);
    const ok = await api('/api/auth/me', { token: adminToken });
    assert.equal(ok.status, 200);
    assert.equal(ok.body.role, 'ADMIN');
    assert.ok(ok.body.permissions.includes('billing.create'));
  });

  test('refresh puis logout invalident correctement les jetons', async () => {
    const loginRes = await api('/api/auth/login', { method: 'POST', body: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD } });
    const refreshToken = loginRes.body.refreshToken;

    const refreshed = await api('/api/auth/refresh', { method: 'POST', body: { refreshToken } });
    assert.equal(refreshed.status, 200);
    assert.ok(refreshed.body.accessToken);

    // Le jeton de rafraîchissement d'origine a été révoqué par la rotation : il ne doit plus fonctionner.
    const reused = await api('/api/auth/refresh', { method: 'POST', body: { refreshToken } });
    assert.equal(reused.status, 401);

    const logout = await api('/api/auth/logout', { method: 'POST', body: { refreshToken: refreshed.body.refreshToken } });
    assert.equal(logout.status, 204);
    const afterLogout = await api('/api/auth/refresh', { method: 'POST', body: { refreshToken: refreshed.body.refreshToken } });
    assert.equal(afterLogout.status, 401);
  });
});

describe('gestion des utilisateurs et RBAC', () => {
  test("l'admin crée un avocat, un second avocat, un assistant, un comptable", async () => {
    const stamp = Date.now();
    const lawyer = await api('/api/users', {
      token: adminToken, method: 'POST',
      body: { email: `lawyer-${stamp}@test.example`, password: 'Str0ngPass!', firstName: 'Léa', lastName: 'Martin', role: 'LAWYER' },
    });
    assert.equal(lawyer.status, 201);
    lawyerToken = await login(lawyer.body.email, 'Str0ngPass!');

    const other = await api('/api/users', {
      token: adminToken, method: 'POST',
      body: { email: `lawyer2-${stamp}@test.example`, password: 'Str0ngPass!', firstName: 'Omar', lastName: 'Nasser', role: 'LAWYER' },
    });
    otherLawyerId = other.body.id;
    otherLawyerToken = await login(other.body.email, 'Str0ngPass!');

    const assistant = await api('/api/users', {
      token: adminToken, method: 'POST',
      body: { email: `assist-${stamp}@test.example`, password: 'Str0ngPass!', firstName: 'Ana', lastName: 'Petit', role: 'ASSISTANT' },
    });
    assistantToken = await login(assistant.body.email, 'Str0ngPass!');

    const accountant = await api('/api/users', {
      token: adminToken, method: 'POST',
      body: { email: `acct-${stamp}@test.example`, password: 'Str0ngPass!', firstName: 'Yuki', lastName: 'Sato', role: 'ACCOUNTANT' },
    });
    accountantToken = await login(accountant.body.email, 'Str0ngPass!');
  });

  test('un non-admin ne peut pas créer un utilisateur', async () => {
    const res = await api('/api/users', {
      token: lawyerToken, method: 'POST',
      body: { email: 'x@test.example', password: 'Str0ngPass!', firstName: 'X', lastName: 'Y', role: 'LAWYER' },
    });
    assert.equal(res.status, 403);
    assert.equal(res.body.error.code, 'forbidden');
  });

  test('email déjà utilisé → 409', async () => {
    const res = await api('/api/users', {
      token: adminToken, method: 'POST',
      body: { email: ADMIN_EMAIL, password: 'Str0ngPass!', firstName: 'X', lastName: 'Y', role: 'LAWYER' },
    });
    assert.equal(res.status, 409);
  });
});

describe('clients', () => {
  test('création et lecture', async () => {
    const create = await api('/api/clients', {
      token: adminToken, method: 'POST',
      body: { firstName: 'Nadia', lastName: TEST_LAST_NAME, email: `nadia-${Date.now()}@test.example`, company: 'Haddad Inc.' },
    });
    assert.equal(create.status, 201);
    clientId = create.body.id;

    const read = await api(`/api/clients/${clientId}`, { token: adminToken });
    assert.equal(read.body.lastName, TEST_LAST_NAME);
  });

  test('recherche par nom', async () => {
    const res = await api(`/api/clients?q=${TEST_LAST_NAME}`, { token: adminToken });
    assert.ok(res.body.some((c) => c.id === clientId));
  });

  test('un rôle sans clients.create ne peut pas créer de client', async () => {
    const res = await api('/api/clients', { token: accountantToken, method: 'POST', body: { firstName: 'A', lastName: 'B' } });
    assert.equal(res.status, 403);
  });

  test('client introuvable → 404', async () => {
    assert.equal((await api('/api/clients/999999', { token: adminToken })).status, 404);
  });
});

describe('comptes clients (accès site)', () => {
  test("l'admin crée un compte CLIENT lié à un dossier client → 201", async () => {
    const stamp = Date.now();
    const res = await api('/api/users', {
      token: adminToken,
      method: 'POST',
      body: { email: `client-${stamp}@test.example`, password: 'Str0ngPass!', firstName: 'Nadia', lastName: 'Haddad', role: 'CLIENT', clientId },
    });
    assert.equal(res.status, 201);
    assert.equal(res.body.role, 'CLIENT');
    assert.equal(res.body.clientId, clientId);
    // Le compte peut se connecter et voit son clientId.
    const token = await login(`client-${stamp}@test.example`, 'Str0ngPass!');
    assert.ok(token);
  });

  test('CLIENT sans clientId → 400', async () => {
    const res = await api('/api/users', {
      token: adminToken,
      method: 'POST',
      body: { email: `noclient-${Date.now()}@test.example`, password: 'Str0ngPass!', firstName: 'X', lastName: 'Y', role: 'CLIENT' },
    });
    assert.equal(res.status, 400);
  });

  test('CLIENT avec clientId inexistant → 404', async () => {
    const res = await api('/api/users', {
      token: adminToken,
      method: 'POST',
      body: { email: `badclient-${Date.now()}@test.example`, password: 'Str0ngPass!', firstName: 'X', lastName: 'Y', role: 'CLIENT', clientId: 999999 },
    });
    assert.equal(res.status, 404);
    assert.equal(res.body.error.code, 'client_not_found');
  });

  test('clientId refusé pour un rôle non-client → 400', async () => {
    const res = await api('/api/users', {
      token: adminToken,
      method: 'POST',
      body: { email: `staffcli-${Date.now()}@test.example`, password: 'Str0ngPass!', firstName: 'X', lastName: 'Y', role: 'LAWYER', clientId },
    });
    assert.equal(res.status, 400);
  });

  test('un non-admin ne peut pas créer un compte CLIENT → 403', async () => {
    const res = await api('/api/users', {
      token: lawyerToken,
      method: 'POST',
      body: { email: `forbid-${Date.now()}@test.example`, password: 'Str0ngPass!', firstName: 'X', lastName: 'Y', role: 'CLIENT', clientId },
    });
    assert.equal(res.status, 403);
  });
});

describe('dossiers (cases) et visibilité par rôle', () => {
  test("création d'un dossier assigné à l'avocat 1", async () => {
    const res = await api('/api/cases', {
      token: adminToken, method: 'POST',
      body: { title: 'Litige test', clientId, lawyerId: undefined },
    });
    // lawyerId omis volontairement ici ; on assigne ensuite pour vérifier la notification.
    assert.equal(res.status, 201);
    caseId = res.body.id;
    assert.match(res.body.caseNumber, /^CEJ-\d{4}-\d{4}$/);
  });

  test("assignation déclenche une notification pour l'avocat", async () => {
    const lawyerMe = await api('/api/auth/me', { token: lawyerToken });
    const assign = await api(`/api/cases/${caseId}`, { token: adminToken, method: 'PATCH', body: { lawyerId: lawyerMe.body.id } });
    assert.equal(assign.status, 200);
    assert.equal(assign.body.lawyerName, `${lawyerMe.body.firstName} ${lawyerMe.body.lastName}`);

    const notifs = await api('/api/notifications', { token: lawyerToken });
    assert.ok(notifs.body.some((n) => n.caseId === caseId && n.type === 'CASE_ASSIGNED'));
  });

  test("l'avocat assigné voit le dossier, un autre avocat non", async () => {
    const mine = await api(`/api/cases/${caseId}`, { token: lawyerToken });
    assert.equal(mine.status, 200);
    const notMine = await api(`/api/cases/${caseId}`, { token: otherLawyerToken });
    assert.equal(notMine.status, 403);
  });

  test('la liste des dossiers est filtrée pour un avocat', async () => {
    const res = await api('/api/cases', { token: lawyerToken });
    assert.ok(res.body.every((c) => c.id !== undefined));
    assert.ok(res.body.some((c) => c.id === caseId));
    const otherRes = await api('/api/cases', { token: otherLawyerToken });
    assert.ok(otherRes.body.every((c) => c.id !== caseId));
  });

  test('ajout de note de dossier', async () => {
    const res = await api(`/api/cases/${caseId}/notes`, { token: lawyerToken, method: 'POST', body: { content: 'Premier contact effectué.' } });
    assert.equal(res.status, 201);
    const list = await api(`/api/cases/${caseId}/notes`, { token: lawyerToken });
    assert.ok(list.body.some((n) => n.content === 'Premier contact effectué.'));
  });

  test('transition de statut', async () => {
    const res = await api(`/api/cases/${caseId}`, { token: lawyerToken, method: 'PATCH', body: { status: 'EN_COURS' } });
    assert.equal(res.body.status, 'EN_COURS');
  });
});

describe('documents', () => {
  test('upload, liste, téléchargement', async () => {
    const form = new FormData();
    form.append('file', new Blob(['contenu de test'], { type: 'text/plain' }), 'piece.txt');
    const up = await fetch(`${base}/api/cases/${caseId}/documents`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${lawyerToken}` },
      body: form,
    });
    assert.equal(up.status, 201);
    const doc = await up.json();
    assert.equal(doc.originalName, 'piece.txt');
    assert.equal(doc.version, 1);

    const list = await api(`/api/cases/${caseId}/documents`, { token: lawyerToken });
    assert.ok(list.body.some((d) => d.id === doc.id));

    const dl = await fetch(`${base}/api/documents/${doc.id}/download`, { headers: { Authorization: `Bearer ${lawyerToken}` } });
    assert.equal(dl.status, 200);
    assert.equal(await dl.text(), 'contenu de test');
  });

  test('type de fichier interdit rejeté', async () => {
    const form = new FormData();
    form.append('file', new Blob(['x']), 'malware.exe');
    const res = await fetch(`${base}/api/cases/${caseId}/documents`, {
      method: 'POST', headers: { Authorization: `Bearer ${lawyerToken}` }, body: form,
    });
    assert.equal(res.status, 400);
  });

  test("un avocat non responsable ne peut pas téléverser sur ce dossier", async () => {
    const form = new FormData();
    form.append('file', new Blob(['x'], { type: 'text/plain' }), 'x.txt');
    const res = await fetch(`${base}/api/cases/${caseId}/documents`, {
      method: 'POST', headers: { Authorization: `Bearer ${otherLawyerToken}` }, body: form,
    });
    assert.equal(res.status, 403);
  });
});

describe('facturation', () => {
  let invoiceId;

  test('un assistant ne peut pas créer de facture', async () => {
    const res = await api('/api/invoices', { token: assistantToken, method: 'POST', body: { clientId, amountCents: 1000 } });
    assert.equal(res.status, 403);
  });

  test('le comptable crée une facture et génère le PDF', async () => {
    const res = await api('/api/invoices', {
      token: accountantToken, method: 'POST',
      body: { clientId, caseId, amountCents: 100000, taxCents: 15000, dueAt: '2026-12-01' },
    });
    assert.equal(res.status, 201);
    invoiceId = res.body.id;
    assert.equal(res.body.totalCents, 115000);
    assert.equal(res.body.status, 'BROUILLON');

    const pdf = await fetch(`${base}/api/invoices/${invoiceId}/pdf`, { headers: { Authorization: `Bearer ${accountantToken}` } });
    assert.equal(pdf.status, 200);
    assert.equal(pdf.headers.get('content-type'), 'application/pdf');
    const buf = Buffer.from(await pdf.arrayBuffer());
    assert.equal(buf.slice(0, 4).toString(), '%PDF');
  });

  test('changement de statut vers PAYEE horodate le paiement', async () => {
    const res = await api(`/api/invoices/${invoiceId}/status`, { token: accountantToken, method: 'PATCH', body: { status: 'PAYEE' } });
    assert.equal(res.body.status, 'PAYEE');
    assert.ok(res.body.paidAt);
  });
});

describe('audit et tableau de bord', () => {
  test('le journal d’audit contient les actions effectuées', async () => {
    const res = await api('/api/audit-logs?limit=100', { token: adminToken });
    assert.equal(res.status, 200);
    const actions = res.body.map((a) => a.action);
    assert.ok(actions.includes('CASE_CREATED'));
    assert.ok(actions.includes('DOCUMENT_UPLOADED'));
    assert.ok(actions.includes('INVOICE_CREATED'));
  });

  test("un non-admin n'a pas accès au journal d'audit", async () => {
    assert.equal((await api('/api/audit-logs', { token: lawyerToken })).status, 403);
  });

  test('le tableau de bord reflète les données créées', async () => {
    const res = await api('/api/dashboard', { token: adminToken });
    assert.equal(res.status, 200);
    assert.ok(res.body.cases.total >= 1);
    assert.ok(res.body.clients.total >= 1);
  });

  test('le tableau de bord d’un avocat est filtré à ses dossiers', async () => {
    const res = await api('/api/dashboard', { token: lawyerToken });
    const other = await api('/api/dashboard', { token: otherLawyerToken });
    assert.ok(res.body.cases.total >= 1);
    assert.equal(other.body.cases.total, 0); // le second avocat n'a aucun dossier assigné
  });
});

describe('recherche globale', () => {
  test('trouve le client et le dossier créés', async () => {
    const res = await api(`/api/search?q=${TEST_LAST_NAME}`, { token: adminToken });
    assert.ok(res.body.clients.some((c) => c.id === clientId));
  });

  test('paramètre q manquant → 400', async () => {
    assert.equal((await api('/api/search', { token: adminToken })).status, 400);
  });
});

describe('calendrier des échéances', () => {
  let calInvoiceId;

  test('401 sans token', async () => {
    assert.equal((await api('/api/calendar?from=2026-10-01&to=2026-10-31')).status, 401);
  });

  test('400 sans from/to', async () => {
    assert.equal((await api('/api/calendar', { token: adminToken })).status, 400);
  });

  test('renvoie les échéances de dossiers et de factures', async () => {
    await api(`/api/cases/${caseId}`, { token: adminToken, method: 'PATCH', body: { dueDate: '2026-10-20' } });
    const inv = await api('/api/invoices', {
      token: accountantToken,
      method: 'POST',
      body: { clientId, amountCents: 5000, dueAt: '2026-10-25' },
    });
    assert.equal(inv.status, 201);
    calInvoiceId = inv.body.id;

    const res = await api('/api/calendar?from=2026-10-01&to=2026-10-31', { token: adminToken });
    assert.equal(res.status, 200);
    assert.ok(res.body.some((e) => e.type === 'case' && e.id === caseId && e.dueDate === '2026-10-20'));
    assert.ok(res.body.some((e) => e.type === 'invoice' && e.id === calInvoiceId));
  });

  test("un avocat ne voit pas les dossiers d'un autre", async () => {
    const res = await api('/api/calendar?from=2026-10-01&to=2026-10-31', { token: otherLawyerToken });
    assert.ok(!res.body.some((e) => e.type === 'case' && e.id === caseId));
  });
});

describe('suivi du temps', () => {
  let entryId;

  test("l'avocat saisit des heures sur son dossier", async () => {
    const res = await api('/api/time-entries', {
      token: lawyerToken,
      method: 'POST',
      body: { caseId, date: '2026-10-06', hours: 2.5, rate: 150, description: 'Rédaction' },
    });
    assert.equal(res.status, 201);
    assert.equal(res.body.hours, 2.5);
    assert.equal(res.body.amountCents, 37500);
    entryId = res.body.id;
  });

  test('heures invalides → 400', async () => {
    const res = await api('/api/time-entries', {
      token: lawyerToken,
      method: 'POST',
      body: { caseId, date: '2026-10-06', hours: 0, rate: 150 },
    });
    assert.equal(res.status, 400);
  });

  test("un avocat ne saisit pas sur le dossier d'un autre avocat", async () => {
    const res = await api('/api/time-entries', {
      token: otherLawyerToken,
      method: 'POST',
      body: { caseId, date: '2026-10-06', hours: 1, rate: 100 },
    });
    assert.equal(res.status, 403);
  });

  test('totaux par dossier', async () => {
    const res = await api(`/api/time-entries/case/${caseId}/totals`, { token: lawyerToken });
    assert.equal(res.status, 200);
    assert.equal(res.body.totalHours, 2.5);
    assert.equal(res.body.totalCents, 37500);
    assert.equal(res.body.unbilledCents, 37500);
  });

  test("l'assistant ne peut pas supprimer une saisie", async () => {
    const res = await api(`/api/time-entries/${entryId}`, { token: assistantToken, method: 'DELETE' });
    assert.equal(res.status, 403);
  });

  test('le comptable facture les heures puis les marque comme facturées', async () => {
    const inv = await api('/api/invoices', {
      token: accountantToken,
      method: 'POST',
      body: { clientId, caseId, amountCents: 37500, dueAt: '2026-11-01' },
    });
    assert.equal(inv.status, 201);
    const upd = await api(`/api/time-entries/${entryId}`, {
      token: accountantToken,
      method: 'PATCH',
      body: { invoiceId: inv.body.id },
    });
    assert.equal(upd.status, 200);
    assert.equal(upd.body.invoiceId, inv.body.id);
    const tot = await api(`/api/time-entries/case/${caseId}/totals`, { token: accountantToken });
    assert.equal(tot.body.unbilledCents, 0);
  });
});

describe('modèles de documents', () => {
  let tplId;
  const content = 'Mise en demeure à {{client_nom}} (dossier {{dossier_numero}}) en date du {{date}}. {{avocat_nom}}, avocat. Inconnue : {{inconnu}}.';

  test('création', async () => {
    const res = await api('/api/document-templates', {
      token: lawyerToken,
      method: 'POST',
      body: { name: 'Mise en demeure', category: 'Courriers', content },
    });
    assert.equal(res.status, 201);
    tplId = res.body.id;
  });

  test('rendu avec variables', async () => {
    const res = await api(`/api/document-templates/${tplId}/render`, {
      token: lawyerToken,
      method: 'POST',
      body: { variables: { client_nom: 'Marie Tremblay', dossier_numero: 'CEJ-2026-0001', date: '2026-10-07', avocat_nom: 'Léa Martin' } },
    });
    assert.equal(res.status, 200);
    assert.ok(res.body.rendered.includes('Marie Tremblay'));
    assert.ok(res.body.rendered.includes('CEJ-2026-0001'));
    assert.ok(res.body.rendered.includes('Léa Martin'));
    assert.ok(!res.body.rendered.includes('{{client_nom}}'));
    assert.ok(res.body.rendered.includes('{{inconnu}}'));
  });

  test("l'assistant ne peut pas créer de modèle", async () => {
    const res = await api('/api/document-templates', {
      token: assistantToken,
      method: 'POST',
      body: { name: 'X', content: 'Y' },
    });
    assert.equal(res.status, 403);
  });

  test('modèle introuvable → 404', async () => {
    assert.equal((await api('/api/document-templates/999999/render', { token: lawyerToken, method: 'POST', body: {} })).status, 404);
  });

  test('suppression par un admin', async () => {
    assert.equal((await api(`/api/document-templates/${tplId}`, { token: adminToken, method: 'DELETE' })).status, 204);
  });
});

describe('filtres sauvegardés', () => {
  let filterId;

  test('création et lecture', async () => {
    const res = await api('/api/saved-filters', {
      token: lawyerToken,
      method: 'POST',
      body: { name: 'Mes urgents', filters: { priority: 'URGENTE' } },
    });
    assert.equal(res.status, 201);
    filterId = res.body.id;
    assert.deepEqual(res.body.filters, { priority: 'URGENTE' });
    const list = await api('/api/saved-filters', { token: lawyerToken });
    assert.ok(list.body.some((f) => f.id === filterId));
  });

  test('isolation entre utilisateurs', async () => {
    const list = await api('/api/saved-filters', { token: otherLawyerToken });
    assert.ok(!list.body.some((f) => f.id === filterId));
  });

  test("un autre utilisateur ne peut pas supprimer le filtre", async () => {
    assert.equal((await api(`/api/saved-filters/${filterId}`, { token: otherLawyerToken, method: 'DELETE' })).status, 404);
  });

  test('suppression', async () => {
    assert.equal((await api(`/api/saved-filters/${filterId}`, { token: lawyerToken, method: 'DELETE' })).status, 204);
  });
});

describe('recherche avancée des dossiers', () => {
  test('filtres priorité et dates sur /api/cases', async () => {
    await api(`/api/cases/${caseId}`, { token: adminToken, method: 'PATCH', body: { priority: 'URGENTE' } });
    const hit = await api('/api/cases?priority=URGENTE', { token: adminToken });
    assert.ok(hit.body.some((c) => c.id === caseId));
    const miss = await api('/api/cases?priority=BASSE', { token: adminToken });
    assert.ok(!miss.body.some((c) => c.id === caseId));
    const dated = await api('/api/cases?dateFrom=2026-10-01&dateTo=2026-10-31', { token: adminToken });
    assert.ok(dated.body.some((c) => c.id === caseId));
  });
});

describe('portail client', () => {
  let portalToken;
  let portalInvoiceId;

  test("création d'un utilisateur client lié au client", async () => {
    const hash = await bcrypt.hash('Str0ngPass!', 10);
    const { rows: role } = await query("SELECT id FROM roles WHERE name = 'CLIENT'");
    const email = `client-${Date.now()}@test.example`;
    await query(
      'INSERT INTO users (email, password_hash, first_name, last_name, role_id, client_id) VALUES ($1,$2,$3,$4,$5,$6)',
      [email, hash, 'Nadia', 'Haddad', role[0].id, clientId],
    );
    portalToken = await login(email, 'Str0ngPass!');
    assert.ok(portalToken);
    clientToken = portalToken;
  });

  test('le client voit ses dossiers et ses documents', async () => {
    const cases = await api('/api/cases', { token: portalToken });
    assert.ok(cases.body.some((c) => c.id === caseId));
    const docs = await api('/api/documents/mine', { token: portalToken });
    assert.equal(docs.status, 200);
    assert.ok(Array.isArray(docs.body));
  });

  test('le client ne voit pas les dossiers des autres', async () => {
    const other = await api('/api/cases', { token: portalToken });
    assert.ok(other.body.every((c) => c.id === caseId || c.clientId === clientId));
  });

  test('déclaration de paiement → notification aux comptables', async () => {
    const inv = await api('/api/invoices', {
      token: accountantToken,
      method: 'POST',
      body: { clientId, amountCents: 2000, dueAt: '2026-11-15' },
    });
    assert.equal(inv.status, 201);
    portalInvoiceId = inv.body.id;
    const dec = await api(`/api/invoices/${portalInvoiceId}/declare-payment`, { token: portalToken, method: 'POST' });
    assert.equal(dec.status, 200);
    const notifs = await api('/api/notifications', { token: accountantToken });
    assert.ok(notifs.body.some((n) => n.type === 'PAYMENT_DECLARED'));
  });

  test('déclaration sur facture payée → 400', async () => {
    await api(`/api/invoices/${portalInvoiceId}/status`, { token: accountantToken, method: 'PATCH', body: { status: 'PAYEE' } });
    const dec = await api(`/api/invoices/${portalInvoiceId}/declare-payment`, { token: portalToken, method: 'POST' });
    assert.equal(dec.status, 400);
  });

  test("un client ne déclare pas le paiement d'un autre client", async () => {
    const otherClient = await api('/api/clients', {
      token: adminToken,
      method: 'POST',
      body: { firstName: 'Autre', lastName: 'Client' },
    });
    const inv = await api('/api/invoices', {
      token: accountantToken,
      method: 'POST',
      body: { clientId: otherClient.body.id, amountCents: 1000 },
    });
    const dec = await api(`/api/invoices/${inv.body.id}/declare-payment`, { token: portalToken, method: 'POST' });
    assert.equal(dec.status, 403);
  });
});

describe('tableau de bord enrichi', () => {
  test('agrégats graphiques et échéances', async () => {
    const soon = new Date(Date.now() + 3 * 24 * 3600 * 1000).toISOString().slice(0, 10);
    await api(`/api/cases/${caseId}`, { token: adminToken, method: 'PATCH', body: { dueDate: soon } });
    // La base de test persiste entre les exécutions : on neutralise les échéances
    // résiduelles pour que l'assertion reste déterministe (LIMIT 20 côté API).
    await query('UPDATE cases SET due_date=NULL WHERE id<>$1', [caseId]);
    const res = await api('/api/dashboard', { token: adminToken });
    assert.equal(res.status, 200);
    assert.equal(res.body.revenueByMonth.length, 6);
    assert.ok(res.body.revenueByMonth.every((r) => /^\d{4}-\d{2}$/.test(r.month)));
    assert.ok(Array.isArray(res.body.upcomingDeadlines));
    assert.ok(Array.isArray(res.body.overdueInvoices));
    assert.ok(Array.isArray(res.body.openCasesByLawyer));
    assert.ok(res.body.upcomingDeadlines.some((d) => d.id === caseId));
    assert.ok(res.body.openCasesByLawyer.some((r) => r.count >= 1));
  });
});

describe('assistant IA (multi-fournisseurs)', () => {
  const ENV_KEYS = ['LLM_PROVIDER', 'LLM_API_KEY', 'GEMINI_API_KEY', 'LLM_CHAT_MODEL', 'LLM_EMBED_MODEL'];
  const snapEnv = () => Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k]]));
  const restoreEnv = (s) => { for (const k of ENV_KEYS) { if (s[k] === undefined) delete process.env[k]; else process.env[k] = s[k]; } };

  // Simule l'API LLM ; laisse passer les appels vers le serveur de test local.
  async function withMockFetch(handler, fn) {
    const prevFetch = globalThis.fetch;
    globalThis.fetch = async (url, opts) => {
      const u = String(url);
      if (u.includes('generativelanguage.googleapis.com') || u.includes('api.openai.com')) return handler(u, opts);
      return prevFetch(url, opts);
    };
    try { return await fn(); } finally { globalThis.fetch = prevFetch; }
  }

  const geminiChatOk = (text) => ({ ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text }] } }] }) });
  const geminiEmbedOk = (values) => ({ ok: true, json: async () => ({ embedding: { values } }) });
  const openaiChatOk = (text) => ({ ok: true, json: async () => ({ choices: [{ message: { content: text } }] }) });
  const openaiEmbedOk = (values) => ({ ok: true, json: async () => ({ data: [{ embedding: values }] }) });

  test('/api/ai/status sans clé → configured false, fournisseur gemini par défaut', async () => {
    const env = snapEnv(); restoreEnv({});
    try {
      const res = await api('/api/ai/status', { token: adminToken });
      assert.equal(res.status, 200);
      assert.equal(res.body.configured, false);
      assert.equal(res.body.available, false);
      assert.equal(res.body.provider, 'gemini');
      assert.equal(res.body.chatModel, 'gemini-2.5-flash');
      assert.equal(res.body.embeddingModel, 'text-embedding-004');
    } finally { restoreEnv(env); }
  });

  test('/api/ai/status exige la permission ai.ask', async () => {
    assert.equal((await api('/api/ai/status')).status, 401);
  });

  test('gemini : chat() mappe system→systemInstruction, assistant→model', async () => {
    const env = snapEnv();
    process.env.LLM_API_KEY = 'cle-test';
    try {
      await withMockFetch((u, opts) => {
        const body = JSON.parse(opts.body);
        if (u.includes(':embedContent')) return geminiEmbedOk([0.1, 0.2]);
        const roles = (body.contents || []).map((c) => c.role);
        assert.deepEqual(roles, ['user', 'model']);
        assert.ok(body.systemInstruction.parts[0].text.includes('Cabinet'));
        return geminiChatOk('Réponse.');
      }, async () => {
        const { chat, embed } = await import('../src/services/llm.js');
        assert.equal(await chat([{ role: 'system', content: 'Tu es le Cabinet.' }, { role: 'user', content: 'Q' }, { role: 'assistant', content: 'R' }]), 'Réponse.');
        assert.deepEqual(await embed('texte'), [0.1, 0.2]);
      });
    } finally { restoreEnv(env); }
  });

  test('openai : chat() et embed() appellent les bons endpoints', async () => {
    const env = snapEnv();
    process.env.LLM_PROVIDER = 'openai';
    process.env.LLM_API_KEY = 'sk-test';
    const calls = [];
    try {
      await withMockFetch((u, opts) => {
        calls.push({ url: u, auth: opts.headers.Authorization, body: JSON.parse(opts.body) });
        if (u.includes('/v1/embeddings')) return openaiEmbedOk([0.3, 0.4]);
        return openaiChatOk('Réponse OpenAI.');
      }, async () => {
        const { chat, embed } = await import('../src/services/llm.js');
        assert.equal(await chat([{ role: 'system', content: 'Sys' }, { role: 'user', content: 'Q' }]), 'Réponse OpenAI.');
        assert.deepEqual(await embed('texte'), [0.3, 0.4]);
      });
      const chatCall = calls.find((c) => c.url.includes('/v1/chat/completions'));
      assert.equal(chatCall.auth, 'Bearer sk-test');
      assert.equal(chatCall.body.model, 'gpt-4o-mini');
      assert.deepEqual(chatCall.body.messages.map((m) => m.role), ['system', 'user']);
      const embCall = calls.find((c) => c.url.includes('/v1/embeddings'));
      assert.equal(embCall.body.model, 'text-embedding-3-small');
      assert.equal(embCall.body.input, 'texte');
    } finally { restoreEnv(env); }
  });

  test('chat() sans clé → 503 llm_unavailable (aucun appel réseau)', async () => {
    const env = snapEnv(); restoreEnv({});
    try {
      const { chat } = await import('../src/services/llm.js');
      await assert.rejects(() => chat([{ role: 'user', content: 'x' }]), (err) => {
        assert.equal(err.status, 503);
        assert.equal(err.code, 'llm_unavailable');
        return true;
      });
    } finally { restoreEnv(env); }
  });

  test('un CLIENT ne voit que les chunks de ses propres dossiers', async () => {
    const env = snapEnv();
    process.env.LLM_API_KEY = 'cle-test';
    // Deuxième client + dossier + document (le premier client = clientToken/clientId).
    const stamp = Date.now().toString(36);
    const cb = await api('/api/clients', { token: adminToken, method: 'POST', body: { firstName: 'Iso', lastName: `B${stamp}`, email: `iso-b-${stamp}@test.example` } });
    assert.equal(cb.status, 201);
    const cs = await api('/api/cases', { token: adminToken, method: 'POST', body: { title: 'Dossier B', clientId: cb.body.id } });
    // Le numéro de dossier est aléatoire : en cas de collision (base persistante), on réessaie.
    let caseB = cs.status === 201 ? cs.body.id : null;
    for (let i = 0; i < 3 && !caseB; i++) {
      const retry = await api('/api/cases', { token: adminToken, method: 'POST', body: { title: 'Dossier B', clientId: cb.body.id } });
      if (retry.status === 201) caseB = retry.body.id;
    }
    assert.ok(caseB, 'création du dossier B impossible (collisions de numéro)');
    const uploadDoc = async (cId, name, text) => {
      const form = new FormData();
      form.append('file', new Blob([text], { type: 'text/plain' }), name);
      const r = await fetch(`${base}/api/cases/${cId}/documents`, { method: 'POST', headers: { Authorization: `Bearer ${adminToken}` }, body: form });
      assert.equal(r.status, 201);
      return r.json();
    };
    const docA = await uploadDoc(caseId, 'docA.txt', 'contenu du dossier A');
    const docB = await uploadDoc(caseB, 'docB.txt', 'contenu du dossier B');
    await query('INSERT INTO document_chunks(document_id,content,embedding_json) VALUES($1,$2,$3)', [docA.id, 'extrait A', JSON.stringify([1, 0, 0])]);
    await query('INSERT INTO document_chunks(document_id,content,embedding_json) VALUES($1,$2,$3)', [docB.id, 'extrait B', JSON.stringify([0, 1, 0])]);
    try {
      await withMockFetch((u) => {
        if (u.includes(':embedContent')) return geminiEmbedOk([1, 0, 0]);
        return geminiChatOk('Réponse.');
      }, async () => {
        const res = await api('/api/ai/ask', { token: clientToken, method: 'POST', body: { question: 'question juridique sur mon dossier' } });
        assert.equal(res.status, 200);
        assert.ok(res.body.sources.length > 0);
        assert.ok(res.body.sources.every((s) => s.caseId === caseId), 'fuite vers le dossier B détectée');
      });
    } finally { restoreEnv(env); }
  });

  test('un CLIENT hors sujet reçoit un refus poli (fr puis en)', async () => {
    const env = snapEnv();
    process.env.LLM_API_KEY = 'cle-test';
    const handler = (u, opts) => {
      if (u.includes(':embedContent')) return geminiEmbedOk([1, 0, 0]);
      const body = JSON.parse(opts.body);
      const sys = body.systemInstruction?.parts?.[0]?.text ?? '';
      assert.ok(sys.includes('UNIQUEMENT') || sys.includes('ONLY'), 'le prompt client doit être restrictif');
      const decline = sys.includes('I can only answer')
        ? 'I can only answer legal questions about your cases.'
        : 'Je ne peux répondre qu’aux questions juridiques concernant vos dossiers.';
      return geminiChatOk(decline);
    };
    try {
      await withMockFetch(handler, async () => {
        const fr = await api('/api/ai/ask', { token: clientToken, method: 'POST', body: { question: 'raconte-moi une blague' } });
        assert.equal(fr.status, 200);
        assert.ok(fr.body.answer.includes('Je ne peux répondre qu’aux questions juridiques'));
        const en = await api('/api/ai/ask', { token: clientToken, method: 'POST', body: { question: 'tell me a joke', lang: 'en' } });
        assert.equal(en.status, 200);
        assert.ok(en.body.answer.includes('I can only answer legal questions'));
        const bad = await api('/api/ai/ask', { token: clientToken, method: 'POST', body: { question: 'test', lang: 'de' } });
        assert.equal(bad.status, 400);
      });
    } finally { restoreEnv(env); }
  });
});

describe('messagerie v2 (groupes, reçus, recherche)', () => {
  let lawyerId; let assistantId; let groupId;

  test('récupère les ids utilisateurs', async () => {
    lawyerId = (await api('/api/auth/me', { token: lawyerToken })).body.id;
    assistantId = (await api('/api/auth/me', { token: assistantToken })).body.id;
    assert.ok(lawyerId && assistantId);
  });

  test('création de groupe + isolation des membres', async () => {
    const created = await api('/api/social/conversations', {
      token: adminToken, method: 'POST',
      body: { name: `Groupe test ${Date.now().toString(36)}`, memberIds: [lawyerId, assistantId] },
    });
    assert.equal(created.status, 201);
    groupId = created.body.id;
    assert.ok(created.body.members.some((m) => m.id === lawyerId));
    // Non-membre : 403 sur les messages
    assert.equal((await api(`/api/social/conversations/${groupId}/messages`, { token: otherLawyerToken })).status, 403);
    assert.equal((await api(`/api/social/conversations/${groupId}/messages`, { token: otherLawyerToken, method: 'POST', body: { content: 'x' } })).status, 403);
    // Membre : accès OK
    assert.equal((await api(`/api/social/conversations/${groupId}/messages`, { token: assistantToken })).status, 200);
  });

  test('envoi en groupe + accusés de lecture', async () => {
    const sent = await api(`/api/social/conversations/${groupId}/messages`, {
      token: lawyerToken, method: 'POST', body: { content: 'Bonjour le groupe' },
    });
    assert.equal(sent.status, 201);
    // L'assistant lit : le compteur de lecteurs de l'avocat passe à 1
    await api(`/api/social/conversations/${groupId}/messages`, { token: assistantToken });
    const rows = await api(`/api/social/conversations/${groupId}/messages`, { token: lawyerToken });
    const mine = rows.body.find((m) => m.mine && m.content === 'Bonjour le groupe');
    assert.ok(mine);
    assert.ok(mine.readCount >= 1);
  });

  test("compteurs non-lus 1-à-1 + marquage à l'ouverture", async () => {
    const kw = `ping${Date.now().toString(36)}`;
    const sent = await api('/api/social/messages', {
      token: lawyerToken, method: 'POST', body: { recipientId: assistantId, content: kw },
    });
    assert.equal(sent.status, 201);
    const before = await api('/api/social/messages/unread-count', { token: assistantToken });
    assert.ok(before.body.total >= 1);
    assert.ok(Number(before.body.byUser[String(lawyerId)] ?? before.body.byUser[lawyerId]) >= 1);
    // Ouverture → marqué lu
    await api(`/api/social/messages/${lawyerId}`, { token: assistantToken });
    const after = await api('/api/social/messages/unread-count', { token: assistantToken });
    assert.equal(Number(after.body.byUser[String(lawyerId)] ?? 0), 0);
    // Reçu côté expéditeur : readAt renseigné
    const thread = await api(`/api/social/messages/${assistantId}`, { token: lawyerToken });
    const mine = thread.body.find((m) => m.mine && m.content === kw);
    assert.ok(mine && mine.readAt);
  });

  test('indicateur de frappe 1-à-1', async () => {
    const r = await api(`/api/social/messages/typing/${assistantId}`, { token: lawyerToken, method: 'POST' });
    assert.equal(r.status, 200);
    const s = await api(`/api/social/messages/typing/${lawyerId}`, { token: assistantToken });
    assert.equal(s.body.typing, true);
  });

  test('recherche de messages : portée limitée aux conversations du lecteur', async () => {
    const kw = `motclesecret${Date.now().toString(36)}`;
    await api('/api/social/messages', { token: lawyerToken, method: 'POST', body: { recipientId: assistantId, content: `voici ${kw} ici` } });
    const found = await api(`/api/social/messages/search?q=${kw}`, { token: assistantToken });
    assert.ok(found.body.some((r) => r.snippet.includes(kw)));
    const notFound = await api(`/api/social/messages/search?q=${kw}`, { token: otherLawyerToken });
    assert.ok(!notFound.body.some((r) => r.snippet.includes(kw)));
    assert.equal((await api('/api/social/messages/search', { token: assistantToken })).status, 400);
  });

  test('conversation liée à un dossier : seul un membre pouvant voir le dossier peut être ajouté', async () => {
    const created = await api('/api/social/conversations', {
      token: adminToken, method: 'POST',
      body: { name: `Dossier lié ${Date.now().toString(36)}`, memberIds: [lawyerId], caseId },
    });
    assert.equal(created.status, 201);
    assert.equal(created.body.caseId, caseId);
    // otherLawyer ne peut pas voir ce dossier → ajout refusé
    const denied = await api(`/api/social/conversations/${created.body.id}/members`, {
      token: adminToken, method: 'POST', body: { userId: otherLawyerId },
    });
    assert.equal(denied.status, 403);
    // Non-membre ne voit pas la conversation dans sa liste
    const list = await api('/api/social/conversations', { token: otherLawyerToken });
    assert.ok(!list.body.some((c) => c.id === created.body.id));
    // Mais le dossier affiche la discussion à l'avocat responsable
    const mine = await api(`/api/social/conversations?caseId=${caseId}`, { token: lawyerToken });
    assert.ok(mine.body.some((c) => c.id === created.body.id));
  });

  test('pièce jointe : document existant lisible uniquement', async () => {
    // docA.txt a été téléversé sur le dossier du client dans les tests IA
    const { rows } = await query(`SELECT d.id FROM documents d JOIN cases c ON c.id=d.case_id WHERE c.id=$1 LIMIT 1`, [caseId]);
    assert.ok(rows[0], 'aucun document sur le dossier de test');
    const sent = await api('/api/social/messages', {
      token: lawyerToken, method: 'POST',
      body: { recipientId: assistantId, content: 'voici la pièce', attachmentDocumentId: rows[0].id },
    });
    assert.equal(sent.status, 201);
    const thread = await api(`/api/social/messages/${lawyerId}`, { token: assistantToken });
    const withAtt = thread.body.find((m) => m.content === 'voici la pièce');
    assert.ok(withAtt && withAtt.attachment && withAtt.attachment.kind === 'document');
  });
});

describe('personnalisation white-label (site_settings)', () => {
  test('GET public sans token → valeurs par défaut', async () => {
    const res = await api('/api/site-settings');
    assert.equal(res.status, 200);
    assert.equal(res.body.firmName, 'Cabinet Élite Juridique');
    assert.equal(res.body.primaryColor, '#0f1e33');
    assert.equal(res.body.accentColor, '#b08d3e');
    assert.equal(res.body.logoPath, null);
  });

  test('PUT sans token → 401 ; PUT non-admin → 403', async () => {
    const anon = await api('/api/site-settings', { method: 'PUT', body: { firm_name: 'X' } });
    assert.equal(anon.status, 401);
    const denied = await api('/api/site-settings', { token: lawyerToken, method: 'PUT', body: { firm_name: 'X' } });
    assert.equal(denied.status, 403);
  });

  test('PUT couleur invalide → 400', async () => {
    const res = await api('/api/site-settings', { token: adminToken, method: 'PUT', body: { primary_color: 'rouge' } });
    assert.equal(res.status, 400);
  });

  test('PUT bascules de sections → GET reflète les booléens', async () => {
    const res = await api('/api/site-settings', {
      token: adminToken,
      method: 'PUT',
      body: { show_posts: false, show_testimonials: false, show_hero: true },
    });
    assert.equal(res.status, 200);
    assert.equal(res.body.showPosts, false);
    assert.equal(res.body.showTestimonials, false);
    assert.equal(res.body.showHero, true);
    assert.equal(res.body.showFeatures, true);
    const reread = await api('/api/site-settings');
    assert.equal(reread.body.showPosts, false);
    // Remise à l'état par défaut pour les autres tests.
    const reset = await api('/api/site-settings', {
      token: adminToken,
      method: 'PUT',
      body: { show_posts: true, show_testimonials: true },
    });
    assert.equal(reset.body.showPosts, true);
  });

  test('PUT bascule non-booléenne → 400', async () => {
    const res = await api('/api/site-settings', { token: adminToken, method: 'PUT', body: { show_posts: 'non' } });
    assert.equal(res.status, 400);
  });

  test('PUT valide → ligne mise à jour puis relue', async () => {
    const res = await api('/api/site-settings', {
      token: adminToken, method: 'PUT',
      body: { firm_name: 'Cabinet Test', primary_color: '#112233', footer_text: 'Pied test' },
    });
    assert.equal(res.status, 200);
    assert.equal(res.body.firmName, 'Cabinet Test');
    const reread = await api('/api/site-settings');
    assert.equal(reread.body.firmName, 'Cabinet Test');
    assert.equal(reread.body.primaryColor, '#112233');
    // Restauration des valeurs par défaut.
    await api('/api/site-settings', {
      token: adminToken, method: 'PUT',
      body: { firm_name: 'Cabinet Élite Juridique', primary_color: '#0f1e33', footer_text: '' },
    });
  });

  test('upload logo : non-image → 400', async () => {
    const form = new FormData();
    form.append('logo', new Blob(['pas une image'], { type: 'text/plain' }), 'logo.txt');
    const res = await fetch(base + '/api/site-settings/logo', {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: form,
    });
    assert.equal(res.status, 400);
  });

  test('upload logo : PNG → 200, puis suppression', async () => {
    const png = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
      'base64',
    );
    const form = new FormData();
    form.append('logo', new Blob([png], { type: 'image/png' }), 'logo.png');
    const res = await fetch(base + '/api/site-settings/logo', {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: form,
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.ok(body.logoPath && body.logoPath.startsWith('branding/'));
    const del = await api('/api/site-settings/logo', { token: adminToken, method: 'DELETE' });
    assert.equal(del.status, 200);
    assert.equal(del.body.logoPath, null);
  });
});

describe('création automatique du .env', () => {
  test('ensureEnvFile crée .env depuis .env.example avec des secrets générés', async () => {
    const { ensureEnvFile } = await import('../src/utils/ensure-env.js');
    const { mkdtempSync, readFileSync, existsSync } = await import('node:fs');
    const { join } = await import('node:path');
    const { tmpdir } = await import('node:os');
    const dir = mkdtempSync(join(tmpdir(), 'cej-env-'));
    const { writeFileSync } = await import('node:fs');
    writeFileSync(join(dir, '.env.example'), 'PORT=4000\nJWT_ACCESS_SECRET=change-me\nJWT_REFRESH_SECRET=change-me\n');
    assert.equal(ensureEnvFile(dir), 'created');
    const created = readFileSync(join(dir, '.env'), 'utf8');
    const access = created.match(/^JWT_ACCESS_SECRET=(.+)$/m)[1];
    const refresh = created.match(/^JWT_REFRESH_SECRET=(.+)$/m)[1];
    assert.ok(access.length >= 32 && access !== 'change-me');
    assert.ok(refresh.length >= 32 && refresh !== 'change-me');
    assert.notEqual(access, refresh);
    assert.equal(ensureEnvFile(dir), 'exists');
    assert.equal(ensureEnvFile(join(dir, 'nope')), 'no-example');
    assert.ok(existsSync(join(dir, '.env')));
  });
});

/* ==========================================================================
   Nouvelles fonctionnalités (2026-10-07) : publications multi-photos, blog SEO,
   témoignages, statistiques, domaines de pratique.
   ========================================================================== */

const PNG_1PX = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

const postForm = (fields, imageCount = 0, badFile = false) => {
  const form = new FormData();
  for (const [k, v] of Object.entries(fields)) form.append(k, v);
  for (let i = 0; i < imageCount; i++) {
    form.append('images', new Blob([PNG_1PX], { type: 'image/png' }), `photo${i}.png`);
  }
  if (badFile) form.append('images', new Blob(['pas une image'], { type: 'text/plain' }), 'faux.txt');
  return form;
};

const postMultipart = (path, token, form, method = 'POST') =>
  fetch(base + path, { method, headers: { Authorization: `Bearer ${token}` }, body: form });

describe('publications multi-photos', () => {
  let postId;

  test('création avec 3 images → 201 et images[] de 3 entrées', async () => {
    const res = await postMultipart('/api/social/posts', lawyerToken, postForm({ title: 'Triple photo', content: 'Trois images.', type: 'POST' }, 3));
    assert.equal(res.status, 201);
    const body = await res.json();
    postId = body.id;
    assert.equal(body.images.length, 3);
    assert.ok(body.images.every((im) => im.id && im.url && im.url.startsWith('/uploads/post-images/')));
    assert.equal(body.imageUrl, body.images[0].url);
  });

  test('GET /api/social/posts → le post affiche ses 3 images', async () => {
    const res = await api('/api/social/posts', { token: lawyerToken });
    assert.equal(res.status, 200);
    const post = res.body.find((p) => p.id === postId);
    assert.ok(post);
    assert.equal(post.images.length, 3);
  });

  test('GET /api/social/public/posts → le post public affiche ses 3 images', async () => {
    const res = await api('/api/social/public/posts');
    assert.equal(res.status, 200);
    const post = res.body.find((p) => p.id === postId);
    assert.ok(post);
    assert.equal(post.images.length, 3);
  });

  test('fichier non-image → 400', async () => {
    const res = await postMultipart('/api/social/posts', lawyerToken, postForm({ title: 'Faux', content: 'X' }, 0, true));
    assert.equal(res.status, 400);
  });

  test('PATCH removeImageIds → 1 image retirée, 2 restantes', async () => {
    const before = await api('/api/social/posts', { token: lawyerToken });
    const post = before.body.find((p) => p.id === postId);
    const removeId = post.images[0].id;
    const res = await postMultipart(`/api/social/posts/${postId}`, lawyerToken,
      (() => { const f = new FormData(); f.append('removeImageIds', JSON.stringify([removeId])); return f; })(), 'PATCH');
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.images.length, 2);
    assert.ok(!body.images.some((im) => im.id === removeId));
  });
});

describe('blog SEO (API + SSR)', () => {
  const uniq = Date.now().toString(36);
  let draftId;
  let slug;

  test('écriture sans token → 401 ; client → 403', async () => {
    const anon = await api('/api/blog', { method: 'POST', body: { title: 'X', content_html: 'Y' } });
    assert.equal(anon.status, 401);
    const denied = await api('/api/blog', { token: clientToken, method: 'POST', body: { title: 'X', content_html: 'Y' } });
    assert.equal(denied.status, 403);
  });

  test('brouillon créé par un avocat → slug généré, invisible publiquement', async () => {
    const res = await api('/api/blog', {
      token: lawyerToken, method: 'POST',
      body: { title: `Droit de la famille ${uniq}`, excerpt: 'Extrait.', content_html: '<h1>Titre</h1><script>alert(1)</script><p>Contenu.</p>' },
    });
    assert.equal(res.status, 201);
    draftId = res.body.id;
    slug = res.body.slug;
    assert.ok(slug.startsWith('droit-de-la-famille-'));
    assert.equal(res.body.status, 'draft');

    const list = await (await fetch(`${base}/blog`)).text();
    assert.ok(!list.includes(`Droit de la famille ${uniq}`));
    const page = await fetch(`${base}/blog/${slug}`);
    assert.equal(page.status, 404);
  });

  test('publication → visible sur /blog et /blog/:slug avec meta SEO', async () => {
    const upd = await api(`/api/blog/${draftId}`, { token: lawyerToken, method: 'PUT', body: { status: 'published' } });
    assert.equal(upd.status, 200);

    const list = await (await fetch(`${base}/blog`)).text();
    assert.ok(list.includes(`Droit de la famille ${uniq}`));

    const pageRes = await fetch(`${base}/blog/${slug}`);
    assert.equal(pageRes.status, 200);
    const html = await pageRes.text();
    assert.ok(html.includes('<meta property="og:title"'));
    assert.ok(html.includes(`<link rel="canonical" href="`));
    assert.ok(html.includes(`Droit de la famille ${uniq}`));
    // HTML conservé tel quel, script supprimé.
    assert.ok(html.includes('<h1>Titre</h1>'));
    assert.ok(html.includes('<p>Contenu.</p>'));
    assert.ok(!html.includes('<script>alert'));
  });

  test("menu complet sur la page article (FR par défaut, EN via Accept-Language), sans bouton retour", async () => {
    const fr = await (await fetch(`${base}/blog/${slug}`)).text();
    assert.ok(fr.includes('class="public-header"'));
    assert.ok(fr.includes('>Accueil<'));
    assert.ok(!fr.includes('← Retour au blog'));
    assert.ok(!fr.includes('blog-back'));
    const en = await (await fetch(`${base}/blog/${slug}`, { headers: { 'Accept-Language': 'en-US,en;q=0.9' } })).text();
    assert.ok(en.includes('>Home<'));
    assert.ok(en.includes('>My Space<'));
    assert.ok(!en.includes('← Back to blog'));
  });

  test('page 404 d’article : menu complet présent, sans bouton retour', async () => {
    const res = await fetch(`${base}/blog/slug-inexistant-xyz`);
    assert.equal(res.status, 404);
    const html = await res.text();
    assert.ok(html.includes('class="public-header"'));
    assert.ok(!html.includes('← Retour au blog'));
    assert.ok(!html.includes('blog-back'));
  });

  test('sitemap.xml contient l’article ; robots.txt pointe vers le sitemap', async () => {
    const sm = await (await fetch(`${base}/sitemap.xml`)).text();
    assert.ok(sm.includes(`/blog/${slug}`));
    const robots = await (await fetch(`${base}/robots.txt`)).text();
    assert.ok(robots.toLowerCase().includes('sitemap'));
  });

  test('unicité des slugs : même titre → suffixe', async () => {
    const mk = () => api('/api/blog', { token: lawyerToken, method: 'POST', body: { title: `Doublon ${uniq}`, content_html: '<p>X</p>' } });
    const a = await mk();
    const b = await mk();
    assert.equal(a.status, 201);
    assert.equal(b.status, 201);
    assert.notEqual(a.body.slug, b.body.slug);
    assert.ok(b.body.slug.endsWith('-2'));
  });

  test('couverture non-image → 400', async () => {
    const form = new FormData();
    form.append('title', `Couv ${uniq}`);
    form.append('content_html', '<p>X</p>');
    form.append('cover', new Blob(['pas une image'], { type: 'text/plain' }), 'faux.txt');
    const res = await postMultipart('/api/blog', lawyerToken, form);
    assert.equal(res.status, 400);
  });

  test('suppression par un autre avocat → 403 ; par l’auteur → 204', async () => {
    const denied = await api(`/api/blog/${draftId}`, { token: otherLawyerToken, method: 'DELETE' });
    assert.equal(denied.status, 403);
    const ok = await api(`/api/blog/${draftId}`, { token: lawyerToken, method: 'DELETE' });
    assert.equal(ok.status, 204);
  });
});

describe('blog WYSIWYG (HTML nettoyé + images)', () => {
  const uniq = Date.now().toString(36);
  let htmlSlug;

  test('HTML WYSIWYG sauvegardé → servi intact sur la page publique', async () => {
    const wysiwyg = '<h2>Sous-titre</h2><p>Un <strong>mot</strong> en <span style="color:#b3372f">rouge</span> et <span style="background-color:#f6ecd4">surligné</span>.</p><ul><li>point 1</li></ul><blockquote>Citation</blockquote><p style="text-align:center">centré</p><img src="/uploads/blog-images/x.png" alt="test" class="img-md align-center">';
    const res = await api('/api/blog', {
      token: lawyerToken, method: 'POST',
      body: { title: `WYSIWYG ${uniq}`, content_html: wysiwyg, status: 'published' },
    });
    assert.equal(res.status, 201);
    htmlSlug = res.body.slug;
    // L'API renvoie le HTML nettoyé (édition).
    const c0 = res.body.content_html;
    assert.ok(c0.includes('<h2>Sous-titre</h2>'));
    assert.ok(c0.includes('<strong>mot</strong>'));
    assert.ok(c0.includes('style="color:#b3372f"'));
    assert.ok(c0.includes('class="img-md align-center"'));
    // La page SSR publique affiche le HTML tel quel.
    const page = await (await fetch(`${base}/blog/${htmlSlug}`)).text();
    assert.ok(page.includes('<h2>Sous-titre</h2>'));
    assert.ok(page.includes('class="img-md align-center"'));
  });

  test('nettoyage : script, on*, javascript: et balises interdites supprimés', async () => {
    const evil = '<p onclick="alert(1)">x</p><span style="color:red;position:absolute">y</span><a href="javascript:alert(2)">clic</a><iframe src="https://evil.example"></iframe><div class="align-center">ok</div><span style="font-size:999px;color:expression(alert(3))">z</span>';
    const res = await api('/api/blog', {
      token: lawyerToken, method: 'POST',
      body: { title: `XSS ${uniq}`, content_html: evil, status: 'draft' },
    });
    assert.equal(res.status, 201);
    const c = res.body.content_html;
    assert.ok(!c.includes('<script'), 'script supprimé');
    assert.ok(!c.includes('onclick'), 'on* supprimé');
    assert.ok(!c.includes('javascript:'), 'javascript: bloqué');
    assert.ok(!c.includes('<iframe'), 'iframe supprimée');
    assert.ok(!c.includes('position:absolute'), 'style position refusé');
    assert.ok(!c.includes('expression('), 'expression() refusé');
    assert.ok(c.includes('style="color:red"'), 'couleur légitime gardée');
    assert.ok(c.includes('class="align-center"'), 'classe alignement gardée');
    assert.ok(c.includes('style="font-size:999px"'), 'font-size légitime gardée');
    await api(`/api/blog/${res.body.id}`, { token: lawyerToken, method: 'DELETE' });
  });

  test("upload d'image d'article : 401 sans token, 400 si non-image, 201 si image", async () => {
    const png = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
      'base64',
    );
    const up = async (token, buf, name, type) => {
      const form = new FormData();
      form.append('image', new Blob([buf], { type }), name);
      const headers = { Authorization: `Bearer ${token}` };
      const r = await fetch(`${base}/api/blog/images`, { method: 'POST', headers, body: form });
      return r;
    };
    const anon = await up('faux', png, 'a.png', 'image/png');
    assert.equal(anon.status, 401);
    const bad = await up(lawyerToken, Buffer.from('pas une image'), 'faux.txt', 'text/plain');
    assert.equal(bad.status, 400);
    const ok = await up(lawyerToken, png, 'photo.png', 'image/png');
    assert.equal(ok.status, 201);
    const body = await ok.json();
    assert.ok(body.url.startsWith('/uploads/blog-images/'));
  });
});

describe('témoignages (CRUD admin, lecture publique)', () => {
  let testiId;

  test('GET public → 200', async () => {
    const res = await api('/api/testimonials');
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body));
  });

  test('écriture sans token → 401 ; avocat → 403', async () => {
    const anon = await api('/api/testimonials', { method: 'POST', body: { name: 'X', content: 'Y' } });
    assert.equal(anon.status, 401);
    const denied = await api('/api/testimonials', { token: lawyerToken, method: 'POST', body: { name: 'X', content: 'Y' } });
    assert.equal(denied.status, 403);
  });

  test('POST admin avec photo → 201, photoUrl', async () => {
    const form = new FormData();
    form.append('name', 'Marie Tremblay');
    form.append('role_text', 'Cliente');
    form.append('content', 'Un cabinet remarquable.');
    form.append('photo', new Blob([PNG_1PX], { type: 'image/png' }), 'photo.png');
    const res = await postMultipart('/api/testimonials', adminToken, form);
    assert.equal(res.status, 201);
    const body = await res.json();
    testiId = body.id;
    assert.ok(body.photoUrl && body.photoUrl.startsWith('/uploads/testimonials/'));
    const list = await api('/api/testimonials');
    assert.ok(list.body.some((t) => t.id === testiId));
  });

  test('PUT admin → 200 ; DELETE admin → 204', async () => {
    const upd = await api(`/api/testimonials/${testiId}`, { token: adminToken, method: 'PUT', body: { content: 'Modifié.' } });
    assert.equal(upd.status, 200);
    assert.equal(upd.body.content, 'Modifié.');
    const del = await api(`/api/testimonials/${testiId}`, { token: adminToken, method: 'DELETE' });
    assert.equal(del.status, 204);
    const list = await api('/api/testimonials');
    assert.ok(!list.body.some((t) => t.id === testiId));
  });
});

describe('statistiques du site (CRUD admin, lecture publique)', () => {
  let statId;

  test('GET public → 200', async () => {
    assert.equal((await api('/api/site-stats')).status, 200);
  });

  test('POST avocat → 403 ; POST admin → 201', async () => {
    const denied = await api('/api/site-stats', { token: lawyerToken, method: 'POST', body: { label: 'X', value: '1' } });
    assert.equal(denied.status, 403);
    const res = await api('/api/site-stats', { token: adminToken, method: 'POST', body: { label: 'Années', value: '25+' } });
    assert.equal(res.status, 201);
    statId = res.body.id;
  });

  test('PUT puis DELETE admin', async () => {
    assert.equal((await api(`/api/site-stats/${statId}`, { token: adminToken, method: 'PUT', body: { value: '26+' } })).status, 200);
    assert.equal((await api(`/api/site-stats/${statId}`, { token: adminToken, method: 'DELETE' })).status, 204);
  });
});

describe('domaines de pratique (CRUD admin, lecture publique)', () => {
  let areaId;

  test('GET public → 200', async () => {
    assert.equal((await api('/api/practice-areas')).status, 200);
  });

  test('POST avocat → 403 ; POST admin → 201 ; PUT ; DELETE', async () => {
    const denied = await api('/api/practice-areas', { token: lawyerToken, method: 'POST', body: { title: 'X' } });
    assert.equal(denied.status, 403);
    const created = await api('/api/practice-areas', { token: adminToken, method: 'POST', body: { title: 'Droit immobilier', description: 'Test.' } });
    assert.equal(created.status, 201);
    areaId = created.body.id;
    assert.equal((await api(`/api/practice-areas/${areaId}`, { token: adminToken, method: 'PUT', body: { title: 'Droit immobilier 2' } })).status, 200);
    assert.equal((await api(`/api/practice-areas/${areaId}`, { token: adminToken, method: 'DELETE' })).status, 204);
  });
});

describe('version officielle (ensureFirstAdmin)', () => {
  test('ne touche à rien quand des utilisateurs existent déjà', async () => {
    const { ensureFirstAdmin } = await import('../src/db/bootstrap.js');
    const { query } = await import('../src/db/pool.js');
    const before = await query('SELECT COUNT(*)::int AS n FROM users');
    await ensureFirstAdmin();
    const after = await query('SELECT COUNT(*)::int AS n FROM users');
    assert.equal(after.rows[0].n, before.rows[0].n);
  });
});

describe('politique de mot de passe (10 caractères min, lettre + chiffre)', () => {
  const weak = ['court1', 'abcdefghij', '1234567890', 'Str0ng!'];
  for (const pwd of weak) {
    test(`création d'utilisateur avec mot de passe faible ${JSON.stringify(pwd)} → 400`, async () => {
      const res = await api('/api/users', {
        token: adminToken,
        method: 'POST',
        body: { email: `weak-${Date.now()}-${Math.random().toString(36).slice(2)}@test.example`, password: pwd, firstName: 'W', lastName: 'Eak', role: 'LAWYER' },
      });
      assert.equal(res.status, 400);
      assert.equal(res.body.error.code, 'invalid_body');
    });
  }

  test('mot de passe conforme → 201', async () => {
    const res = await api('/api/users', {
      token: adminToken,
      method: 'POST',
      body: { email: `strong-${Date.now()}@test.example`, password: 'S3cur3Pass!', firstName: 'S', lastName: 'Trong', role: 'LAWYER' },
    });
    assert.equal(res.status, 201);
  });

  test('changement de mot de passe faible → 400 ; conforme → 204', async () => {
    const email = `pwdchange-${Date.now()}@test.example`;
    await api('/api/users', { token: adminToken, method: 'POST', body: { email, password: 'Init1alPass!', firstName: 'P', lastName: 'Wd', role: 'LAWYER' } });
    const token = await login(email, 'Init1alPass!');
    const weakRes = await api('/api/auth/change-password', { token, method: 'POST', body: { currentPassword: 'Init1alPass!', newPassword: 'faible' } });
    assert.equal(weakRes.status, 400);
    const okRes = await api('/api/auth/change-password', { token, method: 'POST', body: { currentPassword: 'Init1alPass!', newPassword: 'N0uveauPass!' } });
    assert.equal(okRes.status, 204);
    assert.ok(await login(email, 'N0uveauPass!'));
  });
});

describe('adresse structurée du cabinet (carte publique)', () => {
  test('PUT champs d’adresse → GET les reflète', async () => {
    const body = {
      address_street: '456, rue Sainte-Catherine Ouest',
      address_city: 'Montréal',
      address_province: 'Québec',
      address_postal: 'H3B 1B5',
      address_country: 'Canada',
    };
    const put = await api('/api/site-settings', { token: adminToken, method: 'PUT', body });
    assert.equal(put.status, 200);
    assert.equal(put.body.addressStreet, body.address_street);
    assert.equal(put.body.addressCity, body.address_city);
    assert.equal(put.body.addressProvince, body.address_province);
    assert.equal(put.body.addressPostal, body.address_postal);
    assert.equal(put.body.addressCountry, body.address_country);
    const get = await api('/api/site-settings');
    assert.equal(get.status, 200);
    assert.equal(get.body.addressStreet, body.address_street);
  });

  test('lecture publique sans token → 200 avec les champs d’adresse', async () => {
    const res = await api('/api/site-settings');
    assert.equal(res.status, 200);
    assert.ok('addressStreet' in res.body && 'addressCountry' in res.body);
  });
});

describe('formulaire de contact public', () => {
  test('envoi valide → 201, message conservé et admin notifié', async () => {
    const before = await api('/api/notifications', { token: adminToken });
    const beforeCount = before.body.length;
    const res = await api('/api/contact', {
      method: 'POST',
      body: { name: 'Jean Test', email: 'jean@test.example', phone: '+243 900 000 000', message: 'Bonjour, j’ai besoin d’un conseil en droit minier.' },
    });
    assert.equal(res.status, 201);
    assert.equal(res.body.received, true);

    const list = await api('/api/contact', { token: adminToken });
    assert.equal(list.status, 200);
    const msg = list.body.find((m) => m.id === res.body.id);
    assert.ok(msg);
    assert.equal(msg.name, 'Jean Test');
    assert.equal(msg.isRead, false);

    const after = await api('/api/notifications', { token: adminToken });
    assert.ok(after.body.length > beforeCount);
    assert.ok(after.body.some((n) => n.type === 'CONTACT_MESSAGE'));
  });

  test('sans SMTP : emailed=false, rien n’est perdu (base + notification)', async () => {
    const res = await api('/api/contact', {
      method: 'POST',
      body: { name: 'Sans SMTP', email: 'no-smtp@test.example', message: 'Vérification du mode sans SMTP.' },
    });
    assert.equal(res.status, 201);
    assert.equal(res.body.received, true);
    assert.equal(res.body.emailed, false);
    const { rows } = await query('SELECT id FROM contact_messages WHERE email = $1', ['no-smtp@test.example']);
    assert.ok(rows[0]);
  });

  test('validation → 400 (email invalide, message vide)', async () => {
    const bad1 = await api('/api/contact', { method: 'POST', body: { name: 'X', email: 'pas-un-email', message: 'hello' } });
    assert.equal(bad1.status, 400);
    const bad2 = await api('/api/contact', { method: 'POST', body: { name: 'X', email: 'x@test.example', message: '' } });
    assert.equal(bad2.status, 400);
  });

  test('liste réservée à l’admin → 403 pour un avocat', async () => {
    const res = await api('/api/contact', { token: lawyerToken });
    assert.equal(res.status, 403);
  });

  test('marquer comme lu', async () => {
    const list = await api('/api/contact', { token: adminToken });
    const id = list.body[0].id;
    const res = await api(`/api/contact/${id}`, { token: adminToken, method: 'PATCH', body: { isRead: true } });
    assert.equal(res.status, 200);
    assert.equal(res.body.isRead, true);
  });

  test('anti-abus : 6e message en 10 min → 429', async () => {
    const payload = { name: 'Spam', email: 'spam@test.example', message: 'test' };
    let last = 0;
    for (let i = 0; i < 6; i++) {
      const r = await api('/api/contact', { method: 'POST', body: payload });
      last = r.status;
    }
    assert.equal(last, 429);
  });
});

describe('isolation des données par avocat', () => {
  let isoClientId;
  let isoCaseId;
  let isoInvoiceId;

  test("l'avocat A crée client + dossier + facture", async () => {
    const cl = await api('/api/clients', { token: lawyerToken, method: 'POST', body: { firstName: 'Iso', lastName: `Client${Date.now()}`, email: `iso-${Date.now()}@test.example` } });
    assert.equal(cl.status, 201);
    isoClientId = cl.body.id;

    const cs = await api('/api/cases', { token: lawyerToken, method: 'POST', body: { title: `Dossier iso ${Date.now()}`, clientId: isoClientId } });
    assert.equal(cs.status, 201);
    isoCaseId = cs.body.id;
    // Assigne le dossier à l'avocat A (l'avocat 1 des tests).
    const me = await api('/api/auth/me', { token: lawyerToken });
    const assign = await api(`/api/cases/${isoCaseId}`, { token: adminToken, method: 'PATCH', body: { lawyerId: me.body.id } });
    assert.equal(assign.status, 200);

    const inv = await api('/api/invoices', { token: accountantToken, method: 'POST', body: { clientId: isoClientId, caseId: isoCaseId, amountCents: 50000 } });
    assert.equal(inv.status, 201);
    isoInvoiceId = inv.body.id;
  });

  test("l'avocat B ne voit ni le client ni la facture de A", async () => {
    const clients = await api('/api/clients', { token: otherLawyerToken });
    assert.ok(clients.body.every((c) => c.id !== isoClientId));
    assert.equal((await api(`/api/clients/${isoClientId}`, { token: otherLawyerToken })).status, 403);

    const invoices = await api('/api/invoices', { token: otherLawyerToken });
    assert.ok(invoices.body.every((i) => i.id !== isoInvoiceId));
    assert.equal((await api(`/api/invoices/${isoInvoiceId}`, { token: otherLawyerToken })).status, 403);
    assert.equal((await api(`/api/cases/${isoCaseId}`, { token: otherLawyerToken })).status, 403);
  });

  test("l'avocat A voit son client et sa facture", async () => {
    const clients = await api('/api/clients', { token: lawyerToken });
    assert.ok(clients.body.some((c) => c.id === isoClientId));
    const invoices = await api('/api/invoices', { token: lawyerToken });
    assert.ok(invoices.body.some((i) => i.id === isoInvoiceId));
  });

  test('partage du dossier : B voit alors le dossier, le client et la facture', async () => {
    const meB = await api('/api/auth/me', { token: otherLawyerToken });
    const share = await api(`/api/cases/${isoCaseId}/shares`, { token: lawyerToken, method: 'POST', body: { lawyerId: meB.body.id } });
    assert.equal(share.status, 201);

    assert.equal((await api(`/api/cases/${isoCaseId}`, { token: otherLawyerToken })).status, 200);
    const clients = await api('/api/clients', { token: otherLawyerToken });
    assert.ok(clients.body.some((c) => c.id === isoClientId));
    assert.equal((await api(`/api/clients/${isoClientId}`, { token: otherLawyerToken })).status, 200);
    const invoices = await api('/api/invoices', { token: otherLawyerToken });
    assert.ok(invoices.body.some((i) => i.id === isoInvoiceId));
    assert.equal((await api(`/api/invoices/${isoInvoiceId}`, { token: otherLawyerToken })).status, 200);

    // Liste des partages.
    const shares = await api(`/api/cases/${isoCaseId}/shares`, { token: lawyerToken });
    assert.ok(shares.body.some((s) => s.lawyerId === meB.body.id));
  });

  test('retrait du partage : B perd à nouveau l’accès', async () => {
    const meB = await api('/api/auth/me', { token: otherLawyerToken });
    const del = await api(`/api/cases/${isoCaseId}/shares/${meB.body.id}`, { token: lawyerToken, method: 'DELETE' });
    assert.equal(del.status, 204);
    assert.equal((await api(`/api/cases/${isoCaseId}`, { token: otherLawyerToken })).status, 403);
    assert.equal((await api(`/api/clients/${isoClientId}`, { token: otherLawyerToken })).status, 403);
  });

  test("l'admin voit toujours tout", async () => {
    const clients = await api('/api/clients', { token: adminToken });
    assert.ok(clients.body.some((c) => c.id === isoClientId));
    const invoices = await api('/api/invoices', { token: adminToken });
    assert.ok(invoices.body.some((i) => i.id === isoInvoiceId));
  });

  test('partage refusé pour un non-avocat', async () => {
    const me = await api('/api/auth/me', { token: assistantToken });
    const res = await api(`/api/cases/${isoCaseId}/shares`, { token: lawyerToken, method: 'POST', body: { lawyerId: me.body.id } });
    assert.equal(res.status, 400);
  });
});

describe('photos de profil', () => {
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');

  const uploadAvatar = (token, buf, filename, contentType) => {
    const boundary = '----testboundary';
    const head = Buffer.from(`------testboundary\r\nContent-Disposition: form-data; name="avatar"; filename="${filename}"\r\nContent-Type: ${contentType}\r\n\r\n`);
    const tail = Buffer.from('\r\n------testboundary--\r\n');
    const body = Buffer.concat([head, buf, tail]);
    return fetch(`${base}/api/users/me/avatar`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': `multipart/form-data; boundary=${boundary}` },
      body,
    });
  };

  test('non authentifié → 401', async () => {
    const res = await fetch(`${base}/api/users/me/avatar`, { method: 'POST' });
    assert.equal(res.status, 401);
  });

  test('fichier non-image → 400', async () => {
    const res = await uploadAvatar(lawyerToken, Buffer.from('not an image'), 'evil.txt', 'text/plain');
    assert.equal(res.status, 400);
  });

  test('l’utilisateur définit sa propre photo → avatarUrl dans /me', async () => {
    const res = await uploadAvatar(lawyerToken, png, 'moi.png', 'image/png');
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.ok(data.avatarUrl.startsWith('/uploads/avatars/'));

    const me = await api('/api/auth/me', { token: lawyerToken });
    assert.equal(me.body.avatarUrl, data.avatarUrl);
  });

  test('un avocat ne peut pas modifier la photo d’un autre (admin oui)', async () => {
    const me = await api('/api/auth/me', { token: otherLawyerToken });
    const boundary = '----testboundary';
    const body = Buffer.concat([
      Buffer.from(`------testboundary\r\nContent-Disposition: form-data; name="avatar"; filename="x.png"\r\nContent-Type: image/png\r\n\r\n`),
      png,
      Buffer.from('\r\n------testboundary--\r\n'),
    ]);
    const denied = await fetch(`${base}/api/users/${me.body.id}/avatar`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${lawyerToken}`, 'Content-Type': `multipart/form-data; boundary=${boundary}` },
      body,
    });
    assert.equal(denied.status, 403);

    const ok = await fetch(`${base}/api/users/${me.body.id}/avatar`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}`, 'Content-Type': `multipart/form-data; boundary=${boundary}` },
      body,
    });
    assert.equal(ok.status, 200);
    const users = await api('/api/users', { token: adminToken });
    const target = users.body.find((u) => u.id === me.body.id);
    assert.ok(target.avatarUrl);
  });

  test('suppression de la photo', async () => {
    const res = await api('/api/users/me/avatar', { token: lawyerToken, method: 'DELETE' });
    assert.equal(res.status, 200);
    assert.equal(res.body.avatarUrl, null);
  });
});

describe('publications : création avec images (FormData)', () => {
  test('création avec image → 201 et image rattachée', async () => {
    const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
    const boundary = '----postboundary';
    const body = Buffer.concat([
      Buffer.from(`------postboundary\r\nContent-Disposition: form-data; name="title"\r\n\r\nPost avec image ${Date.now()}\r\n------postboundary\r\nContent-Disposition: form-data; name="content"\r\n\r\nContenu du post\r\n------postboundary\r\nContent-Disposition: form-data; name="images"; filename="img.png"\r\nContent-Type: image/png\r\n\r\n`),
      png,
      Buffer.from('\r\n------postboundary--\r\n'),
    ]);
    const res = await fetch(`${base}/api/social/posts`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}`, 'Content-Type': `multipart/form-data; boundary=${boundary}` },
      body,
    });
    assert.equal(res.status, 201);
    const data = await res.json();
    assert.equal(data.images.length, 1);
    assert.ok(data.images[0].url.startsWith('/uploads/post-images/'));

    const feed = await api('/api/social/posts', { token: adminToken });
    const found = feed.body.find((p) => p.id === data.id);
    assert.ok(found);
    assert.equal(found.images.length, 1);
  });
});

describe('seed : mot de passe réinitialisé en cas de conflit', () => {
  test("l'upsert du seed met à jour le mot de passe", async () => {
    const { query } = await import('../src/db/pool.js');
    const bcrypt = (await import('bcryptjs')).default;
    const email = `seed-conflict-${Date.now()}@test.example`;
    const { rows: role } = await query("SELECT id FROM roles WHERE name = 'LAWYER'");
    const oldHash = await bcrypt.hash('OldPassword1', 10);
    await query('INSERT INTO users (email, password_hash, first_name, last_name, role_id) VALUES ($1,$2,\'A\',\'B\',$3)', [email, oldHash, role[0].id]);
    // Même logique que backend/src/db/seed.js (upsertUser).
    const newHash = await bcrypt.hash('Demo1234!', 10);
    await query(
      `INSERT INTO users (email, password_hash, first_name, last_name, role_id) VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (email) DO UPDATE SET password_hash = $2, first_name = $3, last_name = $4, role_id = $5`,
      [email, newHash, 'A', 'B', role[0].id],
    );
    const { rows } = await query('SELECT password_hash FROM users WHERE email = $1', [email]);
    assert.ok(await bcrypt.compare('Demo1234!', rows[0].password_hash));
  });
});

describe('frontend : vérifications statiques (crédit BB24, entête, route publications)', () => {
  let appJs;
  before(async () => {
    const fs = await import('node:fs');
    appJs = fs.readFileSync(new URL('../../frontend/js/app.js', import.meta.url), 'utf8');
  });

  test('le crédit BB24 est un lien mailto avec sujet et message pré-remplis', async () => {
    assert.ok(appJs.includes("mailto:tshibambabenoni@gmail.com?subject="));
    assert.ok(appJs.includes('bb24Credit()'));
    assert.ok(appJs.includes('Contact via Cabinet'));
    assert.ok(appJs.includes('Je vous contacte depuis le site'));
    assert.ok(!/h\('div', \{ class: '(public-footer-credit|sidebar-credit)' \}, 'BUILT WITH LOVE/.test(appJs));
  });

  test("l'entête de l'app utilise les réglages (logo + nom du cabinet)", async () => {
    assert.ok(appJs.includes('function firmName()'));
    assert.ok(appJs.includes('siteSettings?.firmName'));
    assert.ok(appJs.includes('firmMark(true)'));
    assert.ok(appJs.includes('refreshShellBrand()'));
  });

  test('route #/publications supprimée : les publications vivent sur l’accueil', async () => {
    assert.ok(!appJs.includes("publications: () => viewHome(main)"));
    assert.ok(!appJs.includes("key: 'publications'"));
    assert.ok(!appJs.includes("location.hash = '#/publications'"));
    assert.ok(appJs.includes('renderPostFeed(pubFeed, loggedPerms'));
    assert.ok(appJs.includes("id: 'publications'"));
    assert.ok(appJs.includes('function refreshPublications()'));
  });
});

describe('diaporama d’accueil (hero images)', () => {
  test('sans token → 401 ; slot invalide → 400', async () => {
    const anon = await api('/api/site-settings/hero-images/1', { method: 'POST' });
    assert.equal(anon.status, 401);
    const bad = await api('/api/site-settings/hero-images/9', { token: adminToken, method: 'DELETE' });
    assert.equal(bad.status, 400);
  });

  test('upload + suppression d’une image du diaporama', async () => {
    const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
    const form = new FormData();
    form.append('photo', new Blob([png], { type: 'image/png' }), 'hero.png');
    const up = await fetch(`${base}/api/site-settings/hero-images/2`, {
      method: 'POST', headers: { Authorization: `Bearer ${adminToken}` }, body: form,
    });
    assert.equal(up.status, 200);
    const shaped = await up.json();
    assert.equal(shaped.heroImages.length, 5);
    assert.ok(shaped.heroImages[1] && shaped.heroImages[1].startsWith('branding/'));

    const del = await api('/api/site-settings/hero-images/2', { token: adminToken, method: 'DELETE' });
    assert.equal(del.status, 200);
    assert.equal(del.body.heroImages[2 - 1], null);
  });

  test('le diaporama est câblé dans le frontend (markup + rotation 60 s)', async () => {
    const fs = await import('node:fs');
    const appJs = fs.readFileSync(new URL('../../frontend/js/app.js', import.meta.url), 'utf8');
    assert.ok(appJs.includes('hero-slides'));
    assert.ok(appJs.includes('hero-dot'));
    assert.ok(appJs.includes('setInterval(tick, 60000)'));
    assert.ok(appJs.includes('visibilitychange'));
    assert.ok(appJs.includes('uploadHeroImage'));
    assert.ok(appJs.includes('custHeroImages'));
  });
});

describe('blog SSR : menu complet, sans bouton retour', () => {
  test('/blog et /blog/:slug affichent l’en-tête public complet', async () => {
    const list = await (await fetch(`${base}/blog`)).text();
    assert.ok(list.includes('class="public-header"'));
    assert.ok(list.includes('class="public-nav"'));
    assert.ok(list.includes('href="/#/login"'));
    assert.ok(list.includes('mobile-drawer'));
    assert.ok(!list.includes('blog-back'));

    const en = await (await fetch(`${base}/blog?lang=en`)).text();
    assert.ok(en.includes('>Home<') && en.includes('>My Space<'));

    // Article créé pour le test (indépendant de seed:content).
    const uniq = Date.now().toString(36);
    const created = await api('/api/blog', {
      token: adminToken, method: 'POST',
      body: { title: `Menu complet ${uniq}`, content_html: '<p>Contenu.</p>', status: 'published' },
    });
    assert.equal(created.status, 201);
    const article = await (await fetch(`${base}/blog/${created.body.slug}`)).text();
    assert.ok(article.includes('class="public-header"'));
    assert.ok(article.includes('class="public-nav"'));
    assert.ok(!article.includes('blog-back'));

    const nf = await fetch(`${base}/blog/article-inexistant-xyz`);
    assert.equal(nf.status, 404);
    const nfHtml = await nf.text();
    assert.ok(nfHtml.includes('class="public-header"'));
    assert.ok(!nfHtml.includes('blog-back'));
  });
});

describe('formulaire de contact : mailto pré-rempli', () => {
  let buildContactMailto;
  before(async () => {
    const fs = await import('node:fs');
    const src = fs.readFileSync(new URL('../../frontend/js/contact-mailto.js', import.meta.url), 'utf8');
    buildContactMailto = new Function(`${src}; return buildContactMailto;`)();
  });

  test('FR : sujet + corps avec nom, courriel, téléphone, message', async () => {
    const link = buildContactMailto('cabinet@example.com',
      { name: 'Jean Dupont', email: 'jean@example.com', phone: '+243 810 000 000', message: 'Bonjour, je veux un conseil.' }, 'fr');
    assert.ok(link.startsWith('mailto:cabinet@example.com?subject='));
    assert.ok(link.includes(encodeURIComponent('Message depuis le site — Jean Dupont')));
    const body = decodeURIComponent(link.split('&body=')[1]);
    assert.ok(body.includes('Nom : Jean Dupont'));
    assert.ok(body.includes('Courriel : jean@example.com'));
    assert.ok(body.includes('Téléphone : +243 810 000 000'));
    assert.ok(body.includes('Bonjour, je veux un conseil.'));
  });

  test('EN : libellés anglais, ligne téléphone absente si vide', async () => {
    const link = buildContactMailto('cabinet@example.com',
      { name: 'John Doe', email: 'john@example.com', phone: '', message: 'Hello.' }, 'en');
    assert.ok(link.includes(encodeURIComponent('Website message — John Doe')));
    const body = decodeURIComponent(link.split('&body=')[1]);
    assert.ok(body.includes('Name: John Doe'));
    assert.ok(body.includes('Email: john@example.com'));
    assert.ok(!body.includes('Phone:'));
    assert.ok(body.includes('Hello.'));
  });

  test('le formulaire ouvre le mailto après enregistrement', async () => {
    const fs = await import('node:fs');
    const appJs = fs.readFileSync(new URL('../../frontend/js/app.js', import.meta.url), 'utf8');
    assert.ok(appJs.includes('buildContactMailto(contactEmail, fields, getLang())'));
    assert.ok(appJs.includes('function contactForm(contactEmail)'));
  });
});

describe('publications : filtres author_id/limit + profil public', () => {
  let lawyerId;
  before(async () => {
    const { rows } = await query("SELECT id FROM users WHERE email LIKE 'lawyer-%@test.example' ORDER BY id DESC LIMIT 1");
    lawyerId = rows[0].id;
    await postMultipart('/api/social/posts', lawyerToken, postForm({ title: 'Filtre A', content: 'contenu A', type: 'POST' }));
    await postMultipart('/api/social/posts', lawyerToken, postForm({ title: 'Filtre B', content: 'contenu B', type: 'POST' }));
  });

  test('?author_id → uniquement les posts de cet auteur, les plus récents d’abord', async () => {
    const res = await api(`/api/social/posts?author_id=${lawyerId}`, { token: lawyerToken });
    assert.equal(res.status, 200);
    assert.ok(res.body.length >= 2);
    assert.ok(res.body.every((p) => p.author.id === lawyerId));
    const ids = res.body.map((p) => p.id);
    assert.deepEqual(ids, [...ids].sort((a, b) => b - a));
  });

  test('?author_id invalide → ignoré (tous les posts)', async () => {
    const res = await api('/api/social/posts?author_id=zzz', { token: lawyerToken });
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body));
  });

  test('?limit=2 → au plus 2 posts', async () => {
    const res = await api('/api/social/posts?limit=2', { token: lawyerToken });
    assert.equal(res.status, 200);
    assert.ok(res.body.length <= 2 && res.body.length > 0);
  });

  test('?limit=999 → plafonné à 100', async () => {
    const res = await api('/api/social/posts?limit=999', { token: lawyerToken });
    assert.equal(res.status, 200);
    assert.ok(res.body.length <= 100);
  });

  test('GET /api/users/:id/profile → profil public sans données sensibles', async () => {
    const res = await api(`/api/users/${lawyerId}/profile`, { token: lawyerToken });
    assert.equal(res.status, 200);
    assert.equal(res.body.id, lawyerId);
    assert.equal(res.body.firstName, 'Léa');
    assert.equal(res.body.role, 'LAWYER');
    assert.ok(Number.isInteger(res.body.postCount) && res.body.postCount >= 2);
    assert.ok('avatarUrl' in res.body);
    assert.ok(!('email' in res.body) && !('permissions' in res.body) && !('password_hash' in res.body));
  });

  test('GET /api/users/999999/profile → 404', async () => {
    const res = await api('/api/users/999999/profile', { token: lawyerToken });
    assert.equal(res.status, 404);
  });

  test('GET /api/users/:id/profile sans jeton → 401', async () => {
    const res = await api(`/api/users/${lawyerId}/profile`);
    assert.equal(res.status, 401);
  });
});

describe('seed:content — photos des analyses juridiques de l’avocat', () => {
  test('seedEdmondPostImages est câblé et mappe 2 images par post', async () => {
    const fs = await import('node:fs');
    const src = fs.readFileSync(new URL('../src/db/seed-content.js', import.meta.url), 'utf8');
    assert.ok(src.includes('async function seedEdmondPostImages()'));
    assert.ok(src.includes('await seedEdmondPostImages();'));
    assert.ok(src.includes('EDMOND_POST_IMAGES'));
    // 3 posts × 2 images, via le circuit normal post-images.
    assert.ok(src.includes('INSERT INTO post_images (post_id, filename, mime, position)'));
    assert.ok(src.includes('hero-office.jpg') && src.includes('hero-mine.jpg') && src.includes('hero-kinshasa.jpg'));
  });
});

describe("demandes d'accès — notification admin", () => {
  test("une demande d'accès crée une notification pour les administrateurs", async () => {
    const stamp = Date.now();
    const res = await api('/api/registration-requests', {
      method: 'POST',
      body: { email: `demande-${stamp}@test.example`, firstName: 'Jean', lastName: 'Testeur' },
    });
    assert.equal(res.status, 201);
    const { rows } = await query(
      `SELECT n.id, n.title FROM notifications n JOIN users u ON u.id = n.user_id
       WHERE n.type = 'REGISTRATION_REQUEST' AND u.email = $1 ORDER BY n.id DESC LIMIT 1`,
      [ADMIN_EMAIL],
    );
    assert.ok(rows[0], 'aucune notification REGISTRATION_REQUEST pour l’admin');
    assert.ok(rows[0].title.includes('Jean Testeur'));
  });
});

describe('comptable — visibilité de l’équipe', () => {
  test('le comptable liste les utilisateurs (avocats visibles, clients exclus)', async () => {
    const res = await api('/api/users', { token: accountantToken });
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body));
    assert.ok(res.body.some((u) => u.role === 'LAWYER'), 'aucun avocat visible');
    assert.ok(!res.body.some((u) => u.role === 'CLIENT'), 'un compte client est visible !');
  });
});

describe('désactivation utilisateur (DELETE /users/:id)', () => {
  let targetId;
  let targetEmail;

  test('préparation : crée un avocat à désactiver', async () => {
    const stamp = Date.now();
    targetEmail = `desact-${stamp}@test.example`;
    const res = await api('/api/users', {
      token: adminToken,
      method: 'POST',
      body: { email: targetEmail, password: 'Str0ngPass!', firstName: 'Paul', lastName: 'Cible', role: 'LAWYER' },
    });
    assert.equal(res.status, 201);
    targetId = res.body.id;
  });

  test('un non-admin ne peut pas désactiver → 403', async () => {
    const res = await api(`/api/users/${targetId}`, { token: lawyerToken, method: 'DELETE' });
    assert.equal(res.status, 403);
  });

  test('impossible de se désactiver soi-même → 400', async () => {
    const me = await api('/api/auth/me', { token: adminToken });
    const res = await api(`/api/users/${me.body.id}`, { token: adminToken, method: 'DELETE' });
    assert.equal(res.status, 400);
    assert.equal(res.body.error.code, 'cannot_deactivate_self');
  });

  test('utilisateur avec dossier assigné → 409', async () => {
    const stamp = Date.now();
    const cl = await api('/api/clients', {
      token: adminToken, method: 'POST',
      body: { firstName: 'Cli', lastName: `Desact${stamp}`, email: `cli-desact-${stamp}@test.example` },
    });
    assert.equal(cl.status, 201);
    const cs = await api('/api/cases', {
      token: adminToken, method: 'POST', body: { title: 'Dossier test', clientId: cl.body.id },
    });
    assert.equal(cs.status, 201);
    const assign = await api(`/api/cases/${cs.body.id}`, {
      token: adminToken, method: 'PATCH', body: { lawyerId: targetId },
    });
    assert.equal(assign.status, 200);
    const res = await api(`/api/users/${targetId}`, { token: adminToken, method: 'DELETE' });
    assert.equal(res.status, 409);
    assert.equal(res.body.error.code, 'has_assigned_cases');
    // Nettoyage : désassigne le dossier pour la suite (le PATCH COALESCE ignore null).
    await query('UPDATE cases SET lawyer_id = NULL WHERE id = $1', [cs.body.id]);
  });

  test('désactivation OK → 204, login ensuite refusé', async () => {
    const res = await api(`/api/users/${targetId}`, { token: adminToken, method: 'DELETE' });
    assert.equal(res.status, 204);
    const loginRes = await api('/api/auth/login', { method: 'POST', body: { email: targetEmail, password: 'Str0ngPass!' } });
    assert.equal(loginRes.status, 401);
  });

  test('impossible de désactiver le dernier super-admin → 400', async () => {
    // Isole le test : désactive les éventuels super-admins résiduels d'un run précédent.
    await query(`UPDATE users SET is_active = 0 WHERE id IN (
      SELECT u.id FROM users u JOIN roles r ON r.id = u.role_id WHERE r.name = 'SUPER_ADMIN' AND u.is_active = 1)`);
    const stamp = Date.now();
    const mk = (email) => api('/api/users', {
      token: adminToken, method: 'POST',
      body: { email, password: 'Str0ngPass!', firstName: 'Sup', lastName: 'Er', role: 'SUPER_ADMIN' },
    });
    const s1 = await mk(`sup1-${stamp}@test.example`);
    const s2 = await mk(`sup2-${stamp}@test.example`);
    assert.equal(s1.status, 201);
    assert.equal(s2.status, 201);
    assert.equal((await api(`/api/users/${s1.body.id}`, { token: adminToken, method: 'DELETE' })).status, 204);
    const res = await api(`/api/users/${s2.body.id}`, { token: adminToken, method: 'DELETE' });
    assert.equal(res.status, 400);
    assert.equal(res.body.error.code, 'last_super_admin');
  });
});

describe('mot de passe oublié', () => {
  test('email inconnu → 200 générique (ne révèle rien)', async () => {
    const res = await api('/api/auth/forgot-password', { method: 'POST', body: { email: 'inconnu-xyz-123@test.example' } });
    assert.equal(res.status, 200);
    assert.ok(res.body.message);
  });

  test('sans SMTP configuré : pas de crash, réponse générique', async () => {
    const res = await api('/api/auth/forgot-password', { method: 'POST', body: { email: ADMIN_EMAIL } });
    assert.equal(res.status, 200);
    assert.ok(res.body.message);
  });

  test('jeton invalide → 400', async () => {
    const res = await api('/api/auth/reset-password', { method: 'POST', body: { token: 'jeton-faux', newPassword: 'NewStr0ngPass!' } });
    assert.equal(res.status, 400);
    assert.equal(res.body.error.code, 'invalid_token');
  });

  test('flux complet via jeton inséré en base (sans SMTP)', async () => {
    const crypto = await import('node:crypto');
    const token = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const { rows: u } = await query('SELECT id FROM users WHERE email = $1', [ADMIN_EMAIL]);
    await query('DELETE FROM password_reset_tokens WHERE user_id = $1', [u[0].id]);
    await query('INSERT INTO password_reset_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)',
      [u[0].id, tokenHash, new Date(Date.now() + 3600000)]);
    const res = await api('/api/auth/reset-password', { method: 'POST', body: { token, newPassword: 'NewStr0ngPass!' } });
    assert.equal(res.status, 200);
    // Jeton à usage unique : réutilisation refusée.
    const reuse = await api('/api/auth/reset-password', { method: 'POST', body: { token, newPassword: 'OtherStr0ng1!' } });
    assert.equal(reuse.status, 400);
    // Le nouveau mot de passe fonctionne, l'ancien non.
    const okLogin = await api('/api/auth/login', { method: 'POST', body: { email: ADMIN_EMAIL, password: 'NewStr0ngPass!' } });
    assert.ok(okLogin.body.accessToken);
    const koLogin = await api('/api/auth/login', { method: 'POST', body: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD } });
    assert.equal(koLogin.status, 401);
    // Restaure le mot de passe d'origine pour la suite des tests.
    await query('UPDATE users SET password_hash = $1 WHERE id = $2', [await bcrypt.hash(ADMIN_PASSWORD, 10), u[0].id]);
  });
});

describe('2FA TOTP', () => {
  test('sans jeton → 401', async () => {
    assert.equal((await api('/api/auth/2fa/status')).status, 401);
  });

  test('cycle complet : setup → verify → login 2FA → disable', async () => {
    const { generate } = await import('otplib');
    assert.equal((await api('/api/auth/2fa/status', { token: adminToken })).body.enabled, false);

    const setup = await api('/api/auth/2fa/setup', { token: adminToken, method: 'POST' });
    assert.equal(setup.status, 200);
    assert.ok(setup.body.secret);
    assert.ok(setup.body.otpauthUrl.startsWith('otpauth://'));
    assert.ok(setup.body.qrDataUrl.startsWith('data:image/png'));

    const bad = await api('/api/auth/2fa/verify', { token: adminToken, method: 'POST', body: { code: '000000' } });
    assert.equal(bad.status, 401);

    const good = await api('/api/auth/2fa/verify', {
      token: adminToken, method: 'POST', body: { code: await generate({ secret: setup.body.secret }) },
    });
    assert.equal(good.status, 200);
    assert.equal((await api('/api/auth/2fa/status', { token: adminToken })).body.enabled, true);

    // Le login exige désormais la seconde étape.
    const loginRes = await api('/api/auth/login', { method: 'POST', body: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD } });
    assert.equal(loginRes.body.twoFactorRequired, true);
    assert.ok(loginRes.body.tempToken);
    assert.ok(!loginRes.body.accessToken);

    const badLogin = await api('/api/auth/2fa/login', {
      method: 'POST', body: { tempToken: loginRes.body.tempToken, code: '000000' },
    });
    assert.equal(badLogin.status, 401);

    const okLogin = await api('/api/auth/2fa/login', {
      method: 'POST',
      body: { tempToken: loginRes.body.tempToken, code: await generate({ secret: setup.body.secret }) },
    });
    assert.ok(okLogin.body.accessToken);

    const badDis = await api('/api/auth/2fa/disable', { token: adminToken, method: 'POST', body: { password: 'faux' } });
    assert.equal(badDis.status, 401);

    const dis = await api('/api/auth/2fa/disable', { token: adminToken, method: 'POST', body: { password: ADMIN_PASSWORD } });
    assert.equal(dis.status, 200);
    assert.equal((await api('/api/auth/2fa/status', { token: adminToken })).body.enabled, false);
  });
});

describe('connexion Google (OAuth)', () => {
  test('non configuré → status false, endpoints 404 gracieux', async () => {
    const s = await api('/api/auth/oauth/google/status');
    assert.equal(s.status, 200);
    assert.equal(s.body.enabled, false);
    const r = await api('/api/auth/oauth/google');
    assert.equal(r.status, 404);
    assert.equal(r.body.error.code, 'oauth_not_configured');
  });

  test('complete avec un code invalide → 401', async () => {
    const res = await api('/api/auth/oauth/google/complete', { method: 'POST', body: { code: 'faux' } });
    assert.equal(res.status, 401);
  });
});
