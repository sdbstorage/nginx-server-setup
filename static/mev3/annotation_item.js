"use strict"

import { GET, POST } from "./api.js"
import { animateFadeIn, positionToCamera, simplifyLabelName, toDurationString } from "./util.js"

export class AnnotationItem extends HTMLElement {

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
        const label = result.label

        const image = new Image()
        image.addEventListener("load", _ => {
            const context = canvas.getContext("2d")
            const iw = image.width
            const ih = image.height
            const [x0, y0, x1, y1, camera_index] = positionToCamera(...result.points)
            const cw = canvas.width
            const ch = canvas.height
            let offsets = [iw / 4, 0, iw / 2, ih / 2]
            if (camera_index == 1)
                offsets = [0, ih / 2, iw / 2, ih / 2]
            else if (camera_index == 2)
                offsets = [iw / 2, ih / 2, iw / 2, ih / 2]
            context.drawImage(image, ...offsets, 0, 0, cw, ch)
            context.lineWidth = 3
            context.strokeStyle = `${label.color}88`
            context.fillStyle = `${label.color}44`
            context.beginPath()
            context.rect(x0 * cw, y0 * ch, (x1 - x0) * cw, (y1 - y0) * ch)
            context.stroke()
            context.fill()
        })
        image.src = `https://ai.v3nity.com/mev2/api/jobs/${result.job}/data?number=${result.frame}&quality=compressed&type=frame`

        let username = "Unknown user"
        let initial
        try {
            const source = JSON.parse(result.source)
            username = source.name
            initial = source.initial
        } catch { }

        overline.innerHTML = `By ${username}`
        headline.innerHTML = simplifyLabelName(label.name)
        const initial_can_skip = ["car"]
        if (initial && !initial_can_skip.includes(initial?.toLowerCase()))
            supporting_text.innerHTML = `Initially ${simplifyLabelName(initial)}`
    }

}
customElements.define("annotation-item", AnnotationItem)