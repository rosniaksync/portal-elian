/* =========================================================
   TELA INICIAL: catálogo de plataformas e busca
   ========================================================= */
const gradePlataformas = document.querySelector('#gradePlataformas');
const estadoVazio = document.querySelector('#estadoVazio');
const campoBusca = document.querySelector('#campoBusca');
let plataformas = [];

// Desenhos dos ícones (grade 24x24, só traço). Mantenha igual ao gerenciamento.js.
const ICONES = {
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

function escaparHtml(valor) {
  return String(valor ?? '').replace(/[&<>'"]/g, caractere => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  }[caractere]));
}

function desenharIcone(nome) {
  const caminhos = ICONES[nome] || ICONES.sparkles;
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${caminhos}</svg>`;
}

function normalizarUrl(valor) {
  try {
    const endereco = new URL(valor);
    return ['http:', 'https:'].includes(endereco.protocol) ? endereco.href : null;
  } catch (erro) {
    return null;
  }
}

function normalizarTexto(valor) {
  return String(valor).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR');
}

/* =========================================================
   CARREGAMENTO E FILTRO
   ========================================================= */
async function carregarPlataformas() {
  const resposta = await fetch('/api/plataformas', { cache: 'no-store' });
  if (!resposta.ok) throw new Error('Não foi possível carregar o catálogo.');
  const dados = await resposta.json();
  return Array.isArray(dados) ? dados : [];
}

function plataformasVisiveis() {
  const busca = normalizarTexto(campoBusca.value.trim());
  return plataformas
    .filter(plataforma => {
      const textoPesquisavel = normalizarTexto(`${plataforma.nome} ${plataforma.descricao}`);
      return plataforma.ativo && (!busca || textoPesquisavel.includes(busca));
    })
    .sort((a, b) => {
      const ordemTipo = (a.tipo === 'interno' ? 0 : 1) - (b.tipo === 'interno' ? 0 : 1);
      return ordemTipo || a.nome.localeCompare(b.nome, 'pt-BR');
    });
}

/* =========================================================
   CARDS DAS PLATAFORMAS
   ========================================================= */
function criarCard(plataforma, indice) {
  const urlSegura = normalizarUrl(plataforma.url);
  if (!urlSegura) return '';
  const externa = plataforma.tipo === 'externo';
  return `<a class="platform-card" href="${escaparHtml(urlSegura)}" ${externa ? 'target="_blank" rel="noopener noreferrer"' : ''} style="--card-index:${Math.min(indice, 11)}">
    <div class="card-topline"><span class="platform-icon">${desenharIcone(plataforma.icone)}</span><span class="platform-type">${externa ? 'EXTERNO' : 'INTERNO'}</span></div>
    <h2>${escaparHtml(plataforma.nome)}</h2><p>${escaparHtml(plataforma.descricao)}</p>
    <span class="card-action">Acessar <span>${externa ? '↗' : '→'}</span></span>
    <span class="card-shine" aria-hidden="true"></span>
  </a>`;
}

function renderizarPlataformas() {
  const visiveis = plataformasVisiveis();
  gradePlataformas.innerHTML = visiveis.map(criarCard).join('');
  const temBusca = campoBusca.value.trim().length > 0;
  estadoVazio.querySelector('h2').textContent = temBusca ? 'Nenhuma aplicação encontrada' : 'Nenhuma plataforma cadastrada';
  estadoVazio.querySelector('p').textContent = temBusca
    ? 'Tente buscar por outro nome ou descrição.'
    : 'Adicione uma plataforma pela tela de gerenciamento.';
  estadoVazio.hidden = visiveis.length > 0;
}

async function inicializarPortal() {
  try {
    plataformas = await carregarPlataformas();
    renderizarPlataformas();
  } catch (erro) {
    gradePlataformas.innerHTML = `<div class="load-error"><strong>Não foi possível carregar as plataformas.</strong><span>${escaparHtml(erro.message)}</span></div>`;
  }
}

campoBusca.addEventListener('input', renderizarPlataformas);
inicializarPortal();
