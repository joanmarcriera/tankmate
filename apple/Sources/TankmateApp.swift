//  TankmateApp.swift
//  Tankmate for iOS — a SwiftUI shell around the same web app that runs at
//  tankmate.joanmarcriera.es, plus the native reminders iOS Safari cannot do.
//
//  Deliberately thin: the verdict engine, the rules and the UI all live in the
//  web app at the repo root, so there is exactly one copy of the domain logic.

import SwiftUI

@main
struct TankmateApp: App {
    @UIApplicationDelegateAdaptor(AppDelegate.self) private var appDelegate
    @StateObject private var scheduler = ReminderScheduler()
    @State private var showingReminders = false

    var body: some Scene {
        WindowGroup {
            WebAppView { showingReminders = true }
                .ignoresSafeArea()
                .preferredColorScheme(.dark)
                .sheet(isPresented: $showingReminders) {
                    RemindersView(scheduler: scheduler)
                }
        }
    }
}
