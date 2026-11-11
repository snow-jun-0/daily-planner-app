package expo.modules.screenpin

import android.app.Activity
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class ExpoScreenPinModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("ExpoScreenPin")

    // 화면 고정(앱 고정) 시작 — 홈/최근 버튼으로 못 나가게
    Function("startPinning") {
      val activity: Activity? = appContext.currentActivity
      activity?.runOnUiThread {
        try {
          activity.startLockTask()
        } catch (e: Exception) {
          // 기기가 허용 안 하면 무시 (화면 고정 미지원 환경)
        }
      }
    }

    // 화면 고정 해제
    Function("stopPinning") {
      val activity: Activity? = appContext.currentActivity
      activity?.runOnUiThread {
        try {
          activity.stopLockTask()
        } catch (e: Exception) {
          // 이미 해제됐으면 무시
        }
      }
    }
  }
}
