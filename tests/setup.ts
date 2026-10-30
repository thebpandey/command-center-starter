import { config } from "dotenv";

// Integration tests hit the real Supabase project configured in .env.local (never printed).
config({ path: ".env.local", quiet: true });
