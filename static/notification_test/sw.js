"use strict"

self.addEventListener('push', function (event) {
    const options = {
        body: event.data.text(),
        icon: 'icon.png',
        badge: 'badge.png'
    };
    event.waitUntil(self.registration.showNotification('Push Notification', options));
})

self.addEventListener('install', function (e) {
    console.log("install", e)
});

self.addEventListener('activate', function (e) {
    console.log("activate", e)
});

self.addEventListener('fetch', function (e) {
    console.log("fetch", e)
});

self.addEventListener("periodicsync", e => {
    console.log(e)
})