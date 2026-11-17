# Model filter pour Paseo

[English](README.md) | Français

Un plugin [Paseo](https://paseo.sh) pour choisir quels modèles chaque fournisseur affiche dans le sélecteur de modèles du chat. Des fournisseurs comme OpenCode listent des centaines de modèles ; le plugin limite le sélecteur à ceux que tu utilises vraiment.

## Installer

Demande Paseo 0.16.0 ou plus récent.

1. Active les plugins une fois : **Paramètres → Plugins**, interrupteur **Enable plugins**. Un plugin est du code de confiance, sans bac à sable : lis le code avant d'en installer un.
2. Installe :

   ```bash
   paseo plugin install github:krunch-64/paseo-model-filter
   ```

3. Vérifie qu'il tourne : `paseo plugin ls` doit afficher `model-filter` en `running`.

## Utiliser

Ouvre le filtre par l'un de ces chemins :

- la ligne **Filtrer les modèles** en haut de la barre latérale ;
- le Command Center (Ctrl+K ou ⌘K), puis **Filtrer les modèles** ;
- le bouton **Filtrer** dans la barre du chat, qui ouvre le fournisseur choisi dans ce chat ;
- **Paramètres → Plugins**, puis le bouton de réglages sur la ligne Model filter.

Ensuite :

1. Ouvre la carte d'un fournisseur.
2. Coche les modèles à garder. **Tout cocher** et **Tout décocher** existent par fournisseur et par groupe de source.
3. Appuie sur **Enregistrer**. Le sélecteur change tout de suite, sans redémarrer le démon.

Les modèles décochés restent listés dans le plugin, pour pouvoir les recocher plus tard. **Tout réafficher** retire le filtre du fournisseur.

L'interface est en anglais et en français et suit la langue de l'application.

## Fonctionnement

- L'enregistrement écrit les modèles cochés dans `agents.providers.<fournisseur>.models` du `config.json` du démon. Les autres réglages du fournisseur ne sont pas touchés.
- La liste complète est gardée dans `model-filter.json` dans le dossier Paseo (`~/.paseo` par défaut) : c'est ce qui permet de garder les modèles masqués dans la liste.
- **Tout réafficher** supprime cette clé `models`, ou remet la liste que tu avais écrite à la main avant de filtrer.
- Rien n'est envoyé sur le réseau.

## Limites

- Tant qu'un fournisseur est filtré, les modèles sortis ensuite n'apparaissent qu'après **Tout réafficher**.
- Les modèles déclarés dans `additionalModels` restent toujours visibles.

## Désinstaller

Fais d'abord **Tout réafficher** sur chaque fournisseur filtré : le filtre vit dans `config.json` et resterait en place. Puis :

```bash
paseo plugin remove model-filter
```

Si le plugin est déjà retiré, supprime la clé `models` du fournisseur sous `agents.providers` dans `config.json`, puis lance `paseo reload`.

## Développer

```bash
git clone https://github.com/krunch-64/paseo-model-filter
cd paseo-model-filter
npm install
npm run typecheck
npm test
paseo plugin install "$(pwd)"   # puis `paseo plugin reload model-filter` après chaque modification
```

| Chemin | Rôle |
| --- | --- |
| `index.client.tsx`, `client/` | Côté application : écrans, ligne de barre latérale, bouton du chat, traductions (`client/strings.ts`) |
| `index.server.ts`, `server/` | Côté démon : lit les fournisseurs, écrit `config.json` et le fichier d'état |
| `shared/rpc.ts` | Les trois contrats RPC partagés par les deux côtés |
| `test/` | Tests du côté démon contre un faux démon |

Pour ajouter une langue, ajoute dans `client/strings.ts` un objet avec les mêmes clés que `en`, puis déclare-le dans `client/i18n.ts`.

## Licence

[MIT](LICENSE)
