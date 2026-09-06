//  WebAppView.swift
//  Hosts the bundled Tankmate web app in a WKWebView.
//
//  The web app is served from the app bundle over tankmate://app/ (see
//  BundledWebSchemeHandler), so it runs with no network connection at all — the
//  offline story is structural, not a cache that can be evicted.

import SwiftUI
import WebKit

struct WebAppView: UIViewRepresentable {
    /// Fired when the injected native control in the web header is tapped.
    var onOpenReminders: () -> Void

    func makeCoordinator() -> Coordinator { Coordinator(onOpenReminders: onOpenReminders) }

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

        webView.load(URLRequest(url: BundledWebSchemeHandler.startURL))
        return webView
    }

    func updateUIView(_ webView: WKWebView, context: Context) {
        context.coordinator.onOpenReminders = onOpenReminders
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
        'html.tankmate-native #native-reminders{background:none;border:0;padding:0;' +
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
      document.documentElement.classList.add('tankmate-native');
    })();
    """

    final class Coordinator: NSObject, WKNavigationDelegate, WKUIDelegate, WKScriptMessageHandler {
        static let messageName = "tankmate"

        var onOpenReminders: () -> Void
        /// Held so the handler outlives makeUIView; WKWebViewConfiguration does
        /// not retain scheme handlers strongly enough to rely on.
        var schemeHandler: BundledWebSchemeHandler?

        init(onOpenReminders: @escaping () -> Void) {
            self.onOpenReminders = onOpenReminders
        }

        func userContentController(_ controller: WKUserContentController,
                                   didReceive message: WKScriptMessage) {
            guard let body = message.body as? [String: Any],
                  body["action"] as? String == "openReminders" else { return }
            onOpenReminders()
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
