# Practice App — Contrôle d'accès et gestion d'identité

Application React + Vite de préparation à l'examen pour le module `Contrôle d'accès et gestion d'identité`.

Public cible :
- Master M1 Big Data
- Master M1 Cybersécurité

L'application est entièrement en français. Elle entraîne les mêmes compétences que l'examen officiel sans reprendre les questions exactes.

## Fonctionnalités

- `Simulation examen` avec structure proche de l'épreuve officielle
- `Répondre et apprendre` avec correction immédiate
- `Révision rapide` par flashcards
- `Historique` local des sessions
- `Mes erreurs` pour rejouer uniquement les points faibles
- sauvegarde automatique locale via `localStorage`
- contrôle anti-chevauchement avec l'examen officiel

## Modes disponibles

### 1. Simulation examen

- durée : `2h`
- tirage aléatoire de :
  - `32` questions section A
  - `10` questions section B
  - `5` scénarios section C
- pas de correction avant la fin
- reprise possible après refresh
- marquage `à revoir`
- résultats détaillés à la soumission

### 2. Répondre et apprendre

- choix d'une catégorie
- questions courtes, moyennes ou sous-questions de scénario
- correction immédiate
- explication option par option
- bouton `Question similaire`
- possibilité de refaire uniquement les erreurs

### 3. Révision rapide

- flashcards
- définition
- exemple AWS
- piège fréquent
- marquage `Je maîtrise` / `À revoir`

### 4. Historique

- sessions précédentes
- date, score, note /20, durée
- consultation des erreurs associées

### 5. Mes erreurs

- liste locale des questions ratées ou partielles
- relance ciblée
- nettoyage manuel possible

## Banque de données

Contenu actuel :
- section A : `120` questions
- section B : `70` questions
- section C : `25` scénarios
- sous-questions de scénario : `100`
- flashcards : `60`

## Logique de score

### Principe général

- réponse correcte : `+1`
- réponse fausse : `0`
- absence de réponse : `0`
- aucune réponse fausse ne retire de point

### Questions à réponse unique

- bonne option cochée : `+1`
- sinon : `0`

### Questions à réponses multiples

L'application utilise une logique d'entraînement progressive :
- proposition correcte cochée : `+1`
- proposition incorrecte laissée décochée : `+1`
- proposition correcte non cochée : `0`
- proposition incorrecte cochée : `0`

La note affichée est ensuite calculée ainsi :

```text
note /20 = (score obtenu / score maximum possible) x 20
```

## Sauvegarde locale

L'application enregistre dans `localStorage` :
- la simulation en cours
- l'historique
- la liste `Mes erreurs`
- la progression flashcards
- le dernier résultat affiché

Ce stockage est local au navigateur utilisé.

## Installation

Depuis WSL :

```bash
cd "/mnt/c/Users/Youss/Desktop/Contrôle d'accès et gestion d'identité/practice-app"
npm install
```

## Cloner le dépôt

```bash
git clone git@github.com:jodouma/practice-app.git
cd practice-app
npm install
npm run dev
```

## Lancer localement

```bash
cd "/mnt/c/Users/Youss/Desktop/Contrôle d'accès et gestion d'identité/practice-app"
npm run dev -- --host 127.0.0.1
```

## Build

```bash
npm run build
```

Le build de production est généré dans `dist/`.

## Prévisualisation locale du build

```bash
npm run preview
```

## Ajouter ou modifier des questions

Fichiers principaux :
- `src/data/questions.json`
- `src/data/flashcards.json`

Scripts utiles :
- générer / enrichir la banque :

```bash
npm run generate:data
```

- valider les données :

```bash
npm run validate:data
```

Chaque question simple contient :
- `id`
- `section`
- `category`
- `difficulty`
- `type`
- `estimatedSeconds`
- `question`
- `options`
- `concept`
- `learningNote`

Chaque scénario contient :
- `id`
- `section: "C"`
- `category`
- `title`
- `context`
- `diagram`
- `questions`

## Vérifier que l'app ne copie pas l'examen

Depuis `practice-app/` :

```bash
node scripts/check_app_exam_overlap.js
```

Ou via npm :

```bash
npm run check:overlap
```

Le script compare la banque d'entraînement à `../exam/examen_etudiant_controle_acces_gestion_identite.md`.

## GitHub Pages

Le projet est préparé pour GitHub Pages avec :
- `vite.config.js` configuré sur `base: "/practice-app/"`
- workflow GitHub Actions : `.github/workflows/deploy.yml`

URL publique attendue :

```text
https://jodouma.github.io/practice-app/
```

### Déploiement

1. poussez la branche `main`
2. ouvrez les paramètres du dépôt GitHub
3. vérifiez que `GitHub Pages` utilise bien `GitHub Actions`
4. laissez le workflow publier le contenu de `dist/`

## QA rapide

Commandes utiles avant publication :

```bash
npm run validate:data
npm run check:overlap
npm run build
```

## Next steps

- affiner encore certaines explications pédagogiques après retours étudiants
- ajouter de nouveaux scénarios par spécialité
- enrichir la visualisation des résultats si besoin
- suivre l'usage réel de l'app après mise en ligne GitHub Pages
