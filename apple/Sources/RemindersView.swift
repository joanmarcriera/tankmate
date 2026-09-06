//  RemindersView.swift
//  The native reminder sheet, reached from the bell in the web app's header.

import SwiftUI

struct RemindersView: View {
    @ObservedObject var scheduler: ReminderScheduler
    @Environment(\.dismiss) private var dismiss

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
}
