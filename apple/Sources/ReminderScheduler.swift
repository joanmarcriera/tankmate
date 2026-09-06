//  ReminderScheduler.swift
//  Local (on-device) notification reminders — the one thing the native app does
//  that the PWA cannot do on iOS.
//
//  This is deliberate, not decoration: Safari on iOS only delivers Web Push to a
//  home-screen PWA, and cannot schedule a recurring local reminder at all. It is
//  also Tankmate's answer to App Review Guideline 4.2 (minimum functionality),
//  which a bare webview wrapper fails.
//
//  Everything here is local: nothing is sent anywhere, no server is involved.

import Foundation
import UserNotifications

@MainActor
final class ReminderScheduler: ObservableObject {
    /// Identifier of the single repeating request, so rescheduling replaces it.
    private static let requestID = "tankmate.weekly-water-test"

    private enum Key {
        static let enabled = "reminders.weekly.enabled"
        static let weekday = "reminders.weekly.weekday"   // 1 = Sunday … 7 = Saturday
        static let hour    = "reminders.weekly.hour"
    }

    @Published var isEnabled: Bool { didSet { persistAndApply() } }
    /// 1 = Sunday … 7 = Saturday, matching `DateComponents.weekday`.
    @Published var weekday: Int { didSet { persistAndApply() } }
    @Published var hour: Int { didSet { persistAndApply() } }
    /// nil until the authorisation status has been read at least once.
    @Published private(set) var authorization: UNAuthorizationStatus?

    private let defaults: UserDefaults
    private let center: UNUserNotificationCenter

    init(defaults: UserDefaults = .standard, center: UNUserNotificationCenter = .current()) {
        self.defaults = defaults
        self.center = center
        // Sunday morning by default: the weekend is when a tank actually gets
        // looked at, and a test before a water change is the useful order.
        isEnabled = defaults.bool(forKey: Key.enabled)
        weekday = defaults.object(forKey: Key.weekday) as? Int ?? 1
        hour = defaults.object(forKey: Key.hour) as? Int ?? 10
    }

    func refreshAuthorization() async {
        authorization = await center.notificationSettings().authorizationStatus
    }

    /// Asks for permission, then turns the weekly reminder on if it was granted.
    func enable() async {
        do {
            let granted = try await center.requestAuthorization(options: [.alert, .sound, .badge])
            await refreshAuthorization()
            isEnabled = granted
        } catch {
            await refreshAuthorization()
            isEnabled = false
        }
    }

    func disable() {
        isEnabled = false
    }

    // MARK: - Internals

    private func persistAndApply() {
        defaults.set(isEnabled, forKey: Key.enabled)
        defaults.set(weekday, forKey: Key.weekday)
        defaults.set(hour, forKey: Key.hour)
        Task { await apply() }
    }

    private func apply() async {
        center.removePendingNotificationRequests(withIdentifiers: [Self.requestID])
        guard isEnabled else { return }

        let content = UNMutableNotificationContent()
        content.title = "Test your water"
        content.body = "NH₃, NO₂, NO₃ and KH. Log the readings and Tankmate will tell you what to do."
        content.sound = .default

        var when = DateComponents()
        when.weekday = weekday
        when.hour = hour
        when.minute = 0

        let request = UNNotificationRequest(
            identifier: Self.requestID,
            content: content,
            trigger: UNCalendarNotificationTrigger(dateMatching: when, repeats: true)
        )
        try? await center.add(request)
    }

    /// Pending reminders, for the verification screen and for debugging.
    func pendingCount() async -> Int {
        await center.pendingNotificationRequests().count
    }

    static func weekdayName(_ weekday: Int) -> String {
        let symbols = Calendar(identifier: .gregorian).weekdaySymbols   // index 0 = Sunday
        let index = max(1, min(7, weekday)) - 1
        return symbols[index]
    }
}
