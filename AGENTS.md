# AGENTS.md

Guia para agentes e pessoas que contribuem com o projeto **Gastos do
Casamento** (`casamento-gastos`). Leia por completo antes de alterar código.

## Visão geral

Aplicação full-stack para planejar o orçamento do casamento, acompanhar
fornecedores/despesas por categoria e armazenar contratos em PDF.

- **Frontend:** Angular 19 (standalone components, signals) + Tailwind CSS.
- **Backend:** Express executado como Firebase Function (Node 22), em `functions/`.
- **Dados:** Firestore (orçamento e despesas) e Cloud Storage (contratos PDF).
- **Hospedagem:** Firebase Hosting; `/api/**` é encaminhado para a Function.

```text
Angular ──── ID token ────► Firebase Hosting ── /api/** ──► Express / Functions
                                                               ├── Firestore
                                                               └── Cloud Storage
```

As regras de `firestore.rules` e `storage.rules` bloqueiam acesso direto de
clientes: toda operação passa pela API.

## Estrutura

```text
src/app/
  app.component.*            Shell da aplicação (login/cadastro, layout, resumo)
  budget-store.service.ts    Store com signals: estado e regras de cálculo do orçamento
  models.ts                  Tipos de domínio e categorias padrão
  components/                category-table, expense-section
  core/                      api.service (HTTP), auth.service, auth.interceptor,
                             firebase-auth.client (único ponto que usa o SDK do
                             Firebase), firebase.config
functions/src/
  index.ts                   App Express, rotas e tratamento de erros
  firestore.ts               Instância do Firestore (banco nomeado)
  middleware/auth.middleware.ts   Valida o ID token e exige cadastro em `users`
  user/                      cadastro (signup), serviço e validação de usuários
  budget/                    controller, service, validation, defaults, types
  contract/                  upload/download/remoção de contratos (busboy + Storage)
  api.spec.ts                Testes da API (jest + supertest)
```

### Rotas da API

Públicas: `GET /api/health`, `POST /api/signup`.
Protegidas (middleware de auth): `GET /api/me`, `GET|PUT /api/budget`,
`POST /api/budget/import`, `POST /api/expenses`,
`PUT|DELETE /api/expenses/:id`,
`POST|GET|DELETE /api/expenses/:id/contract`.

`GET /api/me` devolve `{ id, email, name }`. `GET /api/budget` também devolve
`users` (`{ id, name, email }` dos cadastrados, ordenados por nome), usados no
seletor de responsável por categoria. `Category.responsible` (opcional) guarda
o `id` do usuário; `PUT /api/budget` e `POST /api/budget/import` rejeitam valor
que não seja de um usuário cadastrado (uma atribuição já salva que não mudou é
aceita).

Orçamentos antigos guardavam o e-mail do responsável. Na leitura (e na
importação), um e-mail que corresponde a um usuário cadastrado vira o `id`
dele; os demais ficam sem responsável. O valor convertido é gravado no próximo
salvamento.

### Autenticação

Usuários se cadastram com nome, e-mail, senha e código de convite em
`POST /api/signup`. A API confere o código com `SIGNUP_CODE`, cria a conta no
Firebase Authentication e grava `users/{uid}` (`{ name, email, createdAt }`) no
Firestore. Respostas: 201, 400 (dados inválidos), 403 (código inválido ou
`SIGNUP_CODE` ausente) e 409 (e-mail já cadastrado).

A conta é criada desabilitada e só é habilitada depois de gravar `users/{uid}`.
Se um dos passos falhar, a API remove a conta incompleta e registra no log
(`[signup] não foi possível remover a conta incompleta`, com `uid` e e-mail) se
nem a remoção funcionou. Um novo cadastro com o mesmo e-mail descarta a conta
que ficou desabilitada, nunca entrou e tem mais de 60 s, e repete uma vez; contas
habilitadas, que já entraram ou recentes continuam respondendo 409.

O login é feito pelo SDK do Firebase no frontend, que envia
`Authorization: Bearer <ID token>`. O middleware valida o token com
`verifyIdToken` (401 se ausente ou inválido) e exige o registro em
`users/{uid}` (403 se não existir). Assim, contas criadas direto pelo SDK, sem
o código de convite, não acessam a API.

No frontend, só `core/firebase-auth.client.ts` importa o SDK (`firebase/auth`);
o restante depende dele via `AuthService`, e os testes o substituem por um
fake. Em modo de desenvolvimento (`ng serve` e o build usado por
`npm run emulators`) o client conecta ao emulador de Auth (`127.0.0.1:9099`); o
build de produção usa o Firebase Auth real. O interceptor envia o token em
`/api/**` (exceto `/api/signup`) e encerra a sessão em respostas 401/403.

Fora de escopo por enquanto: recuperação de senha, verificação de e-mail,
edição de perfil e papéis diferentes entre usuários.

## Comandos

```bash
npm install && (cd functions && npm install)   # instalação

npm start                  # ng serve
npm run emulators          # build + emuladores Firebase (Hosting em :5002)
npm run build              # build web
npm test                   # testes web (Karma/Jasmine)
npm run test:functions     # testes da API (Jest)
npm run build:functions    # tsc em functions/
npx prettier --check .     # formatação (obrigatória no CI)
npx prettier --write .     # corrige formatação
```

Para rodar localmente crie `functions/.env.local` (não versionado). No deploy,
`SIGNUP_CODE` vem da variável do repositório (Settings → Variables):

```bash
SIGNUP_CODE=convite-local
```

## Comunicação

Toda comunicação com o usuário (responsável pelo projeto) é em **português do
Brasil (PT-BR)**. Isso inclui respostas, perguntas, resumos, explicações,
relatórios de progresso e qualquer texto publicado em nome dele (issues,
comentários, PRs e mensagens de commit). Termos técnicos sem tradução usual
(ex.: _commit_, _branch_, _pull request_) e identificadores de código ficam
como estão.

## Convenções de código

- Prettier é a fonte de verdade (`.prettierrc`: aspas simples, ponto e vírgula,
  vírgula final, 80 colunas, LF). Rode antes de commitar.
- TypeScript estrito; sem `any` sem justificativa.
- Textos de UI, mensagens de erro e mensagens de commit/issue em **português**.
- Siga o estilo do código vizinho (nomes, densidade de comentários, idioma).
- Nunca versione segredos nem arquivos `.env*`.

## Fluxo de desenvolvimento (Git)

```text
main      ← produção; todo push dispara CI + deploy no Firebase
develop   ← integração; centraliza todas as alterações
issue-<n> ← branches de trabalho, uma por issue
```

- **`main`** é a branch principal e estável. Só recebe merges vindos de
  `develop` (via PR). Nunca faça commit direto.
- **`develop`** centraliza as alterações. Toda branch de trabalho nasce dela e
  volta para ela via PR.
- **`issue-<numero_da_issue>`** é o padrão das branches de desenvolvimento
  (ex.: `issue-12`). Uma branch por issue, criada a partir de `develop`.

Passo a passo:

1. Garanta uma issue (veja a seção "Issues").
2. Ao começar a análise, mova a issue para **Ready** (veja "Status da issue no
   Project").
3. `git switch develop && git pull && git switch -c issue-<n>` e mova a issue
   para **In progress**.
4. Desenvolva seguindo TDD (seção abaixo), com commits pequenos.
5. Antes de abrir o PR, rode formatação, build e testes (web e functions).
6. Abra PR `issue-<n>` → `develop`, com `Closes #<n>` na descrição, e mova a
   issue para **In review**.
7. Após o merge, confirme a issue em **Done**. Depois da validação em `develop`,
   abra PR `develop` → `main` para liberar.

Observação: o workflow `.github/workflows/ci-cd.yml` roda em push para `main` e
`develop` e em todo PR, inclusive PRs empilhados sobre outra branch `issue-<n>`.
Build e testes valem para todos; o deploy continua restrito a push em `main`.

Mensagens de commit seguem Conventional Commits em português
(`feat:`, `fix:`, `refactor:`, `test:`, `docs:`, `chore:`), por exemplo
`feat(#12): permite excluir categoria sem fornecedores`. Inclua o número da
issue no escopo (`test(#N)`, `feat(#N)`, `refactor(#N)`), como no template de PR.

## Issues

Todo desenvolvimento começa em uma issue. Se ela não existir, crie antes de
escrever código (`gh issue create` ou pela interface do GitHub). Busque
duplicadas antes (`gh issue list --search "<termo>"`).

Issues em branco estão desabilitadas (`.github/ISSUE_TEMPLATE/config.yml`):
use sempre um dos templates abaixo.

| Template                      | Arquivo                                     | Título         | Label         |
| ----------------------------- | ------------------------------------------- | -------------- | ------------- |
| Relatório de Bug              | `.github/ISSUE_TEMPLATE/bug_report.md`      | `[Bug] - `     | `bug`         |
| Solicitação de Funcionalidade | `.github/ISSUE_TEMPLATE/feature_request.md` | `[Feature] - ` | `enhancement` |

Ambos têm as mesmas três seções:

```markdown
**Contexto:**

- Descreva o cenário atual e o problema ou a necessidade: o que existe hoje,
  onde dói e por que importa. (Bug: comportamento observado, passos para
  reproduzir e impacto.)

**DOR:**

- Definition of Ready: o que precisa estar definido para iniciar. Escopo,
  comportamento esperado, regras de negócio e decisões técnicas acordadas.
  (Bug: comportamento esperado, causa conhecida ou hipótese, ambiente afetado e
  decisões técnicas acordadas.)

**DOD:**

- Definition of Done: critérios objetivos e verificáveis para considerar a
  entrega concluída (comportamento, testes, documentação).
```

Boas práticas:

- Título após o prefixo curto, no imperativo, em português; uma issue = uma
  entrega.
- Só inicie o trabalho quando a DOR estiver preenchida e a issue tiver
  Estimate, Size e Priority (veja abaixo).
- Cada critério do DOD deve virar ao menos um teste (ver TDD).
- Trabalho grande deve ser quebrado em issues menores e independentes.
- O PR referencia a issue com `Closes #<n>`; a branch é `issue-<n>`.

### Estimate, Size e Priority

Toda issue **deve** ter os três campos preenchidos antes de iniciar o trabalho.
São _issue fields_ da organização (não campos do Project): defina-os pela
interface da issue ou pela API de issue fields.

- **Estimate:** estimativa de esforço para entregar a issue.
- **Size:** tamanho relativo da issue.
- **Priority:** prioridade em relação às demais issues.

Ao criar uma issue, defina os três campos. Se ela estiver sem algum deles,
preencha-o (ou peça os valores) antes de criar a branch `issue-<n>`. Use os
valores configurados; não invente opções. Estimate é numérico (pontos em
Fibonacci: 1, 2, 3, 5, 8, 13), Size usa XS, S, M, L ou XL e Priority usa
Urgent, High, Medium ou Low.

### Status da issue no Project

Toda issue em andamento deve refletir, no Project "Planejamento a Dois", o que
está acontecendo de fato. Atualize o campo **Status** no momento de cada
transição, sem deixar para o final:

| Status          | Quando                                                                                       |
| --------------- | -------------------------------------------------------------------------------------------- |
| **Backlog**     | Issue criada, ainda sem análise.                                                             |
| **Ready**       | Assim que começar a analisar a issue (DOR, Estimate, Size e Priority sendo confirmados).     |
| **In progress** | Branch `issue-<n>` criada e implementação iniciada.                                          |
| **In review**   | PR aberto para `develop` (ou empilhado sobre outra branch).                                  |
| **Done**        | PR mergeado em `develop`. A issue é fechada pelo `Closes #<n>`; confirme que o status mudou. |

Regras:

- Uma issue com sub-issues acompanha a mais atrasada delas (ex.: fica em
  **In progress** enquanto alguma sub-issue estiver em **In progress**).
- Se o trabalho voltar uma etapa (ex.: revisão pediu mudanças), volte o status
  também.
- Registre na issue, como comentário, o que mudar durante o trabalho:
  decisões técnicas, mudanças de escopo, bloqueios e descobertas relevantes.
- Se a issue ainda não estiver no Project, adicione-a antes de mudar o status.

Comandos (`gh`):

```bash
# adicionar a issue ao Project e obter o id do item
gh project item-add 6 --owner javi-technology \
  --url https://github.com/javi-technology/casamento-planejamento/issues/<n> \
  --format json --jq .id

# id do item de uma issue que já está no Project
gh project item-list 6 --owner javi-technology --format json --limit 200 \
  --jq '.items[] | select(.content.number == <n>) | .id'

# mudar o status
gh project item-edit --id <item-id> --project-id PVT_kwDODUNtT84Blnen \
  --field-id PVTSSF_lADODUNtT84BlnenzhkTn_0 --single-select-option-id <opção>
```

Opções de Status: Backlog `f75ad846`, Ready `61e4505c`, In progress
`47fc9ee4`, In review `df73e18b`, Done `98236657`.

## Pull Requests

O template está em `.github/PULL_REQUEST_TEMPLATE.md` e deve ser preenchido por
completo. O PR vai de `issue-<n>` para `develop` (ou de `develop` para `main`
na liberação).

```markdown
## O que foi feito

<!-- Descreva de forma clara e concisa o que foi implementado. -->

### Commits (TDD)

<!-- Liste os commits seguindo o fluxo Red → Green → Refactor -->

1. `test(#N)`: ...
2. `feat(#N)`: ...
3. `refactor(#N)`: ...

## Testes

<!-- Resumo dos testes adicionados/alterados e resultado da suite. -->

- **X novos testes**
- **Y/Y passando**

## Checklist

- [ ] Testes passam: backend com `npm run test:api` e `npm run test:integration`; frontend com `npm run test:fe`
- [ ] Código formatado e sem erros de lint (backend: `npm --workspace apps/backend run format`; frontend: `npm --workspace apps/frontend run lint`)
- [ ] Issue vinculada no GitHub Projects
- [ ] Branch segue o padrão `<tipo>/<ticket-id>-<slug>`

Closes #<!-- número da issue -->
```

Orientações:

- Os commits listados refletem o ciclo TDD: `test(#N)` (RED), `feat(#N)` ou
  `fix(#N)` (GREEN) e `refactor(#N)` (REFACTOR), onde `N` é o número da issue.
- Em **Testes**, informe quantos testes foram adicionados e o resultado da suíte.
- Os comandos e o padrão de branch do checklist do template vêm de outro
  projeto (workspaces `apps/backend` e `apps/frontend`). Neste repositório
  valem os comandos da seção "Comandos" e a branch `issue-<n>`; marque os itens
  de acordo com isso.

## TDD: RED → GREEN → REFACTOR

Todo código novo ou alterado de comportamento é guiado por testes. Faça um
ciclo por critério de aceite, em passos pequenos.

1. **RED** — escreva primeiro um teste que descreva o comportamento esperado e
   rode-o: ele **deve falhar** pelo motivo certo (não por erro de sintaxe ou
   import). Commit opcional: `test: ...`.
2. **GREEN** — escreva o **mínimo** de código para o teste passar. Sem
   generalizações antecipadas. Rode a suíte inteira da área afetada.
3. **REFACTOR** — com tudo verde, melhore nomes, remova duplicação e simplifique,
   sem mudar comportamento. Rode os testes e o Prettier ao final.

Regras:

- Não escreva código de produção sem um teste vermelho que o exija.
- Para bugs: primeiro um teste que reproduz o bug (RED), depois a correção.
- Nunca enfraqueça nem remova um teste para fazê-lo passar.
- Teste comportamento observável, não detalhes de implementação.

Onde colocar os testes:

| Área               | Ferramenta       | Local / comando                                         |
| ------------------ | ---------------- | ------------------------------------------------------- |
| Frontend (Angular) | Karma + Jasmine  | `src/app/**/*.spec.ts` — `npm test`                     |
| API (Express)      | Jest + supertest | `functions/src/**/*.spec.ts` — `npm run test:functions` |

Os testes da API devem mockar Firestore/Storage; nenhum teste acessa serviços
reais.

## Checklist antes do PR

- [ ] Existe issue com Estimate, Size e Priority preenchidos
- [ ] O Status da issue no Project acompanhou o trabalho (**In progress** na
      implementação; **In review** ao abrir o PR)
- [ ] A branch segue `issue-<n>`, saída de `develop`
- [ ] Cada critério de aceite tem teste (RED → GREEN → REFACTOR cumprido)
- [ ] `npx prettier --check .`
- [ ] `npm run build` e `npm test -- --watch=false --browsers=ChromeHeadless`
- [ ] `npm run build:functions` e `npm run test:functions`
- [ ] PR aponta para `develop` e contém `Closes #<n>`
