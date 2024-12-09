"use strict"

import { decode } from "./lib/msgpack.min.js"
import { computeLatLon, computeSVY21 } from "./svy21.js"
import * as onemap from "./onemap.js"
import * as polyline from "./polyline.js"
import * as map from "./map.js"

async function GET(url) {
    const binary = url.endsWith(".msgpack")
    return new Promise(resolve => {
        const r = new XMLHttpRequest()
        r.open("GET", url)
        if (binary)
            r.responseType = "arraybuffer"
        r.addEventListener("readystatechange", _ => {
            if (r.readyState == XMLHttpRequest.DONE && r.status == 200)
                resolve(binary ? decode(r.response) : r.responseText)
        })
        r.send()
    })
}

function decompress(data) {
    const tokens = data.shift()
    const keys = data.shift()
    data = data.map(x => Object.fromEntries(keys.map((key, i) => [key, x[i]])))
    data.forEach(x => {
        x.LOT_NO = x.LOT_NO?.join("")
        x.PP_CODE = x.PP_CODE?.map(x => typeof (x) == "number" ? x.toString().padStart(4, 0) : x).join("")
        x.PARKING_PL = x.PARKING_PL.map(x => tokens[x][0].toUpperCase() + tokens[x].slice(1)).join(" ")
        if ("TYPE" in x)
            x.TYPE = x.TYPE.map(x => tokens[x][0].toUpperCase() + tokens[x].slice(1)).join(" ")
    })
    return data
}

function Polygon(lot, color) {
    const polygon_lot = lot.filter(x => x.IS_POLYGON)
    const non_polygon_lot = lot.filter(x => !x.IS_POLYGON)
    const styles = { color: color, weight: 3, fillOpacity: 0.5 }
    return L.layerGroup([
        ...polygon_lot.map(x => L.polygon(x.LatLon, styles).bindTooltip(
            `${x.PP_CODE}#${x.LOT_NO || 0} ${x.PARKING_PL}`,
            { sticky: true },
        )),
        ...non_polygon_lot.map(x => L.circle(x.CENTER, styles).bindTooltip(
            `${x.PP_CODE}#${x.LOT_NO || 0} ${x.PARKING_PL}`,
            { sticky: true },
        )),
    ])
}

const off_street_codes = [
    "A0024", "A0017", "A0046", "A0021", "A0007", "A0035", "A0011", "B0087",
    "B0098", "B0088", "B0032", "B0063", "C0133", "C0148", "C0162", "D0028",
    "D0026", "D0006", "E0027", "E0024", "E0023", "F0032", "G0004", "H0003",
    "H0057", "H0015", "H0004", "H0011", "H0024", "H0022", "J0054", "J0122",
    "J0100", "J0092", "J0055", "J0017", "K0082", "K0121", "K0039", "K0037",
    "K0111", "L0116", "L0064", "L0117", "L0123", "L0107", "L0104", "L0078",
    "L0125", "L0124", "M0084", "M0040", "M0059", "M0078", "M0076", "N0013",
    "N0012", "N0006", "O0028", "P0111", "P0093", "P0094", "P0113", "P0054",
    "P0106", "P0109", "P0033", "P0117", "P0096", "P0013", "Q0006", "Q0008",
    "S0166", "S0020", "S0049", "S0112", "S0055", "S0108", "S0171", "S0150",
    "T0141", "T0140", "T0129", "T0103", "U0036", "U0042", "V0007", "W0055",
    "W0029", "Y0019", "Y0021", "L0072", "O0033", "O0020", "B0006", "C0010",
    "B0009", "D0030", "O0019", "E0007", "A0025", "A0049", "B0005", "B0031",
    "B0023", "B0035", "B0101", "B0082", "B0086", "B0004", "B0099", "C0147",
    "C0151", "C0152", "C0153", "C0154", "C0155", "C0156", "C0119", "D0027",
    "D0029", "E0010", "F0029", "F0011", "F0031", "F0001", "F0022", "F0027",
    "G0037", "H0064", "J0056", "J0099", "J0128", "J0132", "K0032", "K0108",
    "L0058", "L0115", "L0086", "L0118", "M0017", "M0077", "M0079", "M0088",
    "O0005", "O0029", "O0031", "P0075", "P0048", "P0031", "P0103", "P0114",
    "R0037", "R0040", "S0106", "S0109", "S0111", "S0013", "S0151", "T0017",
    "T0001", "T0107", "T0109", "T0131", "T0151", "T0144", "T0148", "T0153",
    "U0040", "U0043", "Y0017", "Y0020", "Z0001",
]

async function selectSearchResult(latlon) {
    map.setDestination(latlon)
    const route_result = await onemap.route(map.current_location, latlon)
    const latlons = polyline.decode(route_result.route_geometry)
    map.setRoute(latlons, route_result, true)
}

async function main() {

    // setTimeout(_ => {
    //     selectSearchResult(1.3352501419996663, 103.8836522767928)
    // }, 500)

    let textfield_timeout
    SEARCH_TEXTFIELD.addEventListener("keydown", async e => {
        if (textfield_timeout)
            clearTimeout(textfield_timeout)
        if (e.key.toLowerCase() == "enter") {
            const value = SEARCH_TEXTFIELD.value
            const results = await onemap.search(value)
            const result = results[0]
            if (result) {
                selectSearchResult([result.LATITUDE, result.LONGITUDE])
                SEARCH_LIST.classList.add("hidden")
                SEARCH_TEXTFIELD.value = onemap.normaliseLocationName(
                    result, { postalcode: false })
                SEARCH_TEXTFIELD.blur()
            }
        }
        else
            textfield_timeout = setTimeout(async _ => {
                // NOTE: use latest value within callback to prevent corruption
                const value = SEARCH_TEXTFIELD.value
                if (!value.length) {
                    SEARCH_LIST.classList.add("hidden")
                    return
                }
                const results = await onemap.search(value)
                if (results.length) {
                    SEARCH_LIST.querySelectorAll("mwc-list-item").forEach(
                        x => x.parentElement.removeChild(x))
                    results.forEach(r => {
                        const item = document.createElement("mwc-list-item")
                        const primary = item.appendChild(document.createElement("span"))
                        const secondary = item.appendChild(document.createElement("span"))
                        secondary.setAttribute("slot", "secondary")
                        item.setAttribute("twoLine", true)
                        primary.innerHTML = onemap.normaliseLocationName(
                            r, { postalcode: false })
                        console.log(r)
                        secondary.innerHTML = r.POSTAL ? `${r.POSTAL}` : `${(+r.LATITUDE).toFixed(6)}, ${(+r.LONGITUDE).toFixed(6)}`
                        SEARCH_LIST.appendChild(item)
                        item.addEventListener("click",
                            async _ => selectSearchResult([r.LATITUDE, r.LONGITUDE]))
                    })
                    SEARCH_LIST.classList.remove("hidden")
                }
                else
                    SEARCH_LIST.classList.add("hidden")
            }, 500)
    })

    const lots = decompress(await GET("lot.msgpack"))
    const code_to_name = {}
    lots.forEach(lot => code_to_name[lot.PP_CODE] = lot.PARKING_PL)
    // const capacity = decompress(await GET("capacity.msgpack"))
    // console.log(capacity.filter(x => x.PARKING_PL.toLowerCase().includes("harrison road")))
    // NOTE: add more metadata
    lots.forEach(x => {
        x.OFF_STREET = off_street_codes.includes(x.PP_CODE)
        x.IS_POLYGON = Array.isArray(x.GEOMETRY[0])
        if (x.IS_POLYGON)
            x.LatLon = x.GEOMETRY.map(xx => computeLatLon(...xx))
        else
            x.LatLon = computeLatLon(...x.GEOMETRY)
        if (x.IS_POLYGON)
            x.CENTER = [
                x.LatLon.reduce((a, b) => a + b[0], 0) / x.LatLon.length,
                x.LatLon.reduce((a, b) => a + b[1], 0) / x.LatLon.length,
            ]
        else
            x.CENTER = x.LatLon
    })
    // const off_street_lots = lots.filter(x => x.OFF_STREET)
    // const off_street_car_lots = off_street_lots.filter(x => x.TYPE == "Car Lots")
    // const off_street_mcycle_lots = off_street_lots.filter(x => x.TYPE == "Mcycle Lots")
    // const off_street_trailer_lots = off_street_lots.filter(x => x.TYPE == "Trailer Lots")
    // const off_street_lorry_lots = off_street_lots.filter(x => x.TYPE == "Lorry Lots")
    const on_street_lots = lots.filter(x => !x.OFF_STREET)
    const on_street_car_lots = on_street_lots.filter(x => x.TYPE == "Car Lots")
    // const on_street_mcycle_lots = on_street_lots.filter(x => x.TYPE == "Mcycle Lots")
    // const on_street_trailer_lots = on_street_lots.filter(x => x.TYPE == "Trailer Lots")
    const on_street_lorry_lots = on_street_lots.filter(x => x.TYPE == "Lorry Lots")

    // const enable_polygons = []
    // const cluster_color = "#4488cc"

    // const clusters = JSON.parse(await GET("clusters.json"))

    // const clusters_layer = L.layerGroup(
    //     clusters.map(([vertices, pp_codes]) => {
    //         const polygon = L.polygon(
    //             vertices.map(vertex => computeLatLon(...vertex)),
    //             { color: cluster_color, weight: 2, fillOpacity: 0.3, dashArray: "4,4", },
    //         )
    //         const text = `${code_to_name[pp_codes[0]]} (${pp_codes.length})`
    //         polygon.bindTooltip(text, { permanent: true, direction: "center" })
    //         return polygon
    //     })
    // )
    // enable_polygons.push()
    // enable_polygons.push(...[
    // ])

    const disable_polygons = [
        [`Street car ${on_street_car_lots.length}`, Polygon(on_street_car_lots, "red")],
        [`Street lorry ${on_street_lorry_lots.length}`, Polygon(on_street_lorry_lots, "purple")],
        // [`Street trailer ${on_street_trailer_lots.length}`, Polygon(on_street_trailer_lots, "orange")],
        // [`Street mcycle ${on_street_mcycle_lots.length}`, Polygon(on_street_mcycle_lots, "black")],
        // [`Off street car ${off_street_car_lots.length}`, Polygon(off_street_car_lots, "red")],
        // [`Off street lorry ${off_street_lorry_lots.length}`, Polygon(off_street_lorry_lots, "purple")],
        // [`Off street trailer ${off_street_trailer_lots.length}`, Polygon(off_street_trailer_lots, "orange")],
        // [`Off street mcycle ${off_street_mcycle_lots.length}`, Polygon(off_street_mcycle_lots, "black")],
        // [`Clusters ${clusters.length}`, clusters_layer],
    ]

    const all_polygons = [
        ...disable_polygons,
        ["PATF hot spots", L.layerGroup([
            L.marker([1.27612, 103.83612706981091]), // blair road
            L.marker([1.27488, 103.84383721135659]), // tras street
            L.marker([1.28087, 103.84173034155222]), // keong saik road
            L.marker([1.28000, 103.84074]), // teo hong road
            L.marker([1.30344, 103.83811486144701]), // hullet road
            L.marker([1.30981, 103.85468]), // lembu road
            L.marker([1.30332, 103.86076997428489]), // jalan sultan/ aliwal street
            L.marker([1.30479, 103.85866]), // jalan kubor (victoria street)
            L.marker([1.30383, 103.85934]), // jalan kubor (north bridge)
            L.marker([1.30520, 103.85378]), // perak road (upper weld road)
            L.marker([1.31581, 103.85773]), // race course road
            L.marker([1.31271, 103.86594]), // kallang avenue
            L.marker([1.31366, 103.90065]), // tembeling road
            L.marker([1.30768, 103.90489]), // tembeling road #79 
            L.marker([1.32731, 103.84916]), // jalan rama rama (balestier road)
            L.marker([1.32843, 103.87500]), // genting road
            L.marker([1.37495, 103.96937]), // loyang street
            L.marker([1.28065, 103.8458637]), // ann siang road
        ])]
    ]


    L.control.layers(Object.fromEntries(map.tile_layers), Object.fromEntries(all_polygons)).addTo(map.map)


}

main()

LOCATION_BUTTON.addEventListener("click", _ => map.locate())
// LOCATION_BUTTON.click()


// DRIVE_BUTTON.addEventListener("click", async _ => {
//     const route_result = await onemap.route(
//         map.current_location, map.destination)
//     const latlons = polyline.decode(route_result.route_geometry)
//     map.setRoute(latlons, route_result, true)
// })

LINK_BUTTON?.addEventListener("click", _ => {
    const d = map.destination
    window.open(`https://maps.google.com/?q=${d.lat},${d.lng}`, "_blank").focus()
})

WAZE_BUTTON?.addEventListener("click", _ => {
    const d = map.destination
    window.open(`https://www.waze.com/ul?ll=${d.lat},${d.lng}`, "_blank").focus()
})