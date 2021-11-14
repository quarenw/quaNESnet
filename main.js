const canvas = document.querySelector('#canvas canvas')
console.log(canvas)
const display = new Display(canvas)
let running = false 
let frame = 0
let oldTime = window.performance.now()
let fpsEle = document.querySelector('#fps')

const joyMapping = {
  '87': { inputKey: 'w', gamepadKey: 'up'},
  '83': { inputKey: 's', gamepadKey: 'down'},
  '65': { inputKey: 'a', gamepadKey: 'left'},
  '68': { inputKey: 'd', gamepadKey: 'right'},
  '13': { inputKey: 'enter', gamepadKey: 'start'},
  '190': { inputKey: ',', gamepadKey: 'b'},
  '188': { inputKey: '.', gamepadKey: 'a'},
  '191': { inputKey: '/', gamepadKey: 'select'}
}

function printMem (mem) {
  console.log(memoryDump(mem))
}

function memoryDump (memArray) {
  let dump = `${hex(0, 4)}:   `
  for (let i = 0; i < memArray.length; i++) {
    dump += hex(memArray[i]) + ' '
    if ((i + 1) % 16 === 0) {
      dump += "\n"
      if (i + 1 < memArray.length) dump += `${hex(i + 1, 4)}:   `
    }
  }
  return dump
}

function hex (num, width = 2, noPrefix) {
	let base = ''
  let prefix = ''
	const str = num.toString(16)

  if (num < 0) prefix += '-'
  if (!noPrefix) prefix += '0x'
  if (width === undefined) return prefix + str

  for (var i = 0; i < width; i++) base += '0'

  return prefix + (base + str).substr(-1 * width)
}

const url = './tst.nes'
const request = new XMLHttpRequest()
request.responseType = 'arraybuffer'

request.onload = () => {
  var buffer = request.response
  const nes = new Bus()
  const cart = new Cartridge(buffer)
  if (!cart.imageValid()) return false 
  nes.insertCartridge(cart)
  nes.attachDisplay(display)
  nes.reset()
  
  window.onkeydown = e => {
    if (e.keyCode == 32) {
      running = !running
      run()
    }
    
    const button = joyMapping[e.keyCode]
    if (button) {
      nes.joypad[button.gamepadKey] = 1
    }

    e.preventDefault()
  }

  window.onkeyup = e => {
    const button = joyMapping[e.keyCode]
    if (button) {
      nes.joypad[button.gamepadKey] = 0
    }

    e.preventDefault()
  }

  function run () {
    const cycles = (341 * 262 /3) | 0

    nes.controller[0][0] = 0x00
    nes.controller[0][0] |= nes.joypad['a'] ? 0x80 : 0x00
    nes.controller[0][0] |= nes.joypad['b'] ? 0x40 : 0x00
    nes.controller[0][0] |= nes.joypad['select'] ? 0x20 : 0x00
    nes.controller[0][0] |= nes.joypad['start'] ? 0x10 : 0x00
    nes.controller[0][0] |= nes.joypad['up'] ? 0x08 : 0x00
    nes.controller[0][0] |= nes.joypad['down'] ? 0x04 : 0x00
    nes.controller[0][0] |= nes.joypad['left'] ? 0x02 : 0x00
    nes.controller[0][0] |= nes.joypad['right'] ? 0x01 : 0x00

    for (let i = 0; i < cycles; i ++) nes.clock()
    if (running) {
      measureFps()
      window.requestAnimationFrame(run)
    }
  }

  function measureFps () {
    if (frame === 60) {
      const newTime = window.performance.now()
      if (oldTime !== null) {
        let fps = 60000 / (newTime - oldTime)
        fpsEle.innerHTML = `fps: ${fps.toFixed(2)}`
      }
      oldTime = newTime
      frame = 0
    }
    frame++
  }


}

request.open('GET', url, true)
request.send(null)
