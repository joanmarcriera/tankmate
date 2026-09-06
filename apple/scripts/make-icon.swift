//  make-icon.swift
//  Rasterises the repo's icon.svg into the app's asset-catalog images.
//
//  Usage (from the repo root):
//      swift apple/scripts/make-icon.swift
//
//  Run by hand whenever icon.svg changes; the PNGs are committed so a build
//  never depends on a rasteriser being installed. This Mac has no librsvg,
//  ImageMagick, Inkscape or cairosvg, but AppKit reads SVG natively
//  (_NSSVGImageRep), so there is nothing to install.
//
//  Produces:
//    AppIcon.appiconset/icon-1024.png   1024², fully opaque (the App Store
//                                       rejects app icons with an alpha channel)
//    LaunchLogo.imageset/launch-logo.png 1024² transparent canvas with the mark
//                                       centred at ~1/3 width, so the launch
//                                       screen's aspect-fit does not blow it up
//                                       to the full screen width.

import AppKit
import Foundation

let repoRoot = URL(fileURLWithPath: FileManager.default.currentDirectoryPath)
let source = repoRoot.appendingPathComponent("icon.svg")
let catalog = repoRoot.appendingPathComponent("apple/Resources/Assets.xcassets")

guard let artwork = NSImage(contentsOf: source) else {
    FileHandle.standardError.write("error: could not read \(source.path)\n".data(using: .utf8)!)
    exit(1)
}

/// Draws `artwork` at `markSize` centred on a `canvas`² bitmap and writes a PNG.
func render(canvas: Int, markSize: CGFloat, background: NSColor?, to url: URL) throws {
    guard let rep = NSBitmapImageRep(
        bitmapDataPlanes: nil, pixelsWide: canvas, pixelsHigh: canvas,
        bitsPerSample: 8, samplesPerPixel: 4, hasAlpha: true, isPlanar: false,
        colorSpaceName: .deviceRGB, bytesPerRow: 0, bitsPerPixel: 0
    ) else { throw NSError(domain: "make-icon", code: 1) }

    NSGraphicsContext.saveGraphicsState()
    NSGraphicsContext.current = NSGraphicsContext(bitmapImageRep: rep)
    let bounds = NSRect(x: 0, y: 0, width: canvas, height: canvas)
    if let background {
        background.setFill()
        bounds.fill()
    }
    let inset = (CGFloat(canvas) - markSize) / 2
    artwork.draw(in: NSRect(x: inset, y: inset, width: markSize, height: markSize),
                 from: .zero, operation: .sourceOver, fraction: 1)
    NSGraphicsContext.restoreGraphicsState()

    guard let png = rep.representation(using: .png, properties: [:]) else {
        throw NSError(domain: "make-icon", code: 2)
    }
    try FileManager.default.createDirectory(at: url.deletingLastPathComponent(),
                                            withIntermediateDirectories: true)
    try png.write(to: url)
    print("wrote \(url.lastPathComponent) (\(canvas)×\(canvas), \(png.count) bytes)")
}

do {
    // The mark already carries its own rounded-rect plate, so it fills the icon
    // edge to edge; iOS applies the mask. Opaque black underneath guarantees no
    // alpha survives into the App Store icon.
    try render(canvas: 1024, markSize: 1024, background: .black,
               to: catalog.appendingPathComponent("AppIcon.appiconset/icon-1024.png"))
    try render(canvas: 1024, markSize: 340, background: nil,
               to: catalog.appendingPathComponent("LaunchLogo.imageset/launch-logo.png"))
} catch {
    FileHandle.standardError.write("error: \(error)\n".data(using: .utf8)!)
    exit(1)
}
