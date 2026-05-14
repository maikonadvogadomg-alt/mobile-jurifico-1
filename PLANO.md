# PLANO DO PROJETO: HTML/CSS/JS

> Gerado automaticamente pelo SK Code Editor em 14/05/2026, 14:36:35
> **50 arquivo(s)** | **~9.182 linhas de codigo**

---

## RESUMO EXECUTIVO

- **Tipo de aplicacao:** Aplicacao Web Frontend (React)
- **Frontend / Stack principal:** React, TypeScript

**Para rodar o projeto:**
```bash
npm install
```

---

## ESTRUTURA DE ARQUIVOS

```
HTML/CSS/JS/
└── mobile/
    ├── .replit-artifact/
    │   └── artifact.toml
    ├── app/
    │   ├── (tabs)/
    │   │   ├── _layout.tsx
    │   │   ├── configuracoes.tsx
    │   │   ├── ferramentas.tsx
    │   │   ├── historico.tsx
    │   │   ├── index.tsx
    │   │   ├── jurisprudencia.tsx
    │   │   └── processos.tsx
    │   ├── _layout.tsx
    │   ├── +not-found.tsx
    │   ├── admin.tsx
    │   ├── codigo.tsx
    │   ├── comparador.tsx
    │   ├── comunicacoes.tsx
    │   ├── consulta-processual.tsx
    │   ├── corporativo.tsx
    │   ├── djen.tsx
    │   ├── editor.tsx
    │   ├── ementas.tsx
    │   ├── filtrador.tsx
    │   ├── historico.tsx
    │   ├── importador.tsx
    │   ├── painel.tsx
    │   ├── pdpj.tsx
    │   ├── pesquisa-web.tsx
    │   ├── playground.tsx
    │   ├── token-generator.tsx
    │   └── tramitacao.tsx
    ├── components/
    │   ├── DocumentCard.tsx
    │   ├── ErrorBoundary.tsx
    │   ├── ErrorFallback.tsx
    │   └── KeyboardAwareScrollViewCompat.tsx
    ├── constants/
    │   └── colors.ts
    ├── contexts/
    │   └── SettingsContext.tsx
    ├── hooks/
    │   └── useColors.ts
    ├── lib/
    │   ├── ai-service.ts
    │   ├── drive-service.ts
    │   ├── legal-formatter.ts
    │   ├── neon-client.ts
    │   └── sqlite-service.ts
    ├── scripts/
    │   ├── build.js
    │   └── start-dev.js
    ├── .gitignore
    ├── app.json
    ├── babel.config.js
    ├── eas.json
    ├── expo-env.d.ts
    ├── metro.config.js
    ├── package.json
    └── tsconfig.json
```

---

## STACK TECNOLOGICO DETECTADO

- **Frontend:** React, TypeScript

---

## VARIAVEIS DE AMBIENTE NECESSARIAS

Crie um arquivo `.env` na raiz com estas variaveis:

```env
BASE_PATH=seu_valor_aqui
REPLIT_INTERNAL_APP_DOMAIN=seu_valor_aqui
REPLIT_DEV_DOMAIN=seu_valor_aqui
EXPO_PUBLIC_DOMAIN=seu_valor_aqui
REPL_ID=seu_valor_aqui
EXPO_PUBLIC_REPL_ID=seu_valor_aqui
PORT=seu_valor_aqui
REPLIT_EXPO_DEV_DOMAIN=seu_valor_aqui
```

---

## ARQUIVOS PRINCIPAIS

- `mobile/app/(tabs)/index.tsx` — Arquivo principal

---

## GUIA COMPLETO — O QUE CADA PARTE DO PROJETO FAZ

> Esta secao explica, em linguagem simples, o que e para que serve cada pasta e cada arquivo.

### 📁 `mobile/`
> Pasta 'mobile' — agrupamento de arquivos relacionados.

**`.gitignore`** _(42 linhas)_
Lista de arquivos/pastas que o Git deve IGNORAR (nao versionar). Ex: node_modules, .env

**`app.json`** _(67 linhas)_
Arquivo de dados ou configuracao no formato JSON (chave: valor).

**`babel.config.js`** _(7 linhas)_
Arquivo de CONSTANTES/CONFIGURACAO — valores fixos usados em varios lugares do projeto.

**`eas.json`** _(37 linhas)_
Arquivo de dados ou configuracao no formato JSON (chave: valor).

**`expo-env.d.ts`** _(3 linhas)_
Arquivo TypeScript/JavaScript — logica, funcoes ou modulo do projeto.

**`metro.config.js`** _(10 linhas)_
Arquivo de CONSTANTES/CONFIGURACAO — valores fixos usados em varios lugares do projeto.

**`package.json`** _(70 linhas)_
Registro de dependencias e scripts do projeto. Aqui ficam os comandos (npm run dev, npm start) e os pacotes instalados.

**`tsconfig.json`** _(24 linhas)_
Configuracao do TypeScript. Diz para o computador como interpretar o codigo .ts e .tsx.

---

### 📁 `mobile/.replit-artifact/`
> Pasta '.replit-artifact' — agrupamento de arquivos relacionados.

**`artifact.toml`** _(27 linhas)_
Arquivo TOML — parte do projeto.

---

### 📁 `mobile/app/`
> Pasta 'app' — agrupamento de arquivos relacionados.

**`+not-found.tsx`** _(46 linhas)_
Componente React — parte visual reutilizavel da interface do usuario.

**`_layout.tsx`** _(159 linhas)_
Componente de LAYOUT — define a estrutura visual da pagina (cabecalho, sidebar, rodape). Envolve outros componentes.

**`admin.tsx`** _(285 linhas)_
Componente React — parte visual reutilizavel da interface do usuario.

**`codigo.tsx`** _(185 linhas)_
Componente React — parte visual reutilizavel da interface do usuario.

**`comparador.tsx`** _(229 linhas)_
Componente React — parte visual reutilizavel da interface do usuario.

**`comunicacoes.tsx`** _(254 linhas)_
Componente React — parte visual reutilizavel da interface do usuario.

**`consulta-processual.tsx`** _(230 linhas)_
Componente React — parte visual reutilizavel da interface do usuario.

**`corporativo.tsx`** _(188 linhas)_
Componente React — parte visual reutilizavel da interface do usuario.

**`djen.tsx`** _(235 linhas)_
Componente React — parte visual reutilizavel da interface do usuario.

**`editor.tsx`** _(941 linhas)_
Componente EDITOR — area de edicao de texto, codigo ou conteudo rico.

**`ementas.tsx`** _(252 linhas)_
Componente React — parte visual reutilizavel da interface do usuario.

**`filtrador.tsx`** _(228 linhas)_
Componente React — parte visual reutilizavel da interface do usuario.

**`historico.tsx`** _(149 linhas)_
Componente React — parte visual reutilizavel da interface do usuario.

**`importador.tsx`** _(382 linhas)_
Componente React — parte visual reutilizavel da interface do usuario.

**`painel.tsx`** _(239 linhas)_
Componente React — parte visual reutilizavel da interface do usuario.

**`pdpj.tsx`** _(176 linhas)_
Componente React — parte visual reutilizavel da interface do usuario.

**`pesquisa-web.tsx`** _(248 linhas)_
Componente React — parte visual reutilizavel da interface do usuario.

**`playground.tsx`** _(209 linhas)_
Componente React — parte visual reutilizavel da interface do usuario.

**`token-generator.tsx`** _(285 linhas)_
Componente React — parte visual reutilizavel da interface do usuario.

**`tramitacao.tsx`** _(291 linhas)_
Componente React — parte visual reutilizavel da interface do usuario.

---

### 📁 `mobile/components/`
> Pecas visuais reutilizaveis da interface (botoes, cards, formularios...).

**`DocumentCard.tsx`** _(163 linhas)_
Componente CARD (cartao) — exibe uma informacao em um bloco visual com borda e sombra. Muito usado para listas de items.

**`ErrorBoundary.tsx`** _(55 linhas)_
Componente de ERRO — exibido quando algo da errado, com mensagem explicativa.

**`ErrorFallback.tsx`** _(279 linhas)_
Componente de ERRO — exibido quando algo da errado, com mensagem explicativa.

**`KeyboardAwareScrollViewCompat.tsx`** _(30 linhas)_
Componente de PAGINA/TELA — representa uma tela completa navegavel no app.

---

### 📁 `mobile/constants/`
> Pasta 'constants' — agrupamento de arquivos relacionados.

**`colors.ts`** _(76 linhas)_
Arquivo TypeScript/JavaScript — logica, funcoes ou modulo do projeto.

---

### 📁 `mobile/contexts/`
> Pasta 'contexts' — agrupamento de arquivos relacionados.

**`SettingsContext.tsx`** _(329 linhas)_
CONTEXT do React — mecanismo para compartilhar dados entre componentes sem passar por props.

---

### 📁 `mobile/hooks/`
> Hooks React customizados — logica reutilizavel de estado e efeitos.

**`useColors.ts`** _(16 linhas)_
HOOK React personalizado para gerenciar estado/comportamento de 'colors'.

---

### 📁 `mobile/lib/`
> Funcoes auxiliares reutilizaveis em varios lugares do projeto.

**`ai-service.ts`** _(113 linhas)_
Arquivo de SERVICO/API — funcoes para comunicar com o servidor ou API externa.

**`drive-service.ts`** _(82 linhas)_
Arquivo de SERVICO/API — funcoes para comunicar com o servidor ou API externa.

**`legal-formatter.ts`** _(114 linhas)_
Arquivo TypeScript/JavaScript — logica, funcoes ou modulo do projeto.

**`neon-client.ts`** _(203 linhas)_
Arquivo de SERVICO/API — funcoes para comunicar com o servidor ou API externa.

**`sqlite-service.ts`** _(112 linhas)_
Arquivo de SERVICO/API — funcoes para comunicar com o servidor ou API externa.

---

### 📁 `mobile/scripts/`
> Pasta 'scripts' — agrupamento de arquivos relacionados.

**`build.js`** _(574 linhas)_
Arquivo TypeScript/JavaScript — logica, funcoes ou modulo do projeto.

**`start-dev.js`** _(55 linhas)_
Arquivo TypeScript/JavaScript — logica, funcoes ou modulo do projeto.

---

### 📁 `mobile/app/(tabs)/`
> Pasta '(tabs)' — agrupamento de arquivos relacionados.

**`_layout.tsx`** _(80 linhas)_
Componente de LAYOUT — define a estrutura visual da pagina (cabecalho, sidebar, rodape). Envolve outros componentes.

**`configuracoes.tsx`** _(522 linhas)_
Componente de CONFIGURACOES — tela onde o usuario ajusta preferencias do app.

**`ferramentas.tsx`** _(85 linhas)_
Componente React — parte visual reutilizavel da interface do usuario.

**`historico.tsx`** _(242 linhas)_
Componente React — parte visual reutilizavel da interface do usuario.

**`index.tsx`** _(212 linhas)_
Ponto de entrada do React — monta o componente App na pagina HTML.

**`jurisprudencia.tsx`** _(251 linhas)_
Componente React — parte visual reutilizavel da interface do usuario.

**`processos.tsx`** _(91 linhas)_
Componente React — parte visual reutilizavel da interface do usuario.

---

## CONTEXTO PARA IA (copie e cole para continuar o projeto)

> Use este bloco para explicar o projeto para qualquer IA ou desenvolvedor:

```
Projeto: HTML/CSS/JS
Tipo: Aplicacao Web Frontend (React)
Stack: React, TypeScript
Arquivos: 50 | Linhas: ~9.182
Variaveis de ambiente necessarias: BASE_PATH, REPLIT_INTERNAL_APP_DOMAIN, REPLIT_DEV_DOMAIN, EXPO_PUBLIC_DOMAIN, REPL_ID, EXPO_PUBLIC_REPL_ID, PORT, REPLIT_EXPO_DEV_DOMAIN

Estrutura principal:
  mobile/.gitignore
  mobile/.replit-artifact/artifact.toml
  mobile/app.json
  mobile/app/(tabs)/_layout.tsx
  mobile/app/(tabs)/configuracoes.tsx
  mobile/app/(tabs)/ferramentas.tsx
  mobile/app/(tabs)/historico.tsx
  mobile/app/(tabs)/index.tsx
  mobile/app/(tabs)/jurisprudencia.tsx
  mobile/app/(tabs)/processos.tsx
  mobile/app/+not-found.tsx
  mobile/app/_layout.tsx
  mobile/app/admin.tsx
  mobile/app/codigo.tsx
  mobile/app/comparador.tsx
  mobile/app/comunicacoes.tsx
  mobile/app/consulta-processual.tsx
  mobile/app/corporativo.tsx
  mobile/app/djen.tsx
  mobile/app/editor.tsx
  mobile/app/ementas.tsx
  mobile/app/filtrador.tsx
  mobile/app/historico.tsx
  mobile/app/importador.tsx
  mobile/app/painel.tsx
  mobile/app/pdpj.tsx
  mobile/app/pesquisa-web.tsx
  mobile/app/playground.tsx
  mobile/app/token-generator.tsx
  mobile/app/tramitacao.tsx
  mobile/babel.config.js
  mobile/components/DocumentCard.tsx
  mobile/components/ErrorBoundary.tsx
  mobile/components/ErrorFallback.tsx
  mobile/components/KeyboardAwareScrollViewCompat.tsx
  mobile/constants/colors.ts
  mobile/contexts/SettingsContext.tsx
  mobile/eas.json
  mobile/expo-env.d.ts
  mobile/hooks/useColors.ts
  mobile/lib/ai-service.ts
  mobile/lib/drive-service.ts
  mobile/lib/legal-formatter.ts
  mobile/lib/neon-client.ts
  mobile/lib/sqlite-service.ts
  mobile/metro.config.js
  mobile/package.json
  mobile/scripts/build.js
  mobile/scripts/start-dev.js
  mobile/tsconfig.json
```

---

*Plano gerado pelo SK Code Editor — 14/05/2026, 14:36:35*