import type { PluginHandlerContext } from "@getpaseo/plugin/server";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import type { ProviderModels } from "../shared/rpc";

type Paseo = PluginHandlerContext["paseo"];
type Option = { id: string; label: string; description?: string; isDefault?: boolean };
/** A model as config.json's agents.providers.<id>.models accepts it. */
type ConfigModel = Option & { thinkingOptions?: Option[] };
type State = {
  /** Full model list per provider, so hidden models stay listed. */
  catalogs: Record<string, ConfigModel[]>;
  /** Providers this plugin currently restricts. */
  filtered: string[];
  /** A `models` list the user had written by hand before filtering, to put back on reset. */
  originals: Record<string, ConfigModel[]>;
};

const STATE_FILE = join(process.env.PASEO_HOME || join(homedir(), ".paseo"), "model-filter.json");

const isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === "object" && !Array.isArray(value);

async function readState(): Promise<State> {
  let raw: unknown;
  try {
    raw = JSON.parse(await readFile(STATE_FILE, "utf8"));
  } catch {
    // Missing or unreadable: start fresh.
  }
  const state = isRecord(raw) ? raw : {};
  return {
    catalogs: isRecord(state.catalogs) ? (state.catalogs as State["catalogs"]) : {},
    filtered: Array.isArray(state.filtered) ? state.filtered : [],
    originals: isRecord(state.originals) ? (state.originals as State["originals"]) : {},
  };
}

async function writeState(state: State): Promise<void> {
  await mkdir(dirname(STATE_FILE), { recursive: true });
  // Write then rename, so a crash mid-write cannot leave a truncated file.
  const tmp = `${STATE_FILE}.tmp`;
  await writeFile(tmp, JSON.stringify(state, null, 2));
  await rename(tmp, STATE_FILE);
}

// One at a time: every handler reads then rewrites the same state file and config entry.
let queue: Promise<unknown> = Promise.resolve();
function serial<T>(task: () => Promise<T>): Promise<T> {
  const run = queue.then(task);
  queue = run.catch(() => {});
  return run;
}

type SnapshotModel = Option & { thinkingOptions?: Option[]; defaultThinkingOptionId?: string };

function toConfigModel(m: SnapshotModel): ConfigModel {
  const thinking = m.thinkingOptions?.map((o) => ({
    id: o.id,
    label: o.label,
    ...(o.description ? { description: o.description } : {}),
    ...(o.isDefault || o.id === m.defaultThinkingOptionId ? { isDefault: true } : {}),
  }));
  return {
    id: m.id,
    label: m.label,
    ...(m.description ? { description: m.description } : {}),
    ...(m.isDefault ? { isDefault: true } : {}),
    ...(thinking?.length ? { thinkingOptions: thinking } : {}),
  };
}

async function providerEntry(paseo: Paseo, provider: string): Promise<Record<string, unknown>> {
  const providers: Record<string, unknown> = (await paseo.config.get()).config.providers ?? {};
  return Object.hasOwn(providers, provider) ? { ...(providers[provider] as Record<string, unknown>) } : {};
}

export function listModels(paseo: Paseo): Promise<{ providers: ProviderModels[] }> {
  return serial(async () => {
    const state = await readState();
    const before = JSON.stringify(state);
    const snapshot = await paseo.providers.waitForReady();
    const providers: ProviderModels[] = [];
    for (const entry of snapshot.entries) {
      if (entry.enabled === false || !entry.models?.length) continue;
      const p = entry.provider;
      const filtered = state.filtered.includes(p);
      // While unfiltered, the snapshot is the full list: remember it so hidden models can come back.
      if (!filtered || !Object.hasOwn(state.catalogs, p)) state.catalogs[p] = entry.models.map(toConfigModel);
      const visible = new Set(entry.models.map((m) => m.id));
      providers.push({
        provider: p,
        label: entry.label ?? p,
        filtered,
        models: state.catalogs[p].map((m) => ({ id: m.id, label: m.label, description: m.description, visible: visible.has(m.id) })),
      });
    }
    if (JSON.stringify(state) !== before) await writeState(state);
    return { providers };
  });
}

export function saveModels(paseo: Paseo, provider: string, visibleIds: string[]): Promise<{ ok: true }> {
  return serial(async () => {
    const state = await readState();
    if (!Object.hasOwn(state.catalogs, provider)) throw new Error(`No model list known for ${provider}: reopen the screen and retry.`);
    const keep = new Set(visibleIds);
    const models = state.catalogs[provider].filter((m) => keep.has(m.id));
    if (!models.length) throw new Error("Select at least one model.");
    if (!state.filtered.includes(provider)) {
      const { models: own } = await providerEntry(paseo, provider);
      if (Array.isArray(own)) state.originals[provider] = own;
      state.filtered.push(provider);
    }
    // State first: if the patch then fails, the catalog is still safe and Show all still works.
    await writeState(state);
    // The daemon merges a provider patch into the entry, so its other settings (command, env…) stay.
    await paseo.config.patch({ providers: { [provider]: { models } } });
    await paseo.providers.refresh({ providers: [provider] });
    return { ok: true };
  });
}

export function resetModels(paseo: Paseo, provider: string): Promise<{ ok: true }> {
  return serial(async () => {
    const state = await readState();
    // Only undo what this plugin did: never touch a provider it does not filter.
    if (!state.filtered.includes(provider)) return { ok: true };
    const original = Object.hasOwn(state.originals, provider) ? state.originals[provider] : undefined;
    if (original) {
      await paseo.config.patch({ providers: { [provider]: { models: original } } });
    } else {
      // A patch cannot delete one key, so drop the entry and write it back without `models`.
      const entry = await providerEntry(paseo, provider);
      const { models: _dropped, ...rest } = entry;
      await paseo.config.patch({ removeProviders: [provider] });
      if (Object.keys(rest).length) {
        await paseo.config.patch({ providers: { [provider]: rest } }).catch(async (error) => {
          // Never leave the provider without its settings: put the filtered entry back.
          await paseo.config.patch({ providers: { [provider]: entry } });
          throw error;
        });
      }
    }
    state.filtered = state.filtered.filter((p) => p !== provider);
    delete state.originals[provider];
    await writeState(state);
    await paseo.providers.refresh({ providers: [provider] });
    return { ok: true };
  });
}
