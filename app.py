import os
import hmac
import json
import re
import tempfile
import threading
import time
import logging
from functools import wraps
from pathlib import Path
from datetime import timedelta
from urllib.parse import urlparse
from flask import Flask, jsonify, render_template, request, session

# Em desenvolvimento, as variáveis vêm do arquivo .env. Em produção, do ambiente.
try:
    from dotenv import load_dotenv
    load_dotenv(Path(__file__).resolve().parent / ".env")
except ImportError:
    pass

logging.basicConfig(level=logging.INFO)


def env_obrigatoria(nome):
    """Lê uma configuração obrigatória do ambiente, sem valor-padrão."""
    valor = os.getenv(nome)
    if valor is None or not str(valor).strip():
        raise RuntimeError(f"Variável de ambiente obrigatória não definida: {nome}")
    return str(valor).strip()


app = Flask(__name__)
app.config["MAX_CONTENT_LENGTH"] = 5 * 1024 * 1024
app.config["SECRET_KEY"] = env_obrigatoria("FLASK_SECRET_KEY")
app.config["SESSION_COOKIE_HTTPONLY"] = True
app.config["SESSION_COOKIE_SAMESITE"] = "Lax"
app.config["SESSION_COOKIE_SECURE"] = os.getenv("SESSION_COOKIE_SECURE", "true").strip().lower() in {"1", "true", "sim", "yes"}
app.permanent_session_lifetime = timedelta(minutes=30)

# Garante que a senha exista já na inicialização, e não só no primeiro login.
env_obrigatoria("CONFIG_PASSWORD")

CAMINHO_CATALOGO = Path(__file__).resolve().parent / "data" / "plataformas.json"
_trava_catalogo = threading.Lock()

LIMITE_PLATAFORMAS = 200
TIPOS_ACESSO = {"interno", "externo"}
PADRAO_NOME_ICONE = re.compile(r"^[a-z0-9_-]{1,30}$")

# Limite simples de tentativas de senha: 5 erros por IP a cada 5 minutos
MAX_TENTATIVAS_SENHA = 5
JANELA_TENTATIVAS_SEGUNDOS = 300
_tentativas_falhas = {}
_trava_tentativas = threading.Lock()


# =====================================================================
# CATÁLOGO DE PLATAFORMAS
# =====================================================================

# Campos do formato antigo (em inglês) e seus equivalentes atuais.
CAMPOS_FORMATO_ANTIGO = {
    "name": "nome",
    "description": "descricao",
    "type": "tipo",
    "icon": "icone",
    "active": "ativo",
}


def converter_plataforma_formato_antigo(plataforma):
    """Traduz os campos de uma plataforma salva no formato antigo."""
    convertida = {}
    for campo, valor in plataforma.items():
        if campo == "iconSvg":
            continue
        convertida[CAMPOS_FORMATO_ANTIGO.get(campo, campo)] = valor
    return convertida


def carregar_catalogo():
    """Lê o catálogo do arquivo JSON. Retorna lista vazia se ele não existir."""
    try:
        with open(CAMINHO_CATALOGO, encoding="utf-8") as arquivo:
            dados = json.load(arquivo)
    except FileNotFoundError:
        return []
    except json.JSONDecodeError:
        app.logger.exception("Catálogo de plataformas corrompido: %s", CAMINHO_CATALOGO)
        return []
    if not isinstance(dados, list):
        return []
    return [converter_plataforma_formato_antigo(item) for item in dados if isinstance(item, dict)]


def salvar_catalogo(plataformas):
    """Grava o catálogo em um arquivo temporário e troca pelo atual, para não corromper o JSON."""
    CAMINHO_CATALOGO.parent.mkdir(parents=True, exist_ok=True)
    with _trava_catalogo:
        descritor, caminho_temporario = tempfile.mkstemp(dir=CAMINHO_CATALOGO.parent, suffix=".tmp")
        try:
            with os.fdopen(descritor, "w", encoding="utf-8") as arquivo:
                json.dump(plataformas, arquivo, ensure_ascii=False, indent=2)
            os.replace(caminho_temporario, CAMINHO_CATALOGO)
        except Exception:
            if os.path.exists(caminho_temporario):
                os.remove(caminho_temporario)
            raise


def url_valida(valor):
    if not isinstance(valor, str) or len(valor) > 500:
        return False
    endereco = urlparse(valor)
    return endereco.scheme in {"http", "https"} and bool(endereco.netloc)


def validar_plataforma(plataforma):
    """Valida e normaliza uma plataforma. Retorna (plataforma, erro)."""
    if not isinstance(plataforma, dict):
        return None, "Plataforma inválida."

    identificador = plataforma.get("id")
    nome = plataforma.get("nome")
    descricao = plataforma.get("descricao")
    url = plataforma.get("url")
    tipo = plataforma.get("tipo")
    icone = plataforma.get("icone")
    ativo = plataforma.get("ativo")

    if not isinstance(identificador, str) or not identificador or len(identificador) > 80:
        return None, "Identificador inválido."
    if not isinstance(nome, str) or not nome.strip() or len(nome) > 60:
        return None, "Nome inválido (até 60 caracteres)."
    if not isinstance(descricao, str) or not descricao.strip() or len(descricao) > 150:
        return None, "Descrição inválida (até 150 caracteres)."
    if not url_valida(url):
        return None, "Endereço inválido: use http:// ou https://."
    if tipo not in TIPOS_ACESSO:
        return None, "Tipo de acesso inválido."
    if not isinstance(icone, str) or not PADRAO_NOME_ICONE.match(icone):
        return None, "Ícone inválido."
    if not isinstance(ativo, bool):
        return None, "Campo 'ativo' inválido."

    return {
        "id": identificador,
        "nome": nome.strip(),
        "descricao": descricao.strip(),
        "url": url,
        "tipo": tipo,
        "icone": icone,
        "ativo": ativo,
    }, None


def validar_catalogo(dados):
    """Valida o catálogo inteiro enviado pelo gerenciamento. Retorna (plataformas, erro)."""
    if not isinstance(dados, list) or len(dados) > LIMITE_PLATAFORMAS:
        return None, "Formato de catálogo inválido."
    plataformas = []
    identificadores = set()
    for item in dados:
        plataforma, erro = validar_plataforma(item)
        if erro:
            return None, erro
        if plataforma["id"] in identificadores:
            return None, "Identificador repetido."
        identificadores.add(plataforma["id"])
        plataformas.append(plataforma)
    return plataformas, None


# =====================================================================
# SEGURANÇA E AUTORIZAÇÃO
# =====================================================================

def configuracao_esta_liberada():
    return session.get("configuracao_liberada") is True


def configuracao_requerida(funcao):
    @wraps(funcao)
    def protegida(*args, **kwargs):
        if configuracao_esta_liberada():
            return funcao(*args, **kwargs)
        return jsonify({"erro": "Não autorizado."}), 401
    return protegida


def senha_bloqueada_por_tentativas(ip):
    agora = time.time()
    with _trava_tentativas:
        recentes = [momento for momento in _tentativas_falhas.get(ip, []) if agora - momento < JANELA_TENTATIVAS_SEGUNDOS]
        _tentativas_falhas[ip] = recentes
        return len(recentes) >= MAX_TENTATIVAS_SENHA


def registrar_tentativa_falha(ip):
    with _trava_tentativas:
        _tentativas_falhas.setdefault(ip, []).append(time.time())


def validar_senha_configuracao(senha):
    senha_configurada = env_obrigatoria("CONFIG_PASSWORD")
    return hmac.compare_digest(senha.encode("utf-8"), senha_configurada.encode("utf-8"))


@app.context_processor
def contexto_acesso_configuracao():
    return {"configuracao_liberada": configuracao_esta_liberada()}


@app.post("/api/configuracoes/desbloquear")
def desbloquear_configuracoes():
    ip = request.remote_addr or "desconhecido"
    if senha_bloqueada_por_tentativas(ip):
        return jsonify({"erro": "Muitas tentativas. Aguarde alguns minutos."}), 429
    senha = str((request.get_json(silent=True) or {}).get("senha") or "")
    if not senha:
        return jsonify({"erro": "Informe a senha."}), 400
    if not validar_senha_configuracao(senha):
        registrar_tentativa_falha(ip)
        return jsonify({"erro": "Senha incorreta."}), 401
    session.clear()
    session.permanent = True
    session["configuracao_liberada"] = True
    return jsonify({"liberado": True})


@app.post("/api/configuracoes/bloquear")
def bloquear_configuracoes():
    session.clear()
    return jsonify({"liberado": False})


# =====================================================================
# ROTAS FLASK
# =====================================================================

@app.get("/")
def painel_principal():
    return render_template("index.html")


@app.get("/gerenciamento")
def pagina_gerenciamento():
    resposta = app.make_response(render_template("gerenciamento.html"))
    resposta.headers["Cache-Control"] = "no-store"
    return resposta


@app.get("/api/plataformas")
def listar_plataformas():
    resposta = jsonify(carregar_catalogo())
    resposta.headers["Cache-Control"] = "no-store"
    return resposta


@app.put("/api/plataformas")
@configuracao_requerida
def salvar_plataformas():
    if not request.is_json:
        return jsonify({"erro": "Envie os dados em JSON."}), 415
    plataformas, erro = validar_catalogo(request.get_json(silent=True))
    if erro:
        return jsonify({"erro": erro}), 400
    try:
        salvar_catalogo(plataformas)
    except Exception:
        app.logger.exception("Erro ao salvar o catálogo de plataformas")
        return jsonify({"erro": "Não foi possível salvar o catálogo."}), 500
    return jsonify({"salvo": True})


if __name__ == "__main__":
    # Servidor de desenvolvimento. Em produção, use gunicorn (ex.: gunicorn -w 2 app:app).
    app.run(host="127.0.0.1", port=5000, debug=os.getenv("FLASK_DEBUG") == "1")
