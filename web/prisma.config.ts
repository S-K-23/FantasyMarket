import "dotenv/config";
import { defineConfig, env } from "prisma/config";

const mainUrl = env("DIRECT_URL");

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    // Main database (Supabase, direct port 5432)
    url: mainUrl,
    // Shadow database: same DB, but a different schema name
    shadowDatabaseUrl: `${mainUrl}?schema=shadow`,
  },
});