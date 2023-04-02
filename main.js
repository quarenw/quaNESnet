const canvas = document.querySelector('#canvas canvas')
console.log(canvas)
let running = false 
let oldTime = window.performance.now()
let oldFrame = 0
let fpsEle = document.querySelector('#fps')
let selectedRom = './roms/sgt.nes'
let emulation = {}

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

settings()
runCartridge()

function runCartridge () {
  const url = selectedRom
  if (url === null) {
    const fileInput = document.querySelector('#fileInput')
    fileInput.addEventListener('change', e => {
      const file = e.target.files[0]
      const reader = new FileReader()
      reader.onload = e => handleLoad(e.target.result)
      reader.readAsArrayBuffer(file)
    }, false)
    fileInput.click()
  } else {
    const request = new XMLHttpRequest()
    request.responseType = 'arraybuffer'
    request.onload = () => handleLoad(request.response)
    request.open('GET', url, true)
    request.send(null)
  }

  function handleLoad (response) {
    const buffer = response

    const display = new Display(canvas)
    const nes = new Bus()
    const cart = new Cartridge(buffer)
    if (!cart.imageValid()) return false 
    emulation.display = display
    emulation.nes = nes
    emulation.cart = cart
    nes.insertCartridge(cart)
    nes.attachDisplay(display)
    nes.reset()
    
    window.onkeydown = e => {
      if (e.keyCode == 32) {
        running = !running
        document.querySelector('#status').textContent = running ? 'Status: Running' : 'Status: Not running'
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
      const cycles = (341 * 262) | 0
  
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
        if (oldFrame !== ppu.frame) measureFps()
        window.requestAnimationFrame(run)
      }
    }
  
    function measureFps () {
      const newTime = window.performance.now()
      if (ppu.frame % 20 === 0) {
        let fps =  1000 / ((newTime - oldTime) / (ppu.frame - oldFrame))
        fpsEle.innerHTML = `fps: ${fps.toFixed(0)}`
        oldFrame = ppu.frame
        oldTime = newTime
      }
    }
  
  
  }
}

function settings () {
  const scanlinesInput = document.querySelector('#scanlines')
  const scanlinesImg = document.querySelector('#canvas img')

  scanlines.addEventListener('change', (e) => {
    scanlinesImg.classList.toggle('hide') 
  })

  const romSelectors = document.querySelectorAll('#romSelection div.line')
  romSelectors.forEach(i => i.addEventListener('click', e => {
    selectedRom = e.target.getAttribute('data-option')
    running = false
    delete emulation.nes
    delete emulation.display
    delete emulation.cart
    document.querySelector('#status').textContent = "Status: Not running"
    canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height)
    runCartridge()
  }))
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

