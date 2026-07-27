package com.yoannrolland.protocole;

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
        super.onCreate(savedInstanceState);
    }
}
