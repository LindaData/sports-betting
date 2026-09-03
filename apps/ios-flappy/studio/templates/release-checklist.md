# Release checklist — v<version> (<build>) — <yyyy-mm-dd>

Every item needs evidence (a file path, a screenshot name, an App Store Connect state), not a tick. Sources: `studio/research/03-ios-shipping-requirements.md`.

## Project (studio-release edits; owner verifies in Xcode)

- [ ] Built with Xcode 26+ / iOS 26 SDK; deployment target iOS 17 — https://developer.apple.com/news/upcoming-requirements/
- [ ] `MARKETING_VERSION` and `CURRENT_PROJECT_VERSION` bumped in both `project.pbxproj` and `project.yml`
- [ ] `PrivacyInfo.xcprivacy` present: tracking false, `NSPrivacyAccessedAPICategoryUserDefaults` / `CA92.1`, no collected data types (v1) — https://developer.apple.com/documentation/bundleresources/privacy-manifest-files
- [ ] `ITSAppUsesNonExemptEncryption = NO` — https://developer.apple.com/help/app-store-connect/manage-app-information/overview-of-export-compliance
- [ ] Launch screen via `UILaunchScreen` generation key — https://developer.apple.com/documentation/xcode/specifying-your-apps-launch-screen
- [ ] 1024×1024 opaque icon in the asset catalog — https://developer.apple.com/documentation/xcode/configuring-your-app-icon
- [ ] Portrait-only, iPhone-only confirmed in build settings
- [ ] No `DEVELOPMENT_TEAM`, `.p8`, `.p12`, or provisioning profile in the diff (hook enforces)
- [ ] grep for "Flappy" across `apps/ios-flappy/` returns only research and rules files

## Owner steps on the Mac (exact menu paths in the release notes)

- [ ] Apple Developer Program active — https://developer.apple.com/programs/enroll/
- [ ] Bundle ID registered; app record created (name ≤30 chars, SKU, language) — https://developer.apple.com/help/app-store-connect/create-an-app-record/add-a-new-app
- [ ] Archive, validate, upload
- [ ] TestFlight internal group; external group if G2+ — https://developer.apple.com/help/app-store-connect/test-a-beta-version/testflight-overview

## App Store Connect

- [ ] Screenshots 6.9" (1320×2868), real gameplay, per `studio/store/` shot-list — https://developer.apple.com/help/app-store-connect/reference/screenshot-specifications
- [ ] Name, subtitle, description, keywords from `studio/store/listing.md`; no "Flappy"
- [ ] Age rating questionnaire complete, including the September 2026 social-media question — https://developer.apple.com/news/?id=tlur8uvi
- [ ] App Privacy: "No, we do not collect data" (v1) or the exact declared types if telemetry is on — https://developer.apple.com/help/app-store-connect/manage-app-information/manage-app-privacy
- [ ] Privacy-policy URL set here and reachable in-app — guideline 5.1.1(i)
- [ ] Content Rights answered "No" (all art original) — https://developer.apple.com/forums/thread/114514
- [ ] EU DSA trader / non-trader status verified — https://developer.apple.com/help/app-store-connect/manage-compliance-information/manage-european-union-digital-services-act-trader-requirements/
- [ ] Notes for Review: one paragraph on what makes this game different (4.3(b)), demo instructions, authorship statement

## Review-risk assessment

| Guideline | Risk | Evidence | Mitigation |
|---|---|---|---|
| 4.3(b) / 4.1 clone | | | |
| 4.2 minimum functionality | | | |
| 2.1 crashes | | | |
| 5.1.1 privacy policy | | | |

## Before phase 2 (not this release)

- [ ] Small Business Program enrolled before the first IAP — https://developer.apple.com/app-store/small-business-program/
- [ ] Game Center entitlement and leaderboard configured — https://developer.apple.com/help/app-store-connect/configure-game-center/manage-leaderboards/
- [ ] Ad SDK gate passed: ATT decision, manifest update, label update, report-ad UI (2.5.18)

```
RELEASE: <version>  CHECKLIST: <done>/<total>  RISKS: <n> (<highest guideline>)  OWNER STEPS: <n>  FILE: <this path>
```
