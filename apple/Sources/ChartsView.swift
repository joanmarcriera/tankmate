//  ChartsView.swift
//  Pro: parameter charts with Swift Charts. Data arrives from the web app as a
//  TankState snapshot (the web app owns the storage); shaping lives in ChartData.

import SwiftUI
import Charts

struct ChartsView: View {
    let state: TankState
    @Environment(\.dismiss) private var dismiss
    @State private var parameter: Parameter
    @State private var range: ChartRange

    init(state: TankState) {
        self.state = state
        let first = ChartData.availableParameters(state.tests).first ?? .no3
        let initial = ChartData.availableParameters(state.tests).contains(.no3) ? Parameter.no3 : first
        _parameter = State(initialValue: initial)
        _range = State(initialValue: ChartData.defaultRange(state.tests, parameter: initial))
    }

    var body: some View {
        NavigationStack {
            let available = ChartData.availableParameters(state.tests)
            let points = ChartData.points(state.tests, parameter: parameter, range: range)
            VStack(alignment: .leading, spacing: 12) {
                if available.isEmpty {
                    ContentUnavailableView("No readings yet", systemImage: "chart.xyaxis.line",
                                           description: Text("Log a water test for \(state.active.name) to see charts."))
                } else {
                    Picker("Parameter", selection: $parameter) {
                        ForEach(available) { Text($0.label).tag($0) }
                    }
                    .pickerStyle(.menu)
                    .accessibilityIdentifier("charts.parameter")

                    Picker("Range", selection: $range) {
                        ForEach(ChartRange.allCases) { Text($0.label).tag($0) }
                    }
                    .pickerStyle(.segmented)

                    if points.isEmpty {
                        ContentUnavailableView("Nothing in this range", systemImage: "calendar",
                                               description: Text("Pick a longer range."))
                    } else {
                        Chart {
                            if let band = parameter.target {
                                RectangleMark(yStart: .value("Low", band.lowerBound),
                                              yEnd: .value("High", max(band.upperBound, band.lowerBound + 0.0001)))
                                    .foregroundStyle(.green.opacity(0.12))
                            }
                            ForEach(points) { p in
                                LineMark(x: .value("Date", p.date), y: .value(parameter.label, p.value))
                                PointMark(x: .value("Date", p.date), y: .value(parameter.label, p.value))
                            }
                        }
                        .frame(minHeight: 260)
                        .accessibilityIdentifier("charts.chart")
                        if parameter.target != nil {
                            Text("Green band = healthy range used by the verdicts.")
                                .font(.footnote).foregroundStyle(.secondary)
                        }
                    }
                    ShareLink(item: ChartData.csv(state.tests), subject: Text("\(state.active.name) water tests"),
                              message: Text("Tankmate export")) {
                        Label("Export CSV", systemImage: "square.and.arrow.up")
                    }
                }
                Spacer()
            }
            .padding()
            .navigationTitle(state.active.name)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar { ToolbarItem(placement: .confirmationAction) { Button("Done") { dismiss() } } }
        }
    }
}
