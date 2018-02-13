class WebAudioFontLoader {
    constructor(player) {
        this.player = player
        this.cached = []
        const req = indexedDB.open('audiofont', 1)
        this.db = undefined
        req.onsuccess = () => {
            this.db = req.result
        }
        if (!this.db.objectStoreNames.contains('audiofont')) {
            this.db.createObjectStore('audiofont', { keyPath: 'variableName' })
        }
        this.trans = this.db.transaction(['audiofont'], 'readwrite')
        this.store = this.trans.objectStore('audiofont')
    }

    async load(audioContext, filePath, variableName) {
        try {
            return await new Promise((resolve, reject) => {
                const req = this.store.get(variableName)
                req.onsuccess = function () {
                    if (req.result)
                        resolve(req.result)
                    else
                        reject(Error('object not found'))
                }
            })
        } catch (error) {
            if (this.cached.indexOf(variableName) !== -1) {
                return
            }
            this.cached.push(variableName)
            const response = await fetch(filePath, {
                mode: 'cors'
            })
            const json = await response.json()
            this.store.add(json, variableName)
            this.player.adjustPreset(audioContext, json)
            return json
        }
    }
}

if (typeof window !== 'undefined') {
    window.WebAudioFontLoader = WebAudioFontLoader
}

if (typeof module === 'object' && module.exports) {
    module.exports = WebAudioFontLoader
}
