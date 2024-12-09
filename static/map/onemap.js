"use strict"

import * as turf from "./lib/turf.min.js"

const auth = "\
eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJzdWIiOiI3NmExN2MzOWFjYzF\
iYzM4NDFkOTIzOWU2ZWZmZmRlNyIsImlzcyI6Imh0dHA6Ly9pbnRlcm5hbC1hbGI\
tb20tcHJkZXppdC1pdC0xMjIzNjk4OTkyLmFwLXNvdXRoZWFzdC0xLmVsYi5hbWF\
6b25hd3MuY29tL2FwaS92Mi91c2VyL3Bhc3N3b3JkIiwiaWF0IjoxNjk0MTYzMTI\
4LCJleHAiOjE2OTQ0MjIzMjgsIm5iZiI6MTY5NDE2MzEyOCwianRpIjoieGhrak9\
TT3VQMkM4UFhFdCIsInVzZXJfaWQiOjcwNCwiZm9yZXZlciI6ZmFsc2V9.Dd8VqN\
OL4rSnPJl6DxZDuwEVs2S1ei3mbjfNVdqqugs="

// const host = "https://www.onemap.gov.sg"
const host = "."

async function GET(url) {
    // console.log(url)
    return new Promise(resolve => {
        const r = new XMLHttpRequest()
        r.open("GET", url)
        if (url.includes("/api/public/"))
            r.setRequestHeader("Authorization", auth)
        r.addEventListener("readystatechange", _ => {
            if (r.readyState == XMLHttpRequest.DONE)
                if (r.status == 200)
                    resolve(r.responseText)
                else
                    console.warn(r.responseText)
        })
        r.send()
    })
}

function normaliseLatLng(x) {
    if (Array.isArray(x))
        return x.join(",")
    else
        return `${x.lat},${x.lng}`
}

function toCamelCase(x) {
    if (/^\d.*$/.test(x)) // 123A
        return x
    if (/^[^aeiou]+$/.test(x.toLowerCase())) // SMRT
        return x
    return x.split(" ").map(x => x[0].toUpperCase() + x.slice(1).toLowerCase()).join(" ")
}

export async function search(search_val) {
    const url = `${host}/api/common/elastic/search`
    const response = await GET(`${url}?searchVal=${search_val}&returnGeom=Y&getAddrDetails=Y`)
    const results = JSON.parse(response).results || []
    results.map(result => {
        Object.entries(result).forEach(([k, v]) => {
            if (v == "NIL" || v == "") result[k] = null
        })
        // normalise address
        const parts = result.ADDRESS.split(" ")
        if (parts[parts.length - 2] == "SINGAPORE")
            parts.splice(-2, 1)
        result.ADDRESS = parts.join(" ")
    })
    return results
}

export async function route(start, end) {
    start = normaliseLatLng(start)
    end = normaliseLatLng(end)
    const url = `${host}/api/public/routingsvc/route`
    const response = await GET(
        `${url}?start=${start}&end=${end}&routeType=drive`,
    )
    const results = JSON.parse(response) || []
    return results
}


export async function revgeocode(location) {
    const url = `${host}/api/public/revgeocode`
    const response = await GET(`${url}?location=${location.join(",")}&buffer=500`)
    const results = JSON.parse(response)
    return results?.GeocodeInfo[0]
}

function isNULL(x) { return !x || x.toLowerCase() == "null" || x.toLowerCase() == "nil" }

export function normaliseLocationName(x, { postalcode = true } = {}) {
    console.log(x)
    if (!x)
        return x
    let texts = []
    if (!isNULL(x.BUILDINGNAME))
        texts.push(x.BUILDINGNAME)
    else if (!isNULL(x.BUILDING))
        texts.push(x.BUILDING)
    else if (!isNULL(x.BLOCK)) // exclusive
        texts.push(`BLK ${x.BLOCK}`)
    else if (!isNULL(x.BLK_NO))
        texts.push(`BLK ${x.BLK_NO}`)
    if (!isNULL(x.ROAD))
        texts.push(x.ROAD)
    else if (!isNULL(x.ROAD_NAME))
        texts.push(x.ROAD_NAME)
    if (postalcode)
        if (!isNULL(x.POSTALCODE))
            texts.push(x.POSTALCODE)
        else if (!isNULL(x.POSTAL))
            texts.push(x.POSTAL)
    let text = texts.map(x => x.split(" ").map(
        xx => toCamelCase(xx.replace(/[\(\)]/g, ""))).join(" ")).join(", ")
    return text
}

export async function revgeocode2(location, kwargs) {
    const geocode = (await revgeocode(location))
    return normaliseLocationName(geocode, kwargs)
}