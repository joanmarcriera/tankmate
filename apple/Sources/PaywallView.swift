//  PaywallView.swift
//  The Tankmate Pro sheet. App Review (3.1.2) needs: price, period, auto-renew
//  wording, Restore Purchases, and Privacy + Terms links. The price string comes
//  from StoreKit (localised), never hard-coded.

import SwiftUI
import StoreKit

struct PaywallView: View {
    @ObservedObject var pro: ProStore
    @Environment(\.dismiss) private var dismiss
    @State private var busy = false
    @State private var message: String?

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    Text("Tankmate Pro").font(.largeTitle.bold())
                    Text("For people with more than one tank.").foregroundStyle(.secondary)

                    feature("square.stack.3d.up", "Multiple tanks", "A separate log and verdicts per tank, with a switcher.")
                    feature("bell.badge", "Reminders per tank", "Water test, water change, feeding and filter clean, on your schedule.")
                    feature("chart.xyaxis.line", "Parameter charts", "Every parameter over 30, 90 or 365 days with target bands, plus CSV export.")
                    Text("Everything you have today stays free: logging, verdicts, feeding, playbook, holiday sheet.")
                        .font(.footnote).foregroundStyle(.secondary)

                    if pro.isPro {
                        Label("You have Tankmate Pro. Thank you!", systemImage: "checkmark.seal.fill")
                            .foregroundStyle(.green)
                    } else {
                        Button {
                            Task { await buy() }
                        } label: {
                            Text(buttonTitle).frame(maxWidth: .infinity)
                        }
                        .buttonStyle(.borderedProminent).controlSize(.large)
                        .disabled(busy || pro.product == nil)
                        .accessibilityIdentifier("paywall.subscribe")

                        if let product = pro.product {
                            Text("\(product.displayPrice) per year. Payment is charged to your Apple ID. The subscription renews automatically each year unless cancelled at least 24 hours before the period ends. Manage or cancel in Settings > Apple ID > Subscriptions.")
                                .font(.footnote).foregroundStyle(.secondary)
                        } else {
                            Text("The subscription is not available right now. Please try again later.")
                                .font(.footnote).foregroundStyle(.secondary)
                        }
                    }

                    Button("Restore Purchases") { Task { busy = true; await pro.restore(); busy = false } }
                        .accessibilityIdentifier("paywall.restore")
                        .disabled(busy)

                    if let message { Text(message).font(.footnote).foregroundStyle(.orange) }

                    HStack(spacing: 16) {
                        Link("Privacy", destination: URL(string: "https://tankmate.joanmarcriera.es/privacy/")!)
                        Link("Terms of Use", destination: URL(string: "https://www.apple.com/legal/internet-services/itunes/dev/stdeula/")!)
                    }.font(.footnote)
                }
                .padding()
            }
            .navigationTitle("Pro")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar { ToolbarItem(placement: .confirmationAction) { Button("Done") { dismiss() } } }
        }
        .task { if pro.product == nil { await pro.load() } }
    }

    private var buttonTitle: String {
        pro.product.map { "Subscribe · \($0.displayPrice) / year" } ?? "Subscribe"
    }

    private func feature(_ icon: String, _ title: String, _ detail: String) -> some View {
        HStack(alignment: .top, spacing: 12) {
            Image(systemName: icon).font(.title2).frame(width: 32).foregroundStyle(.tint)
            VStack(alignment: .leading) {
                Text(title).font(.headline)
                Text(detail).font(.subheadline).foregroundStyle(.secondary)
            }
        }
    }

    private func buy() async {
        busy = true
        defer { busy = false }
        switch await pro.purchase() {
        case .success: message = nil; dismiss()
        case .pending: message = "Your purchase is waiting for approval."
        case .cancelled: message = nil
        case .unavailable: message = "The subscription is not available right now."
        case .failed(let why): message = "Purchase failed: \(why)"
        }
    }
}
