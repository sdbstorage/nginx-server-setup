"use strict"

export function decode(encodedPolyline) {
    let points = []
    let index = 0
    const len = encodedPolyline.length
    let lat = 0
    let lng = 0
    while (index < len) {
        let b
        let shift = 0
        let result = 0
        do {
            b = encodedPolyline.charAt(index++).charCodeAt(0) - 63
            result |= (b & 0x1f) << shift
            shift += 5
        } while (b >= 0x20)
        lat += ((result & 1) !== 0 ? ~(result >> 1) : (result >> 1))
        shift = 0
        result = 0
        do {
            b = encodedPolyline.charAt(index++).charCodeAt(0) - 63
            result |= (b & 0x1f) << shift
            shift += 5
        } while (b >= 0x20)
        lng += ((result & 1) !== 0 ? ~(result >> 1) : (result >> 1))
        let location = [(lat / 1E5), (lng / 1E5)]
        points.push(location)
    }
    return points
}