import "server-only";

type ServerEnv = {
  supabaseUrl: string;
  publishableKey: string;
  serviceRoleKey: string;
  ownerEmail: string;
};

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var ${name}`);
  return v;
}

// Fail loudly at first use: a misconfigured deployment must not silently run without auth config.
export function serverEnv(): ServerEnv {
  return {
    supabaseUrl: required("NEXT_PUBLIC_SUPABASE_URL"),
    publishableKey: required("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"),
    serviceRoleKey: process.env.SUPABASE_SECRET_KEY || required("SUPABASE_SERVICE_ROLE_KEY"),
    ownerEmail: required("OWNER_EMAIL").trim().toLowerCase(),
  };
}

