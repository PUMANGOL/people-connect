# Diagramas Mermaid — Plataforma DPC Pumangol
## Fluxos Funcionais e Diagramas de Arquitectura
### Versão 1.0 · Abril 2025

> Fonte original: `ADT_Arquitectura_APIs_Modelos_Pumangol_v1.0.pdf` e `Diagramas_Mermaid_Pumangol_v1.0.md`

---

## FL-01 · Fluxo de Onboarding de Novo Colaborador

```mermaid
flowchart TD
    A([Início]) --> B[RH Admin cria\nprocesso de onboarding]
    B --> C[Preenche: nome, email,\ndepartamento, data início]
    C --> D[Selecciona template\nchecklist 90 dias]
    D --> E[[Sistema gera\nlink único UUID]]
    E --> F[[Sistema envia\nemail de boas-vindas]]
    F --> G{Colaborador acede\nao link em 48h?}

    G -- Não --> H[[Sistema reenvia link\n+ notifica RH Admin]]
    H --> G
    G -- Sim --> I[Colaborador cria\nperfil básico]
    I --> J[Estado: Em progresso\nDashboard mostra 0%]
    J --> K[Colaborador navega\npelas etapas]

    K --> L{Etapa concluída\ndentro do prazo?}
    L -- Não --> M[[Alerta automático\nao RH Admin]]
    M --> N[Estado: Em atraso]
    N --> O{RH Admin envia\nlembrete?}
    O -- Sim --> P[[Lembrete enviado\nao colaborador]]
    P --> K
    O -- Não --> K

    L -- Sim --> Q{Etapa requer\naprovação RH?}
    Q -- Sim --> R[Estado: Aguarda\naprovação]
    R --> S{RH Admin valida?}
    S -- Sim --> T[Etapa aprovada\nProgresso actualizado]
    S -- Não --> R
    Q -- Não --> T

    T --> U{100% etapas\nconcluídas?}
    U -- Não --> K
    U -- Sim --> V[Estado: Concluído\nDashboard 100%]
    V --> W[[Notificação de\nconclusão ao RH Admin]]
    W --> X[RH Admin revê\ne valida processo]
    X --> Y[Estado: Arquivado]
    Y --> Z([Fim])
```

---

## FL-02 · Fluxo de Submissão e Gestão de Documentos

```mermaid
flowchart TD
    A([Início]) --> B[Colaborador acede\nao módulo de documentos]
    B --> C[Selecciona tipo\nde documento]
    C --> D[Selecciona ficheiro\nno dispositivo]
    D --> E{Formato válido?\nPDF · JPG · PNG · DOCX}

    E -- Não --> F[Erro: Formato\nnão suportado]
    F --> D
    E -- Sim --> G{Tamanho\n10MB?}
    G -- Não --> H[Erro: Ficheiro\ndemasiado grande]
    H --> D

    G -- Sim --> I[[Sistema envia\npara Microsoft Graph API]]
    I --> J[[SharePoint armazena\nem /DPC/Onboarding/\nID/tipo/]]
    J --> K{Upload\nbem-sucedido?}

    K -- Não --> L[Erro registado\nUtilizador notificado]
    L --> D
    K -- Sim --> M[[Sistema regista\nmetadados na BD]]
    M --> N[Estado: Armazenado]
    N --> O[[Notificação ao\nRH Admin]]
    O --> P[Dashboard actualizado: Entregue]

    P --> Q{Todos os documentos\nobrigatórios entregues?}
    Q -- Não --> R[Etapa Documentos\npermanece incompleta]
    R --> S[[Lembrete automático\nao colaborador]]
    S --> B
    Q -- Sim --> T[Etapa Documentos\nmarcada como concluída]
    T --> U([Fim])
```

---

## FL-03 · Fluxo de Offboarding de Colaborador

```mermaid
flowchart TD
    A([Início]) --> B[RH Admin acede\nao módulo Offboarding]
    B --> C[Selecciona colaborador\ndefine data de saída e motivo]
    C --> D[[Sistema gera checklist\nde offboarding]]
    D --> E[Estado: Iniciado]
    E --> F[[Notificação ao colaborador:\nprocesso de saída iniciado]]

    F --> G[Colaborador visualiza\ntarefas de saída]
    G --> H[Executa tarefas:\npassagem de pasta\ndevolução equipamentos\nacessos]

    H --> I{Tarefa requer\nvalidação do RH Admin?}
    I -- Sim --> J[Estado tarefa:\nAguarda validação RH]
    J --> K{RH Admin valida?}
    K -- Não --> J
    K -- Sim --> L[Tarefa: Validada]

    I -- Não --> M[Tarefa: Concluída]
    M --> N{Todas as tarefas\nconcluídas?}
    L --> N

    N -- Não --> O{Faltam menos\nde 48h para saída?}
    O -- Sim --> P[[Alerta crítico\nao RH Admin]]
    P --> H
    O -- Não --> H

    N -- Sim --> Q[Estado: Pendente\nvalidação]
    Q --> R[RH Admin revê processo\ncompleto]
    R --> S{Processo\nválido?}
    S -- Não --> T[RH Admin solicita\ncorrecções]
    T --> H
    S -- Sim --> U[Estado: Concluído]
    U --> V[[Sistema arquiva processo]]
    V --> W[Estado: Arquivado]
    W --> X([Fim])
```

---

## FL-04 · Fluxo do Assistente IA — Arquitectura RAG

```mermaid
flowchart TD
    A([Utilizador acede\nao chatbot]) --> B{Modo de acesso?}

    B -- Interno\nNovo colaborador --> C[Acesso dentro\nda plataforma\ncom contexto]
    B -- Externo\nColaborador activo --> D[Acesso via\nlink público\nsem login]

    C --> E[Utilizador escreve\npergunta em Português]
    D --> E

    E --> F[[Motor IA:\nNormalização de texto\ndetecção de intenção]]
    F --> G[[Geração de embedding\nda pergunta]]
    G --> H[[Pesquisa semântica\nno Vector Store\ntop-k=5 chunks]]

    H --> I{Score de relevância\n≥ 0.75?}

    I -- Sim --> J[[Fragmentos relevantes\nrecuperados da\nbase de conhecimento]]
    J --> K[[Construção do prompt:\nSystem prompt +\nfragmentos + pergunta]]
    K --> L[[Chamada Azure OpenAI\nGPT-4o\nT=0.2 · max 800 tokens]]
    L --> M[Resposta gerada\nem Português]
    M --> N[Exibida ao utilizador\n+ referência ao\ndocumento fonte]

    I -- Não --> O[Fallback:\nNão encontrei informação.\nContacte a DPC:\ndpc@pumangol.ao]

    N --> P[[Log da interacção\nregistado no sistema]]
    O --> P

    P --> Q{Utilizador tem\nmais perguntas?}
    Q -- Sim --> E
    Q -- Não --> R([Fim da sessão])
```

---

## FL-05 · Motor de Notificações (Assíncrono)

```mermaid
flowchart TD
    A([Evento\ngerado no sistema]) --> B{Tipo de evento?}

    B -- Etapa em atraso --> C[Evento: etapa_atraso]
    B -- Documento submetido --> D[Evento: doc_submetido]
    B -- Onboarding concluído --> E[Evento: onboarding_concluido]
    B -- Offboarding iniciado --> F[Evento: offboarding_inicio]
    B -- Prazo crítico 48h --> G[Evento: alerta_critico]

    C --> H[[Notification Service\nenfileira mensagem\nno Redis]]
    D --> H
    E --> H
    F --> H
    G --> H

    H --> I[[Worker consome\na fila Redis]]
    I --> J[Selecciona template\nHTML adequado]
    J --> K[Personaliza conteúdo:\nnome, etapa, prazo, link]

    K --> L{Canal de\nenvio?}
    L -- Email --> M[[Microsoft Graph API\nMail.Send\nnoreply-dpc@pumangol.ao]]
    L -- In-app --> N[[Notificação gravada\nna BD]]
    L -- Ambos --> M
    L -- Ambos --> N

    M --> O{Email\nentregue?}
    O -- Sim --> P[Log: enviada_em]
    O -- Não --> Q{Tentativas\n< 3?}
    Q -- Sim --> R[[Retry com\nbackoff exponencial\n1s · 2s · 4s]]
    R --> M
    Q -- Não --> S[Log: falha registada]

    N --> P
    P --> T([Fim])
```

---

## ARQ-01 · Arquitectura de Alto Nível — Camadas do Sistema

```mermaid
graph TB
    subgraph L1["L1 — Clientes"]
        WA[Web App\nReact · MSAL · Tailwind]
        CW[Chatbot Widget\nLink público · sem login]
        MB[Mobile Browser\nResponsivo · PWA ready]
    end

    subgraph L2["L2 — API Gateway"]
        GW[Azure API Management\nJWT · Rate Limit · Routing · Audit Log]
    end

    subgraph L3["L3 — Backend Core"]
        AS[Auth Service\nSSO · MSAL]
        OS[Onboarding Service\nEstados · Checklist · Cron]
        DS[Document Service\nUpload · Graph API]
        OFS[Offboarding Service\nChecklist saída · Alertas]
        NS[Notification Service\nEmail · In-app · Redis queue]
    end

    subgraph L4["L4 — Serviço de IA"]
        AI[AI Chatbot Service\nLangChain · RAG · GPT-4o]
        KB[KB Indexer\nPyMuPDF · Chunking · Embeddings]
        VS[Vector Store\nFAISS]
    end

    subgraph L5["L5 — Camada de Dados"]
        PG[(PostgreSQL\nProcessos · Utilizadores\nMetadados · Logs)]
        RD[(Redis\nSessões · Dashboard\nFila notificações)]
        SP[(SharePoint\nFicheiros · Documentos)]
    end

    subgraph L6["L6 — Integrações Externas"]
        EID[Microsoft Entra ID\nOAuth 2.0 · SSO · JWT]
        GR[Microsoft Graph API\nEmail · SharePoint]
        AOI[Azure OpenAI\nGPT-4o · Embeddings]
        ACA[Academia Pumangol\nPortal · Link externo]
    end

    WA --> GW
    CW --> GW
    MB --> GW

    GW --> AS
    GW --> OS
    GW --> DS
    GW --> OFS
    GW --> NS
    GW --> AI

    OS --> NS
    DS --> NS
    OFS --> NS

    AS --> EID
    DS --> SP
    NS --> GR
    AI --> AOI
    AI --> VS
    KB --> VS

    OS --> PG
    DS --> PG
    OFS --> PG
    NS --> RD
    AS --> PG
```

---

## ARQ-02 · Modelo de Entidades

```mermaid
erDiagram
    UTILIZADOR {
        uuid id PK
        string nome
        string email
        enum perfil
        string departamento
        string estado
        timestamp criado_em
    }
    PROCESSO_ONBOARDING {
        uuid id PK
        uuid colaborador_id FK
        uuid criado_por_id FK
        string estado
        int progresso_pct
        uuid link_token
        date data_inicio
        date data_fim_prev
    }
    ETAPA {
        uuid id PK
        uuid processo_id FK
        int fase
        string nome
        enum tipo
        int prazo_dias
        string estado
        timestamp concluida_em
        timestamp ultimo_alerta_em
    }
    DOCUMENTO {
        uuid id PK
        uuid processo_id FK
        uuid colaborador_id FK
        string tipo
        string nome_ficheiro
        text url_sharepoint
        int tamanho_bytes
        string estado
    }
    PROCESSO_OFFBOARDING {
        uuid id PK
        uuid colaborador_id FK
        uuid criado_por_id FK
        date data_saida
        string motivo
        string estado
        timestamp arquivado_em
        uuid arquivado_por_id FK
    }
    TAREFA_OFFBOARDING {
        uuid id PK
        uuid processo_off_id FK
        string nome
        string categoria
        string responsavel
        bool requer_validacao_rh
        string estado
    }
    NOTIFICACAO {
        uuid id PK
        uuid destinatario_id FK
        string tipo
        enum canal
        string mensagem
        timestamp enviada_em
        timestamp lida_em
        string estado
        jsonb tentativas_log
    }
    LOG_CHATBOT {
        uuid id PK
        string sessao_id
        string pergunta
        string resposta
        string fonte_doc
        float score_relevancia
        enum modo
        timestamp criado_em
    }

    UTILIZADOR ||--o{ PROCESSO_ONBOARDING : "colaborador em"
    UTILIZADOR ||--o{ PROCESSO_ONBOARDING : "criou"
    PROCESSO_ONBOARDING ||--o{ ETAPA : "tem"
    PROCESSO_ONBOARDING ||--o{ DOCUMENTO : "inclui"
    UTILIZADOR ||--o{ DOCUMENTO : "submeteu"
    UTILIZADOR ||--o{ PROCESSO_OFFBOARDING : "sai por"
    UTILIZADOR ||--o{ PROCESSO_OFFBOARDING : "criou"
    PROCESSO_OFFBOARDING ||--o{ TAREFA_OFFBOARDING : "contém"
    UTILIZADOR ||--o{ NOTIFICACAO : "recebe"
```

---

## ARQ-03 · Fluxo de Autenticação SSO (Microsoft Entra ID)

```mermaid
sequenceDiagram
    actor U as Utilizador (RH Admin)
    participant APP as Web App (React + MSAL)
    participant EID as Microsoft Entra ID
    participant GW as API Gateway
    participant BE as Backend Service

    U->>APP: Acede à plataforma
    APP->>APP: Verifica token em cache (MSAL)

    alt Token válido em cache
        APP->>U: Dashboard carregado directamente
    else Sem token ou expirado
        APP->>EID: Redirect: Authorization Code + PKCE
        EID->>U: Ecrã de login Microsoft
        U->>EID: Credenciais corporativas
        EID->>APP: Authorization Code
        APP->>EID: POST /token com code_verifier
        EID-->>APP: access_token + refresh_token + id_token
        APP->>APP: Armazena tokens em memória (MSAL cache)
        APP->>U: Dashboard carregado
    end

    U->>APP: Acção (ex: criar onboarding)
    APP->>GW: Request + Authorization: Bearer access_token
    GW->>GW: Valida JWT (JWKS Entra ID)
    GW->>GW: Extrai claims: sub, email, role, department
    GW->>BE: Pedido + contexto de autorização
    BE->>BE: Verifica permissões RBAC
    BE-->>GW: Resposta
    GW-->>APP: Resposta
    APP-->>U: UI actualizada
```
