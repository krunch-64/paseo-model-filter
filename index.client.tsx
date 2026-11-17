import type { PluginClientContext, PluginScreenProps, PluginSidebarItemProps } from "@getpaseo/plugin/client";
import { ScrollView, SidebarRow } from "@getpaseo/plugin/client/ui";
import { makeFilterButton } from "./client/filter-button";
import { messages } from "./client/i18n";
import { ModelsScreen } from "./client/models-screen";

function FilterScreen(props: PluginScreenProps) {
  // Paseo scrolls settings screens itself; a plain screen owns its scrolling.
  return (
    <ScrollView style={{ flex: 1, backgroundColor: props.theme.colors.surface0 }}>
      <ModelsScreen {...props} only={props.params.provider} />
    </ScrollView>
  );
}

// Plugins cannot add to Settings > Providers, so the shortest path is a sidebar row.
function FilterItem({ currentScreen, openScreen }: PluginSidebarItemProps) {
  return (
    <SidebarRow
      icon="ListFilter"
      active={currentScreen?.screenId === "filter"}
      onPress={() => openScreen({ screenId: "filter" })}
    />
  );
}

export default function contribute(client: PluginClientContext) {
  const filterTitle = messages.message("filterTitle");
  client.addSettingsScreen({
    id: "models",
    title: messages.message("settingsTitle"),
    icon: "ListChecks",
    Component: ModelsScreen,
  });
  client.addScreen({ id: "filter", title: filterTitle, Component: FilterScreen });
  client.addSidebarHeaderItem({ id: "filter", title: filterTitle, Component: FilterItem });
  client.addCommandCenterItem({
    id: "filter",
    title: filterTitle,
    icon: "ListFilter",
    context: "global",
    onSelect: ({ openScreen }) => openScreen({ screenId: "filter" }),
  });
  client.addComposerItem({
    id: "filter",
    Component: makeFilterButton((provider) => client.openScreen({ screenId: "filter", params: { provider } })),
  });
  return () => {};
}
