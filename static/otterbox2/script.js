"use strict"

import * as influx from "./influx.js"

function sum(x) { return x.reduce((a, b) => a + b, 0) }
function clip(x, a, b) { return Math.max(a, Math.min(b, x)) }

function calculateDateHourTicks(d0, d1, hours) {
    d0.setHours(Math.floor(d0.getHours() / hours) * hours, 0, 0, 0)
    d1.setHours(Math.ceil(d1.getHours() / hours) * hours, 0, 0, 0)
    const ticks = []
    for (let t = +d0; t <= +d1; t += 3600 * 1e3 * hours)
        ticks.push(t)
    return ticks
}

function showGauges(fields) {

}

async function main() {

    showGauges({
        "gpu.percent": { name: "GPU%", good: 100, bad: 0, }
    })

    const history = await influx.get(
        "1421023064302",
        "battery.soc",
        "load.power", "power.total",
        "solar.power", "temp.max",
    )
    // gpu.percent vic.percent ram.percent battery.voltage cpu.percent controller.temp
    // disk0.percent user.count modem.signal
    // console.log(history)
    const xhour = 4
    const day_ms = 24 * 3600 * 1000
    const all_t = Object.values(history).map(x => x.map(y => y[0])).flat()
    const date_min = new Date(Math.min(...all_t))
    const date_max = new Date(Math.max(...all_t))
    const xticks = calculateDateHourTicks(date_min, date_max, 6)
    const days = (date_max - date_min) / day_ms
    const iw = Math.ceil(days * 256)
    const ih = 256
    CHART.width = iw + 64
    CHART.height = ih
    const datasets = Object.entries(history).map(([k, v]) => ({
        label: k,
        data: v,
        showLine: true,
        fill: true,
        borderColor: "#f00",
        backgroundColor: "#f001",
    }))
    new Chart(CHART, {
        type: "scatter",
        data: { datasets: datasets },
        options: {
            animation: false, // Disable all animations
            elements: { point: { radius: 0 } },
            responsive: false,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                x: {
                    ticks: {
                        callback(value, index) {
                            const d = new Date(value)
                            const date_string = d.toLocaleString("en-US", { month: "short", day: "numeric" })
                            const time_string = d.toLocaleString("en-US", { hour: "2-digit", hour12: false })
                            if (new Date(value).getHours() == 0)
                                return date_string
                            return time_string
                        },
                    },
                    afterBuildTicks: axis => axis.ticks = xticks.map(v => ({ value: v }))
                }
            }
        },
    });

    const element = document.createElement("div")
    const element_id = crypto.randomUUID()
    element.setAttribute("id", element_id)
    document.body.appendChild(element)
    const gauge = new JustGage({
        id: element_id,
        width: 256,
        height: 128,
        value: 50,
        // min: 0,
        // max: 100,
        // decimals: 1,
        // gaugeWidthScale: 1.5,
        label: "abc",
        labelFontColor: "black",
        labelMinFontSize: 16,
        valueMinFontSize: 16,
        minLabelMinFontSize: 16,
        maxLabelMinFontSize: 16,
        hideMinMax: true,
        showInnerShadow: true,
        // counter: true, 
        // targetLine: 90,
        // targetLineColor: "#c00",
        // targetLineWidth: 4,
    })

    // // const distinct_assets = sample(await getDistinctAssets(), 1)
    // const distinct_assets = ["SBS3510B"]
    // // SBS6498J 2024-05-27T23:55:00
    // // SBS3510B 2024-05-23T10:28:00
    // // SBS3510B 2024-05-23T06:06:00
    // // SG1059M  2024-05-19T06:01:00
    // const asset_filter = distinct_assets.map(x => `r["asset"] == "${x}"`).join(" or ")
    // const data = await query(`
    //     from(bucket:"v3") 
    //     |> range(start:2024-05-23T00:00:00+08:00, 
    //              stop :2024-05-24T00:00:00+08:00)
    //     |> filter(fn: (r) => r["_field"] == "engine_coolant_temperature")
    //     |> filter(fn: (r) => ${asset_filter})
    //     |> drop(columns: ["_start", "_stop", "_measurement", "asset", "model", "_field"])
    // `)
    // data.forEach(x => {
    //     x._time = new Date(x._time) * 1e-3
    //     x._value = +x._value
    // })
    // const gradients = calculateGradient(data, "_value", 1).map(x => Math.max(0, x))
    // // const gradients2 = calculateGradient(data, "_value", 2).map(x => Math.max(0, x))
    // // const segments = split(data, "_value")
    // // console.log(segments.length)
    // // const datasets = segments.map(segment => segment.map(a => ({
    // //     x: (a._time - t0) / 3600,
    // //     y: a._value
    // // })))

    // plot([
    //     data.map(a => ({ x: a._time, y: a._value / 100 })),
    //     data.map((a, i) => ({ x: a._time, y: gradients[i] * 60 / 10 })),
    //     // data.map((a, i) => ({ x: a._time, y: gradients2[i] })),
    // ])

}

main()

function plot(xys) {
    new Chart(CHART, {
        type: "scatter",
        data: { datasets: xys.map(xy => ({ data: xy, showLine: true })) },
        options: {
            elements: { point: { radius: 0 } },
            responsive: false,
            // plugins: { legend: { display: false } },
            // scales: {
            //     x: {
            //         ticks: {
            //             callback(value, index) {
            //                 const d = new Date(value * 1e3)
            //                 return `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, 0)}-${(d.getDate().toString().padStart(2, 0))}T${d.getHours().toString().padStart(2, 0)}:${d.getMinutes().toString().padStart(2, 0)}`
            //             }
            //         }
            //     }
            // }
        },
    })
}
