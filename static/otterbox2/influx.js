"use strict"

const token = "MrWrPtP6PiF-jryd7KGQgCQZjLnknJnCu_zrf53IcqFqTJ9Qq87A0CjhlpjoMPvFKM_yXobR3LBHd0Q-20tbMw=="

export async function query(body) {
    const response = await fetch(
        "https://ai.v3nity.com/influx/api/v2/query?org=v3", {
        method: "POST",
        headers: {
            "Content-type": "application/vnd.flux",
            "Authorization": `Token ${token}`,
        },
        body: body,
    })

    const text = await response.text()
    if (response.status == 400)
        console.warn(text)
    const csv_lines = text.trim().split("\n").map(x => x.trim().split(","))
    const [header, ...rows] = csv_lines
    return rows.map(x => Object.fromEntries(header.map((h, i) => [h, x[i]])
        .filter(([k, v]) => !["", "table"].includes(k))))
}

export async function get(device, ...keys) {
    const field_filter = keys.map(k => `r["_field"] == "${k}"`).join(" or ")
    const result = await query(`
        from(bucket:"heartbeat") 
        |> range(start:-7d)
        |> filter(fn: (r) => ${field_filter})
        |> filter(fn: (r) => r["device"] == "${device}")
        |> aggregateWindow(every: 15m, fn: max)
        |> yield(name: "max")
    `)
    let entries = {}
    result.forEach(x => {
        if (!keys.includes(x._field) || x._value == "")
            return
        entries[x._field] = entries[x._field] || []
        entries[x._field].push([new Date(x._time), +x._value])
    })
    Object.values(entries).forEach(x => x.sort((a, b) => a[0] - b[0]))
    return entries
}