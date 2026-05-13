# QA multi-utilisateur — Application statique GitHub Pages

## Objectif

Vérifier que plusieurs étudiants peuvent utiliser l'application en parallèle sans compte, sans backend et sans partage involontaire des données.

## Hypothèse technique

- l'application est servie comme site statique par GitHub Pages
- chaque navigateur conserve son propre `localStorage`
- aucune donnée n'est envoyée à une base centrale
- les sessions, historiques et erreurs sont propres à chaque appareil / navigateur / profil

## Clés de stockage attendues

- `practiceApp.v1.version`
- `practiceApp.v1.activeSimulation`
- `practiceApp.v1.sessionHistory`
- `practiceApp.v1.mistakes`
- `practiceApp.v1.flashcardProgress`
- `practiceApp.v1.lastResult`

## Checklist manuelle recommandée

### Test 1 — Deux contextes séparés

1. ouvrir l'application dans un navigateur normal
2. ouvrir la même URL dans une fenêtre privée / navigation privée
3. lancer une simulation dans chaque contexte
4. répondre différemment dans les deux contextes
5. vérifier que les historiques et résultats ne se mélangent pas

Résultat attendu :
- chaque contexte garde son propre état
- aucun résultat d'un contexte n'apparaît dans l'autre

### Test 2 — Refresh en cours de simulation

1. lancer une simulation
2. répondre à plusieurs questions
3. marquer une question `à revoir`
4. recharger la page
5. vérifier que la session est reprise

Résultat attendu :
- la session revient sans perte notable
- le marquage `à revoir` est conservé

### Test 3 — Historique après fermeture / réouverture

1. terminer une simulation
2. vérifier l'entrée dans `Historique`
3. fermer complètement le navigateur
4. rouvrir l'application
5. revenir dans `Historique`

Résultat attendu :
- l'historique est toujours présent si les données locales n'ont pas été supprimées

### Test 4 — Suppression volontaire

1. aller dans `Historique`
2. supprimer l'historique
3. aller dans `Mes erreurs`
4. supprimer la liste

Résultat attendu :
- affichage d'états vides propres
- aucun crash

### Test 5 — Changement de navigateur ou d'appareil

1. ouvrir l'application sur un autre navigateur ou un autre appareil
2. vérifier qu'aucun historique précédent n'apparaît

Résultat attendu :
- l'application repart proprement
- il n'existe pas de synchronisation entre appareils

## Conclusion attendue

Cette application est adaptée à une diffusion à l'échelle de la classe tant que l'on accepte le modèle suivant :
- pas de compte
- pas de synchronisation entre appareils
- persistance locale uniquement
- confidentialité par séparation naturelle entre navigateurs et profils
