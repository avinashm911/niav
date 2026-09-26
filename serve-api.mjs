// API server entry: serves POST /command + GET /health for the device run.
// Usage: NIAVERP_DB_URL=... node scripts/serve-api.mjs [port]
import { Pool } from "pg";
import { createApi } from "../packages/api/src/index.js";

const pool = new Pool({ connectionString: process.env.NIAVERP_DB_URL });
const port = Number(process.argv[2] ?? 3000);
createApi(pool).listen(port, "0.0.0.0", () => {
  console.log(`niaverp-api listening on ${port}`);
});
