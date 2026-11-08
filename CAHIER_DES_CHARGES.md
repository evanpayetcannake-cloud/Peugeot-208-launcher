# Cahier des charges — Launcher Peugeot 208 1.6 BlueHDi 75

## 0 octies. Notifications (sombre / clair)
- Bannières, toasts et centre de notifications utilisent des variables dédiées `--nf-*` (fix208.css) : fond opaque + texte contrasté dans chaque mode (sombre : #262a33 / texte clair ; clair : blanc / texte #15181d).
- Icônes de niveau : rouge (critique), orange (alerte), bleu (info), vert (appli).
- Bords arrondis : panneau de notifications (coins gauches) et heures météo ; en clair, voile blanc léger (au lieu du voile noir) derrière le panneau.
- Multi-écran (clair) : fond carré du panneau supprimé, volets arrondis (clip), barre de navigation de la carte claire et lisible (plus de bande noire).
- Fond d’écran : retour à la photo d’origine de la 208 (sans retouche ni rétrécissement), seule la plaque est remplacée (EQ-323-QW, calée dans le cadre d’origine). Bascule unique wpRev 3.
- Plaque du fond d’écran (version précédente) : plaque FR propre EQ-323-QW (blanc net, caractères condensés, sans grain). Compteur de vitesse abaissé de 1,15 rem pour la laisser visible.
- Correctif : le fond intégré n’est plus figé dans les réglages sauvegardés (une ancienne image restait affichée après mise à jour).
- Bascule unique (wpRev 2) vers le nouveau fond, même si une ancienne photo avait été choisie ; compteur calé sous la plaque pour tout format d’écran (testé 1914×902, 1280×720, 1280×624, 1024×600).
- Hors poste Android, le pont natif affiche des messages français (« Android Auto : s'ouvre sur le poste Android ») au lieu de `Native.launch(...)`.

## 0 septies. Fond d'accueil par défaut
Photo de la 208 blanche fournie par le propriétaire, retouchée : voiture ~7 % moins large (déformation horizontale douce, décor des bords qui compense, pas de coupure), ombres relevées, contraste doux, netteté + clarté, léger vignettage. Fichier `assets/wallpapers/208-eq323qw.webp` (1920×1080, 426 Ko), listé dans `list.json`, réglage par défaut `wallpaper: 'f:assets/wallpapers/208-eq323qw.webp'`.
Lisibilité : fond assombri (vignettage) en sombre, éclairci en clair ; voile renforcé derrière le lecteur / widgets du centre seulement quand une photo est en fond.
Script de retouche : hors projet (Python/numpy), refaisable sur une autre photo.

## 0 sexies. Autoradio cible
Test place réduite (barres Android visibles) : 1280×672, 1216×720, 1280×624 → 0 erreur, rien de coupé ni hors écran.
 (fiche fournie le 6 nov. 2026)
TS10 « L4 » version A, spécial Peugeot 208 / 2008 (2012-2018), 8 cœurs, 8 Go RAM + 128 Go, écran QLED **1280×720**, Android 16 annoncé, Wi-Fi, CarPlay et Android Auto sans fil (appli intégrée au poste), GPS, FM+AM, commandes au volant, caméra de recul AHD 170° (vision de nuit), ventilateur intégré.

Conséquences pour le launcher :
- 1280×720 = la résolution de référence du prototype : aucune mise à l'échelle.
- 8 cœurs / 8 Go : le mode Optimisation « Auto » ne s'activera pas sur le matériel, seulement si l'écran saccade réellement.
- Version d'Android : sur ces postes, la version affichée est souvent différente de la vraie. Vérifier dans Réglages Android > À propos avant de compiler l'APK (viser minSdk 29 / Android 10 pour être tranquille).
- Caméra AHD : la marche arrière est gérée par le poste (son appli caméra passe au premier plan). Le launcher garde les arcs radar, sans ouvrir de caméra lui-même.
- CarPlay / Android Auto sans fil : appli du poste, nom de paquet à relever avec la liste des applis (`onApps`) pour brancher les boutons.
- Commandes au volant : gérées par le poste ; le lecteur suit via MediaSession.
- Radio : le poste a aussi l'AM. Le launcher n'affiche que la FM pour l'instant.
- Données voiture (portes, phares, radars, vitesse) : par le boîtier CAN fourni avec la version A, via l'appli système du poste. À identifier avec « Observer 60 s » sur la vraie voiture.

## 0 quinquies. Mode optimisation (Préférences, 1re ligne)
- **Auto** (par défaut) : s'active tout seul si le poste est peu puissant (≤ 4 cœurs et ≤ 2 Go de mémoire) ou s'il a du mal : fluidité mesurée ~0,6 s après chaque changement de page (3 fois sous 32 images/s ou image bloquée > 120 ms) ou 6 blocages longs (> 120 ms). Message affiché quand il s'active. Aucune mesure en continu.
- **Activé** : pas d'effet verre (flou / Liquid Glass), animations réduites, transitions courtes, pas d'ombres, de halos ni de rayonnement au démarrage. Les données s'affichent toujours sans délai.
- **Désactivé** : tous les effets, même si le poste a du mal.
- Testé : processeur normal → reste désactivé ; processeur ralenti 20 fois → s'active tout seul (« blocages longs »), 0 erreur.
- Code : `Optim`, `optimOn()`, `optimSample()` dans `js/app.js` ; styles `:root[data-lite="1"]` dans `css/fix208.css`.

## 0 ter. Chasse aux bugs + optimisation (6 nov. 2026)
Méthode : 8 écrans × clair/sombre × 4 tailles (1280×720, 1024×600, 1920×720, 800×480) : erreurs JS, éléments hors écran, textes qui débordent, icônes manquantes, IDs en double ; puis 900 appuis au hasard sur tous les boutons.
Résultat : 0 erreur JS, 0 élément hors écran, 0 icône manquante, 0 ID en double.

| Bug / optimisation | Correction |
|---|---|
| **Bug caché** : un titre, un artiste, un texte RDS, un nom d'appareil Bluetooth ou d'appli contenant `<` ou `&` était interprété comme du code (affichage cassé, voire injection) | Tous ces textes sont échappés (`esc()` dans `js/app.js`) |
| Moniteur moteur : redessinait l'écran 60 fois/s en permanence dès qu'il était visible, même sans nouvelle donnée | Affichage à la demande : on redessine à l'image suivante quand une valeur arrive (aucun délai ajouté), boucle continue seulement pendant un chrono. Au repos : 0 image/s |
| `js/look.js` : vérifiait les réglages toutes les 400 ms | Réagit à l'événement `m6settings` envoyé par `applySettings()` |
| Page Applis : reconstruite à chaque ouverture | Reconstruite seulement si la liste change ; icônes Android en chargement différé (`loading=lazy`) |

## 0 quater. Page Applis
Disposition : grille simple d'origine, 7 applis par ligne, centrée, sans rubriques (choix du propriétaire) ; 28 applis = 4 lignes, tient sans défilement en 1280×720 et 1280×672. Les applis Android en plus (`onApps`) s'ajoutent à la fin. Noms trop longs coupés avec « … ».
Icônes en couleur (dégradé propre à chaque appli) ou unies : Préférences > « Icônes de la page Applis ».
Nouvelles applis : Radio FM (ouvre Média sur la radio), Bluetooth (réglages Android), Contacts, Agenda, Météo, Calculatrice (pictogrammes génériques).
Logos de marques : aucun nouveau logo de marque dessiné ; sur le poste, les vraies icônes des applis installées arrivent par `onApps` (champ `icon`) et remplacent les pictogrammes.
Pas encore fait : dossiers personnalisables dans la page Applis.

## 0 bis. Corrections du 6 nov. 2026 (lot 2)
| # | Correction | Où |
|---|---|---|
| 1 | Verre (Flou / Liquid Glass) en mode clair : fond pastel derrière (rose, bleu, menthe, pêche) et cartes plus transparentes, le verre se voit | `css/fix208.css` §1 |
| 2 | Menu SIM opaque, lisible en clair et en sombre, boutons actifs en bleu avec halo | §2 |
| 3 | Lecteur central de l'accueil plus petit et centré (pochette 4,4 rem + titre, progression, commandes). Préférences : « Volume sur le lecteur de l'accueil » et « Commandes avancées du lecteur » (aléatoire, répétition, source, « À suivre ») | `js/app.js` homePlayerHTML, §3 |
| 4 | Barre de progression : hauteur fixe (jamais écrasée), visible en clair ; toutes les barres avancent (avant : seule la première) | §4 + splitTick |
| 5 | Îlot média : rien ne peut déborder ; correction d'un bug qui cachait l'îlot sur toutes les pages dès que le lecteur central était actif. (Il n'y avait pas de barre de volume dans la carte média de cette version : rien à retirer.) | `css/np.css`, §5 |
| 6 | Radar : vraie silhouette 2D de la 208 vue du dessus (roues, vitres, toit, rétros, feux), adaptée clair/sombre | `js/extras.js`, §6 |
| 7 | Mode clair corrigé : Entretien (icônes, tuiles, barres), Moniteur moteur (bouton de page, cadrans), Diagnostic (journal), fenêtres de saisie | §7 |
| 8 | Entretien : ajouter, renommer, supprimer (entretiens de base rétablissables), note par entretien, « Mes notes » libres, « À surveiller » écrit à la main ou automatique | `js/maint.js` |
| 9 | Animation de démarrage : style Auto / Sombre / Clair (Préférences). Ne touche pas la vidéo perso | `js/shell.js`, §9 |
| 10 | Une seule source audio : lancer la radio met le lecteur en pause, lancer la lecture coupe la radio | `js/app.js` radioOff / mediaOff |
| 11 | En haut à gauche de l'accueil : Heure, Vitesse, Autonomie, Météo ou Rien (Préférences ou appui long). Si l'heure est en grand au centre, celle du haut s'efface en fondu | `js/app.js` renderTL, §11 |
| 12 | Plus de recherche des photos de la voiture (`assets/car-*.webp`) au démarrage : plus d'erreurs de fichiers manquants | `js/app.js` initPhotos |
| + | Démarrage : textes un peu plus rapides (1,5 s, écart 0,25 s), lion qui monte légèrement avec halo qui s'ouvre, durée totale 5,8 s | `css/boot208.css` |
| + | Démarrage : léger rayonnement bleuté sur tout le fond (apparaît en 2,4 s puis respire lentement), plus doux en style clair | `css/boot208.css` .bamb |
| + | Démarrage : disparition plus rapide (trait, halo et lion partent en 0,4-0,7 s dès 4,1 s), accueil en fondu de 0,8 s : l'accueil arrive à 4,55 s. Trait de lumière redessiné : cœur fin bleu → blanc, lueur bleue dessous, point lumineux central qui respire | `css/boot208.css` (fin), `js/shell.js` |
| + | Révision « Source audio » : fenêtre opaque, source active surlignée en bleu avec coche ronde, sources indisponibles atténuées, badge « En lecture » / « Disponible » (avant « Sourdine »), lisible en mode clair (icônes sombres sur tuiles claires). Révision page Média : boutons précédent/suivant en cercles, lecture en blanc (noir en mode clair), aléatoire et répétition ajoutés, pochette plus grande qui « respire » à la lecture, temps alignés, « À suivre » masqué s'il n'y a pas de piste suivante, tuiles lisibles en clair | `js/app.js`, `css/fix208.css` (fin) |
| + | Démarrage : trait de lumière redessiné couleur argent chromé comme le lion (gris acier → blanc, lueur argentée dessous, point lumineux central qui respire) ; disparition accélérée (≈ 0,7 s), accueil après 4,75 s, fondu enchaîné 0,8 s | `css/boot208.css` (fin), `js/shell.js`, `css/shell.css` |
| + | Démarrage épuré : plus aucun texte (« PEUGEOT », « 208 », « PERFORMANCE » retirés) ; il reste le lion (18 rem) et le trait de lumière (26 rem), recentrés à l'écran | `index.html`, `css/boot208.css` (fin) |
| + | Démarrage : disparition « rideau » : les 3 textes s'effacent un par un en remontant (PERFORMANCE → 208 → PEUGEOT) avec leur halo, la ligne de lumière se replie, le halo du lion s'ouvre et le lion avance en s'effaçant, le rayonnement s'éteint ; l'accueil apparaît en fondu enchaîné (1,1 s) pendant que le lion part. Durée avant l'accueil : 5,45 s | `css/boot208.css` (fin), `js/shell.js`, `css/shell.css` |
| + | Lecteur de l'accueil : boutons un peu plus gros | `css/fix208.css` |
| + | Accueil : voile de verre très léger derrière le lecteur et les widgets du centre (heure, vitesse, moteur, météo) pour les détacher du fond d'écran. Effet verre désactivé = voile teinté sans flou ; Flou / Liquid Glass = flou 14 px | `css/fix208.css` (fin) |
| + | Le compteur de vitesse de l'accueil ne reste plus affiché sur les autres pages | `js/app.js` go() |

Nouveau contrat natif : `Android.setVolume(0-100)`, `Android.media('shuffle:0|1')`, `Android.media('repeat:0|1|2')` ; quand la lecture démarre, `Android.radio('mute')`.

## 0. Version Peugeot 208 (6 nov. 2026) — adaptation depuis la Mazda 6
Véhicule (confirmé par le propriétaire) : Peugeot 208 phase 2 de 2017, 1.6 BlueHDi 75 ch, gazole, Euro 6b, Crit'Air 2, BVM5, 230 Nm, 0-100 en 13,3 s, 171 km/h. **5 portes** supposé (à corriger si 3 portes).
Données d'origine utilisées (fiches techniques publiques) : 75 ch à 3500 tr/min, 230 Nm à 1750 tr/min, 1065 kg à vide, réservoir 50 L, 0-100 en 13,3 s, 171 km/h.

| Élément | Avant (Mazda 6) | Maintenant (208) |
|---|---|---|
| Nom / barre du haut | Logo Mazdaspeed (SVG) | Texte « PEUGEOT 208 » ; `assets/logo.png` affiché automatiquement si tu l'ajoutes |
| Démarrage | Logo Mazdaspeed | « PEUGEOT 208 » en texte + balayage lumineux |
| Accent « Auto » | Rouge | Bleu |
| Puissance / couple par défaut | 215 ch / 460 Nm | 75 ch / 230 Nm (réglables : 50-200 ch, 100-600 Nm) |
| Courbe moteur | 2.2 MZR-CD | Estimation 1.6 BlueHDi 75 : plateau 230 Nm 1750-2000 tr/min, 75 ch vers 3300-3500 |
| Masse / réservoir / conso moyenne | 1500 kg / 64 L / 6,4 | 1140 kg (conducteur compris) / 50 L / 4,6 L/100 |
| Simulation | 6 rapports, rupteur ~4650 | 5 rapports (BVM5), passage ~4300 tr/min ; 0-100 simulé ≈ 12 s (réel 13,3 s) |
| Seuils d'alerte | turbo 2,0 bar | turbo 1,6 bar ; eau 105 °C ; EGT 750 °C |
| Vue du dessus (ouvrants) | Berline + coffre | Citadine compacte 5 portes + **hayon** ; radars avec silhouette raccourcie |
| Entretien | 8 postes | 9 postes, dont filtre à gazole (60 000 km / 4 ans) et **courroie de distribution** (180 000 km / 10 ans, indicatif) ; vidange 20 000 km / 1 an |
| Nom du module | « Moniteur moteur » | « Moniteur moteur » |
| Réglages enregistrés | clé `m6.settings` | clé `p208.settings` (repart des valeurs 208, pas des réglages Mazda) |

| Police du nom (haut + démarrage) | Inter | **Poppins italique** (licence OFL, libre), réduite aux lettres utiles : 2 fichiers de ~2,7 Ko dans `assets/fonts/` |
| Animation de démarrage | Logo Mazdaspeed + balayage | Version **luxe** (~6,4 s), calme et monochrome : le lion (`assets/logo.webp`, image du propriétaire) sort lentement du noir avec un halo discret ; reflet chromé blanc à sa forme ; fine ligne de lumière qui s'ouvre depuis le centre ; textes en 3 blocs (« PEUGEOT », « 208 » en Inter Display très fine, « PERFORMANCE » argent-bleu) qui apparaissent tous avec le **même mouvement** (montée douce depuis une fente invisible, 1,9 s, même courbe, écart régulier de 0,35 s), chacun sur son propre calque (fluide), avec un **rayonnement bleu léger** (lueur fixe autour des lettres + halo bleu qui respire et glisse doucement derrière chaque bloc, au même rythme pour les 3) ; zoom lent sur le lion seulement ; sortie en fondu simple. Ni impact, ni secousse, ni rayons. `css/boot208.css`, transform/opacity uniquement |
| Titre en haut de l'accueil | Logo Mazdaspeed | Lion + « PEUGEOT **208** » + bandes bleues + « PERFORMANCE » (bleu accent), Poppins italique, entrée animée une seule fois (pas d'animation en boucle) |

Logo : l'image du lion fournie par le propriétaire est dans `assets/logo.webp` (barre du haut + démarrage). Pour la changer, remplace ce fichier (même nom, fond transparent).
- usage personnel dans sa voiture uniquement : ne pas redistribuer l'appli avec ce logo ;
- vidéo mp4 (Réglages > Écran > Vidéo de démarrage, ou `assets/boot.mp4`) → remplace l'animation (touche l'écran pour la passer).

Intervalles d'entretien : indicatifs, à vérifier dans le carnet d'entretien de TA voiture (ils changent selon l'année et l'usage).
Non testé sans la vraie voiture : signaux CAN de la 208 (portes, hayon, phares, radars), lecture OBD2 (pression rail, FAP), tuner radio du poste.


## 1. Écrans
Accueil (voiture, horloge, météo, cartes, dock) · Véhicule · Apps (applis Android réelles via `onApps`, dont Play Store) · Multi-écran · **Moniteur moteur** · Réglages (engrenage en haut à droite) · Diagnostic CAN.
Dock : Média · Multi-écran · Moniteur moteur · Véhicule · Apps. Le launcher est la surcouche Android ; CarPlay et Android Auto sont des applis (grille Apps) et la carte Téléphone de l'accueil propose celle qui correspond au téléphone connecté (iPhone → CarPlay, Android → Android Auto), avec animation à la connexion et à la déconnexion.
Rien de « technique » sur l'accueil : phares forcés et photos sont dans Réglages > Écran.

## 2. Règles
- Signal absent = « Indisponible » (jamais de faux chiffres hors mode démo).
- Perf : transform/opacity seulement, pas de flou, mises à jour regroupées en rAF, timers actifs seulement quand l'écran est visible.
- Jour/nuit selon les phares (repli horaire).

## 3. Moniteur moteur
Jauges configurables (boost = MAP − baro, régime, vitesse, liquide, admission, rail, charge, EGT, huile, batterie) avec pics ; chronos 0-100 / 80-120 / 100-200 ; liste des capteurs + dispo ; journal REC 5 Hz + export CSV ; seuils d'alerte ; conseil turbo (≈60 s après gros appel).
Limite : huile et EGT = capteurs externes dans la plupart des cas (OBD ne les expose pas).

## 4. Événements voiture
| Événement | Comportement |
|---|---|
| Porte/coffre/capot s'ouvre (accueil) | Carte animée 3,5 s (porte qui pivote, plafonnier), puis pastille tant que c'est ouvert |
| Ouvrant ouvert en roulant (>5 km/h) | Même carte en rouge, « véhicule en mouvement » |
| Marche arrière | Vue recul : caméra du poste + arcs radar |
| Radar arrière/avant (niveau 1-4) | Arcs animés (vert→rouge), pulsation selon distance, bip optionnel |
| Surchauffe / surpression / batterie / carburant bas | Bandeau d'alerte sur tous les écrans |
| Téléphone connecté | Pastille verte sur le bouton Projection, nom Android Auto / CarPlay |
| Rien en Bluetooth/AUX | Radio FM du poste dans le volet musique (sélecteur Auto / Bluetooth / Radio) |

## 5. Scénarios de test (panneau SIM > Scénarios)
Porte conducteur · 2 portes + coffre · Porte ouverte en roulant · Recul + radars 1→4 · Radar avant · Surchauffe + surpression · Téléphone connecté.

## 6. Contrat natif (Android)
JS→natif : `Android.launch(id)`, `radio(cmd)`, `source(s)`, `listApps()`, `media(cmd)`, `copy(txt)`, `setBrightness(p)`, `openSettings(w)`.
Natif→JS : `onCarState(json)`, `onRawEvent(name,val,src)`, `onMedia(json)`, `onRadio(json)`, `onApps(json)`.
Nouveaux signaux : `radarRear`, `radarFront` (0-4), `projection` ('android_auto'|'carplay'|null), `mapKpa`, `baroKpa`, `iatC`, `loadPct`, `railBar`, `egtC`, `oilC`, `oilBar`.
Radio : pas d'API Android standard → relayer le tuner du poste (MCU/constructeur) ou lancer son appli radio.

## 7. Mise à jour (design Apple, média, Moniteur moteur v2)
- Design : sobre, aucun élément au centre de l'accueil ; alertes moteur en petite pastille dans la barre du haut ; porte ouverte = tuile sous les infos (porte qui pivote).
- Média : une seule entrée « Source » (Radio, Bluetooth, USB, AUX). Radio : favoris (appui long pour remplacer), liste de stations, recherche, curseur d'accord.
- Moniteur moteur (inspiré du R.S. Monitor 2.0 Renault Sport) : cadrans, chronos, courbe puissance/couple estimée (ref. origine 180 ch/400 Nm), force G, tours, journal CSV. Fonctions de performance désactivées par défaut (Réglages > Véhicule ou Moniteur moteur).
- Signaux ajoutés : `phone` ('ios'|'android'|null), `phoneName`, `throttlePct`, `gLat`. Natif→JS : `onSources({bt:{on,name},usb:{on},aux:{on}})`.
- Voiture : dessin vectoriel de la face avant ; tes photos (Réglages > Écran ou `assets/car-*.webp`) la remplacent.

## 8. Révision v4
- Alertes : bannière affichée une seule fois (4,5 s, centrée en haut), puis rangée dans le centre de notifications (cloche en haut à droite, pastille de compteur). Une alerte ne revient que si la condition disparaît 15 s puis réapparaît. « Ne pas déranger » coupe les bannières.
- Centre de notifications : Wi-Fi, Bluetooth, Ne pas déranger, Réglages, luminosité, liste (natif : `onNotifications(json)`, `Android.openNotification/dismissNotification/clearNotifications/toggle`).
- Mode nuit éclairci (fond, cartes, voiture).
- Moniteur moteur : 3 pages (Moteur, Performance, Puissance), cadrans ronds ; chrono à états idle → armé → en cours → terminé ; seuils, enregistrement CSV, capteurs, pics déplacés dans Réglages > Moniteur moteur.
- Démarrage : `#boot` joue `assets/boot.mp4` ou la vidéo choisie dans Réglages > Écran ; sinon animation typographique neutre. Toucher = passer.
- Photo réelle : `assets/hero-day.webp`, `hero-night.webp`, `car-3q.webp` (source 588×330, à remplacer par une image plus grande).
- Apps : toutes les applications Android (réglages d’Android Auto compris) sont regroupées dans l’écran Apps.

## 9. Révision v5
- Courbe de puissance : modèle de la voiture (pas de mesure en roulant). Réglable dans Réglages > Moniteur moteur (puissance, couple). Référence d'origine 180 ch / 400 Nm en pointillés. Toucher la courbe lit une valeur.
- Média : en-tête refait (Source, Navigation, Écran partagé, Associer un téléphone si aucun téléphone). Radio : cadran gradué, pas de 0,1 MHz, ST / AF / TA, signal, RDS (nom + texte), favoris, liste.
- Sans téléphone : le bouton Navigation ouvre l'application choisie (Réglages > Navigation) ; le poste utilise sa carte SIM ou le partage de connexion.
- Natif : `onRadio({freq,on,rds,rdsText,st,sig,ta,af,stations})`, `Android.radio('af:on'|'ta:on'|'tune:x'|'seek:next'|'scan'...)`.

## 10. Révision v6
- Écran partagé : en-tête de volet (icône, nom, « Changer »), média compact (source, fréquence ou titre, commandes, favoris), volet navigation avec bouton « Ouvrir ».
- Choix d'application : bouton Retour, applications rangées par groupes (Navigation, Musique et vidéo, Voiture, Téléphone, Autres), repère Gauche / Droite sur les applis déjà choisies.
- Feuille de source : 4 lignes avec état (en écoute, connecté, non connecté) et infos (fréquence, appareil, morceau).
- Lecteur Bluetooth / USB : pochette, titre, progression, appareil, état. États vides avec étapes (Bluetooth, USB, AUX).

## 11. v8
- Moniteur moteur refait en "Bargraphes" (style R.S. Monitor, cyan→bleu, rouge si seuil dépassé) : Couple, Puissance (estimés courbe × charge), Pression turbo, T° huile/eau, T° admission, Pédale ; repère de crête blanc (toucher = reset) ; flèches latérales, barre ← / pastille de page / + (réglages).
- Icône Moniteur moteur du dock en blanc (visible).
- Raccourcis Appeler / Messages en bas à gauche de l'accueil ; app Messages ajoutée dans Apps.
- Boot : logo Mazdaspeed (assets/mazdaspeed.png) en fondu d'ouverture si pas de vidéo boot.mp4.

## 12. v9 — Voiture 3D
- Modèle fourni (Mazda_6_Sedan_2011.glb, 1,2 M triangles) rendu hors-ligne en 36 vues jour + 36 vues nuit (assets/car/d00-d35, n00-n35, webp 900 px, ~2,6 Mo au total), peinture blanche, plaque neutralisée.
- js/car3d.js : plateau tournant, glisser pour tourner, double-tap = retour vue 3/4. Aucun coût GPU.
- Boot : logo seul + balayage lumineux ; masse 1500 kg (pas de 50), 220 ch (pas de 5).

## 13. v10
- Voiture : phares + antibrouillards allumés et veilleuses jaunes sur les vues nuit (phares allumés = mode nuit), jantes noires, becquet de coffre discret, ombre portée, peinture blanche.
- Accueil : logo Mazdaspeed à la place du nom ; boot : révélation gauche→droite + halo + balayage.
- Carburant → Autonomie (toucher : conso instantanée → conso moyenne). Réservoir 64 L, débit estimé si le calculateur ne le donne pas.
- Météo réelle Open-Meteo (Saint-Joseph / Saint-Pierre, bouton sur la carte, rafraîchie toutes les 20 min).
- v10b : becquet, veilleuses et reflet retirés (ombre simple), jantes noires opaques, sous-titre moteur retiré de l'accueil.

## 14. v11
- Nouveau jeu d'icônes (traits propres, dégradés Apple-like) ; vraies icônes d'apps fournies par Android via `window.onApps` sur l'autoradio.
- Police Inter embarquée (Inter + Inter Display pour horloge/chiffres).
- Onglet Entretien : kilométrage (saisie clavier), vidange, filtres, freins, pneus, CT ; échéances km + mois, statut ok/bientôt/retard, bouton « Fait », édition ; ligne d'alerte sur l'accueil.
- Voiture : emblème d'origine argenté, plaque française BT-962-GV, rendu 1800 px (72 images jour/nuit), jantes noires, phares la nuit.

## 15. v12
- Voiture : bugs de rendu corrigés (côtés transparents, vitres absentes, disques/échappement transparents), étriers rouges, feux AV/AR allumés la nuit directement sur la géométrie, ombre retirée du rendu (ombre CSS propre), image recentrée sur chaque angle.
- Design : palette graphite + rouge Mazda, fond dégradé propre, icônes pleines unies (Material Design Icons + Simple Icons pour les logos d'apps), tuiles toutes identiques.
- Dock : Véhicule remplacé par Entretien (Véhicule reste dans Apps).
- Logo Mazdaspeed vectorisé (SVG net, centré) pour l'accueil et l'animation de démarrage.

## 16. v13
- Cible écran réelle : 1280×720 (9", Android 8 cœurs, 4 Go + 64 Go, CarPlay/Android Auto sans fil, caméra AHD 170°).
- Logo Mazda en argent, phares détaillés (réflecteur + bloom de nuit), habitacle visible, arêtes de carrosserie marquées.
- Plaque d'immatriculation : texte réduit et recentré. Aileron retiré.
- Images voiture : 72 frames webp 1100 px, préchargement progressif (requestIdleCallback corrigé).

## 17. v14
- Accueil : carte « Lecture en cours » en bas à droite (source, titre, précédent / pause / suivant, barre de progression, fermeture animée). La musique continue quand on revient à l'accueil.
- Tuile « porte ouverte » repositionnée sous la carte d'infos (plus de chevauchement).
- css/np.css ajouté (il manquait, le widget ne s'affichait pas). Images voiture 1400 px.

## 18. v15
- Voiture : arêtes plus fines et discrètes, ombre portée qui suit les roues (intégrée aux images), vitres teintées (masque de vitres rendu à part, phares exclus), netteté accrue.
- Fond : mur + sol avec horizon pour que la voiture soit posée ; ancienne ombre CSS retirée.
- Carte d'activité en bas à droite de l'accueil : appel en cours (nom, durée, micro, raccrocher) prioritaire, sinon musique/radio. Pont natif : window.onCall({active,name,muted}) ; Android.call('hangup'|'mute').

## 19. v16
- Vitres (latérales, arrière, pare-brise) très teintées via masque dédié ; feux avant/arrière détaillés et allumés en permanence (jour et nuit) avec halo.
- Accueil bas-droite : carte multimédia uniquement si une lecture est en cours, sinon rien (appel retiré).
- Moniteur moteur : palette graphite/argent (plus de bleu), css/v8.css.

## 20. v17
- Voiture : toit ouvrant rectangulaire (cadre + verre), échappement double refait (tubes, silencieux ovales, embouts ovales), feux arrière en matrice de LED, sièges mats sombres, plaque d'après un vrai modèle (bandes bleues, étoiles, F, emblème + 974, lettres hautes et grasses).
- Logo Mazdaspeed : revectorisé fidèlement d'après l'image fournie (accueil + démarrage), dégradé argent.
- Îlot multimédia (barre du haut) hors accueil : visible dès qu'un média existe, reste en pause, fermable avec animation (js renderIsland, css/island.css).

## 21. v18
- Îlot multimédia : plus petit (23 rem), centré (box-sizing), gris neutre, barre de progression fine et uniforme intégrée sous le titre (plus de rouge).
- Carte multimédia d'accueil : plus haute, pochette grise, barre neutre, ligne « À suivre » (Media.next, envoyé via onMedia({next:'…'})). Vue Média : bloc « À suivre ».
- Conso instantanée uniquement en L/100 km ; « – – » à l'arrêt (< 8 km/h), comme les calculateurs d'origine.
- Réglage Véhicule > « Vitesse sur l'accueil » (S.showSpeed) : compteur km/h + conso L/100 incrustés sous la voiture (#hud, css/np.css).
- Voiture : échappement = lignes droites double sortie sans silencieux, embouts chrome ronds dans le diffuseur, tubes gris ; toit ouvrant horizontal et plus petit ; feux arrière avec lentille intérieure lissée et LED en segments.

## 22. v19
- Échappement : sorties décalées vers l'extérieur (x ±58,5) et un peu plus sorties ; carte média d'accueil élargie (18,4 rem), dock resserré.
- Radio : favoris modifiables (bouton « Modifier » ou appui long) → feuille avec renommer (clavier Android), remplacer par la station actuelle, retirer. Noms dans S.favNames.
- Démarrage : le logo est affiché dès le chargement (plus de site visible avant), animation ~3,8 s, puis fondu de 0,9 s sur le launcher.
- Animation téléphone connecté/déconnecté refaite (apparition douce + anneau blanc, icône argent, plus de vert/rouge ni de secousse).
- Menu de test (SIM) : sliders vitesse/régime/charge, média (piste suivante, radio, source), thème, compteur, rejouer démarrage, notification, alerte, aller à une vue ; nouveaux scénarios (musique, démarrage, notif, batterie, accélération).

## 23. v20
- Plateau rond sous la voiture (CSS, aucun reflet sur la carrosserie) ; voiture un peu plus petite (hero 46 rem). Réglages Écran : « Plateau sous la voiture » (affiché/masqué) et « Rotation automatique » (tour complet en ~36 s, plateau fixe ; glisser le doigt met en pause 5 s).
- 72 vues de la voiture (pas de 5°, mêmes modèles/rendus) recentrées sur l'axe du plateau (crop fixe, pivot connu : x 50 %, y 66,5 % du sprite) ; fondu bref entre deux vues pour une rotation fluide.
- Carte média d'accueil raccourcie (17,2 rem).

## 24. v21
- Rotation auto : vidéo WebM VP9 transparente (interpolation de mouvement entre les 72 vues, 36 s/tour, `assets/car/rot_d.webm` / `rot_n.webm`) ; les vues fixes restent pour le glisser. Retour à l'accueil : la voiture revient de face (animation) si la rotation est désactivée.
- Plateau : toujours affiché si rotation active ; option Oui/Non seulement si rotation désactivée.
- Île dynamique : n'apparaît plus tant qu'aucun son n'a été joué (`Media.touched`).
- Préférences : source à l'ouverture de Média, radio FM auto, média au retour à l'accueil (continue/pause), son des notifications, Ne pas déranger, vue au démarrage, retour auto à l'accueil (1/3 min).
- Système : Éteindre / Redémarrer (confirmation ; `Android.power('off'|'reboot')` à implémenter côté natif).
- Fond plus clair (gris plus blanc). Anneau d'animation téléphone recentré (`.pring`).
- Batterie du téléphone (`phoneBatt`, hook `Car.update({phoneBatt:%})`) affichée seulement si connue.
- Notification tension basse (alternateur/batterie) + bip de notification (WebAudio). Badge animé à l'activation des radars.
- Mod menu : scénarios « Test des ouvrants », « Tension basse », « Activation des radars » ; curseur batterie téléphone ; Moniteur moteur : test d'accélération corrigé.

## 25. v21b
- Radars : à l'activation (ou dès qu'un obstacle est détecté) la voiture vue de dessus avec arcs animés apparaît au centre de l'écran.
- Moniteur moteur : échelles couple/puissance et courbe suivent la puissance/couple réglés (Réglages > Moniteur moteur) ; 2 vues (barres / cadrans) au même endroit.
- Rotation : reprend 0,7 s après avoir lâché la voiture, depuis l'angle choisi.
- Carte Média élargie vers la gauche (25 rem).
- Non fait (nécessite un nouveau rendu des images) : roues plus sorties, pneus moins noirs.

## 26. v21c
- Moniteur moteur : estimation couple/puissance recalibrée (pleine charge = couple réglé) → la puissance atteint la valeur réglée (218 ch sur 220 en test) ; pression turbo en bar.
- Radars : plus de texte, seulement des lignes (arcs avant/arrière entièrement visibles, pulsation au repos) ; la fenêtre disparaît bien quand les radars s'éteignent.
- Ouvrants : tuile et animation plus petites, nouvelle vue de dessus plus soignée (phares, feux, rétros, vitres) ; désactivable (Réglages > Écran/Véhicule : Animation des portes).

## 27. v22
- Réglages : nouvel onglet « Préférences » (média, notifs, DND, démarrage, rotation/plateau, animations, accueil, portes/radars, multi-écran). Bouton permanent « Réglages Android » en bas de la barre latérale.
- Véhicule : puissance estimée (~215 ch par défaut), couple, masse. Moniteur moteur : barres couple/puissance pleines au maximum réglé.
- Carte Média = largeur de la météo. Centre d'applications centré. Nouvelle voiture vue de dessus aussi dans Véhicule > Ouvrants.

## 28. v22b
- Apparence : mode sombre / clair (Préférences > Apparence). Fond d'écran : dossier `assets/wallpapers` (liste dans `list.json`) ou `Android.listWallpapers()` (JSON de chemins) + ajout d'images depuis l'appli ; sélecteur à miniatures.
- Écran partagé : le Moniteur moteur affiche la vraie page Moniteur moteur (barres/cadrans, mêmes boutons) ; le choix d'application (grille par catégories) est réparé.
- Radars : le popup n'oblige plus à quitter la page en cours (plus de retour forcé à l'accueil).
- Voiture vue de dessus redessinée (proportions réelles, toit ouvrant, phares) pour la tuile et la vue Véhicule.
- Nouveau rendu 3D : roues sorties, pneus plus clairs, images 1700 px, vidéo de rotation régénérée.

## 29. v22c — correctifs
- Roues re-rendues avec un décalage réduit (WO 4,2 au lieu de 7), voiture recentrée image par image sur le plateau (sprites + vidéos régénérés).
- CarPlay / Android Auto retirés des applis proposées en vue séparée (ils s'ouvrent en plein écran Android).
- Panneau Média seul en vue séparée : puce appareil et stats masquées, pochette réduite, plus de débordement.
- Bug : la voiture (vidéo) transparaissait derrière les vues hors accueil/véhicule → visibilité forcée à hidden.
- Balayage de toutes les vues en sombre/clair : aucune erreur JS.

## 30. v22d
- Roues rentrées : décalage 2,2 (4,2 avant), images et vidéos régénérées.
- Chrono : vitesse en direct (km/h) affichée dans l'anneau.
- Moniteur moteur : aucune latence ajoutée côté appli (affichage à la frame suivante la réception).

## 31. v22e — voiture masquable + Liquid Glass
- Préférences : « Voiture sur l’accueil » (Afficher/Cacher). Cacher retire voiture, plateau et ombre ; option « Lecteur son à la place » (Oui/Non) affiche radio / musique en grand au centre (carte média du bas masquée alors).
- « Effet verre » : Désactivé / Flou / Liquid Glass (filtre SVG feDisplacementMap + carte de déplacement générée en canvas, flou, saturation, reflets de bord ; variante claire). Gourmand : à désactiver si la tête d’unité rame.

## 32. v22f
- Accueil sans voiture : choix du contenu central (Son / Vitesse + conso / Heure / Rien) ; lecteur central réduit.
- Fonds d’écran : bouton × pour supprimer (images ajoutées : effacées ; images du dossier : masquées + Android.deleteWallpaper(path) si fourni par l’appli).

## 33. v22g
- Bug : play/pause depuis l’accueil ouvrait le multi-écran (ouverture auto déclenchée par le démarrage de la lecture) → désormais ignorée dans les 5 s qui suivent une action de l’utilisateur sur les commandes média.
- Appui long (0,65 s) sur la voiture / le widget central : choix Voiture / Son / Vitesse / Heure / Rien. Si ce n’est pas « Son », la musique reste en bas à gauche.

## 34. v23 — deux versions (complète / lite sans 3D)
- Version lite : aucune image/vidéo de voiture (assets/car retiré, window.LITE=true), accueil sans voiture par défaut, fichier ~0,6 Mo au lieu de ~31 Mo. Build : `python3 build.py lite`.
- Centre de l’accueil : Voiture / Son / Vitesse / Moteur / Météo / Heure / Rien. Le « Son » n’apparaît que s’il y a une lecture ou une radio active.
- Option : masquer le logo Mazdaspeed du haut.
- Liquid Glass réglable : opacité, flou, réfraction, saturation, reflets (Préférences, visibles quand Liquid Glass est actif).
