package expo.modules.cloudsettings

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class CloudSettingsModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("ExpoCloudSettings")

    Events("onStoreChanged")

    Function("setString") { _: String, _: String -> }

    Function("getString") { _: String ->
      null as String?
    }

    Function("remove") { _: String -> }

    Function("getAllKeys") {
      emptyList<String>()
    }

    Function("clear") { }

    Function("isAvailable") {
      false
    }
  }
}
