package com.yoannrolland.protocole

import androidx.health.connect.client.HealthConnectClient
import androidx.health.connect.client.permission.HealthPermission
import androidx.health.connect.client.records.HydrationRecord
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
     * Renvoie, par date locale de réveil (yyyy-MM-dd), la durée de sommeil et une note de
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
     */
    @PluginMethod
    fun readSleep(call: PluginCall) {
        val hc = client() ?: run { call.reject("Health Connect indisponible"); return }
        val start = call.getString("startDate") ?: run { call.reject("startDate requis"); return }
        val end = call.getString("endDate") ?: run { call.reject("endDate requis"); return }

        scope.launch {
            try {
                val range = TimeRangeFilter.between(Instant.parse(start), Instant.parse(end))

                // Même précaution que pour les macros : une réinstallation d'app source pourrait
                // réécrire un historique sans purger l'ancien. On ne garde que l'enregistrement
                // le plus récemment écrit par (source, instant de début).
                val records = hc.readRecords(ReadRecordsRequest(SleepSessionRecord::class, range))
                    .records
                    .groupBy { "${it.metadata.dataOrigin.packageName}|${it.startTime}" }
                    .values.map { grp -> grp.maxByOrNull { it.metadata.lastModifiedTime }!! }

                fun dayOf(instant: Instant) =
                    instant.atZone(java.time.ZoneId.systemDefault()).toLocalDate().toString()

                val out = JSObject()
                records.forEach { r ->
                    val periodeMin = (r.endTime.epochSecond - r.startTime.epochSecond) / 60.0

                    // STAGE_TYPE_AWAKE=1, OUT_OF_BED=3, AWAKE_IN_BED=7 (androidx.health.connect) :
                    // à exclure de la durée de sommeil réelle.
                    val asleepMin = r.stages
                        .filter { it.stage !in setOf(1, 3, 7) }
                        .sumOf { (it.endTime.epochSecond - it.startTime.epochSecond) / 60.0 }

                    val hasStages = r.stages.isNotEmpty()
                    val hours = if (hasStages) asleepMin / 60.0 else periodeMin / 60.0

                    // Grille calibrée sur UN point de référence réel (28/07/2026) : 92,6%
                    // d'efficacité + 6h56 de sommeil réel → Samsung Health a donné 90/100
                    // "Excellent". Le seuil de durée initial (7h) était trop strict pour ce
                    // cas — abaissé de 30 min à chaque palier. Un seul point de calibration :
                    // à resserrer si de nouveaux scores Samsung Health la contredisent.
                    val quality: Int? = if (!hasStages) null else {
                        val efficacite = asleepMin / periodeMin
                        when {
                            efficacite >= 0.90 && asleepMin >= 390 -> 4  // Excellent
                            efficacite >= 0.80 && asleepMin >= 330 -> 3  // Bon
                            efficacite >= 0.65 || asleepMin >= 270 -> 2  // Correct
                            else -> 1                                    // Attention requise
                        }
                    }

                    val entry = JSObject()
                        .put("hours", hours)
                        .put("dureeReelle", hasStages)
                    if (quality != null) entry.put("quality", quality)
                    out.put(dayOf(r.endTime), entry)
                }
                call.resolve(JSObject().put("days", out))
            } catch (e: Exception) {
                call.reject("Lecture sommeil impossible : ${e.message}")
            }
        }
    }

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
    fun readWeight(call: PluginCall) {
        val hc = client() ?: run { call.reject("Health Connect indisponible"); return }
        val start = call.getString("startDate") ?: run { call.reject("startDate requis"); return }
        val end = call.getString("endDate") ?: run { call.reject("endDate requis"); return }

        scope.launch {
            try {
                val range = TimeRangeFilter.between(Instant.parse(start), Instant.parse(end))

                fun dayOf(instant: Instant) =
                    instant.atZone(java.time.ZoneId.systemDefault()).toLocalDate().toString()

                // Même précaution que macros/sommeil : dédoublonne par (source, instant),
                // garde le plus récemment écrit.
                val records = hc.readRecords(ReadRecordsRequest(WeightRecord::class, range)).records
                    .groupBy { "${it.metadata.dataOrigin.packageName}|${it.time}" }
                    .values.map { grp -> grp.maxByOrNull { it.metadata.lastModifiedTime }!! }

                val out = JSObject()
                records.groupBy { dayOf(it.time) }.forEach { (day, recs) ->
                    // Plusieurs pesées le même jour : on garde la plus récente dans la journée.
                    val latest = recs.maxByOrNull { it.time }!!
                    out.put(day, Math.round(latest.weight.inKilograms * 100) / 100.0)
                }
                call.resolve(JSObject().put("days", out))
            } catch (e: Exception) {
                call.reject("Lecture poids impossible : ${e.message}")
            }
        }
    }

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
                fun <T> dedupe(records: List<T>, key: (T) -> String, modifiedAt: (T) -> Instant) =
                    records.groupBy(key).values.map { grp -> grp.maxByOrNull(modifiedAt)!! }

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
                val WHOLE_DAY_SUMMARY_SOURCES = setOf("com.myfitnesspal.android")

                fun nutritionExactKey(r: NutritionRecord) = listOf(
                    r.metadata.dataOrigin.packageName, r.startTime,
                    r.energy?.inKilocalories, r.protein?.inGrams, r.totalCarbohydrate?.inGrams,
                    r.totalFat?.inGrams, r.dietaryFiber?.inGrams,
                ).joinToString("|")

                val nutriRecords = hc.readRecords(ReadRecordsRequest(NutritionRecord::class, range)).records
                    // 1) Retire les doublons stricts (mêmes valeurs, même instant, même source) —
                    //    écritures répétées identiques, vues avec Cronometer (deux écritures à
                    //    46 ms d'intervalle pour le même repas).
                    .groupBy { nutritionExactKey(it) }.values.map { grp -> grp.maxByOrNull { it.metadata.lastModifiedTime }!! }
                    // 2) Repas distincts au même instant nominal (Cronometer) : gardés tels quels,
                    //    additionnés plus bas. Total de journée réécrit (MyFitnessPal) : ne garder
                    //    que la version la plus récente par (source + début).
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

                val hydrRecords = dedupe(
                    hc.readRecords(ReadRecordsRequest(HydrationRecord::class, range)).records,
                    { "${it.metadata.dataOrigin.packageName}|${it.startTime}" },
                    { it.metadata.lastModifiedTime },
                )
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
