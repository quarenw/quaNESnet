const canvas = document.querySelector('#canvas canvas')
console.log(canvas)
const display = new Display(canvas)
let running = false 
let frame = 0
let oldTime = window.performance.now()
let fpsEle = document.querySelector('#fps')

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

  // document.addEventListener('click', () => {
  //   run()
  // })

  window.onkeydown = e => {
    if (e.keyCode == 32) {
      running = !running
      run()
    }
  }

  function run () {
    const cycles = (341 * 262 /3) | 0
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
