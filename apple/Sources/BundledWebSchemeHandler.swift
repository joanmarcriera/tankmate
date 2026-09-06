//  BundledWebSchemeHandler.swift
//  Serves the bundled Tankmate web app to WKWebView over a custom URL scheme.
//
//  Why a custom scheme rather than file:// —
//  WKWebView gives file:// pages an opaque security origin, so localStorage is
//  unreliable there and can be dropped between launches. Tankmate stores every
//  water test in localStorage, so losing it would lose the user's data. A custom
//  scheme with a host ("tankmate://app/") gets a real, stable security origin, so
//  localStorage persists exactly like it does on the website. This is the same
//  reason Capacitor serves its iOS payload from "capacitor://localhost".
//
//  Everything is read from the app bundle, so the app never touches the network.

import Foundation
import WebKit

final class BundledWebSchemeHandler: NSObject, WKURLSchemeHandler {
    /// Scheme + host together form the web app's security origin. Changing either
    /// orphans every existing user's localStorage — treat them as permanent.
    static let scheme = "tankmate"
    static let host = "app"
    static var startURL: URL { URL(string: "\(scheme)://\(host)/index.html")! }

    /// Directory inside the app bundle written by scripts/prepare-web-bundle.py.
    private let root: URL

    /// Tasks WebKit has cancelled. Calling back into a stopped task raises an
    /// Objective-C exception, so responses are dropped for anything in here.
    private var stopped = Set<ObjectIdentifier>()

    init(root: URL) {
        self.root = root.standardizedFileURL
        super.init()
    }

    convenience init?(bundle: Bundle = .main) {
        guard let dir = bundle.url(forResource: "web", withExtension: nil) else { return nil }
        self.init(root: dir)
    }

    func webView(_ webView: WKWebView, start task: WKURLSchemeTask) {
        let id = ObjectIdentifier(task)
        guard let url = task.request.url, let file = resolve(url) else {
            respond(task, id: id, status: 404, mime: "text/plain", body: Data())
            return
        }
        do {
            let data = try Data(contentsOf: file)
            respond(task, id: id, status: 200, mime: Self.mimeType(for: file), body: data)
        } catch {
            respond(task, id: id, status: 404, mime: "text/plain", body: Data())
        }
    }

    func webView(_ webView: WKWebView, stop task: WKURLSchemeTask) {
        stopped.insert(ObjectIdentifier(task))
    }

    // MARK: - Internals

    /// Maps a request URL onto a file inside `root`, refusing anything that would
    /// escape the bundled directory.
    private func resolve(_ url: URL) -> URL? {
        var path = url.path
        if path.hasPrefix("/") { path.removeFirst() }
        if path.isEmpty { path = "index.html" }
        let candidate = root.appendingPathComponent(path).standardizedFileURL
        guard candidate.path.hasPrefix(root.path + "/") else { return nil }
        return candidate
    }

    private func respond(_ task: WKURLSchemeTask, id: ObjectIdentifier,
                         status: Int, mime: String, body: Data) {
        guard !stopped.contains(id), let url = task.request.url else { return }
        let response = HTTPURLResponse(
            url: url,
            statusCode: status,
            httpVersion: "HTTP/1.1",
            headerFields: [
                "Content-Type": mime,
                "Content-Length": String(body.count),
                // The payload ships inside the app; the only cache that matters
                // is the bundle itself.
                "Cache-Control": "no-store",
            ]
        )!
        task.didReceive(response)
        task.didReceive(body)
        task.didFinish()
        stopped.remove(id)
    }

    static func mimeType(for url: URL) -> String {
        switch url.pathExtension.lowercased() {
        case "html", "htm":   return "text/html; charset=utf-8"
        case "js", "mjs":     return "text/javascript; charset=utf-8"
        case "css":           return "text/css; charset=utf-8"
        case "svg":           return "image/svg+xml"
        case "json":          return "application/json; charset=utf-8"
        case "webmanifest":   return "application/manifest+json; charset=utf-8"
        case "png":           return "image/png"
        case "jpg", "jpeg":   return "image/jpeg"
        case "woff2":         return "font/woff2"
        default:              return "application/octet-stream"
        }
    }
}
