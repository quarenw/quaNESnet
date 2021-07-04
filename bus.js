function Bus () {
	this.nSystemClockCounter = 0
	this.cpuRam = initRam(2048)
	this.cpu = new Cpu()
	this.ppu = new Ppu()

	this.cpu.connectBus(this)

	this.cpuWrite = (addr, data) => {
		if (this.cart.cpuWrite(addr, data)) {}
		else if (addr >= 0x0000 && addr <= 0x1FFF) {
			this.cpuRam[addr & 0x07FF] = data
		}
		else if (add >= 0x2000 && addr <= 0x3FFF) {
			this.ppu.cpuWrite(addr & 0x0007, data)
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
		this.cpu.reset()
		this.nSystemClockCounter = 0
	}

	this.clock = () => {
		this.ppu.clock()
		if (this.nSystemClockCounter % 3 === 0) this.cpu.clock()
		this.nSystemClockCounter++
	}
}

function initRam (amount) {
	const arr = []
	for (let i = 0; i < (amount); i++) arr[i] = 0x00
	return arr
}