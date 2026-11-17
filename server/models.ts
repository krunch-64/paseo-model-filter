import type { PluginHandlerContext } from "@getpaseo/plugin/server";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import type { ProviderModels } from "../shared/rpc";

type Paseo = PluginHandlerContext["paseo"];
type Option = { id: string; label: string; description?: string; isDefault?: boolean };
/** A model as config.json's agents.providers.<id>.models accepts it. */
type ConfigModel = Option & { thinkingOptions?: Option[] };
type State = { catalogs: Record<string, ConfigModel[]>; filtered: string[] };

const STATE_FILE = join(process.env.PASEO_HOME || join(homedir(), ".paseo"), "model-filter.json");

async function readState(): Promise<State> {
  try {
    const raw = JSON.parse(await readFile(STATE_FILE, "utf8")) as Partial<State>;
    return { catalogs: raw.catalogs ?? {}, filtered: raw.filtered ?? [] };
  } catch {
    return { catalogs: {}, filtered: [] };
  }
}

async function writeState(state: State): Promise<void> {
  await mkdir(dirname(STATE_FILE), { recursive: true });
  await writeFile(STATE_FILE, JSON.stringify(state, null, 2));
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
  const { config } = await paseo.config.get();
  return { ...((config.providers ?? {})[provider] as Record<string, unknown> | undefined) };
}

export async function listModels(paseo: Paseo): Promise<{ providers: ProviderModels[] }> {
  const state = await readState();
  const snapshot = await paseo.providers.waitForReady();
  const providers: ProviderModels[] = [];
  for (const entry of snapshot.entries) {
    if (entry.enabled === false || !entry.models?.length) continue;
    const p = entry.provider;
    // While unfiltered, the snapshot is the full list: remember it so hidden models can come back.
    if (!state.filtered.includes(p)) state.catalogs[p] = entry.models.map(toConfigModel);
    const visible = new Set(entry.models.map((m) => m.id));
    const catalog = state.catalogs[p] ?? entry.models.map(toConfigModel);
    providers.push({
      provider: p,
      label: entry.label ?? p,
      filtered: state.filtered.includes(p),
      models: catalog.map((m) => ({ id: m.id, label: m.label, description: m.description, visible: visible.has(m.id) })),
    });
  }
  await writeState(state);
  return { providers };
}

export async function saveModels(paseo: Paseo, provider: string, visibleIds: string[]): Promise<{ ok: true }> {
  const state = await readState();
  const catalog = state.catalogs[provider];
  if (!catalog) throw new Error(`Liste inconnue pour ${provider} : rouvre l'écran puis réessaie.`);
  const keep = new Set(visibleIds);
  const models = catalog.filter((m) => keep.has(m.id));
  if (!models.length) throw new Error("Coche au moins un modèle.");
  // Keep the provider's other settings (command, env…): the patch may replace the whole entry.
  await paseo.config.patch({ providers: { [provider]: { ...(await providerEntry(paseo, provider)), models } } });
  if (!state.filtered.includes(provider)) state.filtered.push(provider);
  await writeState(state);
  await paseo.providers.refresh({ providers: [provider] });
  return { ok: true };
}

export async function resetModels(paseo: Paseo, provider: string): Promise<{ ok: true }> {
  const { models: _dropped, ...rest } = await providerEntry(paseo, provider);
  // A patch cannot delete one key, so drop the entry and write it back without `models`.
  await paseo.config.patch({ removeProviders: [provider] });
  if (Object.keys(rest).length) await paseo.config.patch({ providers: { [provider]: rest } });
  const state = await readState();
  state.filtered = state.filtered.filter((p) => p !== provider);
  await writeState(state);
  await paseo.providers.refresh({ providers: [provider] });
  return { ok: true };
}
