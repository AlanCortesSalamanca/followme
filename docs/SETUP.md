# Follow Me Setup

## Requisitos

- Node.js 20 o superior.
- npm.
- Expo CLI.
- Supabase CLI.
- Cuenta Supabase.

## Instalacion

```bash
npm install
```

## Variables De Entorno

Copiar `.env.example` a `.env` y completar:

```bash
EXPO_PUBLIC_SUPABASE_URL=
EXPO_PUBLIC_SUPABASE_ANON_KEY=
EXPO_PUBLIC_MAP_STYLE_URL=
```

## Ejecutar App

```bash
npm run start
```

## Supabase Local

```bash
supabase start
supabase db reset
```

## Validaciones

```bash
npm run typecheck
npm run lint
```
