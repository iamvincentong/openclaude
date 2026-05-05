# Model Aliases

Per-profile, short-name aliases for model ids — so you can write
`openclaude --model gemini-flash` instead of
`openclaude --model google/gemini-3-flash-preview`.

Combined with **auto-resume** of the last-used model, daily model swapping
becomes one short flag, and plain `openclaude` continues with the model
you were on.

> Primary use case is OpenRouter, but aliases work on any active provider
> profile (Anthropic, Gemini, Mistral, OpenAI direct, etc.).

## Setup once

1. Create your provider profile via the in-app `/provider` flow. For
   OpenRouter:
   - Base URL: `https://openrouter.ai/api/v1`
   - Model (initial): any one of your routes, e.g. `openai/gpt-5-mini`
   - API key: your `OPENROUTER_API_KEY`
2. Add aliases for the models you actually rotate between:

   ```bash
   openclaude alias add gemini-flash google/gemini-3-flash-preview
   openclaude alias add opus-47       anthropic/claude-opus-4.7
   openclaude alias add gpt-55        openai/gpt-5.5
   openclaude alias add glm-air       z-ai/glm-4.5-air:free
   ```

3. Verify:

   ```bash
   openclaude alias list
   # alpha            → ...
   # gemini-flash     → google/gemini-3-flash-preview
   # opus-47          → anthropic/claude-opus-4.7
   ```

## Daily workflow

```bash
# Pick model for today's task — single short flag:
openclaude --model opus-47
# ... work happens, session ends ...

# Tomorrow morning, just run it. Last-used (opus-47 → claude-opus-4.7) is
# restored automatically:
openclaude

# Need to swap mid-day? One flag:
openclaude --model gemini-flash
# Next plain `openclaude` will now restore gemini-flash.
```

Both `--model gemini-flash` and `--model=gemini-flash` work.

## Cross-profile

`alias list`, `add`, `rm`, and `--model <alias>` all operate on the **active
profile** only. Switching profile via `--provider` activates that profile's
own aliases and its own `lastUsedModel`:

```bash
openclaude --provider anthropic            # uses Anthropic profile's last-used model
openclaude --provider anthropic --model X  # alias resolves on the Anthropic profile
```

Cross-profile / global aliases are not supported.

## Gotchas

- **Alias scope is per-profile.** Aliases defined on the OpenRouter profile
  are not visible from the Anthropic profile.
- **Alias wins on collision.** If you define an alias whose name equals a
  real model id, the alias resolves. Don't reuse real ids as alias names.
  The escape hatch is `openclaude alias rm <name>` to remove the alias.
- **`alias add` mutates the picker list.** Adding an alias also appends the
  underlying model id to the profile's `model` comma-list, so the model
  also appears in the in-app `/model` picker. This is intentional — you
  shouldn't have to add the model in two places.
- **`alias rm` does NOT remove from the picker list.** Your model history
  is preserved; only the alias entry goes away.
- **BYOK on OpenRouter.** OpenRouter handles BYOK server-side via the keys
  you configure in their web UI. OpenClaude does not currently inject
  per-alias `provider.only` / `allow_fallbacks` body fields. If you need
  hard provider-pinning per alias, that's a future enhancement.

## Where data lives

Aliases and `lastUsedModel` are stored on each `ProviderProfile` entry in
`~/.claude/openclaude/config.json` (mode `0600`). No `.env` files involved.

## Commands

| Command | Effect |
|---|---|
| `openclaude alias add <name> <model-id>` | Add or overwrite an alias on the active profile. Appends model id to profile picker list if absent. |
| `openclaude alias rm <name>` | Remove the alias entry. Picker list unchanged. |
| `openclaude alias list` | List aliases on the active profile, alphabetized. |
| `openclaude alias list --json` | Same, as JSON for machine consumption. |
| `openclaude --model <alias>` | Use the alias for this session. |
| `openclaude --model <model-id>` | Verbatim model id (no alias resolution). |
| `openclaude` (no flags) | Auto-resume `lastUsedModel` if set, else profile's primary model. |
