# Peugeot 208 Launcher – application Android

Ce dossier est l'application qui affiche ton launcher sur l'autoradio TS10 (WebView plein écran, écran d'accueil Android).

## Compiler l'APK (au choix)

### A. Avec un PC (le plus simple)
1. Installe **Android Studio** (gratuit, developer.android.com/studio).
2. Décompresse ce dossier, puis Android Studio > **Open** > choisis le dossier `android`. Attends la fin de « Gradle sync » (la 1re fois, 5-10 min, internet requis).
3. Menu **Build > Build Bundle(s) / APK(s) > Build APK(s)**.
4. Clique « locate » : le fichier est `app/build/outputs/apk/debug/app-debug.apk`.

En ligne de commande (si le SDK Android est installé, Java 17) :
```
cd android
gradle assembleDebug
```

### B. Sans PC, depuis le téléphone (GitHub)
1. Crée un compte gratuit sur github.com, puis un dépôt **privé** (New repository).
2. « Add file > Upload files » : envoie **tout** le contenu du dossier `android` (y compris `.github/workflows/build.yml`).
3. Onglet **Actions** > « Construire l'APK » > **Run workflow**. Attends ~5 min.
4. Ouvre l'exécution terminée > **Artifacts** > télécharge `peugeot208-launcher-apk` (zip contenant `app-debug.apk`).

## Installer sur le poste
1. Copie `app-debug.apk` sur une **clé USB** (depuis le téléphone avec un adaptateur OTG, ou depuis un PC).
2. Branche la clé sur le poste, ouvre le gestionnaire de fichiers, touche l'APK > Installer (autorise « sources inconnues » si demandé).
3. Appuie sur le bouton **Accueil** : Android propose le choix de l'écran d'accueil > « Peugeot 208 » > **Toujours**.
4. Au 1er lancement, autorise **Peugeot 208 – notifications** (musique en cours + notifications) : l'écran de réglages s'ouvre tout seul.
5. Pour revenir à l'ancien écran d'accueil : Réglages Android > Applis > Applis par défaut > Application d'accueil.

## Ce qui marche / ce qui reste à brancher
- Marche (code écrit, non testé sur le poste) : affichage du launcher, liste des vraies applis et icônes, ouverture des applis, musique en cours (titre, position, play/pause/suivant/précédent), volume, luminosité, notifications, retour accueil par le bouton Accueil, ajout de fonds d'écran.
- Données voiture (régime, vitesse, températures, radars, marche arrière) : il faut une source. Une appli du boîtier CAN peut les envoyer :
  `adb shell am broadcast -a fr.evan.p208.CAR_STATE --es json '{"speed":50}'` (voir CAHIER_DES_CHARGES.md §6).
- Radio FM : pas d'API Android standard, boutons sans effet pour l'instant (tuner du constructeur à relayer).
- CarPlay / Android Auto : cherchés par nom d'appli. Si le bouton ne trouve pas ton appli, ajoute son nom dans `Launch.kt` (liste NAMES).
- Éteindre / redémarrer, couper Wi-Fi/Bluetooth directement : interdits par Android sans droits système.

## En cas de souci
- Écran blanc : poste avec WebView trop ancien (Réglages > Applis > Android System WebView > mise à jour).
- Boutons qui ne font rien : ouvre `MainActivity.kt` / `Bridge.kt`, tout est commenté.
