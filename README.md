# Free AI Mixer

A production-oriented AI scene generation system built with a strict logic-first architecture.

This is not a UI demo. It is an orchestration system for managing async AI generation pipelines.

## Core Architecture

```text
/src
  /store       -> Global state and lifecycle enforcement with Zustand
  /services    -> External HTTP API calls
  /agents      -> Validation, provider fallback, queue orchestration
  /components  -> UI only
```

## Scene Lifecycle

Every scene follows the same state machine:

```text
idle -> queued -> generating -> success | error
```

The store enforces valid transitions. The agent layer controls when queued work starts.

## Orchestration

- `generateAll()` queues every idle scene.
- A maximum of 2 generation jobs run concurrently.
- Remaining scenes stay in `queued`.
- Provider order is Replicate first, Gemini fallback second.
- Progress is real lifecycle progress only: `0%` until generation succeeds, then `100%`.

## API Configuration

```text
VITE_SCENE_API_BASE_URL=
VITE_SCENE_GENERATION_PATH=
```

The configured API must accept:

```ts
type SceneGenerationPayload = {
  prompt: string;
  style?: string;
  duration?: number;
};
```

And return:

```ts
type GeneratedScene = {
  image: string;
  variations: string[];
};
```

Provider selection is sent as the `X-Scene-Provider` request header with `replicate` or `gemini`.

## Commands

```bash
npm install
npm run dev
npm run build
```

## Verification

1. Create multiple scenes.
2. Trigger `generateAll()`.
3. Confirm only 2 scenes are `generating` at the same time.
4. Confirm failed Replicate calls retry through Gemini.
5. Confirm status changes come only from real async API responses.
