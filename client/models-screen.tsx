import type { PluginSurfaceProps } from "@getpaseo/plugin/client";
import { useRpc, useTranslation } from "@getpaseo/plugin/client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { memo, type ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { listRpc, resetRpc, saveRpc, type ProviderModels } from "../shared/rpc";
import { messages } from "./i18n";

type Theme = PluginSurfaceProps["theme"];
type Model = ProviderModels["models"][number];

const errorText = (error: unknown) => (error instanceof Error ? error.message : String(error));

/** All providers (settings), or only `only`, opened, when reached from the chat's Filter button. */
export function ModelsScreen({ theme, layout, only }: PluginSurfaceProps & { only?: string }) {
  const { t } = useTranslation(messages);
  const list = useRpc(listRpc);
  const query = useQuery({ queryKey: ["models"], queryFn: () => list({}) });
  const styles = useMemo(() => makeStyles(theme, layout.compact), [theme, layout.compact]);
  const providers = query.data?.providers.filter((p) => !only || p.provider === only);

  return (
    <View style={styles.screen}>
      <Text style={styles.muted}>{t("intro")}</Text>
      {query.isPending && <Text style={styles.muted}>{t("loading")}</Text>}
      {query.error && <Text style={styles.error}>{errorText(query.error)}</Text>}
      {providers?.length === 0 && <Text style={styles.muted}>{t("empty")}</Text>}
      {providers?.map((p) => <ProviderCard key={p.provider} provider={p} styles={styles} startOpen={!!only} />)}
    </View>
  );
}

function ProviderCard({ provider, styles, startOpen }: { provider: ProviderModels; styles: Styles; startOpen: boolean }) {
  const { t } = useTranslation(messages);
  const queryClient = useQueryClient();
  const save = useRpc(saveRpc);
  const reset = useRpc(resetRpc);
  // Sets are replaced, never mutated, so the saved set can double as the initial state.
  const visible = useMemo(() => new Set(provider.models.filter((m) => m.visible).map((m) => m.id)), [provider]);
  const [checked, setChecked] = useState(visible);
  useEffect(() => setChecked(visible), [visible]);
  const dirty = checked.size !== visible.size || [...checked].some((id) => !visible.has(id));

  const done = () => queryClient.invalidateQueries({ queryKey: ["models"] });
  const saving = useMutation({ mutationFn: () => save({ provider: provider.provider, visibleIds: [...checked] }), onSuccess: done });
  const resetting = useMutation({ mutationFn: () => reset({ provider: provider.provider }), onSuccess: done });
  const error = saving.error ?? resetting.error;
  const busy = saving.isPending || resetting.isPending;
  const cannotSave = busy || !dirty || checked.size === 0;

  // Stable, so ticking one model re-renders one row instead of the whole list.
  const toggle = useCallback(
    (id: string) =>
      setChecked((prev) => {
        const next = new Set(prev);
        if (!next.delete(id)) next.add(id);
        return next;
      }),
    [],
  );
  const bulk = (models: Model[]) => {
    const all = models.every((m) => checked.has(m.id));
    const flip = () =>
      setChecked((prev) => {
        const next = new Set(prev);
        for (const m of models) all ? next.delete(m.id) : next.add(m.id);
        return next;
      });
    return { all, flip };
  };

  const [open, setOpen] = useState(startOpen);
  const groups = useMemo(() => groupBySource(provider.models), [provider]);
  const renderModel = (m: Model) => <ModelRow key={m.id} model={m} on={checked.has(m.id)} onToggle={toggle} styles={styles} />;

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <Toggle open={open} onPress={() => setOpen(!open)} styles={styles} label={provider.label}>
          <Text style={styles.title}>{provider.label}</Text>
          <Text style={styles.muted}>{`  ${t("shown", { shown: checked.size, total: provider.models.length })}`}</Text>
        </Toggle>
        <Bulk {...bulk(provider.models)} label={provider.label} styles={styles} />
      </View>
      {open &&
        (groups.length === 1
          ? groups[0].models.map(renderModel)
          : groups.map((g) => (
              <Group
                key={g.key}
                label={SOURCE_LABELS[g.key] ?? (g.key || t("other"))}
                styles={styles}
                count={`${g.models.filter((m) => checked.has(m.id)).length}/${g.models.length}`}
                bulk={bulk(g.models)}
              >
                {g.models.map(renderModel)}
              </Group>
            )))}
      <View style={styles.actions}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("saveHint", { provider: provider.label })}
          accessibilityState={{ disabled: cannotSave }}
          disabled={cannotSave}
          onPress={() => saving.mutate()}
          style={[styles.button, cannotSave && styles.disabled]}
        >
          <Text style={styles.buttonText}>{saving.isPending ? t("saving") : t("save")}</Text>
        </Pressable>
        {provider.filtered && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("showAllHint", { provider: provider.label })}
            accessibilityState={{ disabled: busy }}
            disabled={busy}
            onPress={() => resetting.mutate()}
            style={[styles.secondary, busy && styles.disabled]}
          >
            <Text style={styles.text}>{t("showAll")}</Text>
          </Pressable>
        )}
      </View>
      {checked.size === 0 && <Text style={styles.error}>{t("pickOne")}</Text>}
      {error && <Text style={styles.error}>{errorText(error)}</Text>}
      {saving.isSuccess && !dirty && !busy && <Text style={styles.ok}>{t("saved")}</Text>}
    </View>
  );
}

const ModelRow = memo(function ModelRow({
  model,
  on,
  onToggle,
  styles,
}: {
  model: Model;
  on: boolean;
  onToggle(id: string): void;
  styles: Styles;
}) {
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: on }}
      accessibilityLabel={model.label}
      onPress={() => onToggle(model.id)}
      style={styles.row}
    >
      <View style={[styles.box, on && styles.boxOn]}>{on && <Text style={styles.tick}>✓</Text>}</View>
      <Text style={styles.text}>
        {model.label}
        {model.description ? <Text style={styles.muted}>{`  ${model.description}`}</Text> : null}
      </Text>
    </Pressable>
  );
});

/** Same-named models from different sources (opencode/… vs opencode-go/…) only differ by id prefix. */
const SOURCE_LABELS: Record<string, string> = { opencode: "OpenCode Zen", "opencode-go": "OpenCode Go" };

function groupBySource(models: Model[]): { key: string; models: Model[] }[] {
  const groups = new Map<string, Model[]>();
  for (const m of models) {
    const key = m.id.includes("/") ? m.id.slice(0, m.id.indexOf("/")) : "";
    const group = groups.get(key);
    if (group) group.push(m);
    else groups.set(key, [m]);
  }
  return [...groups].map(([key, list]) => ({ key, models: list }));
}

function Toggle({ open, onPress, label, styles, children }: { open: boolean; onPress(): void; label: string; styles: Styles; children: ReactNode }) {
  const { t } = useTranslation(messages);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ expanded: open }}
      accessibilityLabel={t(open ? "collapse" : "expand", { label })}
      onPress={onPress}
      style={styles.header}
    >
      <Text style={styles.chevron}>{open ? "▾" : "▸"}</Text>
      {children}
    </Pressable>
  );
}

function Bulk({ all, flip, label, styles }: { all: boolean; flip(): void; label: string; styles: Styles }) {
  const { t } = useTranslation(messages);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t(all ? "uncheckAllHint" : "checkAllHint", { label })}
      onPress={flip}
      style={styles.bulk}
    >
      <Text style={styles.bulkText}>{t(all ? "uncheckAll" : "checkAll")}</Text>
    </Pressable>
  );
}

function Group({
  label,
  count,
  bulk,
  styles,
  children,
}: {
  label: string;
  count: string;
  bulk: { all: boolean; flip(): void };
  styles: Styles;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <View style={styles.group}>
      <View style={styles.headerRow}>
        <Toggle open={open} onPress={() => setOpen(!open)} label={label} styles={styles}>
          <Text style={styles.groupTitle}>{label}</Text>
          <Text style={styles.muted}>{`  ${count}`}</Text>
        </Toggle>
        <Bulk {...bulk} label={label} styles={styles} />
      </View>
      {open && <View style={styles.groupBody}>{children}</View>}
    </View>
  );
}

type Styles = ReturnType<typeof makeStyles>;

function makeStyles(theme: Theme, compact: boolean) {
  const c = theme.colors;
  return {
    screen: { padding: compact ? 16 : 24, gap: 16, backgroundColor: c.surface0 },
    card: { gap: 4, padding: 12, borderRadius: 10, borderWidth: 1, borderColor: c.border, backgroundColor: c.surface1 },
    title: { color: c.foreground, fontSize: 16, fontWeight: "600" as const },
    header: { flexDirection: "row" as const, alignItems: "center" as const, paddingVertical: 4, flexWrap: "wrap" as const, flex: 1 },
    headerRow: { flexDirection: "row" as const, alignItems: "center" as const, gap: 8 },
    bulk: { paddingVertical: 4, paddingHorizontal: 10, borderRadius: 6, borderWidth: 1, borderColor: c.border },
    bulkText: { color: c.foregroundMuted, fontSize: 12 },
    chevron: { color: c.foregroundMuted, width: 18 },
    group: { marginTop: 4 },
    groupTitle: { color: c.foreground, fontWeight: "600" as const },
    groupBody: { paddingLeft: 18 },
    text: { color: c.foreground, flexShrink: 1 },
    muted: { color: c.foregroundMuted, fontWeight: "400" as const, fontSize: 13 },
    error: { color: c.statusDanger },
    ok: { color: c.statusSuccess },
    row: { flexDirection: "row" as const, alignItems: "center" as const, gap: 10, paddingVertical: 6 },
    box: {
      width: 18,
      height: 18,
      borderRadius: 4,
      borderWidth: 1.5,
      borderColor: c.foregroundMuted,
      alignItems: "center" as const,
      justifyContent: "center" as const,
    },
    boxOn: { backgroundColor: c.accent, borderColor: c.accent },
    tick: { color: c.accentForeground, fontSize: 12, lineHeight: 14 },
    actions: { flexDirection: "row" as const, gap: 8, marginTop: 8, flexWrap: "wrap" as const },
    button: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 8, backgroundColor: c.accent },
    buttonText: { color: c.accentForeground },
    secondary: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 8, borderWidth: 1, borderColor: c.border },
    disabled: { opacity: 0.5 },
  };
}
