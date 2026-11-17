import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeEach, test } from "node:test";
import { en, fr } from "../client/strings.ts";

// The state file path is read at import time: point it at a throwaway home first.
const home = mkdtempSync(join(tmpdir(), "model-filter-"));
process.env.PASEO_HOME = home;
const stateFile = join(home, "model-filter.json");
const { listModels, saveModels, resetModels } = await import("../server/models.ts");

type Entry = Record<string, unknown>;
const model = (id: string) => ({ id, label: id.toUpperCase() });
const DISCOVERED: Record<string, { id: string; label: string }[]> = {
  alpha: [model("a1"), model("a2"), model("a3")],
  beta: [model("b1"), model("b2")],
};

/** A daemon double with the real patch semantics: remove first, then merge each provider entry. */
function fakePaseo(providers: Record<string, Entry> = {}, failPatch?: (patch: any) => boolean) {
  const paseo = {
    config: {
      get: async () => ({ config: { providers: structuredClone(providers) } }),
      patch: async (patch: { providers?: Record<string, Entry>; removeProviders?: string[] }) => {
        if (failPatch?.(patch)) throw new Error("patch refused");
        for (const id of patch.removeProviders ?? []) delete providers[id];
        for (const [id, entry] of Object.entries(patch.providers ?? {})) providers[id] = { ...providers[id], ...structuredClone(entry) };
        return { config: { providers } };
      },
    },
    providers: {
      waitForReady: async () => ({
        entries: Object.entries(DISCOVERED).map(([provider, models]) => ({
          provider,
          label: provider,
          enabled: true,
          models: (providers[provider]?.models as typeof models | undefined) ?? models,
        })),
      }),
      refresh: async () => ({}),
    },
  };
  return { paseo: paseo as any, providers };
}

const find = async (paseo: any, id: string) => (await listModels(paseo)).providers.find((p) => p.provider === id)!;
const visibleIds = (p: { models: { id: string; visible: boolean }[] }) => p.models.filter((m) => m.visible).map((m) => m.id);

beforeEach(() => writeFileSync(stateFile, "{}"));

test("saving hides models but keeps them listed, and keeps the provider's other settings", async () => {
  const { paseo, providers } = fakePaseo({ alpha: { command: ["run"], env: { KEY: "1" } } });
  await listModels(paseo);
  await saveModels(paseo, "alpha", ["a1", "a3"]);

  assert.deepEqual(providers.alpha, { command: ["run"], env: { KEY: "1" }, models: [model("a1"), model("a3")] });
  const alpha = await find(paseo, "alpha");
  assert.equal(alpha.filtered, true);
  assert.equal(alpha.models.length, 3);
  assert.deepEqual(visibleIds(alpha), ["a1", "a3"]);
});

test("a hidden model can be ticked again", async () => {
  const { paseo, providers } = fakePaseo();
  await listModels(paseo);
  await saveModels(paseo, "alpha", ["a1"]);
  await listModels(paseo);
  await saveModels(paseo, "alpha", ["a1", "a2"]);
  assert.deepEqual(providers.alpha.models, [model("a1"), model("a2")]);
});

test("reset removes the filter and keeps the provider's other settings", async () => {
  const { paseo, providers } = fakePaseo({ alpha: { command: ["run"] } });
  await listModels(paseo);
  await saveModels(paseo, "alpha", ["a1"]);
  await resetModels(paseo, "alpha");

  assert.deepEqual(providers.alpha, { command: ["run"] });
  const alpha = await find(paseo, "alpha");
  assert.equal(alpha.filtered, false);
  assert.deepEqual(visibleIds(alpha), ["a1", "a2", "a3"]);
});

test("reset drops a provider entry that only held the filter", async () => {
  const { paseo, providers } = fakePaseo();
  await listModels(paseo);
  await saveModels(paseo, "alpha", ["a1"]);
  await resetModels(paseo, "alpha");
  assert.equal("alpha" in providers, false);
});

test("reset puts back a model list the user wrote by hand", async () => {
  const handWritten = [model("a1"), model("a2")];
  const { paseo, providers } = fakePaseo({ alpha: { models: structuredClone(handWritten) } });
  await listModels(paseo);
  await saveModels(paseo, "alpha", ["a2"]);
  assert.deepEqual(providers.alpha.models, [model("a2")]);
  await resetModels(paseo, "alpha");
  assert.deepEqual(providers.alpha.models, handWritten);
});

test("reset never touches a provider this plugin does not filter", async () => {
  const { paseo, providers } = fakePaseo({ alpha: { models: [model("a1")] } });
  await listModels(paseo);
  await resetModels(paseo, "alpha");
  await resetModels(paseo, "__proto__");
  assert.deepEqual(providers.alpha, { models: [model("a1")] });
});

test("a failed reset leaves the provider's settings in place", async () => {
  let patches = 0;
  // Refuse the write-back that follows the removal.
  const { paseo, providers } = fakePaseo({ alpha: { command: ["run"] } }, (patch) => !patch.removeProviders && ++patches === 2);
  await listModels(paseo);
  await saveModels(paseo, "alpha", ["a1"]);
  await assert.rejects(resetModels(paseo, "alpha"), /patch refused/);
  assert.deepEqual(providers.alpha, { command: ["run"], models: [model("a1")] });
  assert.equal((await find(paseo, "alpha")).filtered, true);
});

test("concurrent saves on two providers both stick", async () => {
  const { paseo, providers } = fakePaseo();
  await listModels(paseo);
  await Promise.all([saveModels(paseo, "alpha", ["a1"]), saveModels(paseo, "beta", ["b2"]), listModels(paseo)]);

  assert.deepEqual(providers.alpha.models, [model("a1")]);
  assert.deepEqual(providers.beta.models, [model("b2")]);
  assert.deepEqual(JSON.parse(readFileSync(stateFile, "utf8")).filtered, ["alpha", "beta"]);
  assert.equal((await find(paseo, "alpha")).models.length, 3);
});

test("saving rejects unknown providers and empty selections", async () => {
  const { paseo, providers } = fakePaseo();
  await listModels(paseo);
  await assert.rejects(saveModels(paseo, "nope", ["a1"]), /No model list known/);
  await assert.rejects(saveModels(paseo, "__proto__", ["a1"]), /No model list known/);
  await assert.rejects(saveModels(paseo, "alpha", ["not-a-model"]), /at least one/);
  assert.deepEqual(providers, {});
});

test("a corrupt state file is treated as empty", async () => {
  writeFileSync(stateFile, "{ not json");
  const { paseo } = fakePaseo();
  assert.equal((await find(paseo, "alpha")).models.length, 3);
  writeFileSync(stateFile, JSON.stringify({ catalogs: [], filtered: "x", originals: null }));
  assert.equal((await find(paseo, "beta")).models.length, 2);
});

test("French keeps the same keys and placeholders as English", () => {
  const placeholders = (text: string) => (text.match(/{{.*?}}/g) ?? []).sort();
  assert.deepEqual(Object.keys(fr).sort(), Object.keys(en).sort());
  for (const key of Object.keys(en) as (keyof typeof en)[]) assert.deepEqual(placeholders(fr[key]), placeholders(en[key]), key);
});
