package com.yoannrolland.protocole.wear

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.wear.compose.foundation.pager.rememberPagerState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.TextUnit
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.wear.compose.foundation.lazy.ScalingLazyColumn
import androidx.wear.compose.foundation.lazy.ScalingLazyListAnchorType
import androidx.wear.compose.foundation.lazy.items
import androidx.wear.compose.foundation.lazy.rememberScalingLazyListState
import androidx.wear.compose.foundation.pager.HorizontalPager
import androidx.wear.compose.material3.HorizontalPageIndicator
import androidx.wear.compose.material3.MaterialTheme
import androidx.wear.compose.material3.Text
import androidx.wear.compose.material3.TimeText
import org.json.JSONObject
import java.time.LocalDate

// Jetons du design system v2 du téléphone (apps/perso/src/design/tokens.js), mêmes valeurs.
private val BG = Color(0xFF050505)
private val CARD = Color(0xFF131312)
private val RAISED = Color(0xFF22221F)
private val LINE = Color(0xFF34342F)
private val TEXT = Color(0xFFF5F5F0)
private val TEXT2 = Color(0xFFBDBDB4)
private val MUTED = Color(0xFF96968D)
private val ACCENT = Color(0xFFD7FF3F)
private val WARN = Color(0xFFF2A33A)
private val DANGER = Color(0xFFFF5A4F)
private val DANGER_BG = Color(0xFF1A0E0C)
private val MONO = FontFamily.Monospace

/** Couleur « #rrggbb » envoyée par le téléphone ; [fallback] si absente ou illisible. */
private fun col(s: String?, fallback: Color): Color = try {
    if (s.isNullOrEmpty()) fallback else Color(android.graphics.Color.parseColor(s))
} catch (e: IllegalArgumentException) {
    fallback
}

private fun JSONObject.str(k: String): String? = if (has(k) && !isNull(k)) optString(k).ifEmpty { null } else null

@Composable
fun WatchApp(snapshot: Snapshot?, wantedPage: Pair<String, Int>? = null) {
    MaterialTheme {
        Box(Modifier.fillMaxSize().background(BG)) {
            if (snapshot == null || snapshot.pages.isEmpty()) {
                Waiting()
            } else {
                Pages(snapshot, wantedPage)
            }
            TimeText()
        }
    }
}

@Composable
private fun Waiting() {
    Column(
        Modifier.fillMaxSize().padding(24.dp),
        verticalArrangement = Arrangement.Center,
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Text("PROTOCOLE", color = ACCENT, fontWeight = FontWeight.Bold, fontSize = 16.sp)
        Spacer(Modifier.height(8.dp))
        Text(
            "En attente du téléphone.\nOuvre PROTOCOLE sur le téléphone.",
            color = TEXT2, fontSize = 13.sp, textAlign = TextAlign.Center,
        )
    }
}

@Composable
private fun Pages(s: Snapshot, wantedPage: Pair<String, Int>?) {
    val pagerState = rememberPagerState { s.pages.size }
    // Toucher sur une carte : l'appli s'ouvre (ou revient) sur la page de cette carte.
    LaunchedEffect(wantedPage) {
        val i = s.pages.indexOfFirst { it.key == wantedPage?.first }
        if (i >= 0) pagerState.scrollToPage(i)
    }
    val (status, warn) = statusLine(s.date, s.at, s.stepsAt, LocalDate.now().toString(), s.version)
    Box(Modifier.fillMaxSize()) {
        HorizontalPager(state = pagerState, modifier = Modifier.fillMaxSize()) { index ->
            PageContent(s.pages[index], status, warn)
        }
        HorizontalPageIndicator(
            pagerState = pagerState,
            modifier = Modifier.align(Alignment.BottomCenter).padding(bottom = 4.dp),
        )
    }
}

@Composable
private fun PageContent(page: Page, status: String, warn: Boolean) {
    val listState = rememberScalingLazyListState(initialCenterItemIndex = 0)
    ScalingLazyColumn(
        modifier = Modifier.fillMaxSize(),
        state = listState,
        anchorType = ScalingLazyListAnchorType.ItemStart,
        autoCentering = null,
        contentPadding = PaddingValues(start = 14.dp, end = 14.dp, top = 30.dp, bottom = 44.dp),
        verticalArrangement = Arrangement.spacedBy(4.dp),
    ) {
        item {
            Column(Modifier.fillMaxWidth(), horizontalAlignment = Alignment.CenterHorizontally) {
                Text(page.title.uppercase(), color = ACCENT, fontWeight = FontWeight.Bold, fontSize = 15.sp, letterSpacing = 1.5.sp)
                Text(status, color = if (warn) WARN else MUTED, fontSize = 12.sp, textAlign = TextAlign.Center,
                    fontWeight = if (warn) FontWeight.Bold else FontWeight.Normal)
            }
        }
        items(page.items) { Block(it) }
    }
}

/** Un bloc de l'instantané. Un type inconnu (instantané plus récent que la montre) est ignoré. */
@Composable
private fun Block(b: JSONObject) {
    when (b.optString("t")) {
        "alert" -> Alert(b)
        "head" -> Head(b)
        "tile" -> Tile(b)
        "text" -> Para(b)
        "kv" -> KeyValue(b)
        "macros" -> Macros(b)
        "food" -> Food(b)
        "chart" -> Chart(b)
        "sep" -> Box(Modifier.fillMaxWidth().padding(vertical = 4.dp).height(1.dp).background(LINE))
        else -> Unit
    }
}

@Composable
private fun Alert(b: JSONObject) {
    Column(
        Modifier.fillMaxWidth().clip(RoundedCornerShape(12.dp)).background(DANGER_BG)
            .border(1.dp, DANGER, RoundedCornerShape(12.dp)).padding(10.dp)
    ) {
        Text(b.optString("title"), color = DANGER, fontWeight = FontWeight.Bold, fontSize = 13.sp)
        Text(b.optString("text"), color = TEXT2, fontSize = 12.sp)
    }
}

@Composable
private fun Head(b: JSONObject) {
    Text(
        b.optString("text").uppercase(), color = col(b.str("col"), MUTED), fontSize = 12.sp,
        fontWeight = FontWeight.Bold, letterSpacing = 1.sp, modifier = Modifier.fillMaxWidth().padding(top = 6.dp),
    )
}

@Composable
private fun Bar(pct: Int, color: Color, height: Int = 5) {
    Box(Modifier.fillMaxWidth().height(height.dp).clip(RoundedCornerShape(99.dp)).background(RAISED)) {
        Box(Modifier.fillMaxWidth(pct.coerceIn(0, 100) / 100f).height(height.dp).clip(RoundedCornerShape(99.dp)).background(color))
    }
}

@Composable
private fun Tile(b: JSONObject) {
    val big = b.optBoolean("big")
    Column(
        Modifier.fillMaxWidth().clip(RoundedCornerShape(14.dp)).background(CARD).padding(horizontal = 12.dp, vertical = 8.dp),
        verticalArrangement = Arrangement.spacedBy(2.dp),
    ) {
        Text(b.optString("label").uppercase(), color = col(b.str("labelCol"), MUTED), fontSize = 12.sp,
            fontWeight = FontWeight.Bold, letterSpacing = 1.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
        Row(verticalAlignment = Alignment.Bottom) {
            Text(b.optString("value"), color = col(b.str("valueCol"), TEXT), fontFamily = MONO,
                fontWeight = FontWeight.Bold, fontSize = if (big) 30.sp else 22.sp)
            b.str("unit")?.let {
                Spacer(Modifier.width(4.dp))
                Text(it, color = TEXT2, fontSize = 13.sp, fontWeight = FontWeight.SemiBold, modifier = Modifier.padding(bottom = 3.dp))
            }
        }
        b.optJSONObject("extra")?.let { e ->
            Text(e.optString("txt"), color = col(e.str("col"), TEXT), fontSize = 13.sp, fontWeight = FontWeight.Bold)
        }
        b.str("note")?.let { Text(it, color = TEXT2, fontSize = 12.sp) }
        if (b.has("pct")) Bar(b.optInt("pct"), col(b.str("barCol"), ACCENT))
    }
}

private fun size(b: JSONObject): TextUnit = when (b.optString("size")) {
    "s" -> 12.sp
    "l" -> 20.sp
    else -> 14.sp
}

@Composable
private fun Para(b: JSONObject) {
    Text(
        b.optString("text"), color = col(b.str("col"), TEXT), fontSize = size(b),
        fontWeight = if (b.optBoolean("bold")) FontWeight.Bold else FontWeight.Normal,
        fontFamily = if (b.optBoolean("mono")) MONO else FontFamily.Default,
        modifier = Modifier.fillMaxWidth(),
    )
}

@Composable
private fun KeyValue(b: JSONObject) {
    // `col` colore le libellé et la valeur (ex. séance à éviter), `valueCol` la valeur seule.
    val c = col(b.str("col"), TEXT)
    val valueColor = col(b.str("valueCol"), if (b.has("col")) c else TEXT2)
    val big = b.optBoolean("big")
    Column(Modifier.fillMaxWidth().padding(vertical = 2.dp)) {
        Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.Bottom) {
            Text(b.optString("label"), color = c, fontWeight = FontWeight.Bold,
                fontSize = if (big) 18.sp else 14.sp, modifier = Modifier.weight(1f))
            b.str("value")?.let {
                Spacer(Modifier.width(6.dp))
                Text(it, color = valueColor, fontFamily = MONO, fontWeight = FontWeight.Bold, fontSize = 13.sp, textAlign = TextAlign.End)
            }
        }
        b.str("note")?.let { Text(it, color = col(b.str("noteCol"), TEXT2), fontSize = 12.sp) }
    }
}

@Composable
private fun Macros(b: JSONObject) {
    val arr = b.optJSONArray("items") ?: return
    val cells = (0 until arr.length()).map { arr.getJSONObject(it) }
    // 2 × 2 sur la montre (4 colonnes sur le téléphone, trop étroit pour un écran rond).
    Column(Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(6.dp)) {
        cells.chunked(2).forEach { row ->
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                row.forEach { m ->
                    Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                        Text(m.optString("label").uppercase(), color = MUTED, fontSize = 12.sp, fontWeight = FontWeight.Bold)
                        Row(verticalAlignment = Alignment.Bottom) {
                            Text(m.optString("value"), color = col(m.str("col"), TEXT), fontFamily = MONO, fontWeight = FontWeight.Bold, fontSize = 16.sp)
                            Spacer(Modifier.width(3.dp))
                            Text(m.optString("target"), color = MUTED, fontFamily = MONO, fontSize = 12.sp, maxLines = 1)
                        }
                        Bar(m.optInt("pct"), col(m.str("barCol"), ACCENT), height = 4)
                    }
                }
                if (row.size == 1) Spacer(Modifier.weight(1f))
            }
        }
    }
}

@Composable
private fun Food(b: JSONObject) {
    Row(Modifier.fillMaxWidth().padding(vertical = 2.dp), verticalAlignment = Alignment.CenterVertically) {
        Column(Modifier.weight(1f)) {
            Text(b.optString("name"), color = TEXT, fontSize = 13.sp, fontWeight = FontWeight.SemiBold, maxLines = 2, overflow = TextOverflow.Ellipsis)
            Text(b.optString("detail"), color = TEXT2, fontFamily = MONO, fontSize = 12.sp)
        }
        Spacer(Modifier.width(6.dp))
        Text(b.optString("kcal"), color = ACCENT, fontFamily = MONO, fontWeight = FontWeight.Bold, fontSize = 14.sp)
    }
}

/** Courbe simplifiée : les points connus reliés, valeurs basse et haute en légende. */
@Composable
private fun Chart(b: JSONObject) {
    val arr = b.optJSONArray("points") ?: return
    val pts = (0 until arr.length()).map { if (arr.isNull(it)) null else arr.optDouble(it) }
    val known = pts.filterNotNull()
    if (known.size < 2) return
    val lo = b.optDouble("min", known.min()) - 50
    val hi = b.optDouble("max", known.max()) + 50
    val line = col(b.str("col"), ACCENT)
    Column(Modifier.fillMaxWidth()) {
        Canvas(Modifier.fillMaxWidth().height(60.dp).padding(vertical = 4.dp)) {
            val stepX = if (pts.size > 1) size.width / (pts.size - 1) else 0f
            fun y(v: Double) = (size.height * (1 - (v - lo) / (hi - lo))).toFloat()
            var prev: Offset? = null
            pts.forEachIndexed { i, v ->
                if (v == null) { prev = null; return@forEachIndexed }
                val p = Offset(i * stepX, y(v))
                prev?.let { drawLine(line, it, p, strokeWidth = 4f, cap = StrokeCap.Round) }
                drawCircle(TEXT, radius = 4f, center = p)
                prev = p
            }
        }
        Row(Modifier.fillMaxWidth()) {
            Text(b.optString("from"), color = MUTED, fontFamily = MONO, fontSize = 12.sp, modifier = Modifier.weight(1f))
            Text("${known.min().toInt()}–${known.max().toInt()}", color = TEXT2, fontFamily = MONO, fontSize = 12.sp)
            Text(b.optString("to"), color = MUTED, fontFamily = MONO, fontSize = 12.sp, textAlign = TextAlign.End, modifier = Modifier.weight(1f))
        }
    }
}
