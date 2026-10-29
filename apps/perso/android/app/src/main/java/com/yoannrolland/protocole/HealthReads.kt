package com.yoannrolland.protocole

import androidx.health.connect.client.HealthConnectClient
import androidx.health.connect.client.records.HeartRateRecord
import androidx.health.connect.client.records.SleepSessionRecord
import androidx.health.connect.client.records.WeightRecord
import androidx.health.connect.client.request.ReadRecordsRequest
import androidx.health.connect.client.time.TimeRangeFilter
import com.getcapacitor.JSObject
import java.time.Instant
import java.time.ZoneId

/**
 * Lectures Health Connect de la nuit, de la pesée et de la FC repos (déplacées depuis
 * HealthNutritionPlugin le 29/10/2026, calculs inchangés) : le plugin les appelle depuis l'app, et
 * le brief du matin (BriefRunner, J4.1) app fermée. Les résultats ont la forme que le JS attend
 * (healthSync.js, packages/core/src/healthMerge.js).
 */
object HealthReads {

    /**
     * `readRecords` pagine par défaut à 1000 enregistrements (`ReadRecordsRequest.pageSize`)
     * et ne renvoie que la première page si on ignore `pageToken` — sans conséquence pour
     * poids/sommeil/nutrition (quelques enregistrements par jour), mais silencieusement FAUX
     * pour la FC continue (`HeartRateRecord`) : sur 14 jours, largement plus de 1000
     * enregistrements existent, triés du plus ANCIEN au plus récent — la première page
     * s'arrêtait donc pile avant les données du jour même. Bug trouvé le 05/09/2026 (les
     * FC repos de tous les jours SAUF aujourd'hui apparaissaient). Boucle sur toutes les
     * pages tant que `pageToken` n'est pas vide.
     */
    suspend fun <T : androidx.health.connect.client.records.Record> readAllRecords(
        hc: HealthConnectClient, recordType: kotlin.reflect.KClass<T>, range: TimeRangeFilter
    ): List<T> {
        val all = mutableListOf<T>()
        var pageToken: String? = null
        do {
            val resp = hc.readRecords(ReadRecordsRequest(recordType, range, pageToken = pageToken))
            all.addAll(resp.records)
            pageToken = resp.pageToken
        } while (!pageToken.isNullOrEmpty())
        return all
    }

    /**
     * Sieste (23/09/2026, gestion des siestes) : une session dont l'heure de DÉBUT tombe
     * l'après-midi (12h-18h, jamais une heure de coucher plausible même après un match tardif)
     * n'est pas une vraie nuit — la montre l'enregistre pourtant comme n'importe quel
     * `SleepSessionRecord`. Sans ce tri, le découpage "jour de sommeil" (fenêtre midi-midi,
     * voir `sleep()`) la fusionnait silencieusement dans la nuit SUIVANTE (une sieste à
     * 14h tombe dans la fenêtre qui se termine à midi le lendemain), faussant sa durée/qualité
     * ET la FC repos calculée dessus (`restingHr`).
     */
    private fun isNap(r: SleepSessionRecord): Boolean {
        val hour = r.startTime.atZone(ZoneId.systemDefault()).hour
        return hour in 12..17
    }

    private fun calendarDayOf(instant: Instant): String =
        instant.atZone(ZoneId.systemDefault()).toLocalDate().toString()

    // Jour de sommeil = fenêtre de midi (veille) à midi (jour même), pas le jour calendaire
    // strict : avant midi, on reste sur le jour en cours (fin de nuit) ; à partir de midi, on
    // bascule sur le lendemain (début de nuit). Un segment qui finit à 23h50 et un autre qui
    // commence à 00h10 tombent ainsi dans le MÊME panier au lieu d'être coupés en deux.
    private fun sleepDayOf(instant: Instant): String {
        val zdt = instant.atZone(ZoneId.systemDefault())
        val d = if (zdt.hour < 12) zdt.toLocalDate() else zdt.toLocalDate().plusDays(1)
        return d.toString()
    }

    // STAGE_TYPE_AWAKE=1, OUT_OF_BED=3, AWAKE_IN_BED=7 (androidx.health.connect), exclus du
    // temps réellement endormi. Repli sur la période brute si aucune phase n'est disponible —
    // même logique que la boucle de nuit dans `sleep()`.
    private fun asleepMinutes(r: SleepSessionRecord): Double {
        val periodeMin = (r.endTime.epochSecond - r.startTime.epochSecond) / 60.0
        if (r.stages.isEmpty()) return periodeMin
        return r.stages.filter { it.stage !in setOf(1, 3, 7) }
            .sumOf { (it.endTime.epochSecond - it.startTime.epochSecond) / 60.0 }
    }

    /** Nuits par jour de sommeil { days: { date: { hours, dureeReelle, quality? } }, naps: { date: minutes } }.
     *  Documentation complète du calcul : HealthNutritionPlugin.readSleep. */
    suspend fun sleep(hc: HealthConnectClient, range: TimeRangeFilter): JSObject {
        // Même précaution que pour les macros : une réinstallation d'app source pourrait
        // réécrire un historique sans purger l'ancien. On ne garde que l'enregistrement
        // le plus récemment écrit par (source, instant de début).
        val allRecords = hc.readRecords(ReadRecordsRequest(SleepSessionRecord::class, range))
            .records
            .groupBy { "${it.metadata.dataOrigin.packageName}|${it.startTime}" }
            .values.map { grp -> grp.maxByOrNull { it.metadata.lastModifiedTime }!! }

        // Siestes détectées séparément (voir isNap()) : exclues du calcul de nuit ci-dessous,
        // sommées à part sous leur propre date CALENDAIRE.
        val (napRecords, records) = allRecords.partition { isNap(it) }
        val napsOut = JSObject()
        napRecords.groupBy { calendarDayOf(it.startTime) }.forEach { (day, group) ->
            napsOut.put(day, Math.round(group.sumOf { asleepMinutes(it) }).toInt())
        }

        val out = JSObject()
        records.groupBy { sleepDayOf(it.endTime) }.forEach { (day, group) ->
            var totalHours = 0.0
            var asleepMinSum = 0.0
            var periodeMinSum = 0.0
            var anyStages = false

            group.forEach { r ->
                val periodeMin = (r.endTime.epochSecond - r.startTime.epochSecond) / 60.0
                val asleepMin = r.stages
                    .filter { it.stage !in setOf(1, 3, 7) }
                    .sumOf { (it.endTime.epochSecond - it.startTime.epochSecond) / 60.0 }
                val hasStages = r.stages.isNotEmpty()
                totalHours += if (hasStages) asleepMin / 60.0 else periodeMin / 60.0
                if (hasStages) {
                    asleepMinSum += asleepMin
                    periodeMinSum += periodeMin
                    anyStages = true
                }
            }

            // Grille de qualité (seuil « Excellent » à 6 h depuis le 14/08/2026, short sleeper),
            // recalculée sur les totaux du panier : une nuit fractionnée a UNE seule note.
            val quality: Int? = if (!anyStages || periodeMinSum <= 0) null else {
                val efficacite = asleepMinSum / periodeMinSum
                when {
                    efficacite >= 0.90 && asleepMinSum >= 360 -> 4  // Excellent
                    efficacite >= 0.80 && asleepMinSum >= 330 -> 3  // Bon
                    efficacite >= 0.65 || asleepMinSum >= 270 -> 2  // Correct
                    else -> 1                                       // Attention requise
                }
            }

            val entry = JSObject()
                .put("hours", totalHours)
                .put("dureeReelle", anyStages)
            if (quality != null) entry.put("quality", quality)
            out.put(day, entry)
        }
        return JSObject().put("days", out).put("naps", napsOut)
    }

    /** Dernière pesée par date locale { days: { date: kg }, times: { date: "HH:mm" } }. */
    suspend fun weight(hc: HealthConnectClient, range: TimeRangeFilter): JSObject {
        // Dédoublonne par (source, instant), garde le plus récemment écrit.
        val records = hc.readRecords(ReadRecordsRequest(WeightRecord::class, range)).records
            .groupBy { "${it.metadata.dataOrigin.packageName}|${it.time}" }
            .values.map { grp -> grp.maxByOrNull { it.metadata.lastModifiedTime }!! }

        val out = JSObject()
        val times = JSObject()
        val hm = java.time.format.DateTimeFormatter.ofPattern("HH:mm")
        records.groupBy { calendarDayOf(it.time) }.forEach { (day, recs) ->
            // Plusieurs pesées le même jour : on garde la plus récente dans la journée.
            val latest = recs.maxByOrNull { it.time }!!
            out.put(day, Math.round(latest.weight.inKilograms * 100) / 100.0)
            times.put(day, latest.time.atZone(ZoneId.systemDefault()).format(hm))
        }
        return JSObject().put("days", out).put("times", times)
    }

    /** FC repos maison par jour de sommeil { days: { date: bpm } } : moyenne de la FC continue
     *  pendant le sommeil réel. Documentation complète : HealthNutritionPlugin.readRestingHeartRate. */
    suspend fun restingHr(hc: HealthConnectClient, range: TimeRangeFilter): JSObject {
        // Siestes exclues : leur FC fausserait la FC repos de la nuit suivante.
        val sleepRecords = readAllRecords(hc, SleepSessionRecord::class, range)
            .groupBy { "${it.metadata.dataOrigin.packageName}|${it.startTime}" }
            .values.map { grp -> grp.maxByOrNull { it.metadata.lastModifiedTime }!! }
            .filterNot { isNap(it) }

        if (sleepRecords.isEmpty()) return JSObject().put("days", JSObject())

        // Fenêtre de lecture FC élargie de 2 h de part et d'autre du sommeil connu.
        val hrStart = sleepRecords.minOf { it.startTime }.minusSeconds(2 * 3600)
        val hrEnd = sleepRecords.maxOf { it.endTime }.plusSeconds(2 * 3600)
        val hrSamples = readAllRecords(hc, HeartRateRecord::class, TimeRangeFilter.between(hrStart, hrEnd))
            .flatMap { it.samples }

        val out = JSObject()
        sleepRecords.groupBy { sleepDayOf(it.endTime) }.forEach { (day, group) ->
            val windows = group.flatMap { r ->
                val asleep = r.stages.filter { it.stage !in setOf(1, 3, 7) }
                if (asleep.isNotEmpty()) asleep.map { it.startTime to it.endTime }
                else listOf(r.startTime to r.endTime)
            }
            val inWindow = hrSamples.filter { s -> windows.any { (a, b) -> !s.time.isBefore(a) && !s.time.isAfter(b) } }
            if (inWindow.isNotEmpty()) out.put(day, Math.round(inWindow.map { it.beatsPerMinute }.average()).toInt())
        }
        return JSObject().put("days", out)
    }
}
