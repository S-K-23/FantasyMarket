import "dotenv/config";
import { defineConfig } from '@prisma/client';

export default defineConfig({
    datasource: {
        provider: "postgresql",
        url: process.env.DATABASE_URL,
        directUrl: process.env.DIRECT_URL,
    }
});
