// ===== Configuração e estado =====
const CHAVE = "taskspeed_tarefas";
const CHAVE_TEMA = "taskspeed_tema";
const CHAVE_LEGADA = "taskflow_tarefas";

const CATEGORIAS = ["Estudos", "Faculdade", "Trabalho", "Pessoal", "Outros"];
const STATUS = {
  afazer: "A fazer",
  andamento: "Em andamento",
  concluida: "Concluída",
};
const PRIORIDADES = {
  baixa: "Baixa",
  media: "Média",
  alta: "Alta",
};
const MESES = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];
const TITULOS = {
  dashboard: "Dashboard",
  tarefas: "Minhas tarefas",
  calendario: "Calendário",
  categorias: "Categorias",
};
const LIMITE_PAINEL = 5;

let tarefas = [];
let idEmEdicao = null;
let idParaExcluir = null;
let mesVisivel = new Date().getMonth();
let anoVisivel = new Date().getFullYear();
let focoAnteriorModal = null;
let erroAoCarregar = false;

function $(id) {
  return document.getElementById(id);
}

// ===== Persistência e normalização =====
// O acesso ao armazenamento fica centralizado para lidar com bloqueios do navegador.
function lerArmazenamento(chave) {
  try {
    return window.localStorage.getItem(chave);
  } catch (erro) {
    return null;
  }
}

function salvarTarefas() {
  try {
    window.localStorage.setItem(CHAVE, JSON.stringify(tarefas));
    return true;
  } catch (erro) {
    aviso(
      "Não foi possível salvar. Verifique o armazenamento do navegador.",
      "erro",
    );
    return false;
  }
}

function dataValida(texto) {
  if (typeof texto !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(texto)) {
    return false;
  }

  const [ano, mes, dia] = texto.split("-").map(Number);
  const data = new Date(ano, mes - 1, dia);
  return (
    data.getFullYear() === ano &&
    data.getMonth() === mes - 1 &&
    data.getDate() === dia
  );
}

function normalizarData(texto) {
  return dataValida(texto) ? texto : "";
}

function normalizarHora(texto) {
  return typeof texto === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(texto)
    ? texto
    : "";
}

function gerarIdUnico(idsExistentes) {
  let id = Date.now();
  while (idsExistentes.has(id)) id += 1;
  idsExistentes.add(id);
  return id;
}

function normalizarTarefa(registro, indice, idsExistentes) {
  if (!registro || typeof registro !== "object" || Array.isArray(registro)) {
    return null;
  }

  const titulo =
    typeof registro.titulo === "string" ? registro.titulo.trim() : "";
  if (!titulo) return null;

  let id = Number(registro.id);
  if (!Number.isSafeInteger(id) || id < 1 || idsExistentes.has(id)) {
    id = gerarIdUnico(idsExistentes);
  } else {
    idsExistentes.add(id);
  }

  const statusValido = Object.prototype.hasOwnProperty.call(
    STATUS,
    registro.status,
  );
  const status = statusValido
    ? registro.status
    : registro.concluida === true
      ? "concluida"
      : "afazer";

  const prioridade = Object.prototype.hasOwnProperty.call(
    PRIORIDADES,
    registro.prioridade,
  )
    ? registro.prioridade
    : "media";
  const categoria = CATEGORIAS.includes(registro.categoria)
    ? registro.categoria
    : "Outros";

  const criadaEmOriginal =
    typeof registro.criadaEm === "string" ? new Date(registro.criadaEm) : null;
  const criadaEm =
    criadaEmOriginal && !Number.isNaN(criadaEmOriginal.getTime())
      ? criadaEmOriginal.toISOString()
      : new Date(Date.now() + indice).toISOString();

  return {
    id,
    titulo,
    descricao: typeof registro.descricao === "string" ? registro.descricao : "",
    inicio: normalizarData(registro.inicio),
    entrega: normalizarData(registro.entrega),
    hora: normalizarHora(registro.hora),
    categoria,
    prioridade,
    status,
    criadaEm,
  };
}

function carregarTarefas() {
  const salvoAtual = lerArmazenamento(CHAVE);
  const salvo =
    salvoAtual === null ? lerArmazenamento(CHAVE_LEGADA) : salvoAtual;

  if (!salvo) {
    tarefas = [];
    return;
  }

  try {
    const registros = JSON.parse(salvo);
    if (!Array.isArray(registros)) {
      tarefas = [];
      erroAoCarregar = true;
      return;
    }

    const idsExistentes = new Set();
    tarefas = registros
      .map(function (registro, indice) {
        return normalizarTarefa(registro, indice, idsExistentes);
      })
      .filter(Boolean);
  } catch (erro) {
    tarefas = [];
    erroAoCarregar = true;
  }
}

// ===== Datas e prazos =====
function doisDigitos(numero) {
  return String(numero).padStart(2, "0");
}

function hojeTexto() {
  const hoje = new Date();
  return [
    hoje.getFullYear(),
    doisDigitos(hoje.getMonth() + 1),
    doisDigitos(hoje.getDate()),
  ].join("-");
}

function horaAgora() {
  const agora = new Date();
  return doisDigitos(agora.getHours()) + ":" + doisDigitos(agora.getMinutes());
}

function diasAte(texto) {
  if (!dataValida(texto)) return Infinity;

  const [ano, mes, dia] = texto.split("-").map(Number);
  const alvo = new Date(ano, mes - 1, dia);
  const agora = new Date();
  const hoje = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate());
  return Math.round((alvo - hoje) / 86400000);
}

function formatarData(texto) {
  if (!dataValida(texto)) return "—";
  const [ano, mes, dia] = texto.split("-");
  return dia + "/" + mes + "/" + ano;
}

function formatarEntrega(tarefa) {
  if (!tarefa.entrega) return "Sem data";
  return (
    formatarData(tarefa.entrega) + (tarefa.hora ? " às " + tarefa.hora : "")
  );
}

function estaAtrasada(tarefa) {
  if (tarefa.status === "concluida" || !tarefa.entrega) return false;
  const dias = diasAte(tarefa.entrega);
  if (dias < 0) return true;
  return dias === 0 && Boolean(tarefa.hora) && tarefa.hora < horaAgora();
}

function venceLogo(tarefa) {
  if (
    tarefa.status === "concluida" ||
    !tarefa.entrega ||
    estaAtrasada(tarefa)
  ) {
    return false;
  }
  return diasAte(tarefa.entrega) <= 2;
}

// ===== Utilitários de interface =====
function buscarTarefa(id) {
  return tarefas.find(function (tarefa) {
    return tarefa.id === id;
  });
}

function escapar(texto) {
  return String(texto)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function aviso(mensagem, tipo) {
  const area = $("avisos");
  if (!area) return;

  const caixa = document.createElement("div");
  caixa.className = "aviso " + (tipo || "sucesso");
  caixa.textContent = mensagem;
  area.appendChild(caixa);

  window.setTimeout(function () {
    caixa.remove();
  }, 3200);
}

function abrirModal(idModal, seletorFoco) {
  const modal = $(idModal);
  if (!modal) return;

  if (!document.querySelector(".fundo-modal.aberto")) {
    focoAnteriorModal = document.activeElement;
  }

  modal.classList.add("aberto");
  modal.setAttribute("aria-hidden", "false");
  const alvo = seletorFoco
    ? modal.querySelector(seletorFoco)
    : modal.querySelector(".modal");
  if (alvo) alvo.focus();
}

function fecharModais() {
  const haviaModalAberto = Boolean(
    document.querySelector(".fundo-modal.aberto"),
  );

  document.querySelectorAll(".fundo-modal").forEach(function (modal) {
    modal.classList.remove("aberto");
    modal.setAttribute("aria-hidden", "true");
  });

  if (haviaModalAberto && focoAnteriorModal && focoAnteriorModal.isConnected) {
    focoAnteriorModal.focus();
  }
  focoAnteriorModal = null;
}

// ===== Cadastro e edição =====
function abrirFormulario(id, dataInicial) {
  const formulario = $("form-tarefa");
  formulario.reset();
  $("erro").textContent = "";
  idEmEdicao = id || null;

  if (idEmEdicao !== null) {
    const tarefa = buscarTarefa(idEmEdicao);
    if (!tarefa) {
      idEmEdicao = null;
      aviso("Essa tarefa não está mais disponível.", "erro");
      return;
    }

    $("titulo-modal").textContent = "Editar tarefa";
    $("titulo").value = tarefa.titulo;
    $("descricao").value = tarefa.descricao;
    $("inicio").value = tarefa.inicio;
    $("entrega").value = tarefa.entrega;
    $("hora").value = tarefa.hora;
    $("categoria").value = tarefa.categoria;
    $("prioridade").value = tarefa.prioridade;
    $("status").value = tarefa.status;
  } else {
    $("titulo-modal").textContent = "Nova tarefa";
    $("entrega").value = normalizarData(dataInicial);
  }

  abrirModal("modal-form", "#titulo");
}

function validar(dados) {
  if (dados.titulo.length < 3) {
    return "O título precisa ter pelo menos 3 caracteres.";
  }
  if (dados.hora && !dados.entrega) {
    return "Informe a data de entrega para usar o horário.";
  }
  if (dados.inicio && !dataValida(dados.inicio)) {
    return "Informe uma data de início válida.";
  }
  if (dados.entrega && !dataValida(dados.entrega)) {
    return "Informe uma data de entrega válida.";
  }
  if (dados.inicio && dados.entrega && dados.entrega < dados.inicio) {
    return "A entrega não pode ser antes do início.";
  }
  if (dados.hora && !normalizarHora(dados.hora)) {
    return "Informe um horário válido.";
  }
  if (!CATEGORIAS.includes(dados.categoria)) {
    return "Selecione uma categoria válida.";
  }
  if (!Object.prototype.hasOwnProperty.call(PRIORIDADES, dados.prioridade)) {
    return "Selecione uma prioridade válida.";
  }
  if (!Object.prototype.hasOwnProperty.call(STATUS, dados.status)) {
    return "Selecione um status válido.";
  }
  return "";
}

function salvarFormulario(evento) {
  evento.preventDefault();

  const dados = {
    titulo: $("titulo").value.trim(),
    descricao: $("descricao").value.trim(),
    inicio: $("inicio").value,
    entrega: $("entrega").value,
    hora: $("hora").value,
    categoria: $("categoria").value,
    prioridade: $("prioridade").value,
    status: $("status").value,
  };

  const erro = validar(dados);
  if (erro) {
    $("erro").textContent = erro;
    aviso(erro, "erro");
    return;
  }

  if (idEmEdicao === null) {
    const idsExistentes = new Set(
      tarefas.map(function (tarefa) {
        return tarefa.id;
      }),
    );
    dados.id = gerarIdUnico(idsExistentes);
    dados.criadaEm = new Date().toISOString();
    tarefas.push(dados);
    aviso("Tarefa cadastrada!");
  } else {
    const tarefa = buscarTarefa(idEmEdicao);
    if (!tarefa) {
      aviso("Não foi possível localizar a tarefa para edição.", "erro");
      fecharModais();
      return;
    }
    Object.assign(tarefa, dados);
    aviso("Tarefa atualizada!");
  }

  salvarTarefas();
  fecharModais();
  atualizarTudo();
}

// ===== Status, exclusão e detalhes =====
function alternarStatus(id) {
  const tarefa = buscarTarefa(id);
  if (!tarefa) return;

  tarefa.status = tarefa.status === "concluida" ? "afazer" : "concluida";
  salvarTarefas();
  fecharModais();
  atualizarTudo();
  aviso(
    tarefa.status === "concluida" ? "Tarefa concluída!" : "Tarefa reaberta.",
  );
}

function excluirTarefa(id) {
  const tarefa = buscarTarefa(id);
  if (!tarefa) return;

  idParaExcluir = id;
  $("texto-excluir").textContent =
    '"' + tarefa.titulo + '" será removida permanentemente.';
  fecharModais();
  abrirModal("modal-excluir", "[data-acao='fechar']");
}

function confirmarExclusao() {
  if (idParaExcluir === null || !buscarTarefa(idParaExcluir)) {
    fecharModais();
    idParaExcluir = null;
    return;
  }

  tarefas = tarefas.filter(function (tarefa) {
    return tarefa.id !== idParaExcluir;
  });
  idParaExcluir = null;
  salvarTarefas();
  fecharModais();
  atualizarTudo();
  aviso("Tarefa excluída.");
}

function mostrarDetalhes(id) {
  const tarefa = buscarTarefa(id);
  if (!tarefa) return;

  const textoBotao = tarefa.status === "concluida" ? "Reabrir" : "Concluir";
  const prioridade = PRIORIDADES[tarefa.prioridade] || PRIORIDADES.media;
  const status = STATUS[tarefa.status] || STATUS.afazer;
  const dataCriacao = new Date(tarefa.criadaEm);
  const criacaoFormatada = Number.isNaN(dataCriacao.getTime())
    ? "Não disponível"
    : dataCriacao.toLocaleDateString("pt-BR");

  $("conteudo-detalhes").innerHTML = `
    <h3 id="titulo-detalhes">${escapar(tarefa.titulo)}</h3>
    <p class="tarefa-descricao">${escapar(tarefa.descricao) || "Sem descrição."}</p>
    <dl class="detalhes">
      <dt>Categoria</dt><dd>${escapar(tarefa.categoria)}</dd>
      <dt>Prioridade</dt><dd>${prioridade}</dd>
      <dt>Status</dt><dd>${status}</dd>
      <dt>Início</dt><dd>${formatarData(tarefa.inicio)}</dd>
      <dt>Entrega</dt><dd>${formatarEntrega(tarefa)}</dd>
      <dt>Criada em</dt><dd>${criacaoFormatada}</dd>
    </dl>
    <div class="acoes">
      <button type="button" class="botao" data-acao="status" data-id="${tarefa.id}">${textoBotao}</button>
      <button type="button" class="botao" data-acao="editar" data-id="${tarefa.id}">Editar</button>
      <button type="button" class="botao botao-excluir" data-acao="excluir" data-id="${tarefa.id}">Excluir</button>
      <button type="button" class="botao" data-acao="fechar">Fechar</button>
    </div>`;
  abrirModal("modal-detalhes", ".modal");
}

// ===== Filtros e ordenação =====
function filtrarTarefas() {
  const busca = $("busca").value.trim().toLowerCase();
  const categoria = $("f-categoria").value;
  const prioridade = $("f-prioridade").value;
  const status = $("f-status").value;
  const periodo = $("f-periodo").value;

  return tarefas.filter(function (tarefa) {
    if (busca && !tarefa.titulo.toLowerCase().includes(busca)) return false;
    if (categoria && tarefa.categoria !== categoria) return false;
    if (prioridade && tarefa.prioridade !== prioridade) return false;
    if (status && tarefa.status !== status) return false;
    if (periodo === "hoje" && tarefa.entrega !== hojeTexto()) return false;
    if (
      periodo === "proximas" &&
      !(
        tarefa.entrega &&
        tarefa.status !== "concluida" &&
        !estaAtrasada(tarefa)
      )
    )
      return false;
    if (periodo === "atrasadas" && !estaAtrasada(tarefa)) return false;
    return true;
  });
}

function chaveEntrega(tarefa) {
  return (tarefa.entrega || "9999-99-99") + (tarefa.hora || "99:99");
}

function ordenarTarefas(lista) {
  const modo = $("ordem").value;
  const peso = { alta: 0, media: 1, baixa: 2 };

  return lista.sort(function (a, b) {
    if (modo === "prioridade") return peso[a.prioridade] - peso[b.prioridade];
    if (modo === "criacao") return b.criadaEm.localeCompare(a.criadaEm);
    return chaveEntrega(a).localeCompare(chaveEntrega(b));
  });
}

function limparFiltros() {
  $("busca").value = "";
  $("f-categoria").value = "";
  $("f-prioridade").value = "";
  $("f-status").value = "";
  $("f-periodo").value = "";
  $("ordem").value = "entrega";
  mostrarLista();
}

// ===== Lista de tarefas =====
function criarLinha(tarefa) {
  let alerta = "";
  if (estaAtrasada(tarefa)) {
    alerta = '<span class="sinal sinal-atraso">Atrasada</span>';
  } else if (venceLogo(tarefa)) {
    alerta = '<span class="sinal sinal-aviso">Vence logo</span>';
  }

  const textoBotao = tarefa.status === "concluida" ? "Reabrir" : "Concluir";
  const descricao = tarefa.descricao
    ? `<span class="desc">${escapar(tarefa.descricao)}</span>`
    : "";
  const hora = tarefa.hora
    ? `<span class="hora">${escapar(tarefa.hora)}</span>`
    : "";

  return `
    <li class="linha ${tarefa.status === "concluida" ? "concluida" : ""}">
      <span class="prio prio-${tarefa.prioridade}">${PRIORIDADES[tarefa.prioridade]}</span>
      <div class="col-tarefa"><strong>${escapar(tarefa.titulo)}</strong>${descricao}<span class="meta">${escapar(tarefa.categoria)}</span></div>
      <span class="status st-${tarefa.status}">${STATUS[tarefa.status]}</span>
      <div class="col-entrega"><span class="data">${formatarData(tarefa.entrega)}</span>${hora}${alerta}</div>
      <div class="col-acoes">
        <button type="button" class="botao botao-texto" data-acao="status" data-id="${tarefa.id}">${textoBotao}</button>
        <button type="button" class="botao botao-texto" data-acao="editar" data-id="${tarefa.id}">Editar</button>
        <button type="button" class="botao botao-texto botao-excluir" data-acao="excluir" data-id="${tarefa.id}">Excluir</button>
      </div>
    </li>`;
}

function textoListaVazia() {
  if (tarefas.length === 0) {
    return '<li class="vazio">Nenhuma tarefa cadastrada. <button type="button" class="botao botao-principal" data-acao="nova">Criar primeira tarefa</button></li>';
  }
  return '<li class="vazio">Nenhuma tarefa corresponde aos filtros. <button type="button" class="botao" data-acao="limpar">Limpar filtros</button></li>';
}

function mostrarLista() {
  const lista = ordenarTarefas(filtrarTarefas());
  $("contagem").textContent =
    lista.length + " de " + tarefas.length + " tarefas";
  $("lista").innerHTML = lista.length
    ? lista.map(criarLinha).join("")
    : textoListaVazia();
}

// ===== Dashboard =====
function contarStatus(status) {
  return tarefas.filter(function (tarefa) {
    return tarefa.status === status;
  }).length;
}

function porEntrega(a, b) {
  return chaveEntrega(a).localeCompare(chaveEntrega(b));
}

function mostrarVerTodas(idBotao, total) {
  $(idBotao).hidden = total <= LIMITE_PAINEL;
  $(idBotao).textContent = "Ver todas (" + total + ")";
}

function criarItensMini(lista, textoVazio) {
  if (lista.length === 0) return `<li class="vazio">${textoVazio}</li>`;

  return lista
    .slice(0, LIMITE_PAINEL)
    .map(function (tarefa) {
      const hora = tarefa.hora
        ? `<span class="hora">${escapar(tarefa.hora)}</span>`
        : "";
      return `<li>
      <button type="button" class="mini-tarefa" data-acao="detalhes" data-id="${tarefa.id}">
        <span class="prio prio-${tarefa.prioridade}">${PRIORIDADES[tarefa.prioridade]}</span>
        <strong>${escapar(tarefa.titulo)}</strong>
        <span class="entrega"><span class="data">${formatarData(tarefa.entrega)}</span>${hora}</span>
      </button>
    </li>`;
    })
    .join("");
}

function atualizarDashboard() {
  const total = tarefas.length;
  const concluidas = contarStatus("concluida");
  const atrasadas = tarefas.filter(estaAtrasada);
  const percentual = total > 0 ? Math.round((concluidas / total) * 100) : 0;

  $("n-total").textContent = total;
  $("n-afazer").textContent = contarStatus("afazer");
  $("n-andamento").textContent = contarStatus("andamento");
  $("n-concluidas").textContent = concluidas;
  $("n-atrasadas").textContent = atrasadas.length;
  $("ind-atrasadas").classList.toggle("alerta", atrasadas.length > 0);
  $("percentual").textContent = percentual + "% concluído";

  const proximas = tarefas
    .filter(function (tarefa) {
      return (
        tarefa.entrega && tarefa.status !== "concluida" && !estaAtrasada(tarefa)
      );
    })
    .sort(porEntrega);
  atrasadas.sort(porEntrega);

  const semTarefas =
    'Nenhuma tarefa cadastrada. <button type="button" class="botao botao-principal" data-acao="nova">Criar primeira tarefa</button>';
  $("lista-proximas").innerHTML = criarItensMini(
    proximas,
    tarefas.length === 0 ? semTarefas : "Nenhuma entrega prevista.",
  );
  $("lista-atrasadas").innerHTML = criarItensMini(atrasadas, "");
  $("bloco-atrasadas").hidden = atrasadas.length === 0;
  mostrarVerTodas("ver-atrasadas", atrasadas.length);
  mostrarVerTodas("ver-proximas", proximas.length);

  let segmentos = "";
  let legenda = "";
  Object.keys(STATUS).forEach(function (chave) {
    const quantidade = contarStatus(chave);
    const porcentagem = total > 0 ? (quantidade / total) * 100 : 0;
    const porcentagemInteira = total > 0 ? Math.round(porcentagem) : 0;
    segmentos += `<div class="seg cor-${chave}" style="width:${porcentagem}%"></div>`;
    legenda += `<span><i class="cor-${chave}"></i>${STATUS[chave]} <b>${porcentagemInteira}%</b></span>`;
  });
  $("grafico").innerHTML =
    `<div class="barra-seg">${segmentos}</div><div class="legenda">${legenda}</div>`;
}

// ===== Calendário =====
function desenharCalendario() {
  $("titulo-mes").textContent = MESES[mesVisivel] + " de " + anoVisivel;
  const primeiroDia = new Date(anoVisivel, mesVisivel, 1).getDay();
  const diasNoMes = new Date(anoVisivel, mesVisivel + 1, 0).getDate();
  let html = "";

  for (let indice = 0; indice < primeiroDia; indice += 1) {
    html += '<div class="dia vazio" aria-hidden="true"></div>';
  }

  for (let dia = 1; dia <= diasNoMes; dia += 1) {
    const data =
      anoVisivel + "-" + doisDigitos(mesVisivel + 1) + "-" + doisDigitos(dia);
    const classeHoje = data === hojeTexto() ? " hoje" : "";
    const rotuloData = dia + " de " + MESES[mesVisivel] + " de " + anoVisivel;

    html += `<div class="dia${classeHoje}">
      <button type="button" class="num-dia dia-novo" data-acao="nova" data-data="${data}" aria-label="Criar tarefa em ${rotuloData}">${dia}</button>`;

    tarefas.forEach(function (tarefa) {
      if (tarefa.entrega === data) {
        const feita = tarefa.status === "concluida" ? " feita" : "";
        const hora = tarefa.hora ? escapar(tarefa.hora) + " " : "";
        const prioridade = PRIORIDADES[tarefa.prioridade] || PRIORIDADES.media;
        html += `<button type="button" class="chip chip-${tarefa.prioridade}${feita}" data-acao="detalhes" data-id="${tarefa.id}" title="Prioridade ${prioridade.toLowerCase()}">${hora}${escapar(tarefa.titulo)}</button>`;
      }
    });

    html += "</div>";
  }

  $("grade-calendario").innerHTML = html;
}

function mudarMes(passo) {
  if (passo === 0) {
    const hoje = new Date();
    mesVisivel = hoje.getMonth();
    anoVisivel = hoje.getFullYear();
  } else {
    mesVisivel += passo;
    if (mesVisivel < 0) {
      mesVisivel = 11;
      anoVisivel -= 1;
    } else if (mesVisivel > 11) {
      mesVisivel = 0;
      anoVisivel += 1;
    }
  }
  desenharCalendario();
}

// ===== Categorias =====
function desenharCategorias() {
  $("grade-categorias").innerHTML = CATEGORIAS.map(function (nome) {
    const tarefasDaCategoria = tarefas.filter(function (tarefa) {
      return tarefa.categoria === nome;
    });
    const feitas = tarefasDaCategoria.filter(function (tarefa) {
      return tarefa.status === "concluida";
    }).length;
    const percentual =
      tarefasDaCategoria.length > 0
        ? Math.round((feitas / tarefasDaCategoria.length) * 100)
        : 0;

    return `<div class="linha-cat">
      <strong>${nome}</strong>
      <div class="barra" role="progressbar" aria-label="Conclusão de ${nome}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${percentual}"><div class="barra-cheia" style="width:${percentual}%"></div></div>
      <span class="num">${feitas}/${tarefasDaCategoria.length}</span>
      <button type="button" class="botao botao-texto" data-acao="ver-categoria" data-cat="${nome}">Ver tarefas</button>
    </div>`;
  }).join("");
}

// ===== Navegação e tema =====
function mostrarPagina(nome) {
  if (!Object.prototype.hasOwnProperty.call(TITULOS, nome)) return;

  document.querySelectorAll(".pagina").forEach(function (pagina) {
    pagina.hidden = pagina.id !== "pagina-" + nome;
  });
  document
    .querySelectorAll(".menu .nav[data-pagina]")
    .forEach(function (botao) {
      const ativo = botao.dataset.pagina === nome;
      botao.classList.toggle("ativo", ativo);
      if (ativo) botao.setAttribute("aria-current", "page");
      else botao.removeAttribute("aria-current");
    });
  document.querySelectorAll(".alternar button").forEach(function (botao) {
    const ativo = botao.dataset.pagina === nome;
    botao.classList.toggle("ativo", ativo);
    botao.setAttribute("aria-pressed", String(ativo));
  });

  $("alternar").hidden = nome !== "tarefas" && nome !== "calendario";
  $("titulo-pagina").textContent = TITULOS[nome];
}

function aplicarTema() {
  const tema = lerArmazenamento(CHAVE_TEMA);
  const claro = tema === "claro";
  document.body.classList.toggle("claro", claro);
  $("botao-tema").setAttribute("aria-pressed", String(claro));
  $("botao-tema").setAttribute(
    "aria-label",
    claro ? "Ativar tema escuro" : "Ativar tema claro",
  );
}

function alternarTema() {
  const claro = !document.body.classList.contains("claro");
  document.body.classList.toggle("claro", claro);
  $("botao-tema").setAttribute("aria-pressed", String(claro));
  $("botao-tema").setAttribute(
    "aria-label",
    claro ? "Ativar tema escuro" : "Ativar tema claro",
  );

  try {
    window.localStorage.setItem(CHAVE_TEMA, claro ? "claro" : "escuro");
  } catch (erro) {
    aviso("O tema foi alterado, mas não pôde ser salvo no navegador.", "erro");
  }
}

function atualizarTudo() {
  atualizarDashboard();
  mostrarLista();
  desenharCalendario();
  desenharCategorias();
}

function preencherCategorias() {
  const opcoes = CATEGORIAS.map(function (categoria) {
    return `<option value="${categoria}">${categoria}</option>`;
  }).join("");
  $("categoria").innerHTML = opcoes;
  $("f-categoria").innerHTML =
    '<option value="">Todas as categorias</option>' + opcoes;
}

// ===== Eventos =====
document.addEventListener("click", function (evento) {
  if (
    evento.target.classList &&
    evento.target.classList.contains("fundo-modal")
  ) {
    fecharModais();
    return;
  }

  const elemento = evento.target.closest("[data-acao]");
  if (!elemento) return;

  const acao = elemento.dataset.acao;
  const id = Number(elemento.dataset.id);

  if (acao === "pagina") {
    mostrarPagina(elemento.dataset.pagina);
  } else if (acao === "nova") {
    abrirFormulario(null, elemento.dataset.data);
  } else if (acao === "editar") {
    fecharModais();
    abrirFormulario(id);
  } else if (acao === "excluir") {
    excluirTarefa(id);
  } else if (acao === "confirmar-excluir") {
    confirmarExclusao();
  } else if (acao === "ver-periodo") {
    limparFiltros();
    $("f-periodo").value = elemento.dataset.periodo;
    mostrarLista();
    mostrarPagina("tarefas");
  } else if (acao === "status") {
    alternarStatus(id);
  } else if (acao === "detalhes") {
    mostrarDetalhes(id);
  } else if (acao === "fechar") {
    fecharModais();
  } else if (acao === "mes") {
    mudarMes(Number(elemento.dataset.passo));
  } else if (acao === "tema") {
    alternarTema();
  } else if (acao === "limpar") {
    limparFiltros();
  } else if (acao === "ver-categoria") {
    limparFiltros();
    $("f-categoria").value = elemento.dataset.cat;
    mostrarLista();
    mostrarPagina("tarefas");
  }
});

document.addEventListener("keydown", function (evento) {
  const modalAberto = document.querySelector(
    ".fundo-modal.aberto [role='dialog']",
  );
  if (!modalAberto) return;

  if (evento.key === "Escape") {
    fecharModais();
    return;
  }

  // Mantém a navegação por Tab dentro do diálogo enquanto ele estiver aberto.
  if (evento.key === "Tab") {
    const elementosFocaveis = Array.from(
      modalAberto.querySelectorAll(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ),
    );
    if (elementosFocaveis.length === 0) {
      evento.preventDefault();
      modalAberto.focus();
      return;
    }

    const primeiro = elementosFocaveis[0];
    const ultimo = elementosFocaveis[elementosFocaveis.length - 1];
    if (evento.shiftKey && document.activeElement === primeiro) {
      evento.preventDefault();
      ultimo.focus();
    } else if (!evento.shiftKey && document.activeElement === ultimo) {
      evento.preventDefault();
      primeiro.focus();
    }
  }
});

$("form-tarefa").addEventListener("submit", salvarFormulario);
document.querySelectorAll(".campo-filtro").forEach(function (campo) {
  if (campo.id === "busca") campo.addEventListener("input", mostrarLista);
  else campo.addEventListener("change", mostrarLista);
});

// ===== Inicialização =====
preencherCategorias();
aplicarTema();
carregarTarefas();
mostrarPagina("dashboard");
atualizarTudo();

if (erroAoCarregar) {
  aviso(
    "Os dados salvos estavam inválidos e não puderam ser carregados.",
    "erro",
  );
}
