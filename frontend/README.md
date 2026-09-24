# Kwiktots frontend

A notes UI built with TypeScript, React and Vite. It talks to the backend
in `../backend` over the API described in the root project's issue tracker.

## Install

```sh
npm ci
```

## Run

```sh
npm run dev
```

The app expects the API at `/api` by default. Set `VITE_API_URL` to point
somewhere else. `../README.md` (or #4) covers proxying `/api` to a running
backend.

## Test

```sh
npm test -- --run
```

## Lint and typecheck

```sh
npm run lint
npm run typecheck
```

## Build

```sh
npm run build
npm run preview
```
