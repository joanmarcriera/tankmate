//  ReminderPlan.swift
//  Pro: per-tank reminder schedules, and the pure planner that turns them into
//  notification requests. Kept free of UserNotifications types so it is unit-tested
//  directly; ReminderScheduler does the actual scheduling.
//
//  Cadence is "daily" or "weekly on a weekday" because UNCalendarNotificationTrigger
//  repeats on calendar components; an "every N days" cadence cannot be expressed
//  without re-scheduling on every launch, which we deliberately avoid.

import Foundation

struct ReminderSchedule: Codable, Identifiable, Equatable {
    enum Kind: String, Codable, CaseIterable, Identifiable {
        case waterTest, waterChange, feeding, filterClean
        var id: String { rawValue }
        var label: String {
            switch self {
            case .waterTest: return "Water test"
            case .waterChange: return "Water change"
            case .feeding: return "Feeding"
            case .filterClean: return "Filter clean"
            }
        }
        func body(tank: String) -> String {
            switch self {
            case .waterTest: return "\(tank): test NH₃, NO₂, NO₃ and KH, then log the readings."
            case .waterChange: return "\(tank): time for the scheduled water change."
            case .feeding: return "\(tank): feeding time."
            case .filterClean: return "\(tank): rinse the filter media in tank water, never tap water."
            }
        }
    }

    enum Cadence: String, Codable, CaseIterable, Identifiable {
        case daily, weekly
        var id: String { rawValue }
    }

    var id: UUID = UUID()
    var tankID: String
    var tankName: String
    var kind: Kind
    var cadence: Cadence
    /// 1 = Sunday … 7 = Saturday (DateComponents.weekday). Ignored when daily.
    var weekday: Int = 1
    var hour: Int = 10
    var enabled: Bool = true
}

struct PlannedNotification: Equatable {
    let identifier: String
    let title: String
    let body: String
    let components: DateComponents
}

enum ReminderPlanner {
    /// Prefix of every identifier this planner creates, so a reschedule can remove
    /// exactly its own requests and never the legacy weekly one.
    static let identifierPrefix = "tankmate.sched."

    /// Disabled schedules are dropped; hours/weekdays are clamped to valid values so
    /// a corrupt stored value can never produce an invalid trigger.
    static func plan(_ schedules: [ReminderSchedule]) -> [PlannedNotification] {
        schedules.filter(\.enabled).map { s in
            var c = DateComponents()
            c.hour = min(23, max(0, s.hour))
            c.minute = 0
            if s.cadence == .weekly { c.weekday = min(7, max(1, s.weekday)) }
            return PlannedNotification(
                identifier: identifierPrefix + s.id.uuidString,
                title: "\(s.kind.label) · \(s.tankName)",
                body: s.kind.body(tank: s.tankName),
                components: c)
        }
    }
}
