Model filter permet de choisir quels modèles apparaissent dans le sélecteur de modèles du chat, fournisseur par fournisseur. Des fournisseurs comme OpenCode listent des centaines de modèles ; le plugin limite le sélecteur à ceux que tu utilises vraiment.

Ouvre-le depuis la ligne Filtrer les modèles de la barre latérale, depuis le Command Center, depuis Paramètres, Plugins, puis le bouton de réglages sur la ligne Model filter, ou avec le bouton Filtrer dans la barre du chat, qui ouvre le filtre sur le fournisseur choisi dans ce chat. Chaque fournisseur actif a une carte repliable avec une case par modèle. Coche les modèles voulus, puis Enregistrer. Le changement s'applique tout de suite, sans redémarrer le démon.

Dans un même fournisseur, les modèles de sources différentes sont regroupés par préfixe d'identifiant, par exemple OpenCode Zen (`opencode/`) et OpenCode Go (`opencode-go/`), qui ont souvent les mêmes noms. Chaque fournisseur et chaque groupe a un bouton tout cocher ou tout décocher.

Il demande Paseo 0.16.0 ou plus récent et n'a besoin d'aucun compte, jeton ou outil externe. L'interface est en anglais et en français et suit la langue de l'application.

L'enregistrement écrit les modèles choisis dans `agents.providers.<fournisseur>.models` du `config.json` du démon, avec leur description et leurs niveaux de réflexion, sans toucher aux autres réglages du fournisseur. La liste complète est mémorisée dans `model-filter.json` dans le dossier Paseo, pour pouvoir recocher un modèle masqué. Tout réafficher retire le filtre et rend la liste complète du fournisseur, ou la liste `models` que tu avais écrite à la main avant de filtrer. Le plugin ne lit et n'écrit que ces deux fichiers et n'envoie rien sur le réseau.

Limites : tant qu'un fournisseur est filtré, les modèles sortis ensuite n'apparaissent qu'après Tout réafficher. Les modèles déclarés dans `additionalModels` restent toujours visibles. Le filtre vit dans `config.json` : fais Tout réafficher sur chaque fournisseur filtré avant de retirer le plugin, sinon le filtre reste en place.
