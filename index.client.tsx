import type { PluginClientContext } from "@getpaseo/plugin/client";
import { ModelsScreen } from "./client/models-screen";

export default function contribute(client: PluginClientContext) {
  client.addSettingsScreen({ id: "models", title: "Modèles affichés", icon: "ListChecks", Component: ModelsScreen });
  return () => {};
}
