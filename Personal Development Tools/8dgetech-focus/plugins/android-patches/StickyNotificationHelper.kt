package com.stickynotification

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.RectF
import android.os.Build
import android.os.Bundle
import android.text.Spannable
import android.text.SpannableString
import android.text.style.ForegroundColorSpan
import android.view.View
import android.widget.RemoteViews
import androidx.core.app.NotificationCompat

/**
 * Stateless helper that converts a config Bundle into an Android Notification.
 *
 * Supported config keys
 * ─────────────────────
 * Core
 *   channelId                String   Channel ID            (default: "sticky_notification_channel")
 *   channelName              String   Channel display name
 *   channelDescription       String   Channel description
 *   notificationId           Int      Notification ID       (default: 1337)
 *   title                    String   Bold title line
 *   text                     String   Body text             (hidden when absent / empty)
 *   subText                  String   Sub-text              (hidden when absent / empty)
 *
 * Icons & colour
 *   smallIcon                String   Drawable name for status-bar icon
 *   largeIcon                String   Drawable name decoded as a large Bitmap
 *   color                    String   Hex accent colour, e.g. "#FF5722"
 *
 * Behaviour
 *   priority                 String   "min"|"low"|"default"|"high"|"max"
 *   ongoing                  Boolean  Prevent swipe-dismiss (default: true)
 *   autoCancel               Boolean  Dismiss on tap        (default: false)
 *   repostOnDismiss          Boolean  Re-show after swipe on Android 14+ (default: true)
 *   openAppOnAction          Boolean  Open app on button tap (default: false)
 *   closeOnAction            Boolean  Collapse panel on button tap (default: false)
 *   foregroundServiceBehavior String  "immediate"|"deferred"|"default" (API 31+, default: "default")
 *
 * Button layout
 *   buttonsPerRow            Int      Buttons per row       (default: 5)
 *   maxButtons               Int      Cap on total buttons; 0 = no cap
 *
 * Styling
 *   showDivider              Boolean  Show/hide the line between text and buttons (default: true)
 *   dividerColor             String   Hex colour for the divider
 *   titleColor               String   Hex colour for the title text
 *   textColor                String   Hex colour for the body text
 *   subTextColor             String   Hex colour for the sub-text
 *   actionLabelColor         String   Hex colour for all action button labels
 *   actionIconTint           String   Hex tint applied to all action button icons
 *   actionBackground         String   Hex background colour for each action button
 *   actionsContainerBackground  String   Hex background for the whole button container
 *
 * Actions  (ArrayList<Bundle> keyed "actions"; each Bundle)
 *   id                       String   Unique action identifier returned to JS
 *   title                    String   Button label
 *   icon                     String   Drawable resource name
 *   payload                  String   Arbitrary string forwarded with the event
 */
object StickyNotificationHelper {

  private const val DEFAULT_CHANNEL_ID = "sticky_notification_channel"
  private const val DEFAULT_CHANNEL_NAME = "Sticky Notification"
  private const val DEFAULT_BUTTONS_PER_ROW = 5

  // ─── Styling holder ────────────────────────────────────────────────────

  private data class Style(
    val showLabelsInCollapsed: Boolean,
    val showDivider: Boolean,
    val dividerColor: Int?,
    val titleColor: Int?,
    val textColor: Int?,
    val subTextColor: Int?,
    val actionLabelColor: Int?,
    val actionIconTint: Int?,
    val actionBackground: Int?,
    val containerBackground: Int?,
    val containerBorderRadius: Float,     // dp — corner radius for the whole panel
    val actionBorderRadius: Float,        // dp
    val actionSpacing: Float,             // dp — horizontal gap between buttons (right-side only)
    val rowSpacing: Float,               // dp — vertical padding on each row
    val actionIconSpacing: Float,         // dp — gap between icon and label
    val actionsContainerBackground: Int?,
    val footerTextColor: Int?,
    val footerWordColors: ArrayList<Bundle>?,
    val footerLetterColors: ArrayList<Bundle>?,
  )

  // ─── Public API ────────────────────────────────────────────────────────

  fun buildNotification(context: Context, config: Bundle): Notification {
    val channelId = config.getString("channelId") ?: DEFAULT_CHANNEL_ID
    val channelName = config.getString("channelName") ?: DEFAULT_CHANNEL_NAME
    ensureChannelExists(context, channelId, channelName, config)

    val title = config.getString("title")
    val text = config.getString("text")
    val subText = config.getString("subText")
    val smallIconName = config.getString("smallIcon")
    val largeIconName = config.getString("largeIcon")
    val colorHex = config.getString("color")
    val priorityStr = config.getString("priority")
    val ongoing = if (config.containsKey("ongoing")) config.getBoolean("ongoing") else true
    val autoCancel = if (config.containsKey("autoCancel")) config.getBoolean("autoCancel") else false
    val openAppOnAction = if (config.containsKey("openAppOnAction")) config.getBoolean("openAppOnAction") else false
    val closeOnAction = if (config.containsKey("closeOnAction")) config.getBoolean("closeOnAction") else false

    @Suppress("UNCHECKED_CAST")
    val actionsBundle: ArrayList<Bundle>? = config.getParcelableArrayList("actions")

    val smallIconRes = resolveDrawableResource(context, smallIconName)
      ?: context.applicationInfo.icon

    // System chronometer mode (Clock stopwatch / timer style):
    // no custom RemoteViews — required for Live Update status chips on Android 16+.
    val systemStyle = config.getBoolean("systemStyle", false)
      || config.getBoolean("usesChronometer", false)
    if (systemStyle) {
      return buildSystemStyleNotification(
        context = context,
        channelId = channelId,
        title = title,
        text = text,
        subText = subText,
        smallIconRes = smallIconRes,
        largeIconName = largeIconName,
        colorHex = colorHex,
        priorityStr = priorityStr,
        ongoing = ongoing,
        autoCancel = autoCancel,
        openAppOnAction = openAppOnAction,
        closeOnAction = closeOnAction,
        actionsBundle = actionsBundle,
        config = config,
      )
    }

    val buttonsPerRow = config.getInt("buttonsPerRow", DEFAULT_BUTTONS_PER_ROW).coerceAtLeast(1)
    val maxButtons = config.getInt("maxButtons", 0)

    @Suppress("UNCHECKED_CAST")
    val footerWordColorsRaw: ArrayList<Bundle>? = config.getParcelableArrayList("footerWordColors")
    @Suppress("UNCHECKED_CAST")
    val footerLetterColorsRaw: ArrayList<Bundle>? = config.getParcelableArrayList("footerLetterColors")

    val style = Style(
      showLabelsInCollapsed = if (config.containsKey("showLabelsInCollapsed")) config.getBoolean("showLabelsInCollapsed") else false,
      showDivider = if (config.containsKey("showDivider")) config.getBoolean("showDivider") else true,
      dividerColor = parseColor(config.getString("dividerColor")),
      titleColor = parseColor(config.getString("titleColor")),
      textColor = parseColor(config.getString("textColor")),
      subTextColor = parseColor(config.getString("subTextColor")),
      actionLabelColor = parseColor(config.getString("actionLabelColor")),
      actionIconTint = parseColor(config.getString("actionIconTint")),
      actionBackground = parseColor(config.getString("actionBackground")),
      containerBackground = parseColor(config.getString("containerBackground")),
      containerBorderRadius = (config.get("containerBorderRadius") as? Number)?.toFloat()?.coerceAtLeast(0f) ?: 0f,
      actionBorderRadius = (config.get("actionBorderRadius") as? Number)?.toFloat()?.coerceAtLeast(0f) ?: 0f,
      actionSpacing = (config.get("actionSpacing") as? Number)?.toFloat()?.coerceAtLeast(0f) ?: 0f,
      rowSpacing = (config.get("rowSpacing") as? Number)?.toFloat()?.coerceAtLeast(0f) ?: 0f,
      actionIconSpacing = (config.get("actionIconSpacing") as? Number)?.toFloat()?.coerceAtLeast(0f) ?: 2f,
      actionsContainerBackground = parseColor(config.getString("actionsContainerBackground")),
      footerTextColor = parseColor(config.getString("footerTextColor")),
      footerWordColors = footerWordColorsRaw,
      footerLetterColors = footerLetterColorsRaw,
    )

    val footerText = config.getString("footerText")

    @Suppress("UNCHECKED_CAST")
    val collapsedActionsBundle: ArrayList<Bundle>? = config.getParcelableArrayList("collapsedActions")

    val bigView = buildBigContentView(
      context, title, text, subText, footerText, actionsBundle,
      buttonsPerRow, maxButtons, openAppOnAction, closeOnAction, style
    )

    val builder = NotificationCompat.Builder(context, channelId)
      .setSmallIcon(smallIconRes)
      .setOngoing(ongoing)
      .setAutoCancel(autoCancel)
      .setPriority(parsePriority(priorityStr))
      .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
      .setCustomBigContentView(bigView)
      .setContentIntent(buildLaunchPendingIntent(context))
      .setDeleteIntent(buildSwipeDismissPendingIntent(context))

    if (!collapsedActionsBundle.isNullOrEmpty()) {
      val collapsedView = buildCollapsedView(
        context, title, collapsedActionsBundle, openAppOnAction, closeOnAction, style
      )
      builder.setCustomContentView(collapsedView)
    }

    if (!title.isNullOrEmpty()) builder.setContentTitle(title)
    if (!text.isNullOrEmpty()) builder.setContentText(text)
    subText?.let { builder.setSubText(it) }
    colorHex?.let { hex -> runCatching { builder.setColor(Color.parseColor(hex)) } }
    largeIconName?.let { name ->
      loadBitmapFromDrawable(context, name)?.let { bmp -> builder.setLargeIcon(bmp) }
    }

    applyForegroundServiceBehavior(builder, config)

    return builder.build()
  }

  /**
   * Clock-style ongoing notification: system template + chronometer.
   * No custom RemoteViews so Android 16+ can promote it to a status-bar chip.
   */
  private fun buildSystemStyleNotification(
    context: Context,
    channelId: String,
    title: String?,
    text: String?,
    subText: String?,
    smallIconRes: Int,
    largeIconName: String?,
    colorHex: String?,
    priorityStr: String?,
    ongoing: Boolean,
    autoCancel: Boolean,
    openAppOnAction: Boolean,
    closeOnAction: Boolean,
    actionsBundle: ArrayList<Bundle>?,
    config: Bundle,
  ): Notification {
    val usesChronometer = config.getBoolean("usesChronometer", false)
    val chronometerCountDown = config.getBoolean("chronometerCountDown", false)
    val showWhen = if (config.containsKey("showWhen")) config.getBoolean("showWhen") else usesChronometer
    val whenMs = (config.get("when") as? Number)?.toLong()
      ?: if (config.containsKey("when")) config.getLong("when") else 0L
    val requestPromoted = if (config.containsKey("requestPromotedOngoing")) {
      config.getBoolean("requestPromotedOngoing")
    } else {
      true
    }
    val category = config.getString("category")
      ?: if (chronometerCountDown) NotificationCompat.CATEGORY_ALARM
      else NotificationCompat.CATEGORY_STOPWATCH

    val builder = NotificationCompat.Builder(context, channelId)
      .setSmallIcon(smallIconRes)
      .setOngoing(ongoing)
      .setAutoCancel(autoCancel)
      .setOnlyAlertOnce(true)
      .setPriority(parsePriority(priorityStr))
      .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
      .setCategory(category)
      .setContentIntent(buildLaunchPendingIntent(context))
      .setDeleteIntent(buildSwipeDismissPendingIntent(context))
      .setShowWhen(showWhen)

    if (!title.isNullOrEmpty()) builder.setContentTitle(title)
    if (!text.isNullOrEmpty()) builder.setContentText(text)
    if (!subText.isNullOrEmpty()) builder.setSubText(subText)
    colorHex?.let { hex -> runCatching { builder.setColor(Color.parseColor(hex)) } }
    largeIconName?.let { name ->
      loadBitmapFromDrawable(context, name)?.let { bmp -> builder.setLargeIcon(bmp) }
    }

    if (usesChronometer && whenMs > 0L) {
      builder.setWhen(whenMs)
      builder.setUsesChronometer(true)
      if (chronometerCountDown) {
        builder.setChronometerCountDown(true)
      }
    } else if (whenMs > 0L) {
      builder.setWhen(whenMs)
    }

    actionsBundle?.take(3)?.forEach { actionBundle ->
      val actionId = actionBundle.getString("id") ?: return@forEach
      val actionTitle = actionBundle.getString("title") ?: actionId
      val iconName = actionBundle.getString("icon")
      val payload = actionBundle.getString("payload")
      val iconRes = resolveDrawableResource(context, iconName) ?: 0
      val pendingIntent = if (closeOnAction || openAppOnAction) {
        buildTrampolinePendingIntent(context, actionId, payload, openAppOnAction)
      } else {
        buildActionPendingIntent(context, actionId, payload)
      }
      builder.addAction(
        NotificationCompat.Action.Builder(iconRes, actionTitle, pendingIntent).build()
      )
    }

    if (requestPromoted) {
      // Available on Android 16 / recent AndroidX; no-op via reflection otherwise.
      runCatching {
        val method = builder.javaClass.methods.firstOrNull {
          it.name == "setRequestPromotedOngoing" && it.parameterTypes.size == 1
        }
        method?.invoke(builder, true)
      }
      // Also set the extras key used by some platform builds.
      runCatching {
        builder.extras.putBoolean("android.requestPromotedOngoing", true)
      }
    }

    val shortCritical = config.getString("shortCriticalText")
    if (!shortCritical.isNullOrEmpty()) {
      runCatching {
        val method = builder.javaClass.methods.firstOrNull {
          it.name == "setShortCriticalText" && it.parameterTypes.size == 1
        }
        method?.invoke(builder, shortCritical)
      }
    }

    applyForegroundServiceBehavior(builder, config)
    return builder.build()
  }

  private fun applyForegroundServiceBehavior(
    builder: NotificationCompat.Builder,
    config: Bundle,
  ) {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
      val behavior = when (config.getString("foregroundServiceBehavior")) {
        "immediate" -> NotificationCompat.FOREGROUND_SERVICE_IMMEDIATE
        "deferred" -> NotificationCompat.FOREGROUND_SERVICE_DEFERRED
        else -> NotificationCompat.FOREGROUND_SERVICE_DEFAULT
      }
      builder.setForegroundServiceBehavior(behavior)
    }
  }

  // ─── RemoteViews builder ───────────────────────────────────────────────

  private fun buildBigContentView(
    context: Context,
    title: String?,
    text: String?,
    subText: String?,
    footerText: String?,
    actions: ArrayList<Bundle>?,
    buttonsPerRow: Int,
    maxButtons: Int,
    openAppOnAction: Boolean,
    closeOnAction: Boolean,
    style: Style,
  ): RemoteViews {
    val pkg = context.packageName
    val views = RemoteViews(pkg, R.layout.notification_panel)

    // ── Container background & border radius ──────────────────────────────
    style.containerBackground?.let {
      views.setInt(R.id.notification_container, "setBackgroundColor", it)
    }
    if (style.containerBorderRadius > 0f) {
      views.setBoolean(R.id.notification_container, "setClipToOutline", true)
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
        views.setViewOutlinePreferredRadius(
          R.id.notification_container,
          style.containerBorderRadius,
          android.util.TypedValue.COMPLEX_UNIT_DIP,
        )
      }
    }

    // ── Header container (hidden entirely when all text fields are empty) ─
    val hasAnyText = !title.isNullOrEmpty() || !text.isNullOrEmpty() || !subText.isNullOrEmpty()
    views.setViewVisibility(R.id.notification_header, if (hasAnyText) View.VISIBLE else View.GONE)

    // ── Title (hidden when null or empty) ────────────────────────────────
    if (!title.isNullOrEmpty()) {
      views.setViewVisibility(R.id.notification_title, View.VISIBLE)
      views.setTextViewText(R.id.notification_title, title)
      style.titleColor?.let { views.setTextColor(R.id.notification_title, it) }
    } else {
      views.setViewVisibility(R.id.notification_title, View.GONE)
    }

    // ── Body text (hidden when null or empty) ─────────────────────────────
    if (!text.isNullOrEmpty()) {
      views.setViewVisibility(R.id.notification_text, View.VISIBLE)
      views.setTextViewText(R.id.notification_text, text)
      style.textColor?.let { views.setTextColor(R.id.notification_text, it) }
    } else {
      views.setViewVisibility(R.id.notification_text, View.GONE)
    }

    // ── Sub-text (hidden when null or empty) ──────────────────────────────
    if (!subText.isNullOrEmpty()) {
      views.setViewVisibility(R.id.notification_subtext, View.VISIBLE)
      views.setTextViewText(R.id.notification_subtext, subText)
      style.subTextColor?.let { views.setTextColor(R.id.notification_subtext, it) }
    } else {
      views.setViewVisibility(R.id.notification_subtext, View.GONE)
    }

    // ── Divider ───────────────────────────────────────────────────────────
    if (style.showDivider) {
      views.setViewVisibility(R.id.notification_divider, View.VISIBLE)
      style.dividerColor?.let {
        views.setInt(R.id.notification_divider, "setBackgroundColor", it)
      }
    } else {
      views.setViewVisibility(R.id.notification_divider, View.GONE)
    }

    // ── Footer text ───────────────────────────────────────────────────────
    if (!footerText.isNullOrEmpty()) {
      views.setViewVisibility(R.id.notification_footer_text, View.VISIBLE)
      val styledText = buildFooterText(footerText, style.footerWordColors, style.footerLetterColors)
      views.setTextViewText(R.id.notification_footer_text, styledText)
      style.footerTextColor?.let { views.setTextColor(R.id.notification_footer_text, it) }
    } else {
      views.setViewVisibility(R.id.notification_footer_text, View.GONE)
    }

    // ── Action buttons ────────────────────────────────────────────────────
    if (actions.isNullOrEmpty()) return views

    style.actionsContainerBackground?.let {
      views.setInt(R.id.buttons_container, "setBackgroundColor", it)
    }

    val visibleActions = if (maxButtons > 0) actions.take(maxButtons) else actions

    val density = context.resources.displayMetrics.density

    visibleActions.chunked(buttonsPerRow).forEach { rowActions ->
      val rowView = RemoteViews(pkg, R.layout.notification_action_row)

      // Vertical gap between rows — applied as top+bottom padding on the row.
      if (style.rowSpacing > 0f) {
        val rowPx = (style.rowSpacing * density).toInt()
        rowView.setViewPadding(R.id.action_row, 0, rowPx, 0, rowPx)
      }

      rowActions.forEachIndexed { btnIndex, actionBundle ->
        val actionId = actionBundle.getString("id") ?: return@forEachIndexed
        val actionTitle = actionBundle.getString("title") ?: actionId
        val iconName = actionBundle.getString("icon")
        val payload = actionBundle.getString("payload")

        // Per-button values fall back to global style when absent.
        val btnLabelColor  = parseColor(actionBundle.getString("labelColor"))  ?: style.actionLabelColor
        val btnIconTint    = parseColor(actionBundle.getString("iconTint"))     ?: style.actionIconTint
        val btnBackground  = parseColor(actionBundle.getString("background"))   ?: style.actionBackground
        val btnRadius      = (actionBundle.get("borderRadius") as? Number)?.toFloat()
          ?.let { if (it < 0f) style.actionBorderRadius else it }
          ?: style.actionBorderRadius

        val buttonView = RemoteViews(pkg, R.layout.notification_action_button)

        // ── Horizontal spacing (gap between buttons) ──────────────────────
        // Left padding is 0 for the first button so it aligns with the
        // container edge.  Right padding is omitted on the last button to
        // avoid trailing space.  This gives equal visual gaps between every
        // pair of adjacent buttons with no extra space at either edge.
        if (style.actionSpacing > 0f) {
          val spacePx = (style.actionSpacing * density).toInt()
          val leftPad  = if (btnIndex == 0) 0 else spacePx
          val rightPad = if (btnIndex == rowActions.size - 1) 0 else spacePx
          buttonView.setViewPadding(R.id.action_button, leftPad, 0, rightPad, 0)
        }

        // ── Background (flat colour or rounded-rect bitmap) ───────────────
        if (btnBackground != null || btnRadius > 0f) {
          val bitmapH = (52 * density).toInt().coerceAtLeast(1)
          val bitmapW = (200 * density).toInt().coerceAtLeast(1)
          val radiusPx = btnRadius * density
          val bgBitmap = buildRoundedBitmap(
            color = btnBackground ?: Color.TRANSPARENT,
            cornerRadius = radiusPx,
            width = bitmapW,
            height = bitmapH,
          )
          buttonView.setViewVisibility(R.id.action_bg, View.VISIBLE)
          buttonView.setImageViewBitmap(R.id.action_bg, bgBitmap)
        } else {
          buttonView.setViewVisibility(R.id.action_bg, View.GONE)
        }

        // ── Label ─────────────────────────────────────────────────────────
        buttonView.setTextViewText(R.id.action_text, actionTitle)
        btnLabelColor?.let { buttonView.setTextColor(R.id.action_text, it) }

        // ── Icon ──────────────────────────────────────────────────────────
        val iconRes = resolveDrawableResource(context, iconName)
        if (iconRes != null) {
          buttonView.setViewVisibility(R.id.action_icon, View.VISIBLE)
          buttonView.setImageViewResource(R.id.action_icon, iconRes)
          btnIconTint?.let { buttonView.setInt(R.id.action_icon, "setColorFilter", it) }
          // Gap between icon and label — only meaningful when an icon is shown.
          val iconSpacePx = (style.actionIconSpacing * density).toInt()
          buttonView.setViewPadding(R.id.action_text, 0, iconSpacePx, 0, 0)
        } else {
          buttonView.setViewVisibility(R.id.action_icon, View.GONE)
        }

        val pendingIntent = if (closeOnAction || openAppOnAction) {
          buildTrampolinePendingIntent(context, actionId, payload, openAppOnAction)
        } else {
          buildActionPendingIntent(context, actionId, payload)
        }
        buttonView.setOnClickPendingIntent(R.id.action_button, pendingIntent)

        rowView.addView(R.id.action_row, buttonView)
      }

      views.addView(R.id.buttons_container, rowView)
    }

    return views
  }

  // ─── Collapsed view builder ────────────────────────────────────────────

  private fun buildCollapsedView(
    context: Context,
    title: String?,
    actions: ArrayList<Bundle>,
    openAppOnAction: Boolean,
    closeOnAction: Boolean,
    style: Style,
  ): RemoteViews {
    val pkg = context.packageName
    val views = RemoteViews(pkg, R.layout.notification_collapsed)

    // Optional title above the buttons
    if (!title.isNullOrEmpty()) {
      views.setViewVisibility(R.id.collapsed_title, View.VISIBLE)
      views.setTextViewText(R.id.collapsed_title, title)
      style.titleColor?.let { views.setTextColor(R.id.collapsed_title, it) }
    } else {
      views.setViewVisibility(R.id.collapsed_title, View.GONE)
    }

    val density = context.resources.displayMetrics.density

    actions.forEachIndexed { btnIndex, actionBundle ->
      val actionId = actionBundle.getString("id") ?: return@forEachIndexed
      val actionTitle = actionBundle.getString("title") ?: actionId
      val iconName = actionBundle.getString("icon")
      val payload = actionBundle.getString("payload")

      val btnLabelColor = parseColor(actionBundle.getString("labelColor")) ?: style.actionLabelColor
      val btnIconTint   = parseColor(actionBundle.getString("iconTint"))   ?: style.actionIconTint
      val btnBackground = parseColor(actionBundle.getString("background")) ?: style.actionBackground
      val btnRadius     = (actionBundle.get("borderRadius") as? Number)?.toFloat()
        ?.let { if (it < 0f) style.actionBorderRadius else it }
        ?: style.actionBorderRadius

      val buttonView = RemoteViews(pkg, R.layout.notification_action_button)

      if (style.actionSpacing > 0f) {
        val spacePx = (style.actionSpacing * density).toInt()
        val leftPad  = if (btnIndex == 0) 0 else spacePx
        val rightPad = if (btnIndex == actions.size - 1) 0 else spacePx
        buttonView.setViewPadding(R.id.action_button, leftPad, 0, rightPad, 0)
      }

      if (btnBackground != null || btnRadius > 0f) {
        val bitmapH = (48 * density).toInt().coerceAtLeast(1)
        val bitmapW = (200 * density).toInt().coerceAtLeast(1)
        val bgBitmap = buildRoundedBitmap(
          color = btnBackground ?: Color.TRANSPARENT,
          cornerRadius = btnRadius * density,
          width = bitmapW,
          height = bitmapH,
        )
        buttonView.setViewVisibility(R.id.action_bg, View.VISIBLE)
        buttonView.setImageViewBitmap(R.id.action_bg, bgBitmap)
      } else {
        buttonView.setViewVisibility(R.id.action_bg, View.GONE)
      }

      val iconRes = resolveDrawableResource(context, iconName)
      if (iconRes != null) {
        buttonView.setViewVisibility(R.id.action_icon, View.VISIBLE)
        buttonView.setImageViewResource(R.id.action_icon, iconRes)
        btnIconTint?.let { buttonView.setInt(R.id.action_icon, "setColorFilter", it) }
        // In collapsed mode hide the label when showLabelsInCollapsed is false
        if (style.showLabelsInCollapsed) {
          buttonView.setViewVisibility(R.id.action_text, View.VISIBLE)
          buttonView.setTextViewText(R.id.action_text, actionTitle)
          btnLabelColor?.let { buttonView.setTextColor(R.id.action_text, it) }
          val iconSpacePx = (style.actionIconSpacing * density).toInt()
          buttonView.setViewPadding(R.id.action_text, 0, iconSpacePx, 0, 0)
        } else {
          buttonView.setViewVisibility(R.id.action_text, View.GONE)
        }
      } else {
        // No icon — always show the label so the button is not empty
        buttonView.setViewVisibility(R.id.action_icon, View.GONE)
        buttonView.setViewVisibility(R.id.action_text, View.VISIBLE)
        buttonView.setTextViewText(R.id.action_text, actionTitle)
        btnLabelColor?.let { buttonView.setTextColor(R.id.action_text, it) }
      }

      val pendingIntent = if (closeOnAction || openAppOnAction) {
        buildTrampolinePendingIntent(context, actionId, payload, openAppOnAction)
      } else {
        buildActionPendingIntent(context, actionId, payload)
      }
      buttonView.setOnClickPendingIntent(R.id.action_button, pendingIntent)

      views.addView(R.id.collapsed_buttons, buttonView)
    }

    return views
  }

  // ─── Channel ──────────────────────────────────────────────────────────

  fun ensureChannelExists(
    context: Context,
    channelId: String,
    channelName: String,
    config: Bundle,
  ) {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
    val importance = parseImportance(config.getString("priority"))
    val channel = NotificationChannel(channelId, channelName, importance).apply {
      config.getString("channelDescription")?.let { description = it }
      setSound(null, null)
      enableVibration(false)
    }
    getNotificationManager(context).createNotificationChannel(channel)
  }

  fun getNotificationManager(context: Context): NotificationManager =
    context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

  // ─── PendingIntents ───────────────────────────────────────────────────

  private fun buildLaunchPendingIntent(context: Context): PendingIntent {
    val launchIntent = context.packageManager
      .getLaunchIntentForPackage(context.packageName)
      ?.apply { flags = Intent.FLAG_ACTIVITY_SINGLE_TOP }
      ?: Intent()
    return PendingIntent.getActivity(context, 0, launchIntent, pendingIntentFlags())
  }

  private fun buildTrampolinePendingIntent(
    context: Context,
    actionId: String,
    payload: String?,
    openApp: Boolean,
  ): PendingIntent {
    val intent = Intent(context, StickyNotificationTrampolineActivity::class.java).apply {
      putExtra(StickyNotificationTrampolineActivity.EXTRA_ACTION_ID, actionId)
      payload?.let { putExtra(StickyNotificationTrampolineActivity.EXTRA_PAYLOAD, it) }
      putExtra(StickyNotificationTrampolineActivity.EXTRA_OPEN_APP, openApp)
      addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP)
    }
    return PendingIntent.getActivity(context, actionId.hashCode(), intent, pendingIntentFlags())
  }

  private fun buildSwipeDismissPendingIntent(context: Context): PendingIntent {
    val intent = Intent(context, StickyNotificationService::class.java).apply {
      action = StickyNotificationService.ACTION_SWIPE_DISMISS
    }
    // Use request code 1 to avoid colliding with the launch PendingIntent (code 0).
    return PendingIntent.getService(context, 1, intent, pendingIntentFlags())
  }

  private fun buildActionPendingIntent(
    context: Context,
    actionId: String,
    payload: String?,
  ): PendingIntent {
    val intent = Intent(context, StickyNotificationReceiver::class.java).apply {
      action = StickyNotificationReceiver.ACTION_NOTIFICATION_ACTION
      putExtra(StickyNotificationReceiver.EXTRA_ACTION_ID, actionId)
      payload?.let { putExtra(StickyNotificationReceiver.EXTRA_PAYLOAD, it) }
    }
    return PendingIntent.getBroadcast(context, actionId.hashCode(), intent, pendingIntentFlags())
  }

  // ─── Helpers ─────────────────────────────────────────────────────────

  /**
   * Builds a CharSequence for the footer text with layered color spans.
   *
   * Priority (highest wins):
   *   1. Letter-level colors  (footerLetterColors — per character index)
   *   2. Word-level colors    (footerWordColors   — all occurrences of a word)
   *   3. Full text color      (handled via setTextColor in the caller)
   *
   * Returns the plain String when neither word nor letter colors are given
   * (avoids allocating a SpannableString for the common case).
   */
  private fun buildFooterText(
    text: String,
    wordColors: ArrayList<Bundle>?,
    letterColors: ArrayList<Bundle>?,
  ): CharSequence {
    if (wordColors.isNullOrEmpty() && letterColors.isNullOrEmpty()) return text

    val spannable = SpannableString(text)

    // Word colors applied first (lower priority — letter spans override later).
    wordColors?.forEach { bundle ->
      val word  = bundle.getString("word")  ?: return@forEach
      val color = parseColor(bundle.getString("color")) ?: return@forEach
      var start = 0
      while (true) {
        val found = text.indexOf(word, start)
        if (found == -1) break
        spannable.setSpan(
          ForegroundColorSpan(color), found, found + word.length,
          Spannable.SPAN_EXCLUSIVE_EXCLUSIVE
        )
        start = found + word.length
      }
    }

    // Letter colors applied last (highest priority — overrides word spans).
    // Targets the exact character position given by `index`.
    letterColors?.forEach { bundle ->
      val idx   = (bundle.get("index") as? Number)?.toInt() ?: -1
      val color = parseColor(bundle.getString("color")) ?: return@forEach
      if (idx in 0 until text.length) {
        spannable.setSpan(
          ForegroundColorSpan(color), idx, idx + 1,
          Spannable.SPAN_EXCLUSIVE_EXCLUSIVE
        )
      }
    }

    return spannable
  }

  /**
   * Renders a rounded rectangle into a Bitmap.
   * Used as a RemoteViews background because Drawable objects cannot be passed
   * directly to a RemoteViews view — only Bitmaps can via setImageViewBitmap().
   *
   * The bitmap is drawn at [width]×[height] pixels with [cornerRadius] px
   * corner radius.  A value of half the height produces a pill shape.
   */
  private fun buildRoundedBitmap(color: Int, cornerRadius: Float, width: Int, height: Int): Bitmap {
    val bitmap = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888)
    val canvas = Canvas(bitmap)
    val paint = Paint(Paint.ANTI_ALIAS_FLAG).apply { this.color = color }
    val clampedRadius = cornerRadius.coerceAtMost(minOf(width, height) / 2f)
    canvas.drawRoundRect(RectF(0f, 0f, width.toFloat(), height.toFloat()), clampedRadius, clampedRadius, paint)
    return bitmap
  }

  private fun parseColor(hex: String?): Int? {
    if (hex.isNullOrBlank()) return null
    return runCatching { Color.parseColor(hex) }.getOrNull()
  }

  private fun resolveDrawableResource(context: Context, name: String?): Int? {
    if (name.isNullOrBlank()) return null
    val res = context.resources.getIdentifier(name, "drawable", context.packageName)
    return if (res != 0) res else null
  }

  private fun loadBitmapFromDrawable(context: Context, name: String): Bitmap? {
    val res = resolveDrawableResource(context, name) ?: return null
    return runCatching { BitmapFactory.decodeResource(context.resources, res) }.getOrNull()
  }

  private fun parsePriority(priority: String?): Int = when (priority) {
    "min" -> NotificationCompat.PRIORITY_MIN
    "low" -> NotificationCompat.PRIORITY_LOW
    "high" -> NotificationCompat.PRIORITY_HIGH
    "max" -> NotificationCompat.PRIORITY_MAX
    else -> NotificationCompat.PRIORITY_DEFAULT
  }

  private fun parseImportance(priority: String?): Int {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return 0
    return when (priority) {
      "min" -> NotificationManager.IMPORTANCE_MIN
      "low" -> NotificationManager.IMPORTANCE_LOW
      "high" -> NotificationManager.IMPORTANCE_HIGH
      "max" -> NotificationManager.IMPORTANCE_MAX
      else -> NotificationManager.IMPORTANCE_DEFAULT
    }
  }

  private fun pendingIntentFlags(): Int =
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
    } else {
      PendingIntent.FLAG_UPDATE_CURRENT
    }
}
