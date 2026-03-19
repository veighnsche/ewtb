# AGENTS

## Workflow

- Do not break the user's dev server.
- Do not start another dev server if one already exists.
- Do not start a preview server if the dev server already exists.
- Do not start a build as a substitute for using the dev server.
- Do not inject your own env vars into a replacement dev server.
- Do not wrap the dev server in a custom command behind the user's back.
- Do not change ports casually.
- Do not change hosts casually.
- Do not switch between `localhost`, `127.0.0.1`, and `::1` without first checking what is actually running.
- Do not create parallel local workflows.
- Do not keep old repo servers running after starting another one.
- Do not leave duplicate listeners on the same port family.
- Do not assume stale output is a code bug before checking for duplicate servers.
- Do not assume broken refresh is a framework issue before checking your own process mistakes.
- Do not "just test something quickly" by launching another server.
- Do not override the user's active runtime configuration with your own temporary one.
- Do not treat the dev server as disposable tooling.
- Do not verify UI work by bypassing the user's existing dev loop.
- If you break the dev server, stop and fix that first.
- Protect the user's dev server before doing anything else.

- Use the existing dev server the user is already running, typically `http://127.0.0.1:3000`, instead of starting an extra local server unless the user explicitly asks for that.
- Prefer the repository's existing workflow commands such as `just` targets over ad hoc replacement commands when they cover the task.
- Do not circumvent the normal screenshot workflow; use the project's expected screenshot path or command flow when checking the UI.
- Keep the approach simple and avoid inventing parallel local workflows unless they are strictly necessary to complete the task.
- Do not start a second dev server, preview server, or alternate port "just for testing" if any repo server is already running. That breaks the user's workflow and is considered operator error.
- Before starting any repo server, check whether one is already running for this repo. If one exists, reuse it instead of creating another.
- If the user reports stale output, wrong UI, broken refresh, or missing HMR, first suspect duplicate local servers or host mismatches before changing code.
- Do not use `localhost` casually for this repo when host resolution can differ between `127.0.0.1` and `::1`. Prefer the explicit host the active dev server is actually bound to.
- If a second server was accidentally started, stop the duplicate immediately and tell the user plainly that the duplicate server was the mistake.
- Do not rationalize this failure mode as "just a Vite issue" or "just an environment issue" when the agent created the conflicting processes. Treat it as an avoidable workflow violation.
- Do not run `vite build`, `bun --bun run build`, or any manual production build as a substitute for checking the already-running dev server when the task is a live UI/layout fix. That is a workflow mistake, not a validation step.
- When the dev server is available, verify UI changes against that dev server first. Only run a production build if the user asked for it or if the task specifically requires build verification.
- Do not silently replace, wrap, or override the user's existing dev-server environment with your own env vars, alternate startup command, or custom runtime assumptions. That is another way of hijacking the dev workflow.
- If runtime configuration is missing, fix it in files, docs, or explicit user instructions first. Do not solve it by quietly launching your own specially-configured server.
- Treat the user's dev server as part of the product surface, not as disposable tooling. Breaking it repeatedly is a serious workflow failure.
- If this repo's dev workflow has already been broken once in the session, become more conservative, not less: no extra servers, no manual build substitution, no hidden env injection, no side-channel verification path unless the user explicitly asks for it.
