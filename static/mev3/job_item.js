"use strict"

import { GET, POST } from "./api.js"
import {
    animateFadeIn, getValidator, onLongHover, isVisible,
    removeExtension,
} from "./util.js"
import { IssueItem } from "./issue_item.js"
import { AnnotationItem } from "./annotation_item.js"

export class JobItem extends HTMLElement {

    constructor(result) {
        super()

        const shadow = this.attachShadow({ mode: "open" })
        shadow.innerHTML = `
            <md-list-item href=#>
                <canvas slot=start width=128 height=72 style="background: #0001"></canvas>
                <div slot=overline>Overline</div>
                <div slot=headline>Headline</div>
                <div slot=supporting-text>Supporting text</div>
                <div slot="trailing-supporting-text" style="text-align:right"></div>
            </md-list-item>
        `
        this.style.opacity = 0
        animateFadeIn(this)
    }

    async setup(result, issue_list, annotation_list) {
        // console.log(result)

        const list_item = this.shadowRoot.querySelector("md-list-item")
        const canvas = list_item.querySelector("canvas")
        const overline = list_item.querySelector("[slot=overline]")
        const headline = list_item.querySelector("[slot=headline]")
        const supporting_text = list_item.querySelector("[slot=supporting-text]")
        const trailing_supporting_text = list_item.querySelector("[slot=trailing-supporting-text]")

        const issue_count = result.issues.count
        const state = result.state
        const stage = result.stage

        let state_text

        if (state == "new")
            state_text = "New"
        else if (state == "rejected")
            state_text = "Rejected"
        else if (state == "accepted")
            state_text = "Accepted"
        else if (state == "in progress") {
            if (stage == "annotation") {
                state_text = "Annotating"
            }
            if (stage == "validation") {
                state_text = "Validating"
            }
            if (stage == "acceptance") {
                state_text = "Reviewing"
            }
        }
        const task = await GET(`tasks/${result.task_id}`)
        let task_name = removeExtension(task.name)

        const validator = await getValidator(result)
        let secondary_text = `${result.assignee?.username || "Unassigned"} / ${validator.username || "Unassigned"}`

        overline.innerHTML = state_text
        headline.innerHTML = `${task_name}`
        supporting_text.innerHTML = secondary_text
        let issues = []
        if (issue_count) {
            const response = await GET(result.issues.url)
            issues = response.results
            const num_resolved = issues.filter(x => x.resolved).length
            let resolve_text = `${issue_count == num_resolved ? "All" : num_resolved} resolved`
            trailing_supporting_text.innerHTML = `${issue_count} issue${issue_count > 1 ? "s" : ""}<br>${resolve_text}`
        }

        const image = new Image()
        image.addEventListener("load", _ => {
            const context = canvas.getContext("2d")
            context.drawImage(
                image,
                image.width / 4, 0, image.width / 2, image.height / 2,
                0, 0, canvas.width, canvas.height)
        })
        // const frame_number = Math.floor((result.stop_frame + result.start_frame) / 2)
        // image.src = `https://ai.v3nity.com/mev2/api/jobs/${result.id}/data?number=${frame_number}&quality=compressed&type=frame`
        image.src = `https://ai.v3nity.com/mev2/api/jobs/${result.id}/preview`

        async function loadIssueList() {
            if (!issue_list || !isVisible(issue_list))
                return
            issue_list.innerHTML = ``
            if (issues.length) {
                for (const issue of issues) {
                    const issue_item = new IssueItem()
                    issue_list.appendChild(issue_item)
                    await issue_item.setup(issue)
                }
            }
            else {
                issue_list.innerHTML = `
                    <div style="
                        flex: 1; display: flex; align-items: center; 
                        justify-content: center; 
                        font-family: Roboto, Arial, Helvetica, sans-serif;
                        font-size: 1.5rem; 
                        color: var(--md-sys-color-primary); 
                        opacity: 0.5;
                    ">
                        Job ${result.id} has no issue
                    <div>
                `
            }

        }

        async function loadAnnotationList() {
            if (!annotation_list || !isVisible(annotation_list))
                return
            const annotations = await GET(`jobs/${result.id}/annotations`)
            const labels = Object.fromEntries(
                (await GET(`${result.labels.url}&page_size=1000`)).results.map(x => [x.id, x]))
            const shapes = annotations.shapes.filter(x => x.source != "manual").sort((a, b) => a.frame - b.frame)

            shapes.forEach(x => x.job = result.id)
            annotation_list.innerHTML = ""
            if (shapes.length) {
                for (const shape of shapes) {
                    shape.label = labels[shape.label_id]
                    const item = new AnnotationItem()
                    annotation_list.appendChild(item)
                    await item.setup(shape)
                }
            }
            else {
                annotation_list.innerHTML = `
                    <div style="
                        flex: 1; display: flex; align-items: center; 
                        justify-content: center; 
                        font-family: Roboto, Arial, Helvetica, sans-serif;
                        font-size: 1.5rem; 
                        color: var(--md-sys-color-primary); 
                        opacity: 0.5;
                    ">
                        Job ${result.id} has no annotation
                    <div>
                `
            }
        }

        onLongHover(list_item, _ => {
            loadIssueList()
            loadAnnotationList()
        })
    }

}
customElements.define("job-item", JobItem)