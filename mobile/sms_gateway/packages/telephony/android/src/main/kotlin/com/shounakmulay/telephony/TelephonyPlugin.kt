package com.shounakmulay.telephony

import android.content.Context
import androidx.annotation.NonNull
import com.shounakmulay.telephony.sms.IncomingSmsHandler
import com.shounakmulay.telephony.utils.Constants.CHANNEL_SMS
import com.shounakmulay.telephony.sms.IncomingSmsReceiver
import com.shounakmulay.telephony.sms.SmsController
import com.shounakmulay.telephony.sms.SmsMethodCallHandler
import io.flutter.embedding.engine.plugins.FlutterPlugin
import io.flutter.embedding.engine.plugins.activity.ActivityAware
import io.flutter.embedding.engine.plugins.activity.ActivityPluginBinding
import io.flutter.plugin.common.*


class TelephonyPlugin : FlutterPlugin, ActivityAware {

  private lateinit var smsChannel: MethodChannel

  private lateinit var smsMethodCallHandler: SmsMethodCallHandler

  private lateinit var smsController: SmsController

  private lateinit var binaryMessenger: BinaryMessenger

  private lateinit var permissionsController: PermissionsController

  private var activityBinding: ActivityPluginBinding? = null

  override fun onAttachedToEngine(@NonNull flutterPluginBinding: FlutterPlugin.FlutterPluginBinding) {
    if (!this::binaryMessenger.isInitialized) {
      binaryMessenger = flutterPluginBinding.binaryMessenger
    }

    setupPlugin(flutterPluginBinding.applicationContext, binaryMessenger)
  }

  override fun onDetachedFromEngine(@NonNull binding: FlutterPlugin.FlutterPluginBinding) {
    activityBinding?.removeRequestPermissionsResultListener(smsMethodCallHandler)
    activityBinding = null
    smsMethodCallHandler.clearActivity()
    IncomingSmsReceiver.foregroundSmsChannel = null
    smsChannel.setMethodCallHandler(null)
  }

  override fun onDetachedFromActivity() {
    // Only clear activity wiring. Keep the MethodChannel handler alive so Dart can call
    // startBackgroundService again after resume; tearing the handler here broke SMS when
    // the app was backgrounded or the screen was locked (background isolate + prefs handles).
    IncomingSmsReceiver.foregroundSmsChannel = null
    activityBinding?.removeRequestPermissionsResultListener(smsMethodCallHandler)
    activityBinding = null
    smsMethodCallHandler.clearActivity()
  }

  override fun onReattachedToActivityForConfigChanges(binding: ActivityPluginBinding) {
    onAttachedToActivity(binding)
  }

  override fun onAttachedToActivity(binding: ActivityPluginBinding) {
    activityBinding = binding
    IncomingSmsReceiver.foregroundSmsChannel = smsChannel
    smsMethodCallHandler.setActivity(binding.activity)
    binding.addRequestPermissionsResultListener(smsMethodCallHandler)
  }

  override fun onDetachedFromActivityForConfigChanges() {
    onDetachedFromActivity()
  }

  private fun setupPlugin(context: Context, messenger: BinaryMessenger) {
    smsController = SmsController(context)
    permissionsController = PermissionsController(context)
    smsMethodCallHandler = SmsMethodCallHandler(context, smsController, permissionsController)

    smsChannel = MethodChannel(messenger, CHANNEL_SMS)
    smsChannel.setMethodCallHandler(smsMethodCallHandler)
    smsMethodCallHandler.setForegroundChannel(smsChannel)
  }

}
