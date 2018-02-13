class WebAudioFontLoader {
    constructor(player) {
        this.player = player
        this.cached = []
        // const req = indexedDB.open('audiofont', 1)
        // this.db = undefined
        // this.trans = undefined
        // this.store = undefined
        // req.onsuccess = () => {
        //     this.db = req.result
        //     this.trans = this.db.transaction(['audiofont'], 'readwrite')
        //     this.store = this.trans.objectStore('audiofont')
        // }
        // req.onupgradeneeded = () => {
        //     if (!this.db.objectStoreNames.contains('audiofont')) {
        //         this.db.createObjectStore('audiofont', { keyPath: 'variableName' })
        //     }
        // }
    }

    async load(audioContext, filePath, variableName) {
        // try {
        //     return await new Promise((resolve, reject) => {
        //         const req = this.store.get(variableName)
        //         req.onsuccess = function () {
        //             if (req.result)
        //                 resolve(req.result)
        //             else
        //                 reject(Error('object not found'))
        //         }
        //     })
        // } catch (error) {
        if (!(variableName in window.fonts)) {
            const cache = localStorage.getItem(variableName)
            if (cache || this.cached.indexOf(variableName) !== -1) {
                window.fonts[variableName] = JSON.parse(cache)
            } else {
                this.cached.push(variableName)
                const response = await fetch(filePath, {
                    mode: 'cors'
                })
                const json = await response.json()
                // this.store.add(json, variableName)
                localStorage.setItem(variableName, JSON.stringify(json))
                this.player.constructor.adjustPreset(audioContext, json)
                window.fonts[variableName] = json
            }
        }
        return variableName
        // }
    }
}

if (typeof window !== 'undefined') {
    window.WebAudioFontLoader = WebAudioFontLoader
}

if (typeof module === 'object' && module.exports) {
    module.exports = WebAudioFontLoader
}
