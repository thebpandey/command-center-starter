# Personal Command Center

A private dashboard that your AI assistant writes to. Your assistant adds tasks, notes, reminders, calendar items, and messages. You open the dashboard on your phone or computer and see everything in one place.

Only you can log in. Your AI tools connect with a secret token that you create and can cancel at any time.

> Screenshot: _add a screenshot of the Today page here_

**Pages:** Today, Tasks, Calendar, Documents (your Library), Messages, Activity, Triage rules, and Settings.

**Built with:** Next.js (the website), Supabase (the database and login), and MCP (the "plug" that lets AI tools read and write your data).

## What you need

All three accounts are free.

1. A [GitHub](https://github.com/signup) account
2. A [Supabase](https://supabase.com/dashboard) account
3. A [Vercel](https://vercel.com/signup) account (sign up with your GitHub account, it is easiest)

Plan for about 15 minutes.

## Words you will see

- **Environment variable:** a setting the app reads when it starts, like a password stored outside the code.
- **Token:** a long secret string that lets an AI tool use your dashboard. Treat it like a password.
- **MCP server:** the address an AI tool connects to so it can use your dashboard.

## Deploy

### Step 1: Set up Supabase

1. Go to the [Supabase dashboard](https://supabase.com/dashboard) and click **New project**.
2. Pick a name (for example `command-center`), set a database password (save it somewhere safe), pick the region closest to you, and click **Create new project**. Wait a minute or two until it finishes.
3. In the left menu, click **SQL Editor**.
4. Open the file [`supabase/setup.sql`](supabase/setup.sql) in this repository, click the copy button, and paste everything into the SQL Editor.
5. Click **Run**. You should see "Success. No rows returned."
6. Collect three values and keep them in a note for Step 2:
   - **Project URL:** click **Connect** at the top of your project page. It looks like `https://abcdefgh.supabase.co`.
   - **Publishable key:** go to **Project Settings > API Keys**. Copy the key that starts with `sb_publishable_`.
   - **Secret key:** on the same page, copy (or create) the key that starts with `sb_secret_`. This one is private. Never share it or paste it into a chat.

You will come back to Supabase in Step 3.

### Step 2: Deploy to Vercel

1. Click this button:

   [![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fthebpandey%2Fcommand-center-starter&env=NEXT_PUBLIC_SUPABASE_URL,NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,SUPABASE_SECRET_KEY,OWNER_EMAIL&envDescription=Your%20Supabase%20project%20URL%2C%20publishable%20key%2C%20secret%20key%2C%20and%20the%20one%20email%20address%20allowed%20to%20log%20in.&envLink=https%3A%2F%2Fgithub.com%2Fthebpandey%2Fcommand-center-starter%23step-1-set-up-supabase&project-name=command-center)

2. Vercel asks to create a copy of this code in your GitHub account. Keep the name and choose **Private** if asked.
3. Fill in the four settings:

   | Name | What to paste |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | Your Project URL from Step 1 |
   | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Your `sb_publishable_...` key |
   | `SUPABASE_SECRET_KEY` | Your `sb_secret_...` key |
   | `OWNER_EMAIL` | The email address you will log in with. Only this address can log in. |

4. Click **Deploy** and wait about two minutes.
5. When it finishes, copy your app address. It looks like `https://command-center-abc123.vercel.app`. In this guide we call it `https://<your-app>.vercel.app`.

**Optional:** the app shows dates in US Central time by default. To change it, in Vercel go to **Project > Settings > Environment Variables**, add `OWNER_TIMEZONE` with a value like `America/New_York` or `Europe/London`, then redeploy.

### Step 3: Tell Supabase your app address

The login email contains a link. Supabase only sends people to addresses you approve.

1. In Supabase, go to **Authentication > URL Configuration**.
2. Set **Site URL** to `https://<your-app>.vercel.app`
3. Under **Redirect URLs**, click **Add URL** and add `https://<your-app>.vercel.app/auth/callback`
4. Click **Save**.

### Step 4: Log in

1. Open `https://<your-app>.vercel.app`.
2. Type your `OWNER_EMAIL` address and click **Email me a sign-in link**.
3. Open the email from Supabase and click the link. You are now logged in.

Any other email address gets the same "check your email" message, but no email is ever sent to it.

### Step 5: Create a token

1. In the dashboard, open **Settings**.
2. Type a name (for example `Main assistant`) and pick a scope:
   - **Full:** can read and write. Use this for your main assistant.
   - **Read-only:** can only read. Use this for helper bots that only need to look things up.
3. Click **Create token** and copy it right away. It starts with `acc_` and is shown only once.

### Step 6: Connect an AI tool

Your MCP server lives at `https://<your-app>.vercel.app/api/mcp`.

**Grok Bot (or any tool that only accepts a URL):** paste this into the Bot's chat, with your app address and token filled in:

```
Connect this MCP server as "Assistant Dashboard": https://<your-app>.vercel.app/api/mcp/t/<token>
```

The token is inside this URL, so the URL itself is a password. Do not post it anywhere. If it leaks, revoke the token in **Settings** and create a new one.

**Claude Code (sends the token in a header, which is safer):** run this in a terminal:

```bash
claude mcp add --transport http assistant-dashboard https://<your-app>.vercel.app/api/mcp --header "Authorization: Bearer <token>"
```

**Other tools:** use the URL `https://<your-app>.vercel.app/api/mcp` and the header `Authorization: Bearer <token>`. If the tool has no place for a header, use the `/api/mcp/t/<token>` address from the Grok example.

To test it, ask your assistant: "Add a task called Test my dashboard." Then check the **Tasks** page.

## Troubleshooting

| Problem | Fix |
|---|---|
| The deploy failed with "Missing required env var" | One of the four settings is empty or misspelled. In Vercel, open **Project > Settings > Environment Variables**, fix it, then go to **Deployments** and click **Redeploy**. |
| No login email arrives, or "Could not send the link" | Check spam. Make sure you typed exactly the `OWNER_EMAIL` address. Supabase's free email service only sends a few emails per hour, so wait a few minutes before trying again. |
| The email link opens `localhost` or an error page | Redo Step 3. The Site URL and Redirect URL must match your Vercel address exactly, with `https://` and no extra slash. |
| "That sign-in link is invalid or expired" | Links expire after one hour and work only once. Request a new one. Open it in the same browser where you asked for it. |
| The SQL Editor shows "already exists" errors | `setup.sql` was already run on this project. It is meant to run once on a new project. If the first run worked, you can ignore this. |
| Pages show a database or permission error | Make sure you ran all of `setup.sql`, not just part of it. |
| The AI tool says "unauthorized" or 401 | The token is wrong, revoked, or cut off when copying. Create a new token and try again. |
| The AI tool can read but cannot add anything | You used a **Read-only** token. Create a **Full** token. |
| I changed my email | Update `OWNER_EMAIL` in Vercel and redeploy. |

## Security notes

- **Row Level Security (RLS)** is on for every table. Even though the publishable key is visible in the browser, the database only returns rows that belong to the logged-in owner. Visitors who are not logged in see nothing.
- **The secret key** (`SUPABASE_SECRET_KEY`) is used only on the server. Never put it in code, a chat, or a screenshot.
- **Tokens** are stored only as a scrambled fingerprint (a hash), so even the database does not hold the real token. Revoke any token you no longer use in **Settings**.
- **Never commit `.env` files.** This repository's `.gitignore` already blocks them. Use `.env.example` as the template.
- This is a personal, single-user app. It is not built for sharing with a team.

## Run it on your computer (optional)

You need Node.js 20 or newer and pnpm.

```bash
cp .env.example .env.local   # then fill in your real values
pnpm install
pnpm dev
```

Open http://localhost:3000. Add `http://localhost:3000/auth/callback` to Supabase **Redirect URLs** so the login link works locally.

Checks: `pnpm lint`, `pnpm typecheck`, `pnpm test:unit`. The full `pnpm test` also runs database tests against the Supabase project in `.env.local`. They create and delete test rows, so only run them against a test project.

## License

MIT. See [LICENSE](LICENSE).
