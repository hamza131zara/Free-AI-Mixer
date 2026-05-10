import { createApp } from "./app";

const port = Number(process.env.PORT ?? "8787");
const app = createApp();

app.listen(port, () => {
  console.log(`Free AI Mixer export backend scaffold listening on :${port}`);
});
