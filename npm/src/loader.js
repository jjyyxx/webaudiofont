class Loader {
    constructor(player) {
        this.player = player
        this.cached = []
    }

    async load(ctx, path, name) {
        if ((!(name in window.fonts)) && (this.cached.indexOf(name) === -1)) {
            this.cached.push(name)
            const response = await fetch(path, {
                mode: 'cors'
            })
            const json = await response.json()
            await this.player.constructor.adjustPreset(ctx, json)
            window.fonts[name] = json
        }
        return name
    }
}

if (typeof module === 'object' && module.exports) {
    module.exports = Loader
}

if (typeof window !== 'undefined') {
    window.WebAudioFontLoader = Loader
}
