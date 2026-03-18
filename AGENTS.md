# AGENTS

## Workflow

- Use the existing dev server the user is already running, typically `http://127.0.0.1:3000`, instead of starting an extra local server unless the user explicitly asks for that.
- Prefer the repository's existing workflow commands such as `just` targets over ad hoc replacement commands when they cover the task.
- Do not circumvent the normal screenshot workflow; use the project's expected screenshot path or command flow when checking the UI.
- Keep the approach simple and avoid inventing parallel local workflows unless they are strictly necessary to complete the task.
