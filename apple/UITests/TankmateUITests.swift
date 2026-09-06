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
}
