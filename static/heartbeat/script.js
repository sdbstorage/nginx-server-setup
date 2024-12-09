"use strict"

const widget_width = 160
const widget_height = widget_width / 2

function E(tag, attributes = {}, innerHTML = null) {
    const e = document.createElementNS("http://www.w3.org/2000/svg", tag)
    Object.entries(attributes).forEach(([k, v]) => e.setAttribute(k, v))
    if (innerHTML != null)
        e.innerHTML = innerHTML
    return e
}

function arc(angle, thickness, attributes) {
    const [cx, cy] = [50, 50]
    const [r1, r2] = [50, 50 - thickness]
    const [a0, a1] = [0, angle]
    const d = `M 
        ${cx - Math.cos(a0) * r1} ${cy - Math.sin(a0) * r1} A ${r1} ${r1} 0 0 1 
        ${cx - Math.cos(a1) * r1} ${cy - Math.sin(a1) * r1} L 
        ${cx - Math.cos(a1) * r2} ${cy - Math.sin(a1) * r2} A ${r2} ${r2} 0 0 0
        ${cx - Math.cos(a0) * r2} ${cy - Math.sin(a0) * r2} Z
    `
    return E("path", { d: d, ...attributes })
}

function createGauge({
    width = widget_width, height = widget_height, value, good = 1.0, bad = 0.0,
    suffix = null, text = null, mean = null, stddev = null, // TODO: STDDEV
} = {}) {
    const min = Math.min(good, bad)
    const max = Math.max(good, bad)
    const ratio = Math.min(1, Math.max(0.05, (value - min) / (max - min)))
    const svg = E("svg", { viewBox: "0 0 100 50", "width": width, "height": height })
    const filter = E("filter", { id: "drop-shadow" })
    const component_transfer = E("feComponentTransfer", { in: "SourceAlpha" })
    component_transfer.appendChild(E("feFuncA", { type: "table", tableValues: "0.3 0" }))
    filter.appendChild(component_transfer)
    filter.appendChild(E("feGaussianBlur", { stdDeviation: 2 }))
    filter.appendChild(E("feOffset", { dy: 2 }))
    filter.appendChild(E("feComposite", { in2: "SourceGraphic", operator: "in" }))
    const arc_thickness = 20
    const m = (good + bad) / 2
    let color
    if (Math.abs(value - good) < Math.abs(value - bad))
        color = `rgb(${192 * (1 - Math.abs((value - m) / (good - m)))},192,0)` // green
    else
        color = `rgb(192,${192 * (1 - Math.abs((value - m) / (bad - m)))},0)` // red
    svg.appendChild(filter)
    svg.appendChild(arc(Math.PI, arc_thickness, { fill: "#eee" }))
    if (isFinite(ratio))
        svg.appendChild(arc(Math.PI * ratio, arc_thickness, { fill: color }))
    svg.appendChild(arc(Math.PI, arc_thickness, { fill: "black", filter: "url(#drop-shadow)" }))
    let primary_text = value
    if (suffix)
        primary_text += suffix
    svg.appendChild(E("text", {
        x: 50, y: text == null ? 45 : 40,
        "text-anchor": "middle",
        "font-family": "Arial, Helvetica, sans-serif", "font-size": 14,
    }, primary_text))
    if (text != null) {
        svg.appendChild(E("text", {
            x: 50, y: 50,
            "text-anchor": "middle", "alignment-baseline": "text-after-edge",
            "font-family": "Arial, Helvetica, sans-serif", "font-size": 6.5,
        }, text))
    }
    return svg
}

function createText(primary, secondary = null, size = null) {
    const div = document.createElement("div")
    // div.style.border = "1px solid #0004"
    div.style.width = widget_width
    div.style.height = widget_height
    div.style.display = "flex"
    div.style.flexDirection = "column"
    div.style.alignItems = "center"
    div.style.justifyContent = "center"
    div.style.fontFamily = "Arial, Helvetica, sans-serif"
    div.style.gap = "4px"
    div.style.borderRadius = "8px"
    div.style.background = "#0001"
    // div.style.boxShadow = "inset 0 -4px 8px #0004"
    div.style.border = "2px solid #0002"
    div.style.textAlign = "center"
    const div_primary = div.appendChild(document.createElement("div"))
    div_primary.style.fontSize = size == null ? "1.75rem" : size
    const div_secondary = div.appendChild(document.createElement("div"))
    div_secondary.style.fontSize = "0.9rem"
    div_primary.innerHTML = primary
    if (secondary != null)
        div_secondary.innerHTML = secondary
    return div
}

function parseTegraStats(tegrastats) {
    if (!tegrastats)
        return
    // 01-24-2024 09:17:09 RAM 3503/7337MB (lfb 7x1MB) SWAP 430/3668MB (cached 1MB) 
    // CPU [11%@729,13%@729,9%@729,18%@729,off,off] EMC_FREQ 0%@2133 
    // GR3D_FREQ 0%@305 GR3D2_FREQ 0%@0 VIC_FREQ 115 APE 174 
    // CV0@42.718C CPU@44.093C SOC2@42.625C SOC0@43.281C CV1@42.25C GPU@41.343C tj@46.968C SOC1@46.968C CV2@42.875C 
    // VDD_IN 4915mW/4915mW VDD_CPU_GPU_CV 449mW/449mW VDD_SOC 1431mW/1431mW
    const ram = tegrastats.match(/RAM ([0-9]+)\/([0-9]+)MB/).slice(1).map(x => +x)
    const swap = tegrastats.match(/SWAP ([0-9]+)\/([0-9]+)MB/).slice(1).map(x => +x)
    const cpu = tegrastats.match(/CPU \[([^\]]+)/)[1]?.split(",")
        .map(x => x.split("@"))
        .map(x => x == "off" ? null : [+x[0].split("%")[0], +x[1]])
    const gpu = Array.from(tegrastats.matchAll(/GR3D[0-9]*_FREQ ([0-9]+)%@([0-9]+)/g)).map(x => x.slice(1).map(y => +y))
    // NOTE: PMIC may be always 50 degree for Xavier NX/AGX
    const temp = Array.from(tegrastats.matchAll(/(\S+)@([0-9\.]+)C/g)).map(x => x.slice(1)).map(x => [x[0], +x[1]]).filter(x => x[0] != "PMIC")
    const power = Array.from(tegrastats.matchAll(/VDD_(\S+) ([0-9]+)/g)).map(x => x.slice(1)).map(x => [x[0], +x[1]])
    const cpu_active = cpu.filter(x => x)
    const cpu_mhz = Math.max(...cpu_active.map(x => x[1]))
    const cpu_usage = cpu_active.map(x => x[0]).reduce((a, b) => a + b, 0) / cpu_active.length
    let gpu_mhz = Math.max(...gpu.map(x => x[1]))
    let gpu_usage = Math.max(...gpu.map(x => x[0]))
    gpu_mhz = isFinite(gpu_mhz) ? gpu_mhz : 0
    gpu_usage = isFinite(gpu_usage) ? gpu_usage : 0
    return {
        ram: ram, swap: swap, cpu: cpu, gpu: gpu, temp: temp, power: power,
        temp_max: Math.max(...temp.map(x => x[1])),
        power_total: power.map(x => x[1]).reduce((a, b) => a + b, 0) * 1e-3,
        ram_percent: ram[0] / ram[1] * 100,
        cpu_mhz: cpu_mhz, cpu_usage: cpu_usage,
        gpu_mhz: gpu_mhz,
        gpu_usage: gpu_usage,
    }
}

function parseVnStat(vnstat) {
    if (!vnstat || typeof vnstat != "string")
        return
    let values = vnstat?.split(";").slice(1)
    const output = {}
    output.name = values.shift()
    output.daily_date = values.shift()
    output.daily_rx = +values.shift()
    output.daily_tx = +values.shift()
    output.daily_all = output.daily_rx + output.daily_tx
    values = values.slice(2)
    output.monthly_date = values.shift()
    output.monthly_rx = +values.shift()
    output.monthly_tx = +values.shift()
    output.monthly_all = output.monthly_rx + output.monthly_tx
    return output
}

function parseDockerStats(docker_stats) {
    if (!docker_stats || typeof docker_stats == "string") // skip buggy string
        return
    const output = docker_stats.map(x => {
        let mem_usage = x.MemUsage?.split("/")[0]?.trim()
        if (mem_usage.endsWith("KiB"))
            mem_usage = +mem_usage.slice(0, -3) * 1024
        else if (mem_usage.endsWith("MiB"))
            mem_usage = +mem_usage.slice(0, -3) * 1024 * 1024
        else if (mem_usage.endsWith("GiB"))
            mem_usage = +mem_usage.slice(0, -3) * 1024 * 1024 * 1024
        else if (mem_usage.endsWith("B"))
            mem_usage = +mem_usage.slice(0, -1)
        let name = x.Name
        if (name.endsWith("-1"))
            name = name.slice(0, -2)
        else if (name.includes("-run-"))
            name = name.split("-run-", 1)[0]
        return { name: name, mem_usage: mem_usage }
    })
    return output
}

function parseEpever(epever) {
    if (!epever)
        return
    const data = epever.map(y => y.map(z => {
        try { return +z.match(/([0-9\.\-]+)/)[0] }
        catch { return z }
    }))
    const data0 = data[0]
    return {
        data: data,
        solar_power: data0[2],
        load_current: data0[4],
        load_power: data0[5],
        battery_voltage: data0[6],
        battery_current: data0[7],
        battery_charge: data0[9],
        controller_temperature: data0[12],
        consumed_energy_today: data0[23],
        generated_energy_today: data0[28],
    }
}

function createGroup(title) {
    const e = document.createElement("div")
    e.style.border = "2px solid #0002"
    e.style.borderRadius = "8px"
    e.style.padding = "8px"
    e.style.paddingTop = "12px"
    e.style.display = "flex"
    e.style.flexWrap = "wrap"
    e.style.gap = "8px"
    e.style.justifyContent = "center"
    e.style.marginTop = "8px"
    e.style.position = "relative"
    e.style.flex = "1 auto"
    const title_div = e.appendChild(document.createElement("div"))
    title_div.innerHTML = title
    title_div.style.position = "absolute"
    title_div.style.top = "-0.7rem"
    title_div.style.left = "0.5rem"
    title_div.style.background = "white"
    title_div.style.color = "#0008"
    title_div.style.padding = "0 0.25rem"
    return e
}

function visualiseTegraStats(tegrastats) {
    if (!tegrastats)
        return
    const ram = tegrastats.ram
    const swap = tegrastats.swap
    const gpu = tegrastats.gpu
    const cpu = tegrastats.cpu
    const power = tegrastats.power
    const temp = tegrastats.temp
    const container = CONTAINER.appendChild(createGroup("Computer"))
    container.appendChild(createGauge({
        value: Math.round(ram[0] / ram[1] * 100), suffix: "%", good: 0, bad: 100,
        text: `RAM ${ram[1]} MB`,
    }))
    // container.appendChild(createGauge({
    //     value: Math.round(swap[0] / swap[1] * 100), suffix: "%", good: 50, bad: 100,
    //     text: `SWAP ${swap[1]} MB`,
    // }))
    const cpu_active = cpu.filter(x => x)
    const cpu_mhz = Math.max(...cpu_active.map(x => x[1]))
    const cpu_usage = cpu_active.map(x => x[0]).reduce((a, b) => a + b, 0) / cpu_active.length
    container.appendChild(createGauge({
        value: Math.round(cpu_usage), suffix: "%", good: 0, bad: 100,
        text: `${cpu_active.length}/${cpu.length} CPU ${cpu_mhz} MHz`,
    }))

    let gpu_mhz = Math.max(...gpu.map(x => x[1]))
    let gpu_usage = Math.max(...gpu.map(x => x[0]))
    gpu_mhz = isFinite(gpu_mhz) ? gpu_mhz : 0
    gpu_usage = isFinite(gpu_usage) ? gpu_usage : 0
    container.appendChild(createGauge({
        value: Math.round(gpu_usage), suffix: "%", good: 100, bad: 0,
        text: `GPU ${gpu_mhz} MHz`,
    }))

    const temp_max = Math.max(...temp.map(x => x[1]))
    const temp_min = Math.min(...temp.map(x => x[1]))
    container.appendChild(createGauge({
        value: Math.round(temp_max), suffix: "&deg;C", good: 0, bad: 100,
        text: `Temp ${Math.round(temp_min)}-${Math.round(temp_max)} &deg;C`,
    }))

    container.appendChild(createGauge({
        value: Math.round(tegrastats.power_total), suffix: " W", good: 0, bad: 30,
        text: `Power draw`,
    }))

}

async function visualiseGeneral(entry) {

    const container = CONTAINER.appendChild(createGroup("General"))

    const heartbeat_delay_ms = (new Date() - new Date(entry.stamp_server))
    const heartbeat_delay = toDurationString(heartbeat_delay_ms * 1e-3, 1)
    container.appendChild(createText(
        `${heartbeat_delay} ago`,
        "Last heartbeat",
    ))
    const uptime = entry.uptime
    if (!uptime)
        return
    const average_loads = uptime.match(/load average: (.*)/)[1].split(",").map(x => +x)
    const users = +uptime.match(/([0-9]+) user/).slice(1)
    const up = uptime.match(/up ([^,]+),/).slice(1)
    container.appendChild(createText(up, "System uptime"))
    // container.appendChild(createText(users, "Active user"))
    // container.appendChild(createGauge({
    //     value: average_loads[0],
    //     text: `System load`, good: 0, bad: 4,
    // }))

    // if (entry.location_get) {
    //     const location = entry.location_get?.modem?.location["3gpp"]
    //     if (location) {
    //         // container.appendChild(createText(location.mcc, "Mobile Country Code"))
    //         // container.appendChild(createText(location.mnc, "Mobile Network Code"))
    //         // if (+location.lac != 0)
    //         //     container.appendChild(createText(location.lac, "Location Area Code"))
    //         // if (+location.tac != 0)
    //         //     container.appendChild(createText(location.tac, "Tracking Area Code"))
    //         // container.appendChild(createText(location.cid, "Cell Tower ID"))
    //         const response = await fetch(
    //             `/cellid/LTE/${location.mcc}/${location.mnc}/${location.tac}/${location.cid}`)
    //         try {
    //             const [lat, lng, loc] = JSON.parse(await response.text())
    //             console.log(loc)
    //             if (loc) {
    //                 const name = toCamelCase(loc.BUILDINGNAME)
    //                 container.appendChild(createText(name, "Estimated location", "1.25rem"))
    //             }
    //         }
    //         catch { }
    //     }
    // }

}

function visualiseCellular(entry) {

    const container = CONTAINER.appendChild(createGroup("Cellular"))

    if (entry.vnstat) {
        const vnstat = entry.vnstat
        const daily_rx_mb = (vnstat.daily_rx / 1024 / 1024).toFixed(1)
        const daily_tx_mb = (vnstat.daily_tx / 1024 / 1024).toFixed(1)
        const monthly_rx_mb = (vnstat.monthly_rx / 1024 / 1024 / 1024).toFixed(2)
        const monthly_tx_mb = (vnstat.monthly_tx / 1024 / 1024 / 1024).toFixed(2)
        container.appendChild(createText(
            `${daily_rx_mb} MB`,
            "Daily download",
            "1.5rem",
        ))
        container.appendChild(createText(
            `${daily_tx_mb} MB`,
            "Daily upload",
            "1.5rem",
        ))
        container.appendChild(createText(
            `${monthly_rx_mb} GB`,
            "Monthly download",
            "1.5rem",
        ))
        container.appendChild(createText(
            `${monthly_tx_mb} GB`,
            "Monthly upload",
            "1.5rem",
        ))
    }

    if (entry.mmcli) {
        const modem = entry.mmcli.modem
        const operator_name = modem["3gpp"]["operator-name"]
        const generic = modem?.generic
        const own_number = generic?.["own-numbers"]?.[0]
        const signal = generic?.["signal-quality"].value
        const model = generic.model?.replace("_", " ")

        if (own_number)
            container.appendChild(createText(own_number, "SIM number", "1.25rem"))

        if (signal != undefined)
            container.appendChild(createGauge({
                value: Math.round(signal), suffix: "%", good: 100, bad: 0,
                text: `Signal quality`,
            }))
        // container.appendChild(createText(operator_name, "Operator name"))
        // container.appendChild(createText(model, "Hardware model", "1.25rem"))
    }

}

function toCamelCase(x) {
    return x.split(" ").map(x => x[0].toUpperCase() + x.slice(1).toLowerCase()).join(" ")
}

function visualiseEpever(epever) {
    if (!epever)
        return epever

    const container = CONTAINER.appendChild(createGroup("Battery"))
    container.appendChild(createGauge({
        value: Math.round(epever.solar_power), suffix: " W",
        text: `Solar power`, good: 100, bad: 0,
    }))
    container.appendChild(createGauge({
        value: Math.round(epever.load_power), suffix: " W",
        text: `Load power`, good: 0, bad: 50,
    }))
    container.appendChild(createGauge({
        value: epever.battery_voltage.toFixed(1), suffix: " V",
        text: `Battery voltage`, good: 14, bad: 11,
    }))
    container.appendChild(createGauge({
        value: Math.round(epever.battery_charge_smooth), suffix: "%",
        text: `State of Charge`, good: 100, bad: 0,
    }))
    // container.appendChild(createGauge({
    //     value: epever.battery_current.toFixed(1), suffix: " A",
    //     text: `Battery current`, good: 10, bad: -10,
    // }))
    // container.appendChild(createGauge({
    //     value: epever.load_current.toFixed(1), suffix: " A",
    //     text: `Load current`, good: 0, bad: 10,
    // }))
    // container.appendChild(createGauge({
    //     value: Math.round(epever.controller_temperature), suffix: "&deg;C",
    //     text: `Charger temp`, good: 0, bad: 100,
    // }))
    // container.appendChild(createGauge({
    //     value: Math.round(epever.generated_energy_today - epever.consumed_energy_today), suffix: " kWh",
    //     text: `Daily energy gain`, good: 100, bad: -100,
    // }))
    // container.appendChild(createText(location.mnc, "Mobile Network Code"))
    // if (+location.lac != 0)
    //     container.appendChild(createText(location.lac, "Location Area Code"))
    // if (+location.tac != 0)
    //     container.appendChild(createText(location.tac, "Tracking Area Code"))
    // container.appendChild(createText(location.cid, "Cell Tower ID"))
}

function divmod(x, y) { return [Math.floor(x / y), x % y] }

function toDurationString(x, limit) {
    if (x instanceof Date)
        x = +x * 1e-3
    let parts = []
    if (x > (3600 * 24)) {
        let [days, r] = divmod(x, (3600 * 24))
        parts.push(`${days}d`)
        x = r
    }
    if (x > 3600) {
        let [hours, r] = divmod(x, 3600)
        parts.push(`${hours}h`)
        x = r
    }
    if (x > 60) {
        let [minutes, r] = divmod(x, 60)
        parts.push(`${minutes}m`)
        x = r
    }
    if (x > 0)
        parts.push(`${Math.round(x)}s`)
    if (limit)
        parts = parts.slice(0, limit)
    return parts.join(" ")
}

function plotXY(svg, xys, color) {
    let d = ""
    const huge_value = 1e6
    xys.forEach(([x, y], i) => {
        d += i == 0 ? `M${x} ${y} ` : `L${x} ${y} `
        if (i == xys.length - 1) {
            // Draw line
            svg.appendChild(E("path", { "d": d, fill: "none", stroke: color, "stroke-opacity": 0.5, "stroke-width": 3 }))
            // Fill area
            d += `L${x} ${huge_value} L${xys[0][0]} ${huge_value}`
            svg.appendChild(E("path", { "d": d, fill: color, "fill-opacity": 0.1 }))
        }
    })
}

function plotGraph(entries, parameters) {
    // const stamps = entries.map(x => new Date(x.stamp_server))
    const stamps = entries.map(x => new Date(x.stamp_fixed))
    const stamp_start = stamps[0]
    const stamp_end = stamps[stamps.length - 1]
    const stamp_duration = stamp_end - stamp_start

    const step_size = 16
    const step_ms = 3600 * 1e3
    const width = stamp_duration / step_ms * step_size
    const height = 256
    const svg = E("svg", { "width": width, "height": height })

    LEGEND.innerHTML = ""

    const valid_segments = {}
    const legend_texts = {}

    parameters.forEach(([name, suffix, color, callback], plot_index) => {
        const values = entries.map(x => callback(x))

        let xys = []
        let has_data = false
        valid_segments[plot_index] = []
        values.forEach((value, i) => {
            const stamp = stamps[i]
            const x = (stamp - stamp_start) / step_ms * step_size
            const y = (1 - value / 100) * height
            const is_continuous = stamp - stamps[i - 1] < 3600 * 1e3
            if (isFinite(y) && is_continuous) {
                xys.push([x, y])
                has_data = true
            }
            else {
                if (xys.length > 1) {
                    valid_segments[plot_index].push(xys)
                    plotXY(svg, xys, color)
                }
                xys = []
            }
        })
        if (xys.length > 1) {
            valid_segments[plot_index].push(xys)
            plotXY(svg, xys, color)
        }

        if (has_data) {
            const row = document.createElement("div")
            row.style.display = "flex"
            row.style.alignItems = "center"
            row.style.gap = "4px"
            const color_box = document.createElement("div")
            color_box.style.width = "16px"
            color_box.style.height = "16px"
            color_box.style.border = `1px solid #0004`
            color_box.style.background = color
            color_box.style.display = "inline-block"
            const text = document.createElement("span")
            text.innerHTML = name
            row.appendChild(color_box)
            row.appendChild(text)
            LEGEND.appendChild(row)
            legend_texts[plot_index] = text
        }
    })

    const x_interval_ms = 3600 * 1e3 * 4 // 12 hours
    const x_start_ms = Math.ceil(stamp_start / x_interval_ms) * x_interval_ms
    const grid_attributes = { stroke: "#0002", "stroke-dasharray": "4,2" }
    const x_tick_label_pad = 6
    for (let stamp = x_start_ms; stamp < stamp_end; stamp += x_interval_ms) {
        const x = (stamp - stamp_start) / step_ms * step_size
        const date = new Date(stamp)
        let date_format = { hour: "numeric", hour12: false }
        let date_attributes = {
            x: x, y: height - x_tick_label_pad,
            opacity: 0.5, "text-anchor": "middle",
        }
        let extra_attributes = {}
        if (date.getHours() == 0) {
            date_format = { month: "short", day: "numeric", }
            date_attributes["font-weight"] = "bold"
            extra_attributes.stroke = "#0004"
            extra_attributes["stroke-dasharray"] = "none"
        }
        svg.appendChild(E("line", {
            x1: x, x2: x, y1: 0, y2: height, ...grid_attributes, ...extra_attributes
        }))
        svg.appendChild(E("text",
            date_attributes,
            date.toLocaleString("en-US", date_format)))
    }

    RULER.innerHTML = ""
    const y_tick_label_pad = 4
    Array.from([0.25, 0.5, 0.75]).forEach(y => {
        const h = y * height
        svg.appendChild(E("line", { x1: 0, x2: width, y1: h, y2: h, ...grid_attributes }))
        const div = document.createElement("div")
        div.innerHTML = Math.round(y * 100)
        div.style.position = "absolute"
        div.style.opacity = 0.5
        div.style.left = y_tick_label_pad
        div.style.top = `${Math.round((1 - y) * height)}px`
        div.style.transform = "translate(0,-50%)"
        RULER.appendChild(div)
    })
    GRAPH_CONTAINER.appendChild(svg)

    function setCursor(x, y) {
        // TODO: INTERPOLATE ?!?!?!?
        cursor.setAttribute("x1", x || 0)
        cursor.setAttribute("x2", x || 0)
        cursor_horizontal.setAttribute("y1", y || 0)
        cursor_horizontal.setAttribute("y2", y || 0)
        const date = new Date(x / step_size * step_ms + +stamp_start)
        cursor_label.setAttribute("x", x - x_tick_label_pad)
        cursor_label.innerHTML = date.toLocaleTimeString(
            "en-UK", // NOTE: en-US 2430 -> en-UK 0030
            { hour: "numeric", minute: "numeric", hour12: false })
        // console.log(valid_segments)
        Object.entries(valid_segments).forEach(([plot_index, segments]) => {
            const parameter = parameters[plot_index]
            const title = parameter[0]
            const suffix = parameter[1]
            let found = false
            for (let i = 0; i < segments.length; ++i) {
                const segment = segments[i]
                const x0 = segment[0][0]
                const xn = segment[segment.length - 1][0]
                if (x >= x0 && x <= xn) {
                    for (let j = 0; j < segment.length; ++j) {
                        const [ax, ay] = segment[j]
                        if (ax >= x) {
                            // console.log(plot_index, ay)
                            const value = 100 * (1 - (ay / height))
                            if (legend_texts[plot_index])
                                legend_texts[plot_index].innerHTML = `${title} (${value.toFixed(1)}${suffix})`
                            found = true
                            break
                        }
                    }
                }
                if (found)
                    break
            }
            if (!found && legend_texts[plot_index]) // Reset if not found
                legend_texts[plot_index].innerHTML = `${title} (${suffix.trim()})`
            // console.log(found)
        })
    }
    const cursor = E("line", {
        y1: 0, y2: height,
        stroke: "#0008", "stroke-width": 2, "stroke-dasharray": "4,2",
    })
    const cursor_horizontal = E("line", {
        x1: 0, x2: width,
        stroke: "#0008", "stroke-width": 2, "stroke-dasharray": "4,2",
    })
    const cursor_label = E("text", {
        y: 4,
        "text-anchor": "end", "alignment-baseline": "text-before-edge",
        "font-family": "Arial, Helvetica, sans-serif", "font-size": 16,
        "fill": "#0008", "font-weight": "bold",
    })
    svg.appendChild(cursor)
    svg.appendChild(cursor_horizontal)
    svg.appendChild(cursor_label)
    setCursor(width)

    svg.addEventListener("pointerdown", e => setCursor(e.offsetX))
    svg.addEventListener("pointermove", e => {
        if (e.pressure > 0)
            setCursor(e.offsetX, e.offsetY)
    })
}

function smooth(prev, curr, alpha) {
    const next = alpha * prev + (1 - alpha) * curr
    return isFinite(next) ? next : curr
}

function visit(url) {
    const a = window.location
    const parts = a.pathname.split("/").filter(x => x.length).slice(0, -1)
    if (url)
        parts.push(url)
    const full_url = `${a.protocol}//${a.host}/${parts.join("/")}/`
    // console.log(full_url)
    // window.open(full_url, "_blank")
    location.href = full_url
}

function extractTableEntry(entry) {
    const uptime = entry.uptime || ""
    const location_3gpp = entry.location_get?.modem?.location?.["3gpp"]
    const modem_3gpp = entry.mmcli?.modem?.["3gpp"]
    const modem_generic = entry.mmcli?.modem?.generic
    const vnstat = entry.vnstat
    const top_ram_stats = entry.docker_stats?.sort((a, b) => b.mem_usage - a.mem_usage)[0]
    let top_ram = undefined
    if (top_ram_stats)
        top_ram = `${(top_ram_stats.mem_usage / 1024 / 1024 / 1024).toFixed(2)} / ${top_ram_stats.name}`
    return {
        "Server stamp": new Date(entry.stamp_server).toLocaleString("en-US", {
            month: "short",
            day: "numeric",
            weekday: "short",
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
            hour12: false,
        }),
        "Edge stamp": new Date(entry.stamp).toLocaleString("en-US", {
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
            hour12: false,
        }),
        "Up<br>time": uptime.split(",")[0].split("up").slice(-1)[0],
        "Sess": uptime.split("user")[0].split(",").slice(-1)[0].trim(),
        "CPU<br>(%)": entry.tegrastats?.cpu_usage?.toFixed(1),
        "GPU<br>(%)": entry.tegrastats?.gpu_usage?.toFixed(1),
        "Pow<br>(W)": entry.tegrastats?.power_total_smooth?.toFixed(1),
        "RAM<br>(%)": entry.tegrastats?.ram_percent?.toFixed(1),
        "Temp<br>(&deg;C)": entry.tegrastats?.temp_max?.toFixed(1),
        "Bat<br>(%)": entry.epever?.battery_charge_smooth?.toFixed(1),
        "Batt<br>(V)": entry.epever?.battery_voltage?.toFixed(1),
        "Load<br>(W)": entry.epever?.load_power_smooth?.toFixed(1),
        "Solar<br>(W)": entry.epever?.solar_power?.toFixed(1),
        "DayRX<br>(MB)": vnstat ? (vnstat?.daily_rx / 1024 / 1024).toFixed(1) : undefined,
        "DayTX<br>(MB)": vnstat ? (vnstat?.daily_tx / 1024 / 1024).toFixed(1) : undefined,
        "MonRX<br>(GB)": vnstat ? (vnstat?.monthly_rx / 1024 / 1024 / 1024).toFixed(2) : undefined,
        "MonTX<br>(GB)": vnstat ? (vnstat?.monthly_tx / 1024 / 1024 / 1024).toFixed(2) : undefined,
        "Top RAM container (GB)": top_ram,
        "MCC": location_3gpp?.mcc,
        "MNC": location_3gpp?.mnc,
        "CID": location_3gpp?.cid,
        "LAC": location_3gpp?.lac,
        "TAC": location_3gpp?.tac,
        "Op": modem_3gpp?.["operator-name"],
        "Number": modem_generic?.["own-numbers"]?.join(", "),
        "Sig": modem_generic?.["signal-quality"]?.value,
        "Modem": modem_generic?.state,
        data: entry,
    }
}

function plotTable(entries) {
    entries = entries.map(x => extractTableEntry(x))
    entries.reverse()
    const keys = Object.keys(entries[0]).filter(x => x != "data")
    const thead = TABLE_CONTAINER.querySelector("thead")
    const tbody = TABLE_CONTAINER.querySelector("tbody")
    const header_row = document.createElement("tr")
    thead.appendChild(header_row)
    keys.forEach(key => {
        const th = document.createElement("th")
        th.innerHTML = key
        header_row.appendChild(th)
    })
    let last_tr_data
    entries.forEach((entry, entry_index) => {
        const data = entry.data
        const tr = document.createElement("tr")
        keys.forEach(key => {
            const td = document.createElement("td")
            const value = entry[key]
            td.innerHTML = value == undefined ? "-" : value
            tr.appendChild(td)
            // console.log(key)
            if (key == "Server stamp") {
                const stamp_drift = (new Date(data.stamp) - new Date(data.stamp_server)) * 1e-3
                if (Math.abs(stamp_drift) > 10)
                    tr.style.background = "#ff04"
            }
        })
        // NOTE: Check stamp jump (Now will be used for first row)
        const last_server_stamp = last_tr_data ? new Date(last_tr_data.stamp_server) : new Date()
        const server_stamp_jump = (last_server_stamp - new Date(data.stamp_server)) * 1e-3
        if (Math.abs(server_stamp_jump) > 2000) {
            const tr_jump = document.createElement("tr")
            const td_jump = document.createElement("td")
            td_jump.setAttribute("colspan", 1000)
            td_jump.style.background = "#c00"
            td_jump.style.color = "white"
            td_jump.style.fontWeight = "bold"
            td_jump.innerHTML = `Disconnected for ${toDurationString(server_stamp_jump)}`
            tr_jump.appendChild(td_jump)
            tbody.appendChild(tr_jump)
        }
        tbody.appendChild(tr)
        last_tr_data = data
    })

    // entries.forEach()
    // console.log(entries)
}

async function main() {
    const name = location.search.slice(1)

    APP_BUTTON.addEventListener("click", _ => visit())
    RECORDER_BUTTON.addEventListener("click", _ => visit("recorder"))

    let pathname_paths = location.pathname.split("/").filter(x => x.length).slice(0, -1)
    const device_name = pathname_paths[pathname_paths.length - 1]
    // console.log(pathname_paths)
    // pathname_paths.push("heartbeats")
    // const data_path = `/${pathname_paths.join("/")}`
    const data_path = `/heartbeats/${device_name}`
    const data = await (await fetch(data_path)).text()
    let entries = data.split("\n").map(x => JSON.parse(x))
    entries.sort((a, b) => {
        const comp_first = a.stamp_server.localeCompare(b.stamp_server)
        if (comp_first == 0)
            return a.stamp.localeCompare(b.stamp)
        return comp_first
    })
    entries.forEach(x => {
        x.tegrastats = parseTegraStats(x.tegrastats)
        x.epever = parseEpever(x.epever)
        x.vnstat = parseVnStat(x.vnstat)
        x.docker_stats = parseDockerStats(x.docker_stats)
    })
    // Smooth
    entries.forEach((entry, i) => {
        if (entry.epever) {
            entry.epever.battery_charge_smooth = smooth(
                entries[i - 1]?.epever?.battery_charge_smooth,
                entry?.epever?.battery_charge,
                0.9,
            )
            entry.epever.load_power_smooth = smooth(
                entries[i - 1]?.epever?.load_power_smooth,
                entry?.epever?.load_power,
                0.9,
            )
        }
        if (entry.tegrastats) {
            entry.tegrastats.power_total_smooth = smooth(
                entries[i - 1]?.tegrastats?.power_total_smooth,
                entry?.tegrastats?.power_total,
                0.9,
            )
        }
        const last_entry = entries[i - 1]
        entry.stamp_fixed = entry.stamp_server
        // NOTE: Use edge stamp if server stamp is bad (flush all at once)
        if (last_entry && last_entry.stamp_server == entry.stamp_server)
            entry.stamp_fixed = entry.stamp
    })
    const last_entry = entries[entries.length - 1]
    console.log(last_entry)

    visualiseGeneral(last_entry)
    visualiseCellular(last_entry)
    visualiseTegraStats(last_entry.tegrastats)
    visualiseEpever(last_entry.epever)

    plotGraph(entries, [
        ["Temperature", "°C", "#444", x => x?.tegrastats?.temp_max],
        // ["Monthly transfer", "GB", "#444", x => x?.vnstat?.monthly_all / 1024 / 1024 / 1024],
        ["Battery charge", "%", "#48c", x => x?.epever?.battery_charge_smooth],
        ["Solar power", " W", "#f80", x => x?.epever?.solar_power],
        ["Battery load power", " W", "#0c8", x => x?.epever?.load_power_smooth],
        ["Computer power draw", " W", "#c48", x => x?.tegrastats?.power_total_smooth],
        ["RAM usage", "%", "#cc4", x => x?.tegrastats?.ram_percent],
    ])
    GRAPH_CONTAINER.scrollLeft = 1000000

    plotTable(entries)
}

main()

