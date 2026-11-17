# EPIC-00 · Design System & Redesign Visual

**Objectivo:** Criar um design system moderno, clean e de classe mundial que sirva de fundação visual para toda a plataforma. Substituir completamente o visual actual por uma identidade premium de plataforma de recrutamento e onboarding com IA.
**Prioridade:** MVP — pré-requisito de todas as páginas
**Sprint:** 1 (Jul-Ago 2026)

---

## S-000 · Design Tokens & Tema Base

**Esforço:** M (3 pt)
**Dependências:** —

### User Story
Como designer/dev, quero um conjunto de design tokens (cores, tipografia, espaçamento, sombras, raios de borda) configurados no Tailwind para que toda a plataforma tenha uma identidade visual consistente e premium.

### Critérios de Aceitação
- [ ] Paleta de cores Pumangol definida em `tailwind.config.ts`: navy primário (#1B2B4B), gold accent (#C8A951), tons neutros, semânticos (sucesso, erro, alerta, info)
- [ ] Escala tipográfica: Inter ou similar sans-serif, tamanhos de `xs` a `3xl`, pesos 400/500/600/700
- [ ] Escala de espaçamento consistente (4px base)
- [ ] Sombras: `shadow-sm`, `shadow-card`, `shadow-modal`, `shadow-float`
- [ ] Border-radius tokens: `rounded-sm` (4px), `rounded-md` (8px), `rounded-lg` (12px), `rounded-xl` (16px)
- [ ] Suporte a dark mode via `class` strategy no Tailwind
- [ ] Transições padrão: `transition-all duration-200 ease-out`
- [ ] CSS custom properties para overrides dinâmicos

### Notas Técnicas
```typescript
// tailwind.config.ts
colors: {
  pumangol: {
    navy: { 50: '#F0F2F7', ..., 900: '#0D1526' },
    gold: { 50: '#FBF8F0', ..., 600: '#C8A951', ..., 900: '#5A4A1E' },
  },
  surface: { DEFAULT: '#FFFFFF', secondary: '#F8F9FC', tertiary: '#F1F3F8' },
}
```

---

## S-001 · Componentes Base Redesenhados — Botões

**Esforço:** S (2 pt)
**Dependências:** S-000

### User Story
Como utilizador, quero botões com aspecto moderno e hierarquia visual clara para que as acções na plataforma sejam intuitivas e agradáveis.

### Critérios de Aceitação
- [ ] Variantes: `primary` (navy), `secondary` (outline), `ghost`, `destructive`, `accent` (gold)
- [ ] Tamanhos: `sm`, `md`, `lg`, `icon`
- [ ] Estados: hover com lift sutil (translateY -1px + shadow), active (scale 0.98), disabled (opacity + cursor), loading (spinner inline)
- [ ] Suporte a ícone esquerdo/direito via props `leftIcon` / `rightIcon`
- [ ] Focus ring acessível (outline-2 offset-2)
- [ ] Componente `ButtonGroup` para acções agrupadas

---

## S-002 · Componentes Base — Cards & Containers

**Esforço:** M (3 pt)
**Dependências:** S-000

### User Story
Como utilizador, quero cards com design limpo e elevação subtil para que a informação esteja organizada visualmente e seja fácil de ler.

### Critérios de Aceitação
- [ ] `Card` base: fundo branco, border subtil (#E5E7EB), rounded-xl, padding 24px, hover opcional com shadow lift
- [ ] `StatCard`: ícone colorido + título + valor grande + variação percentual + sparkline opcional
- [ ] `ListCard`: card com header + lista de itens com separadores
- [ ] `ActionCard`: card com call-to-action (ícone + título + descrição + botão)
- [ ] `EmptyState`: ilustração + texto + acção primária para estados vazios
- [ ] Todas as variantes responsivas (stack em mobile)

---

## S-003 · Componentes Base — Inputs & Forms

**Esforço:** M (3 pt)
**Dependências:** S-000

### User Story
Como utilizador, quero formulários elegantes e claros para preencher informação sem confusão.

### Critérios de Aceitação
- [ ] `Input` com label flutuante ou top-label, placeholder muted, focus ring gold
- [ ] `Textarea` com auto-resize e contador de caracteres
- [ ] `Select` customizado (dropdown com search para listas longas)
- [ ] `DatePicker` com estilo consistente
- [ ] `FileUpload` com drag-and-drop, preview de ficheiro, progress bar
- [ ] `FormField` wrapper com label, input, mensagem de erro, hint text
- [ ] Validação visual: borda vermelha + ícone erro + mensagem inline

---

## S-004 · Componentes Base — Tabelas & Listas

**Esforço:** M (3 pt)
**Dependências:** S-000

### User Story
Como utilizador DPC, quero tabelas de dados elegantes e funcionais para gerir vagas, candidatos e colaboradores eficientemente.

### Critérios de Aceitação
- [ ] `DataTable` com headers sticky, hover row, zebra striping opcional
- [ ] Sorting por coluna (ícone seta up/down)
- [ ] Paginação integrada com selector de items por página
- [ ] Filtros inline por coluna (dropdown ou search)
- [ ] Row actions (menu de 3 pontos com dropdown)
- [ ] Selecção múltipla com checkbox e bulk actions bar
- [ ] Estado vazio e estado loading (skeleton rows)
- [ ] Responsivo: em mobile converte para card list

---

## S-005 · Componentes Base — Badges, Tags & Status Indicators

**Esforço:** S (2 pt)
**Dependências:** S-000

### User Story
Como utilizador, quero indicadores visuais claros para estados (aberta, em triagem, fechada, etc.) para que o pipeline e o progresso sejam legíveis num relance.

### Critérios de Aceitação
- [ ] `Badge` com variantes de cor por estado: sucesso (verde), alerta (amarelo), erro (vermelho), info (azul), neutro (cinza), accent (gold)
- [ ] `StatusDot`: ponto colorido + label para estados inline
- [ ] `ProgressBar`: barra horizontal com percentagem, cor dinâmica por progresso
- [ ] `ProgressRing`: circular para dashboards compactos
- [ ] `Tag`: label removível para categorias/filtros
- [ ] `Avatar` com fallback para iniciais, borda de estado (online/offline)
- [ ] `AvatarGroup` com overflow counter (+3)

---

## S-006 · Layout Shell — Sidebar & TopNav Redesenhados

**Esforço:** L (5 pt)
**Dependências:** S-000, S-001, S-005

### User Story
Como utilizador DPC, quero um layout de aplicação moderno com sidebar navegável e top bar informativa para navegar eficientemente entre módulos.

### Critérios de Aceitação
- [ ] Sidebar colapsável: expandida (240px) → mini (64px, apenas ícones) → hidden (mobile)
- [ ] Secções de navegação agrupadas: Recrutamento, Onboarding, Assistente IA, Relatórios
- [ ] Ícones lucide-react para cada item, com tooltip no modo mini
- [ ] Indicador visual do módulo activo (barra lateral gold ou background highlight)
- [ ] Badge de contagem em items (ex: "3" vagas novas, "2" alertas)
- [ ] TopNav: breadcrumb + search global + notificações (bell icon com badge) + avatar do utilizador com dropdown
- [ ] Dropdown do utilizador: nome, email, role, opções (perfil, tema, sair)
- [ ] Animação suave de colapso/expansão (200ms ease-out)
- [ ] Footer do sidebar: logo Pumangol pequeno + "Plataforma DPC"
- [ ] Mobile: hamburger menu → drawer overlay

---

## S-007 · Páginas de Erro & Estados Especiais

**Esforço:** S (2 pt)
**Dependências:** S-000, S-001

### User Story
Como utilizador, quero páginas de erro e estados vazios com design profissional para que a plataforma transmita qualidade mesmo em cenários de excepção.

### Critérios de Aceitação
- [ ] Página 404: ilustração minimalista + "Página não encontrada" + botão voltar
- [ ] Página 403 / Unauthorized: ícone cadeado + mensagem + contacto suporte
- [ ] Página Link Inválido: ícone link quebrado + mensagem + contacto DPC
- [ ] Loading global: skeleton screens em vez de spinners (progressive loading)
- [ ] Toast notifications: 4 variantes (sucesso, erro, alerta, info), auto-dismiss 5s, stack vertical
- [ ] Confirmação modal: título + descrição + acções (cancelar / confirmar), backdrop blur

---

## S-008 · Animações & Micro-interacções

**Esforço:** S (2 pt)
**Dependências:** S-000 a S-006

### User Story
Como utilizador, quero transições suaves e micro-interacções subtis para que a plataforma se sinta polida e profissional.

### Critérios de Aceitação
- [ ] Page transitions: fade-in suave (150ms) ao navegar entre páginas
- [ ] List animations: stagger de entrada para listas de items (cada item 50ms após o anterior)
- [ ] Card hover: lift sutil (translateY -2px) + shadow aumenta
- [ ] Sidebar collapse: smooth width transition
- [ ] Modal: backdrop fade + modal scale-in from center
- [ ] Dropdown menus: slide-down + fade-in (100ms)
- [ ] Progress bars: animação de preenchimento suave
- [ ] Skeleton loading: pulse animation nos placeholders
- [ ] Utilizar `framer-motion` para animações complexas, CSS transitions para simples
