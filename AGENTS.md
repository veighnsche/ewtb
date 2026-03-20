# AGENTS

Keep the workflow simple.

- Port `3202` runs the built app.
- When the work is finished and you decide to build the app, run the build normally.
- If the build finishes without errors, rerun the built app on port `3202` so the running app there is replaced by the new build.
- Do not replace the app on port `3202` with a failed build.
- Replace the existing app on port `3202`; do not leave duplicate listeners behind.
