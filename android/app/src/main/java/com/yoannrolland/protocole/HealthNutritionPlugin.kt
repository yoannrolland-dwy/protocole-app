package com.yoannrolland.protocole

import androidx.health.connect.client.HealthConnectClient
import androidx.health.connect.client.permission.HealthPermission
import androidx.health.connect.client.records.HydrationRecord
import androidx.health.connect.client.records.NutritionRecord
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
 * Lecture des macros complètes depuis Health Connect.
 *
 * Le plugin @capgo/capacitor-health lit bien NutritionRecord mais n'en expose que l'énergie.
 * Ce lecteur récupère en plus protéines / glucides / lipides / fibres, ainsi que l'hydratation,
 * pour alimenter l'onglet Macros sans saisie manuelle.
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

                hc.readRecords(ReadRecordsRequest(NutritionRecord::class, range)).records.forEach { r ->
                    val d = days.getOrPut(dayOf(r.startTime)) { DayTotals() }
                    r.energy?.inKilocalories?.let { d.kcal += it; d.hasNutrition = true }
                    r.protein?.inGrams?.let { d.protein += it; d.hasNutrition = true }
                    r.totalCarbohydrate?.inGrams?.let { d.carbs += it; d.hasNutrition = true }
                    r.totalFat?.inGrams?.let { d.fat += it; d.hasNutrition = true }
                    r.dietaryFiber?.inGrams?.let { d.fiber += it; d.hasNutrition = true }
                }

                hc.readRecords(ReadRecordsRequest(HydrationRecord::class, range)).records.forEach { r ->
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
