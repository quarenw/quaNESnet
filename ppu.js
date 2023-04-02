function Ppu () {
	this.cycle = 0
	this.scanline = 0
	this.frameComplete = false
	this.frame = 0
	this.nmi = false

	this.tblName = [
		new Uint8Array(1024),
		new Uint8Array(1024)
	]

	this.tblPattern = [
		new Uint8Array(4096),
		new Uint8Array(4096)
	]
	
	this.tblPalette = new Uint8Array(32)

	this.status = new Uint8Array(1)
	this.mask = new Uint8Array(1)
	this.control = new Uint8Array(1)
	this.vramAddr = new Uint16Array(1)
	this.tramAddr = new Uint16Array(1)
	
	this.fineX = new Uint8Array(1)

	this.addrLatch = new Uint8Array(1)
	this.ppuDataBuffer = new Uint8Array(1)

	this.bgNextTileId = new Uint8Array(1)
	this.bgNextTileAttr = new Uint8Array(1)
	this.bgNextTileLsb = new Uint8Array(1)
	this.bgNextTileMsb = new Uint8Array(1)
	this.bgShifterPatternLo = new Uint16Array(1)
	this.bgShifterPatternHi = new Uint16Array(1)
	this.bgShifterAttributeLo = new Uint16Array(1)
	this.bgShifterAttributeHi = new Uint16Array(1)

	this.statusLookup = {
		name: 'status',
		// First 5 unused
		spriteOverflow: 5,
		spriteZeroHit: 6,
		verticalBlank: 7
	}

	this.maskLookup = {
		name: 'mask',
		grayscale: 0,
		renderBackgroundLeft: 1,
		renderSpritesLeft: 2,
		renderBackground: 3,
		renderSprites: 4,
		enhanceRed: 5,
		enhanceGreen: 6,
		enhanceBlue: 7
	}

	this.controlLookup = {
		name: 'control',
		nameTableX: 0,
		nameTableY: 1,
		incrementMode: 2,
		patternSprite: 3,
		patternBackground: 4,
		spriteSize: 5,
		slaveMode: 6,
		enableNmi: 7
	}

	this.loopyLookup = {
		vramName: 'vramAddr',
		tramName: 'tramAddr',
		courseX: 0,
		courseY: 5,
		nameTableX: 10,
		nameTableY: 11,
		fineY: 12
		// Last bit unused
	}

	this.sObjectAttributeEntry = new Uint8Array(256) // uint8 [y, id, attr, x] x 64
	this.oamAddr = new Uint8Array(1)
	this.oamAddr[0] = 0x00

	this.spriteScanline = new Uint8Array(32)
	this.scanY = 0
	this.scanId = 1
	this.scanAttr = 2
	this.scanX = 3
	this.spriteCount = new Uint8Array(1)

	this.spriteShifterPatternLo = new Uint8Array(8)
	this.spriteShifterPatternHi = new Uint8Array(8)

	this.spriteZeroHitPossible = false
	this.spriteZeroBeingRendered = false

	// Global vars
	let bgPixel = new Uint8Array(1)
	let bgPalette = new Uint8Array(1)
	let cpu_data = new Uint8Array(1)
	let spritePatternBitsLo = new Uint8Array(1)
	let spritePatternBitsHi = new Uint8Array(1)
	let spritePatternAddrLo = new Uint16Array(1)
	let spritePatternAddrHi = new Uint16Array(1)
	let bitMux = new Uint16Array(1)
	let p0Pixel = new Uint8Array(1)
	let p1Pixel = new Uint8Array(1)
	let bgPal0 = new Uint8Array(1)
	let bgPal1 = new Uint8Array(1)
	let fgPixel = new Uint8Array(1)
	let fgPallet = new Uint8Array(1)
	let fgPriority = new Uint8Array(1)
	let fgPixelLo = new Uint8Array(1)
	let fgPixelHi	 = new Uint8Array(1)
	let pixel = new Uint8Array(1)
	let palette = new Uint8Array(1)
	let nOAMEntry = new Uint8Array(1)
	let diff = new Int16Array(1)

	this.readBit = (reg, position) => {
		return (this[reg][0] >> position) & 1
	}

	this.readMulti = (reg, offset, size) => {
		return (this[reg][0] >> offset) & ((1 << size) - 1)
	}

	this.setBit = (reg, position, value) => {
		value = value & 1
		this[reg][0] = (this[reg][0] & ~(1 << position)) | (value << position)
	}

	this.setMulti = (reg, offset, size, value) => {
		let mask = (1 << size) - 1
		this[reg][0] = this[reg][0] & ~(mask << offset) | (value << offset)
	}

	this.readCourseX = (ramType) => this.readMulti(ramType, 0, 5)
	this.readCourseY = (ramType) => this.readMulti(ramType, 5, 5)
	this.readFineY = (ramType) => this.readMulti(ramType, 12, 3)
	this.setCourseX = (ramType, data) => this.setMulti(ramType, 0, 5, data)
	this.setCourseY = (ramType, data) => this.setMulti(ramType, 5, 5, data)
	this.setFineY = (ramType, data) => this.setMulti(ramType, 12, 3, data)

	this.getColorFromPaletteRam = (palette, pixel) => {
		const index = this.ppuRead(0x3F00 + (palette << 2) + pixel) & 0x3F
		return this.PALETTES[index]
	}

	this.cpuRead = (addr, readOnly) => {
		cpu_data[0] = 0x00
		if (this.readOnly) {
			switch (addr) {
				case 0x0000:
					cpu_data[0] = this.control[0]
					break
				case 0x0001:
					cpu_data[0] = this.mask[0]
					break
				case 0x0002:
					cpu_data[0] = this.status[0]
					break
				case 0x0003:
					break
				case 0x0004:
					cpu_data = this.sObjectAttributeEntry[this.oamAddr[0]]
					break
				case 0x0005:
					break
				case 0x0006:
					break
				case 0x0007:
					break
			}
		} else {
			switch(addr) {
				case 0x0000: break
				case 0x0001: break
				case 0x0002:
					cpu_data[0] = (this.status[0] & 0xE0) | (this.ppuDataBuffer[0] & 0x1F)
					this.setBit(this.statusLookup.name, this.statusLookup['verticalBlank'], 0)
					this.addrLatch[0] = 0
					break
				case 0x0003: break
				case 0x0004: break
				case 0x0005: break
				case 0x0006: break
				case 0x0007:
					cpu_data[0] = this.ppuDataBuffer[0]
					this.ppuDataBuffer[0] = this.ppuRead(this.vramAddr[0])
					if (this.vramAddr[0] >= 0x3F00) cpu_data[0] = this.ppuDataBuffer[0]
					this.vramAddr[0] += (this.readBit(this.controlLookup.name, this.controlLookup['incrementMode']) ? 32 : 1)
					break
			}
		}
		return cpu_data[0]
	}

	this.cpuWrite = (addr, data) => {
		switch (addr) {
			case 0x0000:
				this.control[0] = data
				this.setBit(this.loopyLookup.tramName, this.loopyLookup['nameTableX'], this.readBit(this.controlLookup.name, this.controlLookup['nameTableX']))
				this.setBit(this.loopyLookup.tramName, this.loopyLookup['nameTableY'], this.readBit(this.controlLookup.name, this.controlLookup['nameTableY']))
				break
			case 0x0001:
				this.mask[0] = data
				break
			case 0x0002:
				break
			case 0x0003:
				this.oamAddr[0] = data
				break
			case 0x0004:
				this.sObjectAttributeEntry[this.oamAddr[0]] = data
				break
			case 0x0005:
				if (this.addrLatch[0] == 0) {
					this.fineX[0] = data & 0x07
					this.setCourseX(this.loopyLookup.tramName, data >> 3)
					this.addrLatch[0] = 1
				} else {
					this.setFineY(this.loopyLookup.tramName, data & 0x07)
					this.setCourseY(this.loopyLookup.tramName, data >> 3)
					this.addrLatch[0] = 0
				}
				break
			case 0x0006:
				if (this.addrLatch[0] == 0) {
					this.tramAddr[0] = ((data & 0x3F) << 8) | (this.tramAddr[0] & 0x00FF)
					this.addrLatch[0] = 1
				} else {
					this.tramAddr[0] = (this.tramAddr[0] & 0xFF00) | data
					this.vramAddr[0] = this.tramAddr[0]
					this.addrLatch[0] = 0
				}
				break
			case 0x0007:
				this.ppuWrite(this.vramAddr[0], data)
				this.vramAddr[0] += (this.readBit(this.controlLookup.name, this.controlLookup['incrementMode']) ? 32 : 1)
				break
		}
	}

	this.ppuRead = (addr, readOnly) => {
		addr &= 0x3FFF
		let { data, output } = this.cart.ppuRead(addr)
		if (output) {

		} else if (addr >= 0x0000 && addr <= 0x1FFF) {
			data = this.tblPattern[(addr & 0x100) >> 12][addr & 0x0FFF]
		} else if (addr >= 0x2000 && addr <= 0x3EFF) {
			addr &= 0x0FFF
			if (this.cart.mirror == 'VERTICAL') {
				if (addr >= 0x0000 && addr <= 0x03FF) data = this.tblName[0][addr & 0x03FF]
				if (addr >= 0x0400 && addr <= 0x07FF) data = this.tblName[1][addr & 0x03FF]
				if (addr >= 0x0800 && addr <= 0x0BFF) data = this.tblName[0][addr & 0x03FF]
				if (addr >= 0x0C00 && addr <= 0x0FFF) data = this.tblName[1][addr & 0x03FF]
			} else if (this.cart.mirror == 'HORIZONTAL') {
				if (addr >= 0x0000 && addr <= 0x03FF) data = this.tblName[0][addr & 0x03FF]
				if (addr >= 0x0400 && addr <= 0x07FF) data = this.tblName[0][addr & 0x03FF]
				if (addr >= 0x0800 && addr <= 0x0BFF) data = this.tblName[1][addr & 0x03FF]
				if (addr >= 0x0C00 && addr <= 0x0FFF) data = this.tblName[1][addr & 0x03FF]
			}
		} else if (addr >= 0x3F00 && addr <= 0x3FFF) {
			addr &= 0x001F
			if (addr == 0x0010) addr = 0x0000
			if (addr == 0x0014) addr = 0x0004
			if (addr == 0x0018) addr = 0x0008
			if (addr == 0x001C) addr = 0x000C
			data = this.tblPalette[addr] & (this.readBit(this.maskLookup.name, this.maskLookup['grayscale']) ? 0x30 : 0x3F)
		}
		return data
	}

	this.ppuWrite = (addr, data) => {
		addr &= 0x3FFF

		let writeStatus = this.cart.ppuWrite(addr, data)
		if (writeStatus) {

		} else if (addr >= 0x0000 && addr <= 0x1FFF) {
			this.tblPattern[(addr & 0x1000) >> 12][addr & 0x0FFF] = data
		} else if (addr >= 0x2000 && addr <= 0x3EFF) {
			addr &= 0x0FFF
			if (this.cart.mirror == 'VERTICAL') {
				if (addr >= 0x0000 && addr <= 0x03FF) this.tblName[0][addr & 0x03FF] = data
				if (addr >= 0x0400 && addr <= 0x07FF) this.tblName[1][addr & 0x03FF] = data
				if (addr >= 0x0800 && addr <= 0x0BFF) this.tblName[0][addr & 0x03FF] = data
				if (addr >= 0x0C00 && addr <= 0x0FFF) this.tblName[1][addr & 0x03FF] = data
			} else if (this.cart.mirror == 'HORIZONTAL') {
				if (addr >= 0x0000 && addr <= 0x03FF) this.tblName[0][addr & 0x03FF] = data
				if (addr >= 0x0400 && addr <= 0x07FF) this.tblName[0][addr & 0x03FF] = data
				if (addr >= 0x0800 && addr <= 0x0BFF) this.tblName[1][addr & 0x03FF] = data
				if (addr >= 0x0C00 && addr <= 0x0FFF) this.tblName[1][addr & 0x03FF] = data
			}
		} else if (addr >= 0x3F00 && addr <= 0x3FFF) {
			addr &= 0x001F
			if (addr == 0x0010) addr = 0x0000
			if (addr == 0x0014) addr = 0x0004
			if (addr == 0x0018) addr = 0x0008
			if (addr == 0x001C) addr = 0x000C
			this.tblPalette[addr] = data
		}
	}

	this.connectCartridge = (cartridge) => {
		this.cart = cartridge
	}

	this.reset = () => {
		this.fineX = new Uint8Array(1)

		this.addrLatch = new Uint8Array(1)
		this.ppuDataBuffer = new Uint8Array(1)

		this.cycle = 0
		this.scanline = 0

		this.bgNextTileId = new Uint8Array(1)
		this.bgNextTileAttr = new Uint8Array(1)
		this.bgNextTileLsb = new Uint8Array(1)
		this.bgNextTileMsb = new Uint8Array(1)
		this.bgShifterPatternLo = new Uint16Array(1)
		this.bgShifterPatternHi = new Uint16Array(1)
		
		this.status = new Uint8Array(1)
		this.mask = new Uint8Array(1)
		this.control = new Uint8Array(1)
		this.vramAddr = new Uint16Array(1)
		this.tramAddr = new Uint16Array(1)
	}

	this.attachDisplay = (display) => {
		this.display = display
	}

	this.clock = () => {

		const incrementScrollX = () => {
			if (this.readBit(this.maskLookup.name, this.maskLookup['renderBackground'])
				|| this.readBit(this.maskLookup.name, this.maskLookup['renderSprites'])) {
					if (this.readCourseX(this.loopyLookup.vramName) == 31) {
						this.setCourseX(this.loopyLookup.vramName, 0)
						this.setBit(this.loopyLookup.vramName, this.loopyLookup['nameTableX'],
							~this.readBit(this.loopyLookup.vramName, this.loopyLookup['nameTableX']))
					} else {
						this.setCourseX(this.loopyLookup.vramName, this.readCourseX(this.loopyLookup.vramName) + 1)
					}
				}
		}

		const incrementScrollY = () => {
			if (this.readBit(this.maskLookup.name, this.maskLookup['renderBackground'])
			|| this.readBit(this.maskLookup.name, this.maskLookup['renderSprites'])) {
				if (this.readFineY(this.loopyLookup.vramName) < 7) {
					this.setFineY(this.loopyLookup.vramName, this.readFineY(this.loopyLookup.vramName) + 1)
				} else {
					this.setFineY(this.loopyLookup.vramName, 0)

					if (this.readCourseY(this.loopyLookup.vramName) == 29) {
						this.setCourseY(this.loopyLookup.vramName, 0)
						this.setBit(this.loopyLookup.vramName, this.loopyLookup['nameTableY'],
							~this.readBit(this.loopyLookup.vramName, this.loopyLookup['nameTableY']))
					} else if (this.readCourseY(this.loopyLookup.vramName) == 31) {
						this.setCourseY(this.loopyLookup.vramName, 0)
					} else {
						this.setCourseY(this.loopyLookup.vramName, this.readCourseY(this.loopyLookup.vramName) + 1)
					}
				}
			}
		}

		const transferAddressX = () => {
			if (this.readBit(this.maskLookup.name, this.maskLookup['renderBackground'])
				|| this.readBit(this.maskLookup.name, this.maskLookup['renderSprites'])) {
				this.setBit(this.loopyLookup.vramName, this.loopyLookup['nameTableX'], this.readBit(this.loopyLookup.tramName, this.loopyLookup['nameTableX']))
				this.setCourseX(this.loopyLookup.vramName, this.readCourseX(this.loopyLookup.tramName))
			}
		}

		const transferAddressY = () => {
			if (this.readBit(this.maskLookup.name, this.maskLookup['renderBackground'])
				|| this.readBit(this.maskLookup.name, this.maskLookup['renderSprites'])) {
				this.setFineY(this.loopyLookup.vramName, this.readFineY(this.loopyLookup.tramName))
				this.setBit(this.loopyLookup.vramName, this.loopyLookup['nameTableY'], this.readBit(this.loopyLookup.tramName, this.loopyLookup['nameTableY']))
				this.setCourseY(this.loopyLookup.vramName, this.readCourseY(this.loopyLookup.tramName))
			}
		}

		const loadBackgrounShifters = () => {
			this.bgShifterPatternLo[0] = (this.bgShifterPatternLo[0] & 0xFF00) | this.bgNextTileLsb[0]
			this.bgShifterPatternHi[0] = (this.bgShifterPatternHi[0] & 0xFF00) | this.bgNextTileMsb[0]

			this.bgShifterAttributeLo[0] = (this.bgShifterAttributeLo[0] & 0xFF00) | ((this.bgNextTileAttr[0] & 0b01) ? 0xFF : 0x00)
			this.bgShifterAttributeHi[0] = (this.bgShifterAttributeHi[0] & 0xFF00) | ((this.bgNextTileAttr[0] & 0b10) ? 0xFF : 0x00)
		}

		const updateShifters = () => {
			if (this.readBit(this.maskLookup.name, this.maskLookup['renderBackground'])) {
				this.bgShifterPatternLo[0] <<= 1
				this.bgShifterPatternHi[0] <<= 1

				this.bgShifterAttributeLo[0] <<= 1
				this.bgShifterAttributeHi[0] <<= 1
			}

			if (this.readBit(this.maskLookup.name, this.maskLookup['renderSprites']) && this.cycle >=1 && this.cycle < 258) {
				for (let i = 0; i < this.spriteCount[0]; i++) {
					if (this.spriteScanline[i * 4 + this.scanX] > 0) {
						this.spriteScanline[i * 4 + this.scanX]--
					}
					else {
						this.spriteShifterPatternLo[i] <<= 1
						this.spriteShifterPatternHi[i] <<= 1
					}
				}
			}
		}

		if (this.scanline >= -1 && this.scanline < 240) {
			if (this.scanline == 0 && this.cycle == 0) this.cycle = 1
			if (this.scanline == -1 && this.cycle == 1) {
				this.setBit(this.statusLookup.name, this.statusLookup['verticalBlank'], 0)
				this.setBit(this.statusLookup.name, this.statusLookup['spriteZeroHit'], 0)
				this.setBit(this.statusLookup.name, this.statusLookup['spriteOverflow'], 0)
				for (let i = 0; i < 8; i++) {
					this.spriteShifterPatternLo[i] = 0
					this.spriteShifterPatternHi[i] = 0
				}
			}
			if ((this.cycle >= 2 && this.cycle < 258) || (this.cycle >= 321 && this.cycle < 338)) {
				updateShifters()
				switch((this.cycle - 1) % 8) {
					case 0:
						loadBackgrounShifters()
						this.bgNextTileId[0] = this.ppuRead(0x2000 | (this.vramAddr[0] & 0x0FFF))
						break
					case 2:
						this.bgNextTileAttr[0] = this.ppuRead(0x23C0 | (this.readBit(this.loopyLookup.vramName, this.loopyLookup['nameTableY']) << 11)
																													| (this.readBit(this.loopyLookup.vramName, this.loopyLookup['nameTableX']) << 10)
																													| ((this.readCourseY(this.loopyLookup.vramName) >> 2) << 3)
																													| (this.readCourseX(this.loopyLookup.vramName) >> 2))

						if (this.readCourseY(this.loopyLookup.vramName) & 0x02) this.bgNextTileAttr[0] >>= 4
						if (this.readCourseX(this.loopyLookup.vramName) & 0x02) this.bgNextTileAttr[0] >>= 2
						this.bgNextTileAttr[0] &= 0x03
						break
					case 4:
						this.bgNextTileLsb[0] = this.ppuRead((this.readBit(this.controlLookup.name, this.controlLookup['patternBackground']) << 12)
																											+ (this.bgNextTileId[0] << 4)
																											+ (this.readFineY(this.loopyLookup.vramName) + 0))
						break
					case 6:
						this.bgNextTileMsb[0] = this.ppuRead((this.readBit(this.controlLookup.name, this.controlLookup['patternBackground']) << 12)
																											+ (this.bgNextTileId[0] << 4)
																											+ (this.readFineY(this.loopyLookup.vramName) + 8))
						break
					case 7:
						incrementScrollX()
						break
				}
			}

			if (this.cycle == 256) incrementScrollY()
			if (this.cycle == 257) {
				loadBackgrounShifters()
				transferAddressX()
			}
			if (this.cycle == 338 || this.cycle == 340) this.bgNextTileId[0] = this.ppuRead(0x2000 | (this.vramAddr[0] & 0x0FFF))
			if (this.scanline == -1 && this.cycle >= 280 && this.cycle < 305) transferAddressY()
		}

		// Foreground
		if (this.cycle == 257 && this.scanline >= 0) {
			this.spriteScanline = new Uint8Array(Array(this.spriteScanline.length).fill(0xFF))
			this.spriteCount[0] = 0

			nOAMEntry[0] = 0x00
			this.spriteZeroHitPossible = false
			while (nOAMEntry[0] < 64 && this.spriteCount[0] < 9) {
				diff[0] = 0x00
				diff[0] = this.scanline - this.sObjectAttributeEntry[nOAMEntry[0] * 4 + this.scanY] // Problematic?
				if (diff[0] >= 0 && diff[0] < (this.readBit(this.controlLookup.name, this.controlLookup['spriteSize']) ? 16 : 8)) {
					if (this.spriteCount[0] < 8) {   
						if (nOAMEntry[0] == 0) this.spriteZeroHitPossible = true
						let normalArr = Array.from(this.spriteScanline)
						normalArr.splice(this.spriteCount[0] * 4, 4, ...Array.from(this.sObjectAttributeEntry.slice(nOAMEntry[0] * 4, nOAMEntry[0] * 4 + 4)))
						this.spriteScanline = new Uint8Array(normalArr)
						this.spriteCount[0]++
					}
				}
				nOAMEntry[0]++
			}
			if (this.spriteCount[0] > 8) this.setBit(this.statusLookup.name, this.statusLookup['spriteOverflow'], 1)
		}

		if (this.cycle === 340) {
			for (let i = 0; i < this.spriteCount[0]; i++) {
				spritePatternBitsLo[0] = 0x00
				spritePatternBitsHi[0] = 0x00
				spritePatternAddrLo[0] = 0x00
				spritePatternAddrHi[0] = 0x00

				if (!this.readBit(this.controlLookup.name, this.controlLookup['spriteSize'])) {
					if (!(this.spriteScanline[i * 4 + this.scanAttr] & 0x80)) {
						spritePatternAddrLo[0] = 
							(this.readBit(this.controlLookup.name, this.controlLookup['patternSprite']) << 12)
							| (this.spriteScanline[i * 4 + this.scanId] << 4)
							| (this.scanline - this.spriteScanline[i * 4 + this.scanY])
					}
					else {
						spritePatternAddrLo[0] = 
							(this.readBit(this.controlLookup.name, this.controlLookup['patternSprite']) << 12)
							| (this.spriteScanline[i * 4 + this.scanId] << 4)
							| (7 - this.scanline - this.spriteScanline[i * 4 + this.scanY])
					}
				}
				else {
					if (!(this.spriteScanline[i * 4 + this.scanAttr] & 0x80)) {
						if (this.scanline - this.spriteScanline[i * 4 + this.scanY] < 8) {
							spritePatternAddrLo[0] =
								((this.spriteScanline[i * 4 + this.scanId] & 0x01) << 12)
								| ((this.spriteScanline[i * 4 + this.scanId] && 0xFE) << 4)
								| ((this.scanline - this.spriteScanline[i * 4 + this.scanY] & 0x07))
						}
						else {
							spritePatternAddrLo[0] =
								((this.spriteScanline[i * 4 + this.scanId] & 0x01) << 12)
								| (((this.spriteScanline[i * 4 + this.scanId] && 0xFE) + 1) << 4)
								| ((this.scanline - this.spriteScanline[i * 4 + this.scanY] & 0x07))
						}
					}
					else {
						if (this.scanline - this.spriteScanline[i * 4 + this.scanY] < 8) {
							spritePatternAddrLo[0] =
								((this.spriteScanline[i * 4 + this.scanId] & 0x01) << 12)
								| (((this.spriteScanline[i * 4 + this.scanId] && 0xFE) + 1) << 4)
								| (7 - (this.scanline - this.spriteScanline[i * 4 + this.scanY] & 0x07))
						}
						else {
								spritePatternAddrLo[0] =
									((this.spriteScanline[i * 4 + this.scanId] & 0x01) << 12)
									| ((this.spriteScanline[i * 4 + this.scanId] && 0xFE) << 4)
									| (7 - (this.scanline - this.spriteScanline[i * 4 + this.scanY] & 0x07))
						}
					}
				}
				spritePatternAddrHi[0] = spritePatternAddrLo[0] + 8
				spritePatternBitsLo[0] = this.ppuRead(spritePatternAddrLo[0])
				spritePatternBitsHi[0] = this.ppuRead(spritePatternAddrHi[0])

				if (this.spriteScanline[i * 4 + this.scanAttr] & 0x40) {
					spritePatternBitsLo[0] = flipbyte(spritePatternBitsLo[0])
					spritePatternBitsHi[0] = flipbyte(spritePatternBitsHi[0])
				}
				this.spriteShifterPatternLo[i] = spritePatternBitsLo[0]
				this.spriteShifterPatternHi[i] = spritePatternBitsHi[0]
			}
		}

		if (this.scanline == 240) {}

		if (this.scanline >= 241 && this.scanline < 261) {
			if (this.scanline == 241 && this.cycle == 1) {
				this.setBit(this.statusLookup.name, this.statusLookup['verticalBlank'], 1)
				if (this.readBit(this.controlLookup.name, this.controlLookup['enableNmi'])) this.nmi = true
			}
		}

		bgPixel[0] = 0x00
		bgPalette[0] = 0x00

		if (this.readBit(this.maskLookup.name, this.maskLookup['renderBackground'])) {
			bitMux[0] = 0x00
			bitMux[0] = 0x8000 >> this.fineX[0]

			p0Pixel[0] = 0x00
			p1Pixel[0] = 0x00
			p0Pixel[0] = (this.bgShifterPatternLo[0] & bitMux[0]) > 0
			p1Pixel[0] = (this.bgShifterPatternHi[0] & bitMux[0]) > 0

			bgPixel[0] = (p1Pixel[0] << 1) | p0Pixel[0]

			bgPal0[0] = 0x00
			bgPal1[0] = 0x00
			bgPal0[0] = (this.bgShifterAttributeLo[0] & bitMux[0]) > 0
			bgPal1[0] = (this.bgShifterAttributeHi[0] & bitMux[0]) > 0

			bgPalette[0] = (bgPal1[0] << 1) | bgPal0[0]
		}

		fgPixel[0] = 0x00
		fgPallet[0] = 0x00
		fgPriority[0] = 0x00

		if (this.readBit(this.maskLookup.name, this.maskLookup['renderSprites'])) {
			this.spriteZeroBeingRendered = false
			for (let i = 0; i < this.spriteCount[0]; i++) {
				if (this.spriteScanline[i * 4 + this.scanX] == 0) {
					fgPixelLo[0] = 0x00
					fgPixelHi[0] = 0x00
					fgPixelLo[0] = (this.spriteShifterPatternLo[i] & 0x80) > 0
					fgPixelHi[0] = (this.spriteShifterPatternHi[i] & 0x80) > 0
					fgPixel[0] = (fgPixelHi[0] << 1) | (fgPixelLo[0])

					fgPallet[0] = (this.spriteScanline[i * 4 + this.scanAttr] & 0x03) + 0x04
					fgPriority[0] = (this.spriteScanline[i * 4 + this.scanAttr] & 0x20) == 0

					if (fgPixel[0] != 0) {
						if (i == 0) this.spriteZeroBeingRendered = true
						break
					}
				}
			}
		}

		pixel[0] = 0x00
		palette[0] = 0x00

		if (bgPixel[0] == 0 && fgPixel[0] == 0) {
			pixel[0] = 0x00
			palette[0] = 0x00
		}
		else if (bgPixel[0] == 0 && fgPixel[0] > 0) {
			pixel[0] = fgPixel[0]
			palette[0] = fgPallet[0]
		}
		else if (bgPixel[0] > 0 && fgPixel[0] == 0) {
			pixel[0] = bgPixel[0]
			palette[0] = bgPalette[0]
		}
		else if (bgPixel[0] > 0 && fgPixel[0] > 0) {
			if (fgPriority[0]) {
				pixel[0] = fgPixel[0]
				palette[0] = fgPallet[0]
			}
			else {
				pixel[0] = bgPixel[0]
				palette[0] = bgPalette[0]
			}

			if (this.spriteZeroBeingRendered && this.spriteZeroHitPossible) {
				if (this.readBit(this.maskLookup.name, this.maskLookup['renderBackground'])
					& this.readBit(this.maskLookup.name, this.maskLookup['renderSprites'])) {
						if (~(this.readBit(this.maskLookup.name, this.maskLookup['renderBackgroundLeft'])
							| this.readBit(this.maskLookup.name, this.maskLookup['renderSpritesLeft']))) {
								if (this.cycle >= 9 && this.cycle < 258) {
									this.setBit(this.statusLookup.name, this.statusLookup['spriteZeroHit'], 1)
								}
							} else {
								if (this.cycle >= 1 && this.cycle < 258) {
									this.setBit(this.statusLookup.name, this.statusLookup['spriteZeroHit'], 1)
								}
							}
					}
			}
		}

		let pxlColor = this.getColorFromPaletteRam(palette[0], pixel[0])
		this.display.renderPixel(this.cycle - 1, this.scanline, pxlColor)
		
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

	this.PALETTES = [
		0xff757575,
		0xff8f1b27,
		0xffab0000,
		0xff9f0047,
		0xff77008f,
		0xff1300ab,
		0xff0000a7,
		0xff000b7f,
		0xff002f43,
		0xff004700,
		0xff005100,
		0xff173f00,
		0xff5f3f1b,
		0xff000000,
		0xff000000,
		0xff000000,
		0xffbcbcbc,
		0xffef7300,
		0xffef3b23,
		0xfff30083,
		0xffbf00bf,
		0xff5b00e7,
		0xff002bdb,
		0xff0f4fcb,
		0xff00738b,
		0xff009700,
		0xff00ab00,
		0xff3b9300,
		0xff8b8300,
		0xff000000,
		0xff000000,
		0xff000000,
		0xffffffff,
		0xffffbf3f,
		0xffff975f,
		0xfffd8ba7,
		0xffff7bf7,
		0xffb777ff,
		0xff6377ff,
		0xff3b9bff,
		0xff3fbff3,
		0xff13d383,
		0xff4bdf4f,
		0xff98f858,
		0xffdbeb00,
		0xff000000,
		0xff000000,
		0xff000000,
		0xffffffff,
		0xffffe7ab,
		0xffffd7c7,
		0xffffcbd7,
		0xffffc7ff,
		0xffdbc7ff,
		0xffb3bfff,
		0xffabdbff,
		0xffa3e7ff,
		0xffa3ffe3,
		0xffbff3ab,
		0xffcfffb3,
		0xfff3ff9f,
		0xff000000,
		0xff000000,
		0xff000000
	]
}

function flipbyte (b) {
	b = (b & 0xF0) >> 4 | (b & 0x0F) << 4
	b = (b & 0xCC) >> 2 | (b & 0x33) << 2
	b = (b & 0xAA) >> 1 | (b & 0x55) << 1
	return b
}

