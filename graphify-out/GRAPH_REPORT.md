# Graph Report - twitch  (2026-09-06)

## Corpus Check
- 44 files · ~36,711 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 451 nodes · 1003 edges · 21 communities (19 shown, 2 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 2 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `693a4dc6`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- sub-event-coalesce.ts
- reward-lifecycle.ts
- config.ts
- tracking.ts
- eventsub.ts
- reloadSettings
- permissions
- chat-monitor.ts
- devDependencies
- compilerOptions
- reward-title.ts
- dashboard-feed.ts
- chat-triggers.ts
- trigger-validation.ts
- collect-manifest-assets.mjs
- webpack.config.js
- StreamKit+ Addon — Agent Guide
- buildTwitchProfile
- localizedTier
- Twitch
- release-body.md

## God Nodes (most connected - your core abstractions)
1. `reloadSettings()` - 29 edges
2. `getSettings()` - 22 edges
3. `startTwitchTracking()` - 17 edges
4. `RegenerateConfig()` - 16 edges
5. `TwitchApi` - 15 edges
6. `buildTwitchProfile()` - 15 edges
7. `TwitchEventSubClient` - 15 edges
8. `stopTwitchTracking()` - 13 edges
9. `handleChatNotificationEvent()` - 12 edges
10. `pushChatMessage()` - 12 edges

## Surprising Connections (you probably didn't know these)
- `processAutoClipForRecord()` --calls--> `getSettings()`  [EXTRACTED]
  auto-clip.ts → settings.ts
- `processAutoClipForRecord()` --calls--> `reloadSettings()`  [EXTRACTED]
  auto-clip.ts → settings.ts
- `handleAutoClipRecord()` --calls--> `reloadSettings()`  [EXTRACTED]
  auto-clip.ts → settings.ts
- `notifyFollowModeLifted()` --calls--> `resolveAddonChatSender()`  [EXTRACTED]
  auto-follow-mode.ts → chat-sender.ts
- `notifyFollowModeLifted()` --calls--> `sendChatMessageWithCredentials()`  [EXTRACTED]
  auto-follow-mode.ts → chat-sender.ts

## Import Cycles
- 3-file cycle: `chat-monitor.ts -> dashboard-feed.ts -> tracking.ts -> chat-monitor.ts`
- 3-file cycle: `dashboard-feed.ts -> tracking.ts -> eventsub.ts -> dashboard-feed.ts`
- 4-file cycle: `chat-monitor.ts -> dashboard-feed.ts -> tracking.ts -> eventsub.ts -> chat-monitor.ts`
- 4-file cycle: `chat-notifications.ts -> dashboard-feed.ts -> tracking.ts -> eventsub.ts -> chat-notifications.ts`
- 4-file cycle: `dashboard-feed.ts -> tracking.ts -> eventsub.ts -> sub-event-coalesce.ts -> dashboard-feed.ts`

## Communities (21 total, 2 thin omitted)

### Community 0 - "sub-event-coalesce.ts"
Cohesion: 0.21
Nodes (16): localizedResubLine(), pushCombinedGiftSub(), pushResubSubscribe(), pushSubGift(), pushSubRenewal(), cancelPendingResubSubscribe(), handleSubGiftNotification(), handleSubRenewalNotification() (+8 more)

### Community 1 - "reward-lifecycle.ts"
Cohesion: 0.10
Nodes (35): TwitchApi, addManagedBinding(), collectActiveRewardIds(), collectManagedRewardBindingsFromCategories(), collectManagedRewardBindingsFromSnapshot(), collectManagedRewardIds(), ingestCategoryGroup(), isRedeemTrigger() (+27 more)

### Community 2 - "config.ts"
Cohesion: 0.09
Nodes (43): AUTH_SUCCESS_MESSAGE, restoreFollowModeIfLifted(), applyConfigFields(), authUrlField(), buildConfigFields(), clearTwitchAuth(), formatBotDisconnectLabel(), formatLogoutLabel() (+35 more)

### Community 3 - "tracking.ts"
Cohesion: 0.08
Nodes (45): TwitchChatBadgeSet, TwitchChatBadgeVersion, TwitchChatEmote, TwitchChatEmoteImages, TwitchChatSettings, TwitchChatter, TwitchCustomReward, TwitchPinnedChatMessage (+37 more)

### Community 4 - "eventsub.ts"
Cohesion: 0.09
Nodes (28): buildPollAddonEvent(), buildPredictionAddonEvent(), emitPollEvent(), emitPredictionEvent(), parseTopPredictors(), parseVotingSettings(), PollAddonChoice, PollAddonEvent (+20 more)

### Community 5 - "reloadSettings"
Cohesion: 0.09
Nodes (39): applyFollowModeNotifyTemplate(), clampChatMessage(), clearRestoreTimer(), FOLLOW_MODE_NOTIFY_TEXT_PLACEHOLDER, FollowModeRestoreState, getDefaultFollowModeNotifyText(), notifyFollowModeLifted(), scheduleAutoFollowModeOff() (+31 more)

### Community 6 - "permissions"
Cohesion: 0.08
Nodes (24): app_version, author, description, en, ru, uk, icon, id (+16 more)

### Community 7 - "chat-monitor.ts"
Cohesion: 0.13
Nodes (25): knownChatters, persistPinnedMessageId(), PinnedMessageSnapshot, pollChatters(), pollPinnedMessage(), readPersistedPinnedMessageId(), refreshPinnedMessage(), schedulePinnedMessageRefresh() (+17 more)

### Community 8 - "devDependencies"
Cohesion: 0.10
Nodes (20): copy-webpack-plugin, description, devDependencies, copy-webpack-plugin, @rocketman-streamkit/types, ts-loader, typescript, webpack (+12 more)

### Community 9 - "compilerOptions"
Cohesion: 0.14
Nodes (13): ES2020, node_modules, @rocketman-streamkit/types/addon.d.ts, ./**/*.ts, compilerOptions, lib, noEmit, skipLibCheck (+5 more)

### Community 10 - "reward-title.ts"
Cohesion: 0.23
Nodes (13): buildRewardTitle(), consumerFromManifestType(), formatRewardTitle(), hasRewardEmojiPrefix(), isRewardConsumer(), OVERLAY_MANIFEST_TYPES, resolveConsumerFromAddonInfo(), resolveConsumerFromApplied() (+5 more)

### Community 11 - "dashboard-feed.ts"
Cohesion: 0.11
Nodes (22): ANNOUNCEMENT_STYLE_HEADER, CHAT_NOTIFICATION_STYLE_COLORS, CHAT_NOTIFICATION_STYLE_HEADERS, ChatMessageStyle, ChatNotificationKind, FIRST_MESSAGE_STYLE, FIRST_MESSAGE_STYLE_HEADER, formatModeratorPrefix() (+14 more)

### Community 12 - "chat-triggers.ts"
Cohesion: 0.23
Nodes (11): AppliedTriggerCategories, CHAT_TRIGGER_KEYS, ChatTriggerRule, chatTriggerRuleId(), chatTriggerRules, collectChatTriggerRules(), dispatchChatMessageTriggers(), formatChatTriggerRecordMessage() (+3 more)

### Community 13 - "trigger-validation.ts"
Cohesion: 0.33
Nodes (3): DraftSnapshot, INVALID_REWARD_MESSAGES, TriggerRuleLike

### Community 16 - "StreamKit+ Addon — Agent Guide"
Cohesion: 0.13
Nodes (14): Addon categories (`manifest.type`), Context7 in Cursor / IDE, Development, Missing API in TypeScript addons, npm typings, Official documentation, Permissions, Release (+6 more)

### Community 17 - "buildTwitchProfile"
Cohesion: 0.23
Nodes (12): formatAutomaticRewardType(), formatHighlightedMessage(), formatRewardMessage(), pushAutomaticRewardRedemption(), pushCustomRewardRedemption(), pushRewardRedemptionChatNotification(), avatarCache, buildTwitchProfile() (+4 more)

### Community 18 - "localizedTier"
Cohesion: 0.24
Nodes (11): localizedGiftedSubs(), localizedGiftedSubTo(), localizedGiftSubscription(), localizedMonths(), localizedPaidSubscription(), localizedResubMonthsOnly(), localizedResubWithText(), localizedTier() (+3 more)

### Community 19 - "Twitch"
Cohesion: 0.20
Nodes (9): English, For developers, For users, Twitch, Для користувачів, Для пользователей, Для разработчиков, Русский (+1 more)

### Community 20 - "release-body.md"
Cohesion: 0.50
Nodes (3): Install, Встановлення, Установка

## Knowledge Gaps
- **147 isolated node(s):** `PollAddonChoice`, `PollAddonEvent`, `PredictionTopPredictor`, `PredictionAddonOutcome`, `PredictionAddonEvent` (+142 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 154 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **2 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `reloadSettings()` connect `reloadSettings` to `reward-lifecycle.ts`, `tracking.ts`, `eventsub.ts`, `chat-monitor.ts`?**
  _High betweenness centrality (0.037) - this node is a cross-community bridge._
- **Why does `TwitchEventSubClient` connect `eventsub.ts` to `tracking.ts`?**
  _High betweenness centrality (0.031) - this node is a cross-community bridge._
- **Why does `TwitchApi` connect `reward-lifecycle.ts` to `config.ts`, `tracking.ts`, `eventsub.ts`, `reloadSettings`, `chat-monitor.ts`, `buildTwitchProfile`?**
  _High betweenness centrality (0.029) - this node is a cross-community bridge._
- **What connects `PollAddonChoice`, `PollAddonEvent`, `PredictionTopPredictor` to the rest of the system?**
  _147 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `reward-lifecycle.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.09966777408637874 - nodes in this community are weakly interconnected._
- **Should `config.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.08974358974358974 - nodes in this community are weakly interconnected._
- **Should `tracking.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.083710407239819 - nodes in this community are weakly interconnected._