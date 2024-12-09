"use strict"

const EDITABLE_FIELDS = ["remark", "package", "shipment", "weight"]

function dataCallback(data) {
    data.stamp = new Date().toISOString()
    data.v = (data.w * data.h * data.l).toFixed(6)
    for (const key in data) {
        if (["w", "h", "l"].includes(key))
            data[key] = +data[key].toFixed(2)
    }
    data.shipment = SHIPMENT_ID.value
    const tr = document.createElement("tr")
    tr.classList.add("mdc-data-table__row")
    Array.from(DATA_TABLE.querySelectorAll("th")).forEach(th => {
        const is_numeric = th.classList.contains("mdc-data-table__header-cell--numeric")
        const name = th.getAttribute("name")
        const td = document.createElement("td")
        td.classList.add("mdc-data-table__cell")
        if (is_numeric)
            td.classList.add("mdc-data-table__cell--numeric")
        td.setAttribute("name", name)
        if (name in data) {
            const value = data[name]
            let child = undefined
            if (name == "image") {
                child = document.createElement("img")
                child.src = `data:image/jpg;base64,${value}`
                const dialog_image = child.cloneNode()
                td.addEventListener(
                    "click", _ => showDialog(null, dialog_image))
            }
            else if (name == "stamp") {
                const date = new Date(value)
                child = document.createTextNode(date.toLocaleString("default", {
                    month: "short", day: "numeric",
                    hour: "numeric", minute: "numeric", second: "numeric",
                }))
            }
            else
                child = document.createTextNode(value)
            td.value = is_numeric ? +value : value
            td.appendChild(child)
        }
        // Editable field
        if (EDITABLE_FIELDS.includes(name)) {
            const text_nodes = Array.from(td.childNodes).filter(x => x.nodeType == Node.TEXT_NODE)
            const text_node = text_nodes.length ? text_nodes[0] : document.createTextNode("")
            td.addEventListener("click", async function () {
                const input = document.createElement("mwc-textfield")
                input.setAttribute("outlined", true)
                input.value = text_node.nodeValue
                input.setAttribute("label", th.innerHTML)
                if (is_numeric) {
                    input.setAttribute("type", "number")
                    input.setAttribute("min", 0)
                    input.setAttribute("step", 0.001)
                }
                showDialog(null, input, function () {
                    if (input.checkValidity()) {
                        let value = input.value
                        if (is_numeric)
                            value = +value
                        text_node.nodeValue = value
                        td.value = value
                        return true
                    }
                    else {
                        input.reportValidity()
                        input.focus() // NOTE: so that keyboard wont jump
                        return false
                    }
                })
                setTimeout(function () {
                    // NOTE: must be in this order
                    input.focus()
                    input.select()
                }, 0)
            })
            td.appendChild(text_node)
        }
        if (name == "actions") {
            const delete_button = document.createElement("mwc-icon-button")
            delete_button.setAttribute("icon", "delete")
            delete_button.addEventListener("click", function () {
                const img = document.createElement("img")
                img.src = `data:image/jpg;base64,${data.image}`
                showDialog("Remove?", img, function () {
                    tbody.removeChild(tr)
                    return true
                })
            })
            td.appendChild(delete_button)
        }
        tr.appendChild(td)
    })
    const tbody = DATA_TABLE.querySelector("tbody")
    // tbody.insertBefore(tr, tbody.firstChild)
    tbody.appendChild(tr)
}

class DataParser {
    static text_decoder = new TextDecoder()
    constructor(callback) {
        this.buffer = undefined
        this.callback = callback
    }
    parse(data_view) {
        const offset = data_view.getUint32(0, true)
        const length = data_view.getUint32(4, true)
        if (!this.buffer || this.buffer.length != length)
            this.buffer = new Uint8Array(length)
        this.buffer.set(new Uint8Array(data_view.buffer.slice(8)), offset)
        if (offset + data_view.byteLength - 8 == length) {
            const decoded = DataParser.text_decoder.decode(this.buffer)
            dataCallback(JSON.parse(decoded))
            this.buffer = undefined
        }
    }
}

const SERVICE_UUID = "840230cf-e366-49a9-b80f-8f9531b257e7"
const CHARACTERISTIC_UUID = "9e04277f-e076-433c-9623-772cc263db5e"

async function connect(device) {
    const server = await device.gatt.connect()
    showSnackbar(`Connected ${device.name}`)
    const service = await server.getPrimaryService(SERVICE_UUID)
    const c = await service.getCharacteristic(CHARACTERISTIC_UUID)
    c.startNotifications()
    const parser = new DataParser()
    c.addEventListener("characteristicvaluechanged",
        e => parser.parse(e.target.value))
}

CONNECT_BUTTON.addEventListener("click", async function () {
    if (!navigator.bluetooth || !await navigator.bluetooth.getAvailability()) {
        showSnackbar("Bluetooth not available")
        return
    }
    // NOTE: forget old devices so new device can autoconnect
    const devices = await navigator.bluetooth.getDevices()
    devices.forEach(device => device.forget())
    const options = {
        filters: [
            { services: [SERVICE_UUID] },
            { namePrefix: "V3" },
        ],
    }
    const device = await navigator.bluetooth.requestDevice(options)
    connect(device)
})

function showDialog(heading, body, action = undefined) {
    const dialog = document.querySelector("mwc-dialog")
    dialog.removeAttribute("heading")
    if (heading)
        dialog.setAttribute("heading", heading)
    const div = dialog.querySelector("div")
    div.innerHTML = ""
    if (body)
        div.appendChild(typeof body == "string" ? document.createTextNode(body) : body)
    const confirm_button = dialog.querySelector("mwc-button:not([dialogAction])")
    const dismiss_button = dialog.querySelector("mwc-button[dialogAction=close]")
    confirm_button.removeEventListener("click", confirm_button.listener)
    confirm_button.listener = _ => { if (action()) dialog.close() }
    if (action) {
        confirm_button.setAttribute("slot", "primaryAction")
        confirm_button.innerHTML = "Confirm"
        dismiss_button.innerHTML = "Cancel"
        confirm_button.addEventListener("click", confirm_button.listener)
    }
    else {
        confirm_button.setAttribute("slot", undefined)
        dismiss_button.innerHTML = "Dismiss"
    }



    dialog.show()
}

function showSnackbar(text) {
    const snackbar = document.querySelector("mwc-snackbar")
    snackbar.labelText = text
    snackbar.show()
}

SETUP_BUTTON.addEventListener("click", async function () {
    if (!navigator.bluetooth)
        showSnackbar("Bluetooth not available")
    else if (!navigator.bluetooth.getDevices) {
        await navigator.clipboard.writeText(
            "chrome://flags/#enable-experimental-web-platform-features")
        showSnackbar("Paste URL in chrome to enable BLE features")
    }
    else if (!BluetoothDevice.prototype.watchAdvertisements) {
        await navigator.clipboard.writeText(
            "chrome://flags/#enable-web-bluetooth-new-permissions-backend")
        showSnackbar("Paste URL in chrome to enable BLE backend")
    }
    else
        showSnackbar("Setup successful")
})

SEND_BUTTON.addEventListener("click", function () {
    const tr = Array.from(DATA_TABLE.querySelectorAll("tbody tr"))
    const total_volume = tr.reduce((a, b) => a + b.querySelector("td[name=v]").value, 0)
    console.log(total_volume)
    showDialog(
        `Submit ${tr.length} entries?`,
        `Total volume ${total_volume.toFixed(3)} m³`,
        function () {
            showSnackbar("Sending")
        })
})

function sleep(timeout) { return new Promise((r) => setTimeout(r, timeout)) }

document.querySelectorAll("th").forEach(function (th) {
    const name = th.getAttribute("name")
    const tbody = document.querySelector("tbody")
    th.addEventListener("click", function () {
        th.order = !th.order
        const tds = Array.from(document.querySelectorAll(`td[name=${name}]`))
        tds.sort(function (a, b) {
            a = a.value
            b = b.value
            // undefined to lowest priority regardless of order
            if (a == undefined)
                return 0
            else if (b == undefined)
                return -1
            // sort by order
            else if (th.order) {
                if (a && a.localeCompare)
                    return a.localeCompare(b)
                else
                    return a - b
            }
            else {
                if (b && b.localeCompare)
                    return b.localeCompare(a)
                else
                    return b - a
            }
        })
        tds.forEach(td => tbody.appendChild(td.closest("tr")))
    })
})

function randomBase64JPEG(width, height) {
    const canvas = document.createElement("canvas")
    canvas.width = width
    canvas.height = height
    const context = canvas.getContext("2d")
    const image_data = context.getImageData(0, 0, width, height)
    const data = image_data.data
    data.forEach((d, i) => data[i] = Math.random() * 255)
    context.putImageData(image_data, 0, 0)
    return canvas.toDataURL("image/jpg").split(",")[1]
}

async function main() {
    // for (var i = 0; i < 20; ++i)
    //     dataCallback({
    //         image: randomBase64JPEG(320, 240),
    //         w: Math.random() + 0.5,
    //         h: Math.random() + 0.5,
    //         l: Math.random() + 0.5,
    //     })

    if (navigator.bluetooth) {
        const devices = await navigator.bluetooth.getDevices()
        if (devices.length) {
            const device = devices[0]
            showSnackbar(`Re-connecting ${device.name}`)
            const controller = new AbortController()
            device.addEventListener("advertisementreceived", function () {
                controller.abort()
                connect(device)
            })
            device.watchAdvertisements({ signal: controller.signal })
        }
    }
}

main()