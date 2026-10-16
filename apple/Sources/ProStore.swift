//  ProStore.swift
//  StoreKit 2 scaffolding for "Tankmate Pro" (auto-renewing yearly subscription).
//
//  STATUS: scaffolding only. Nothing in the UI reads `isPro` yet, and the product
//  below does NOT exist in App Store Connect (creating products/prices is a gate
//  that needs Marc). See apple/docs/TANKMATE-PRO.md for the design. Until the
//  product exists, `load()` simply finds no products and the app stays free tier.
//
//  Usage:
//      @StateObject var pro = ProStore()          // once, at the App root
//      pro.isPro                                  // gate Pro features on this
//      await pro.purchase()                       // from the paywall button
//      await pro.restore()                        // required "Restore Purchases" button
//
//  Local testing: select apple/Tankmate.storekit under Scheme > Run > Options.
//  Entitlement is derived from Transaction.currentEntitlements, never stored
//  locally, so it cannot be spoofed by editing UserDefaults.

import Foundation
import StoreKit

@MainActor
final class ProStore: ObservableObject {
    /// Must match the product id created in App Store Connect and Tankmate.storekit.
    static let yearlyProductID = "uk.co.riera.tankmate.pro.yearly"

    enum PurchaseResult { case success, pending, cancelled, unavailable, failed(String) }

    @Published private(set) var product: Product?
    @Published private(set) var isPro = false

    private var updatesTask: Task<Void, Never>?

    init() {
        // Renewals, refunds and family-sharing changes arrive out of band.
        updatesTask = Task { [weak self] in
            for await update in Transaction.updates {
                if case .verified(let t) = update { await t.finish() }
                await self?.refreshEntitlement()
            }
        }
        Task { await load() }
    }

    deinit { updatesTask?.cancel() }

    /// Fetch the product (localised price comes from StoreKit, never hard-coded) and entitlement.
    func load() async {
        product = try? await Product.products(for: [Self.yearlyProductID]).first
        await refreshEntitlement()
    }

    func purchase() async -> PurchaseResult {
        guard let product else { return .unavailable }
        do {
            switch try await product.purchase() {
            case .success(let verification):
                guard case .verified(let t) = verification else { return .failed("Unverified transaction") }
                await t.finish()
                await refreshEntitlement()
                return .success
            case .pending: return .pending
            case .userCancelled: return .cancelled
            @unknown default: return .failed("Unknown purchase result")
            }
        } catch {
            return .failed(error.localizedDescription)
        }
    }

    /// App Review requires a visible way to restore purchases.
    func restore() async {
        try? await AppStore.sync()
        await refreshEntitlement()
    }

    private func refreshEntitlement() async {
        var active = false
        for await result in Transaction.currentEntitlements {
            if case .verified(let t) = result,
               t.productID == Self.yearlyProductID,
               t.revocationDate == nil {
                active = true
            }
        }
        isPro = active
    }
}
