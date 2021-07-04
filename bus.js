function Bus () {
	this.nSystemClockCounter = 0
	this.cpuRam = initRam(2048)
	this.cpu = new Cpu()
	this.ppu = new Ppu()
	this.controller = []
	this.controllerState = []

	this.cpu.connectBus(this)

	this.cpuWrite = (addr, data) => {
		if (this.cart.cpuWrite(addr, data)) {}
		else if (addr >= 0x0000 && addr <= 0x1FFF) {
			this.cpuRam[addr & 0x07FF] = data
		}
		else if (addr >= 0x2000 && addr <= 0x3FFF) {
			this.ppu.cpuWrite(addr & 0x0007, data)
		}
		else if (addr >= 0x4016 && addr <= 0x4017) {
			this.controllerState[addr & 0x0001] = this.controller[addr & 0x0001]
		}
	}

	this.cpuRead = (addr, readOnly) => {
		let data = 0x00
		const read = this.cart.cpuRead(addr, data)
		if (read.output) { data = read.data }
		else if (addr >= 0x0000 && addr <= 0x1FFF) {
			data = this.cpuRam[addr & 0x07FF]
		}
		else if (addr >= 0x2000 && addr <= 0x3FFF) {
			data = this.ppu.cpuRead(addr & 0x0007, readOnly)
		}
		else if (addr >= 0x4016 && addr <= 0x4017) {
			data = (this.controllerState[addr & 0x0001] & 0x80) > 0
			this.controllerState[addr & 0x0001] <<= 1
		}
		return data
	}

	this.insertCartridge = (cartridge) => {
		this.cart = cartridge
		this.ppu.connectCartridge(cartridge)
	}

	this.attachDisplay = (display) => {
		this.ppu.attachDisplay(display)
	}

	this.reset = () => {
		this.cart.reset()
		this.cpu.reset()
		this.ppu.reset()
		this.nSystemClockCounter = 0
	}

	this.clock = () => {
		this.ppu.clock()
		if (this.nSystemClockCounter % 3 === 0) this.cpu.clock()
		if (this.ppu.nmi) {
			this.ppu.nmi = false
			this.cpu.nmi()
		}
		this.nSystemClockCounter++
	}
}

function initRam (amount) {
	const arr = []
	for (let i = 0; i < (amount); i++) arr[i] = 0x00
	return arr
}