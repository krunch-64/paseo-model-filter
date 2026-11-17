Model filter permet de choisir quels modèles apparaissent dans le sélecteur de modèles du chat, fournisseur par fournisseur. Des fournisseurs comme OpenCode listent des centaines de modèles ; le plugin limite le sélecteur à ceux que tu utilises vraiment.

Ouvre-le depuis Paramètres, Plugins, puis le bouton de réglages sur la ligne Model filter. Chaque fournisseur actif a une carte repliable avec une case par modèle. Coche les modèles voulus, puis Enregistrer. Le changement s'applique tout de suite, sans redémarrer le démon.

Dans un même fournisseur, les modèles de sources différentes sont regroupés par préfixe d'identifiant, par exemple OpenCode Zen (`opencode/`) et OpenCode Go (`opencode-go/`), qui ont souvent les mêmes noms. Chaque fournisseur et chaque groupe a un bouton tout cocher ou tout décocher.

L'enregistrement écrit les modèles choisis dans `agents.providers.<fournisseur>.models` du `config.json` du démon, avec leur description et leurs niveaux de réflexion. La liste complète est mémorisée dans `model-filter.json` dans le dossier Paseo, pour pouvoir recocher un modèle masqué. Tout réafficher retire le filtre et rend la liste complète du fournisseur.

Limites : tant qu'un fournisseur est filtré, les modèles sortis ensuite n'apparaissent qu'après Tout réafficher.
