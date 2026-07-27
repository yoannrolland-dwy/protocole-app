package com.yoannrolland.protocole

import androidx.health.connect.client.HealthConnectClient
import androidx.health.connect.client.permission.HealthPermission
import androidx.health.connect.client.records.HydrationRecord
import androidx.health.connect.client.records.NutritionRecord
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
