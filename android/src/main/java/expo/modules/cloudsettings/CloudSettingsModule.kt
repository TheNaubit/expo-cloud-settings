package expo.modules.cloudsettings

import android.content.Context
import android.content.SharedPreferences
import android.util.Log
import com.google.android.gms.auth.GoogleAuthUtil
import com.google.android.gms.auth.UserRecoverableAuthException
import com.google.android.gms.auth.api.signin.GoogleSignIn
import com.google.android.gms.common.api.Scope
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import org.json.JSONObject
import java.io.BufferedReader
import java.io.InputStreamReader
import java.io.OutputStreamWriter
import java.net.HttpURLConnection
import java.net.URL
import java.net.URLEncoder
import java.util.concurrent.atomic.AtomicBoolean

class CloudSettingsModule : Module() {
  private var listener: SharedPreferences.OnSharedPreferenceChangeListener? = null
  private val isApplyingRemote = AtomicBoolean(false)
  private val isSyncing = AtomicBoolean(false)
  private var hasSyncedOnce = false
  private var cachedFileId: String? = null
  private var syncJob: Job? = null
  private var uploadJob: Job? = null
  private val uploadQueued = AtomicBoolean(false)

  private fun prefs(): SharedPreferences {
    val context = appContext.reactContext ?: throw Exceptions.AppContextLost()
    return context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
  }

  private fun metaPrefs(): SharedPreferences {
    val context = appContext.reactContext ?: throw Exceptions.AppContextLost()
    return context.getSharedPreferences(META_PREFS_NAME, Context.MODE_PRIVATE)
  }

  private fun hasDriveScope(): Boolean {
    val context = appContext.reactContext ?: return false
    val account = GoogleSignIn.getLastSignedInAccount(context) ?: return false
    return GoogleSignIn.hasPermissions(account, Scope(DRIVE_SCOPE_URI))
  }

  private fun accessToken(): String? {
    val context = appContext.reactContext ?: return null
    val signInAccount = GoogleSignIn.getLastSignedInAccount(context) ?: return null
    if (!GoogleSignIn.hasPermissions(signInAccount, Scope(DRIVE_SCOPE_URI))) {
      return null
    }
    val account = signInAccount.account ?: return null
    return try {
      GoogleAuthUtil.getToken(context, account, DRIVE_SCOPE)
    } catch (error: UserRecoverableAuthException) {
      null
    } catch (error: Exception) {
      null
    }
  }

  private data class HttpResponse(val code: Int, val body: String)

  private fun request(
    method: String,
    url: String,
    token: String,
    contentType: String? = null,
    body: String? = null
  ): HttpResponse {
    val connection = (URL(url).openConnection() as HttpURLConnection).apply {
      requestMethod = method
      setRequestProperty("Authorization", "Bearer $token")
      setRequestProperty("Accept", "application/json")
      connectTimeout = REQUEST_TIMEOUT_MS
      readTimeout = REQUEST_TIMEOUT_MS
      if (contentType != null) {
        setRequestProperty("Content-Type", contentType)
      }
      if (body != null) {
        doOutput = true
      }
    }
    try {
      if (body != null) {
        OutputStreamWriter(connection.outputStream).use { it.write(body) }
      }
      val responseCode = connection.responseCode
      val stream = if (responseCode in 200..299) {
        connection.inputStream
      } else {
        connection.errorStream
      }
      val bodyText = if (stream != null) {
        BufferedReader(InputStreamReader(stream)).use { reader -> reader.readText() }
      } else {
        ""
      }
      return HttpResponse(responseCode, bodyText)
    } catch (error: Exception) {
      Log.w(TAG, "Drive request failed: $method $url", error)
      return HttpResponse(0, "")
    } finally {
      connection.disconnect()
    }
  }

  private data class DriveFile(val id: String, val modifiedTime: String?)

  private fun fetchFileMetadata(token: String): DriveFile? {
    val fileId = cachedFileId ?: run {
      val query = "name='${DRIVE_FILE_NAME}' and 'appDataFolder' in parents"
      val url = "https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&q=${
        URLEncoder.encode(query, "UTF-8")
      }&fields=files(id,name,modifiedTime)"
      val response = request("GET", url, token)
      if (response.code !in 200..299) return null
      val payload = response.body
      val files = try {
        JSONObject(payload).optJSONArray("files")
      } catch (error: Exception) {
        Log.w(TAG, "Failed to parse Drive file list", error)
        null
      } ?: return null
      if (files.length() == 0) return null
      val file = files.getJSONObject(0)
      val id = file.optString("id", null) ?: return null
      cachedFileId = id
      id
    }

    val metadataUrl = "https://www.googleapis.com/drive/v3/files/$fileId?fields=id,modifiedTime"
    val metadataResponse = request("GET", metadataUrl, token)
    if (metadataResponse.code !in 200..299) return DriveFile(fileId, null)
    val metadata = try {
      JSONObject(metadataResponse.body)
    } catch (error: Exception) {
      Log.w(TAG, "Failed to parse Drive metadata", error)
      null
    } ?: return DriveFile(fileId, null)
    val modifiedTime = metadata.optString("modifiedTime", null)
    if (modifiedTime != null) {
      metaPrefs().edit().putString(KEY_REMOTE_MODIFIED, modifiedTime).apply()
    }
    return DriveFile(fileId, modifiedTime)
  }

  private fun downloadSnapshot(token: String, file: DriveFile): Map<String, String> {
    val url = "https://www.googleapis.com/drive/v3/files/${file.id}?alt=media"
    val response = request("GET", url, token)
    if (response.code !in 200..299) return emptyMap()
    val payload = response.body
    val json = try {
      JSONObject(payload)
    } catch (error: Exception) {
      Log.w(TAG, "Failed to parse Drive snapshot", error)
      return emptyMap()
    }
    val result = mutableMapOf<String, String>()
    json.keys().forEach { key ->
      val value = json.optString(key, null) ?: return@forEach
      result[key] = value
    }
    return result
  }

  private fun uploadSnapshot(token: String) {
    val sharedPrefs = prefs()
    val snapshot = JSONObject()
    sharedPrefs.all.forEach { (key, value) ->
      if (value is String) {
        snapshot.put(key, value)
      }
    }
    val file = fetchFileMetadata(token)
    val content = snapshot.toString()
    val metaEditor = metaPrefs().edit()
    if (file != null) {
      val url = "https://www.googleapis.com/upload/drive/v3/files/${file.id}?uploadType=media&fields=id,modifiedTime"
      val response = request("PATCH", url, token, "application/json; charset=UTF-8", content)
      if (response.code in 200..299) {
        val updated = try {
          JSONObject(response.body)
        } catch (error: Exception) {
          Log.w(TAG, "Failed to parse Drive upload response", error)
          null
        }
        updated?.optString("modifiedTime", null)?.let {
          metaEditor.putString(KEY_REMOTE_MODIFIED, it)
        }
        metaEditor.putBoolean(KEY_DIRTY, false).apply()
      }
    } else {
      val boundary = "expoCloudSettingsBoundary"
      val metadata = JSONObject(
        mapOf(
          "name" to DRIVE_FILE_NAME,
          "parents" to listOf("appDataFolder")
        )
      ).toString()
      val multipartBody = buildString {
        append("--$boundary\r\n")
        append("Content-Type: application/json; charset=UTF-8\r\n\r\n")
        append(metadata)
        append("\r\n--$boundary\r\n")
        append("Content-Type: application/json; charset=UTF-8\r\n\r\n")
        append(content)
        append("\r\n--$boundary--")
      }
      val url = "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,modifiedTime"
      val response = request(
        "POST",
        url,
        token,
        "multipart/related; boundary=$boundary",
        multipartBody
      )
      if (response.code in 200..299) {
        val created = try {
          JSONObject(response.body)
        } catch (error: Exception) {
          Log.w(TAG, "Failed to parse Drive create response", error)
          null
        }
        cachedFileId = created?.optString("id", null)
        created?.optString("modifiedTime", null)?.let {
          metaEditor.putString(KEY_REMOTE_MODIFIED, it)
        }
        metaEditor.putBoolean(KEY_DIRTY, false).apply()
      }
    }
  }

  private fun syncFromRemote(force: Boolean = false) {
    if (isSyncing.getAndSet(true)) return
    appContext.backgroundCoroutineScope.launch {
      try {
        val token = accessToken() ?: return@launch
        val meta = metaPrefs()
        val file = fetchFileMetadata(token)
        val lastModified = meta.getString(KEY_REMOTE_MODIFIED, null)
        val dirty = meta.getBoolean(KEY_DIRTY, false)

        if (file == null) {
          if (prefs().all.isNotEmpty()) {
            uploadSnapshot(token)
          }
          hasSyncedOnce = true
          return@launch
        }

        if (!force && lastModified != null && file.modifiedTime != null && lastModified == file.modifiedTime && !dirty) {
          hasSyncedOnce = true
          return@launch
        }

        val remoteSnapshot = downloadSnapshot(token, file)
        val sharedPrefs = prefs()
        val currentSnapshot = sharedPrefs.all.mapValues { it.value as? String }
        val changedKeys = mutableListOf<String>()
        val editor = sharedPrefs.edit()
        val allKeys = currentSnapshot.keys + remoteSnapshot.keys
        allKeys.forEach { key ->
          val localValue = currentSnapshot[key]
          val remoteValue = remoteSnapshot[key]
          if (localValue != remoteValue) {
            changedKeys.add(key)
            if (remoteValue == null) {
              editor.remove(key)
            } else {
              editor.putString(key, remoteValue)
            }
          }
        }
        if (changedKeys.isNotEmpty()) {
          isApplyingRemote.set(true)
          editor.commit()
          isApplyingRemote.set(false)
          sendEvent(
            "onStoreChanged",
            mapOf(
              "changedKeys" to changedKeys,
              "reason" to if (hasSyncedOnce) "serverChange" else "initialSync"
            )
          )
        }
        meta.edit().putBoolean(KEY_DIRTY, false).apply()
        hasSyncedOnce = true
      } finally {
        isSyncing.set(false)
      }
    }
  }

  private fun enqueueUpload() {
    metaPrefs().edit().putBoolean(KEY_DIRTY, true).apply()
    uploadQueued.set(true)
    if (uploadJob?.isActive == true) return
    uploadJob = appContext.backgroundCoroutineScope.launch {
      delay(UPLOAD_DEBOUNCE_MS)
      if (!uploadQueued.getAndSet(false)) return@launch
      val token = accessToken() ?: return@launch
      try {
        uploadSnapshot(token)
      } catch (error: Exception) {
        Log.w(TAG, "Drive upload failed", error)
      }
    }
  }

  override fun definition() = ModuleDefinition {
    Name("ExpoCloudSettings")

    Events("onStoreChanged")

    OnStartObserving {
      val sharedPrefs = prefs()
      val changeListener = SharedPreferences.OnSharedPreferenceChangeListener { _, key ->
        if (key == null) return@OnSharedPreferenceChangeListener
        if (isApplyingRemote.get()) return@OnSharedPreferenceChangeListener
        sendEvent(
          "onStoreChanged",
          mapOf(
            "changedKeys" to listOf(key),
            "reason" to "serverChange"
          )
        )
      }
      listener = changeListener
      sharedPrefs.registerOnSharedPreferenceChangeListener(changeListener)
      syncFromRemote(force = true)
      syncJob?.cancel()
      syncJob = appContext.backgroundCoroutineScope.launch {
        while (true) {
          delay(SYNC_INTERVAL_MS)
          syncFromRemote()
        }
      }
    }

    OnStopObserving {
      val sharedPrefs = prefs()
      listener?.let { sharedPrefs.unregisterOnSharedPreferenceChangeListener(it) }
      listener = null
      syncJob?.cancel()
      syncJob = null
    }

    Function("setString") { key: String, value: String ->
      prefs().edit().putString(key, value).apply()
      enqueueUpload()
    }

    Function("getString") { key: String ->
      prefs().getString(key, null)
    }

    Function("remove") { key: String ->
      prefs().edit().remove(key).apply()
      enqueueUpload()
    }

    Function("getAllKeys") {
      prefs().all.keys.toList()
    }

    Function("clear") {
      val sharedPrefs = prefs()
      val keys = sharedPrefs.all.keys.toList()
      listener?.let { sharedPrefs.unregisterOnSharedPreferenceChangeListener(it) }
      sharedPrefs.edit().clear().apply()
      listener?.let { sharedPrefs.registerOnSharedPreferenceChangeListener(it) }
      if (keys.isNotEmpty()) {
        sendEvent(
          "onStoreChanged",
          mapOf(
            "changedKeys" to keys,
            "reason" to "serverChange"
          )
        )
      }
      enqueueUpload()
    }

    Function("isAvailable") {
      hasDriveScope()
    }
  }

  private companion object {
    private const val TAG = "ExpoCloudSettings"
    private const val PREFS_NAME = "expo-cloud-settings"
    private const val META_PREFS_NAME = "expo-cloud-settings-meta"
    private const val DRIVE_FILE_NAME = "expo-cloud-settings.json"
    private const val DRIVE_SCOPE = "oauth2:https://www.googleapis.com/auth/drive.appdata"
    private const val DRIVE_SCOPE_URI = "https://www.googleapis.com/auth/drive.appdata"
    private const val KEY_REMOTE_MODIFIED = "remoteModifiedTime"
    private const val KEY_DIRTY = "dirty"
    private const val REQUEST_TIMEOUT_MS = 15000
    private const val SYNC_INTERVAL_MS = 60000L
    private const val UPLOAD_DEBOUNCE_MS = 750L
  }
}
