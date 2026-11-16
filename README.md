# Task Speed

Gerenciador de tarefas desenvolvido com **HTML5, CSS3 e JavaScript puro**. O projeto reúne tarefas, prazos e prioridades em uma interface com dashboard, lista, calendário e categorias.

## Funcionalidades

- Cadastro, edição, conclusão, reabertura e exclusão de tarefas.
- Organização por categoria, prioridade e status.
- Filtros combinados e ordenação por prazo, prioridade ou data de criação.
- Dashboard com totais, atrasos, próximas entregas e progresso.
- Calendário mensal com acesso aos detalhes das tarefas.
- Tema claro e escuro.
- Persistência local pelo `localStorage` do navegador.

## Tecnologias

- HTML5
- CSS3
- JavaScript (Vanilla)

## Como executar

1. Baixe ou clone o repositório.
2. Abra a pasta do projeto no Visual Studio Code.
3. Execute o arquivo `index.html` com a extensão Live Server ou por outro servidor HTTP local.

Não é necessário instalar dependências ou configurar um banco de dados.

## Estrutura

```text
TaskSpeed/
├── index.html
├── css/
│   └── style.css
├── js/
│   └── dados.js
├── img/
│   └── taskspeed.png
├── README.md
```

## Armazenamento

As tarefas e a preferência de tema ficam salvas no navegador em que o projeto foi utilizado. Os dados não são sincronizados entre navegadores ou dispositivos. Limpar os dados do site no navegador pode apagar as tarefas salvas.

O projeto também reconhece a chave antiga `taskflow_tarefas` para tentar preservar tarefas salvas em versões anteriores do Task Flow.

## Autor

**Luan Henrique de Melo Santos**
