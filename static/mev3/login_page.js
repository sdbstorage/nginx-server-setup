"use strict"

import { GET, POST } from "./api.js"
import { } from "./app_page.js" // NOTE: Preload AppPage methods

customElements.define("login-page", class extends HTMLElement {

    constructor() {
        super()

        const shadow = this.attachShadow({ mode: "open" })
        shadow.innerHTML = `
<md-dialog>
    <div slot=content style="display:flex;flex-direction:column;gap:16px">
        <md-filled-text-field name=username>
            <md-icon slot=leading-icon>person</md-icon>
        </md-filled-text-field>
        <md-filled-text-field type=password name=password>
            <md-icon slot=leading-icon>key</md-icon>
        </md-filled-text-field>
    </div>
</md-dialog>
        `
        const dialog = this.dialog = shadow.querySelector("md-dialog")
        dialog.addEventListener("cancel", e => e.preventDefault())

        dialog.show()
        const app_page = document.querySelector("app-page")

        async function onLoginSuccess() {
            await dialog.close().finished
            app_page.show()
        }

        dialog.addEventListener("keydown", async e => {
            if (e.key == "Enter") {
                if (dialog.open) {
                    const text_fields = Array.from(dialog.querySelectorAll("md-filled-text-field"))
                    const data = Object.fromEntries(text_fields.map(x => [x.name, x.value]))
                    const response = await POST("auth/login", data)
                    if (response.status == 200)
                        onLoginSuccess()
                    else
                        console.log("NOPE")
                }
            }
        })

        async function autoLogin() {
            const response = await GET("users/self")
            if (response.id) onLoginSuccess()
        }
        autoLogin()

    }

    show() { return this.dialog.show() }
    hide() { return this.dialog.close() }
    clear() {
        this.dialog.querySelectorAll("md-filled-text-field").forEach(x => x.value = "")
    }
})