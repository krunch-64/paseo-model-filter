Model filter lets you choose which models appear in the chat model picker, provider by provider. Providers such as OpenCode can list hundreds of models; this keeps the picker down to the ones you actually use.

Open it from Settings, Plugins, then the settings button on the Model filter row. Each enabled provider has a collapsible card with one checkbox per model. Tick the models you want, then press Save. The change applies immediately, without restarting the daemon.

Models from different sources inside one provider are grouped by their id prefix, for example OpenCode Zen (`opencode/`) and OpenCode Go (`opencode-go/`), which often share the same model names. Each provider and each group has a check all or uncheck all button.

Saving writes the selected models to `agents.providers.<provider>.models` in the daemon's `config.json`, keeping each model's description and thinking levels. The full model list is remembered in `model-filter.json` in the Paseo home, so hidden models stay listed and can be ticked again. Show all removes the filter and returns the provider's full discovered list.

Known limits: while a provider is filtered, models released later do not appear until you press Show all. The interface is in French.
