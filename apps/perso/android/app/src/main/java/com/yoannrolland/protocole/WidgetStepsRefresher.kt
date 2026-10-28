package com.yoannrolland.protocole

import android.content.Context
import androidx.health.connect.client.HealthConnectClient
import androidx.health.connect.client.HealthConnectFeatures
import androidx.health.connect.client.permission.HealthPermission
import androidx.health.connect.client.records.StepsRecord
import androidx.health.connect.client.request.ReadRecordsRequest
import androidx.health.connect.client.time.TimeRangeFilter
import java.text.NumberFormat
import java.time.Duration
import java.time.Instant
import java.time.LocalDate
import java.time.LocalTime
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.Locale

/**
 * Pas du jour relus par le widget lui-même (28/10/2026), sans ouvrir l'app : Android réveille
 * le widget toutes les 30 min (`updatePeriodMillis`, dashboard_widget_info.xml) et
 * DashboardWidgetProvider.onUpdate appelle refresh(). Avant, le widget ne changeait que quand
 * l'app tournait (ouverture, retour au premier plan, bouton Sync).
 *
 * Seulement les pas : calories et eau viennent du journal de l'app, le score d'énergie de son
 * calcul JS — les recalculer ici ferait deux vérités. L'app réécrit tout à sa prochaine ouverture.
 *
 * Même règle que packages/core/src/steps.js (stepsByLocalDay) : chaque enregistrement compte
 * pour la date locale de son MILIEU, sommé par source, puis la source la plus haute. Jamais
 * l'agrégation par tranches de 24 h (bug du changement d'heure du 25/10/2026).
 *
 * Lire Health Connect hors de l'app demande, depuis Android 14, la permission « accès en
 * arrière-plan » (READ_HEALTH_DATA_IN_BACKGROUND), accordée dans Réglages de l'app. Sans elle,
 * refresh() ne fait rien et le widget garde les dernières valeurs envoyées par l'app.
 */
object WidgetStepsRefresher {
    const val STEPS_TARGET = 10_000
    private const val ACCENT = "#d7ff3f"
    private const val OVER = "#5ab4ff"

    val STEPS_PERMISSION = HealthPermission.getReadPermission(StepsRecord::class)
    const val BACKGROUND_PERMISSION = HealthPermission.PERMISSION_READ_HEALTH_DATA_IN_BACKGROUND

    fun client(context: Context): HealthConnectClient? =
        if (HealthConnectClient.getSdkStatus(context) == HealthConnectClient.SDK_AVAILABLE)
            HealthConnectClient.getOrCreate(context)
        else null

    /** Vrai si ce Health Connect sait lire en arrière-plan (Android 14+ ou module à jour). */
    fun backgroundSupported(hc: HealthConnectClient): Boolean =
        hc.features.getFeatureStatus(HealthConnectFeatures.FEATURE_READ_HEALTH_DATA_IN_BACKGROUND) ==
            HealthConnectFeatures.FEATURE_STATUS_AVAILABLE

    /** Relit les pas du jour et met le widget à jour. Faux si rien n'a été écrit. */
    suspend fun refresh(context: Context): Boolean {
        val hc = client(context) ?: return false
        if (!backgroundSupported(hc)) return false
        val granted = hc.permissionController.getGrantedPermissions()
        if (!granted.containsAll(setOf(STEPS_PERMISSION, BACKGROUND_PERMISSION))) return false

        val zone = ZoneId.systemDefault()
        val todayDate = LocalDate.now(zone)
        val now = Instant.now()
        // Un jour de marge avant minuit : un total journalier dont les bornes débordent sur la
        // veille doit être lu pour que son milieu tombe bien sur aujourd'hui.
        val start = todayDate.minusDays(1).atStartOfDay(zone).toInstant()
        val bySource = HashMap<String, Long>()
        var pageToken: String? = null
        do {
            val resp = hc.readRecords(
                ReadRecordsRequest(StepsRecord::class, TimeRangeFilter.between(start, now), pageToken = pageToken)
            )
            for (r in resp.records) {
                val mid = r.startTime.plus(Duration.between(r.startTime, r.endTime).dividedBy(2))
                if (mid.atZone(zone).toLocalDate() != todayDate) continue
                val src = r.metadata.dataOrigin.packageName
                bySource[src] = (bySource[src] ?: 0L) + r.count
            }
            pageToken = resp.pageToken
        } while (!pageToken.isNullOrEmpty())
        val steps = (bySource.values.maxOrNull() ?: 0L).toInt()

        // Mêmes règles que l'instantané JS (App.jsx) : chiffre blanc tant que la cible n'est pas
        // atteinte, bleu ensuite ; barre citron en cours, bleue une fois la cible atteinte.
        val reached = steps >= STEPS_TARGET
        val prefs = context.getSharedPreferences(WidgetBridgePlugin.PREFS, Context.MODE_PRIVATE)
        prefs.edit()
            .putString("pas_value", NumberFormat.getIntegerInstance(Locale.FRANCE).format(steps))
            .putString("pas_color", if (reached) OVER else "")
            // Arrondi comme le JS (Math.round), sinon la barre perd un point à chaque réveil.
            .putInt("pas_bar", Math.round(steps * 100.0 / STEPS_TARGET).toInt().coerceIn(0, 100))
            .putString("pas_barColor", if (reached) OVER else ACCENT)
            .putString("sync_note", "MAJ " + LocalTime.now(zone).format(DateTimeFormatter.ofPattern("HH:mm")))
            .apply()
        return true
    }
}
