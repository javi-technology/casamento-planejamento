# Gastos do Casamento

Aplicação full-stack para planejar o orçamento do casamento, acompanhar
fornecedores e armazenar contratos em PDF. A interface é Angular 19 com
Tailwind CSS; a API é Express executada no Firebase Functions; os dados ficam
no Firestore e os contratos no Cloud Storage.

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

- Auth: `9099`
- Functions: `5001`
- Firestore: `8080`
- Storage: `9199`
- Emulator UI: porta padrão do Firebase

O ambiente local usa o projeto `javitech-8797d` com credenciais Firebase de
desenvolvimento e conecta o Auth Emulator automaticamente.

## Produção

Em produção, a configuração Firebase é carregada de
`/__/firebase/init.json`, endereço reservado pelo Firebase Hosting. A variável
`ALLOWED_EMAILS` deve ser configurada como variável do ambiente de deploy.

## Arquitetura

```text
Angular + Firebase Auth
        │ Bearer ID token
        ▼
Firebase Hosting ── /api/** ──► Express / Cloud Functions
                                      ├── Firestore
                                      └── Cloud Storage (contratos PDF)
```

O acesso de clientes ao Firestore e ao Storage é bloqueado pelas regras; as
operações passam pela API autenticada e pela allowlist de e-mails.

## Comandos úteis

```bash
npm run build
npm test
npm run build:functions
npm run test:functions
```
