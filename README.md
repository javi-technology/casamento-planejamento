# Gastos do Casamento

Aplicação full-stack para planejar o orçamento do casamento, acompanhar
fornecedores e armazenar contratos em PDF. A interface é Angular 19 com
Tailwind CSS; a API é Express executada no Firebase Functions; os dados ficam
no Firestore e os contratos no Cloud Storage.

## Acesso

Cada pessoa se cadastra com nome, e-mail, senha e o código de convite
configurado em `SIGNUP_CODE`. As contas ficam no Firebase Authentication e os
dados de exibição em `users/{uid}` no Firestore. O frontend envia o ID token do
Firebase no cabeçalho `Authorization` para as rotas protegidas da API.

Na tela inicial, use "Criar conta" para se cadastrar; depois, entre com e-mail
e senha. O seletor de responsável de cada categoria lista os usuários
cadastrados.

## Instalação

```bash
npm install
(cd functions && npm install)
```

## Desenvolvimento local

Crie `functions/.env.local` (não versionado) com o código de convite:

```bash
SIGNUP_CODE=convite-local
```

Depois, inicie os emuladores:

```bash
npm run emulators
```

O build de desenvolvimento conecta ao emulador de Auth, então as contas criadas
localmente ficam só no emulador. O Hosting Emulator fica em
`http://localhost:5002` e serve a aplicação,
incluindo o proxy de `/api/**` para as Functions. Os demais serviços usam:

- Auth: `9099`
- Functions: `5001`
- Firestore: `8080`
- Storage: `9199`
- Emulator UI: porta padrão do Firebase

## Produção

No deploy, configure `SIGNUP_CODE` como variável do repositório e habilite o
provedor e-mail/senha no Firebase Authentication. O acesso direto de clientes
ao Firestore e ao Storage é bloqueado pelas regras; as operações passam pela
API, que exige um usuário autenticado e cadastrado.

## Arquitetura

```text
Angular ──── ID token ────► Firebase Hosting ── /api/** ──► Express / Functions
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
