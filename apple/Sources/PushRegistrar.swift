//  PushRegistrar.swift
//  Remote (APNs) push notifications — wired but switched OFF.
//
//  Tankmate is local-first and has no server that knows about a user's tank, so
//  there is nothing to push yet. The path is scaffolded so that turning it on is
//  a configuration change rather than a rewrite. To enable:
//
//    1. Add the Push Notifications capability to the App ID uk.co.riera.tankmate
//       in the Developer portal, and regenerate the App Store provisioning profile.
//    2. Uncomment CODE_SIGN_ENTITLEMENTS and SWIFT_ACTIVE_COMPILATION_CONDITIONS
//       in apple/configs/AppStore.xcconfig (the REMOTE_PUSH_ENABLED flag below).
//    3. Implement `deliver(token:)` to send the APNs token to whatever service
//       ends up owning it, and write a matching privacy-manifest entry.
//
//  Enabling the entitlement before step 1 makes code signing fail, which is why
//  the whole path is behind a compilation condition rather than a runtime flag.

import Foundation
import UIKit
import UserNotifications

final class PushRegistrar: NSObject {
    static let shared = PushRegistrar()

    /// Called once the user has granted notification permission. Local reminders
    /// need no entitlement; only the remote registration below does.
    func registerIfEnabled() {
        #if REMOTE_PUSH_ENABLED
        UNUserNotificationCenter.current().delegate = self
        UIApplication.shared.registerForRemoteNotifications()
        #endif
    }

    /// APNs device token, hex-encoded. No-op until a backend exists to receive it.
    func handle(deviceToken: Data) {
        let hex = deviceToken.map { String(format: "%02x", $0) }.joined()
        #if DEBUG
        print("[Tankmate] APNs device token: \(hex)")
        #else
        _ = hex   // deliver(token: hex) — no destination yet, deliberately dropped.
        #endif
    }

    func handle(registrationError: Error) {
        #if DEBUG
        print("[Tankmate] APNs registration failed: \(registrationError)")
        #endif
    }
}

extension PushRegistrar: UNUserNotificationCenterDelegate {
    /// Show reminders even while Tankmate is in the foreground — a water-test
    /// reminder that only appears when the app is closed is useless.
    func userNotificationCenter(_ center: UNUserNotificationCenter,
                                willPresent notification: UNNotification) async
        -> UNNotificationPresentationOptions {
        [.banner, .sound, .list]
    }
}

/// Minimal app delegate: SwiftUI has no lifecycle hook for the APNs callbacks.
final class AppDelegate: NSObject, UIApplicationDelegate {
    func application(_ application: UIApplication,
                     didFinishLaunchingWithOptions options: [UIApplication.LaunchOptionsKey: Any]? = nil) -> Bool {
        UNUserNotificationCenter.current().delegate = PushRegistrar.shared
        PushRegistrar.shared.registerIfEnabled()
        return true
    }

    func application(_ application: UIApplication,
                     didRegisterForRemoteNotificationsWithDeviceToken token: Data) {
        PushRegistrar.shared.handle(deviceToken: token)
    }

    func application(_ application: UIApplication,
                     didFailToRegisterForRemoteNotificationsWithError error: Error) {
        PushRegistrar.shared.handle(registrationError: error)
    }
}
