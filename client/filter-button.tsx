import type { PluginComposerItemProps } from "@getpaseo/plugin/client";
import { useComposer, useTranslation } from "@getpaseo/plugin/client";
import { Pressable, Text } from "react-native";
import { messages } from "./i18n";

/** Composer button that opens the filter on the provider selected in this chat. */
export function makeFilterButton(open: (provider: string) => void) {
  return function FilterButton({ theme }: PluginComposerItemProps) {
    const { t } = useTranslation(messages);
    const provider = useComposer().agent.provider;
    if (!provider) return null;
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t("composerHint")}
        onPress={() => open(provider)}
        style={{ paddingVertical: 4, paddingHorizontal: 8, borderRadius: 6 }}
      >
        <Text style={{ color: theme.colors.foregroundMuted, fontSize: 13 }}>{t("composerLabel")}</Text>
      </Pressable>
    );
  };
}
