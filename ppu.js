function Ppu () {
	this.cycle = 0
	this.scanline = 0
	this.frameComplete = false



	this.connectCartridge = (cartridge) => {
		this.cart = cartridge
	}

	this.attachDisplay = (display) => {
		this.display = display
	}

	this.clock = () => {
		this.display.renderPixel(this.cycle - 1, this.scanline, 80)
		this.display.updateScreen()

		this.cycle++
		if (this.cycle >= 341) {
			this.cycle = 0
			this.scanline++
			if (this.scanline >= 261) {
				this.scanline = -1
				this.frameComplete = true
			}
		}
	}
}
