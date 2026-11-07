//  WebAppView.swift
//  Hosts the bundled Tankmate web app in a WKWebView.
//
//  The web app is served from the app bundle over tankmate://app/ (see
//  BundledWebSchemeHandler), so it runs with no network connection at all — the
//  offline story is structural, not a cache that can be evicted.

import SwiftUI
import WebKit

/// What the web content can ask the native shell to do.
enum BridgeEvent: Equatable {
    case openReminders, openCharts, showPaywall
    case addTank(count: Int)

    /// Parses a WKScriptMessage body; unknown/malformed messages are ignored.
    static func parse(_ body: Any) -> BridgeEvent? {
        guard let dict = body as? [String: Any], let action = dict["action"] as? String else { return nil }
        switch action {
        case "openReminders": return .openReminders
        case "openCharts": return .openCharts
        case "showPaywall": return .showPaywall
        case "addTank": return .addTank(count: dict["tankCount"] as? Int ?? 1)
        default: return nil
        }
    }
}

/// Native -> web calls. Holds the web view weakly; the SwiftUI view owns it.
@MainActor
final class WebBridge: ObservableObject {
    fileprivate weak var webView: WKWebView?

    /// Push the entitlement into the page (the page never stores it).
    func pushPro(_ isPro: Bool) {
        webView?.evaluateJavaScript("window.tankmateApplyNative && window.tankmateApplyNative({isPro:\(isPro)})")
    }

    /// Snapshot of the active tank and its tests, from the page's own storage.
    func fetchState() async -> TankState? {
        guard let webView else { return nil }
        let json = try? await webView.evaluateJavaScript("JSON.stringify(window.tankmateState ? window.tankmateState() : null)") as? String
        guard let json, let data = json.data(using: .utf8) else { return nil }
        return try? JSONDecoder().decode(TankState.self, from: data)
    }

    func addTank(name: String) {
        webView?.evaluateJavaScript("window.tankmateAddTank && window.tankmateAddTank(\(JSLiteral.quoted(name)))")
    }
}

/// Turns arbitrary text into a single-quoted JavaScript string literal that is safe to
/// splice into `evaluateJavaScript` source. Escaping only backslash and quote is not
/// enough: a raw newline, carriage return, U+2028 or U+2029 terminates a JS string
/// literal, so a tank name containing one would be a syntax error (or inject code).
enum JSLiteral {
    static func quoted(_ text: String) -> String {
        var out = "'"
        for scalar in text.unicodeScalars {
            switch scalar {
            case "\\": out += "\\\\"
            case "'": out += "\\'"
            case "\n": out += "\\n"
            case "\r": out += "\\r"
            case "\u{2028}": out += "\\u2028"
            case "\u{2029}": out += "\\u2029"
            default:
                if scalar.value < 0x20 { out += String(format: "\\u%04X", scalar.value) }
                else { out.unicodeScalars.append(scalar) }
            }
        }
        return out + "'"
    }
}

struct WebAppView: UIViewRepresentable {
    let bridge: WebBridge
    let isPro: Bool
    /// Fired when the page asks for something native.
    var onEvent: (BridgeEvent) -> Void

    func makeCoordinator() -> Coordinator { Coordinator(onEvent: onEvent) }

    func makeUIView(context: Context) -> WKWebView {
        let config = WKWebViewConfiguration()

        // Persistent store: the user's water tests live in localStorage.
        config.websiteDataStore = .default()
        config.allowsInlineMediaPlayback = true

        if let handler = BundledWebSchemeHandler() {
            config.setURLSchemeHandler(handler, forURLScheme: BundledWebSchemeHandler.scheme)
            context.coordinator.schemeHandler = handler
        }

        let controller = WKUserContentController()
        controller.add(context.coordinator, name: Coordinator.messageName)
        controller.addUserScript(WKUserScript(
            source: Self.nativeBridgeScript,
            injectionTime: .atDocumentEnd,
            forMainFrameOnly: true
        ))
        config.userContentController = controller

        let webView = WKWebView(frame: .zero, configuration: config)
        webView.navigationDelegate = context.coordinator
        webView.uiDelegate = context.coordinator
        webView.allowsBackForwardNavigationGestures = false

        // The page draws its own dark background and handles the safe areas
        // itself (index.html sets viewport-fit=cover and the CSS uses
        // env(safe-area-inset-bottom)), so let it own the full screen.
        webView.isOpaque = false
        webView.backgroundColor = UIColor(named: "LaunchBackground") ?? .black
        webView.scrollView.backgroundColor = webView.backgroundColor
        webView.scrollView.contentInsetAdjustmentBehavior = .never
        webView.scrollView.showsVerticalScrollIndicator = false

        bridge.webView = webView
        context.coordinator.isPro = isPro
        webView.load(URLRequest(url: BundledWebSchemeHandler.startURL))
        return webView
    }

    func updateUIView(_ webView: WKWebView, context: Context) {
        context.coordinator.onEvent = onEvent
        if context.coordinator.isPro != isPro {
            context.coordinator.isPro = isPro
            bridge.pushPro(isPro)
        }
    }

    static func dismantleUIView(_ webView: WKWebView, coordinator: Coordinator) {
        webView.configuration.userContentController
            .removeScriptMessageHandler(forName: Coordinator.messageName)
    }

    // MARK: - Native bridge

    /// Adds a native-only control to the web app's header. Injected at runtime
    /// rather than baked into index.html so the website stays untouched — the
    /// repo root remains the single source of truth for the web app.
    private static let nativeBridgeScript = """
    (function () {
      var header = document.querySelector('header');
      if (!header || document.getElementById('native-reminders')) return;

      // The web header is a two-item flexbox with justify-content:space-between.
      // Adding a third child makes the tank name shrink and wrap, so the
      // native-only rules below hold it on one line. Scoped to .tankmate-native
      // so nothing here can affect the website.
      var style = document.createElement('style');
      style.textContent =
        'html.tankmate-native header{gap:10px}' +
        'html.tankmate-native .brand{white-space:nowrap;flex:0 0 auto}' +
        'html.tankmate-native .tankname{white-space:nowrap;flex:0 1 auto}' +
        // 44×44 is Apple's minimum tap target; the negative vertical margin
        // keeps it from making the header taller than it is on the web.
        'html.tankmate-native #native-reminders,html.tankmate-native #native-charts{background:none;border:0;padding:0;' +
        'margin:-8px 0;width:44px;height:44px;font-size:20px;line-height:1;' +
        'flex:0 0 auto;color:inherit;cursor:pointer;-webkit-appearance:none}';
      document.head.appendChild(style);

      var b = document.createElement('button');
      b.id = 'native-reminders';
      b.type = 'button';
      b.textContent = '\\u{1F514}';
      b.setAttribute('aria-label', 'Reminders');
      b.addEventListener('click', function () {
        window.webkit.messageHandlers.tankmate.postMessage({ action: 'openReminders' });
      });
      header.appendChild(b);

      var c = document.createElement('button');
      c.id = 'native-charts';
      c.type = 'button';
      c.textContent = '\\u{1F4CA}';
      c.setAttribute('aria-label', 'Charts');
      c.addEventListener('click', function () {
        window.webkit.messageHandlers.tankmate.postMessage({ action: 'openCharts' });
      });
      header.insertBefore(c, b);
      document.documentElement.classList.add('tankmate-native');
      // Tell app.js it is inside the native shell (shows the tank switcher). The
      // real Pro state is pushed by native right after the page finishes loading.
      if (window.tankmateApplyNative) window.tankmateApplyNative({ isPro: false });
    })();
    """

    final class Coordinator: NSObject, WKNavigationDelegate, WKUIDelegate, WKScriptMessageHandler {
        static let messageName = "tankmate"

        var onEvent: (BridgeEvent) -> Void
        var isPro = false
        /// Held so the handler outlives makeUIView; WKWebViewConfiguration does
        /// not retain scheme handlers strongly enough to rely on.
        var schemeHandler: BundledWebSchemeHandler?

        init(onEvent: @escaping (BridgeEvent) -> Void) {
            self.onEvent = onEvent
        }

        /// The page has run app.js and the injected script; give it the real entitlement.
        func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
            webView.evaluateJavaScript("window.tankmateApplyNative && window.tankmateApplyNative({isPro:\(isPro)})")
        }

        func userContentController(_ controller: WKUserContentController,
                                   didReceive message: WKScriptMessage) {
            guard let event = BridgeEvent.parse(message.body) else { return }
            onEvent(event)
        }

        /// Keep every in-app navigation inside the bundle. Anything else (an
        /// http(s) link the web app might grow later) opens in Safari rather than
        /// silently replacing the app's only screen.
        func webView(_ webView: WKWebView,
                     decidePolicyFor action: WKNavigationAction,
                     decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
            guard let url = action.request.url else {
                decisionHandler(.cancel)
                return
            }
            if url.scheme == BundledWebSchemeHandler.scheme {
                decisionHandler(.allow)
                return
            }
            decisionHandler(.cancel)
            if action.navigationType == .linkActivated,
               let scheme = url.scheme, ["http", "https", "mailto"].contains(scheme) {
                UIApplication.shared.open(url)
            }
        }
    }
}
