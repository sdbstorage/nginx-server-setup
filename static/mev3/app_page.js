"use strict"

import { GET, POST } from "./api.js"
import { animateFadeIn, animateFadeOut } from "./util.js"
import { JobPage } from "./job_page.js"

customElements.define("app-page", class extends HTMLElement {

  constructor() {
    super()

    const shadowRoot = this.attachShadow({ mode: "open" })
    shadowRoot.innerHTML = `
      <style>
        #TOP_NAVIGATION { display: none; }
        #LEFT_NAVIGATION { display: flex; } 
        @media (orientation: portrait) {
          #LEFT_NAVIGATION { display: none; }
          #TOP_NAVIGATION { display: flex; }
        }
        md-text-button.selected {
          background: #48c3; 
        }
        md-tabs {
          --md-sys-color-surface: transparent; 
          --md-divider-thickness: 0; 
        }
      </style>
      <div style="display: flex; height: 100%; background: #48c3">

        <div id=LEFT_NAVIGATION style="
          flex-direction: column; 
          gap: 8px; 
          padding: 8px;
          padding-right: 0; 
          align-items: center; 
        ">
            <img src=logo.png style="height:32px; padding: 8px 0">
            <md-text-button leading-icon>Annotate<md-icon slot=icon>edit_square</md-icon></md-text-button>
            <md-text-button leading-icon>Issue<md-icon slot=icon>chat</md-icon></md-text-button>
            <md-text-button leading-icon>Note<md-icon slot=icon>book_2</md-icon></md-text-button>
            <md-text-button leading-icon>Stats<md-icon slot=icon>monitoring</md-icon></md-text-button>
            <div style="flex: 1"></div>
            <md-icon-button style="width: 100%" class=logout-button><md-icon>logout</md-icon></md-icon-button>
        </div>
        <div id=TOP_APP_BAR style="display: flex; flex-direction: column; flex: 1">
          <div id=TOP_NAVIGATION style="flex-direction: column">
            <div style="display: flex; padding: 8px; gap: 8px">
              <img src=logo.png style="height:32px; padding: 0 8px;">
              <div style="flex: 1"></div>
              <md-icon-button class=logout-button><md-icon>logout</md-icon></md-icon-button>
            </div>
            <md-tabs>
              <md-primary-tab>Annotate<md-icon slot=icon>edit_square</md-icon></md-primary-tab>
              <md-primary-tab>Issue<md-icon slot=icon>chat</md-icon></md-primary-tab>
              <md-primary-tab>Note<md-icon slot=icon>book_2</md-icon></md-primary-tab>
              <md-primary-tab>Stats<md-icon slot=icon>monitoring</md-icon></md-primary-tab>
            </md-tabs>
          </div>
          <div id=CONTENT style="flex: 1; padding: 8px; overflow-y: hidden;">

          </div>
        </div>
      </div>
    `

    //   <div id=PRIMARY_AREA style="
    //   flex: 3; 
    //   flex-direction: column; 
    //   display: flex; gap: 8px; 
    //   overflow-y: auto; 
    //   background: white; 
    //   padding: 8px; 
    // ">

    // </div>
    // <div style="display: flex; flex: 2; flex-direction: column; gap: 8px; y-overflow: auto; ">
    //   <div style="flex: 1; background: white; border-radius:8px; "></div>
    // </div>

    // ANIMATION INITIAL STATE

    this.primary_area = shadowRoot.querySelector("#PRIMARY_AREA")

    this.style.opacity = 0

    const that = this

    shadowRoot.querySelectorAll(".logout-button").forEach(button => {
      button.addEventListener("click", async _ => {
        const response = await POST("auth/logout")
        if (response.status == 200) {
          const login_page = document.querySelector("login-page")
          await animateFadeOut(that).finished
          login_page.clear()
          login_page.show()
        }
        else
          console.log("NOPE")

      })

    })

    setTimeout(_ => {
      const left_navigation_buttons = Array.from(
        shadowRoot.querySelectorAll("#LEFT_NAVIGATION md-text-button"))
      left_navigation_buttons.forEach(button => {
        button.addEventListener("click", _ => {
          left_navigation_buttons.forEach(x => x.classList.remove("selected"))
          button.classList.add("selected")
        })
        const b = button.shadowRoot.querySelector("#button")
        b.style.display = "flex"
        b.style.flexDirection = "column"
        button.style.width = "100%"
        button.style.borderRadius = "16px"
      })
    })
  }

  async show() {

    animateFadeIn(this)

    const content = this.shadowRoot.querySelector("#CONTENT")

    const job_page = content.querySelector("job-page")
    if (!job_page) {
      content.appendChild(new JobPage())
    }
  }
})