/* =========================================================
   GERENCIAMENTO: senha, lista de plataformas e formulário
   ========================================================= */
const formularioSenha = document.querySelector('#formularioSenha');
const campoSenha = document.querySelector('#senhaConfiguracao');
const erroSenha = document.querySelector('#erroSenha');

const listaPlataformas = document.querySelector('#listaPlataformas');
const feedbackGerenciamento = document.querySelector('#feedbackGerenciamento');
const botaoAdicionar = document.querySelector('#btnAdicionarPlataforma');
const botaoSair = document.querySelector('#btnSair');

const janelaFormulario = document.querySelector('#janelaFormulario');
const formularioPlataforma = document.querySelector('#formularioPlataforma');
const tituloFormulario = document.querySelector('#tituloFormulario');
const campoId = document.querySelector('#campoId');
const campoNome = document.querySelector('#campoNome');
const campoDescricao = document.querySelector('#campoDescricao');
const campoUrl = document.querySelector('#campoUrl');
const campoTipo = document.querySelector('#campoTipo');
const campoIcone = document.querySelector('#campoIcone');
const campoAtivo = document.querySelector('#campoAtivo');
const aviso = document.querySelector('#aviso');

let plataformas = [];
let temporizadorAviso;

// Desenhos dos ícones (grade 24x24, só traço). Mantenha igual ao portal.js.
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

function mostrarAviso(mensagem) {
  aviso.textContent = mensagem;
  aviso.classList.add('is-visible');
  clearTimeout(temporizadorAviso);
  temporizadorAviso = setTimeout(() => aviso.classList.remove('is-visible'), 2800);
}

/* =========================================================
   ACESSO: desbloquear e sair
   ========================================================= */
async function desbloquearConfiguracoes(evento) {
  evento.preventDefault();
  const botaoEntrar = formularioSenha.querySelector('button[type="submit"]');
  botaoEntrar.disabled = true;
  erroSenha.hidden = true;
  try {
    const resposta = await fetch('/api/configuracoes/desbloquear', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ senha: campoSenha.value })
    });
    const dados = await resposta.json().catch(() => ({}));
    if (!resposta.ok) throw new Error(dados.erro || 'Não foi possível validar a senha.');
    window.location.reload();
  } catch (erro) {
    erroSenha.textContent = erro instanceof TypeError ? 'Sem conexão com o servidor.' : erro.message;
    erroSenha.hidden = false;
    campoSenha.value = '';
    campoSenha.focus();
  } finally {
    botaoEntrar.disabled = false;
  }
}

async function bloquearConfiguracoes() {
  await fetch('/api/configuracoes/bloquear', { method: 'POST' }).catch(() => {});
  window.location.href = '/';
}

/* =========================================================
   LISTA DE PLATAFORMAS
   ========================================================= */
async function carregarPlataformas() {
  const resposta = await fetch('/api/plataformas', { cache: 'no-store' });
  if (!resposta.ok) throw new Error('Não foi possível carregar o catálogo.');
  const dados = await resposta.json();
  return Array.isArray(dados) ? dados : [];
}

function criarItemLista(plataforma) {
  return `<article class="admin-item ${plataforma.ativo ? '' : 'is-disabled'}">
    <span class="admin-item-icon">${desenharIcone(plataforma.icone)}</span>
    <span class="admin-item-copy"><strong>${escaparHtml(plataforma.nome)}</strong><small>${escaparHtml(plataforma.url)}</small></span>
    <button class="small-action" type="button" data-editar="${escaparHtml(plataforma.id)}" aria-label="Editar ${escaparHtml(plataforma.nome)}">Editar</button>
    <button class="small-action small-action--danger" type="button" data-remover="${escaparHtml(plataforma.id)}" aria-label="Remover ${escaparHtml(plataforma.nome)}">Remover</button>
  </article>`;
}

function renderizarLista() {
  const ordenadas = [...plataformas].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  listaPlataformas.innerHTML = ordenadas.length
    ? ordenadas.map(criarItemLista).join('')
    : '<p class="admin-empty">Nenhuma plataforma cadastrada ainda.</p>';
}

async function salvarPlataformas(novasPlataformas) {
  try {
    const resposta = await fetch('/api/plataformas', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(novasPlataformas)
    });
    if (resposta.status === 401) {
      window.location.reload();
      return { salvo: false, mensagem: 'Sessão expirada.' };
    }
    if (!resposta.ok) {
      const dados = await resposta.json().catch(() => ({}));
      return { salvo: false, mensagem: dados.erro || 'Não foi possível salvar as alterações.' };
    }
    plataformas = novasPlataformas;
    renderizarLista();
    return { salvo: true };
  } catch (erro) {
    return { salvo: false, mensagem: 'Sem conexão com o servidor.' };
  }
}

async function removerPlataforma(identificador) {
  const plataforma = plataformas.find(item => item.id === identificador);
  if (!plataforma || !window.confirm(`Remover “${plataforma.nome}” do catálogo?`)) return;
  const resultado = await salvarPlataformas(plataformas.filter(item => item.id !== identificador));
  feedbackGerenciamento.textContent = resultado.salvo ? 'Plataforma removida.' : resultado.mensagem;
  if (resultado.salvo) mostrarAviso('Plataforma removida');
}

/* =========================================================
   FORMULÁRIO: adicionar e editar
   ========================================================= */
function abrirFormulario(plataforma = null) {
  formularioPlataforma.reset();
  campoId.value = plataforma?.id ?? '';
  campoNome.value = plataforma?.nome ?? '';
  campoDescricao.value = plataforma?.descricao ?? '';
  campoUrl.value = plataforma?.url ?? '';
  campoTipo.value = plataforma?.tipo ?? 'interno';
  campoIcone.value = plataforma?.icone ?? 'sparkles';
  campoAtivo.checked = plataforma?.ativo ?? true;
  tituloFormulario.textContent = plataforma ? 'Editar plataforma' : 'Adicionar plataforma';
  formularioPlataforma.querySelector('button[type="submit"]').textContent = plataforma ? 'Salvar alterações' : 'Salvar plataforma';
  janelaFormulario.showModal();
  campoNome.focus();
}

function fecharFormulario() {
  janelaFormulario.close();
}

async function enviarFormulario(evento) {
  evento.preventDefault();
  const url = normalizarUrl(campoUrl.value.trim());
  if (!url) {
    campoUrl.setCustomValidity('Informe um endereço completo começando por http:// ou https://.');
    campoUrl.reportValidity();
    return;
  }
  campoUrl.setCustomValidity('');
  const identificador = campoId.value;
  const plataforma = {
    id: identificador || (crypto.randomUUID?.() ?? `plataforma-${Date.now()}`),
    nome: campoNome.value.trim(),
    descricao: campoDescricao.value.trim(),
    url,
    tipo: campoTipo.value,
    icone: campoIcone.value,
    ativo: campoAtivo.checked
  };
  const novasPlataformas = identificador
    ? plataformas.map(item => item.id === identificador ? plataforma : item)
    : [...plataformas, plataforma];
  const resultado = await salvarPlataformas(novasPlataformas);
  if (resultado.salvo) {
    fecharFormulario();
    feedbackGerenciamento.textContent = '';
    mostrarAviso(identificador ? 'Plataforma atualizada' : 'Plataforma adicionada');
  } else {
    mostrarAviso(resultado.mensagem);
  }
}

/* =========================================================
   INICIALIZAÇÃO
   ========================================================= */
async function inicializarGerenciamento() {
  botaoAdicionar.addEventListener('click', () => abrirFormulario());
  botaoSair.addEventListener('click', bloquearConfiguracoes);
  document.querySelector('#btnFecharFormulario').addEventListener('click', fecharFormulario);
  document.querySelector('#btnCancelarFormulario').addEventListener('click', fecharFormulario);
  janelaFormulario.addEventListener('click', evento => {
    if (evento.target === janelaFormulario) fecharFormulario();
  });
  formularioPlataforma.addEventListener('submit', enviarFormulario);

  listaPlataformas.addEventListener('click', evento => {
    const botaoEditar = evento.target.closest('[data-editar]');
    const botaoRemover = evento.target.closest('[data-remover]');
    if (botaoEditar) {
      const plataforma = plataformas.find(item => item.id === botaoEditar.dataset.editar);
      if (plataforma) abrirFormulario(plataforma);
    }
    if (botaoRemover) removerPlataforma(botaoRemover.dataset.remover);
  });

  try {
    plataformas = await carregarPlataformas();
    renderizarLista();
  } catch (erro) {
    feedbackGerenciamento.textContent = erro.message;
  }
}

// Sem a senha, a página mostra só o formulário de acesso
if (formularioSenha) {
  formularioSenha.addEventListener('submit', desbloquearConfiguracoes);
  campoSenha.focus();
} else {
  inicializarGerenciamento();
}
