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

/// The slice of UNUserNotificationCenter the scheduler uses, so tests can substitute a fake.
protocol NotificationCentering {
    func authorizationStatus() async -> UNAuthorizationStatus
    func requestAuthorization(options: UNAuthorizationOptions) async throws -> Bool
    func add(_ request: UNNotificationRequest) async throws
    func removePendingNotificationRequests(withIdentifiers: [String])
    func pendingNotificationRequests() async -> [UNNotificationRequest]
}
extension UNUserNotificationCenter: NotificationCentering {
    func authorizationStatus() async -> UNAuthorizationStatus { await notificationSettings().authorizationStatus }
}

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
    private let center: NotificationCentering

    /// Pro: per-tank schedules (persisted as JSON). Only applied while `isPro`.
    @Published private(set) var schedules: [ReminderSchedule] = []
    /// Set by the app from ProStore.isPro. Losing Pro cancels the extra schedules
    /// (they are kept, so they come back if the subscription is renewed).
    @Published var isPro = false { didSet { if oldValue != isPro { Task { await applySchedules() } } } }
    private static let schedulesKey = "reminders.schedules.v1"

    init(defaults: UserDefaults = .standard, center: NotificationCentering = UNUserNotificationCenter.current()) {
        self.defaults = defaults
        self.center = center
        // Sunday morning by default: the weekend is when a tank actually gets
        // looked at, and a test before a water change is the useful order.
        isEnabled = defaults.bool(forKey: Key.enabled)
        weekday = defaults.object(forKey: Key.weekday) as? Int ?? 1
        hour = defaults.object(forKey: Key.hour) as? Int ?? 10
        if let data = defaults.data(forKey: Self.schedulesKey),
           let saved = try? JSONDecoder().decode([ReminderSchedule].self, from: data) {
            schedules = saved
        }
    }

    // MARK: - Pro: per-tank schedules

    /// Returns false (and changes nothing) when the free tier's limit is hit.
    @discardableResult
    func addSchedule(_ schedule: ReminderSchedule) async -> Bool {
        guard ProGate.canAddReminder(currentCount: schedules.count, isPro: isPro) else { return false }
        schedules.append(schedule)
        await saveAndApplySchedules()
        return true
    }

    func removeSchedule(id: UUID) async {
        schedules.removeAll { $0.id == id }
        await saveAndApplySchedules()
    }

    func setScheduleEnabled(id: UUID, _ enabled: Bool) async {
        guard let i = schedules.firstIndex(where: { $0.id == id }) else { return }
        schedules[i].enabled = enabled
        await saveAndApplySchedules()
    }

    /// Asks for permission if needed (a schedule is pointless without it).
    func ensureAuthorization() async {
        await refreshAuthorization()
        if authorization == .notDetermined {
            _ = try? await center.requestAuthorization(options: [.alert, .sound, .badge])
            await refreshAuthorization()
        }
    }

    private func saveAndApplySchedules() async {
        if let data = try? JSONEncoder().encode(schedules) { defaults.set(data, forKey: Self.schedulesKey) }
        await applySchedules()
    }

    /// Runs of applySchedules() are queued, never interleaved: two concurrent runs
    /// (e.g. an `isPro` change racing a user edit) could otherwise remove each
    /// other's freshly added requests.
    private var applyChain: Task<Void, Never>?

    func applySchedules() async {
        let previous = applyChain
        let run = Task { @MainActor in
            await previous?.value
            await self.applyOnce()
        }
        applyChain = run
        await run.value
    }

    /// Replace exactly our own pending requests; the legacy weekly one is untouched.
    private func applyOnce() async {
        let ours = await center.pendingNotificationRequests()
            .map(\.identifier).filter { $0.hasPrefix(ReminderPlanner.identifierPrefix) }
        center.removePendingNotificationRequests(withIdentifiers: ours)
        guard isPro else { return }
        for p in ReminderPlanner.plan(schedules) {
            let content = UNMutableNotificationContent()
            content.title = p.title
            content.body = p.body
            content.sound = .default
            let trigger = UNCalendarNotificationTrigger(dateMatching: p.components, repeats: true)
            try? await center.add(UNNotificationRequest(identifier: p.identifier, content: content, trigger: trigger))
        }
    }

    func refreshAuthorization() async {
        authorization = await center.authorizationStatus()
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
