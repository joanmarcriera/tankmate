//  ProGate.swift
//  The single place that says what Free and Pro get. Pure functions of `isPro`, so
//  the rules are unit-tested without StoreKit or UI (see ProGateTests).
//
//  Principle (docs/TANKMATE-PRO.md): nothing that existed before Pro is taken away.

import Foundation

struct ProLimits: Equatable {
    /// nil = unlimited.
    let maxTanks: Int?
    /// Extra per-tank reminder schedules; the original single weekly reminder is always free.
    let maxReminderSchedules: Int
    let parameterCharts: Bool
    let dataExport: Bool
}

enum ProGate {
    static let free = ProLimits(maxTanks: 1, maxReminderSchedules: 0, parameterCharts: false, dataExport: false)
    static let pro  = ProLimits(maxTanks: nil, maxReminderSchedules: 24, parameterCharts: true, dataExport: true)

    static func limits(isPro: Bool) -> ProLimits { isPro ? pro : free }

    static func canAddTank(currentCount: Int, isPro: Bool) -> Bool {
        guard let max = limits(isPro: isPro).maxTanks else { return true }
        return currentCount < max
    }

    static func canAddReminder(currentCount: Int, isPro: Bool) -> Bool {
        currentCount < limits(isPro: isPro).maxReminderSchedules
    }
}
