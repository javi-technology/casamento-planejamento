# Gastos do Casamento

Aplicação full-stack para planejar o orçamento do casamento, acompanhar
fornecedores e armazenar contratos em PDF. A interface é Angular 19 com
Tailwind CSS; a API é Express executada no Firebase Functions; os dados ficam
no Firestore e os contratos no Cloud Storage.

## Acesso

O login usa somente o e-mail digitado pelo usuário. A API compara esse valor,
sem verificar posse do endereço ou exigir senha, com a lista `ALLOWED_EMAILS`,
separada por vírgulas e sem distinção entre maiúsculas e minúsculas.

Depois do login, o frontend envia o e-mail no cabeçalho `X-User-Email` para as
rotas protegidas da API. Esse fluxo é intencionalmente baseado apenas na
allowlist configurada.

## Instalação

```bash
npm install
(cd functions && npm install)
```

## Desenvolvimento local

Crie `functions/.env.local` (não versionado) com os e-mails autorizados:

```bash
ALLOWED_EMAILS=teste@example.com,outro@example.com
```

Depois, inicie os emuladores:

```bash
npm run emulators
```

O Hosting Emulator fica em `http://localhost:5002` e serve a aplicação,
incluindo o proxy de `/api/**` para as Functions. Os demais serviços usam:

- Functions: `5001`
- Firestore: `8080`
- Storage: `9199`
- Emulator UI: porta padrão do Firebase

## Produção

No deploy, configure `ALLOWED_EMAILS` como variável do ambiente. O acesso
direto de clientes ao Firestore e ao Storage é bloqueado pelas regras; as
operações passam pela API e pela allowlist de e-mails.

## Arquitetura

```text
Angular ── X-User-Email ──► Firebase Hosting ── /api/** ──► Express / Functions
                                                               ├── Firestore
                                                               └── Cloud Storage
```

## Comandos úteis

```bash
npm run build
npm test
npm run build:functions
npm run test:functions
```
