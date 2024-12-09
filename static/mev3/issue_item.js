"use strict"

import { GET, POST } from "./api.js"
import { animateFadeIn, positionToCamera, toDurationString } from "./util.js"

export class IssueItem extends HTMLElement {

    constructor() {
        super()

        const shadow = this.attachShadow({ mode: "open" })
        shadow.innerHTML = `
            <md-list-item href=#>
                <canvas slot=start width=128 height=72 style="background: #0001"></canvas>
                <div slot=overline>Overline</div>
                <div slot=headline>Headline</div>
                <div slot=supporting-text></div>
                <div slot="trailing-supporting-text"></div>
            </md-list-item>
        `
        this.style.opacity = 0
        animateFadeIn(this)
    }

    async setup(result) {

        const list_item = this.shadowRoot.querySelector("md-list-item")
        const canvas = list_item.querySelector("canvas")
        const overline = list_item.querySelector("[slot=overline]")
        const headline = list_item.querySelector("[slot=headline]")
        const supporting_text = list_item.querySelector("[slot=supporting-text]")
        const trailing_supporting_text = list_item.querySelector("[slot=trailing-supporting-text]")

        const image = new Image()
        image.addEventListener("load", _ => {
            const context = canvas.getContext("2d")
            const iw = image.width
            const ih = image.height
            const [x0, y0, x1, y1, camera_index] = positionToCamera(...result.position)
            const cw = canvas.width
            const ch = canvas.height
            let offsets = [iw / 4, 0, iw / 2, ih / 2]
            if (camera_index == 1)
                offsets = [0, ih / 2, iw / 2, ih / 2]
            else if (camera_index == 2)
                offsets = [iw / 2, ih / 2, iw / 2, ih / 2]
            context.drawImage(image, ...offsets, 0, 0, cw, ch)
            context.lineWidth = 3
            context.strokeStyle = "#f008"
            context.fillStyle = "#f004"
            context.beginPath()
            context.rect(x0 * cw, y0 * ch, (x1 - x0) * cw, (y1 - y0) * ch)
            context.stroke()
            context.fill()
        })
        image.src = `https://ai.v3nity.com/mev2/api/jobs/${result.job}/data?number=${result.frame}&quality=compressed&type=frame`

        const response = await GET(result.comments.url)
        const results = response.results

        let first_message = results[0].message
        if (first_message)
            first_message = first_message[0].toUpperCase() + first_message.slice(1)
        const other_messages = results.slice(1).map(x => `${x.owner.username}: ${x.message}`)
        if (other_messages?.length)
            supporting_text.innerHTML = other_messages.join("<br>")
        const elapsed_seconds = (new Date() - new Date(result.created_date)) * 1e-3
        const elapsed_string = toDurationString(elapsed_seconds, 1)
        overline.innerHTML = `By ${result.owner.username} ${elapsed_string} ago`
        headline.innerHTML = first_message

        trailing_supporting_text.innerHTML = result.resolved ? "Resolved" : "Unresolved"

        // async function listIssues() {
        //     // const response = await GET(result.issues.url)
        //     // console.log(await response.json())
        //     console.log("LIST ISSUES")
        // }

        // let timer
        // function startTimeout() {
        //     clearTimeout(timer)
        //     timer = setTimeout(listIssues, 500)
        // }
        // list_item.addEventListener("pointermove", async _ => startTimeout())
        // list_item.addEventListener("pointerleave", async _ => clearTimeout(timer))
        // list_item.addEventListener("touchstart", async _ => startTimeout())
        // list_item.addEventListener("touchend", async _ => clearTimeout(timer))
        // list_item.addEventListener("contextmenu", e => e.preventDefault())
    }

}
customElements.define("issue-item", IssueItem)