class WebAudioFontLoader {
    constructor(player) {
        this.player = player
        this.cached = []
    }

    async load(audioContext, filePath, variableName) {
        if (window[variableName] || this.cached.indexOf(variableName) !== -1) {
            return
        }
        this.cached.push(variableName)
        const response = await fetch(filePath, {
            mode: 'cors'
        })
        const json = await response.json()
        window[variableName] = json
        this.player.adjustPreset(audioContext, json)
    }
}

if (typeof window !== 'undefined') {
    window.WebAudioFontLoader = WebAudioFontLoader
}

if (typeof module === 'object' && module.exports) {
    module.exports = WebAudioFontLoader
}
