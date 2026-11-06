//  ChartData.swift
//  Pro: pure data shaping for the parameter charts (Swift Charts renders it in
//  ChartsView). Decoding, range filtering, target bands and CSV export live here
//  so they are unit-tested.

import Foundation

/// One water test as stored by the web app (all readings optional).
struct TestRecord: Codable, Equatable {
    var date: String            // yyyy-MM-dd
    var nh3: Double?
    var no2: Double?
    var no3: Double?
    var kh: Double?
    var ph: Double?
    var gh: Double?
    var temp: Double?
    var note: String?
}

struct TankInfo: Codable, Equatable, Identifiable { let id: String; let name: String }

/// What the web app reports through `window.tankmateState()`.
struct TankState: Codable, Equatable {
    var active: TankInfo
    var tanks: [TankInfo]
    var tests: [TestRecord]
}

enum Parameter: String, CaseIterable, Identifiable {
    case nh3, no2, no3, kh, ph, gh, temp
    var id: String { rawValue }

    var label: String {
        switch self {
        case .nh3: return "NH₃ ammonia"
        case .no2: return "NO₂ nitrite"
        case .no3: return "NO₃ nitrate"
        case .kh: return "KH buffer"
        case .ph: return "pH"
        case .gh: return "GH"
        case .temp: return "Temperature"
        }
    }

    var unit: String {
        switch self {
        case .nh3, .no2, .no3: return "ppm"
        case .kh, .gh: return "dKH/dGH"
        case .ph: return ""
        case .temp: return "°C"
        }
    }

    /// The "healthy" band, mirroring the verdict rules in app.js (RULES). nil = no
    /// single target (pH and GH are informational: stability beats a number).
    var target: ClosedRange<Double>? {
        switch self {
        case .nh3, .no2: return 0...0.0001   // zero is the only acceptable number
        case .no3: return 0...20
        case .kh: return 7...20
        case .temp: return 23...27
        case .ph, .gh: return nil
        }
    }

    func value(in t: TestRecord) -> Double? {
        switch self {
        case .nh3: return t.nh3
        case .no2: return t.no2
        case .no3: return t.no3
        case .kh: return t.kh
        case .ph: return t.ph
        case .gh: return t.gh
        case .temp: return t.temp
        }
    }
}

enum ChartRange: Int, CaseIterable, Identifiable {
    case d30 = 30, d90 = 90, d365 = 365
    var id: Int { rawValue }
    var label: String { "\(rawValue) d" }
}

struct ChartPoint: Equatable, Identifiable {
    let date: Date
    let value: Double
    var id: Date { date }
}

enum ChartData {
    private static func parse(_ s: String) -> Date? {
        let f = DateFormatter()
        f.calendar = Calendar(identifier: .gregorian)
        f.locale = Locale(identifier: "en_US_POSIX")
        f.timeZone = TimeZone(identifier: "UTC")
        f.dateFormat = "yyyy-MM-dd"
        return f.date(from: s)
    }

    /// Points for one parameter within the last `range` days of `now`, oldest first.
    /// Tests without that reading, or with an unparsable date, are skipped.
    static func points(_ tests: [TestRecord], parameter: Parameter, range: ChartRange, now: Date = Date()) -> [ChartPoint] {
        let cutoff = now.addingTimeInterval(-Double(range.rawValue) * 86_400)
        return tests.compactMap { t -> ChartPoint? in
            guard let v = parameter.value(in: t), v.isFinite, let d = parse(t.date), d >= cutoff, d <= now.addingTimeInterval(86_400) else { return nil }
            return ChartPoint(date: d, value: v)
        }.sorted { $0.date < $1.date }
    }

    /// Narrowest range that shows at least two points (a line needs two); the widest
    /// if none does. Keeps the first view useful for a tank logged monthly.
    static func defaultRange(_ tests: [TestRecord], parameter: Parameter, now: Date = Date()) -> ChartRange {
        ChartRange.allCases.first { points(tests, parameter: parameter, range: $0, now: now).count >= 2 } ?? .d365
    }

    /// Parameters that have at least one reading, in display order.
    static func availableParameters(_ tests: [TestRecord]) -> [Parameter] {
        Parameter.allCases.filter { p in tests.contains { p.value(in: $0) != nil } }
    }

    /// CSV with a header row; empty cells for missing readings; notes quoted per RFC 4180.
    static func csv(_ tests: [TestRecord]) -> String {
        func cell(_ v: Double?) -> String { v.map { String($0) } ?? "" }
        // Spreadsheet formula injection: a cell starting with = + - @ tab or CR is prefixed with ' so it stays text.
        func quote(_ s: String) -> String {
            let risky = s.first.map { "=+-@\t\r".contains($0) } ?? false
            let safe = risky ? "'" + s : s
            return "\"" + safe.replacingOccurrences(of: "\"", with: "\"\"") + "\""
        }
        var lines = ["date,nh3,no2,no3,kh,ph,gh,temp,note"]
        for t in tests.sorted(by: { $0.date < $1.date }) {
            lines.append([t.date, cell(t.nh3), cell(t.no2), cell(t.no3), cell(t.kh), cell(t.ph), cell(t.gh), cell(t.temp), quote(t.note ?? "")].joined(separator: ","))
        }
        return lines.joined(separator: "\n") + "\n"
    }
}
