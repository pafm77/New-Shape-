# New Shape · Versão Web (Vercel + Firebase)

Aplicação Web completa em **React + Vite + TypeScript + Tailwind + Firebase**, ligada em tempo real ao mesmo projeto Firebase (`gen-lang-client-0155852066`) e base de dados Firestore (`ai-studio-android-newshape-d075cea5-72ee-42bf-9cf2-fa777e0d0a4c`) da app Android **New Shape**.

## Funcionalidades incluídas
- **Painel PT (`/painel`) + Portal do Aluno (`/aluno` e `/s/:semana`)**
  - Entrada do aluno apenas com **telemóvel** (9 dígitos PT) ou registo rápido com **1º nome, sobrenome e telemóvel**.
  - Alternância rápida **Vista PT ↔ Vista Aluno** e botão **Não és tu?**.
- **Agendamentos Semanais + WhatsApp**
  - Fila *Por confirmar* (FIFO, estados *Novo / Alterado / Cancelou*, *Recusar*, *Mover para...*, preview da mensagem, *Confirmar e abrir WhatsApp*, *Desfazer* 10s, bloqueio *WhatsApp aberto — Já voltei*).
  - *Semanas* (navegação `← →`, criar sessões multi-dia, publicar/despublicar, duplicar semana anterior, exportar CSV, convite semanal WhatsApp, gestão de inscritos por sessão).
  - *Respostas* (lembretes WhatsApp para quem ainda não respondeu e lista de indisponíveis).
  - *Mensagens & Definições* (6 modelos editáveis com variáveis `{nome}`, `{treinos}`, `{link}`, `{semana}` e configurações do estúdio).
- **Alunos, Planos de Treino & Exercícios (47 seeded)**
- **Nutrição & Macros (74 alimentos seeded + importação direta do Excel/CSV)**
- **Avaliação Física (IMC e TMB Mifflin-St Jeor automáticos + gráfico SVG de evolução)**
- **Finanças, Fidelizações (6/12 meses) e Chat Privado em tempo real**

---

## Como correr localmente

```bash
cd web
npm install
npm run dev
```

## Como publicar na Vercel

1. Envia este repositório para o **GitHub**.
2. Acede a [vercel.com](https://vercel.com) → **Add New… → Project** e importa o repositório.
3. Em **Root Directory**, define **`web`** (o `vercel.json` dentro de `web/` já inclui o rewrite SPA para `/s/:weekKey`, `/painel`, `/aluno`).
4. Faz **Deploy**.
5. **Passo obrigatório no Firebase:**
   - Vai à [Consola Firebase](https://console.firebase.google.com) → Projeto `gen-lang-client-0155852066` → **Authentication → Settings → Authorized domains**
   - Clica em **Add domain** e adiciona o domínio gerado pela Vercel (ex.: `new-shape.vercel.app`).
   - Sem este passo, o login com Google na Vercel será bloqueado pelo Firebase Auth.
