import { defineRpc } from "@getpaseo/plugin";
import { z } from "zod";

const ProviderModels = z.object({
  provider: z.string(),
  label: z.string(),
  /** True when this mod currently restricts the provider's list. */
  filtered: z.boolean(),
  models: z.array(z.object({ id: z.string(), label: z.string(), description: z.string().optional(), visible: z.boolean() })),
});
export type ProviderModels = z.infer<typeof ProviderModels>;

export const listRpc = defineRpc({
  name: "models.list",
  input: z.object({}),
  output: z.object({ providers: z.array(ProviderModels) }),
});

export const saveRpc = defineRpc({
  name: "models.save",
  input: z.object({ provider: z.string().min(1), visibleIds: z.array(z.string()).min(1) }),
  output: z.object({ ok: z.literal(true) }),
});

export const resetRpc = defineRpc({
  name: "models.reset",
  input: z.object({ provider: z.string().min(1) }),
  output: z.object({ ok: z.literal(true) }),
});
