//  LogicTests.swift
//  Unit tests for the pure Pro logic: gate rules, reminder planner, chart data,
//  bridge parsing and the reminder scheduler (against a fake notification centre).
//
//  Run:  xcodebuild test -project apple/Tankmate.xcodeproj -scheme Tankmate \
//          -destination 'platform=iOS Simulator,name=iPhone 17 Pro' -only-testing:TankmateTests

import XCTest
import UserNotifications
@testable import Tankmate

final class ProGateTests: XCTestCase {
    func testFreeTierKeepsOneTankAndNoExtras() {
        XCTAssertTrue(ProGate.canAddTank(currentCount: 0, isPro: false))
        XCTAssertFalse(ProGate.canAddTank(currentCount: 1, isPro: false))
        XCTAssertFalse(ProGate.canAddReminder(currentCount: 0, isPro: false))
        XCTAssertFalse(ProGate.limits(isPro: false).parameterCharts)
        XCTAssertFalse(ProGate.limits(isPro: false).dataExport)
    }

    func testProTierUnlocksEverythingWithinSaneBounds() {
        XCTAssertTrue(ProGate.canAddTank(currentCount: 50, isPro: true))
        XCTAssertTrue(ProGate.canAddReminder(currentCount: 23, isPro: true))
        XCTAssertFalse(ProGate.canAddReminder(currentCount: 24, isPro: true))
        XCTAssertTrue(ProGate.limits(isPro: true).parameterCharts)
    }

    func testEntitlementRule() {
        let id = ProStore.yearlyProductID
        let now = Date()
        XCTAssertTrue(ProStore.isEntitling(productID: id, revocationDate: nil, expirationDate: now.addingTimeInterval(60), now: now))
        XCTAssertFalse(ProStore.isEntitling(productID: id, revocationDate: nil, expirationDate: now.addingTimeInterval(-60), now: now), "expired")
        XCTAssertFalse(ProStore.isEntitling(productID: id, revocationDate: now, expirationDate: now.addingTimeInterval(60), now: now), "refunded")
        XCTAssertFalse(ProStore.isEntitling(productID: "other", revocationDate: nil, expirationDate: nil, now: now), "wrong product")
    }
}

final class ReminderPlannerTests: XCTestCase {
    func testWeeklyAndDailyComponentsAndDisabledAreDropped() {
        let weekly = ReminderSchedule(tankID: "a", tankName: "Main", kind: .waterChange, cadence: .weekly, weekday: 7, hour: 9)
        let daily = ReminderSchedule(tankID: "b", tankName: "Shrimp", kind: .feeding, cadence: .daily, weekday: 3, hour: 18)
        var off = ReminderSchedule(tankID: "a", tankName: "Main", kind: .waterTest, cadence: .daily)
        off.enabled = false
        let plan = ReminderPlanner.plan([weekly, daily, off])
        XCTAssertEqual(plan.count, 2)
        XCTAssertEqual(plan[0].components.weekday, 7)
        XCTAssertEqual(plan[0].components.hour, 9)
        XCTAssertNil(plan[1].components.weekday, "daily has no weekday")
        XCTAssertEqual(plan[1].components.hour, 18)
        XCTAssertTrue(plan[1].title.contains("Shrimp"))
        XCTAssertTrue(plan.allSatisfy { $0.identifier.hasPrefix(ReminderPlanner.identifierPrefix) })
    }

    func testCorruptValuesAreClamped() {
        let bad = ReminderSchedule(tankID: "a", tankName: "T", kind: .filterClean, cadence: .weekly, weekday: 99, hour: -4)
        let c = ReminderPlanner.plan([bad])[0].components
        XCTAssertEqual(c.weekday, 7)
        XCTAssertEqual(c.hour, 0)
    }
}

final class ChartDataTests: XCTestCase {
    private let now = ISO8601DateFormatter().date(from: "2026-06-30T12:00:00Z")!
    private let tests = [
        TestRecord(date: "2025-12-20", nh3: 0, no2: 0.5, no3: 15, kh: 4, ph: 7.2, gh: nil, temp: 25, note: "old"),
        TestRecord(date: "2026-06-01", nh3: 0, no2: 0, no3: 20, kh: 3, ph: nil, gh: nil, temp: nil, note: nil),
        TestRecord(date: "2026-06-11", nh3: 0, no2: 0, no3: 10, kh: 7, ph: 7.4, gh: nil, temp: 25, note: "say \"hi\", ok"),
        TestRecord(date: "not-a-date", nh3: nil, no2: nil, no3: 99, kh: nil, ph: nil, gh: nil, temp: nil, note: nil),
    ]

    func testRangeFilteringSortingAndBadDates() {
        let p30 = ChartData.points(tests, parameter: .no3, range: .d30, now: now)
        XCTAssertEqual(p30.map(\.value), [20, 10])
        let p365 = ChartData.points(tests, parameter: .no3, range: .d365, now: now)
        XCTAssertEqual(p365.map(\.value), [15, 20, 10], "oldest first; unparsable date skipped")
    }

    func testMissingReadingsSkippedAndAvailableParameters() {
        XCTAssertEqual(ChartData.points(tests, parameter: .ph, range: .d365, now: now).count, 2)
        XCTAssertEqual(ChartData.availableParameters(tests), [.nh3, .no2, .no3, .kh, .ph, .temp])
        XCTAssertTrue(ChartData.availableParameters([]).isEmpty)
    }

    func testDefaultRangeIsNarrowestWithTwoPoints() {
        XCTAssertEqual(ChartData.defaultRange(tests, parameter: .no3, now: now), .d30, "two points in the last 30 days")
        let sparse = [tests[0], tests[2]]
        XCTAssertEqual(ChartData.defaultRange(sparse, parameter: .no3, now: now), .d365)
        XCTAssertEqual(ChartData.defaultRange([], parameter: .no3, now: now), .d365)
    }

    func testCSVIsQuotedAndSorted() {
        let csv = ChartData.csv(tests)
        let lines = csv.split(separator: "\n").map(String.init)
        XCTAssertEqual(lines[0], "date,nh3,no2,no3,kh,ph,gh,temp,note")
        XCTAssertEqual(lines.count, 5)
        XCTAssertTrue(lines.contains("2026-06-11,0.0,0.0,10.0,7.0,7.4,,25.0,\"say \"\"hi\"\", ok\""), csv)
    }

    func testCSVNeutralisesFormulaLeadingNotes() {
        let t = [TestRecord(date: "2026-06-11", nh3: 0, no2: nil, no3: nil, kh: nil, ph: nil, gh: nil, temp: nil, note: "=HYPERLINK(1)")]
        XCTAssertTrue(ChartData.csv(t).contains(",\"'=HYPERLINK(1)\""))
    }

    func testTankStateDecodesWhatTheWebAppSends() throws {
        let json = #"{"active":{"id":"default","name":"Flex"},"tanks":[{"id":"default","name":"Flex"}],"tests":[{"date":"2026-06-11","nh3":0,"no2":null,"no3":10,"kh":7,"ph":7.4,"gh":null,"temp":25,"note":"x"}]}"#
        let s = try JSONDecoder().decode(TankState.self, from: Data(json.utf8))
        XCTAssertEqual(s.tests.first?.no3, 10)
        XCTAssertNil(s.tests.first?.no2)
    }
}

final class BridgeEventTests: XCTestCase {
    func testParse() {
        XCTAssertEqual(BridgeEvent.parse(["action": "openReminders"]), .openReminders)
        XCTAssertEqual(BridgeEvent.parse(["action": "openCharts"]), .openCharts)
        XCTAssertEqual(BridgeEvent.parse(["action": "addTank", "tankCount": 2]), .addTank(count: 2))
        XCTAssertNil(BridgeEvent.parse(["action": "format-disk"]))
        XCTAssertNil(BridgeEvent.parse("nonsense"))
    }
}

/// In-memory stand-in for UNUserNotificationCenter.
final class FakeCenter: NotificationCentering {
    var pending: [UNNotificationRequest] = []
    var status: UNAuthorizationStatus = .authorized
    func authorizationStatus() async -> UNAuthorizationStatus { status }
    func requestAuthorization(options: UNAuthorizationOptions) async throws -> Bool { status = .authorized; return true }
    func add(_ request: UNNotificationRequest) async throws {
        pending.removeAll { $0.identifier == request.identifier }
        pending.append(request)
    }
    func removePendingNotificationRequests(withIdentifiers ids: [String]) { pending.removeAll { ids.contains($0.identifier) } }
    func pendingNotificationRequests() async -> [UNNotificationRequest] { pending }
}

@MainActor
final class ReminderSchedulerProTests: XCTestCase {
    private func makeDefaults() -> UserDefaults {
        let name = "tankmate.tests.\(UUID().uuidString)"
        let d = UserDefaults(suiteName: name)!
        d.removePersistentDomain(forName: name)
        return d
    }
    private func sched(_ tank: String, _ kind: ReminderSchedule.Kind = .waterChange) -> ReminderSchedule {
        ReminderSchedule(tankID: tank, tankName: tank, kind: kind, cadence: .weekly, weekday: 1, hour: 10)
    }

    func testFreeTierCannotAddSchedules() async {
        let c = FakeCenter()
        let s = ReminderScheduler(defaults: makeDefaults(), center: c)
        let ok = await s.addSchedule(sched("a"))
        XCTAssertFalse(ok)
        XCTAssertTrue(c.pending.isEmpty)
    }

    func testProSchedulesPerTankAndLegacyWeeklyIsUntouched() async {
        let c = FakeCenter()
        let legacy = UNNotificationRequest(identifier: "tankmate.weekly-water-test", content: UNMutableNotificationContent(), trigger: nil)
        c.pending = [legacy]
        let s = ReminderScheduler(defaults: makeDefaults(), center: c)
        s.isPro = true
        let a = await s.addSchedule(sched("a"))
        let b = await s.addSchedule(sched("b", .feeding))
        XCTAssertTrue(a && b)
        XCTAssertEqual(c.pending.count, 3)
        XCTAssertTrue(c.pending.contains { $0.identifier == "tankmate.weekly-water-test" })
        let trig = c.pending.first { $0.content.title.contains("Feeding") }?.trigger as? UNCalendarNotificationTrigger
        XCTAssertEqual(trig?.repeats, true)
        XCTAssertEqual(trig?.dateComponents.weekday, 1)
    }

    func testLosingProCancelsSchedulesButKeepsThem() async {
        let c = FakeCenter()
        let defaults = makeDefaults()
        let s = ReminderScheduler(defaults: defaults, center: c)
        s.isPro = true
        await s.addSchedule(sched("a"))
        XCTAssertEqual(c.pending.count, 1)
        s.isPro = false
        await s.applySchedules()
        XCTAssertTrue(c.pending.isEmpty, "expired subscription must stop the Pro reminders")
        XCTAssertEqual(s.schedules.count, 1, "but the user's setup is kept")
        // Persistence round-trip + renewal brings them back.
        let s2 = ReminderScheduler(defaults: defaults, center: c)
        XCTAssertEqual(s2.schedules.count, 1)
        s2.isPro = true
        await s2.applySchedules()
        XCTAssertEqual(c.pending.count, 1)
    }

    func testRemoveAndDisable() async {
        let c = FakeCenter()
        let s = ReminderScheduler(defaults: makeDefaults(), center: c)
        s.isPro = true
        let one = sched("a"); let two = sched("b")
        await s.addSchedule(one); await s.addSchedule(two)
        await s.setScheduleEnabled(id: one.id, false)
        XCTAssertEqual(c.pending.count, 1)
        await s.removeSchedule(id: two.id)
        XCTAssertTrue(c.pending.isEmpty)
        XCTAssertEqual(s.schedules.count, 1)
    }
}
