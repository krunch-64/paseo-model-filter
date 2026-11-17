import type { PluginServerContext } from "@getpaseo/plugin/server";
import { listModels, resetModels, saveModels } from "./server/models";
import { listRpc, resetRpc, saveRpc } from "./shared/rpc";

export default function contribute(server: PluginServerContext) {
  server.handle(listRpc, (_input, { paseo }) => listModels(paseo));
  server.handle(saveRpc, ({ provider, visibleIds }, { paseo }) => saveModels(paseo, provider, visibleIds));
  server.handle(resetRpc, ({ provider }, { paseo }) => resetModels(paseo, provider));
  return () => {};
}
