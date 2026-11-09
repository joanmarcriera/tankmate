//  TankmateApp.swift
//  Tankmate for iOS — a SwiftUI shell around the same web app that runs at
//  tankmate.joanmarcriera.es, plus the native features iOS Safari cannot do:
//  local reminders, and the Tankmate Pro tier (multi-tank, charts, per-tank reminders).
//
//  Deliberately thin: the verdict engine, the rules and the UI all live in the
//  web app at the repo root, so there is exactly one copy of the domain logic.

import SwiftUI

@main
struct TankmateApp: App {
    @UIApplicationDelegateAdaptor(AppDelegate.self) private var appDelegate
    @StateObject private var scheduler = ReminderScheduler()
    @StateObject private var pro = ProStore()
    @StateObject private var bridge = WebBridge()
    @State private var sheet: Sheet?
    @State private var addingTank = false
    @State private var newTankName = ""

    enum Sheet: Identifiable {
        case reminders([TankInfo]), charts(TankState), paywall
        var id: String {
            switch self {
            case .reminders: return "reminders"
            case .charts: return "charts"
            case .paywall: return "paywall"
            }
        }
    }

    var body: some Scene {
        WindowGroup {
            WebAppView(bridge: bridge, isPro: pro.isPro) { event in
                Task { await handle(event) }
            }
            .ignoresSafeArea()
            .preferredColorScheme(.dark)
            .sheet(item: $sheet) { sheet in
                switch sheet {
                case .reminders(let tanks):
                    RemindersView(scheduler: scheduler, tanks: tanks, isPro: pro.isPro) { self.sheet = .paywall }
                case .charts(let state):
                    ChartsView(state: state)
                case .paywall:
                    PaywallView(pro: pro)
                }
            }
            .alert("New tank", isPresented: $addingTank) {
                TextField("Name", text: $newTankName)
                Button("Add") {
                    let name = newTankName.trimmingCharacters(in: .whitespacesAndNewlines)
                    if !name.isEmpty { bridge.addTank(name: name) }
                }
                Button("Cancel", role: .cancel) {}
            }
            .onChange(of: pro.isPro, initial: true) { _, isPro in
                scheduler.isPro = isPro
                bridge.pushPro(isPro)
            }
        }
    }

    /// Entitlement is enforced here, in native code, not in the page.
    @MainActor
    private func handle(_ event: BridgeEvent) async {
        switch event {
        case .openReminders:
            let tanks = await bridge.fetchState()?.tanks ?? []
            sheet = .reminders(tanks)
        case .openCharts:
            guard ProGate.limits(isPro: pro.isPro).parameterCharts else { sheet = .paywall; return }
            if let state = await bridge.fetchState() { sheet = .charts(state) }
        case .addTank(let count):
            if ProGate.canAddTank(currentCount: count, isPro: pro.isPro) {
                newTankName = ""
                addingTank = true
            } else {
                sheet = .paywall
            }
        case .showPaywall:
            sheet = .paywall
        }
    }
}
