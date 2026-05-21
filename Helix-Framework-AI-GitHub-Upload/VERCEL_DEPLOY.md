# Vercel Deploy

Use a GitHub repository, then import that repository into Vercel.

## Upload To GitHub

Upload these files and folders at the top level of the new GitHub repository:

```text
api/
assets/
backend/
frontend/
app.js
.env.example
.gitignore
.vercelignore
index.html
package.json
README.md
styles.css
TESTING.md
vercel.json
VERCEL_DEPLOY.md
```

The `api/` folder must contain `api.js`. Vercel uses that file as the serverless backend for uploads and AI scoring.

Do not upload:

```text
.env
netlify/
netlify.toml
NETLIFY_DEPLOY.md
```

## Vercel Settings

When importing the GitHub repository into Vercel, use:

```text
Framework Preset:
Other

Build Command:

Output Directory:

Install Command:

Root Directory:
./
```

Blank build, install, and output directory settings are intentional. The app's `index.html`, `styles.css`, `app.js`, and `assets/` are copied to the repository root for Vercel.

The Node version is set in `package.json`. Do not add a `runtime` value such as `nodejs20.x` to `vercel.json`; Vercel only uses `runtime` there for custom/community runtimes.

## Vercel Environment Variables

In Vercel, open Project Settings -> Environment Variables and add:

```text
OPENAI_API_KEY=your OpenAI API key
OPENAI_MODEL=gpt-4o-mini
NODE_OPTIONS=--use-system-ca
```

Redeploy after adding environment variables.

## Test After Deploy

Open:

```text
https://your-vercel-site.vercel.app/health
```

It should show:

```json
{
  "aiEnabled": true,
  "analysisEngine": "OpenAI"
}
```
