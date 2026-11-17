# Oneboarding — Design System (Master)

**Estado: aplicado.** A direcção «Corporativo Contemporâneo de Alto Padrão» está nos tokens de `src/index.css`, na família de títulos de `src/app/layout.tsx` e nos primitivos de botão, cartão, campo e badge. A primária não foi reescrita.

Fonte de verdade da identidade **Corporativo Contemporâneo de Alto Padrão**. Referência de acabamento: Stripe, Linear e Vercel — autoridade, tecnologia e beleza visual, com respiro e hierarquia editorial. Se existir `design-system/pages/<página>.md`, esse ficheiro sobrepõe apenas os pontos que declarar.

## Onde vive o estilo hoje

Não existem `globals.css` nem `tailwind.config.ts`. O projecto usa Tailwind CSS v4.

| O que se procura | Ficheiro real |
| --- | --- |
| Tokens de cor, raio, sombra e tipo | `src/index.css` — bloco `@theme` e `:root` / `.dark` |
| Famílias carregadas | `src/app/layout.tsx` — `next/font/google` |

Medido no código, antes desta proposta:

| Token | Valor actual |
| --- | --- |
| `--primary` claro | `#1A5334` |
| `--primary-foreground` claro | `#FFFFFF` |
| `--primary` escuro | `#17B85F` |
| `--primary-foreground` escuro | `#06120B` |
| Canvas claro | `#F1F5F9` |
| Cartão | `#FFFFFF`, borda sólida `#E2E8F0`, raio máximo 8px |
| Sombra de cartão | uma ou duas camadas muito curtas |
| Títulos e corpo | Inter nos dois papéis |
| Dados | JetBrains Mono |
| Hover | cor e sombra em ~160ms, sem elevação |

Quando esta proposta for aprovada, a aplicação muda só em `src/index.css` (tokens) e em `src/app/layout.tsx` (família de títulos). Os componentes continuam a consumir nomes semânticos: `bg-primary`, `text-muted-foreground`, `border-border`, `shadow-card`, escalas `navy` e `gold`.

## Cor primária — regra inviolável

Estes quatro valores estão no código e **permanecem byte a byte**. Nenhuma implementação os reescreve, em hex ou em HSL.

| Token | Tema | Hex | Texto em cima | Rácio |
| --- | --- | --- | --- | --- |
| `--primary` | claro (`:root`) | `#1A5334` | `#FFFFFF` | 9.01:1 |
| `--primary-foreground` | claro | `#FFFFFF` | sobre `#1A5334` | 9.01:1 |
| `--primary` | escuro (`.dark`) | `#17B85F` | `#06120B` | 7.33:1 |
| `--primary-foreground` | escuro | `#06120B` | sobre `#17B85F` | 7.33:1 |

`#FFFFFF` sobre `#17B85F` mede 2.61:1. No tema escuro o texto do botão primário é `#06120B`.

A rampa de marca que contém estes verdes também fica congelada. `navy-700` é a primária clara e `gold-500` é a primária escura; alterar um degrau da rampa arriscava reescrever o verde.

| Escala | 50 | 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `navy` | `#ECF6EF` | `#D2EBDA` | `#A8D6B8` | `#76BE92` | `#4E7D63` | `#2C8551` | `#216A41` | `#1A5334` | `#133D27` | `#0C2A1B` |
| `gold` | `#EDFCF3` | `#D3F8E0` | `#A9EFC3` | `#71E19E` | `#3FCE7C` | `#17B85F` | `#109A4E` | `#0E7B40` | `#0C5E32` | `#0A4A28` |

`--accent` mantém `#17B85F` e `--accent-foreground` mantém `#06120B`. O anel de foco claro usa `#1A5334`. O anel de foco escuro usa `#17B85F`.

Pesquisas de paleta devolveram primárias `#1C1917` e `#6366F1`, e um acento dourado `#A16207`. Essas cores ficam de fora: substituíam o verde da Pumangol. A face da interface é Outfit, descrita abaixo.

## Direcção

Produto interno de onboarding, usado o dia inteiro. A interface lê-se como um produto de software contemporâneo: fundo frio e quieto, cartões brancos a flutuar com uma linha finíssima e sombra ambiente, verde só onde há acção ou estado activo.

Variância equilibrada, movimento curto (200ms), densidade folgada. Sem vidro líquido, sem paralaxe, sem serifa de moda e sem coreografia de scroll.

## Superfícies e profundidade

### Tema claro

O canvas deixa de ser o cinza `#F1F5F9` e passa a um off-white frio. O cartão branco separa-se desse fundo pela linha e pela sombra, em conjunto.

| Token | Valor | Uso |
| --- | --- | --- |
| `--background` | `#F6F8FB` | Canvas. Off-white frio, slate muito suave |
| `--foreground` | `#0F172A` | Texto principal. 16.78:1 sobre o canvas, 17.85:1 sobre branco |
| `--card` / `--popover` | `#FFFFFF` | Superfície de conteúdo |
| `--card-foreground` | `#0F172A` | |
| `--secondary` / `--muted` | `#F3F5F8` | Faixas, grupos, cabeçalho de tabela, fundo de input |
| `--muted-foreground` | `#526476` | Subtítulos e metadados. 5.73:1 sobre `#F6F8FB`; sobre branco o rácio é maior |
| `--border` | `rgb(15 23 42 / 0.08)` | Linha de cartão e divisória. Composta sobre branco aproxima-se de `#ECECEE` |
| `--input` | `#7D8EA5` | Contorno de campo em repouso. 3.34:1 sobre branco |
| `--ring` | `#1A5334` | Foco no tema claro |

A linha do cartão é `1px solid` com opacidade baixa. A linha do campo é mais presente, para o contorno do controlo ficar acima de 3:1. As duas funções não partilham o mesmo token.

### Sombra ambiente

Tinta slate `#0F172A`, em várias camadas difusas. Sem sombra verde e sem sombra única pesada.

| Token | Valor | Uso |
| --- | --- | --- |
| `--shadow-sm` | `0 1px 2px rgb(15 23 42 / 0.04)` | Repouso mínimo |
| `--shadow-card` | `0 1px 2px rgb(15 23 42 / 0.04), 0 4px 12px rgb(15 23 42 / 0.04), 0 16px 32px -8px rgb(15 23 42 / 0.06)` | Cartão, popover, painel |
| `--shadow-hover` | `0 2px 4px rgb(15 23 42 / 0.04), 0 8px 20px rgb(15 23 42 / 0.06), 0 24px 40px -8px rgb(15 23 42 / 0.08)` | Cartão ou linha clicável em hover |
| `--shadow-float` | `0 8px 24px rgb(15 23 42 / 0.08), 0 2px 6px rgb(15 23 42 / 0.04)` | Menu, dropdown |
| `--shadow-modal` | `0 24px 48px -12px rgb(15 23 42 / 0.18), 0 8px 16px rgb(15 23 42 / 0.06)` | Diálogo. Scrim `rgb(15 23 42 / 0.48)` |

### Tema escuro

A primária e o `--primary-foreground` não entram nesta tabela: ficam `#17B85F` e `#06120B`.

| Token | Valor |
| --- | --- |
| `--background` | `#0F172A` |
| `--foreground` | `#F8FAFC` |
| `--card` / `--popover` | `#1E293B` |
| `--card-foreground` | `#F8FAFC` |
| `--secondary` / `--muted` | `#1E293B` |
| `--muted-foreground` | `#CBD5E1` |
| `--border` | `rgb(248 250 252 / 0.08)` |
| `--input` | `#64748B` |
| `--ring` | `#17B85F` |

Texto principal `#F8FAFC` sobre `#1E293B` permanece na casa dos 14:1. Texto secundário `#CBD5E1` sobre `#1E293B` permanece na casa dos 10:1. A linha do cartão escuro é o mesmo princípio do claro: 1px com opacidade baixa, mais a sombra ambiente com tinta preta a meia força.

## Tipografia

Duas famílias. Carregar com `next/font/google` em `src/app/layout.tsx` (`subsets: ['latin']`, `display: 'swap'`). Sem `<link>` para o Google Fonts.

| Papel | Família | Variável | Pesos |
| --- | --- | --- | --- |
| Títulos, leitura e UI | **Outfit** | `--font-heading` e `--font-sans` | 400, 500, 600, 700 |
| Dados, badges numéricos, códigos, horas | **JetBrains Mono** | `--font-mono` | 400, 500 |

Outfit é a face de toda a interface: títulos, corpo, labels, botões e tabelas de texto. O tracking negativo fica nos títulos. JetBrains Mono fica em métricas, contagens, datas operacionais, NIFs, códigos de etapa e células `.num`.

### Escala

Base do documento: 16px. O contraste de peso é o da hierarquia: título em 700, secção em 600, corpo em 400.

| Token | Tamanho | Line-height | Peso | Família | Tracking | Uso |
| --- | --- | --- | --- | --- | --- | --- |
| `display` | 2rem / 32px | 1.15 | 700 | Outfit | -0.02em | Título de página |
| `h1` | 1.75rem / 28px | 1.2 | 700 | Outfit | -0.02em | Título de vista |
| `h2` | 1.25rem / 20px | 1.3 | 600 | Outfit | -0.02em | Secção |
| `h3` | 1.0625rem / 17px | 1.35 | 600 | Outfit | -0.015em | Título de cartão |
| `h4` | 0.9375rem / 15px | 1.4 | 600 | Outfit | 0 | Subsecção dentro de um cartão |
| `subtitle` | 0.9375rem / 15px | 1.5 | 400 | Outfit | 0 | Subtítulo, cor `#526476` |
| `body` | 0.9375rem / 15px | 1.6 | 400 | Outfit | 0 | UI, formulários, listas |
| `body-lg` | 1rem / 16px | 1.65 | 400 | Outfit | 0 | Texto longo e publicações |
| `small` | 0.8125rem / 13px | 1.45 | 400 | Outfit | 0 | Meta, hints |
| `caption` | 0.75rem / 12px | 1.4 | 500 | Outfit | 0.04em | Rótulo curto, cabeçalho de tabela |
| `data` | 0.8125rem / 13px | 1.45 | 500 | JetBrains Mono | 0 | Números e códigos |

Regras de composição:

- Tracking `-0.02em` aplica-se a `display`, `h1` e `h2`. Abaixo de 17px o tracking volta a 0 ou a um valor ligeiramente negativo (`-0.015em` no `h3`).
- Peso 700 reserva-se a títulos de página e a um número-chave. O corpo fica em 400.
- Cabeçalho de tabela: 12px, peso 600, `#526476`. Versaletes (`letter-spacing: 0.06em`) só em rótulos de uma ou duas palavras.
- Números em coluna: `font-variant-numeric: tabular-nums`, alinhados à direita, JetBrains Mono. Separador de milhares conforme o locale `pt-AO` do ecrã. Um resumo abreviado (`1,2 mil`) expõe o valor completo em `title`.
- Medida de texto corrido: 65–75 caracteres. Formulários e tabelas usam a largura do contentor.
- Placeholder de campo, sobre branco: `#64748B` (4.76:1). Sobre o canvas `#F6F8FB` esse cinza mede 4.47:1, abaixo de 4.5:1, por isso subtítulos e meta usam `#526476`.

## Uso da cor primária

O verde sólido aparece em poucos sítios. O resto da marca é um véu.

Sólido `#1A5334` (claro) ou `#17B85F` (escuro):

- Botão primário
- Item activo da navegação
- Indicador activo (ponto, sublinhado, passo corrente)
- Anel de foco
- Link de acção

Véus, sempre entre 5% e 10% de opacidade. No claro a tinta é `#1A5334`. No escuro a tinta é `#17B85F`.

| Token | Claro | Escuro | Uso |
| --- | --- | --- | --- |
| `--primary-tint-5` | `rgb(26 83 52 / 0.05)` | `rgb(23 184 95 / 0.06)` | Hover de linha, selecção suave |
| `--primary-tint-8` | `rgb(26 83 52 / 0.08)` | `rgb(23 184 95 / 0.10)` | Fundo de badge, item activo secundário, destaque |
| `--primary-tint-10` | `rgb(26 83 52 / 0.10)` | `rgb(23 184 95 / 0.12)` | Hover de badge e de chip; tecto do véu no escuro, onde 5% desaparece |

O texto de um badge no claro é `#1A5334` sobre o véu de 8%. Esse par mede 7.91:1 sobre o composto aproximado `#EDF1EF`. O badge traz ícone ou palavra; a cor não é o único sinal.

Hover do botão primário escurece dentro da rampa já congelada: claro `#133D27` (`navy-800`), premido `#0C2A1B` (`navy-900`); escuro `#109A4E` (`gold-600`), premido `#0E7B40` (`gold-700`). O hex da primária em repouso não muda.

## Raio

| Token | Valor | Uso |
| --- | --- | --- |
| `--radius-sm` | 6px | Badges, chips, menus compactos |
| `--radius-md` | 8px | Botões e inputs |
| `--radius-lg` | 12px | Cartões, diálogos, popovers, folhas |
| `--radius-xl` | 12px | Igual a `lg`. Contentores de página não sobem deste valor |
| `--radius-full` | 999px | Avatares e pontos de estado |

`--radius` base: 12px. A escala actual que força `rounded-xl` e `rounded-2xl` a 8px passa a 12px nos contentores. Botões e inputs ficam em 8px mesmo quando o utilitário de raio do contentor é maior.

## Acabamento e micro-interacções

Duração única de interacção: **200ms**. Easing `cubic-bezier(0.2, 0, 0, 1)`. A classe de referência é `transition-all duration-200`. As propriedades que devem mover-se são cor, fundo, borda, `box-shadow` e `transform`.

`prefers-reduced-motion: reduce` já existe em `src/index.css` e mantém-se: transições decorativas e o `translateY` colapsam; `scroll-behavior: auto`.

### Foco

- Indicador em `:focus-visible`. O clique do rato não desenha o anel; o teclado desenha.
- Tema claro: borda `#1A5334` e halo `0 0 0 3px rgb(26 83 52 / 0.16)`.
- Tema escuro: borda `#17B85F` e halo `0 0 0 3px rgb(23 184 95 / 0.28)`.
- O perímetro equivalente é de 2px. `#1A5334` sobre branco mede 9.01:1. `#17B85F` sobre `#1E293B` fica acima de 3:1.
- `outline: none` só no estado em que este anel está presente.
- `scroll-padding-top` cobre a barra fixa, para o foco não ficar por baixo dela.
- A ordem de tabulação segue a ordem visual. Diálogos prendem o foco e devolvem-no ao controlo que os abriu.

### Hover e premido

O hover confirma o que já é clicável. A acção em si dispara no clique ou no toque. `cursor: pointer` em tudo o que é clicável e não é um campo de texto.

| Elemento | Repouso | Hover | Premido |
| --- | --- | --- | --- |
| Botão primário claro | fundo `#1A5334`, texto `#FFFFFF` | fundo `#133D27`, `--shadow-hover`, `translateY(-1px)` | fundo `#0C2A1B`, `translateY(0)` |
| Botão primário escuro | fundo `#17B85F`, texto `#06120B` | fundo `#109A4E`, `--shadow-hover`, `translateY(-1px)` | fundo `#0E7B40`, `translateY(0)` |
| Botão secundário | fundo branco, borda `#7D8EA5`, texto `#0F172A` | fundo `#F3F5F8`, borda `#334155` | fundo `#E8ECF1` |
| Cartão clicável | borda `rgb(15 23 42 / 0.08)`, `--shadow-card` | borda `rgb(26 83 52 / 0.22)`, `--shadow-hover`, `translateY(-1px)` | borda `#1A5334` a 35% de opacidade, `translateY(0)` |
| Linha de tabela | transparente, ou zebra `#F3F5F8` | fundo `--primary-tint-5` | — |
| Link | `#1A5334`, sublinhado no hover com offset de 2px | a mesma cor | — |

A elevação é `transform`, por isso os vizinhos não saltam. No escuro, o brilho da borda do cartão usa `rgb(23 184 95 / 0.35)`.

Desactivado: opacidade 0.48, `cursor: not-allowed`, sem hover e sem elevação.

Entradas de página, paralaxe e listas com `back.out` ficam de fora. Numa grelha de dados esse overshoot lê-se como ruído. O movimento deste sistema é o da interacção directa.

## Respiro e hierarquia

Ritmo de 4px. Escala: 4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 80.

| Contexto | Valor |
| --- | --- |
| Gutter da página | 24px abaixo de 768px, 32px até 1024px, 40px daí para cima |
| Padding de cartão | 24px; 32px quando o cartão é um formulário ou um resumo de página |
| Espaço entre secções | 32px |
| Espaço entre título e subtítulo | 8px |
| Espaço entre label e campo | 8px |
| Espaço entre campos | 20px |
| Altura de controlo | 40px; 36px em barras densas e células de acção |
| Célula de tabela | 14px vertical, 16px horizontal |
| Largura máxima de formulário | 720px; texto rico 760px |

O título da página (700, 28–32px) fica separado do subtítulo (`#526476`, 400). O subtítulo explica; não compete com o título.

Área clicável mínima na web: 36×36px. O ícone pode medir 16px ou 20px; o hit area alarga com padding. Alvos de 44px aplicam-se a controlos feitos para toque (menu mobile, fechar um diálogo em ecrã estreito).

## Semânticos

Estado nunca depende só da cor: ícone mais texto, ou padrão de fundo mais texto. Sucesso continua em teal, para não se confundir com `#1A5334` / `#17B85F`.

| Papel | Fundo | Texto | Sólido | Rácio do texto sobre o fundo |
| --- | --- | --- | --- | --- |
| Sucesso | `#F0FDFA` | `#115E59` | `#0F766E` | 7.27:1 |
| Alerta | `#FFFBEB` | `#92400E` | `#B45309` | 6.84:1 |
| Erro | `#FEF2F2` | `#B91C1C` | `#B91C1C` | 5.91:1 sobre o fundo, 6.47:1 sobre branco |
| Informação | `#EFF6FF` | `#1E40AF` | `#1D4ED8` | 8.01:1 |

| Token | Claro | Escuro |
| --- | --- | --- |
| `--destructive` | `#B91C1C` | `#F0A8A8` |
| `--destructive-foreground` | `#FFFFFF` | `#2A0C0C` |
| Sucesso | `#F0FDFA` / `#0F766E` / `#115E59` | fundo `rgb(15 118 110 / 0.16)`, texto `#99F6E4` |
| Alerta | `#FFFBEB` / `#B45309` / `#92400E` | fundo `rgb(180 83 9 / 0.16)`, texto `#FCD34D` |
| Erro | `#FEF2F2` / `#B91C1C` / `#991B1B` | fundo `rgb(185 28 28 / 0.16)`, texto `#FECACA` |
| Informação | `#EFF6FF` / `#1D4ED8` / `#1E40AF` | fundo `rgb(29 78 216 / 0.16)`, texto `#BFDBFE` |

Botão destrutivo: fundo `#B91C1C`, texto `#FFFFFF` (6.47:1).

### Sidebar

| Token | Valor |
| --- | --- |
| `--sidebar` | `#0F172A` |
| `--sidebar-foreground` | `#CBD5E1` |
| `--sidebar-primary` | `#FFFFFF` |
| `--sidebar-primary-foreground` | `#0F172A` |
| `--sidebar-accent` | `rgb(255 255 255 / 0.06)` |
| `--sidebar-accent-foreground` | `#F8FAFC` |
| `--sidebar-border` | `rgb(255 255 255 / 0.08)` |
| Item activo | fundo `#1A5334`, texto `#FFFFFF` |

### Gráficos

Ordem fixa. A série também se distingue pela forma (traço, marcador).

1. `#1A5334` marca
2. `#0F766E` sucesso / série B
3. `#1D4ED8` informação
4. `#B45309` alerta
5. `#B91C1C` erro

## Tabelas e dados

- Contentor com `overflow-x: auto` abaixo de 768px.
- Cabeçalho sticky com fundo `#F3F5F8` (claro) ou `#0F172A` (escuro).
- Zebra: linhas pares `#F3F5F8`. Hover por cima da zebra, em `--primary-tint-5`.
- Colunas numéricas: classe `num`, à direita, JetBrains Mono, `tabular-nums`.
- Acção de linha com nome visível ou `aria-label`. Selecção múltipla usa checkbox e uma barra de acção.
- Estado vazio: uma frase e uma acção, dentro da área da tabela.

## Ícones

Uma família, traço 1.5px, tamanhos 16 / 20 / 24. Ícone decorativo ao lado de texto visível leva `aria-hidden="true"`. Botão só de ícone tem nome acessível. Emoji não serve de ícone de navegação, estado ou acção.

## O que fica de fora

- Gradientes roxos, rosa ou de “IA”, malhas, vidro fosco e brilho contínuo.
- Primária diferente de `#1A5334` / `#FFFFFF` no claro ou de `#17B85F` / `#06120B` no escuro.
- Verde sólido em fundos de página, cartões ou faixas largas.
- Véu de marca acima de 10% no claro.
- Raio acima de 12px em cartões de trabalho, ou abaixo de 6px em botões e inputs.
- Sombra colorida com o verde da marca, ou uma única sombra preta pesada.
- Hover sem feedback, e elevação que empurra o layout (margem em vez de `transform`).
- Texto de interface em peso 300.
- Cor como único portador de sucesso, alerta ou erro.
- Animação de scroll, paralaxe e stagger com overshoot nas listas de dados.

## O que muda depois da aprovação

Só depois de um sim explícito:

1. `src/app/layout.tsx` — Outfit em `--font-sans` e `--font-heading`. JetBrains Mono mantém-se nos dados.
2. `src/index.css` — canvas `#F6F8FB`, linha `rgb(15 23 42 / 0.08)`, sombras de três camadas, raios 6 / 8 / 12, véus `--primary-tint-*`, subtítulo `#526476`, duração 200ms e hover com `translateY(-1px)`.
3. As quatro linhas da primária, as rampas `navy` e `gold`, e os pares `--primary-foreground` não se editam.

Isto está aplicado. Os primitivos `button`, `card`, `input` e `badge` acompanham a duração, o raio e o véu, porque as classes deles ganham aos tokens globais.

## Checklist antes de aplicar a um ecrã

- Primária intacta: `#1A5334` / `#FFFFFF` no claro, `#17B85F` / `#06120B` no escuro.
- Texto principal e subtítulo a ≥ 4.5:1 no claro e no escuro, com os pares desta página.
- Borda de campo a ≥ 3:1 (`#7D8EA5` claro, `#64748B` escuro). Linha de cartão pode ser o véu de 8%.
- Foco de teclado visível e fora da barra fixa.
- Interface em Outfit; títulos com tracking `-0.02em`; números em JetBrains Mono com algarismos tabulares.
- Cartão a 12px com sombra ambiente; botão e input a 8px; badge a 6px.
- Hover em 200ms, com elevação por `transform` e brilho de borda no cartão clicável.
- `prefers-reduced-motion` respeitado.
- Larguras 375, 768, 1024 e 1440 sem a tabela partir o layout.
