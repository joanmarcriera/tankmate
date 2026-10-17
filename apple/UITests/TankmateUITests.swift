//  TankmateUITests.swift
//  End-to-end checks for the two things the shell is responsible for: rendering
//  the bundled web app with no network, and carrying a tap from inside the web
//  content out to native SwiftUI.
//
//  Run:  xcodebuild test -project apple/Tankmate.xcodeproj -scheme Tankmate \
//          -destination 'platform=iOS Simulator,name=iPhone 17 Pro'

import XCTest

final class TankmateUITests: XCTestCase {

    override func setUp() {
        continueAfterFailure = false
    }

    /// The web app is served from the app bundle, so it must render with no
    /// network involvement at all.
    func testBundledWebAppRenders() {
        let app = XCUIApplication()
        app.launch()

        XCTAssertTrue(
            app.webViews.staticTexts["Log a water test"].waitForExistence(timeout: 20),
            "The bundled web app did not render — check the tankmate:// scheme handler."
        )
        // Rendering the HTML is not enough: switch to Trends, whose contents are
        // built entirely by app.js from the stored tests. If this appears, the
        // JavaScript ran and localStorage was readable.
        let trends = app.webViews.buttons
            .containing(NSPredicate(format: "label CONTAINS[c] 'Trends'")).firstMatch
        XCTAssertTrue(trends.waitForExistence(timeout: 10),
                      "The web app's tab bar is missing — app.js did not run.")
        trends.tap()

        let rate = app.webViews.staticTexts
            .containing(NSPredicate(format: "label CONTAINS[c] 'ppm/week'")).firstMatch
        XCTAssertTrue(rate.waitForExistence(timeout: 10),
                      "Trends rendered no nitrate rate — app.js did not run or the seed data is missing.")
    }

    /// A tap on the injected bell must cross from the web content into SwiftUI.
    func testBellOpensNativeRemindersSheet() {
        let app = XCUIApplication()
        app.launch()

        let bell = app.webViews.buttons["Reminders"]
        XCTAssertTrue(bell.waitForExistence(timeout: 20),
                      "The injected native control is not in the web header.")
        bell.tap()

        XCTAssertTrue(app.navigationBars["Reminders"].waitForExistence(timeout: 10),
                      "The native reminders sheet did not open — the WKScriptMessage bridge is broken.")
        XCTAssertTrue(app.switches["Weekly water-test reminder"].waitForExistence(timeout: 5),
                      "The reminders sheet opened without its toggle.")
    }

    // MARK: - Tankmate Pro

    private func attach(_ name: String) {
        let screenshot = XCUIScreen.main.screenshot()
        let shot = XCTAttachment(screenshot: screenshot)
        shot.name = name
        shot.lifetime = .keepAlways
        add(shot)
        // Optional: also write PNGs to a folder (pass TEST_RUNNER_TANKMATE_SHOT_DIR=<dir>
        // to xcodebuild) for people who do not open the .xcresult.
        if let dir = ProcessInfo.processInfo.environment["TANKMATE_SHOT_DIR"] {
            try? FileManager.default.createDirectory(atPath: dir, withIntermediateDirectories: true)
            try? screenshot.pngRepresentation.write(to: URL(fileURLWithPath: dir).appendingPathComponent("\(name).png"))
        }
    }

    /// Free tier: the Charts control exists but leads to the paywall, with the
    /// controls App Review requires (price/restore/links).
    func testFreeTierChartsOpensPaywall() {
        let app = XCUIApplication()
        app.launch()
        let charts = app.webViews.buttons["Charts"]
        XCTAssertTrue(charts.waitForExistence(timeout: 20))
        charts.tap()
        XCTAssertTrue(app.navigationBars["Pro"].waitForExistence(timeout: 10), "Paywall did not open")
        XCTAssertTrue(app.buttons["paywall.restore"].exists, "Restore Purchases is mandatory")
        XCTAssertTrue(app.links["Privacy"].exists || app.buttons["Privacy"].exists)
        attach("paywall-free")
    }

    /// Pro (forced by the DEBUG-only launch argument): charts and per-tank reminders open.
    func testProShowsChartsAndTankReminders() {
        let app = XCUIApplication()
        app.launchArguments = ["-uiTestForcePro"]
        app.launch()

        let charts = app.webViews.buttons["Charts"]
        XCTAssertTrue(charts.waitForExistence(timeout: 20))
        // Entitlement is pushed in after the page loads; give it a moment.
        sleep(2)
        charts.tap()
        sleep(2)
        // The sheet's parameter picker only exists on the Pro charts screen. (Whether a
        // line shows depends on how recent the seed data is, so don't assert on that.)
        XCTAssertTrue(app.buttons["charts.parameter"].waitForExistence(timeout: 10), "Charts did not open for Pro")
        attach("charts-pro")
        app.buttons["Done"].tap()

        let bell = app.webViews.buttons["Reminders"]
        XCTAssertTrue(bell.waitForExistence(timeout: 10))
        bell.tap()
        XCTAssertTrue(app.buttons["reminders.add"].waitForExistence(timeout: 10), "Per-tank reminder form missing for Pro")
        attach("reminders-pro")
    }
}
