package com.yoannrolland.protocole.wear

import androidx.wear.protolayout.ActionBuilders
import androidx.wear.protolayout.ColorBuilders.argb
import androidx.wear.protolayout.DimensionBuilders.dp
import androidx.wear.protolayout.DimensionBuilders.expand
import androidx.wear.protolayout.DimensionBuilders.sp
import androidx.wear.protolayout.LayoutElementBuilders
import androidx.wear.protolayout.LayoutElementBuilders.Box
import androidx.wear.protolayout.LayoutElementBuilders.Column
import androidx.wear.protolayout.LayoutElementBuilders.FontStyle
import androidx.wear.protolayout.LayoutElementBuilders.LayoutElement
import androidx.wear.protolayout.LayoutElementBuilders.Row
import androidx.wear.protolayout.LayoutElementBuilders.Spacer
import androidx.wear.protolayout.LayoutElementBuilders.Text
import androidx.wear.protolayout.ModifiersBuilders.Background
import androidx.wear.protolayout.ModifiersBuilders.Clickable
import androidx.wear.protolayout.ModifiersBuilders.Corner
import androidx.wear.protolayout.ModifiersBuilders.Modifiers
import androidx.wear.protolayout.ResourceBuilders
import androidx.wear.protolayout.TimelineBuilders
import androidx.wear.tiles.RequestBuilders
import androidx.wear.tiles.TileBuilders
import androidx.wear.tiles.TileService
import com.google.common.util.concurrent.Futures
import com.google.common.util.concurrent.ListenableFuture
import org.json.JSONObject
import java.time.LocalDate

/**
 * Cartes de la montre (17/11/2026) : les écrans qu'on fait défiler à côté du cadran. Trois cartes,
 * une par page de l'appli (choix de Yoann) ; chacune tient sur un écran, sans défilement, et un
 * toucher ouvre l'appli sur la page correspondante. Comme l'appli, une carte ne calcule rien : elle
 * dessine les lignes `cards.<clé>.rows` préparées par le téléphone (src/lib/watchSnapshot.js).
 */
class BordTileService : CardTileService("bord", "BORD")
class JournalTileService : CardTileService("journal", "JOURNAL")
class DepenseTileService : CardTileService("depense", "DÉPENSE")

// Jetons du design system du téléphone (mêmes valeurs que Ui.kt).
private const val TEXT = 0xFFF5F5F0.toInt()
private const val TEXT2 = 0xFFBDBDB4.toInt()
private const val MUTED = 0xFF96968D.toInt()
private const val ACCENT = 0xFFD7FF3F.toInt()
private const val WARN = 0xFFF2A33A.toInt()
private const val RAISED = 0xFF34342F.toInt()

// Écran rond de 226 points : la largeur utile diminue vers le haut et le bas.
private const val WIDE = 172f
private const val NARROW = 150f

private fun col(s: String?, fallback: Int): Int = try {
    if (s.isNullOrEmpty()) fallback else android.graphics.Color.parseColor(s)
} catch (e: IllegalArgumentException) {
    fallback
}

private fun JSONObject.str(k: String): String? = if (has(k) && !isNull(k)) optString(k).ifEmpty { null } else null

private fun text(s: String, size: Float, color: Int, bold: Boolean = false): Text =
    Text.Builder()
        .setText(s)
        .setMaxLines(1)
        .setOverflow(LayoutElementBuilders.TEXT_OVERFLOW_ELLIPSIZE_END)
        .setFontStyle(
            FontStyle.Builder().setSize(sp(size)).setColor(argb(color))
                .setWeight(if (bold) LayoutElementBuilders.FONT_WEIGHT_BOLD else LayoutElementBuilders.FONT_WEIGHT_NORMAL)
                .build()
        ).build()

private fun gap(h: Float): Spacer = Spacer.Builder().setHeight(dp(h)).build()
private fun hgap(w: Float): Spacer = Spacer.Builder().setWidth(dp(w)).build()

private fun fill(color: Int): Modifiers = Modifiers.Builder()
    .setBackground(Background.Builder().setColor(argb(color)).setCorner(Corner.Builder().setRadius(dp(2f)).build()).build())
    .build()

/** Barre d'avancement de [width] points, remplie à [pct] %. */
private fun bar(pct: Int, color: Int, width: Float): LayoutElement {
    val done = (width * pct.coerceIn(0, 100) / 100f).coerceAtLeast(0f)
    val track = Box.Builder().setWidth(dp(width)).setHeight(dp(4f)).setModifiers(fill(RAISED))
        .setHorizontalAlignment(LayoutElementBuilders.HORIZONTAL_ALIGN_START)
    if (done >= 1f) track.addContent(Box.Builder().setWidth(dp(done)).setHeight(dp(4f)).setModifiers(fill(color)).build())
    return track.build()
}

/** Deux grands chiffres côte à côte (Énergie et Poids). */
private fun pair(b: JSONObject): LayoutElement {
    val row = Row.Builder().setVerticalAlignment(LayoutElementBuilders.VERTICAL_ALIGN_TOP)
    val items = b.optJSONArray("items") ?: return row.build()
    for (i in 0 until items.length()) {
        val it = items.getJSONObject(i)
        val c = Column.Builder().setWidth(dp(WIDE / 2)).setHorizontalAlignment(LayoutElementBuilders.HORIZONTAL_ALIGN_CENTER)
            .addContent(text(it.optString("label").uppercase(), 11f, MUTED, bold = true))
            .addContent(text(it.optString("value"), 28f, TEXT, bold = true))
        val extra = it.optJSONObject("extra")
        c.addContent(
            if (extra != null) text(extra.optString("txt"), 11f, col(extra.str("col"), TEXT), bold = true)
            else text(it.str("unit") ?: "", 11f, TEXT2)
        )
        row.addContent(c.build())
    }
    return row.build()
}

/** Un grand chiffre : calories du jour, dépense estimée. */
private fun hero(b: JSONObject): LayoutElement {
    val c = Column.Builder().setHorizontalAlignment(LayoutElementBuilders.HORIZONTAL_ALIGN_CENTER)
    b.str("label")?.let { c.addContent(text(it.uppercase(), 11f, col(b.str("labelCol"), MUTED), bold = true)) }
    val line = Row.Builder().setVerticalAlignment(LayoutElementBuilders.VERTICAL_ALIGN_BOTTOM)
        .addContent(text(b.optString("value"), 30f, TEXT, bold = true))
    b.str("unit")?.let { line.addContent(hgap(4f)).addContent(text(it, 12f, TEXT2)) }
    c.addContent(line.build())
    b.str("note")?.let { c.addContent(text(it, 12f, TEXT2)) }
    b.optJSONObject("extra")?.let { c.addContent(text(it.optString("txt"), 13f, col(it.str("col"), TEXT), bold = true)) }
    if (b.has("pct")) c.addContent(gap(3f)).addContent(bar(b.optInt("pct"), col(b.str("barCol"), ACCENT), NARROW))
    return c.build()
}

/** Une ligne « LIBELLÉ valeur / cible » et sa barre : Kcal, Pas, Eau. */
private fun stat(b: JSONObject): LayoutElement {
    val line = Row.Builder().setWidth(dp(NARROW)).setVerticalAlignment(LayoutElementBuilders.VERTICAL_ALIGN_BOTTOM)
        .addContent(Box.Builder().setWidth(dp(38f)).setHorizontalAlignment(LayoutElementBuilders.HORIZONTAL_ALIGN_START)
            .addContent(text(b.optString("label"), 11f, MUTED, bold = true)).build())
        .addContent(text(b.optString("value"), 14f, col(b.str("valueCol"), TEXT), bold = true))
    b.str("note")?.let { line.addContent(hgap(4f)).addContent(text(it, 11f, TEXT2)) }
    return Column.Builder().setHorizontalAlignment(LayoutElementBuilders.HORIZONTAL_ALIGN_START)
        .addContent(line.build()).addContent(gap(1f)).addContent(bar(b.optInt("pct"), col(b.str("barCol"), ACCENT), NARROW))
        .build()
}

/** Quatre macros, 2 × 2. */
private fun grid(b: JSONObject): LayoutElement {
    val c = Column.Builder()
    val items = b.optJSONArray("items") ?: return c.build()
    var row: Row.Builder? = null
    for (i in 0 until items.length()) {
        val m = items.getJSONObject(i)
        if (i % 2 == 0) row = Row.Builder().setVerticalAlignment(LayoutElementBuilders.VERTICAL_ALIGN_BOTTOM)
        row!!.addContent(
            Box.Builder().setWidth(dp(WIDE / 2)).setHorizontalAlignment(LayoutElementBuilders.HORIZONTAL_ALIGN_START).addContent(
                Row.Builder().setVerticalAlignment(LayoutElementBuilders.VERTICAL_ALIGN_BOTTOM)
                    .addContent(text(m.optString("label"), 11f, MUTED, bold = true)).addContent(hgap(4f))
                    .addContent(text(m.optString("value"), 14f, col(m.str("col"), TEXT), bold = true)).addContent(hgap(2f))
                    .addContent(text(m.optString("target"), 11f, MUTED)).build()
            ).build()
        )
        if (i % 2 == 1 || i == items.length() - 1) c.addContent(row.build()).addContent(gap(2f))
    }
    return c.build()
}

/** Libellé à gauche, valeur à droite. */
private fun line(b: JSONObject): LayoutElement =
    Row.Builder().setWidth(dp(NARROW)).setVerticalAlignment(LayoutElementBuilders.VERTICAL_ALIGN_BOTTOM)
        .addContent(Box.Builder().setWidth(expand()).setHorizontalAlignment(LayoutElementBuilders.HORIZONTAL_ALIGN_START)
            .addContent(text(b.optString("label"), 12f, TEXT2)).build())
        .addContent(text(b.optString("value"), 13f, col(b.str("valueCol") ?: b.str("noteCol"), TEXT), bold = true))
        .build()

abstract class CardTileService(private val key: String, private val title: String) : TileService() {

    override fun onTileRequest(requestParams: RequestBuilders.TileRequest): ListenableFuture<TileBuilders.Tile> {
        val tile = TileBuilders.Tile.Builder()
            .setResourcesVersion("1")
            // Redessinée à chaque nouvel instantané (SnapshotStore.save) ; sinon toutes les 30 min,
            // pour que « Chiffres du 16/11 » apparaisse si le téléphone n'a rien envoyé depuis la veille.
            .setFreshnessIntervalMillis(30 * 60 * 1000L)
            .setTileTimeline(TimelineBuilders.Timeline.fromLayoutElement(layout(SnapshotStore.load(this))))
            .build()
        return Futures.immediateFuture(tile)
    }

    override fun onTileResourcesRequest(requestParams: RequestBuilders.ResourcesRequest): ListenableFuture<ResourceBuilders.Resources> =
        Futures.immediateFuture(ResourceBuilders.Resources.Builder().setVersion("1").build())

    private fun layout(s: Snapshot?): LayoutElement {
        val c = Column.Builder().setHorizontalAlignment(LayoutElementBuilders.HORIZONTAL_ALIGN_CENTER)
        val rows = s?.cards?.get(key)
        if (s == null || rows.isNullOrEmpty()) {
            c.addContent(text("PROTOCOLE · $title", 12f, ACCENT, bold = true)).addContent(gap(6f))
                .addContent(text("Ouvre PROTOCOLE", 13f, TEXT2)).addContent(text("sur le téléphone", 13f, TEXT2))
        } else {
            val (status, warn) = cardStatus(s.date, s.at, LocalDate.now().toString(), s.version)
            c.addContent(
                Row.Builder().setVerticalAlignment(LayoutElementBuilders.VERTICAL_ALIGN_BOTTOM)
                    .addContent(text(title, 12f, ACCENT, bold = true)).addContent(hgap(6f))
                    .addContent(text(status, 11f, if (warn) WARN else MUTED, bold = warn)).build()
            ).addContent(gap(5f))
            for (b in rows) {
                val el = when (b.optString("t")) {
                    "pair" -> pair(b)
                    "hero" -> hero(b)
                    "stat" -> stat(b)
                    "grid" -> grid(b)
                    "line" -> line(b)
                    else -> null // type inconnu (téléphone plus récent que la montre) : ignoré
                } ?: continue
                c.addContent(el).addContent(gap(5f))
            }
        }
        // Toute la carte se touche : elle ouvre l'appli sur la page correspondante.
        val open = Clickable.Builder().setId("ouvrir-$key").setOnClick(
            ActionBuilders.LaunchAction.Builder().setAndroidActivity(
                ActionBuilders.AndroidActivity.Builder()
                    .setPackageName(packageName)
                    .setClassName(MainActivity::class.java.name)
                    .addKeyToExtraMapping(MainActivity.EXTRA_PAGE, ActionBuilders.stringExtra(key))
                    .build()
            ).build()
        ).build()
        return Box.Builder().setWidth(expand()).setHeight(expand())
            .setHorizontalAlignment(LayoutElementBuilders.HORIZONTAL_ALIGN_CENTER)
            .setVerticalAlignment(LayoutElementBuilders.VERTICAL_ALIGN_CENTER)
            .setModifiers(Modifiers.Builder().setClickable(open).build())
            .addContent(c.build())
            .build()
    }
}
