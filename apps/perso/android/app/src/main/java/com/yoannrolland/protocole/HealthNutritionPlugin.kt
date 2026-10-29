package com.yoannrolland.protocole

import androidx.activity.result.ActivityResult
import androidx.health.connect.client.HealthConnectClient
import androidx.health.connect.client.PermissionController
import com.getcapacitor.annotation.ActivityCallback
import androidx.health.connect.client.permission.HealthPermission
import androidx.health.connect.client.records.HydrationRecord
import androidx.health.connect.client.records.HeartRateRecord
import androidx.health.connect.client.records.NutritionRecord
import androidx.health.connect.client.records.SleepSessionRecord
import androidx.health.connect.client.records.StepsRecord
import androidx.health.connect.client.records.WeightRecord
import androidx.health.connect.client.request.ReadRecordsRequest
import androidx.health.connect.client.time.TimeRangeFilter
import com.getcapacitor.JSArray
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import java.time.Instant

/**
 * Lecteurs natifs Health Connect qui dépassent ce qu'expose @capgo/capacitor-health :
 *
 * - Macros complètes : @capgo lit bien NutritionRecord mais n'en expose que l'énergie.
 *   Ce lecteur récupère aussi protéines / glucides / lipides / fibres, et l'hydratation.
 * - Sommeil détaillé : @capgo ne rapporte que la période (coucher→réveil). Ce lecteur va
 *   chercher les phases (SleepSessionRecord.stages) quand Samsung Health les écrit, pour
 *   calculer une durée réelle de sommeil (période moins éveils) et une note de qualité —
 *   voir readSleep().
 */
@CapacitorPlugin(name = "HealthNutrition")
class HealthNutritionPlugin : Plugin() {

    private val scope = CoroutineScope(Dispatchers.Main)

    private val permissions = setOf(
        HealthPermission.getReadPermission(NutritionRecord::class),
        HealthPermission.getReadPermission(HydrationRecord::class),
    )

    private fun client(): HealthConnectClient? =
        if (HealthConnectClient.getSdkStatus(context) == HealthConnectClient.SDK_AVAILABLE)
            HealthConnectClient.getOrCreate(context)
        else null

    /**
     * Nuit, pesée et FC repos : calculs dans HealthReads.kt (29/10/2026), partagés avec le brief
     * du matin préparé app fermée (J4.1). Ici, seulement la lecture des bornes et la réponse.
     */
    private fun read(call: PluginCall, label: String, block: suspend (HealthConnectClient, TimeRangeFilter) -> JSObject) {
        val hc = client() ?: run { call.reject("Health Connect indisponible"); return }
        val start = call.getString("startDate") ?: run { call.reject("startDate requis"); return }
        val end = call.getString("endDate") ?: run { call.reject("endDate requis"); return }
        scope.launch {
            try {
                call.resolve(block(hc, TimeRangeFilter.between(Instant.parse(start), Instant.parse(end))))
            } catch (e: Exception) {
                call.reject("Lecture $label impossible : ${e.message}")
            }
        }
    }

    /**
     * Outil de diagnostic (non utilisé par la synchro normale) — dump brut du contenu de
     * Health Connect : nutrition, hydratation, poids, pas, avec pour chaque enregistrement
     * la source (`dataOrigin`) et l'horodatage de dernière écriture (`lastModifiedTime`).
     *
     * Sert à trancher la question « l'app lit-elle mal, ou Health Connect est-il périmé ? » :
     * comparer `modif` à l'heure courante montre immédiatement si l'app source (MyFitnessPal,
     * Samsung Health) a cessé de pousser ses données. À appeler ponctuellement depuis
     * healthSync.js avec un console.log, puis retirer l'appel.
     */
    @PluginMethod
    fun diagnose(call: PluginCall) {
        val hc = client() ?: run { call.reject("Health Connect indisponible"); return }
        val start = call.getString("startDate") ?: run { call.reject("startDate requis"); return }
        val end = call.getString("endDate") ?: run { call.reject("endDate requis"); return }

        scope.launch {
            try {
                val range = TimeRangeFilter.between(Instant.parse(start), Instant.parse(end))
                val out = JSObject()

                val nutri = JSArray()
                hc.readRecords(ReadRecordsRequest(NutritionRecord::class, range)).records.forEach { r ->
                    nutri.put(JSObject()
                        .put("start", r.startTime.toString())
                        .put("kcal", r.energy?.inKilocalories)
                        .put("protein", r.protein?.inGrams)
                        .put("carbs", r.totalCarbohydrate?.inGrams)
                        .put("fat", r.totalFat?.inGrams)
                        .put("fiber", r.dietaryFiber?.inGrams)
                        .put("src", r.metadata.dataOrigin.packageName)
                        .put("modif", r.metadata.lastModifiedTime.toString()))
                }
                out.put("nutrition", nutri)

                val hydr = JSArray()
                hc.readRecords(ReadRecordsRequest(HydrationRecord::class, range)).records.forEach { r ->
                    hydr.put(JSObject()
                        .put("start", r.startTime.toString())
                        .put("ml", r.volume.inMilliliters)
                        .put("src", r.metadata.dataOrigin.packageName)
                        .put("modif", r.metadata.lastModifiedTime.toString()))
                }
                out.put("hydration", hydr)

                val weights = JSArray()
                try {
                    hc.readRecords(ReadRecordsRequest(WeightRecord::class, range)).records.forEach { r ->
                        weights.put(JSObject()
                            .put("time", r.time.toString())
                            .put("kg", r.weight.inKilograms)
                            .put("src", r.metadata.dataOrigin.packageName)
                            .put("modif", r.metadata.lastModifiedTime.toString()))
                    }
                    out.put("weight", weights)
                } catch (e: Exception) {
                    out.put("weightError", e.message ?: "inconnue")
                }

                // Pas : agrégés par source pour voir qui écrit quoi
                val stepsBySrc = HashMap<String, Long>()
                var stepsLatest = ""
                hc.readRecords(ReadRecordsRequest(StepsRecord::class, range)).records.forEach { r ->
                    val k = r.metadata.dataOrigin.packageName
                    stepsBySrc[k] = (stepsBySrc[k] ?: 0L) + r.count
                    val m = r.metadata.lastModifiedTime.toString()
                    if (m > stepsLatest) stepsLatest = m
                }
                val steps = JSObject()
                stepsBySrc.forEach { (k, v) -> steps.put(k, v) }
                out.put("stepsBySource", steps)
                out.put("stepsLastModified", stepsLatest)

                call.resolve(out)
            } catch (e: Exception) {
                call.reject("Diagnostic impossible : ${e.message}")
            }
        }
    }

    /**
     * Renvoie, par "jour de sommeil" (yyyy-MM-dd), la durée de sommeil et une note de
     * qualité sur 4 quand Health Connect contient le détail par phase, sinon seulement la
     * période coucher→réveil (aucune qualité calculée dans ce cas).
     *
     * Vérifié le 28/07/2026 sur appareil réel : quand les phases sont présentes, la durée
     * calculée ici (période moins éveils) tombe à 30 secondes de la "durée réelle" affichée
     * par Samsung Health (6h56,5 calculé vs 6h57 affiché) — assez fiable pour remplacer la
     * saisie manuelle. Samsung Health n'a commencé à écrire ce détail dans Health Connect que
     * récemment sur cet appareil : les nuits plus anciennes n'ont aucune phase, d'où le repli
     * sur la période seule.
     *
     * Health Connect n'a par ailleurs aucun champ "score" — celui de Samsung Health reste
     * propriétaire, jamais exposé. La qualité ci-dessous est un calcul maison (efficacité +
     * durée), pas une reproduction de ce score.
     *
     * **Nuits fractionnées (07/08/2026)** : en cas d'insomnie, l'app de sommeil peut écrire
     * DEUX `SleepSessionRecord` pour une même nuit (réveil prolongé entre les deux) au lieu
     * d'un seul avec des phases d'éveil internes. `out.put(...)` sur une seule clé par
     * enregistrement écrasait silencieusement le premier segment avec le second — Yoann n'en
     * voyait plus qu'un des deux. Les enregistrements sont désormais regroupés par "jour de
     * sommeil" (`sleepDayOf`, fenêtre de midi la veille à midi le jour même — pas le jour
     * calendaire de fin, qui aurait pu séparer un segment finissant juste avant minuit d'un
     * second commençant juste après) puis SOMMÉS : durée additionnée, qualité recalculée sur
     * l'efficacité et le temps endormi combinés des segments porteurs de phases.
     */
    @PluginMethod
    fun readSleep(call: PluginCall) = read(call, "sommeil") { hc, range -> HealthReads.sleep(hc, range) }

    /**
     * Renvoie, par date locale (yyyy-MM-dd), la dernière pesée du jour.
     *
     * Health Connect n'a du poids que si une app source l'y écrit — vérifié le 27/07/2026 :
     * ni MyFitnessPal (WRITE_WEIGHT absent de son manifeste) ni Samsung Health n'écrivaient
     * quoi que ce soit (0 WeightRecord). Retesté le 28/07/2026 après une pesée saisie à la
     * main **dans Samsung Health lui-même** (pas MyFitnessPal) : cette fois la pesée apparaît
     * bien dans Health Connect — Samsung Health écrit donc les pesées manuelles, simplement
     * aucune n'avait jamais été saisie côté Samsung Health avant ce test. Une seule pesée
     * testée à ce stade : à confirmer sur plusieurs jours avant de s'y fier pleinement.
     */
    @PluginMethod
    fun readWeight(call: PluginCall) = read(call, "poids") { hc, range -> HealthReads.weight(hc, range) }

    /**
     * Renvoie, par "jour de sommeil" (yyyy-MM-dd), une FC repos calculée MAISON (05/09/2026,
     * score d'énergie — voir packages/core/src/energy.js) : moyenne des mesures de FC
     * (`HeartRateRecord`, mesures continues) tombant dans les phases de sommeil RÉEL (hors
     * éveil) de la nuit.
     *
     * **v1 abandonnée le 05/09/2026** : lisait `RestingHeartRateRecord`, le type dédié de
     * Health Connect — resté vide après synchro sur cet appareil alors que Samsung Health
     * affiche bien une FC repos dans sa propre UI. Confirmé : Samsung Health ne pousse
     * aucun `RestingHeartRateRecord` dans Health Connect ici, seulement la FC continue.
     * Cette v2 la reconstruit depuis les mesures brutes, en réutilisant le même découpage
     * "jour de sommeil" que `readSleep()` (fenêtre midi-veille à midi-jour même) et les
     * mêmes phases de sommeil (stages) pour exclure les moments éveillé-au-lit.
     *
     * Une nuit sans détail par phase (pas de `stages`, cas déjà géré par `readSleep`) retombe
     * sur la période brute coucher→réveil pour cette part de la nuit — mieux qu'aucune donnée.
     */
    @PluginMethod
    fun readRestingHeartRate(call: PluginCall) = read(call, "FC repos") { hc, range -> HealthReads.restingHr(hc, range) }

    @PluginMethod
    fun hasPermissions(call: PluginCall) {
        val hc = client() ?: run {
            call.resolve(JSObject().put("available", false).put("granted", false))
            return
        }
        scope.launch {
            try {
                val granted = hc.permissionController.getGrantedPermissions()
                call.resolve(
                    JSObject()
                        .put("available", true)
                        .put("granted", granted.containsAll(permissions))
                )
            } catch (e: Exception) {
                call.reject("Vérification des permissions impossible : ${e.message}")
            }
        }
    }

    /** Widget (28/10/2026) : ce Health Connect sait-il lire en arrière-plan, et est-ce accordé ? */
    @PluginMethod
    fun backgroundReadStatus(call: PluginCall) {
        val hc = WidgetStepsRefresher.client(context) ?: run {
            call.resolve(JSObject().put("supported", false).put("granted", false))
            return
        }
        scope.launch {
            try {
                val supported = WidgetStepsRefresher.backgroundSupported(hc)
                val granted = hc.permissionController.getGrantedPermissions()
                call.resolve(JSObject().put("supported", supported).put("granted",
                    supported && granted.containsAll(setOf(WidgetStepsRefresher.STEPS_PERMISSION, WidgetStepsRefresher.BACKGROUND_PERMISSION))))
            } catch (e: Exception) {
                call.reject("Vérification impossible : ${e.message}")
            }
        }
    }

    /** Ouvre l'écran Health Connect pour accorder l'accès en arrière-plan (pas du widget). */
    @PluginMethod
    fun requestBackgroundRead(call: PluginCall) {
        val intent = PermissionController.createRequestPermissionResultContract()
            .createIntent(context, setOf(WidgetStepsRefresher.STEPS_PERMISSION, WidgetStepsRefresher.BACKGROUND_PERMISSION))
        startActivityForResult(call, intent, "onBackgroundReadResult")
    }

    @ActivityCallback
    fun onBackgroundReadResult(call: PluginCall?, result: ActivityResult) {
        if (call == null) return
        val granted = PermissionController.createRequestPermissionResultContract()
            .parseResult(result.resultCode, result.data)
        call.resolve(JSObject().put("granted", granted.contains(WidgetStepsRefresher.BACKGROUND_PERMISSION)))
    }

    /**
     * Renvoie les totaux nutrition et hydratation agrégés par date locale (yyyy-MM-dd).
     * Paramètres : startDate / endDate en ISO 8601.
     */
    @PluginMethod
    fun readNutrition(call: PluginCall) {
        val hc = client() ?: run {
            call.reject("Health Connect indisponible")
            return
        }
        val start = call.getString("startDate")
        val end = call.getString("endDate")
        if (start == null || end == null) {
            call.reject("startDate et endDate sont requis")
            return
        }

        scope.launch {
            try {
                val granted = hc.permissionController.getGrantedPermissions()
                if (!granted.containsAll(permissions)) {
                    call.reject("Permissions nutrition/hydratation non accordées")
                    return@launch
                }

                val range = TimeRangeFilter.between(Instant.parse(start), Instant.parse(end))
                // Une entrée par date : MFP écrit un résumé par repas, on cumule sur la journée.
                val days = HashMap<String, DayTotals>()
                fun dayOf(instant: Instant) =
                    instant.atZone(java.time.ZoneId.systemDefault()).toLocalDate().toString()

                // Déduplication indispensable : réinstaller MyFitnessPal lui fait réécrire tout
                // son historique dans Health Connect sans supprimer l'ancien. On se retrouve avec
                // plusieurs enregistrements de MÊME source et MÊME instant de début pour un repas
                // donné — les additionner doublait les macros des jours passés (constaté le
                // 27/07/2026). On ne garde donc que le plus récemment écrit de chaque groupe
                // (source + instant de début), ce qui préserve les vrais repas distincts d'une
                // même journée puisqu'ils ont des instants de début différents.
                //
                // Cronometer casse l'hypothèse ci-dessus : il écrit un NutritionRecord PAR REPAS,
                // mais tous avec le MÊME instant de début nominal dans la journée (constaté le
                // 01/08/2026 — 4 enregistrements, même "start", valeurs différentes). La
                // déduplication par (source + début) ci-dessus en gardait un seul, perdant 3
                // repas sur 4. MyFitnessPal, lui, écrit un total de JOURNÉE ENTIÈRE qui évolue
                // (mêmes début/fin, valeurs qui grossissent au fil des ajouts) — plusieurs
                // versions du même total ne doivent PAS s'additionner, juste garder la dernière.
                // Impossible de distinguer les deux comportements sans connaître la source :
                // on ne resserre donc la déduplication par (source + début) qu'aux sources
                // connues pour écrire un total de journée plutôt qu'un repas.
                //
                // Une déduplication "valeurs strictement identiques" avait été tentée en plus
                // (retirée le 01/08/2026) : elle prenait pour un doublon technique deux vrais
                // aliments identiques saisis à la volée (ex. 2× la même banane), qui ont forcément
                // les mêmes macros — impossible à distinguer d'une vraie écriture en double sans
                // l'identifiant natif de l'enregistrement. Mieux vaut restituer une saisie
                // légitime en double (rare, visible, corrigeable dans l'app source) que perdre
                // silencieusement de vrais repas.
                val WHOLE_DAY_SUMMARY_SOURCES = setOf("com.myfitnesspal.android")

                val nutriRecords = hc.readRecords(ReadRecordsRequest(NutritionRecord::class, range)).records
                    .groupBy { it.metadata.dataOrigin.packageName }
                    .flatMap { (src, recs) ->
                        if (src in WHOLE_DAY_SUMMARY_SOURCES) {
                            recs.groupBy { it.startTime }.values.map { grp -> grp.maxByOrNull { it.metadata.lastModifiedTime }!! }
                        } else {
                            recs
                        }
                    }
                nutriRecords.forEach { r ->
                    val d = days.getOrPut(dayOf(r.startTime)) { DayTotals() }
                    r.energy?.inKilocalories?.let { d.kcal += it; d.hasNutrition = true }
                    r.protein?.inGrams?.let { d.protein += it; d.hasNutrition = true }
                    r.totalCarbohydrate?.inGrams?.let { d.carbs += it; d.hasNutrition = true }
                    r.totalFat?.inGrams?.let { d.fat += it; d.hasNutrition = true }
                    r.dietaryFiber?.inGrams?.let { d.fiber += it; d.hasNutrition = true }
                }

                // Même bug que pour la nutrition (voir plus haut) : Cronometer écrit un
                // HydrationRecord par verre d'eau, tous au même instant nominal dans la
                // journée — la déduplication générique par (source + début) n'en gardait
                // qu'un seul, plafonnant le total du jour bien en dessous du vrai (constaté
                // le 01/08/2026, l'utilisateur à ~3 L dans Cronometer contre une valeur bien
                // moindre dans Protocole). Même repli : ne resserrer que pour MyFitnessPal.
                val hydrRecords = hc.readRecords(ReadRecordsRequest(HydrationRecord::class, range)).records
                    .groupBy { it.metadata.dataOrigin.packageName }
                    .flatMap { (src, recs) ->
                        if (src in WHOLE_DAY_SUMMARY_SOURCES) {
                            recs.groupBy { it.startTime }.values.map { grp -> grp.maxByOrNull { it.metadata.lastModifiedTime }!! }
                        } else {
                            recs
                        }
                    }
                hydrRecords.forEach { r ->
                    val d = days.getOrPut(dayOf(r.startTime)) { DayTotals() }
                    d.waterMl += r.volume.inMilliliters
                    d.hasWater = true
                }

                val out = JSArray()
                days.toSortedMap().forEach { (date, t) ->
                    out.put(
                        JSObject()
                            .put("date", date)
                            .put("hasNutrition", t.hasNutrition)
                            .put("hasWater", t.hasWater)
                            .put("kcal", t.kcal)
                            .put("protein", t.protein)
                            .put("carbs", t.carbs)
                            .put("fat", t.fat)
                            .put("fiber", t.fiber)
                            .put("waterMl", t.waterMl)
                    )
                }
                call.resolve(JSObject().put("days", out))
            } catch (e: Exception) {
                call.reject("Lecture nutrition impossible : ${e.message}")
            }
        }
    }

    private class DayTotals {
        var kcal = 0.0
        var protein = 0.0
        var carbs = 0.0
        var fat = 0.0
        var fiber = 0.0
        var waterMl = 0.0
        var hasNutrition = false
        var hasWater = false
    }
}
