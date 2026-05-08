/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SCENE_API_BASE_URL?: string;
  readonly VITE_SCENE_GENERATION_PATH?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
