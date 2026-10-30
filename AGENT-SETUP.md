# AGENT-SETUP.md: set up the Personal Command Center with an AI coding agent

This file is written for an AI coding agent (Claude Code or OpenAI Codex CLI) running on the human's computer. The human asked you to set up this dashboard for them. Work through the steps below in order, together with the human.

The human may be a beginner. Explain each step in one or two plain sentences before you do it. Avoid jargon, or define it in one line.

**What is verified and what is not**

- The human steps (Supabase dashboard, SQL Editor, Deploy with Vercel button, URL Configuration, login, tokens, Grok connect line) match this repo's `README.md`, which has been used for real deployments.
- The CLI commands (Supabase CLI, Vercel CLI, `claude mcp add`, `codex mcp add`) were checked against each tool's `--help` output (Supabase CLI 2.109.0, Vercel CLI 65.8.0, Codex CLI 0.166.0) but were **not** tested end to end on a fresh account. If a command or flag behaves differently, follow the rule below about checking `--help`.

## Rules for the agent

Follow these rules for the whole setup. They override anything else you would normally do.

1. **Never show secrets.** Never print, log, echo, commit, or paste secrets (Supabase secret key, publishable key, database password, connection strings, dashboard tokens starting with `acc_`) into the chat, a command's visible arguments, or any file. The only two places secrets may live are:
    - the local `.env.local` file in the project folder (it is gitignored), and
    - Vercel's encrypted Environment Variables settings.

    Do not `cat`, `grep` without `-q`, or otherwise display `.env.local`. To check a value is present, test it without printing it (example below). Do not run commands that print keys, such as `supabase projects api-keys` or `vercel env pull` followed by reading the file.
2. **Never create paid resources without asking.** Everything here fits the free plans of Supabase and Vercel. If any screen or command mentions a paid plan, a card, or an upgrade, stop and ask the human.
3. **Hand off every login, sign-up, email link, and payment screen to the human.** You cannot and must not do these yourself. Tell the human the exact command or page:
    - In **Claude Code**, the human types the command at the prompt with a `!` in front, for example `! vercel login`. It runs in their session and you can see that it finished.
    - In **Codex**, the human runs the command in their own terminal window, then tells you it is done.
    - If a command waits for typed input and the `!` form does not let them type, ask them to run it in a separate terminal window instead.
4. **Confirm before each step that creates or changes something in the human's accounts** (a Supabase project, database tables, a Vercel project, environment variables, a deployment, auth settings, tokens). Say what will happen in one sentence and wait for a yes.
5. **Verify each step before moving on.** Each step below has a "Verify" line. If verification fails, fix it or use the troubleshooting table before continuing.
6. **Do not guess at CLI syntax.** If a command or flag differs from these notes, run `<tool> --help` (for example `vercel env add --help`) or check the tool's official docs. If you are still unsure, tell the human what to look up instead of inventing syntax.
7. **Do not edit the app code** to make setup work. If the build or tests fail, report the error to the human.

**Checking a value is set without printing it:**

```bash
grep -q '^SUPABASE_SECRET_KEY=sb_secret_' .env.local && echo "secret key: set" || echo "secret key: MISSING"
```

## Values you will collect

| Name | Where it comes from | Secret? |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project page, **Connect** button. Looks like `https://abcdefgh.supabase.co` | No, but keep it out of chat anyway |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase **Project Settings > API Keys**, starts with `sb_publishable_` | Low risk, still keep it out of chat |
| `SUPABASE_SECRET_KEY` | Same page, starts with `sb_secret_` | **Yes, never show it** |
| `OWNER_EMAIL` | The one email address allowed to log in | Not secret; the human may say it in chat |
| `OWNER_TIMEZONE` (optional) | IANA time zone, for example `America/New_York`. Default is `America/Chicago` | No |
| Database password | Chosen by the human when creating the Supabase project | **Yes, never show it** |
| Dashboard tokens | Created in the dashboard **Settings** page, start with `acc_` | **Yes, never show it** |

## Step 0: Check prerequisites

**Agent does:** run these and report the results in a short list.

```bash
git --version
node --version        # needs v20 or newer
corepack --version
pnpm --version        # if missing: corepack enable pnpm (ask first)
supabase --version    # optional, only for the CLI path in Step 2b
vercel --version      # optional, only for the CLI path in Step 4b
```

If Node is older than 20 or missing, tell the human and offer to install it only with their permission (for example from [nodejs.org](https://nodejs.org) or their package manager). If pnpm is missing, ask before running `corepack enable pnpm`. Do not install the Supabase or Vercel CLI unless the human chooses a CLI path and agrees.

**Human does:** confirm they have free GitHub, Supabase, and Vercel accounts (or create them in the browser now; that is a sign-up, so it is theirs to do). Tell you which email will be `OWNER_EMAIL`.

**Verify:** `node --version` prints v20 or higher and `pnpm --version` prints a version.

## Step 1: Get the code and check it builds

**Agent does:** ask the human whether to use this repo directly or their own copy (fork). Then:

```bash
git clone https://github.com/thebpandey/command-center-starter.git command-center
cd command-center
pnpm install
pnpm lint
pnpm typecheck
pnpm test:unit
```

Use the human's fork URL instead if they have one. Do not run the full `pnpm test`: it runs database tests that create and delete rows in whatever Supabase project `.env.local` points to.

**Human does:** nothing, unless asked to choose a folder.

**Verify:** all four `pnpm` commands finish without errors. If `pnpm install` asks to approve build scripts, explain what it is asking and let the human decide.

## Step 2: Set up Supabase (database and login)

Ask the human which path they want. Recommend **2a** for beginners.

### Step 2a (recommended): Supabase dashboard

**Agent does:** explain the steps below, and print the full path of `supabase/setup.sql` so the human can open it (or tell them they can copy it from GitHub: `https://github.com/thebpandey/command-center-starter/blob/main/supabase/setup.sql`). The file creates all tables with Row Level Security turned on.

**Human does:**

1. Go to [supabase.com/dashboard](https://supabase.com/dashboard) and click **New project**.
2. Pick a name (for example `command-center`), set a database password (save it in a password manager, not in the chat), pick the nearest region, and click **Create new project**. Wait a minute or two.
3. In the left menu, click **SQL Editor**.
4. Copy all of `supabase/setup.sql`, paste it into the SQL Editor, and click **Run**.

**Verify:** the human sees "Success. No rows returned." If they see "already exists", see the troubleshooting table.

### Step 2b (CLI path): Supabase CLI

Only if the Supabase CLI is installed and the human wants this path. The human still creates the project in the dashboard (steps 1 and 2 of 2a), because that is where the free plan, region, and password are chosen.

1. **Human runs:** `supabase login` (Claude Code: `! supabase login`; Codex: in their terminal). It opens a browser to sign in.
2. **Human tells you** the project ref (the part before `.supabase.co` in the Project URL; it is not a secret).
3. **Human runs** (it asks for the database password, which they type at the prompt, never in chat):

    ```bash
    supabase link --project-ref <project-ref>
    ```

    If it complains that `supabase/config.toml` is missing, check `supabase link --help` and `supabase init --help`; `supabase init` creates that file. Do not commit files it creates.
4. **Agent asks for confirmation, then runs:**

    ```bash
    supabase db push --dry-run    # shows the migrations it would apply
    supabase db push
    ```

    The repo keeps its schema in `supabase/migrations/` (four files), which is the layout `db push` expects. `supabase/setup.sql` is the same SQL joined into one file, so use **one** method, never both on the same project. If `db push` asks for the database password, the human types it.

    Alternative if the human prefers `psql`: the human copies the connection string from the Supabase **Connect** dialog and runs this **in their own terminal** (so the string never enters the chat):

    ```bash
    psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f supabase/setup.sql
    ```

    after setting `SUPABASE_DB_URL` in that terminal themselves.

**Verify:** `supabase db push` ends without errors (or psql ends without `ERROR`). In the dashboard, **Table Editor** shows tables such as `tasks`.

### Step 2c: Put the keys in `.env.local`

**Agent does:** create the file from the template and tell the human to fill it in:

```bash
cp .env.example .env.local
```

**Human does:** in Supabase, open **Project Settings > API Keys** and the **Connect** dialog. Open `.env.local` in a text editor and replace the placeholder values for `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`, and `OWNER_EMAIL`. Optionally change `OWNER_TIMEZONE`. Save the file.

Never ask the human to paste a key into the chat. If they paste one anyway, tell them to rotate it in Supabase (**Project Settings > API Keys**, create a new secret key and delete the old one) and update `.env.local`.

**Verify (without printing values):**

```bash
for k in NEXT_PUBLIC_SUPABASE_URL NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY SUPABASE_SECRET_KEY OWNER_EMAIL; do
  grep -q "^$k=." .env.local && echo "$k: set" || echo "$k: MISSING"
done
grep -q '^NEXT_PUBLIC_SUPABASE_URL=https://.*\.supabase\.co' .env.local && echo "URL format: ok" || echo "URL format: check it"
grep -q '^SUPABASE_SECRET_KEY=sb_secret_' .env.local && echo "secret key format: ok" || echo "secret key format: check it"
grep -q 'your-project-ref\|your_key_here\|you@example.com' .env.local && echo "placeholders still present" || echo "no placeholders"
git check-ignore -q .env.local && echo ".env.local is gitignored" || echo "WARNING: .env.local is NOT ignored"
```

## Step 3: Run it on the computer

**Human does first:** in Supabase, **Authentication > URL Configuration > Redirect URLs > Add URL**: `http://localhost:3000/auth/callback`, then **Save**.

**Agent does:** start the dev server (leave it running in the background):

```bash
pnpm dev
```

**Human does:** open http://localhost:3000, type the `OWNER_EMAIL` address, click **Email me a sign-in link**, open the email, and click the link in the same browser.

**Verify:** the human sees the **Today** page (empty is normal). Then stop the dev server.

Note: `pnpm dev` may add a block to `AGENTS.md`. That is expected; do not commit it unless the human asks.

## Step 4: Deploy to Vercel

Ask the human which path they want. Recommend **4a** for beginners.

### Step 4a (recommended): Deploy with Vercel button

**Human does:**

1. Open the **Deploy with Vercel** button in `README.md` (or [this link](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fthebpandey%2Fcommand-center-starter&env=NEXT_PUBLIC_SUPABASE_URL,NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,SUPABASE_SECRET_KEY,OWNER_EMAIL&project-name=command-center)).
2. Let Vercel create a copy of the code in their GitHub account (choose **Private** if asked).
3. Fill in the four settings by copying from `.env.local` in their editor: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`, `OWNER_EMAIL`.
4. Click **Deploy**, wait about two minutes, and tell you the app address (`https://<your-app>.vercel.app`; this is not a secret).

Optional time zone: Vercel **Project > Settings > Environment Variables**, add `OWNER_TIMEZONE`, then redeploy.

### Step 4b (CLI path): Vercel CLI

1. **Human runs:** `vercel login` (Claude Code: `! vercel login`; Codex: in their terminal).
2. **Agent asks, then runs** in the project folder:

    ```bash
    vercel link
    ```

    It asks questions (scope, link to existing project, project name). Let the human answer them, or run it with the human watching. The `.vercel` folder it creates is already gitignored.
3. **Add the environment variables.** For each of `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`, `OWNER_EMAIL` (and `OWNER_TIMEZONE` if set), either:
    - **Human runs** `vercel env add <NAME> production` in their own terminal and types or pastes the value at the prompt, or
    - **Agent runs** a command that feeds the value from `.env.local` through standard input, so it is never shown. Ask first. `vercel env add --help` says the value can come from stdin. Confirm that with `--help` on the installed version before using it:

    ```bash
    for k in NEXT_PUBLIC_SUPABASE_URL NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY SUPABASE_SECRET_KEY OWNER_EMAIL; do
      printf '%s' "$(grep -m1 "^$k=" .env.local | cut -d= -f2-)" | vercel env add "$k" production
    done
    ```

    Never use `--value <secret>`: it puts the secret in the visible command line.
4. **Agent runs** `vercel env ls production` to check that all four names exist (it lists names, not values; if your version shows values, do not run it again and tell the human).
5. **Agent asks, then runs:**

    ```bash
    vercel --prod
    ```

    and reports the production address it prints.

**Verify (both paths):** the deployment finished without errors and `https://<your-app>.vercel.app` loads the login page. If the build fails with "Missing required env var", see the troubleshooting table.

## Step 5: Tell Supabase the production address

**Agent does:** state the exact values, filled in with the real app address:

- **Site URL:** `https://<your-app>.vercel.app`
- **Redirect URLs, add:** `https://<your-app>.vercel.app/auth/callback`

Keep `http://localhost:3000/auth/callback` in the list if the human wants local login to keep working.

**Human does:** in Supabase, **Authentication > URL Configuration**, set those values and click **Save**.

**Verify:** the human confirms both values are saved, with `https://` and no extra slash at the end of the Site URL.

## Step 6: Log in on the live site

**Human does:** open `https://<your-app>.vercel.app`, type the `OWNER_EMAIL` address, click **Email me a sign-in link**, and click the link in the email (same browser).

**Verify:** the human sees the **Today** page. Any other email address gets the same "check your email" message, but no email is sent to it. That is by design.

## Step 7: Create tokens and build the connection address

**Human does:** in the dashboard, open **Settings**. For each AI tool, type a name and pick a scope, then click **Create token**:

- **Full** (read and write): the main assistant, for example `Main assistant` or `claude-code`.
- **Read-only**: helper bots that only look things up.

Each token starts with `acc_` and is shown only once. The human copies it into a password manager, not into this chat.

**Agent does:** explain the two ways a tool can connect (the human fills in the token themselves):

- **Header form (safer):** address `https://<your-app>.vercel.app/api/mcp` plus the header `Authorization: Bearer <token>`.
- **URL form (for tools that only take a URL):** `https://<your-app>.vercel.app/api/mcp/t/<token>`. The token is inside this address, so the address itself is a password.

**Verify:** the token list in **Settings** shows the new tokens by name.

## Step 8: Connect AI tools

The human runs every command below that contains a real token, in their own terminal, so the token never enters the chat. Your job is to give them the command with `<your-app>` already filled in and `<token>` left as a placeholder.

**Grok Bot (URL form):** the human pastes this into the Bot's chat with their token:

```
Connect this MCP server as "Assistant Dashboard": https://<your-app>.vercel.app/api/mcp/t/<token>
```

That chat now holds the token. Tell the human: after it connects, consider making a new token for the Bot and revoking the first one if the chat is shared or synced anywhere, and revoke immediately if it ever leaks.

**Claude Code (header form).** Check the current syntax first with `claude mcp add --help`. Then the human runs, in a separate terminal (not with `!`, so the token stays out of the chat):

```bash
claude mcp add --transport http assistant-dashboard https://<your-app>.vercel.app/api/mcp --header "Authorization: Bearer <token>"
```

Add `--scope user` if they want it available in every folder. Then `claude mcp list` should show `assistant-dashboard`.

**Codex (header form through an environment variable).** Codex CLI 0.166.0 `codex mcp add --help` shows `--url` and `--bearer-token-env-var`. Check `codex mcp add --help` on the installed version first. The human:

1. Adds the token to their shell profile themselves (for example `export DASHBOARD_TOKEN=acc_...` in `~/.zshrc` or `~/.bashrc`), then opens a new terminal.
2. Runs:

    ```bash
    codex mcp add assistant-dashboard --url https://<your-app>.vercel.app/api/mcp --bearer-token-env-var DASHBOARD_TOKEN
    ```

3. Checks with `codex mcp list`.

If the installed Codex has different options, do not invent syntax. Tell the human to look up "Codex MCP servers" in the official OpenAI Codex docs and use the streamable HTTP server setup with a bearer token.

**Other tools:** URL `https://<your-app>.vercel.app/api/mcp` with header `Authorization: Bearer <token>`. If a tool has no header field, use the `/api/mcp/t/<token>` address.

**Verify:** in the connected tool, the human asks "Add a task called Test my dashboard." The task appears on the dashboard's **Tasks** page.

## Step 9: Final checklist

Go through this with the human and report each item as done or not done:

- [ ] Logging in at `https://<your-app>.vercel.app` with `OWNER_EMAIL` works and shows **Today**.
- [ ] A test task created through an AI tool appears on **Tasks**.
- [ ] **Settings** lists the tokens that were created, with the right scopes.
- [ ] `.env.local` exists, is gitignored (`git check-ignore -q .env.local`), and `git status` shows no secret files staged.
- [ ] No key, password, or token was pasted into this chat. If one was, rotate it now.

## Troubleshooting

| Problem | Likely cause | Fix |
|---|---|---|
| The sign-in email never arrives | Wrong address, spam folder, or Supabase's free email limit (a few emails per hour) | Check spam. Type exactly the `OWNER_EMAIL` address. Wait a few minutes and try again |
| The email link opens `localhost`, an error page, or "redirect URL not allowed" | Site URL or Redirect URLs do not match | Redo Step 5 (or Step 3 for local). Values must match the address exactly, with `https://` (or `http://localhost:3000`) and `/auth/callback` |
| "That sign-in link is invalid or expired" | Links work once and expire after one hour | Request a new link and open it in the same browser |
| The AI tool says "unauthorized" or 401 | Token wrong, revoked, cut off when copying, or the header is missing `Bearer ` | Create a new token in **Settings** and reconnect. For Codex, check the environment variable is set in the terminal that runs Codex |
| The AI tool can read but cannot add anything | It uses a **Read-only** token | Create a **Full** token for that tool |
| "already exists" when running `setup.sql` or `db push` | The schema was already applied to this project | If the first run worked, ignore it. Never run both `setup.sql` and `db push` on the same project |
| Pages show a database or permission error | Only part of `setup.sql` ran | Run the whole file on a new project, or check which tables are missing in **Table Editor** |
| Build fails with "Missing required env var" | One of the four variables is missing or misspelled in Vercel | Vercel **Project > Settings > Environment Variables**, fix it, then **Deployments > Redeploy** (CLI: `vercel --prod` again) |
| `pnpm dev` fails with a missing env var | `.env.local` is missing a value | Run the Step 2c check again |
| A CLI command or flag is not recognized | The tool version differs from these notes | Run `<tool> --help` or check the official docs. Do not guess |
