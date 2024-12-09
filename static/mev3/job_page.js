"use strict"

import { GET, POST } from "./api.js"
import { JobItem } from "./job_item.js"
import { onLongHover } from "./util.js"

export class JobPage extends HTMLElement {

    constructor() {
        // Always call super first in constructor
        super()

        const shadow = this.attachShadow({ mode: "open" })
        shadow.innerHTML = `
            <style>
            @media (max-width: 800px) { #SECOND_COLUMN { display: none; } }
            @media (max-width: 1200px) { #THIRD_COLUMN { display: none; } }
            </style>
            <md-list id=FIRST_COLUMN style="flex: 1; border-radius: 8px; overflow-y: auto; "></md-list>
            <md-list id=SECOND_COLUMN style="flex: 1; border-radius: 8px; overflow-y: auto; "></md-list>
            <md-list id=THIRD_COLUMN style="flex: 1; border-radius: 8px; overflow-y: auto; "></md-list>
        `
        this.style.display = "flex"
        this.style.height = "100%"
        this.style.gap = "8px"
        this.style.justifyContent = "center"

        const list = shadow.querySelector("md-list")
        const issue_list = shadow.querySelector("#SECOND_COLUMN")
        const annotation_list = shadow.querySelector("#THIRD_COLUMN")

        let next_url
        let loading = false

        async function load(url) {
            loading = true
            const response = await GET(url)
            next_url = response.next
            // Cleanup next_url
            for (const result of Array.from(response.results)) {
                const list_item = new JobItem()
                list.appendChild(list_item)
                await list_item.setup(result, issue_list, annotation_list)
            }
            loading = false
        }

        load("jobs")

        async function loadNextPage() {
            if (!next_url)
                return
            load(next_url)
        }

        list.addEventListener("scroll", _ => {
            const is_bottom = list.scrollHeight - list.scrollTop == list.clientHeight
            if (is_bottom && next_url && !loading)
                load(next_url)
        })

        // const response = await GET("jobs")
        // const data = await response.json()
        // console.log(data)
        // const list = document.createElement("md-list")
        // Array.from(data.results).forEach(result => {
        //   console.log(result)
        //   const list_item = document.createElement("md-list-item")
        //   list_item.setAttribute("interactive", true)
        //   list_item.style.cursor = "pointer"
        //   const image = new Image()
        //   image.addEventListener("load", _ => {
        //     const context = canvas.getContext("2d")
        //     context.drawImage(
        //       image,
        //       image.width / 4, 0, image.width / 2, image.height / 2,
        //       0, 0, canvas.width, canvas.height)
        //   })
        //   image.src = `https://ai.v3nity.com/mev2/api/jobs/${result.id}/preview`

        //   const issue_count = result.issues.count
        //   const issue_text = issue_count == 0 ? "No issue" : `${issue_count} issue${issue_count > 1 ? "s" : ""}`
        //   list_item.innerHTML = `
        //   <canvas slot="start" width=128 height=72></canvas>
        //   <div slot=overline>${result.status}</div>
        //   <div slot=headline>Job ${result.id} ${result.state}</div>
        //   <div slot=supporting-text>Assigned to ${result.assignee?.username || "Unassigned"}</div>
        //   <div slot="trailing-supporting-text">${issue_text}</div>
        //   `
        //   list.appendChild(list_item)
        //   const canvas = list_item.querySelector("canvas")
        // })
        // this.primary_area.appendChild(list)

    }

    show() { return this.dialog.show() }
    hide() { return this.dialog.close() }
    clear() {
        this.dialog.querySelectorAll("md-filled-text-field").forEach(x => x.value = "")
    }
}

customElements.define("job-page", JobPage)