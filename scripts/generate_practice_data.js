import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");
const questionsPath = path.join(projectRoot, "src", "data", "questions.json");
const flashcardsPath = path.join(projectRoot, "src", "data", "flashcards.json");

function readJson(filePath, fallback) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (error) {
    return fallback;
  }
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function option(id, text, isCorrect, explanation) {
  return { id, text, isCorrect, explanation };
}

function single(config) {
  return { ...config, type: "single" };
}

function multiple(config) {
  return { ...config, type: "multiple" };
}

function scenario(config) {
  return { ...config, section: "C" };
}

function ensureUniquePush(target, entries, seenIds) {
  for (const entry of entries) {
    if (seenIds.has(entry.id)) continue;
    seenIds.add(entry.id);
    target.push(entry);
  }
}

const existingQuestions = readJson(questionsPath, []);
const existingFlashcards = readJson(flashcardsPath, []);
const questionIds = new Set();
const flashcardIds = new Set();
for (const item of existingQuestions) {
  questionIds.add(item.id);
  if (Array.isArray(item.questions)) {
    for (const question of item.questions) {
      questionIds.add(question.id);
    }
  }
}
for (const card of existingFlashcards) {
  flashcardIds.add(card.id);
}

const extraSectionA = [];
const extraSectionB = [];
const extraSectionC = [];
const extraFlashcards = [];

const leastPrivilegeContexts = [
  ["analyse marketing", "s3://campaign-insights", "analyste marketing", "Scénarios Big Data"],
  ["détection fraude", "s3://fraud-alerts", "analyste fraude", "Scénarios Cybersécurité"],
  ["data science", "s3://feature-lab", "data scientist", "Scénarios Big Data"],
  ["investigation SOC", "s3://soc-cases", "analyste SOC", "Scénarios Cybersécurité"],
  ["finops", "s3://cost-reports", "analyste FinOps", "CloudQuest / Cloud Practitioner"],
  ["gouvernance RH", "s3://hr-redacted", "gestionnaire RH", "Scénarios Cybersécurité"],
  ["qualité produit", "s3://qa-evidence", "ingénieur qualité", "IAM"],
  ["BI ventes", "s3://sales-curated", "développeur BI", "S3"]
];

let aCounter = 901;
for (const [domain, bucket, actor, category] of leastPrivilegeContexts) {
  extraSectionA.push(
    single({
      id: `A-BOOST-${aCounter++}`,
      section: "A",
      category,
      difficulty: "facile",
      estimatedSeconds: 45,
      question: `Dans le domaine ${domain}, ${actor} doit uniquement lire ${bucket}. Quel choix est le plus cohérent ?`,
      options: [
        option("A", "Autoriser seulement la lecture sur ce bucket précis", true, "C'est la traduction directe du besoin et du moindre privilège."),
        option("B", "Donner `s3:*` sur tous les buckets du compte", false, "Le périmètre dépasse largement le besoin réel."),
        option("C", "Utiliser le compte root pour éviter les erreurs", false, "Le compte root ne doit pas servir aux usages courants."),
        option("D", "Rendre le bucket public en lecture", false, "L'ouverture publique n'est pas une délégation saine.")
      ],
      concept: "Moindre privilège S3",
      learningNote: "Un besoin de lecture ciblé doit rester une permission de lecture ciblée."
    }),
    single({
      id: `A-BOOST-${aCounter++}`,
      section: "A",
      category: "IAM",
      difficulty: "facile",
      estimatedSeconds: 45,
      question: `Pour ${actor}, quelle option évite le mieux de laisser des identifiants longue durée en circulation ?`,
      options: [
        option("A", "Assumer un rôle IAM avec des identifiants temporaires", true, "Le rôle IAM réduit le risque de fuite durable."),
        option("B", "Créer une clé root partagée", false, "Une clé root partagée est une mauvaise pratique majeure."),
        option("C", "Placer une clé d'accès dans un dépôt Git", false, "Une clé statique dans le code crée un risque persistant."),
        option("D", "Supprimer CloudTrail", false, "Supprimer l'audit ne résout aucun problème d'identité.")
      ],
      concept: "Rôle IAM vs clé statique",
      learningNote: "Dès qu'un accès temporaire est possible, il vaut mieux qu'une clé longue durée."
    }),
    multiple({
      id: `A-BOOST-${aCounter++}`,
      section: "A",
      category: "CloudTrail / CloudWatch",
      difficulty: "moyen",
      estimatedSeconds: 55,
      question: `Quels éléments aideraient à enquêter si les permissions de ${actor} sur ${bucket} étaient modifiées sans préavis ?`,
      options: [
        option("A", "Les événements CloudTrail", true, "Ils permettent d'identifier la requête et l'identité appelante."),
        option("B", "Les journaux d'application utiles dans CloudWatch", true, "Ils peuvent compléter la chronologie opérationnelle."),
        option("C", "Un accès root partagé entre toute l'équipe", false, "Partager root ne facilite pas une enquête saine."),
        option("D", "La connaissance de la ressource réellement visée", true, "L'investigation dépend aussi du périmètre impacté.")
      ],
      concept: "Audit et investigation",
      learningNote: "Une enquête crédible recoupe l'identité, la ressource et la chronologie."
    }),
    single({
      id: `A-BOOST-${aCounter++}`,
      section: "A",
      category: "S3",
      difficulty: "moyen",
      estimatedSeconds: 50,
      question: `Si ${bucket} devient public par erreur, quel risque doit être identifié en premier ?`,
      options: [
        option("A", "Une exposition involontaire de données au-delà des acteurs prévus", true, "C'est le risque principal d'un bucket public non voulu."),
        option("B", "La désactivation automatique d'IAM", false, "Une exposition S3 ne supprime pas IAM."),
        option("C", "La suppression immédiate de tous les logs", false, "Ce n'est pas une conséquence normale."),
        option("D", "La perte définitive de tous les rôles AWS", false, "Ce n'est pas lié.")
      ],
      concept: "Incident bucket public",
      learningNote: "Une erreur de visibilité sur S3 est avant tout un sujet d'exposition de données."
    })
  );
}

const mediumContexts = [
  ["plateforme data", "s3://lake-governance", "data engineer", "Scénarios Big Data"],
  ["veille SOC", "s3://soc-timeline", "analyste SOC", "Scénarios Cybersécurité"],
  ["observabilité", "s3://ops-logs-archive", "site reliability engineer", "CloudTrail / CloudWatch"],
  ["catalogue RH", "s3://hr-curated", "chef de projet RH", "IAM"],
  ["finances", "s3://budget-monthly", "contrôleur de gestion", "S3"],
  ["espace étudiants", "s3://student-projects", "assistant pédagogique", "CloudQuest / Cloud Practitioner"],
  ["qualité données", "s3://dq-checkpoints", "responsable qualité data", "Glue / Data Pipeline"],
  ["annuaire central", "aws-accounts-campus", "gestionnaire SSO", "SSO / IAM Identity Center"],
  ["forensic cloud", "cloudtrail-central", "analyste forensic", "Scénarios Cybersécurité"],
  ["catalogue marketing", "s3://ads-redacted", "ingénieur marketing data", "Scénarios Big Data"],
  ["modèles accès", "entrepôt de fichiers internes", "responsable gouvernance", "RBAC / ABAC / modèles d'accès"],
  ["audit fournisseurs", "s3://vendor-audit", "auditeur externe", "CloudTrail / CloudWatch"],
  ["sandbox DevOps", "s3://sandbox-deployments", "développeur DevOps", "IAM"]
];

let bCounter = 901;
for (const [domain, resource, actor, category] of mediumContexts) {
  extraSectionB.push(
    single({
      id: `B-BOOST-${bCounter++}`,
      section: "B",
      category,
      difficulty: "moyen",
      estimatedSeconds: 80,
      question: `Dans le contexte ${domain}, ${actor} doit travailler sur ${resource} sans recevoir de privilèges d'administration. Quel design est le plus défendable ?`,
      options: [
        option("A", "Créer un rôle ou un jeu de permissions ciblé sur la ressource utile", true, "C'est le design cohérent avec le besoin décrit."),
        option("B", "Distribuer `AdministratorAccess` pour éviter des tickets", false, "C'est excessif et contraire à la gouvernance."),
        option("C", "Partager des identifiants root", false, "Le compte root n'est pas un mécanisme de délégation acceptable."),
        option("D", "Désactiver les logs pour simplifier l'usage", false, "On ne supprime pas la traçabilité pour simplifier l'accès.")
      ],
      concept: "Conception IAM ciblée",
      learningNote: "La première question est toujours : quelle identité, quelle ressource, quelles actions exactes ?"
    }),
    multiple({
      id: `B-BOOST-${bCounter++}`,
      section: "B",
      category,
      difficulty: "moyen",
      estimatedSeconds: 90,
      question: `Quels contrôles complètent utilement ce design autour de ${resource} ?`,
      options: [
        option("A", "Conserver les traces nécessaires à l'audit et à l'investigation", true, "La traçabilité reste indispensable."),
        option("B", "Séparer les rôles humains, techniques et d'audit si le contexte l'exige", true, "La séparation des responsabilités limite les abus et les erreurs."),
        option("C", "Étendre par défaut le périmètre à toutes les ressources similaires du compte", false, "Le besoin exprimé reste borné à un périmètre précis."),
        option("D", "Employer des identifiants temporaires quand l'usage le permet", true, "Les identifiants temporaires réduisent la durée d'exposition.")
      ],
      concept: "Gouvernance des accès",
      learningNote: "Un bon design combine permissions ciblées, traçabilité et séparation des rôles."
    })
  );
}

const scenarioThemes = [
  ["Pipeline analytics web", "Scénarios Big Data", "Une équipe analytics reçoit des exports web dans `raw-web-events`, les transforme avec Glue puis publie les agrégats dans `curated-web-metrics`. L'équipe sécurité veut un audit exploitable sans ouvrir IAM inutilement.", "S3 raw-web-events -> Glue -> S3 curated-web-metrics -> CloudWatch Logs / CloudTrail"],
  ["Accès lecture SOC multi-comptes", "Scénarios Cybersécurité", "Une cellule SOC doit consulter des traces centralisées pour trois comptes AWS sans pouvoir modifier les permissions des comptes surveillés.", "Analyste SOC -> IAM Identity Center / rôle lecture -> compte sécurité"],
  ["Prestataire data limité à 7 jours", "Glue / Data Pipeline", "Un prestataire doit corriger un job Glue pendant une semaine puis perdre automatiquement ses accès.", "Prestataire -> accès temporaire -> Glue / S3 / CloudWatch"],
  ["Incident bucket de sauvegarde", "S3", "Un bucket `backup-audit-exports` contenant des rapports sensibles est exposé trop largement après une modification de policy.", "S3 backup-audit-exports -> CloudTrail -> Investigation -> Remédiation"],
  ["Université avec trois comptes AWS", "SSO / IAM Identity Center", "Une université veut centraliser les accès enseignants, assistants et administrateurs vers trois comptes AWS sans comptes IAM permanents dispersés.", "Annuaire -> IAM Identity Center -> compte data / sec / labs"],
  ["Pipeline PII support client", "Glue / Data Pipeline", "Un pipeline doit masquer des identifiants clients avant de transmettre un export au service support avancé.", "S3 raw-support -> Glue redaction -> S3 support-safe -> logs"],
  ["Rôle Lambda trop large", "IAM", "Une revue révèle qu'un rôle d'exécution applicatif peut aussi modifier des politiques IAM, alors que l'application ne fait que publier des résultats.", "Application -> rôle IAM -> Lambda / S3 / CloudWatch"],
  ["Partage finance vers audit interne", "Scénarios Big Data", "Le compte finance veut partager des rapports mensuels avec le compte audit interne sans rendre les objets publics ni donner d'écriture.", "Compte finance -> S3 reports -> compte audit"],
  ["Poste d'analyste forensic", "Scénarios Cybersécurité", "Un analyste forensic doit reconstituer la chronologie d'une modification d'accès à un bucket sans pouvoir altérer les traces d'origine.", "Analyste forensic -> CloudTrail / CloudWatch Logs -> timeline"],
  ["CloudQuest startup retail", "CloudQuest / Cloud Practitioner", "Une startup retail doit choisir des services simples pour gérer des identités humaines, protéger un bucket de rapports et garder une visibilité sur les changements.", "Equipe retail -> IAM Identity Center / S3 / CloudTrail / CloudWatch"]
];

let cCounter = 901;
for (const [title, category, context, diagram] of scenarioThemes) {
  const id = `C-BOOST-${cCounter++}`;
  extraSectionC.push(
    scenario({
      id,
      category,
      difficulty: "moyen",
      title,
      context,
      diagram,
      questions: [
        single({
          id: `${id}-Q1`,
          section: "C",
          category,
          difficulty: "moyen",
          estimatedSeconds: 75,
          question: "Quel principe d'accès doit être vérifié en premier ?",
          options: [
            option("A", "Le moindre privilège", true, "C'est le principe directeur le plus transversal dans ce type de scénario."),
            option("B", "L'usage du compte root comme solution standard", false, "Le compte root n'est pas un mécanisme de délégation saine."),
            option("C", "L'ouverture publique préventive des données", false, "L'ouverture publique augmente le risque."),
            option("D", "La suppression des logs de supervision", false, "L'audit reste nécessaire.")
          ],
          concept: "Moindre privilège",
          learningNote: "On commence par vérifier si chaque acteur a seulement ce dont il a besoin."
        }),
        multiple({
          id: `${id}-Q2`,
          section: "C",
          category,
          difficulty: "moyen",
          estimatedSeconds: 95,
          question: "Quels contrôles techniques ou organisationnels renforcent ce scénario ?",
          options: [
            option("A", "Cibler les permissions sur les ressources utiles", true, "C'est l'application concrète du moindre privilège."),
            option("B", "Conserver les traces d'audit et de journalisation nécessaires", true, "Sans traces fiables, l'investigation devient fragile."),
            option("C", "Fusionner les rôles d'administration, d'audit et d'exécution pour gagner du temps", false, "Cela dégrade la séparation des responsabilités."),
            option("D", "Utiliser des sessions temporaires quand c'est possible", true, "Les accès temporaires réduisent l'exposition durable.")
          ],
          concept: "Contrôles complémentaires",
          learningNote: "Un bon design articule permissions fines, audit et séparation des rôles."
        }),
        single({
          id: `${id}-Q3`,
          section: "C",
          category,
          difficulty: "moyen",
          estimatedSeconds: 75,
          question: "Quel service faut-il consulter en premier pour savoir quelle identité a lancé un changement sensible dans AWS ?",
          options: [
            option("A", "CloudTrail", true, "CloudTrail est le service de base pour attribuer un changement à une identité."),
            option("B", "CloudFront", false, "Ce n'est pas le bon service d'audit ici."),
            option("C", "AWS Glue", false, "Glue n'est pas un service d'audit général des identités."),
            option("D", "Route 53", false, "Sans lien direct avec l'attribution du changement décrit.")
          ],
          concept: "Audit AWS",
          learningNote: "Quand la question est “qui a modifié quoi ?”, CloudTrail est le premier réflexe."
        }),
        single({
          id: `${id}-Q4`,
          section: "C",
          category,
          difficulty: "moyen",
          estimatedSeconds: 80,
          question: "Quelle attitude est la plus professionnelle si un détail précis du workshop ou d'un lab n'est pas certain ?",
          options: [
            option("A", "Raisonner sur les principes sûrs et signaler ce qui reste à confirmer", true, "C'est la bonne posture méthodologique."),
            option("B", "Inventer le détail manquant pour rendre la réponse plus complète", false, "Inventer affaiblit la rigueur."),
            option("C", "Remplacer la question par une autre technologie hors sujet", false, "Ce n'est pas une réponse."),
            option("D", "Considérer que l'accès n'a plus d'importance si le détail n'est pas confirmé", false, "Les principes d'accès restent pertinents.")
          ],
          concept: "Rigueur méthodologique",
          learningNote: "En sécurité comme en data, il faut distinguer ce qui est certain de ce qui reste à confirmer."
        })
      ]
    })
  );
}

const extraFlashcardRows = [
  ["AWS Organizations", "Service aidant à structurer plusieurs comptes AWS et leur gouvernance.", "Il facilite les stratégies multi-comptes avec rôles, audit centralisé et gouvernance.", "Ne pas croire qu'Organizations remplace IAM ou IAM Identity Center.", ["gouvernance", "multi-compte"]],
  ["Bucket Policy vs IAM Policy", "Une bucket policy est attachée à la ressource S3 ; une IAM policy est attachée à l'identité.", "Un accès inter-compte peut nécessiter une bonne configuration des deux côtés.", "Penser qu'un seul côté suffit toujours.", ["S3", "policy"]],
  ["Journalisation", "Ensemble des traces générées pour comprendre ce qui s'est passé.", "CloudTrail et CloudWatch Logs complètent la journalisation côté AWS.", "Journaliser sans jamais relire les traces ne suffit pas.", ["audit"]],
  ["CloudWatch Alarm", "Mécanisme d'alerte basé sur une métrique ou une condition.", "Une alarme peut signaler un comportement anormal ou un échec d'exécution.", "Une alarme ne remplace pas l'analyse de logs.", ["observabilité"]],
  ["Compte central de sécurité", "Compte dédié qui reçoit des journaux et consolide la supervision.", "Plusieurs comptes applicatifs peuvent y envoyer leurs traces.", "Centraliser ne veut pas dire ouvrir l'accès à tout le monde.", ["gouvernance", "audit"]],
  ["Accès inter-compte", "Accès accordé entre deux comptes AWS sans rendre une ressource publique.", "Un bucket S3 peut être partagé avec un compte audit via une policy appropriée.", "Inter-compte n'est pas synonyme de public.", ["IAM", "S3"]],
  ["Condition IAM", "Partie d'une policy qui restreint l'accès selon un contexte ou un attribut.", "On peut utiliser une condition pour restreindre une action à un tag ou un environnement.", "Une condition mal pensée peut bloquer ou ouvrir trop large.", ["IAM", "policy"]],
  ["Validation de policy", "Pratique consistant à relire ou analyser une policy pour repérer les permissions excessives.", "IAM Access Analyzer peut aider à détecter certains risques de policy.", "Une policy qui fonctionne n'est pas forcément une bonne policy.", ["IAM", "gouvernance"]],
  ["IAM Access Analyzer", "Outil AWS aidant à détecter des accès externes ou trop larges sur certaines ressources et policies.", "Il peut mettre en évidence une exposition de ressource vers l'extérieur.", "Ce n'est pas une preuve que toute la gouvernance IAM est parfaite.", ["IAM", "audit"]],
  ["Compte de service technique", "Identité utilisée par une application ou un traitement automatisé.", "Un job Glue ou une fonction Lambda travaille avec une identité technique.", "Il ne faut pas lui donner les mêmes droits qu'à un administrateur humain.", ["IAM", "workload"]],
  ["Séparation humain / workload", "Distinction entre accès humains et accès techniques.", "Un analyste sécurité n'a pas le même profil qu'un job Glue.", "Fusionner les deux brouille la traçabilité et la gouvernance.", ["gouvernance"]],
  ["Traceability by design", "Approche qui prévoit dès le départ comment les accès et actions seront tracés.", "Choisir CloudTrail, CloudWatch Logs et des rôles séparés dès la conception.", "Ajouter l'audit seulement après un incident coûte plus cher.", ["audit", "méthode"]],
  ["Annuaire fédéré", "Source d'identité externe connectée à AWS pour l'accès humain.", "Un annuaire d'université peut être connecté à IAM Identity Center.", "Fédérer ne suffit pas si les permissions derrière restent mal définies.", ["SSO", "fédération"]],
  ["Lecture seule", "Jeu de permissions qui autorise la consultation sans modification.", "Un analyste sécurité peut lire CloudTrail sans changer IAM.", "Lecture seule ne veut pas dire accès à tout.", ["IAM", "principe"]],
  ["Écriture contrôlée", "Permission limitée aux actions de dépôt ou de mise à jour strictement nécessaires.", "Un job écrit dans un bucket curated mais ne supprime pas tout le data lake.", "Écrire quelque part n'implique pas d'administrer l'ensemble du service.", ["IAM", "S3"]],
  ["Enquête post-incident", "Analyse menée après un problème d'accès ou d'exposition.", "On recoupe identité, traces, ressource touchée et chronologie.", "Corriger vite sans comprendre l'origine prépare la récidive.", ["incident", "audit"]],
  ["Score progressif QRM", "Méthode d'entraînement qui valorise l'analyse option par option.", "Dans l'app, une bonne option cochée vaut un point, tout comme une mauvaise option laissée décochée.", "Ce score d'entraînement n'encourage pas le clic au hasard ; il encourage l'analyse.", ["méthode", "app"]],
  ["Session sauvegardée", "État local d'une simulation ou d'un entraînement sauvegardé dans le navigateur.", "Un refresh ne doit pas faire perdre une simulation en cours.", "Changer de machine ou vider le navigateur efface ce stockage local.", ["app", "méthode"]],
  ["Réponse partielle", "Réponse où une partie du raisonnement est correcte mais pas toute la sélection.", "En QRM, une sélection incomplète peut donner un score partiel dans l'app.", "Il faut comprendre ce qui manquait, pas seulement retenir la lettre correcte.", ["méthode", "app"]],
  ["PII redaction", "Processus de masquage ou transformation d'informations identifiantes avant partage.", "Un job Glue peut retirer ou masquer des colonnes sensibles avant diffusion.", "Masquer la donnée ne dispense pas de contrôler qui peut lire le bucket.", ["Glue", "PII"]]
];

let flashCounter = 901;
for (const [term, definition, awsExample, frequentTrap, tags] of extraFlashcardRows) {
  extraFlashcards.push({
    id: `FLASH-BOOST-${flashCounter++}`,
    term,
    definition,
    awsExample,
    frequentTrap,
    tags
  });
}

const mergedQuestions = [...existingQuestions];
ensureUniquePush(mergedQuestions, extraSectionA, questionIds);
ensureUniquePush(mergedQuestions, extraSectionB, questionIds);
ensureUniquePush(mergedQuestions, extraSectionC, questionIds);

const mergedFlashcards = [...existingFlashcards];
ensureUniquePush(mergedFlashcards, extraFlashcards, flashcardIds);

const sortedQuestions = [
  ...mergedQuestions.filter((item) => item.section === "A"),
  ...mergedQuestions.filter((item) => item.section === "B"),
  ...mergedQuestions.filter((item) => Array.isArray(item.questions))
];

writeJson(questionsPath, sortedQuestions);
writeJson(flashcardsPath, mergedFlashcards);

const sectionA = sortedQuestions.filter((item) => item.section === "A").length;
const sectionB = sortedQuestions.filter((item) => item.section === "B").length;
const sectionC = sortedQuestions.filter((item) => Array.isArray(item.questions)).length;
const sectionCSubQuestions = sortedQuestions
  .filter((item) => Array.isArray(item.questions))
  .reduce((sum, item) => sum + item.questions.length, 0);

console.log(
  JSON.stringify(
    {
      sectionA,
      sectionB,
      sectionC,
      sectionCSubQuestions,
      flashcards: mergedFlashcards.length
    },
    null,
    2
  )
);
