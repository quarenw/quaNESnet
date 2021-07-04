const canvas = document.querySelector('#canvas canvas')
console.log(canvas)
const display = new Display(canvas)
// const ctx = canvas.getContext('2d')
// ctx.fillStyle = 'green'
// ctx.fillRect(5, 5, 5, 5)

const url = './smb.nes'
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

  document.addEventListener('click', () => {
    console.log('Clocking')
    nes.clock()
  })

}

request.open('GET', url, true)
request.send(null)
