# Research 03 — Shipping to the App Store, late 2026

*Compiled 2026-09-03. Scope: iOS 17+, iPhone, no accounts, no ads or IAP at v1; ads, IAP, and Game Center possible later. Every claim carries a URL. Items that could not be checked against a live primary source are marked **[UNVERIFIED]** and listed again at the end.*

## 1. Toolchain

- **Current Xcode:** 26.6 (June 25, 2026), Swift 6.3, iOS 26.5 SDK, requires macOS Tahoe 26.2+ ([Apple releases](https://developer.apple.com/news/releases/?id=06252026a), [release notes](https://developer.apple.com/documentation/xcode-release-notes/xcode-26_6-release-notes)). Xcode 27 beta appeared June 8, 2026; GA expected mid-September ([Apple releases](https://developer.apple.com/news/releases/?id=06082026a)) **[UNVERIFIED]**.
- **Minimum for submission:** since April 28, 2026 uploads must be built with Xcode 26+ and the iOS 26 SDK ([upcoming requirements](https://developer.apple.com/news/upcoming-requirements/)). Deployment target iOS 17 is still fine. Apps built against the iOS 26 SDK get Liquid Glass styling on native UI by default ([dev.to](https://dev.to/alanwest/apples-april-sdk-deadline-is-here-your-app-might-get-rejected-5di7)).
- **Swift 6 strict concurrency and SpriteKit.** `SKNode`/`SKScene` are `@MainActor`, so scene subclasses inherit isolation ([forums 761555](https://developer.apple.com/forums/thread/761555)). The recurring failure is overriding methods of a non-`@MainActor` class (GameplayKit `GKState`, `GKComponent`); Apple DTS recommended staying in Swift 5 mode for GameplayKit code, and the community workaround is `MainActor.assumeIsolated {}` ([forums 767042](https://developer.apple.com/forums/thread/767042)). New Xcode 26 projects default `SWIFT_DEFAULT_ACTOR_ISOLATION = MainActor` ([swiftlang #82870](https://github.com/swiftlang/swift/issues/82870), [Donny Wals](https://www.donnywals.com/setting-default-actor-isolation-in-xcode-26/)). **PitchFlap uses no GameplayKit and does all mutation in `update`/`didMove`/`touchesBegan`, so it is safe in either mode.**
- **Synchronized folders (`objectVersion = 77`).** Xcode 16's `PBXFileSystemSynchronizedRootGroup` is Xcode's own default and valid for submission ([Xcode 16 notes](https://developer.apple.com/documentation/xcode-release-notes/xcode-16-release-notes), [XcodeGen #1505](https://github.com/yonaskolb/XcodeGen/issues/1505)). Older CocoaPods/fastlane initially choked on it ([CocoaPods #12456](https://github.com/CocoaPods/CocoaPods/issues/12456), [fastlane #22265](https://github.com/fastlane/fastlane/issues/22265)); Xcode 15 cannot open it. **[objectVersion 77 confirmed via tooling issues, not an Apple doc]**.

## 2. Submission requirements

| Requirement | Detail | Source |
|---|---|---|
| Developer Program | $99/yr; individuals need 2FA and legal name; no D-U-N-S; confirmation within ~24 h, 1–3 days reported | [enroll](https://developer.apple.com/programs/enroll/), [help](https://developer.apple.com/help/account/membership/program-enrollment/) |
| App record | Register bundle ID first; name ≤30 chars (2.3.7), SKU, primary language; Account Holder must sign latest agreement | [add app](https://developer.apple.com/help/app-store-connect/create-an-app-record/add-a-new-app) |
| Icon | One 1024×1024 opaque PNG in the asset catalog; optional dark/tinted; Icon Composer `.icon` optional but keep the PNG fallback | [configuring icon](https://developer.apple.com/documentation/xcode/configuring-your-app-icon), [forums 799917](https://developer.apple.com/forums/thread/799917) |
| Launch screen | `UILaunchScreen` plist key (the project already sets `INFOPLIST_KEY_UILaunchScreen_Generation`) | [launch screen](https://developer.apple.com/documentation/xcode/specifying-your-apps-launch-screen) |
| Screenshots | 6.9" (1320×2868) is primary; 6.5" only if no 6.9"; 1–10, JPEG/PNG, no alpha; must show real gameplay (2.3.3), 4+-appropriate (2.3.8) | [specs](https://developer.apple.com/help/app-store-connect/reference/screenshot-specifications) |
| Age rating | 2025 overhaul added 13+/16+/18+ and new questions; a July 2026 social-media question is mandatory from September 2026. A no-violence tap game is 4+; "Advertising" descriptor does not raise it | [news](https://developer.apple.com/news/?id=ks775ehf), [July 2026](https://developer.apple.com/news/?id=tlur8uvi), [definitions](https://developer.apple.com/help/app-store-connect/reference/age-ratings-values-and-definitions/) |
| App Privacy label | "Collected" = leaves the device. v1 with no SDKs: "No, we do not collect data". Crash and performance data are *not* optional-disclosure, so any crash SDK must be declared | [manage privacy](https://developer.apple.com/help/app-store-connect/manage-app-information/manage-app-privacy), [details](https://developer.apple.com/app-store/app-privacy-details/) |
| Privacy manifest | Required since May 1, 2024. Keys: `NSPrivacyTracking`, `NSPrivacyTrackingDomains`, `NSPrivacyCollectedDataTypes`, `NSPrivacyAccessedAPITypes`. v1 declares `NSPrivacyAccessedAPICategoryUserDefaults` reason `CA92.1` (high score), tracking false, everything else empty | [manifest files](https://developer.apple.com/documentation/bundleresources/privacy-manifest-files), corroborated by shipped manifests ([TelemetryDeck](https://raw.githubusercontent.com/TelemetryDeck/SwiftSDK/main/Sources/TelemetryDeck/PrivacyInfo.xcprivacy), [Sentry](https://raw.githubusercontent.com/getsentry/sentry-cocoa/main/Sources/Resources/PrivacyInfo.xcprivacy)) |
| Export compliance | `ITSAppUsesNonExemptEncryption = NO` in Info.plist; HTTPS-only apps are exempt | [overview](https://developer.apple.com/help/app-store-connect/manage-app-information/overview-of-export-compliance) |
| Privacy policy URL | Required for **all** apps (5.1.1(i)), in App Store Connect and reachable in-app, even with zero collection | [guidelines](https://developer.apple.com/app-store/review/guidelines/) |
| Content rights | One-time question, hard to change; "No" if all art/audio is yours | [forums 114514](https://developer.apple.com/forums/thread/114514) |
| Sign in with Apple | Only if a third-party login is offered (4.8). Not applicable | [guidelines](https://developer.apple.com/app-store/review/guidelines/) |
| TestFlight | 100 internal (no review), 10,000 external (first build per version gets Beta App Review); builds expire in 90 days | [overview](https://developer.apple.com/help/app-store-connect/test-a-beta-version/testflight-overview) |
| Review time | Apple: 90% under 24 h; trackers report 2–3 days for a first submission | [App Review](https://developer.apple.com/distribute/app-review/), [tracker](https://appcompliance.io/blog/app-store-review-time-2026/) |

**Guidelines most likely to bite** (wording current as of June 8, 2026 — [guidelines](https://developer.apple.com/app-store/review/guidelines/), [news](https://developer.apple.com/news/?id=a233fmpw)): 2.1 crashes/incomplete; 2.3.1/2.3.3 metadata and screenshots; 3.1.1 IAP and restore; 4.2 "lasting entertainment value"; **4.3(b), expanded June 2026:** "Don't submit apps that are indistinguishable from what's already widely available… we will not accept new submissions unless they offer a meaningfully different or improved experience," with removal of live apps possible; 4.1 copycats; 5.1.1(ii) consent for usage data "even if… anonymous"; 2.5.18 ads must be age-appropriate with close buttons and a report mechanism.

**Clone risk, specifically.** Solo developers with wholly original puzzle games received 4.3(a) rejections in 2025 and overturned them only by escalating with proof of authorship ([forums 773504](https://developer.apple.com/forums/thread/773504), [767018](https://developer.apple.com/forums/thread/767018)). Reviewers judge from the first minute on screen; differentiation must be visible in play and led with in screenshots and subtitle; a colour swap does not clear a rejection ([ezscreenshots](https://ezscreenshots.com/blog/design-spam-rejection-4-3b), [App Launch Club](https://www.applaunchclub.co/blog/app-store-rejection-guideline-4-3)).

## 3. Monetisation, later

- **StoreKit 2.** `Product.products(for:)` → `purchase()` → verify → `finish()`; listen to `Transaction.updates` from launch; `currentEntitlements` returns non-consumables (the "remove ads" case); consumables must be recorded locally on finish; `AppStore.sync()` backs the mandatory Restore button; test with a `.storekit` file ([IAP](https://developer.apple.com/documentation/storekit/in-app-purchase), [forums 706253](https://developer.apple.com/forums/thread/706253), [StoreKit testing](https://developer.apple.com/documentation/xcode/setting-up-storekit-testing-in-xcode)). IAPs must be functional for the reviewer (2.1(b)).
- **Ads and ATT.** Any SDK that combines your users' data with other apps' for targeting needs the ATT prompt; fingerprinting is banned ([user privacy](https://developer.apple.com/app-store/user-privacy-and-data-use/), [ATT](https://developer.apple.com/documentation/apptrackingtransparency)). AdMob v13 (Feb 2026) ships a manifest, treats ATT as optional and serves non-personalised ads without IDFA; UMP handles GDPR consent ([data disclosure](https://developers.google.com/admob/ios/privacy/data-disclosure), [IDFA](https://developers.google.com/admob/ios/privacy/idfa)). AppLovin MAX dominates iOS mediation; ships a manifest and consent flow ([MAX flow](https://support.axon.ai/en/max/ios/overview/terms-and-privacy-policy-flow)) **[vendor pages blocked]**. Unity LevelPlay manifest from SDK 7.9.0; waterfall-only ended Jan 31, 2026 ([Unity](https://docs.unity.com/en-us/grow/levelplay/sdk/ios/privacy-settings-configurations)) **[UNVERIFIED]**. Rewarded eCPM roughly $15–30 Tier-1 ([UndrAds](https://undrads.com/blogs/ironsource-vs-applovin-max-vs-admob)) **[industry estimate]**.
- **Rewarded "continue"** after death is the canonical first placement; opt-in button beats popup; industry claims 25–35% D1 lift with caps of 6–10 views/session ([Unity](https://unity.com/blog/the-fundamentals-of-rewarded-video-ad-placements), [AdReact](https://www.adreact.com/blog/rewarded-video-best-practices-maximize-revenue/)) **[vendor claims]**.
- **Game Center.** Entitlement `com.apple.developer.game-center`, enable in App Store Connect, `GKLocalPlayer.local.authenticateHandler`, optional `GKAccessPoint`; classic leaderboard with ID, format, sort order, one localisation, submitted with the version; scores via `GKLeaderboard.submitScore` ([enabling](https://developer.apple.com/documentation/gamekit/enabling-and-configuring-game-center), [leaderboards](https://developer.apple.com/help/app-store-connect/configure-game-center/manage-leaderboards/), [GKLeaderboard](https://developer.apple.com/documentation/gamekit/gkleaderboard)). Game Center use may require label disclosure.

## 4. Telemetry and crash reporting, privacy-first

| Option | Free tier | Label / ATT | Note |
|---|---|---|---|
| Apple App Analytics | Free, no SDK | none | Opt-in users only; downloads, sessions, retention, crash rate ([analytics](https://developer.apple.com/app-store-connect/analytics/)) |
| MetricKit + Xcode Organizer | Free, no SDK | none | Daily `MXCrashDiagnostic`, hitch ratio; 24–48 h lag, no alerting ([MetricKit](https://developer.apple.com/documentation/metrickit)) |
| TelemetryDeck | 100k signals/mo (50k after July 2026) | Product Interaction + Device ID, not linked, no tracking, CA92.1 ([manifest](https://raw.githubusercontent.com/TelemetryDeck/SwiftSDK/main/Sources/TelemetryDeck/PrivacyInfo.xcprivacy)) | Salted-hashed IDs; no ATT **[pricing UNVERIFIED]** |
| Aptabase | 20k events/mo | Product Interaction only | AGPL, self-hostable **[UNVERIFIED]** |
| Firebase Analytics | Free | App-instance ID, coarse IP location; FirebaseCore on Apple's mandatory-manifest list ([SDK list](https://developer.apple.com/support/third-party-SDK-requirements/)) | Heaviest label cost |
| Crashlytics / Sentry | Free tiers | Crash + Diagnostic data, not linked | Sentry declares CA92.1, 35F9.1, C617.1 |

Guideline 5.1.1(ii) requires consent for usage data "even if… anonymous"; TelemetryDeck's position is that its data is non-personal under GDPR ([FAQ](https://telemetrydeck.com/docs/guides/privacy-faq/)) **[not legal advice; a settings toggle is cheap insurance]**. **For v1: Organizer + MetricKit only, label stays "Data Not Collected".**

## 5. Ongoing obligations

- **Renewal:** lapse removes apps from sale; renewal window opens 30 days before expiry ([renewal](https://developer.apple.com/support/renewal/)).
- **SDK bumps:** Apple enforces "latest SDK" each spring (Xcode 15 from Apr 2024, Xcode 26 from Apr 2026); expect iOS 27 SDK ≈ April 2027 ([upcoming](https://developer.apple.com/news/upcoming-requirements/)) **[projection]**.
- **EU DSA trader status:** required for EU availability since Feb 17, 2025; a monetising solo dev is a trader and must verify address/phone/email; a hobbyist may declare non-trader ([DSA help](https://developer.apple.com/help/app-store-connect/manage-compliance-information/manage-european-union-digital-services-act-trader-requirements/), [news](https://developer.apple.com/news/?id=einwn76m)).
- **Small Business Program:** 15% under $1M; enroll before the first IAP goes live ([program](https://developer.apple.com/app-store/small-business-program/)).
- **EU terms from Oct 1, 2026:** Core Technology Fee replaced by a 5% commission only for apps distributed outside the App Store; App Store IAP in the EU is 26% standard / 15% SBP ([news](https://developer.apple.com/news/?id=gmws0jgp)). No change for an App-Store-only indie.
- **US age-assurance (Texas SB 2420, June 2026):** Declared Age Range API available; a 4+ game with no accounts has little to do ([news](https://developer.apple.com/news/?id=sg176nne)).

## 6. Reject risks for this game, ranked

1. **4.3(b) / 4.1 clone risk — highest.** Mitigate with a visibly distinct mechanic, original art and name (no "Flappy"), screenshots that lead with the difference, a Notes-for-Review paragraph describing it, and proof of authorship ready for an appeal.
2. **4.2 minimum functionality** — one endless mode may read as thin. Medals, persistence, difficulty ramp help.
3. **2.1 crashes** — test on device; `assumeIsolated` misuse crashes at runtime.
4. **5.1.1(i) missing privacy-policy URL** — required even with no collection.
5. **Privacy manifest omission** — ITMS-91053 for UserDefaults without CA92.1.
6. **Age-rating questions unanswered** — blocks submission since Sept 2026.
7. **Export compliance unanswered** — build stuck in "Missing Compliance".
8. **Later: ATT / label mismatch** when an ad SDK is added (5.1.2).

## 7. Pre-submission checklist

Adopted into `studio/templates/release-checklist.md`; source URLs there.

## Unverified items

Required-reason API code text (Apple page is JS-rendered; corroborated by shipped manifests); `objectVersion = 77` (tooling issues only); Xcode 26.6 details and Xcode 27 GA; AppLovin MAX and Unity LevelPlay manifest contents; AdMob v13 disclosure list; TelemetryDeck, Aptabase, PostHog, Sentry pricing; rewarded-video lift and eCPM figures; whether `SKPhysicsContactDelegate` is `@MainActor` in the iOS 26 SDK (check the generated interface in Xcode).
