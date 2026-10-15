const STORAGE_KEY = 'elian-platform-catalog-v1';
const ICONS = {
  robot: '<rect x="5" y="7" width="14" height="13" rx="3"/><path d="M12 3v4M9 12h.01M15 12h.01M9 16h6M3 12h2m14 0h2"/>',
  sparkles: '<path d="m12 3 1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3Z"/><path d="m19 14 .9 2.1L22 17l-2.1.9L19 20l-.9-2.1L16 17l2.1-.9L19 14ZM5 3l.7 1.8L7.5 5.5l-1.8.7L5 8l-.7-1.8-1.8-.7 1.8-.7L5 3Z"/>',
  chat: '<path d="M20 11.5a7.5 7.5 0 0 1-8 7.5 8.6 8.6 0 0 1-3.3-.7L4 20l1.2-3.8A7.2 7.2 0 0 1 4 12c0-4.1 3.6-7.5 8-7.5s8 3.1 8 7Z"/><path d="M8 11h8M8 14h5"/>',
  audio: '<path d="M4 10v4m4-8v12m4-15v18m4-15v12m4-8v4"/>',
  image: '<rect x="3" y="4" width="18" height="16" rx="3"/><circle cx="8.5" cy="9" r="1.5"/><path d="m21 15-5-5L5 20"/><path d="m17 3 .7 1.8 1.8.7-1.8.7L17 8l-.7-1.8-1.8-.7 1.8-.7L17 3Z"/>',
  shapes: '<path d="m12 3 9 16H3l9-16Z"/><circle cx="18" cy="6" r="2"/><rect x="3" y="3" width="5" height="5" rx="1"/>',
  briefcase: '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 12h18m-11 0v2h4v-2"/>',
  trophy: '<path d="M8 21h8m-4-4v4M7 4h10v5a5 5 0 0 1-10 0V4ZM7 7H4v2a4 4 0 0 0 4 4m9-6h3v2a4 4 0 0 1-4 4"/>',
  rocket: '<path d="M12 19c4 0 7-3 7-7V4l-8 2-4 5v4a4 4 0 0 0 4 4h1Z"/><path d="m7 11-3 1-1 5 5-2m7-6h.01M11 19l-1 3h5l2-5"/>',
  store: '<path d="M3 10v10h18V10M2 10l2-6h16l2 6M2 10a3 3 0 0 0 6 0 3 3 0 0 0 6 0 3 3 0 0 0 6 0 2 2 0 0 0 4 0M9 20v-6h6v6"/>',
  clipboard: '<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4.5h6a1.5 1.5 0 0 0-1.5-1.5h-3A1.5 1.5 0 0 0 9 4.5ZM8 10h8m-8 4h8m-8 4h5"/>',
  meal: '<path d="M4 3v7a3 3 0 0 0 6 0V3M7 3v18m10-18v18m0-18c-2 2-3 5-3 8h6c0-3-1-6-3-8Z"/>'
};

const grid = document.querySelector('#platform-grid');
const emptyState = document.querySelector('#empty-state');
const searchInput = document.querySelector('#platform-search');
const adminDialog = document.querySelector('#admin-dialog');
const formDialog = document.querySelector('#form-dialog');
const form = document.querySelector('#platform-form');
const adminList = document.querySelector('#admin-list');
const toast = document.querySelector('#toast');
let platforms = [];
let toastTimer;

function escapeHtml(value = '') {
  return String(value).replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[character]);
}

function iconMarkup(name, className = '') {
  const paths = ICONS[name] || ICONS.sparkles;
  return `<svg class="${className}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;
}

function normalizeUrl(value) {
  try {
    const parsed = new URL(value);
    return ['http:', 'https:'].includes(parsed.protocol) ? parsed.href : null;
  } catch {
    return null;
  }
}

function loadSavedCatalog() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return null;
    const parsed = JSON.parse(saved);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

async function initialize() {
  try {
    const response = await fetch('/data/plataformas.json', { cache: 'no-store' });
    if (!response.ok) throw new Error('Não foi possível carregar o catálogo.');
    const initial = await response.json();
    platforms = loadSavedCatalog() ?? initial;
    render();
  } catch (error) {
    grid.innerHTML = `<div class="load-error"><strong>Não foi possível carregar as plataformas.</strong><span>${escapeHtml(error.message)}</span><span>Abra o portal por um servidor HTTP local ou pela hospedagem configurada.</span></div>`;
  }
}

function visiblePlatforms() {
  const query = normalizeText(searchInput.value.trim());
  return platforms.filter((platform) => {
    const searchableText = normalizeText(`${platform.name} ${platform.description}`);
    return platform.active && (!query || searchableText.includes(query));
  }).sort((a, b) => {
    const accessOrder = (a.type === 'interno' ? 0 : 1) - (b.type === 'interno' ? 0 : 1);
    return accessOrder || a.name.localeCompare(b.name, 'pt-BR');
  });
}

function normalizeText(value) {
  return String(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR');
}

function render() {
  const visible = visiblePlatforms();
  grid.innerHTML = visible.map((platform, index) => {
    const safeUrl = normalizeUrl(platform.url);
    if (!safeUrl) return '';
    const external = platform.type === 'externo';
    return `<a class="platform-card" href="${escapeHtml(safeUrl)}" ${external ? 'target="_blank" rel="noopener noreferrer"' : ''} style="--card-index:${Math.min(index, 11)}">
      <div class="card-topline"><span class="platform-icon">${iconMarkup(platform.icon)}</span><span class="platform-type">${external ? 'EXTERNO' : 'INTERNO'}</span></div>
      <h2>${escapeHtml(platform.name)}</h2><p>${escapeHtml(platform.description)}</p>
      <span class="card-action">Acessar <span>${external ? '↗' : '→'}</span></span>
      <span class="card-shine" aria-hidden="true"></span>
    </a>`;
  }).join('');
  const hasQuery = searchInput.value.trim().length > 0;
  emptyState.querySelector('h2').textContent = hasQuery ? 'Nenhuma aplicação encontrada' : 'Nenhuma plataforma cadastrada';
  emptyState.querySelector('p').textContent = hasQuery
    ? 'Tente buscar por outro nome ou descrição.'
    : 'Adicione uma plataforma pelo botão de configurações.';
  emptyState.hidden = visible.length > 0;
  const footerTotal = document.querySelector('#footer-total');
  if (footerTotal) {
    footerTotal.textContent = `${platforms.filter((platform) => platform.active).length} acessos disponíveis`;
  }
}

function saveCatalog() {
  let persisted = true;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(platforms));
  } catch {
    persisted = false;
  }
  render();
  renderAdminList();
  if (!persisted) document.querySelector('#admin-feedback').textContent = 'O navegador bloqueou o armazenamento local. Exporte o catálogo para não perder estas alterações.';
  return persisted;
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add('is-visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('is-visible'), 2800);
}

function renderAdminList() {
  const sorted = [...platforms].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  adminList.innerHTML = sorted.map((platform) => `<article class="admin-item ${platform.active ? '' : 'is-disabled'}">
    <span class="admin-item-icon">${iconMarkup(platform.icon)}</span>
    <span class="admin-item-copy"><strong>${escapeHtml(platform.name)}</strong><small>${escapeHtml(platform.url)}</small></span>
    <span class="admin-item-state">${platform.active ? 'Visível' : 'Oculta'}</span>
    <button class="small-action" type="button" data-edit="${escapeHtml(platform.id)}" aria-label="Editar ${escapeHtml(platform.name)}">Editar</button>
    <button class="small-action small-action--danger" type="button" data-delete="${escapeHtml(platform.id)}" aria-label="Remover ${escapeHtml(platform.name)}">Remover</button>
  </article>`).join('');
}

function openForm(platform = null) {
  form.reset();
  document.querySelector('#platform-id').value = platform?.id ?? '';
  document.querySelector('#platform-name').value = platform?.name ?? '';
  document.querySelector('#platform-description').value = platform?.description ?? '';
  document.querySelector('#platform-url').value = platform?.url ?? '';
  document.querySelector('#platform-type').value = platform?.type ?? 'interno';
  document.querySelector('#platform-icon').value = platform?.icon ?? 'sparkles';
  document.querySelector('#platform-active').checked = platform?.active ?? true;
  document.querySelector('#form-title').textContent = platform ? 'Editar plataforma' : 'Adicionar plataforma';
  document.querySelector('#form-dialog button[type="submit"]').textContent = platform ? 'Salvar alterações' : 'Salvar plataforma';
  adminDialog.close();
  formDialog.showModal();
  document.querySelector('#platform-name').focus();
}

function closeForm(returnToAdmin = true) {
  if (formDialog.open) formDialog.close();
  if (returnToAdmin) {
    renderAdminList();
    adminDialog.showModal();
  }
}

function exportCatalog() {
  const blob = new Blob([`${JSON.stringify(platforms, null, 2)}\n`], { type: 'application/json' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = 'plataformas.json';
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
  document.querySelector('#admin-feedback').textContent = 'Catálogo exportado. Para publicar as alterações para todos, conecte este arquivo ao processo de publicação do portal.';
}

async function importCatalog(file) {
  try {
    const parsed = JSON.parse(await file.text());
    if (!Array.isArray(parsed)) throw new Error('O arquivo precisa conter uma lista de plataformas.');
    const normalized = parsed.map((platform, index) => {
      const url = normalizeUrl(platform.url);
      if (!platform.name || !platform.description || !url) throw new Error(`Confira nome, descrição e URL do item ${index + 1}.`);
      return {
        id: String(platform.id || crypto.randomUUID()),
        name: String(platform.name).slice(0, 60),
        description: String(platform.description).slice(0, 150),
        url,
        type: platform.type === 'externo' ? 'externo' : 'interno',
        icon: ICONS[platform.icon] ? platform.icon : 'sparkles',
        active: platform.active !== false
      };
    });
    platforms = normalized;
    saveCatalog();
    document.querySelector('#admin-feedback').textContent = 'Catálogo importado neste navegador.';
  } catch (error) {
    document.querySelector('#admin-feedback').textContent = `Não foi possível importar: ${error.message}`;
  }
}

document.querySelector('#settings-trigger').addEventListener('click', () => {
  renderAdminList();
  adminDialog.showModal();
});
searchInput.addEventListener('input', render);
document.querySelector('#close-admin').addEventListener('click', () => adminDialog.close());
document.querySelector('#add-platform').addEventListener('click', () => openForm());
document.querySelector('#close-form').addEventListener('click', () => closeForm());
document.querySelector('#cancel-form').addEventListener('click', () => closeForm());
document.querySelector('#export-platforms').addEventListener('click', exportCatalog);
document.querySelector('#import-platforms').addEventListener('click', () => document.querySelector('#import-file').click());
document.querySelector('#import-file').addEventListener('change', (event) => {
  const [file] = event.target.files;
  if (file) importCatalog(file);
  event.target.value = '';
});

adminList.addEventListener('click', (event) => {
  const editButton = event.target.closest('[data-edit]');
  const deleteButton = event.target.closest('[data-delete]');
  if (editButton) {
    const item = platforms.find((platform) => platform.id === editButton.dataset.edit);
    if (item) openForm(item);
  }
  if (deleteButton) {
    const item = platforms.find((platform) => platform.id === deleteButton.dataset.delete);
    if (!item || !window.confirm(`Remover “${item.name}” do catálogo deste navegador?`)) return;
    platforms = platforms.filter((platform) => platform.id !== item.id);
    saveCatalog();
    document.querySelector('#admin-feedback').textContent = 'Plataforma removida deste navegador.';
    showToast('Plataforma removida');
  }
});

form.addEventListener('submit', (event) => {
  event.preventDefault();
  const id = document.querySelector('#platform-id').value;
  const name = document.querySelector('#platform-name').value.trim();
  const description = document.querySelector('#platform-description').value.trim();
  const url = normalizeUrl(document.querySelector('#platform-url').value.trim());
  if (!url) {
    document.querySelector('#platform-url').setCustomValidity('Informe um endereço completo começando por http:// ou https://.');
    document.querySelector('#platform-url').reportValidity();
    return;
  }
  document.querySelector('#platform-url').setCustomValidity('');
  const item = {
    id: id || (crypto.randomUUID?.() ?? `plataforma-${Date.now()}`),
    name,
    description,
    url,
    type: document.querySelector('#platform-type').value,
    icon: document.querySelector('#platform-icon').value,
    active: document.querySelector('#platform-active').checked
  };
  if (id) platforms = platforms.map((platform) => platform.id === id ? item : platform);
  else platforms.push(item);
  const persisted = saveCatalog();
  closeForm();
  showToast(persisted ? (id ? 'Plataforma atualizada neste navegador' : 'Plataforma adicionada neste navegador') : 'Catálogo atualizado. Exporte o JSON para salvar uma cópia.');
});

adminDialog.addEventListener('click', (event) => { if (event.target === adminDialog) adminDialog.close(); });
formDialog.addEventListener('click', (event) => { if (event.target === formDialog) closeForm(); });
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && formDialog.open) closeForm();
});

initialize();
