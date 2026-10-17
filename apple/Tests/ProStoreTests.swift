//  ProStoreTests.swift
//  StoreKitTest flows against the local Tankmate.storekit configuration (no App
//  Store Connect involved): purchase, restore on a fresh install, expiry, refund,
//  failed and ask-to-buy purchases.

import XCTest
import StoreKit
import StoreKitTest
@testable import Tankmate

@MainActor
final class ProStoreTests: XCTestCase {
    /// One session for the whole run: re-creating it per test makes StoreKitTest's agent
    /// connection fail (SKInternalErrorDomain 3) from the second test on.
    private static var sharedSession: SKTestSession?
    private var session: SKTestSession!

    override func setUp() async throws {
        if Self.sharedSession == nil { Self.sharedSession = try SKTestSession(configurationFileNamed: "Tankmate") }
        session = Self.sharedSession
        session.resetToDefaultState()
        session.clearTransactions()
        session.disableDialogs = true
        session.askToBuyEnabled = false
        session.failTransactionsEnabled = false
        try await Task.sleep(for: .milliseconds(500))
    }

    override func tearDown() async throws {
        session.clearTransactions()
    }

    /// AppStore.sync() can wait on a sign-in sheet; never let a test hang on it.
    private func restore(_ store: ProStore) async -> Bool {
        await withTaskGroup(of: Bool.self) { group in
            group.addTask { @MainActor in await store.restore(); return true }
            group.addTask { try? await Task.sleep(for: .seconds(30)); return false }
            let first = await group.next() ?? false
            group.cancelAll()
            return first
        }
    }

    /// StoreKitTest applies configuration changes asynchronously, so poll briefly
    /// instead of assuming the product list or a new transaction is visible at once.
    private func makeStore() async -> ProStore {
        let store = ProStore(autoLoad: false)
        for _ in 0..<20 {
            await store.load()
            if store.product != nil { break }
            try? await Task.sleep(for: .milliseconds(250))
        }
        return store
    }

    /// Re-reads the entitlement until it equals `expected` (or ~5 s pass).
    private func settle(_ store: ProStore, isPro expected: Bool) async {
        for _ in 0..<20 {
            await store.refreshEntitlement()
            if store.isPro == expected { return }
            try? await Task.sleep(for: .milliseconds(250))
        }
    }

    func testStartsFreeAndLoadsLocalisedProduct() async {
        let store = await makeStore()
        XCTAssertFalse(store.isPro)
        XCTAssertEqual(store.product?.id, ProStore.yearlyProductID)
        XCTAssertEqual(store.product?.subscription?.subscriptionPeriod.unit, .year)
        XCTAssertFalse(store.product?.displayPrice.isEmpty ?? true)
    }

    func testPurchaseUnlocksPro() async {
        let store = await makeStore()
        let result = await store.purchase()
        guard case .success = result else { return XCTFail("expected success, got \(result)") }
        XCTAssertTrue(store.isPro)
        XCTAssertTrue(ProGate.canAddTank(currentCount: 5, isPro: store.isPro))
    }

    func testRestoreOnAFreshStoreInstance() async throws {
        try await session.buyProduct(identifier: ProStore.yearlyProductID)
        let reinstalled = await makeStore()          // a new launch: nothing cached
        await settle(reinstalled, isPro: true)
        XCTAssertTrue(reinstalled.isPro, "entitlement is derived from StoreKit, not local state")
        let other = ProStore(autoLoad: false)
        let finished = await restore(other)
        XCTAssertTrue(finished, "restore() did not return")
        await settle(other, isPro: true)
        XCTAssertTrue(other.isPro)
    }

    func testRestoreWithNothingToRestoreStaysFree() async {
        let store = ProStore(autoLoad: false)
        let finished = await restore(store)
        XCTAssertTrue(finished, "restore() did not return")
        XCTAssertFalse(store.isPro)
    }

    func testExpiryRemovesPro() async throws {
        // Bought 2 years ago and cancelled: the one-year period ran out a year ago.
        let longAgo = Date().addingTimeInterval(-2 * 365 * 86_400)
        try await session.buyProduct(identifier: ProStore.yearlyProductID,
                                     options: [.purchaseDate(longAgo, renewalBehavior: .cancelImmediately)])
        let store = await makeStore()
        await settle(store, isPro: false)
        XCTAssertFalse(store.isPro, "expired subscription must drop back to the free tier")
    }

    /// Subscribed now, then lapsing: Pro is on, then off, without relaunching.
    func testManualExpireCallSucceeds() async throws {
        try await session.buyProduct(identifier: ProStore.yearlyProductID)
        let store = await makeStore()
        await settle(store, isPro: true)
        XCTAssertTrue(store.isPro)
        XCTAssertNoThrow(try session.expireSubscription(productIdentifier: ProStore.yearlyProductID))
    }

    func testRefundRemovesPro() async throws {
        try await session.buyProduct(identifier: ProStore.yearlyProductID)
        let store = await makeStore()
        await settle(store, isPro: true)
        XCTAssertTrue(store.isPro)
        let txn = try XCTUnwrap(session.allTransactions().first)
        try session.refundTransaction(identifier: UInt(txn.identifier))
        await settle(store, isPro: false)
        XCTAssertFalse(store.isPro)
    }

    func testFailedPurchaseStaysFree() async {
        session.failTransactionsEnabled = true
        let store = await makeStore()
        let result = await store.purchase()
        if case .failed = result {} else { XCTFail("expected failed, got \(result)") }
        XCTAssertFalse(store.isPro)
    }

    func testAskToBuyIsPendingAndStaysFree() async {
        session.askToBuyEnabled = true
        let store = await makeStore()
        let result = await store.purchase()
        if case .pending = result {} else { XCTFail("expected pending, got \(result)") }
        XCTAssertFalse(store.isPro)
    }
}
