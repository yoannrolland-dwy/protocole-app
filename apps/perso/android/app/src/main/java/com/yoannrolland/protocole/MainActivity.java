package com.yoannrolland.protocole;

import android.content.Intent;
import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Lecteur natif des macros complètes depuis Health Connect (voir HealthNutritionPlugin.kt)
        registerPlugin(HealthNutritionPlugin.class);
        // Notifications du minuteur de repos : son sur le volume alarme + décompte
        // persistant dans la barre d'état (voir RestTimerPlugin.kt)
        registerPlugin(RestTimerPlugin.class);
        // Pont vers le widget d'écran d'accueil (voir WidgetBridgePlugin.kt)
        registerPlugin(WidgetBridgePlugin.class);
        // Relais HTTP en flux vers LiteLLM pour Jeffrey (voir JeffreyHttpPlugin.kt)
        registerPlugin(JeffreyHttpPlugin.class);
        // Brief du matin : réveils et notification Jeffrey (voir BriefPlugin.kt, BriefRunner.kt)
        registerPlugin(BriefPlugin.class);
        registerPlugin(BackupPlugin.class);
        // Voix de Jeffrey : dictée et lecture à voix haute (voir JeffreyVoice.kt)
        registerPlugin(JeffreyVoicePlugin.class);
        super.onCreate(savedInstanceState);
    }

    // Pont JEFFREY, G2 (05/11/2026) : à l'écran, c'est l'app qui gère la minute d'attente du
    // brief ; sinon, le contrôle natif (BriefSignalCheckReceiver).
    @Override
    public void onResume() {
        super.onResume();
        AppVisibility.setResumed(true);
    }

    @Override
    public void onPause() {
        AppVisibility.setResumed(false);
        super.onPause();
    }

    // L'app est en singleTask : un tap sur une tuile du widget quand elle tourne déjà arrive ici,
    // pas dans onCreate. On garde ce nouvel intent pour que WidgetBridge.consumeOpenTab le lise.
    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
    }
}
