"use strict"

const api_root = "/mev2/api"

const response_cache = {}
const labels = {}
const tasks = {}

function getCSRFToken() {
    return Object.fromEntries(document.cookie.split(";")
        .map(x => x.split("=").map(y => y.trim()))).csrftoken
}

export function POST(url, data) {
    console.log(`POST ${url}`)
    return fetch(`${api_root}/${url}`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "X-CSRFTOKEN": getCSRFToken(),
        },
        body: JSON.stringify(data),
    })
}

export async function GET(url) {
    if (!(url in response_cache)) {
        console.log(`GET ${url}`)
        let url_fixed = url.startsWith("http") ? url : `${api_root}/${url}`
        url_fixed = url_fixed.replace("http://", "https://")
        const response = await fetch(url_fixed, { method: "GET" })
        response_cache[url] = await response.json()
    }
    return response_cache[url]
}

export async function getUsers() {
    return (await GET("users?page_size=1000")).results
}
