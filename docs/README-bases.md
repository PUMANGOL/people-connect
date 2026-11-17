# Bases de dados — identidade e Onboarding

Um servidor Postgres na infra da Pumangol. Duas bases. O mesmo `id` de utilizador liga as duas.

A identidade (email, password, sessão) fica numa base só, para os outros produtos a reutilizarem. Cada produto guarda o seu negócio e o perfil local numa base própria. Este documento descreve o Oneboarding depois dessa separação.

## Esquema

```mermaid
flowchart TB
  subgraph servidor ["Postgres na infra"]
    auth[("next_pumangol_auth<br/>identidade")]
    onb[("next_pumangol_onboarding<br/>este produto")]
    p2db[("base do produto 2")]
    p3db[("base do produto 3")]
  end

  browser["Browser do colaborador"]
  one["Oneboarding<br/>Next.js"]
  p2["Produto 2"]
  p3["Produto 3"]

  browser -->|"cookie de sessão"| one
  one -->|"AUTH_DATABASE_URL<br/>password e sessão"| auth
  one -->|"DATABASE_URL<br/>perfil e negócio"| onb

  p2 -->|"AUTH_DATABASE_URL"| auth
  p2 -->|"DATABASE_URL própria"| p2db
  p3 -->|"AUTH_DATABASE_URL"| auth
  p3 -->|"DATABASE_URL própria"| p3db
```

Os produtos 2 e 3 ainda não estão ligados. Quando entrarem, recebem a mesma `AUTH_DATABASE_URL` e uma `DATABASE_URL` só deles. Não partilham a base do Onboarding.

## O que vive em cada base

| Base | Variável | Conteúdo |
|---|---|---|
| `next_pumangol_auth` | `AUTH_DATABASE_URL` | `user`, `account`, `session`, `verification` |
| `next_pumangol_onboarding` | `DATABASE_URL` | `utilizadores`, convites, recrutamento, onboarding, mentoria e o resto do produto |

`user.id` na base de identidade é o mesmo valor que `utilizadores.id` na base do Onboarding. Não há foreign key entre bases: a aplicação faz a ligação.

| Pergunta | Onde se responde |
|---|---|
| O email e a password batem certo? | `next_pumangol_auth` (`account.password`) |
| A sessão ainda é válida? | `next_pumangol_auth` (`session`) |
| O colaborador está activo? | `next_pumangol_onboarding` (`utilizadores.estado`) |
| Qual é o papel e o departamento neste produto? | `next_pumangol_onboarding` (`utilizadores.perfil`, `utilizadores.departamento`) |

O papel não se decide na base de identidade. O mesmo colaborador pode ser administrador num produto e só leitor noutro.

## Como uma sessão se liga

```mermaid
sequenceDiagram
  participant C as Colaborador
  participant App as Oneboarding
  participant Auth as next_pumangol_auth
  participant Neg as next_pumangol_onboarding

  C->>App: email e password
  App->>Neg: procura utilizadores pelo email, estado activo
  App->>Auth: cria ou actualiza user e account com o mesmo id
  App->>Auth: valida a password e grava a session
  App->>Neg: lê perfil, departamento e estado por esse id
  App->>C: cookie httpOnly
```

Pedidos seguintes:

```mermaid
sequenceDiagram
  participant C as Colaborador
  participant App as Oneboarding
  participant Auth as next_pumangol_auth
  participant Neg as next_pumangol_onboarding

  C->>App: pedido com o cookie
  App->>Auth: confirma a session
  App->>Neg: lê utilizadores onde id = session.user.id
  App->>C: dados do produto, com o perfil local
```

Uma password nova grava a hash nas duas bases: em `utilizadores.password_hash` e em `account.password`. O login compara a password na base de identidade.

As tabelas de `next_pumangol_auth` são criadas no primeiro pedido a `/api/auth`, não no `npm run dev`. Se a base de identidade estiver vazia nesse momento, as contas já existentes em `next_pumangol_onboarding` (`user` e `account`) são copiadas para lá, com o mesmo id. As sessões antigas não são copiadas.

## Variáveis

```bash
DATABASE_URL=postgresql://utilizador:password@host:5432/next_pumangol_onboarding
AUTH_DATABASE_URL=postgresql://utilizador:password@host:5432/next_pumangol_auth
BETTER_AUTH_SECRET=<segredo desta aplicação>
BETTER_AUTH_URL=http://localhost:3000
```

`BETTER_AUTH_URL` é o endereço público desta aplicação. Quando os três sites partilharem sessão no domínio `pumangol.co.ao`, o segredo `BETTER_AUTH_SECRET` passa a ser o mesmo nos três e o cookie fica no domínio pai. Até lá, cada site tem a sua sessão e a mesma conta.
