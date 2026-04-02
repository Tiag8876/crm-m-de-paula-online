import { fileURLToPath } from "node:url";
import app, { startApiServer } from "./app.mjs";

export { app, startApiServer };
export default app;

const isDirectRun = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isDirectRun) {
  startApiServer();
}
