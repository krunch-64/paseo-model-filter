import type { PluginSurfaceProps } from "@getpaseo/plugin/client";
import { useRpc } from "@getpaseo/plugin/client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { type ReactNode, useEffect, useMemo, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { listRpc, resetRpc, saveRpc, type ProviderModels } from "../shared/rpc";

type Theme = PluginSurfaceProps["theme"];

export function ModelsScreen({ theme, layout }: PluginSurfaceProps) {
  const list = useRpc(listRpc);
  const query = useQuery({ queryKey: ["models"], queryFn: () => list({}) });
  const styles = useMemo(() => makeStyles(theme, layout.compact), [theme, layout.compact]);

  return (
    <View style={styles.screen}>
      <Text style={styles.muted}>
        Coche les modèles à afficher dans le sélecteur du chat, puis enregistre. Les modèles décochés restent ici pour être
        réaffichés plus tard.
      </Text>
      {query.isPending && <Text style={styles.muted}>Chargement des fournisseurs…</Text>}
      {query.error && <Text style={styles.error}>{String(query.error.message ?? query.error)}</Text>}
      {query.data?.providers.map((p) => <ProviderCard key={p.provider} provider={p} theme={theme} styles={styles} />)}
    </View>
  );
}

function ProviderCard({ provider, theme, styles }: { provider: ProviderModels; theme: Theme; styles: Styles }) {
  const queryClient = useQueryClient();
  const save = useRpc(saveRpc);
  const reset = useRpc(resetRpc);
  const initial = () => new Set(provider.models.filter((m) => m.visible).map((m) => m.id));
  const [checked, setChecked] = useState(initial);
  useEffect(() => setChecked(initial()), [provider]);

  const done = () => queryClient.invalidateQueries({ queryKey: ["models"] });
  const saving = useMutation({ mutationFn: () => save({ provider: provider.provider, visibleIds: [...checked] }), onSuccess: done });
  const resetting = useMutation({ mutationFn: () => reset({ provider: provider.provider }), onSuccess: done });
  const error = saving.error ?? resetting.error;
  const busy = saving.isPending || resetting.isPending;

  const toggle = (id: string) =>
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
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

  const [open, setOpen] = useState(false);
  const groups = useMemo(() => groupBySource(provider.models), [provider]);
  const renderModel = (m: Model) => {
    const on = checked.has(m.id);
    return (
      <Pressable
        key={m.id}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: on }}
        accessibilityLabel={m.label}
        onPress={() => toggle(m.id)}
        style={styles.row}
      >
        <View style={[styles.box, on && { backgroundColor: theme.colors.accent, borderColor: theme.colors.accent }]}>
          {on && <Text style={styles.tick}>✓</Text>}
        </View>
        <Text style={styles.text}>
          {m.label}
          {m.description ? <Text style={styles.muted}>{`  ${m.description}`}</Text> : null}
        </Text>
      </Pressable>
    );
  };

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <Toggle open={open} onPress={() => setOpen(!open)} styles={styles} label={provider.label}>
          <Text style={styles.title}>{provider.label}</Text>
          <Text style={styles.muted}>{`  ${checked.size}/${provider.models.length} affichés`}</Text>
        </Toggle>
        <Bulk {...bulk(provider.models)} label={provider.label} styles={styles} />
      </View>
      {open &&
        (groups.length === 1
          ? groups[0].models.map(renderModel)
          : groups.map((g) => (
              <Group
                key={g.key}
                label={g.label}
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
          accessibilityLabel={`Enregistrer les modèles de ${provider.label}`}
          disabled={busy || checked.size === 0}
          onPress={() => saving.mutate()}
          style={[styles.button, (busy || checked.size === 0) && styles.disabled]}
        >
          <Text style={styles.buttonText}>{saving.isPending ? "Enregistrement…" : "Enregistrer"}</Text>
        </Pressable>
        {provider.filtered && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Réafficher tous les modèles de ${provider.label}`}
            disabled={busy}
            onPress={() => resetting.mutate()}
            style={[styles.secondary, busy && styles.disabled]}
          >
            <Text style={styles.text}>Tout réafficher</Text>
          </Pressable>
        )}
      </View>
      {checked.size === 0 && <Text style={styles.error}>Coche au moins un modèle.</Text>}
      {error && <Text style={styles.error}>{String((error as Error).message ?? error)}</Text>}
      {saving.isSuccess && !busy && <Text style={styles.ok}>Enregistré.</Text>}
    </View>
  );
}

type Model = ProviderModels["models"][number];

/** Same-named models from different sources (opencode/… vs opencode-go/…) only differ by id prefix. */
const SOURCE_LABELS: Record<string, string> = { opencode: "OpenCode Zen", "opencode-go": "OpenCode Go" };

function groupBySource(models: Model[]): { key: string; label: string; models: Model[] }[] {
  const groups = new Map<string, Model[]>();
  for (const m of models) {
    const key = m.id.includes("/") ? m.id.slice(0, m.id.indexOf("/")) : "";
    groups.set(key, [...(groups.get(key) ?? []), m]);
  }
  return [...groups].map(([key, list]) => ({ key, label: SOURCE_LABELS[key] ?? (key || "Autres"), models: list }));
}

function Toggle({ open, onPress, label, styles, children }: { open: boolean; onPress(): void; label: string; styles: Styles; children: ReactNode }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ expanded: open }}
      accessibilityLabel={`${open ? "Masquer" : "Afficher"} les modèles de ${label}`}
      onPress={onPress}
      style={styles.header}
    >
      <Text style={styles.chevron}>{open ? "▾" : "▸"}</Text>
      {children}
    </Pressable>
  );
}

function Bulk({ all, flip, label, styles }: { all: boolean; flip(): void; label: string; styles: Styles }) {
  const text = all ? "Tout décocher" : "Tout cocher";
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`${text} : ${label}`} onPress={flip} style={styles.bulk}>
      <Text style={styles.bulkText}>{text}</Text>
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
    tick: { color: c.accentForeground, fontSize: 12, lineHeight: 14 },
    actions: { flexDirection: "row" as const, gap: 8, marginTop: 8, flexWrap: "wrap" as const },
    button: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 8, backgroundColor: c.accent },
    buttonText: { color: c.accentForeground },
    secondary: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 8, borderWidth: 1, borderColor: c.border },
    disabled: { opacity: 0.5 },
  };
}
