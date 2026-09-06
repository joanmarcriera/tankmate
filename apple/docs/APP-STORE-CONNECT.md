# Tankmate iOS — App Store Connect record + signing

Adapted from the `deploy-to-apple` skill (written for Distavo on macOS) to iOS.
**Nothing in this file has been done.** It is the run-sheet for the steps that need
Marc's Apple account; the App Store Connect record and the certificates are his to
create, and no automation here should create them for him.

Team ID: `D427C2J4RG` · Bundle ID: `uk.co.riera.tankmate`

---

## 0. What differs from Distavo

Distavo ships three macOS channels (Direct DMG, Mac App Store, Setapp) and needs a
Developer ID cert and notarization for two of them. Tankmate iOS ships **one channel**,
the App Store, so:

| | Distavo (macOS) | Tankmate (iOS) |
|---|---|---|
| Channels | 3 (own target each) | 1 |
| Notarization | yes, for Direct + Setapp | **not applicable** — the App Store signs |
| Signing certs | Developer ID Application, Apple Distribution, 3rd Party Mac Developer Installer | **Apple Distribution only** |
| Installer cert | required (`.pkg`) | **not required** — iOS uploads an `.ipa` |
| Sandbox entitlement | required for the store build | not applicable on iOS |
| Provisioning profile | Mac App Store profile | **iOS App Store profile (required)** |

The commonest macOS first-submission failure — forgetting the *3rd Party Mac Developer
Installer* cert — cannot happen here. The iOS equivalent trap is the **provisioning
profile**: an iOS App Store build will not sign at all without one (macOS merely warns
with ITMS-90889).

---

## 1. Apple Developer portal (developer.apple.com)

1. **Identifiers → App IDs → +**
   - Description: `Tankmate`
   - Bundle ID: **Explicit** → `uk.co.riera.tankmate`
   - Capabilities: leave everything **off** for the first release.
     Tick **Push Notifications** only when the push stub is actually going to be used —
     see §5.
2. **Certificates → + → Apple Distribution** (one cert covers iOS and macOS distribution).
   If a valid Apple Distribution cert already exists from Distavo, **reuse it** — the
   limit is 3 and each new one is a revocation risk for the existing pipeline.
3. **Profiles → + → App Store Connect (iOS)** for `uk.co.riera.tankmate`, signed by the
   Apple Distribution cert above. Download as `Tankmate_AppStore.mobileprovision`.

## 2. App Store Connect (appstoreconnect.apple.com)

1. **Apps → + → New App**
   - Platform: **iOS**
   - Name: `Tankmate` (must be globally unique — check availability before anything else;
     if taken, `Tankmate Aquarium` is the fallback and the name must then also change in
     `apple/metadata/listing.json` and the target's `INFOPLIST_KEY_CFBundleDisplayName`)
   - Primary language: English (U.K.)
   - Bundle ID: `uk.co.riera.tankmate`
   - SKU: `tankmate-ios`
   - User access: Full Access
2. Fill the version listing from **`apple/metadata/listing.json`** — subtitle, promotional
   text, description, keywords, support URL, marketing URL, copyright, category. Every
   field there is already inside Apple's length limits.
3. **Privacy** → Data Collection → **"No, we do not collect data from this app."**
   This matches `apple/Resources/PrivacyInfo.xcprivacy`, and it is true by construction:
   the app makes no network requests.
4. **Privacy Policy URL** → `https://tankmate.joanmarcriera.es/privacy/`
   **Support URL** → `https://tankmate.joanmarcriera.es/support/`
   Both pages are drafted in this branch (`privacy/`, `support/`) but are **not live until
   the branch merges to `main`**. Apple rejects a submission whose privacy URL 404s, so
   merge before submitting.
5. **Age rating** → answer everything "None" → 4+.
6. **Pricing** → Free.
7. **Screenshots** — required: 6.9" iPhone (1320×2868). A 6.5" set is only needed if you
   want it; modern App Store Connect will scale the 6.9" set down. Capture from the
   simulator (`xcrun simctl io <udid> screenshot`).
8. **App Review Information** — sign-in not required. Paste the `reviewNotes` and
   `guideline42` text from `listing.json` into the notes field.

## 3. Secrets (repo → Settings → Secrets and variables → Actions)

Marc adds these himself in the GitHub UI. Never printed, committed, or pasted into chat.

```
APPLE_TEAM_ID                             D427C2J4RG
APPLE_DISTRIBUTION_CERT_P12_BASE64        base64 -i AppleDistribution.p12 | pbcopy
APPLE_DISTRIBUTION_CERT_PASSWORD          its .p12 passphrase
IOS_APP_STORE_PROVISIONING_PROFILE_BASE64 base64 -i Tankmate_AppStore.mobileprovision | pbcopy
ASC_API_KEY_ID / ASC_API_ISSUER_ID / ASC_API_KEY_P8_BASE64
```

If the Distavo ASC API key (App Manager role) is still valid, reuse it — it is
account-wide, not per-app.

Not needed for iOS: `DEVELOPER_ID_CERT_*`, `APPLE_NOTARY_PASSWORD`, `APPLE_ID`,
`APPLE_INSTALLER_CERT_*`, `SPARKLE_ED_PRIVATE_KEY`.

## 4. The CI keychain dance

Identical to the macOS pipeline — a throwaway keychain per run, every cert imported into
the *same* one, and the two lines people forget:

```sh
security set-key-partition-list -S apple-tool:,apple:,codesign: -s -k "$KEYCHAIN_PW" "$KEYCHAIN"
security list-keychains -d user -s "$KEYCHAIN"
```

Plus the iOS-only step — the profile must be installed where Xcode looks for it:

```sh
mkdir -p ~/Library/MobileDevice/Provisioning\ Profiles
echo "$IOS_APP_STORE_PROVISIONING_PROFILE_BASE64" | base64 -d \
  > ~/Library/MobileDevice/Provisioning\ Profiles/Tankmate_AppStore.mobileprovision
```

Then archive and export:

```sh
xcodebuild archive -project apple/Tankmate.xcodeproj -scheme Tankmate \
  -configuration Release -destination 'generic/platform=iOS' \
  -archivePath build/Tankmate.xcarchive DEVELOPMENT_TEAM="$APPLE_TEAM_ID"
xcodebuild -exportArchive -archivePath build/Tankmate.xcarchive \
  -exportOptionsPlist build/ExportOptions.plist -exportPath build/export   # method: app-store
xcrun altool --upload-app -f build/export/Tankmate.ipa -t ios \
  --apiKey "$ASC_API_KEY_ID" --apiIssuer "$ASC_API_ISSUER_ID" | tee upload.log
```

`altool --upload-app` is deprecated but still works; migrate to `xcrun notarytool`'s
successor / the ASC upload API before it is removed. Apple can **accept with warnings** —
grep `upload.log` and fail the job even on exit 0.

Submitting the uploaded build for review is the ASC REST API's job → use the
`mac-appstore-submission-api` skill (the submission state machine is platform-agnostic).
Put the submit step behind a GitHub environment with a required reviewer.

## 5. Turning push notifications on (later)

The stub in `apple/Sources/PushRegistrar.swift` is compiled out. To enable:

1. Add the **Push Notifications** capability to the App ID (§1.1) and **regenerate** the
   provisioning profile — an existing profile does not gain the capability.
2. Uncomment `CODE_SIGN_ENTITLEMENTS` and `SWIFT_ACTIVE_COMPILATION_CONDITIONS` in
   `apple/configs/AppStore.xcconfig`.
3. Implement a destination for the APNs token and add the matching entry to
   `PrivacyInfo.xcprivacy` — the app would then no longer be "no data collected".

Enabling the entitlement before step 1 makes signing fail with a profile mismatch.

## 6. Verify before claiming it shipped

```sh
codesign --verify --strict --verbose=2 build/export/Payload/Tankmate.app
unzip -l build/export/Tankmate.ipa | grep embedded.mobileprovision   # must be present
/usr/libexec/PlistBuddy -c 'Print :CFBundleShortVersionString' \
  build/export/Payload/Tankmate.app/Info.plist
```

"The workflow went green" is not evidence. Check the artifact, and check the build
actually appears in App Store Connect under TestFlight before submitting it.

## 7. The one real review risk: Guideline 4.2

Tankmate is a web app in a native shell, and Apple rejects bare wrappers under
"minimum functionality". What is in the app's favour, and what to say in the review notes:

- It ships its entire content **inside the bundle** and works in aeroplane mode. It is not
  a browser pointed at a website.
- It has a **native launch experience**, a native icon, and native **scheduled local
  notifications** — a capability iOS Safari does not give a web app.
- The value is the domain rules (the verdict engine), not the presentation.

If it is rejected anyway, the cheapest escalation is to move one more screen to native
(the Playbook is the easiest — it is static content), not to rebuild the whole app.
