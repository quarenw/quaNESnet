function Bus () {
	this.nSystemClockCounter = 0
	this.cpuRam = new Uint8Array(2048)
	this.cpu = new Cpu()
	this.ppu = new Ppu()
	this.controller = []
	this.controllerState = []

	initDebug(this.cpu, this.cpuRam, this.ppu)

	this.cpu.connectBus(this)

	this.cpuWrite = (addr, data) => {
		const read = this.cart.cpuWrite(addr, data)
		if (read) {}
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

function initDebug (cpu, cpuRam, ppu) {
	window.cpu = cpu
	window.cpuRam = cpuRam
	window.ppu = ppu

	window.dumpPPURAM = () => {
		console.log(`VRAM: ${ppu.vramAddr[0].toString(16)} TRAM: ${ppu.tramAddr[0].toString(16)}`)
	}

	window.dumpCPU = () => {
		console.log(`
			${hex(cpu.pc[0], 4).toUpperCase()}: ${cpu.lookup[cpu.opcode[0]].name}(${hex(cpu.opcode[0])})
	 		${hex(cpu.read(cpu.pc[0] + 1)).toUpperCase()}
	 		${hex(cpu.read(cpu.pc[0] + 2)).toUpperCase()}
	 		${hex(cpu.read(cpu.pc[0] + 3)).toUpperCase()}
	 		Adr:${cpu.lookup[cpu.opcode[0]].addrName}
	 		(${cpu.debugStatus()})
	 		a: ${hex(cpu.a[0])}  x: ${hex(cpu.x[0])}   y: ${hex(cpu.y[0])}   stack: ${hex(cpu.stkp[0])}
	 		`.replaceAll(/\t|\n|\r/ig, ''))
	}
}