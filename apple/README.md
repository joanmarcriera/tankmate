# Tankmate for iOS

A thin SwiftUI shell around the same web app that runs at
[tankmate.joanmarcriera.es](https://tankmate.joanmarcriera.es/), plus the one thing iOS
Safari cannot do: scheduled local reminders.

The web app in the **repo root** is the single source of truth. Nothing is copied into
`apple/`; a build phase bundles the root files into the `.app`, so the verdict engine
cannot drift between web and native.

## Build and run

```sh
cd apple
xcodegen generate                       # after editing project.yml

xcodebuild -project Tankmate.xcodeproj -scheme Tankmate \
  -destination 'platform=iOS Simulator,name=iPhone 17 Pro' \
  CODE_SIGNING_ALLOWED=NO build

xcodebuild test -project Tankmate.xcodeproj -scheme Tankmate \
  -destination 'platform=iOS Simulator,name=iPhone 17 Pro' CODE_SIGNING_ALLOWED=NO
```

Requires `xcodegen` (`brew install xcodegen`). There is no package manager, no
`node_modules`, and no CocoaPods.

## Layout

```
apple/
├── project.yml                 XcodeGen spec — the source of truth for the project
├── Tankmate.xcodeproj/         generated, committed so CI needs no xcodegen
├── Sources/
│   ├── TankmateApp.swift              @main; hosts the web view and the sheet
│   ├── WebAppView.swift               WKWebView + the injected native bridge
│   ├── BundledWebSchemeHandler.swift  serves tankmate://app/ from the bundle
│   ├── ReminderScheduler.swift        weekly local notification
│   ├── RemindersView.swift            the native sheet behind the header bell
│   └── PushRegistrar.swift            APNs path, compiled out until enabled
├── Resources/
│   ├── Assets.xcassets/        AppIcon, LaunchLogo, LaunchBackground
│   └── PrivacyInfo.xcprivacy   no tracking, no collected data
├── UITests/                    proves the bundle renders and the bridge works
├── configs/AppStore.xcconfig   bundle id; push entitlement commented out
├── metadata/listing.json       App Store listing draft
├── docs/APP-STORE-CONNECT.md   the run-sheet for Marc's Apple account
└── scripts/
    ├── prepare-web-bundle.py   build phase: root web files → app bundle
    └── make-icon.swift         icon.svg → asset-catalog PNGs (run by hand)
```

## Three decisions worth knowing

**Why a custom URL scheme, not `file://`.** WKWebView gives `file://` pages an opaque
security origin, where `localStorage` is unreliable and can be dropped between launches —
and `localStorage` is where every water test lives. `tankmate://app/` has a real, stable
origin. Changing the scheme or host orphans every existing user's data, so treat both as
permanent.

**Why the external checkout is stripped at build time.** App Review Guideline 3.1.1
forbids steering users to an outside payment flow. `prepare-web-bundle.py` removes the
Lemon Squeezy link from the bundled HTML and **fails the build** if any trace survives —
removed, not hidden with CSS. It also means the app loads nothing from the network, which
is what makes the offline behaviour structural rather than a cache.

**Why there are local notifications at all.** Guideline 4.2 rejects bare webview wrappers.
Scheduled reminders are something a website cannot do on iOS, and they are genuinely
useful for a tank. See `docs/APP-STORE-CONNECT.md` §7.

## Releasing

Not wired yet. `docs/APP-STORE-CONNECT.md` has the App Store Connect record steps, the
signing list, the repo secrets, and the archive/export/upload commands, adapted from the
`deploy-to-apple` skill. The App Store Connect record does not exist yet.
