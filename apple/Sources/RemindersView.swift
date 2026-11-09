//  RemindersView.swift
//  The native reminder sheet, reached from the bell in the web app's header.

import SwiftUI

struct RemindersView: View {
    @ObservedObject var scheduler: ReminderScheduler
    var tanks: [TankInfo] = []
    var isPro = false
    /// Asks the host to show the paywall (Pro section is locked on the free tier).
    var onUpgrade: () -> Void = {}
    @Environment(\.dismiss) private var dismiss
    @State private var draft = Draft()

    struct Draft {
        var tankID = ""
        var kind: ReminderSchedule.Kind = .waterChange
        var cadence: ReminderSchedule.Cadence = .weekly
        var weekday = 1
        var hour = 10
    }

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    Toggle("Weekly water-test reminder", isOn: Binding(
                        get: { scheduler.isEnabled },
                        set: { wanted in
                            if wanted {
                                Task { await scheduler.enable() }
                            } else {
                                scheduler.disable()
                            }
                        }
                    ))
                    if scheduler.isEnabled {
                        Picker("Day", selection: $scheduler.weekday) {
                            ForEach(1...7, id: \.self) { day in
                                Text(ReminderScheduler.weekdayName(day)).tag(day)
                            }
                        }
                        Picker("Time", selection: $scheduler.hour) {
                            ForEach(6...22, id: \.self) { hour in
                                Text(String(format: "%02d:00", hour)).tag(hour)
                            }
                        }
                    }
                } footer: {
                    Text("A test before a water change tells you how big the change needs to be. Reminders are scheduled on this device — nothing is sent anywhere.")
                }

                proSection

                if scheduler.authorization == .denied {
                    Section {
                        Text("Notifications are turned off for Tankmate in iOS Settings.")
                            .foregroundStyle(.secondary)
                    }
                }
            }
            .navigationTitle("Reminders")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Done") { dismiss() }
                }
            }
        }
        .task { await scheduler.refreshAuthorization() }
    }

    // MARK: - Pro: per-tank reminders

    @ViewBuilder private var proSection: some View {
        Section {
            if !isPro {
                Button("Unlock reminders for every tank with Pro", action: onUpgrade)
                    .accessibilityIdentifier("reminders.upgrade")
            } else {
                ForEach(scheduler.schedules) { s in
                    Toggle(isOn: Binding(
                        get: { s.enabled },
                        set: { on in Task { await scheduler.setScheduleEnabled(id: s.id, on) } }
                    )) {
                        VStack(alignment: .leading) {
                            Text("\(s.kind.label) · \(s.tankName)")
                            Text(s.cadence == .daily ? "Daily \(String(format: "%02d:00", s.hour))"
                                 : "\(ReminderScheduler.weekdayName(s.weekday)) \(String(format: "%02d:00", s.hour))")
                                .font(.footnote).foregroundStyle(.secondary)
                        }
                    }
                }
                .onDelete { offsets in
                    let ids = offsets.map { scheduler.schedules[$0].id }
                    Task { for id in ids { await scheduler.removeSchedule(id: id) } }
                }

                Picker("Tank", selection: $draft.tankID) {
                    ForEach(tanks) { Text($0.name).tag($0.id) }
                }
                Picker("Reminder", selection: $draft.kind) {
                    ForEach(ReminderSchedule.Kind.allCases) { Text($0.label).tag($0) }
                }
                Picker("Repeats", selection: $draft.cadence) {
                    Text("Weekly").tag(ReminderSchedule.Cadence.weekly)
                    Text("Daily").tag(ReminderSchedule.Cadence.daily)
                }
                if draft.cadence == .weekly {
                    Picker("Day", selection: $draft.weekday) {
                        ForEach(1...7, id: \.self) { Text(ReminderScheduler.weekdayName($0)).tag($0) }
                    }
                }
                Picker("Time", selection: $draft.hour) {
                    ForEach(6...22, id: \.self) { Text(String(format: "%02d:00", $0)).tag($0) }
                }
                Button("Add reminder") {
                    guard let tank = tanks.first(where: { $0.id == draft.tankID }) ?? tanks.first else { return }
                    let schedule = ReminderSchedule(tankID: tank.id, tankName: tank.name, kind: draft.kind,
                                                    cadence: draft.cadence, weekday: draft.weekday, hour: draft.hour)
                    Task {
                        await scheduler.ensureAuthorization()
                        await scheduler.addSchedule(schedule)
                    }
                }
                .disabled(tanks.isEmpty)
                .accessibilityIdentifier("reminders.add")
            }
        } header: {
            Text("Tankmate Pro")
        } footer: {
            Text("Per-tank reminders for water tests, water changes, feeding and filter cleans.")
        }
        .onAppear { if draft.tankID.isEmpty { draft.tankID = tanks.first?.id ?? "" } }
    }
}
