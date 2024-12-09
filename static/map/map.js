"use strict"

import * as onemap from "./onemap.js"
import { computeLatLon, computeSVY21 } from "./svy21.js"

export const map = L.map(MAP, {
    center: L.latLng(1.335, 103.883),
    zoom: 19,
    zoomControl: false,
})

export let current_location = [1.3350335183975575, 103.88367773625117]
export let current_route = []

async function GET(url) {
    return new Promise(resolve => {
        const r = new XMLHttpRequest()
        r.open("GET", url)
        r.addEventListener("readystatechange", _ => {
            if (r.readyState == XMLHttpRequest.DONE && r.status == 200)
                resolve(r.responseText)
        })
        r.send()
    })
}

map.setMaxBounds(L.latLngBounds(
    L.latLng(1.2, 103.5),
    L.latLng(1.5, 104.1),
))

map.on("zoomend", function () {
    const zoom = map.getZoom()
    // console.log(zoom)
    // location_circle.setRadius(location_circle_radius)
    // map.eachLayer(layer => {
    //     if (layer instanceof L.Polygon || layer instanceof L.Circle)
    //         if (layer.options.color != cluster_color)
    //             layer.setStyle({ weight: zoom >= 18 ? 1 : 4 })
    // })
})
L.control.scale({ imperial: false, maxWidth: 128, position: "bottomright" }).addTo(map)

L.control.zoom({ position: "bottomright" }).addTo(map)

const tile_options = {
    minZoom: 12, maxZoom: 20, maxNativeZoom: 19,
    attribution: `
    <div style="display: flex; align-items: center; gap: 4px; ">
        <img src=https://www.onemap.gov.sg/web-assets/images/logo/om_logo.png style="height:16px"/>
        <a href=https://www.onemap.gov.sg target=_blank>OneMap</a>
        by
        <a href=https://www.sla.gov.sg target=_blank>SLA</a>
    </div>
    `,
}
map.attributionControl.setPrefix()
const tile_host = "https://www.onemap.gov.sg/maps/tiles"
const gray_tile = L.tileLayer(`${tile_host}/Grey/{z}/{x}/{y}.png`, tile_options)
const default_tile = L.tileLayer(`${tile_host}/Default/{z}/{x}/{y}.png`, tile_options)
const night_tile = L.tileLayer(`${tile_host}/Night/{z}/{x}/{y}.png`, tile_options)

export const tile_layers = [
    ["Gray", gray_tile],
    ["Original", default_tile],
    ["Night", night_tile],
]
gray_tile.addTo(map)

const destination_marker = L.marker([0, 0])

const route_polyline = L.polyline([], { weight: 5, color: "white", opacity: 0.5 })
const route_polyline0 = L.polyline([], { weight: 10, color: "#4488cc", opacity: 0.8 })


export let destination = null
export async function setDestination(latlon, pan = false) {
    destination = latlon
    destination_marker.unbindTooltip()
    destination_marker.setLatLng(latlon)
    if (pan)
        map.panTo(latlon)
    LINK_BUTTON.classList.remove("hidden")
    WAZE_BUTTON.classList.remove("hidden")
    // NOTE: others will still work even if revgeocode fails
    const geocode = await onemap.revgeocode2(
        [latlon.lat, latlon.lng], { postalcode: false })
    if (geocode)
        destination_marker.bindTooltip(
            geocode,
            { permanent: true, direction: "bottom", offset: [-14, 32] },
        )
    // NOTE: Enable drive only when onemap services is available
    // DRIVE_BUTTON.classList.remove("hidden")
}

export function divmod(x, d) { return [Math.floor(x / d), x % d] }

export function setRoute(latlons, route, pan = false) {
    console.log(route)
    route_polyline0.setLatLngs(latlons)
    route_polyline.setLatLngs(latlons)
    const total_distance = route.route_summary.total_distance
    const total_time = route.route_summary.total_time
    const time_strings = []
    let [hr, hr_remainder] = divmod(total_time, 3600)
    let [min, min_remainder] = divmod(hr_remainder, 60)
    if (hr > 0)
        time_strings.push(`${hr} hr`)
    else
        time_strings.push(`${Math.max(1, min)} min`)
    const distance_string = `${(total_distance / 1000).toFixed(1)} km`
    const time_string = time_strings.join(" ")
    route_polyline.unbindTooltip()
    route_polyline.bindTooltip(`${time_string}, ${distance_string}`, { permanent: true, direction: "center" })
    route_polyline.redraw()
    if (pan)
        map.fitBounds(route_polyline.getBounds())
}

route_polyline0.addTo(map)
route_polyline.addTo(map)

destination_marker.addTo(map)

const editable_layers = new L.FeatureGroup()
map.addLayer(editable_layers)

const polygon_options = {
    color: "#80f", weight: 2, fillOpacity: 0.1, dashArray: "4,4",
}

const editable = window.location.search.slice(1).split("&").includes("edit")

let original_event = null // NOTE: to keep track of event propagation
let edit_target = null

function addLayer(layer) {
    editable_layers.addLayer(layer)
    if (editable)
        layer.on("click", e => {
            e.target.editing.enable()
            original_event = e.originalEvent
            edit_target = e.target
        })
}

async function loadPolygons() {
    const polygons = JSON.parse(await GET("api/polygon"))
    polygons.forEach(polygon => {
        const layer = L.polygon(polygon, polygon_options)
        // polygon.bindTooltip(text, { permanent: true, direction: "center" })
        addLayer(layer)
    })
}
loadPolygons()

if (editable) {

    async function POST(url, data) {
        return new Promise(resolve => {
            const r = new XMLHttpRequest()
            r.open("POST", url)
            r.addEventListener("readystatechange", _ => {
                if (r.readyState == XMLHttpRequest.DONE && r.status == 200)
                    resolve(r.responseText)
            })
            r.send(JSON.stringify(data))
        })
    }

    async function savePolygons() {
        const vertices = []
        editable_layers.eachLayer(layer => {
            vertices.push(layer.getLatLngs()[0].map(x => [x.lat, x.lng]))
        })
        await POST("api/polygon", vertices)
    }

    map.addControl(new L.Control.Draw({
        position: "topright",
        draw: {
            polygon: { shapeOptions: polygon_options },
            polyline: false,
            circle: false,
            rectangle: false,
            marker: false,
            circlemarker: false,
        },
    }))


    map.on("click", e => {
        if (original_event && original_event.target == e.originalEvent.target) { }
        else if (edit_target) {
            edit_target.editing.disable()
            edit_target = null
        }
    })

    map.on(L.Draw.Event.EDITVERTEX, _ => savePolygons())
    map.on(L.Draw.Event.CREATED, e => {
        addLayer(e.layer)
        savePolygons()
        if (edit_target)
            editable_layers.removeLayer(edit_target)
    })
    window.addEventListener("keydown", e => {
        const key = e.key.toLowerCase()
        if (key == "delete")
            if (edit_target) {
                editable_layers.removeLayer(edit_target)
                savePolygons()
            }
    })
}

export function setCurrentLocation(latlon, radius) {
    current_location = latlon
    current_location_marker.setLatLng(latlon)
    current_location_radius.setLatLng(latlon)
    current_location_radius.setRadius(radius || 0)
}

/************
 * LOCATION *
 ************/

const current_location_icon = L.divIcon({
    className: "",
    iconAnchor: [0, 0],
    html: `
    <svg overflow=visible style="filter: drop-shadow(0 0 4px #0008); opacity: 0.8">
        <circle cx=0 cy=0 r=12 fill=#48c stroke=white stroke-width=3 />
        <!-- <path d="M0 0 L16 8 L0 -24 L-16 8 Z" fill=#48c stroke=white stroke-width=3 /> -->
    </svg>
`
})
const current_location_marker = L.marker(
    [0, 0],
    { icon: current_location_icon },
)
const current_location_radius = L.circle(
    current_location, 0,
    { fillColor: "#4488cc", weight: 0, fillOpacity: 0.15 },
)

current_location_radius.addTo(map)
current_location_marker.addTo(map)

map.on("locationfound", e => {
    LOCATION_BUTTON.setAttribute("icon", "my_location")
    setCurrentLocation(e.latlng, e.accuracy)
    // const geocode = await onemap.revgeocode([location.lat, location.lng])
    // let text
    // if (geocode.BUILDINGNAME)
    //     text = `${geocode.BUILDINGNAME}, ${geocode.ROAD}, ${geocode.POSTALCODE}`
    // else if (geocode.BLOCK)
    //     text = `BLK ${geocode.BLOCK}, ${geocode.ROAD}, ${geocode.POSTALCODE}`
    // else if (geocode.ROAD)
    //     text = `${geocode.ROAD}, ${geocode.POSTALCODE}`
    // if (text)
    //     location_circle.setTooltipContent(text)
    // map.fitBounds(e.bounds)
    // map.panTo(e.latlng)
})

export function locate() { map.panTo(current_location) }

map.locate({ watch: true })

// export function stopLocate() {

//     setCurrentLocation(null, 0)
// }


map.on("click", e => setDestination(e.latlng))

export function startSimulate() {

}