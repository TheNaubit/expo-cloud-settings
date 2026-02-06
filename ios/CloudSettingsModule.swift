import ExpoModulesCore

public class CloudSettingsModule: Module {
  private var observer: NSObjectProtocol?

  deinit {
    if let observer = self.observer {
      NotificationCenter.default.removeObserver(observer)
    }
  }

  public func definition() -> ModuleDefinition {
    Name("ExpoCloudSettings")

    Events("onStoreChanged")

    OnStartObserving {
      self.observer = NotificationCenter.default.addObserver(
        forName: NSUbiquitousKeyValueStore.didChangeExternallyNotification,
        object: NSUbiquitousKeyValueStore.default,
        queue: .main
      ) { [weak self] notification in
        self?.handleStoreChange(notification)
      }
    }

    OnStopObserving {
      if let observer = self.observer {
        NotificationCenter.default.removeObserver(observer)
        self.observer = nil
      }
    }

    Function("setString") { (key: String, value: String) in
      NSUbiquitousKeyValueStore.default.set(value, forKey: key)
    }

    Function("getString") { (key: String) -> String? in
      return NSUbiquitousKeyValueStore.default.string(forKey: key)
    }

    Function("remove") { (key: String) in
      NSUbiquitousKeyValueStore.default.removeObject(forKey: key)
    }

    Function("getAllKeys") { () -> [String] in
      return Array(NSUbiquitousKeyValueStore.default.dictionaryRepresentation.keys)
    }

    Function("clear") { () in
      let store = NSUbiquitousKeyValueStore.default
      for key in store.dictionaryRepresentation.keys {
        store.removeObject(forKey: key)
      }
    }

    Function("isAvailable") { () -> Bool in
      return FileManager.default.ubiquityIdentityToken != nil
    }
  }

  private func handleStoreChange(_ notification: Notification) {
    let userInfo = notification.userInfo ?? [:]
    let changedKeys = userInfo[NSUbiquitousKeyValueStoreChangedKeysKey] as? [String] ?? []
    let reasonRaw = userInfo[NSUbiquitousKeyValueStoreChangeReasonKey] as? Int ?? 0

    let reason: String
    switch reasonRaw {
    case NSUbiquitousKeyValueStoreServerChange:
      reason = "serverChange"
    case NSUbiquitousKeyValueStoreInitialSyncChange:
      reason = "initialSync"
    case NSUbiquitousKeyValueStoreQuotaViolationChange:
      reason = "quotaViolation"
    case NSUbiquitousKeyValueStoreAccountChange:
      reason = "accountChange"
    default:
      reason = "serverChange"
    }

    sendEvent("onStoreChanged", [
      "changedKeys": changedKeys,
      "reason": reason
    ])
  }
}
