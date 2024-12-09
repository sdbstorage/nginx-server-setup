"use strict"

// https://github.com/donmccurdy/three-gltf-viewer/blob/main/src/viewer.js

import * as THREE from "./three/three.module.min.js"
import { TDSLoader } from "./three/TDSLoader.js"
import { OrbitControls } from "./three/OrbitControls.js"
import Stats from "./three/stats.module.js"

function interp1d(x, x0, x1, y0, y1) { // map x from x0...x1 to y0...y1
    return (x - x0) / (x1 - x0) * (y1 - y0) + y0
}

let debug = false
// debug = true
let stats

let scrollTopTarget = document.body?.scrollTop
let scrollTopCurrent = scrollTopTarget

const pages = document.querySelectorAll(".page")
window.addEventListener("scroll", e => scrollTopTarget = document.body?.scrollTop)

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
renderer.setPixelRatio(window.devicePixelRatio)
if (debug)
    document.body.appendChild(renderer.domElement)
else
    document.body?.insertBefore(renderer.domElement, document.body?.firstChild)
renderer.domElement.classList.add("canvas-3d")

const scene = new THREE.Scene()
// scene.background = new THREE.Color("black")

const camera = new THREE.PerspectiveCamera()
camera.up.set(0, 0, 1)
camera.position.set(10, 0, 0)
camera.lookAt(0, 0, 0)

scene.add(camera)

if (debug) {
    stats = new Stats()
    document.body?.appendChild(stats.dom)
    const grid_helper = new THREE.GridHelper()
    grid_helper.rotation.x = -Math.PI / 2
    scene.add(grid_helper)
    scene.add(new THREE.AxesHelper())

    scene.add(new THREE.AmbientLight(0xffffff, 0.1))
}

const camera_target = new THREE.PerspectiveCamera()
camera_target.up.set(0, 0, 1)
camera_target.position.set(...camera.position.toArray())
camera_target.lookAt(0, 0, 0)

let vehicle_box = new THREE.Box3()

const loader = new TDSLoader()
loader.load("models/car.3ds", obj => {
    obj.scale.set(0.001, 0.001, 0.001)
    obj.rotation.x = Math.PI / 2
    obj.rotation.y = Math.PI / 2
    // console.log(obj)
    scene.add(obj)
    need_render = true

    vehicle_box.setFromObject(obj)
    // console.log(box)

    const box = vehicle_box
    const z = box.max.z * 0.9

    camera_target.position.set(box.max.x * 2, 0, z)
    camera_target.lookAt(0, 0, z)

    // camera.position.x = box.max.x * 2
    // camera.position.z = z
    // camera.lookAt.set(0, 0, 0)
    // controls.target = new THREE.Vector3(0, 0, z)
    // controls.update()

    function addPointLight(position, ...args) {
        const light = new THREE.PointLight(...args)
        light.position.set(...position)
        scene.add(light)
        if (debug)
            scene.add(new THREE.PointLightHelper(light))
        return light
    }

    const top_light = addPointLight([0, 0, box.max.z * 1.3])
    const left_light = addPointLight([0, box.max.y, box.max.z], 0xffffff, 0.3, 0.5)
    const right_light = addPointLight([0, -box.max.y, box.max.z], 0xffffff, 0.3, 0.5)
    const lights = [top_light, left_light, right_light]

    const fps = 60

    lights.forEach(light => {
        let target_intensity = light.intensity
        light.intensity = 0
        function lightUp() {
            light.intensity += 1 / fps
            need_render = true
            if (light.intensity < target_intensity)
                setTimeout(lightUp, 1000 / fps)
        }
        lightUp()
    })
})

loader.load("models/roof.3ds", obj => {
    obj.scale.set(0.001, 0.001, 0.001)
    // obj.rotation.x = Math.PI / 2
    // obj.rotation.y = Math.PI / 2
    obj.rotation.z = Math.PI / 2
    obj.position.z = 1.53
    scene.add(obj)
    console.log(obj)

    obj.children.forEach(x => {
        const material_name = x.material.name
        if (material_name.startsWith("Opaque(")) {
            // const rgb = material_name.split("Opaque(")[1].split(")")[0].split(",").map(x => +x / 255)
            // x.material.color.setRGB(...rgb)
        }
        else if (material_name == "Steel - Satin_4") {
            x.material = new THREE.MeshStandardMaterial({
                color: 0xaaaaaa, metalness: 1.0, roughness: 0.5,
            })
        }
        else if (material_name == "PA 12 - Nylon - PA 603-CF (with EOS P 3D Printers)_6") {
            x.material = new THREE.MeshStandardMaterial({
                color: 0x111111, metalness: 0.3, roughness: 0.5,
            })
        }
        else if (material_name == "ABS (White)_0") {
            x.material = new THREE.MeshStandardMaterial({
                color: 0xeeeeee, metalness: 0.3, roughness: 0.5,
            })
        }
        else if (material_name == "Glass - Light Color_1") {
            x.material = new THREE.MeshStandardMaterial({
                color: 0x222222, metalness: 0.3, roughness: 0.5,
            })
        }
        else if (material_name == "Paint - Enamel Glossy (Black)_5") {
            x.material = new THREE.MeshStandardMaterial({
                color: 0x444444, metalness: 0.7, roughness: 0.5,
            })
        }
        else {
            // console.log(material_name)
        }
    })

    need_render = true
})


let need_render = true
function render() {

    const da = camera.position.clone().sub(camera_target.position).length()
    const db = camera.quaternion.clone().angleTo(camera_target.quaternion)
    if (da > 1e-6 || db > 1e-6) {
        const alpha = 0.01
        const a = camera.position.clone().lerp(camera_target.position, alpha)
        const b = camera.quaternion.clone().slerp(camera_target.quaternion, alpha)
        camera.position.copy(a)
        camera.quaternion.copy(b)
        need_render = true
    }

    if (need_render) {
        console.log("Render")
        renderer.render(scene, camera)
        need_render = false
        if (stats)
            stats.update()
    }
    requestAnimationFrame(render)
}
render()

function scrollLoop() {
    if (Math.abs(scrollTopCurrent - scrollTopTarget) > 1) {
        const smooth = 0.9
        scrollTopCurrent = scrollTopCurrent * smooth + (1 - smooth) * scrollTopTarget
        PAGES_CONTAINER.style.top = -scrollTopCurrent
        const ih = window.innerHeight
        const page_index = Math.floor(scrollTopCurrent / ih)
        const page_position = (scrollTopCurrent % ih) / ih
        const page0 = pages[page_index]
        const page1 = pages[page_index + 1]
        if (page0)
            page0.style.opacity = interp1d(page_position, 0.10, 0.50, 1, 0)
        if (page1)
            page1.style.opacity = interp1d(page_position, 0.50, 0.90, 0, 1)

        if (page_index == 0) {
            camera_target.position.set(
                vehicle_box.max.x * 2,
                0,
                vehicle_box.max.z)
            camera_target.lookAt(
                0,
                0,
                vehicle_box.max.z,
            )

        }
        else if (page_index == 1) {
            camera_target.position.set(
                vehicle_box.max.x * -0.5,
                vehicle_box.max.y * 2,
                vehicle_box.max.z * 1,
            )
            camera_target.lookAt(
                vehicle_box.max.x,
                0,
                vehicle_box.max.z,
            )
        }
    }
    requestAnimationFrame(scrollLoop)
    // setTimeout(scrollLoop, 100)
}
scrollLoop()

function resize() {
    const iw = window.innerWidth;
    const ih = window.innerHeight;
    camera.aspect = iw / ih
    camera.updateProjectionMatrix()
    renderer.setSize(iw, ih)
    need_render = true
    console.log(iw, ih)
    const num_page = document.querySelectorAll(".page").length
    document.body.style.height = ih * num_page
}

window.addEventListener("resize", resize)

resize()



const controls = new OrbitControls(camera, renderer.domElement)
controls.addEventListener("change", _ => need_render = true)
controls.addEventListener("start", _ => need_render = true)
controls.addEventListener("end", _ => need_render = true)
controls.update()

if (!debug) {
    controls.enablePan = false
    controls.enableRotate = false
    controls.enableZoom = false
}
