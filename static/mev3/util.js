"use strict"

import { getUsers } from "./api.js"

const fade_duration = 250

export function generateUID() { return Math.random().toString(16).slice(2) }

export function animateFadeIn(x) {
    return x.animate(
        [{ opacity: 1 }],
        { duration: fade_duration, fill: "forwards" },
    )
}
export function animateFadeOut(x) {
    return x.animate(
        [{ opacity: 0 }],
        { duration: fade_duration, fill: "forwards" },
    )
}

export async function getValidator(x) {
    try {
        const validator_id = JSON.parse(x.bug_tracker).validators[x.id]
        for (const user of await getUsers())
            if (user.id == validator_id) return user
    }
    catch { }
}

export function onLongHover(element, callback) {
    // NOTE: To prevent callback from firing again if mouse is still in
    let triggered = false
    let timer
    function startTimeout() {
        clearTimeout(timer)
        if (!triggered)
            timer = setTimeout(_ => {
                triggered = true
                callback()
            }, 500)
    }
    element.addEventListener("pointermove", async _ => startTimeout())
    element.addEventListener("pointerleave", async _ => {
        clearTimeout(timer)
        triggered = false
    })
    element.addEventListener("touchstart", async _ => startTimeout())
    element.addEventListener("touchend", async _ => clearTimeout(timer))
    element.addEventListener("contextmenu", e => e.preventDefault())
}


export function positionToCamera(x0, y0, x1, y1) {
    x1 = x1 ?? x0 // sometimes is NaN
    y1 = y1 ?? y0 // sometimes is NaN
    const iw = 2560
    const ih = 1440
    const px0 = x0 * 2 / iw
    const py0 = y0 * 2 / ih
    const px1 = x1 * 2 / iw
    const py1 = y1 * 2 / ih
    const cx = (px1 + px0) / 2
    const cy = (py1 + py0) / 2
    if (cy < 1)
        return [px0 - 0.5, py0, px1 - 0.5, py1, 0]
    else if (cx < 1)
        return [px0, py0 - 1, px1, py1 - 1, 1]
    else
        return [px0 - 1, py0 - 1, px1 - 1, py1 - 1, 2]
}

function divmod(x, y) { return [Math.floor(x / y), x % y] }

export function toDurationString(x, limit) {
    if (x instanceof Date)
        x = +x * 1e-3
    let parts = []
    if (x > (3600 * 24)) {
        let [days, r] = divmod(x, (3600 * 24))
        parts.push(`${days} day${days > 1 ? "s" : ""}`)
        x = r
    }
    if (x > 3600) {
        let [hours, r] = divmod(x, 3600)
        parts.push(`${hours} hr${hours > 1 ? "s" : ""}`)
        x = r
    }
    if (x > 60) {
        let [minutes, r] = divmod(x, 60)
        parts.push(`${minutes} min${minutes > 1 ? "s" : ""}`)
        x = r
    }
    if (x > 0) {
        x = Math.round(x)
        parts.push(`${x} sec${x > 1 ? "s" : ""}`)
    }
    if (limit)
        parts = parts.slice(0, limit)
    return parts.join(" ")
}

export function simplifyLabelName(x) {
    return x
        .replace("ParkingAgainst", "PA")
        .replace("HeavyVehicle", "HV")
        .replace("OutOfBoundary", "OOB")
        .replace("SingleContinuousWhiteLine", "SCWL")
        .replace("TrafficFlow", "TF")
        .replace("DoubleYellowLine", "DYL")
}

export function isVisible(element) {
    return getComputedStyle(element).display != "none"
}

export function removeExtension(x) { return x.replace(/\.[^/.]+$/, "") }