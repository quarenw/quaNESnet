function Ppu () {
	this.cycle = 0
	this.scanline = 0
	this.frameComplete = false
	this.frame = 0


	this.cpuRead = (addr, readOnly) => {
		let data = 0x00
		switch (addr) {
			case 0x0000:
				break
			case 0x0001:
				break
			case 0x0002:
				break
			case 0x0003:
				break
			case 0x0004:
				break
			case 0x0005:
				break
			case 0x0006:
				break
			case 0x0007:
				break
		}
		return data
	}

	this.cpuWrite = (addr, data) => {
		switch (addr) {
			case 0x0000:
				break
			case 0x0001:
				break
			case 0x0002:
				break
			case 0x0003:
				break
			case 0x0004:
				break
			case 0x0005:
				break
			case 0x0006:
				break
			case 0x0007:
				break
		}
	}

	this.ppuRead = (addr, readOnly) => {
		addr &= 0x3FFF
		const read = this.cart.ppuRead(addr, data)
		if (read.output) {}
		return read.data || 0x00
	}

	this.ppuWrite = (addr, data) => {
		addr &= 0x3FFF

		if (this.cart.ppuWrite(addr, data)) {}
	}

	this.connectCartridge = (cartridge) => {
		this.cart = cartridge
	}

	this.reset = () => {
		
	}

	this.attachDisplay = (display) => {
		this.display = display
	}

	this.clock = () => {
		this.display.renderPixel(this.cycle - 1, this.scanline, 80)
		
		this.cycle++
		if (this.cycle >= 341) {
			this.cycle = 0
			this.scanline++
			if (this.scanline >= 261) {
				this.display.updateScreen()
				this.scanline = -1
				this.frameComplete = true
				this.frame++
			}
		}
	}
}
