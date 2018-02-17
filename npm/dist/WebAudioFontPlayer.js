(function(){function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s}return e})()({1:[function(require,module,exports){
class Channel {
    constructor(audioContext) {
        this.audioContext = audioContext
        this.input = this.audioContext.createDynamicsCompressor()
        this.input.threshold.value = -3
        this.input.knee.value = 30
        this.input.ratio.value = 12
        this.input.attack.value = 0.05
        this.input.release.value = 0.08
        this.band32 = this.bandEqualizer(this.input, 32)
        this.band64 = this.bandEqualizer(this.band32, 64)
        this.band128 = this.bandEqualizer(this.band64, 128)
        this.band256 = this.bandEqualizer(this.band128, 256)
        this.band512 = this.bandEqualizer(this.band256, 512)
        this.band1k = this.bandEqualizer(this.band512, 1024)
        this.band2k = this.bandEqualizer(this.band1k, 2048)
        this.band4k = this.bandEqualizer(this.band2k, 4096)
        this.band8k = this.bandEqualizer(this.band4k, 8192)
        this.band16k = this.bandEqualizer(this.band8k, 16384)
        this.output = audioContext.createGain()
        this.band16k.connect(this.output)
    }

    bandEqualizer(from, frequency) {
        const filter = this.audioContext.createBiquadFilter()
        filter.frequency.setTargetAtTime(frequency, 0, 0.0001)
        filter.type = 'peaking'
        filter.gain.setTargetAtTime(0, 0, 0.0001)
        filter.Q.setTargetAtTime(1.0, 0, 0.0001)
        from.connect(filter)
        return filter
    }
}

if (typeof module === 'object' && module.exports) {
    module.exports = Channel
}
if (typeof window !== 'undefined') {
    window.WebAudioFontChannel = Channel
}

},{}],2:[function(require,module,exports){
class Loader {
    constructor(player) {
        this.player = player
        this.cached = []
    }

    async load(ctx, path, name) {
        if (!(name in window.fonts)) {
            const cache = localStorage.getItem(name)
            if (cache) {
                window.fonts[name] = JSON.parse(cache)
                await this.player.constructor.adjustPreset(ctx, window.fonts[name])
            } else if (this.cached.indexOf(name) === -1) {
                this.cached.push(name)
                const response = await fetch(path, {
                    mode: 'cors'
                })
                const json = await response.json()
                localStorage.setItem(name, JSON.stringify(json))
                await this.player.constructor.adjustPreset(ctx, json)
                window.fonts[name] = json
            }
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

},{}],3:[function(require,module,exports){
const Loader = require('./loader')
const Channel = require('./channel')
const Reverberator = require('./reverberator')
class Player {
    constructor() {
        this.envelopes = []
        this.loader = new Loader(this)
        this.onCacheFinish = null
        this.onCacheProgress = null
        this.afterTime = 0.05
    }

    static createChannel(ctx) {
        return new Channel(ctx)
    }

    static async createReverberator(ctx) {
        return await Reverberator.create(ctx)
    }

    queueChord(ctx, target, preset, when, pitches, duration, volume, slides) {
        for (var i = 0; i < pitches.length; i++) {
            this.queueWaveTable(ctx, target, preset, when, pitches[i], duration, volume - Math.random() * 0.01, slides)
        }
    }

    queueStrumUp(ctx, target, preset, when, pitches, duration, volume, slides) {
        pitches.sort((a, b) => b - a)
        this.queueStrum(ctx, target, preset, when, pitches, duration, volume, slides)
    }

    queueStrumDown(ctx, target, preset, when, pitches, duration, volume, slides) {
        pitches.sort((a, b) => a - b)
        this.queueStrum(ctx, target, preset, when, pitches, duration, volume, slides)
    }

    queueStrum(ctx, target, preset, when, pitches, duration, volume, slides) {
        if (volume) {
            volume = 1.0 * volume
        } else {
            volume = 1.0
        }
        if (when < ctx.currentTime) {
            when = ctx.currentTime
        }
        for (var i = 0; i < pitches.length; i++) {
            this.queueWaveTable(ctx, target, preset, when + i * 0.01, pitches[i], duration, volume - Math.random() * 0.01, slides)
            volume = 0.9 * volume
        }
    }

    queueSnap(ctx, target, preset, when, pitches, duration, volume, slides) {
        volume = 1.5 * (volume | 1.0)
        duration = 0.05
        this.queueChord(ctx, target, preset, when, pitches, duration, volume, slides)
    }

    queueWaveTable(ctx, target, preset, when, pitch, duration, volume, slides) {
        if (volume) {
            volume = 1.0 * volume
        } else {
            volume = 1.0
        }
        var zone = Player.findZone(ctx, preset, pitch)
        if (!(zone.buffer)) {
            console.log('empty buffer ', zone)
            return
        }
        var baseDetune = zone.originalPitch - 100.0 * zone.coarseTune - zone.fineTune
        var playbackRate = 1.0 * Math.pow(2, (100.0 * pitch - baseDetune) / 1200.0)
        // var sampleRatio = zone.sampleRate / audioContext.sampleRate
        var startWhen = when
        if (startWhen < ctx.currentTime) {
            startWhen = ctx.currentTime
        }
        var waveDuration = duration + this.afterTime
        var loop = true
        if (zone.loopStart < 1 || zone.loopStart >= zone.loopEnd) {
            loop = false
        }
        if (!loop) {
            if (waveDuration > zone.buffer.duration / playbackRate) {
                waveDuration = zone.buffer.duration / playbackRate
            }
        }
        var envelope = this.findEnvelope(ctx, target, startWhen, waveDuration)
        this.setupEnvelope(ctx, envelope, zone, volume, startWhen, waveDuration, duration)
        envelope.audioBufferSourceNode = ctx.createBufferSource()
        envelope.audioBufferSourceNode.playbackRate.value = playbackRate
        if (slides) {
            if (slides.length > 0) {
                envelope.audioBufferSourceNode.playbackRate.setValueAtTime(playbackRate, when)
                for (var i = 0; i < slides.length; i++) {
                    var newPlaybackRate = 1.0 * Math.pow(2, (100.0 * slides[i].pitch - baseDetune) / 1200.0)
                    var newWhen = when + slides[i].when
                    envelope.audioBufferSourceNode.playbackRate.linearRampToValueAtTime(newPlaybackRate, newWhen)
                }
            }
        }
        envelope.audioBufferSourceNode.buffer = zone.buffer
        if (loop) {
            envelope.audioBufferSourceNode.loop = true
            envelope.audioBufferSourceNode.loopStart = zone.loopStart / zone.sampleRate + zone.delay
            envelope.audioBufferSourceNode.loopEnd = zone.loopEnd / zone.sampleRate + zone.delay
        } else {
            envelope.audioBufferSourceNode.loop = false
        }
        envelope.audioBufferSourceNode.connect(envelope)
        envelope.audioBufferSourceNode.start(startWhen, zone.delay)
        envelope.audioBufferSourceNode.stop(startWhen + waveDuration)
        envelope.when = startWhen
        envelope.duration = waveDuration
        envelope.pitch = pitch
        envelope.preset = preset
        return envelope
    }

    static noZeroVolume(n) {
        if (n > Player.nearZero) {
            return n
        } else {
            return Player.nearZero
        }
    }

    setupEnvelope(ctx, envelope, zone, volume, when, sampleDuration, noteDuration) {
        envelope.gain.setValueAtTime(Player.noZeroVolume(0), ctx.currentTime)
        var lastTime = 0
        var lastVolume = 0
        var duration = noteDuration
        var ahdsr = zone.ahdsr
        if (sampleDuration < duration + this.afterTime) {
            duration = sampleDuration - this.afterTime
        }
        if (ahdsr) {
            if (!(ahdsr.length > 0)) {
                ahdsr = [{
                    duration: 0,
                    volume: 1
                }, {
                    duration: 0.5,
                    volume: 1
                }, {
                    duration: 1.5,
                    volume: 0.5
                }, {
                    duration: 3,
                    volume: 0
                }
                ]
            }
        } else {
            ahdsr = [{
                duration: 0,
                volume: 1
            }, {
                duration: duration,
                volume: 1
            }
            ]
        }
        envelope.gain.cancelScheduledValues(when)
        envelope.gain.setValueAtTime(Player.noZeroVolume(ahdsr[0].volume * volume), when)
        for (var i = 0; i < ahdsr.length; i++) {
            if (ahdsr[i].duration > 0) {
                if (ahdsr[i].duration + lastTime > duration) {
                    var r = 1 - (ahdsr[i].duration + lastTime - duration) / ahdsr[i].duration
                    var n = lastVolume - r * (lastVolume - ahdsr[i].volume)
                    envelope.gain.linearRampToValueAtTime(Player.noZeroVolume(volume * n), when + duration)
                    break
                }
                lastTime = lastTime + ahdsr[i].duration
                lastVolume = ahdsr[i].volume
                envelope.gain.linearRampToValueAtTime(Player.noZeroVolume(volume * lastVolume), when + lastTime)
            }
        }
        envelope.gain.linearRampToValueAtTime(Player.noZeroVolume(0), when + duration + this.afterTime)
    }

    static numValue(aValue, defValue) {
        if (typeof aValue === 'number') {
            return aValue
        } else {
            return defValue
        }
    }

    findEnvelope(ctx, target/*, when , duration */) {
        var envelope = null
        for (var i = 0; i < this.envelopes.length; i++) {
            var e = this.envelopes[i]
            if (e.target == target && ctx.currentTime > e.when + e.duration + 0.1) {
                try {
                    e.audioBufferSourceNode.disconnect()
                    e.audioBufferSourceNode.stop(0)
                    e.audioBufferSourceNode = null
                } catch (x) {
                    //audioBufferSourceNode is dead already
                }
                envelope = e
                break
            }
        }
        if (!(envelope)) {
            envelope = ctx.createGain()
            envelope.target = target
            envelope.connect(target)
            envelope.cancel = () => {
                if (envelope.when + envelope.duration > ctx.currentTime) {
                    envelope.gain.cancelScheduledValues(0)
                    envelope.gain.setTargetAtTime(0.00001, ctx.currentTime, 0.1)
                    envelope.when = ctx.currentTime + 0.00001
                    envelope.duration = 0
                }
            }
            this.envelopes.push(envelope)
        }
        return envelope
    }

    static adjustPreset(ctx, preset) {
        return Promise.all(preset.zones.map((zone) => Player.adjustZone(ctx, zone)))
    }

    static adjustZone(ctx, zone) {
        if (!zone.buffer) {
            zone.delay = 0
            zone.loopStart = Player.numValue(zone.loopStart, 0)
            zone.loopEnd = Player.numValue(zone.loopEnd, 0)
            zone.coarseTune = Player.numValue(zone.coarseTune, 0)
            zone.fineTune = Player.numValue(zone.fineTune, 0)
            zone.originalPitch = Player.numValue(zone.originalPitch, 6000)
            zone.sampleRate = Player.numValue(zone.sampleRate, 44100)
            zone.sustain = Player.numValue(zone.originalPitch, 0)
            if (zone.sample) {
                const decoded = atob(zone.sample)
                zone.buffer = ctx.createBuffer(1, decoded.length / 2, zone.sampleRate)
                var float32Array = zone.buffer.getChannelData(0)
                var b1, b2, n
                for (var i = 0; i < decoded.length / 2; i++) {
                    b1 = decoded.charCodeAt(i * 2)
                    b2 = decoded.charCodeAt(i * 2 + 1)
                    if (b1 < 0) {
                        b1 = 256 + b1
                    }
                    if (b2 < 0) {
                        b2 = 256 + b2
                    }
                    n = b2 * 256 + b1
                    if (n >= 65536 / 2) {
                        n = n - 65536
                    }
                    float32Array[i] = n / 65536.0
                }
            } else if (zone.file) {
                var datalen = zone.file.length
                var arraybuffer = new ArrayBuffer(datalen)
                var view = new Uint8Array(arraybuffer)
                const decoded = atob(zone.file)
                var b
                for (i = 0; i < decoded.length; i++) {
                    b = decoded.charCodeAt(i)
                    view[i] = b
                }
                return Player.decodeAudioData(ctx, zone, arraybuffer).then((buffer) => {
                    zone.buffer = buffer
                })
            }
        }
    }

    static decodeAudioData(ctx, zone, arraybuffer) {
        return new Promise((resolve, reject) => {
            ctx.decodeAudioData(arraybuffer, resolve, reject)
        })
    }

    static findZone(ctx, preset, pitch) {
        var zone = null
        for (var i = preset.zones.length - 1; i >= 0; i--) {
            zone = preset.zones[i]
            if (zone.keyRangeLow <= pitch && zone.keyRangeHigh + 1 >= pitch) {
                break
            }
        }
        try {
            Player.adjustZone(ctx, zone)
        } catch (ex) {
            console.log('adjustZone', ex)
        }
        return zone
    }

    cancelQueue(ctx) {
        for (var i = 0; i < this.envelopes.length; i++) {
            var e = this.envelopes[i]
            e.gain.cancelScheduledValues(0)
            e.gain.setValueAtTime(Player.nearZero, ctx.currentTime)
            e.when = -1
            try {
                e.audioBufferSourceNode.disconnect()
            } catch (ex) {
                console.log(ex)
            }
        }
    }
}

Player.nearZero = 0.000001

if (typeof module === 'object' && module.exports) {
    module.exports = Player
}
if (typeof window !== 'undefined') {
    window.WebAudioFontPlayer = Player
}

},{"./channel":1,"./loader":2,"./reverberator":4}],4:[function(require,module,exports){
class Reverberator {
    constructor(ctx, irrArrayBuffer) {
        this.ctx = ctx
        this.input = this.ctx.createBiquadFilter()
        this.input.type = 'lowpass'
        this.input.frequency.setTargetAtTime(18000,0,0.0001)
        this.convolver = null
        this.output = ctx.createGain()
        this.dry = ctx.createGain()
        this.dry.gain.setTargetAtTime(0.9,0,0.0001)
        this.dry.connect(this.output)
        this.wet = ctx.createGain()
        this.wet.gain.setTargetAtTime(0.5,0,0.0001)
        this.input.connect(this.dry)
        this.input.connect(this.wet)
        this.irrArrayBuffer = irrArrayBuffer
        this.ctx.decodeAudioData(this.irrArrayBuffer, (audioBuffer) => {
            this.convolver = ctx.createConvolver()
            this.convolver.buffer = audioBuffer
            this.wet.connect(this.convolver)
            this.convolver.connect(this.output)
        })
    }

    static async create(ctx) {
        const response = await fetch('https://jjyyxx.github.io/webaudiofontdata/data/irr.bin', {
            mode: 'cors'
        })
        const irrArrayBuffer = await response.arrayBuffer()
        return new Reverberator(ctx, irrArrayBuffer)
    }
}

if (typeof module === 'object' && module.exports) {
    module.exports = Reverberator
}
if (typeof window !== 'undefined') {
    window.WebAudioFontReverberator = Reverberator
}

},{}]},{},[3,1,2,4]);
