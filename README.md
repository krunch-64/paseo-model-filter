# Model filter for Paseo

English | [Français](README.fr.md)

A [Paseo](https://paseo.sh) plugin to choose which models each provider shows in the chat model picker. Providers such as OpenCode list hundreds of models; this keeps the picker down to the ones you actually use.

## Install

Requires Paseo 0.16.0 or later.

1. Enable plugins once: **Settings → Plugins → Enable plugins**. Plugins are trusted, unsandboxed code, so read the source before installing any of them.
2. Install:

   ```bash
   paseo plugin install github:krunch-64/paseo-model-filter
   ```

3. Check it runs: `paseo plugin ls` should show `model-filter` as `running`.

## Use

Open the filter from any of these:

- the **Filter models** row at the top of the sidebar;
- the Command Center (Ctrl+K or ⌘K), then **Filter models**;
- the **Filter** button in the chat composer, which opens the provider selected in that chat;
- **Settings → Plugins**, then the settings button on the Model filter row.

Then:

1. Open a provider card.
2. Tick the models you want to keep. **Check all** and **Uncheck all** work per provider and per source group.
3. Press **Save**. The picker updates right away, no daemon restart.

Unticked models stay listed in the plugin, so you can tick them again later. **Show all** removes the filter for that provider.

The interface is in English and French and follows the app language.

## How it works

- Saving writes the ticked models to `agents.providers.<provider>.models` in the daemon's `config.json`. The provider's other settings are left untouched.
- The full model list is kept in `model-filter.json` in the Paseo home (`~/.paseo` by default), which is how hidden models stay listed.
- **Show all** deletes that `models` key, or puts back the list you had written by hand before filtering.
- Nothing is sent over the network.

## Known limits

- While a provider is filtered, models released later do not appear until you press **Show all**.
- Models declared under `additionalModels` always stay visible.

## Uninstall

Press **Show all** on each filtered provider first: the filter lives in `config.json` and would otherwise stay in place. Then:

```bash
paseo plugin remove model-filter
```

If the plugin is already gone, delete the `models` key of the provider under `agents.providers` in `config.json`, then run `paseo reload`.

## Develop

```bash
git clone https://github.com/krunch-64/paseo-model-filter
cd paseo-model-filter
npm install
npm run typecheck
npm test
paseo plugin install "$(pwd)"   # then `paseo plugin reload model-filter` after each edit
```

| Path | Role |
| --- | --- |
| `index.client.tsx`, `client/` | App side: screens, sidebar row, composer button, translations (`client/strings.ts`) |
| `index.server.ts`, `server/` | Daemon side: reads providers, writes `config.json` and the state file |
| `shared/rpc.ts` | The three RPC contracts shared by both sides |
| `test/` | Tests of the daemon side against a fake daemon |

To add a language, add an object with the same keys as `en` in `client/strings.ts` and register it in `client/i18n.ts`.

## License

[MIT](LICENSE)
