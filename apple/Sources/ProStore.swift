//  ProStore.swift
//  StoreKit 2 scaffolding for "Tankmate Pro" (auto-renewing yearly subscription).
//
//  STATUS: wired (paywall, tank limit, charts, extra reminders read `isPro`). The
//  product below does NOT exist in App Store Connect yet (creating products/prices
//  is a gate that needs Marc); tests and local runs use Tankmate.storekit. Until
//  the product exists, `load()` finds no products and the app stays free tier.
//  See apple/docs/TANKMATE-PRO.md for the design.
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

    #if DEBUG
    /// UI tests only: `-uiTestForcePro` shows the Pro screens without a purchase. Compiled
    /// out of Release builds, so it can never ship as a bypass.
    private let forcedPro = ProcessInfo.processInfo.arguments.contains("-uiTestForcePro")
    #endif

    /// - Parameter autoLoad: tests pass false to control when products load.
    init(autoLoad: Bool = true) {
        // Renewals, refunds and family-sharing changes arrive out of band.
        updatesTask = Task { [weak self] in
            for await update in Transaction.updates {
                if case .verified(let t) = update { await t.finish() }
                await self?.refreshEntitlement()
            }
        }
        if autoLoad { Task { await load() } }
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

    /// Pure entitlement rule (unit-tested): the right product, not refunded/revoked,
    /// and not past its expiry. StoreKit's currentEntitlements already omits expired
    /// transactions; checking `expirationDate` as well makes the rule explicit and
    /// independent of that behaviour.
    nonisolated static func isEntitling(productID: String, revocationDate: Date?, expirationDate: Date?, now: Date = Date()) -> Bool {
        guard productID == yearlyProductID, revocationDate == nil else { return false }
        if let expirationDate { return expirationDate > now }
        return true
    }

    func refreshEntitlement() async {
        var active = false
        for await result in Transaction.currentEntitlements {
            if case .verified(let t) = result,
               Self.isEntitling(productID: t.productID, revocationDate: t.revocationDate, expirationDate: t.expirationDate) {
                active = true
            }
        }
        #if DEBUG
        if forcedPro { active = true }
        #endif
        isPro = active
    }
}
