// main.js
async function main() {
    const registration = await navigator.serviceWorker?.register("sw.js")
    console.log(registration)
    const a = await registration.periodicSync.register("get-latest-news", { minInterval: 24 * 60 * 60 * 1000 })
    console.log(a)
}

main()