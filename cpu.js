function Cpu () {									
	this.a = new Uint8Array(1)
	this.x = new Uint8Array(1)
	this.y = new Uint8Array(1)
	this.stkp = new Uint8Array(1)
	this.pc = new Uint16Array(1)
	this.status = new Uint8Array(1)

	this.bus = null

	this.FLAGS6502 = {
		C: (1 << 0),
		Z: (1 << 1),
		I: (1 << 2),
		D: (1 << 3),
		B: (1 << 4),
		U: (1 << 5),
		V: (1 << 6),
		N: (1 << 7)
	}

	this.debugStatus = () => {
		let string = ''
		const keys = Object.keys(this.FLAGS6502)
		for (let i = 0; i < 8; i++) {
			string += (this.status[0] & this.FLAGS6502[keys[i]]) ? keys[i] : '-'
		}
		return string
	}

	this.fetched = new Uint8Array(1)
	this.temp = new Uint16Array(1)
	this.addrAbs = new Uint16Array(1)
	this.addrRel = new Uint16Array(1)
	this.opcode = new Uint8Array(1)
	this.cycles = 0
	this.clockCount = 0

	this.connectBus = bus => {
		this.bus = bus
	}

	this.read = a => {
		return this.bus.cpuRead(a, false)
	}

	this.write = (a, d) => {
		this.bus.cpuWrite(a, d)
	}

	this.reset = () => {
		this.addrAbs[0] = 0xFFFC
		let lo = new Uint16Array(1)
		let hi = new Uint16Array(1)
		lo[0] = this.read(this.addrAbs[0] + 0)
		hi[0] = this.read(this.addrAbs[0] + 1)

		this.pc[0] = (hi[0] << 8) | lo[0]
		this.a[0] = 0x00
		this.x[0] = 0x00
		this.y[0] = 0x00
		this.stkp[0] = 0xFD
		this.status[0] = 0x00 | this.FLAGS6502.U

		this.addrRel[0] = 0x0000
		this.addrAbs[0] = 0x0000
		this.fetched[0] = 0x00
		this.cycles = 8
	}

	this.irq = () => {
		if (this.getFlag('I') == 0) {
			this.write(0x0100 + this.stkp[0], (this.pc[0] >> 8) & 0x00FF)
			this.stkp[0]--
			this.write(0x0100 + this.stkp[0], this.pc[0] & 0x00FF)
			this.stkp[0]--

			this.setFlag('B', 0)
			this.setFlag('U', 1)
			this.setFlag('I', 1)
			this.write(0x0100 + this.stkp[0], this.status[0])
			this.stkp[0]--

			this.addrAbs[0] = 0xFFFE
			let lo = this.read(this.addrAbs[0] + 0)
			let hi = this.read(this.addrAbs[0] + 1)
			this.pc[0] = (hi << 8) | lo
			this.cycles = 7
		}
	}

	this.nmi = () => {
		this.write(0x0100 + this.stkp[0], (this.pc[0] >> 8) & 0x00FF)
		this.stkp[0]--
		this.write(0x0100 + this.stkp[0], this.pc[0] & 0x00FF)
		this.stkp[0]--

		this.setFlag('B', 0)
		this.setFlag('U', 1)
		this.setFlag('I', 1)
		this.write(0x0100 + this.stkp[0], this.status[0])
		this.stkp[0]--

		this.addrAbs[0] = 0xFFFA
		let lo = this.read(this.addrAbs[0] + 0)
		let hi = this.read(this.addrAbs[0] + 1)
		this.pc[0] = (hi << 8) | lo
		this.cycles = 8
	}

	this.clock = () => {
		if (this.cycles == 0) {
			this.opcode[0] = this.read(this.pc[0])

			// // if (this.pc[0] == 0xC85F || window.debugEnabled) {
			// // if (this.pc[0] == 0xC04C || window.debugEnabled) { // TST - INCORRECT VRAM ADDRESS < 0x3FFF
			// // if (this.pc[0] == 0xc054 || window.debugEnabled) {
			// // if (this.pc[0] == 0xc2e2 || window.debugEnabled) {
			// if (this.pc[0] == 0xC293 || window.debugEnabled) { // TST - FIRST RENDER - GOAL!!!
			// // if (this.pc[0] == 0xF1CE || window.debugEnabled) { // DKG - PPU STATUS
			// // if (this.pc[0] == 0x8596 || window.debugEnabled) { //
			// // if (this.pc[0] == 0x8356 || window.debugEnabled) { // SGT - scanline render

			// 	window.debugControl = true
			// 	console.log(`
			// 	${hex(this.pc[0], 4).toUpperCase()}: ${this.lookup[this.opcode[0]].name}(${hex(this.opcode[0])})
			// 	 ${hex(this.read(this.pc[0] + 1)).toUpperCase()}
			// 	 ${hex(this.read(this.pc[0] + 2)).toUpperCase()}
			// 	 ${hex(this.read(this.pc[0] + 3)).toUpperCase()}
			// 	 Adr:${this.lookup[this.opcode[0]].addrName}
			// 	 (${this.debugStatus()})
			// 	 a: ${hex(this.a[0])}  x: ${hex(this.x[0])}   y: ${hex(this.y[0])}   stack: ${hex(this.stkp[0])}
			// 	 `.replaceAll(/\t|\n|\r/ig, ''))
			// 	 debugger
			// }

			this.setFlag('U', true)
			this.pc[0]++
			this.cycles = this.lookup[this.opcode[0]].cycles
			const additionalCyclesAddr = this.lookup[this.opcode[0]].addrmode()
			const additionalCyclesOper = this.lookup[this.opcode[0]].operate()
			this.cycles += (additionalCyclesAddr + additionalCyclesOper)
			this.setFlag('U', true)
		}
		this.clockCount++
		this.cycles--
	}

	this.getFlag = flag => {
		return ((this.status[0] & this.FLAGS6502[flag]) > 0) ? 1 : 0
	}

	this.setFlag = (flag, boolValue) => {
		if (boolValue) this.status[0] |= this.FLAGS6502[flag]
		else this.status[0] &= ~this.FLAGS6502[flag]
	}

	this.complete = () => this.cycles == 0

	///////////
	// FETCH //
	///////////

	this.fetch = () => {
		if (!(this.lookup[this.opcode[0]].addrmode == this.IMP)) this.fetched[0] = this.read(this.addrAbs[0])
		return this.fetched[0]
	}

	////////////////
	// ADDRESSING //
	////////////////

	this.IMP = () => {
		this.fetched[0] = this.a[0]
		return 0
	}

	this.IMM = () => {
		this.addrAbs[0] = this.pc[0]++
		return 0
	}

	this.ZP0 = () => {
		this.addrAbs[0] = this.read(this.pc[0])
		this.pc[0]++
		this.addrAbs[0] &= 0x00FF
		return 0
	}

	this.ZPX = () => {
		this.addrAbs[0] = (this.read(this.pc[0]) + this.x[0])
		this.pc[0]++
		this.addrAbs[0] &= 0x00FF
		return 0
	}

	this.ZPY = () => {
		this.addrAbs[0] = (this.read(this.pc[0]) + this.y[0])
		this.pc[0]++
		this.addrAbs[0] &= 0x00FF
		return 0
	}

	this.REL = () => {
		this.addrRel[0] = this.read(this.pc[0])
		this.pc[0]++
		if (this.addrRel[0] & 0x80) this.addrRel[0] |= 0xFF00
		return 0
	}

	this.ABS = () => {
		let lo = this.read(this.pc[0])
		this.pc[0]++
		let hi = this.read(this.pc[0])
		this.pc[0]++

		this.addrAbs[0] = (hi << 8) | lo
		return 0
	}

	this.ABX = () => {
		let lo = this.read(this.pc[0])
		this.pc[0]++
		let hi = this.read(this.pc[0])
		this.pc[0]++

		this.addrAbs[0] = (hi << 8) | lo
		this.addrAbs[0] += this.x[0]
		if ((this.addrAbs[0] & 0xFF00) != (hi << 8)) return 1
		else return 0
	}

	this.ABY = () => {
		let lo = this.read(this.pc[0])
		this.pc[0]++
		let hi = this.read(this.pc[0])
		this.pc[0]++

		this.addrAbs[0] = (hi << 8) | lo
		this.addrAbs[0] += this.y[0]
		if ((this.addrAbs[0] & 0xFF00) != (hi << 8)) return 1
		else return 0
	}

	this.IND = () => {
		let ptrlo = this.read(this.pc[0])
		this.pc[0]++
		let ptrhi = this.read(this.pc[0])
		this.pc[0]++

		let ptr = (ptrhi << 8) | ptrlo

		if (ptrlo == 0x00FF) this.addrAbs[0] = (this.read(ptr & 0xFF00) << 8) | this.read(ptr + 0)
		else this.addrAbs[0] = (this.read(ptr + 1) << 8) | this.read(ptr + 0)
		return 0
	}

	this.IZX = () => {
		let ptr = this.read(this.pc[0])
		this.pc[0]++

		let lo = this.read((ptr + this.x[0]) & 0x00FF)
		let hi = this.read((ptr + this.x[0] + 1) & 0x00FF)
		this.addrAbs[0] = (hi << 8) | lo
		return 0
	}

	this.IZY = () => {
		let ptr = this.read(this.pc[0])
		this.pc[0]++

		let lo = this.read(ptr & 0x00FF)
		let hi = this.read((ptr + 1) & 0x00FF)

		this.addrAbs[0] = (hi << 8) | lo
		this.addrAbs[0] += this.y[0]

		if((this.addrAbs[0] & 0xFF00) != (hi << 8)) return 1
		else return 0
	}

	//////////////////
	// INSTRUCTIONS //
	//////////////////

	this.ADC = () => {
		this.fetch()
		this.temp[0] = this.a[0] + this.fetched[0] + this.getFlag('C')
		this.setFlag('C', this.temp[0] > 255)
		this.setFlag('Z', (this.temp[0] & 0x00FF) == 0)
		this.setFlag('V', (~(this.a[0] ^ this.fetched[0]) & (this.a[0] ^ this.temp[0]) & 0x0080))
		this.setFlag('N', this.temp[0] & 0x80)
		this.a[0] = this.temp[0] & 0x00FF
		return 1
	}

	this.SBC = () => {
		this.fetch()
		let value = this.fetched[0] ^ 0x00FF

		this.temp[0] = this.a[0] + value + this.getFlag('C')
		this.setFlag('C', this.temp[0] & 0xFF00)
		this.setFlag('Z', (this.temp[0] & 0x00FF) == 0)
		this.setFlag('V', ((this.temp[0] ^ this.a[0]) & (this.temp[0] ^ value) & 0x0080))
		this.setFlag('N', this.temp[0] & 0x0080)
		this.a[0] = this.temp[0] & 0x00FF
		return 1
	}

	this.AND = () => {
		this.fetch()
		this.a[0] = this.a[0] & this.fetched[0]
		this.setFlag('Z', this.a[0] == 0x00)
		this.setFlag('N', this.a[0] & 0x80)
		return 1
	}

	this.ASL = () => {
		this.fetch()
		this.temp[0] = this.fetched[0] << 1
		this.setFlag('C', (this.temp[0] & 0xFF00) > 0)
		this.setFlag('Z', (this.temp[0] & 0x00FF) == 0x00)
		this.setFlag('N', this.temp[0] & 0x80)
		if (this.lookup[this.opcode[0]].addrmode == this.IMP) this.a[0] = this.temp[0] & 0x00FF
		else this.write(this.addrAbs[0], this.temp[0] & 0x00FF)
		return 0
	}

	this.BCC = () => {
		if (this.getFlag('C') == 0) {
			this.cycles++
			this.addrAbs[0] = this.pc[0] + this.addrRel[0]
			if ((this.addrAbs[0] & 0xFF00) != (this.pc[0] & 0xFF00)) this.cycles++
			this.pc[0] = this.addrAbs[0]
		}
		return 0
	}

	this.BCS = () => {
		if (this.getFlag('C') == 1) {
			this.cycles++
			this.addrAbs[0] = this.pc[0] + this.addrRel[0]
			if ((this.addrAbs[0] & 0xFF00) != (this.pc[0] & 0xFF00)) this.cycles++
			this.pc[0] = this.addrAbs[0]
		}
		return 0
	}

	this.BEQ = () => {
		if (this.getFlag('Z') == 1) {
			this.cycles++
			this.addrAbs[0] = this.pc[0] + this.addrRel[0]
			if ((this.addrAbs[0] & 0xFF00) != (this.pc[0] & 0xFF00)) this.cycles++
			this.pc[0] = this.addrAbs[0]
		}
		return 0
	}

	this.BIT = () => {
		this.fetch()
		this.temp[0] = this.a[0] & this.fetched[0]
		this.setFlag('Z', (this.temp[0] & 0x00FF) == 0x00)
		this.setFlag('N', this.fetched[0] & (1 << 7))
		this.setFlag('V', this.fetched[0] & (1 << 6))
		return 0
	}

	this.BMI = () => {
		if (this.getFlag('N') == 1) {
			this.cycles++
			this.addrAbs[0] = this.pc[0] + this.addrRel[0]
			if ((this.addrAbs[0] & 0xFF00) != (this.pc[0] & 0xFF00)) this.cycles++
			this.pc[0] = this.addrAbs[0]
		}
		return 0
	}

	this.BNE = () => {
		if (this.getFlag('Z') == 0) {
			this.cycles++
			this.addrAbs[0] = this.pc[0] + this.addrRel[0]
			if ((this.addrAbs[0] & 0xFF00) != (this.pc[0] & 0xFF00)) this.cycles++
			this.pc[0] = this.addrAbs[0]
		}
		return 0
	}

	this.BPL = () => {
		if (this.getFlag('N') == 0) {
			this.cycles++
			this.addrAbs[0] = this.pc[0] + this.addrRel[0]
			if ((this.addrAbs[0] & 0xFF00) != (this.pc[0] & 0xFF00)) this.cycles++
			this.pc[0] = this.addrAbs[0]
		}
		return 0
	}

	this.BRK = () => {
		this.pc[0]++

		this.setFlag('I', 1)
		this.write(0x0100 + this.stkp[0], (this.pc[0] >> 8) * 0x00FF)
		this.stkp[0]--
		this.write(0x0100 + this.stkp[0], this.pc[0] & 0x00FF)
		this.stkp[0]--

		this.setFlag('B', 1)
		this.write(0x0100 + this.stkp[0], this.status[0])
		this.stkp[0]--
		this.setFlag('B', 0)

		this.pc[0] = this.read(0xFFFE) | (this.read(0xFFFF) << 8)
		return 0
	}

	this.BVC = () => {
		if (this.getFlag('V') == 0) {
			this.cycles++
			this.addrAbs[0] = this.pc[0] + this.addrRel[0]
			if ((this.addrAbs[0] & 0xFF00) != (this.pc[0] & 0xFF00)) this.cycles++
			this.pc[0] = this.addrAbs[0]
		}
		return 0
	}

	this.BVS = () => {
		if (this.getFlag('V') == 1) {
			this.cycles++
			this.addrAbs[0] = this.pc[0] + this.addrRel[0]
			if ((this.addrAbs[0] & 0xFF00) != (this.pc[0] & 0xFF00)) this.cycles++
			this.pc[0] = this.addrAbs[0]
		}
		return 0
	}

	this.CLC = () => {
		this.setFlag('C', false)
		return 0
	}
	
	this.CLD = () => {
		this.setFlag('D', false)
		return 0
	}

	this.CLI = () => {
		this.setFlag('I', false)
		return 0
	}
	
	this.CLV = () => {
		this.setFlag('V', false)
		return 0
	}

	this.CMP = () => {
		this.fetch()
		this.temp[0] = this.a[0] - this.fetched[0]
		this.setFlag('C', this.a[0] >= this.fetched[0])
		this.setFlag('Z', (this.temp[0] & 0x00FF) == 0x0000)
		this.setFlag('N', this.temp[0] & 0x0080)
		return 1
	}


	this.CPX = () => {
		this.fetch()
		this.temp[0] = this.x[0] - this.fetched[0]
		this.setFlag('C', this.x[0] >= this.fetched[0])
		this.setFlag('Z', (this.temp[0] & 0x00FF) == 0x0000)
		this.setFlag('N', this.temp[0] & 0x0080)
		return 1
	}

	this.CPY = () => {
		this.fetch()
		this.temp[0] = this.y[0] - this.fetched[0]
		this.setFlag('C', this.y[0] >= this.fetched[0])
		this.setFlag('Z', (this.temp[0] & 0x00FF) == 0x0000)
		this.setFlag('N', this.temp[0] & 0x0080)
		return 1
	}

	this.DEC = () => {
		this.fetch()
		this.temp[0] = this.fetched[0] - 1
		this.write(this.addrAbs[0], this.temp[0] & 0x00FF)
		this.setFlag('Z', (this.temp[0] & 0x00FF) == 0x0000)
		this.setFlag('N', this.temp[0] & 0x0080)
		return 0
	}

	this.DEX = () => {
		this.x[0]--
		this.setFlag('Z', this.x[0] == 0x00)
		this.setFlag('N', this.x[0] & 0x80)
		return 0
	}

	this.DEY = () => {
		this.y[0]--
		this.setFlag('Z', this.y[0] == 0x00)
		this.setFlag('N', this.y[0] & 0x80)
		return 0
	}
	
	this.EOR = () => {
		this.fetch()
		this.a[0] = this.a[0] ^ this.fetched[0]
		this.setFlag('Z', this.a[0] == 0x00)
		this.setFlag('N', this.a[0] & 0x80)
		return 1
	}

	this.INC = () => {
		this.fetch()
		this.temp[0] = this.fetched[0] + 1
		this.write(this.addrAbs[0], this.temp[0] & 0x00FF)
		this.setFlag('Z', (this.temp[0] & 0x00FF) == 0x0000)
		this.setFlag('N', this.temp[0] & 0x0080)
		return 0
	}

	this.INX = () => {
		this.x[0]++
		this.setFlag('Z', this.x[0] == 0x00)
		this.setFlag('N', this.x[0] & 0x80)
		return 0
	}

	this.INY = () => {
		this.y[0]++
		this.setFlag('Z', this.y[0] == 0x00)
		this.setFlag('N', this.y[0] & 0x80)
		return 0
	} 

	this.JMP = () => {
		this.pc[0] = this.addrAbs[0]
		return 0
	}

	this.JSR = () => {
		this.pc[0]--
		this.write(0x0100 + this.stkp[0], (this.pc[0] >> 8) & 0x00FF)
		this.stkp[0]--
		this.write(0x0100 + this.stkp[0], this.pc[0] & 0x00FF)
		this.stkp[0]--

		this.pc[0] = this.addrAbs[0]
		return 0
	}

	this.LDA = () => {
		this.fetch()
		this.a[0] = this.fetched[0]
		this.setFlag('Z', this.a[0] == 0x00)
		this.setFlag('N', this.a[0] & 0x80)
		return 1
	}
	
	this.LDX = () => {
		this.fetch()
		this.x[0] = this.fetched[0]
		this.setFlag('Z', this.x[0] == 0x00)
		this.setFlag('N', this.x[0] & 0x80)
		return 1
	}
	
	this.LDY = () => {
		this.fetch()
		this.y[0] = this.fetched[0]
		this.setFlag('Z', this.y[0] == 0x00)
		this.setFlag('N', this.y[0] & 0x80)
		return 1
	}
	
	this.LSR = () => {
		this.fetch()
		this.setFlag('C', this.fetched[0] & 0x0001)
		this.temp[0] = this.fetched[0] >> 1
		this.setFlag('Z', (this.temp[0] & 0x00FF) == 0x0000)
		this.setFlag('N', this.temp[0] & 0x0080)
		if (this.lookup[this.opcode[0]].addrmode == this.IMP) this.a[0] = this.temp[0] & 0x00FF
		else this.write(this.addrAbs[0], this.temp[0] & 0x00FF)
		return 0
	}
	
	this.NOP = () => {
		switch (this.opcode[0]) {
			case 0x1C:
			case 0x3C:
			case 0x5C:
			case 0x7C:
			case 0xDC:
			case 0xFC:
				return 1
				break
		}
		return 0
	}
	
	this.ORA = () => {
		this.fetch()
		this.a[0] = this.a[0] | this.fetched[0]
		this.setFlag('Z', this.a[0] == 0x00)
		this.setFlag('N', this.a[0] & 0x80)
		return 1
	}
	
	this.PHA = () => {
		this.write(0x0100 + this.stkp[0], this.a[0])
		this.stkp[0]--
		return 0
	}
	
	this.PHP = () => {
		this.write(0x0100 + this.stkp[0], this.status[0] | this.FLAGS6502['B'] | this.FLAGS6502['U'])
		this.setFlag('B', 0)
		this.setFlag('U', 0)
		this.stkp[0]--
		return 0
	}
	
	this.PLA = () => {
		this.stkp[0]++
		this.a[0] = this.read(0x0100 + this.stkp[0])
		this.setFlag('Z', this.a[0] == 0x00)
		this.setFlag('N', this.a[0] & 0x80)
		return 0
	}
	
	this.PLP = () => {
		this.stkp[0]++
		this.status[0] = this.read(0x0100 + this.stkp[0])
		this.setFlag('U', 1)
		return 0
	}
	
	this.ROL = () => {
		this.fetch()
		this.temp[0] = (this.fetched[0] << 1) | this.getFlag('C')
		this.setFlag('C', this.temp[0] & 0xFF00)
		this.setFlag('Z', (this.temp[0] & 0x00FF) == 0x0000)
		this.setFlag('N', this.temp[0] & 0x0080)
		if (this.lookup[this.opcode[0]].addrmode == this.IMP) this.a[0] = this.temp[0] & 0x00FF
		else this.write(this.addrAbs[0], this.temp[0] & 0x00FF)
		return 0
	}
	
	this.ROR = () => {
		this.fetch()
		this.temp[0] = (this.getFlag('C') << 7) | (this.fetched[0] >> 1)
		this.setFlag('C', this.fetched[0] & 0x01)
		this.setFlag('Z', (this.temp[0] & 0x00FF) == 0x0000)
		this.setFlag('N', this.temp[0] & 0x0080)
		if (this.lookup[this.opcode[0]].addrmode == this.IMP) this.a[0] = this.temp[0] & 0x00FF
		else this.write(this.addrAbs[0], this.temp[0] & 0x00FF)
		return 0
	}
	
	this.RTI = () => {
		this.stkp[0]++
		this.status[0] = this.read(0x0100 + this.stkp[0])
		this.status[0] &= ~(this.FLAGS6502['B'])
		this.status[0] &= ~(this.FLAGS6502['U'])

		this.stkp[0]++
		this.pc[0] = this.read(0x0100 + this.stkp[0])
		this.stkp[0]++
		this.pc[0] |= this.read(0x0100 + this.stkp[0]) << 8
		return 0
	}
	
	this.RTS = () => {
		this.stkp[0]++
		this.pc[0] = this.read(0x0100 + this.stkp[0])
		this.stkp[0]++
		this.pc[0] |= this.read(0x0100 + this.stkp[0]) << 8

		this.pc[0]++
		return 0
	}
	
	this.SEC = () => {
		this.setFlag('C', true)
		return 0
	}
	
	this.SED = () => {
		this.setFlag('D', true)
		return 0
	}
	
	this.SEI = () => {
		this.setFlag('I', true)
		return 0
	}
	
	this.STA = () => {
		this.write(this.addrAbs[0], this.a[0])
		return 0
	}
	
	this.STX = () => {
		this.write(this.addrAbs[0], this.x[0])
		return 0
	}
	
	this.STY = () => {
		this.write(this.addrAbs[0], this.y[0])
		return 0
	}
	
	this.TAX = () => {
		this.x[0] = this.a[0]
		this.setFlag('Z', this.x[0] == 0x00)
		this.setFlag('N', this.x[0] & 0x80)
		return 0
	}
	
	this.TAY = () => {
		this.y[0] = this.a[0]
		this.setFlag('Z', this.y[0] == 0x00)
		this.setFlag('N', this.y[0] & 0x80)
		return 0
	}
	
	this.TSX = () => {
		this.x[0] = this.stkp[0]
		this.setFlag('Z', this.x[0] == 0x00)
		this.setFlag('N', this.x[0] & 0x80)
		return 0
	}
	
	this.TXA = () => {
		this.a[0] = this.x[0]
		this.setFlag('Z', this.a[0] == 0x00)
		this.setFlag('N', this.a[0] & 0x80)
		return 0
	}
	
	this.TXS = () => {
		this.stkp[0] = this.x[0]
		return 0
	}
	
	this.TYA = () => {
		this.a[0] = this.y[0]
		this.setFlag('Z', this.a[0] == 0x00)
		this.setFlag('N', this.a[0] & 0x80)
		return 0
	}
	
	this.XXX = () => {
		return 0
	}
	
	///////////////////
	// OPCODE LOOKUP //
	///////////////////

	this.lookup = [
		{ name: "BRK", operate: this.BRK, addrmode: this.IMM, addrName: "IMM", cycles: 7 },
    { name: "ORA", operate: this.ORA, addrmode: this.IZX, addrName: "IZX", cycles: 6 },
    { name: "???", operate: this.XXX, addrmode: this.IMP, addrName: "IMP", cycles: 2 },
    { name: "???", operate: this.XXX, addrmode: this.IMP, addrName: "IMP", cycles: 8 },
    { name: "???", operate: this.NOP, addrmode: this.IMP, addrName: "IMP", cycles: 3 },
    { name: "ORA", operate: this.ORA, addrmode: this.ZP0, addrName: "ZP0", cycles: 3 },
    { name: "ASL", operate: this.ASL, addrmode: this.ZP0, addrName: "ZP0", cycles: 5 },
    { name: "???", operate: this.XXX, addrmode: this.IMP, addrName: "IMP", cycles: 5 },
    { name: "PHP", operate: this.PHP, addrmode: this.IMP, addrName: "IMP", cycles: 3 },
    { name: "ORA", operate: this.ORA, addrmode: this.IMM, addrName: "IMM", cycles: 2 },
    { name: "ASL", operate: this.ASL, addrmode: this.IMP, addrName: "IMP", cycles: 2 },
    { name: "???", operate: this.XXX, addrmode: this.IMP, addrName: "IMP", cycles: 2 },
    { name: "???", operate: this.NOP, addrmode: this.IMP, addrName: "IMP", cycles: 4 },
    { name: "ORA", operate: this.ORA, addrmode: this.ABS, addrName: "ABS", cycles: 4 },
    { name: "ASL", operate: this.ASL, addrmode: this.ABS, addrName: "ABS", cycles: 6 },
    { name: "???", operate: this.XXX, addrmode: this.IMP, addrName: "IMP", cycles: 6 },
		{ name: "BPL", operate: this.BPL, addrmode: this.REL, addrName: "REL", cycles: 2 },
    { name: "ORA", operate: this.ORA, addrmode: this.IZY, addrName: "IZY", cycles: 5 },
    { name: "???", operate: this.XXX, addrmode: this.IMP, addrName: "IMP", cycles: 2 },
    { name: "???", operate: this.XXX, addrmode: this.IMP, addrName: "IMP", cycles: 8 },
    { name: "???", operate: this.NOP, addrmode: this.IMP, addrName: "IMP", cycles: 4 },
    { name: "ORA", operate: this.ORA, addrmode: this.ZPX, addrName: "ZPX", cycles: 4 },
    { name: "ASL", operate: this.ASL, addrmode: this.ZPX, addrName: "ZPX", cycles: 6 },
    { name: "???", operate: this.XXX, addrmode: this.IMP, addrName: "IMP", cycles: 6 },
    { name: "CLC", operate: this.CLC, addrmode: this.IMP, addrName: "IMP", cycles: 2 },
    { name: "ORA", operate: this.ORA, addrmode: this.ABY, addrName: "ABY", cycles: 4 },
    { name: "???", operate: this.NOP, addrmode: this.IMP, addrName: "IMP", cycles: 2 },
    { name: "???", operate: this.XXX, addrmode: this.IMP, addrName: "IMP", cycles: 7 },
    { name: "???", operate: this.NOP, addrmode: this.IMP, addrName: "IMP", cycles: 4 },
    { name: "ORA", operate: this.ORA, addrmode: this.ABX, addrName: "ABX", cycles: 4 },
    { name: "ASL", operate: this.ASL, addrmode: this.ABX, addrName: "ABX", cycles: 7 },
    { name: "???", operate: this.XXX, addrmode: this.IMP, addrName: "IMP", cycles: 7 },
		{ name: "JSR", operate: this.JSR, addrmode: this.ABS, addrName: "ABS", cycles: 6 },
    { name: "AND", operate: this.AND, addrmode: this.IZX, addrName: "IZX", cycles: 6 },
    { name: "???", operate: this.XXX, addrmode: this.IMP, addrName: "IMP", cycles: 2 },
    { name: "???", operate: this.XXX, addrmode: this.IMP, addrName: "IMP", cycles: 8 },
    { name: "BIT", operate: this.BIT, addrmode: this.ZP0, addrName: "ZP0", cycles: 3 },
    { name: "AND", operate: this.AND, addrmode: this.ZP0, addrName: "ZP0", cycles: 3 },
    { name: "ROL", operate: this.ROL, addrmode: this.ZP0, addrName: "ZP0", cycles: 5 },
    { name: "???", operate: this.XXX, addrmode: this.IMP, addrName: "IMP", cycles: 5 },
    { name: "PLP", operate: this.PLP, addrmode: this.IMP, addrName: "IMP", cycles: 4 },
    { name: "AND", operate: this.AND, addrmode: this.IMM, addrName: "IMM", cycles: 2 },
    { name: "ROL", operate: this.ROL, addrmode: this.IMP, addrName: "IMP", cycles: 2 },
    { name: "???", operate: this.XXX, addrmode: this.IMP, addrName: "IMP", cycles: 2 },
    { name: "BIT", operate: this.BIT, addrmode: this.ABS, addrName: "ABS", cycles: 4 },
    { name: "AND", operate: this.AND, addrmode: this.ABS, addrName: "ABS", cycles: 4 },
    { name: "ROL", operate: this.ROL, addrmode: this.ABS, addrName: "ABS", cycles: 6 },
    { name: "???", operate: this.XXX, addrmode: this.IMP, addrName: "IMP", cycles: 6 },
		{ name: "BMI", operate: this.BMI, addrmode: this.REL, addrName: "REL", cycles: 2 },
    { name: "AND", operate: this.AND, addrmode: this.IZY, addrName: "IZY", cycles: 5 },
    { name: "???", operate: this.XXX, addrmode: this.IMP, addrName: "IMP", cycles: 2 },
    { name: "???", operate: this.XXX, addrmode: this.IMP, addrName: "IMP", cycles: 8 },
    { name: "???", operate: this.NOP, addrmode: this.IMP, addrName: "IMP", cycles: 4 },
    { name: "AND", operate: this.AND, addrmode: this.ZPX, addrName: "ZPX", cycles: 4 },
    { name: "ROL", operate: this.ROL, addrmode: this.ZPX, addrName: "ZPX", cycles: 6 },
    { name: "???", operate: this.XXX, addrmode: this.IMP, addrName: "IMP", cycles: 6 },
    { name: "SEC", operate: this.SEC, addrmode: this.IMP, addrName: "IMP", cycles: 2 },
    { name: "AND", operate: this.AND, addrmode: this.ABY, addrName: "ABY", cycles: 4 },
    { name: "???", operate: this.NOP, addrmode: this.IMP, addrName: "IMP", cycles: 2 },
    { name: "???", operate: this.XXX, addrmode: this.IMP, addrName: "IMP", cycles: 7 },
    { name: "???", operate: this.NOP, addrmode: this.IMP, addrName: "IMP", cycles: 4 },
    { name: "AND", operate: this.AND, addrmode: this.ABX, addrName: "ABX", cycles: 4 },
    { name: "ROL", operate: this.ROL, addrmode: this.ABX, addrName: "ABX", cycles: 7 },
    { name: "???", operate: this.XXX, addrmode: this.IMP, addrName: "IMP", cycles: 7 },
		{ name: "RTI", operate: this.RTI, addrmode: this.IMP, addrName: "IMP", cycles: 6 },
    { name: "EOR", operate: this.EOR, addrmode: this.IZX, addrName: "IZX", cycles: 6 },
    { name: "???", operate: this.XXX, addrmode: this.IMP, addrName: "IMP", cycles: 2 },
    { name: "???", operate: this.XXX, addrmode: this.IMP, addrName: "IMP", cycles: 8 },
    { name: "???", operate: this.NOP, addrmode: this.IMP, addrName: "IMP", cycles: 3 },
    { name: "EOR", operate: this.EOR, addrmode: this.ZP0, addrName: "ZP0", cycles: 3 },
    { name: "LSR", operate: this.LSR, addrmode: this.ZP0, addrName: "ZP0", cycles: 5 },
    { name: "???", operate: this.XXX, addrmode: this.IMP, addrName: "IMP", cycles: 5 },
    { name: "PHA", operate: this.PHA, addrmode: this.IMP, addrName: "IMP", cycles: 3 },
    { name: "EOR", operate: this.EOR, addrmode: this.IMM, addrName: "IMM", cycles: 2 },
    { name: "LSR", operate: this.LSR, addrmode: this.IMP, addrName: "IMP", cycles: 2 },
    { name: "???", operate: this.XXX, addrmode: this.IMP, addrName: "IMP", cycles: 2 },
    { name: "JMP", operate: this.JMP, addrmode: this.ABS, addrName: "ABS", cycles: 3 },
    { name: "EOR", operate: this.EOR, addrmode: this.ABS, addrName: "ABS", cycles: 4 },
    { name: "LSR", operate: this.LSR, addrmode: this.ABS, addrName: "ABS", cycles: 6 },
    { name: "???", operate: this.XXX, addrmode: this.IMP, addrName: "IMP", cycles: 6 },
		{ name: "BVC", operate: this.BVC, addrmode: this.REL, addrName: "REL", cycles: 2 },
    { name: "EOR", operate: this.EOR, addrmode: this.IZY, addrName: "IZY", cycles: 5 },
    { name: "???", operate: this.XXX, addrmode: this.IMP, addrName: "IMP", cycles: 2 },
    { name: "???", operate: this.XXX, addrmode: this.IMP, addrName: "IMP", cycles: 8 },
    { name: "???", operate: this.NOP, addrmode: this.IMP, addrName: "IMP", cycles: 4 },
    { name: "EOR", operate: this.EOR, addrmode: this.ZPX, addrName: "ZPX", cycles: 4 },
    { name: "LSR", operate: this.LSR, addrmode: this.ZPX, addrName: "ZPX", cycles: 6 },
    { name: "???", operate: this.XXX, addrmode: this.IMP, addrName: "IMP", cycles: 6 },
    { name: "CLI", operate: this.CLI, addrmode: this.IMP, addrName: "IMP", cycles: 2 },
    { name: "EOR", operate: this.EOR, addrmode: this.ABY, addrName: "ABY", cycles: 4 },
    { name: "???", operate: this.NOP, addrmode: this.IMP, addrName: "IMP", cycles: 2 },
    { name: "???", operate: this.XXX, addrmode: this.IMP, addrName: "IMP", cycles: 7 },
    { name: "???", operate: this.NOP, addrmode: this.IMP, addrName: "IMP", cycles: 4 },
    { name: "EOR", operate: this.EOR, addrmode: this.ABX, addrName: "ABX", cycles: 4 },
    { name: "LSR", operate: this.LSR, addrmode: this.ABX, addrName: "ABX", cycles: 7 },
    { name: "???", operate: this.XXX, addrmode: this.IMP, addrName: "IMP", cycles: 7 },
		{ name: "RTS", operate: this.RTS, addrmode: this.IMP, addrName: "IMP", cycles: 6 },
    { name: "ADC", operate: this.ADC, addrmode: this.IZX, addrName: "IZX", cycles: 6 },
    { name: "???", operate: this.XXX, addrmode: this.IMP, addrName: "IMP", cycles: 2 },
    { name: "???", operate: this.XXX, addrmode: this.IMP, addrName: "IMP", cycles: 8 },
    { name: "???", operate: this.NOP, addrmode: this.IMP, addrName: "IMP", cycles: 3 },
    { name: "ADC", operate: this.ADC, addrmode: this.ZP0, addrName: "ZP0", cycles: 3 },
    { name: "ROR", operate: this.ROR, addrmode: this.ZP0, addrName: "ZP0", cycles: 5 },
    { name: "???", operate: this.XXX, addrmode: this.IMP, addrName: "IMP", cycles: 5 },
    { name: "PLA", operate: this.PLA, addrmode: this.IMP, addrName: "IMP", cycles: 4 },
    { name: "ADC", operate: this.ADC, addrmode: this.IMM, addrName: "IMM", cycles: 2 },
    { name: "ROR", operate: this.ROR, addrmode: this.IMP, addrName: "IMP", cycles: 2 },
    { name: "???", operate: this.XXX, addrmode: this.IMP, addrName: "IMP", cycles: 2 },
    { name: "JMP", operate: this.JMP, addrmode: this.IND, addrName: "IND", cycles: 5 },
    { name: "ADC", operate: this.ADC, addrmode: this.ABS, addrName: "ABS", cycles: 4 },
    { name: "ROR", operate: this.ROR, addrmode: this.ABS, addrName: "ABS", cycles: 6 },
    { name: "???", operate: this.XXX, addrmode: this.IMP, addrName: "IMP", cycles: 6 },
		{ name: "BVS", operate: this.BVS, addrmode: this.REL, addrName: "REL", cycles: 2 },
    { name: "ADC", operate: this.ADC, addrmode: this.IZY, addrName: "IZY", cycles: 5 },
    { name: "???", operate: this.XXX, addrmode: this.IMP, addrName: "IMP", cycles: 2 },
    { name: "???", operate: this.XXX, addrmode: this.IMP, addrName: "IMP", cycles: 8 },
    { name: "???", operate: this.NOP, addrmode: this.IMP, addrName: "IMP", cycles: 4 },
    { name: "ADC", operate: this.ADC, addrmode: this.ZPX, addrName: "ZPX", cycles: 4 },
    { name: "ROR", operate: this.ROR, addrmode: this.ZPX, addrName: "ZPX", cycles: 6 },
    { name: "???", operate: this.XXX, addrmode: this.IMP, addrName: "IMP", cycles: 6 },
    { name: "SEI", operate: this.SEI, addrmode: this.IMP, addrName: "IMP", cycles: 2 },
    { name: "ADC", operate: this.ADC, addrmode: this.ABY, addrName: "ABY", cycles: 4 },
    { name: "???", operate: this.NOP, addrmode: this.IMP, addrName: "IMP", cycles: 2 },
    { name: "???", operate: this.XXX, addrmode: this.IMP, addrName: "IMP", cycles: 7 },
    { name: "???", operate: this.NOP, addrmode: this.IMP, addrName: "IMP", cycles: 4 },
    { name: "ADC", operate: this.ADC, addrmode: this.ABX, addrName: "ABX", cycles: 4 },
    { name: "ROR", operate: this.ROR, addrmode: this.ABX, addrName: "ABX", cycles: 7 },
    { name: "???", operate: this.XXX, addrmode: this.IMP, addrName: "IMP", cycles: 7 },
		{ name: "???", operate: this.NOP, addrmode: this.IMP, addrName: "IMP", cycles: 2 },
    { name: "STA", operate: this.STA, addrmode: this.IZX, addrName: "IZX", cycles: 6 },
    { name: "???", operate: this.NOP, addrmode: this.IMP, addrName: "IMP", cycles: 2 },
    { name: "???", operate: this.XXX, addrmode: this.IMP, addrName: "IMP", cycles: 6 },
    { name: "STY", operate: this.STY, addrmode: this.ZP0, addrName: "ZP0", cycles: 3 },
    { name: "STA", operate: this.STA, addrmode: this.ZP0, addrName: "ZP0", cycles: 3 },
    { name: "STX", operate: this.STX, addrmode: this.ZP0, addrName: "ZP0", cycles: 3 },
    { name: "???", operate: this.XXX, addrmode: this.IMP, addrName: "IMP", cycles: 3 },
    { name: "DEY", operate: this.DEY, addrmode: this.IMP, addrName: "IMP", cycles: 2 },
    { name: "???", operate: this.NOP, addrmode: this.IMP, addrName: "IMP", cycles: 2 },
    { name: "TXA", operate: this.TXA, addrmode: this.IMP, addrName: "IMP", cycles: 2 },
    { name: "???", operate: this.XXX, addrmode: this.IMP, addrName: "IMP", cycles: 2 },
    { name: "STY", operate: this.STY, addrmode: this.ABS, addrName: "ABS", cycles: 4 },
    { name: "STA", operate: this.STA, addrmode: this.ABS, addrName: "ABS", cycles: 4 },
    { name: "STX", operate: this.STX, addrmode: this.ABS, addrName: "ABS", cycles: 4 },
    { name: "???", operate: this.XXX, addrmode: this.IMP, addrName: "IMP", cycles: 4 },
		{ name: "BCC", operate: this.BCC, addrmode: this.REL, addrName: "REL", cycles: 2 },
    { name: "STA", operate: this.STA, addrmode: this.IZY, addrName: "IZY", cycles: 6 },
    { name: "???", operate: this.XXX, addrmode: this.IMP, addrName: "IMP", cycles: 2 },
    { name: "???", operate: this.XXX, addrmode: this.IMP, addrName: "IMP", cycles: 6 },
    { name: "STY", operate: this.STY, addrmode: this.ZPX, addrName: "ZPX", cycles: 4 },
    { name: "STA", operate: this.STA, addrmode: this.ZPX, addrName: "ZPX", cycles: 4 },
    { name: "STX", operate: this.STX, addrmode: this.ZPY, addrName: "ZPY", cycles: 4 },
    { name: "???", operate: this.XXX, addrmode: this.IMP, addrName: "IMP", cycles: 4 },
    { name: "TYA", operate: this.TYA, addrmode: this.IMP, addrName: "IMP", cycles: 2 },
    { name: "STA", operate: this.STA, addrmode: this.ABY, addrName: "ABY", cycles: 5 },
    { name: "TXS", operate: this.TXS, addrmode: this.IMP, addrName: "IMP", cycles: 2 },
    { name: "???", operate: this.XXX, addrmode: this.IMP, addrName: "IMP", cycles: 5 },
    { name: "???", operate: this.NOP, addrmode: this.IMP, addrName: "IMP", cycles: 5 },
    { name: "STA", operate: this.STA, addrmode: this.ABX, addrName: "ABX", cycles: 5 },
    { name: "???", operate: this.XXX, addrmode: this.IMP, addrName: "IMP", cycles: 5 },
    { name: "???", operate: this.XXX, addrmode: this.IMP, addrName: "IMP", cycles: 5 },
		{ name: "LDY", operate: this.LDY, addrmode: this.IMM, addrName: "IMM", cycles: 2 },
    { name: "LDA", operate: this.LDA, addrmode: this.IZX, addrName: "IZX", cycles: 6 },
    { name: "LDX", operate: this.LDX, addrmode: this.IMM, addrName: "IMM", cycles: 2 },
    { name: "???", operate: this.XXX, addrmode: this.IMP, addrName: "IMP", cycles: 6 },
    { name: "LDY", operate: this.LDY, addrmode: this.ZP0, addrName: "ZP0", cycles: 3 },
    { name: "LDA", operate: this.LDA, addrmode: this.ZP0, addrName: "ZP0", cycles: 3 },
    { name: "LDX", operate: this.LDX, addrmode: this.ZP0, addrName: "ZP0", cycles: 3 },
    { name: "???", operate: this.XXX, addrmode: this.IMP, addrName: "IMP", cycles: 3 },
    { name: "TAY", operate: this.TAY, addrmode: this.IMP, addrName: "IMP", cycles: 2 },
    { name: "LDA", operate: this.LDA, addrmode: this.IMM, addrName: "IMM", cycles: 2 },
    { name: "TAX", operate: this.TAX, addrmode: this.IMP, addrName: "IMP", cycles: 2 },
    { name: "???", operate: this.XXX, addrmode: this.IMP, addrName: "IMP", cycles: 2 },
    { name: "LDY", operate: this.LDY, addrmode: this.ABS, addrName: "ABS", cycles: 4 },
    { name: "LDA", operate: this.LDA, addrmode: this.ABS, addrName: "ABS", cycles: 4 },
    { name: "LDX", operate: this.LDX, addrmode: this.ABS, addrName: "ABS", cycles: 4 },
    { name: "???", operate: this.XXX, addrmode: this.IMP, addrName: "IMP", cycles: 4 },
		{ name: "BCS", operate: this.BCS, addrmode: this.REL, addrName: "REL", cycles: 2 },
    { name: "LDA", operate: this.LDA, addrmode: this.IZY, addrName: "IZY", cycles: 5 },
    { name: "???", operate: this.XXX, addrmode: this.IMP, addrName: "IMP", cycles: 2 },
    { name: "???", operate: this.XXX, addrmode: this.IMP, addrName: "IMP", cycles: 5 },
    { name: "LDY", operate: this.LDY, addrmode: this.ZPX, addrName: "ZPX", cycles: 4 },
    { name: "LDA", operate: this.LDA, addrmode: this.ZPX, addrName: "ZPX", cycles: 4 },
    { name: "LDX", operate: this.LDX, addrmode: this.ZPY, addrName: "ZPY", cycles: 4 },
    { name: "???", operate: this.XXX, addrmode: this.IMP, addrName: "IMP", cycles: 4 },
    { name: "CLV", operate: this.CLV, addrmode: this.IMP, addrName: "IMP", cycles: 2 },
    { name: "LDA", operate: this.LDA, addrmode: this.ABY, addrName: "ABY", cycles: 4 },
    { name: "TSX", operate: this.TSX, addrmode: this.IMP, addrName: "IMP", cycles: 2 },
    { name: "???", operate: this.XXX, addrmode: this.IMP, addrName: "IMP", cycles: 4 },
    { name: "LDY", operate: this.LDY, addrmode: this.ABX, addrName: "ABX", cycles: 4 },
    { name: "LDA", operate: this.LDA, addrmode: this.ABX, addrName: "ABX", cycles: 4 },
    { name: "LDX", operate: this.LDX, addrmode: this.ABY, addrName: "ABY", cycles: 4 },
    { name: "???", operate: this.XXX, addrmode: this.IMP, addrName: "IMP", cycles: 4 },
		{ name: "CPY", operate: this.CPY, addrmode: this.IMM, addrName: "IMM", cycles: 2 },
    { name: "CMP", operate: this.CMP, addrmode: this.IZX, addrName: "IZX", cycles: 6 },
    { name: "???", operate: this.NOP, addrmode: this.IMP, addrName: "IMP", cycles: 2 },
    { name: "???", operate: this.XXX, addrmode: this.IMP, addrName: "IMP", cycles: 8 },
    { name: "CPY", operate: this.CPY, addrmode: this.ZP0, addrName: "ZP0", cycles: 3 },
    { name: "CMP", operate: this.CMP, addrmode: this.ZP0, addrName: "ZP0", cycles: 3 },
    { name: "DEC", operate: this.DEC, addrmode: this.ZP0, addrName: "ZP0", cycles: 5 },
    { name: "???", operate: this.XXX, addrmode: this.IMP, addrName: "IMP", cycles: 5 },
    { name: "INY", operate: this.INY, addrmode: this.IMP, addrName: "IMP", cycles: 2 },
    { name: "CMP", operate: this.CMP, addrmode: this.IMM, addrName: "IMM", cycles: 2 },
    { name: "DEX", operate: this.DEX, addrmode: this.IMP, addrName: "IMP", cycles: 2 },
    { name: "???", operate: this.XXX, addrmode: this.IMP, addrName: "IMP", cycles: 2 },
    { name: "CPY", operate: this.CPY, addrmode: this.ABS, addrName: "ABS", cycles: 4 },
    { name: "CMP", operate: this.CMP, addrmode: this.ABS, addrName: "ABS", cycles: 4 },
    { name: "DEC", operate: this.DEC, addrmode: this.ABS, addrName: "ABS", cycles: 6 },
    { name: "???", operate: this.XXX, addrmode: this.IMP, addrName: "IMP", cycles: 6 },
		{ name: "BNE", operate: this.BNE, addrmode: this.REL, addrName: "REL", cycles: 2 },
    { name: "CMP", operate: this.CMP, addrmode: this.IZY, addrName: "IZY", cycles: 5 },
    { name: "???", operate: this.XXX, addrmode: this.IMP, addrName: "IMP", cycles: 2 },
    { name: "???", operate: this.XXX, addrmode: this.IMP, addrName: "IMP", cycles: 8 },
    { name: "???", operate: this.NOP, addrmode: this.IMP, addrName: "IMP", cycles: 4 },
    { name: "CMP", operate: this.CMP, addrmode: this.ZPX, addrName: "ZPX", cycles: 4 },
    { name: "DEC", operate: this.DEC, addrmode: this.ZPX, addrName: "ZPX", cycles: 6 },
    { name: "???", operate: this.XXX, addrmode: this.IMP, addrName: "IMP", cycles: 6 },
    { name: "CLD", operate: this.CLD, addrmode: this.IMP, addrName: "IMP", cycles: 2 },
    { name: "CMP", operate: this.CMP, addrmode: this.ABY, addrName: "ABY", cycles: 4 },
    { name: "NOP", operate: this.NOP, addrmode: this.IMP, addrName: "IMP", cycles: 2 },
    { name: "???", operate: this.XXX, addrmode: this.IMP, addrName: "IMP", cycles: 7 },
    { name: "???", operate: this.NOP, addrmode: this.IMP, addrName: "IMP", cycles: 4 },
    { name: "CMP", operate: this.CMP, addrmode: this.ABX, addrName: "ABX", cycles: 4 },
    { name: "DEC", operate: this.DEC, addrmode: this.ABX, addrName: "ABX", cycles: 7 },
    { name: "???", operate: this.XXX, addrmode: this.IMP, addrName: "IMP", cycles: 7 },
		{ name: "CPX", operate: this.CPX, addrmode: this.IMM, addrName: "IMM", cycles: 2 },
    { name: "SBC", operate: this.SBC, addrmode: this.IZX, addrName: "IZX", cycles: 6 },
    { name: "???", operate: this.NOP, addrmode: this.IMP, addrName: "IMP", cycles: 2 },
    { name: "???", operate: this.XXX, addrmode: this.IMP, addrName: "IMP", cycles: 8 },
    { name: "CPX", operate: this.CPX, addrmode: this.ZP0, addrName: "ZP0", cycles: 3 },
    { name: "SBC", operate: this.SBC, addrmode: this.ZP0, addrName: "ZP0", cycles: 3 },
    { name: "INC", operate: this.INC, addrmode: this.ZP0, addrName: "ZP0", cycles: 5 },
    { name: "???", operate: this.XXX, addrmode: this.IMP, addrName: "IMP", cycles: 5 },
    { name: "INX", operate: this.INX, addrmode: this.IMP, addrName: "IMP", cycles: 2 },
    { name: "SBC", operate: this.SBC, addrmode: this.IMM, addrName: "IMM", cycles: 2 },
    { name: "NOP", operate: this.NOP, addrmode: this.IMP, addrName: "IMP", cycles: 2 },
    { name: "???", operate: this.SBC, addrmode: this.IMP, addrName: "IMP", cycles: 2 },
    { name: "CPX", operate: this.CPX, addrmode: this.ABS, addrName: "ABS", cycles: 4 },
    { name: "SBC", operate: this.SBC, addrmode: this.ABS, addrName: "ABS", cycles: 4 },
    { name: "INC", operate: this.INC, addrmode: this.ABS, addrName: "ABS", cycles: 6 },
    { name: "???", operate: this.XXX, addrmode: this.IMP, addrName: "IMP", cycles: 6 },
		{ name: "BEQ", operate: this.BEQ, addrmode: this.REL, addrName: "REL", cycles: 2 },
    { name: "SBC", operate: this.SBC, addrmode: this.IZY, addrName: "IZY", cycles: 5 },
    { name: "???", operate: this.XXX, addrmode: this.IMP, addrName: "IMP", cycles: 2 },
    { name: "???", operate: this.XXX, addrmode: this.IMP, addrName: "IMP", cycles: 8 },
    { name: "???", operate: this.NOP, addrmode: this.IMP, addrName: "IMP", cycles: 4 },
    { name: "SBC", operate: this.SBC, addrmode: this.ZPX, addrName: "ZPX", cycles: 4 },
    { name: "INC", operate: this.INC, addrmode: this.ZPX, addrName: "ZPX", cycles: 6 },
    { name: "???", operate: this.XXX, addrmode: this.IMP, addrName: "IMP", cycles: 6 },
    { name: "SED", operate: this.SED, addrmode: this.IMP, addrName: "IMP", cycles: 2 },
    { name: "SBC", operate: this.SBC, addrmode: this.ABY, addrName: "ABY", cycles: 4 },
    { name: "NOP", operate: this.NOP, addrmode: this.IMP, addrName: "IMP", cycles: 2 },
    { name: "???", operate: this.XXX, addrmode: this.IMP, addrName: "IMP", cycles: 7 },
    { name: "???", operate: this.NOP, addrmode: this.IMP, addrName: "IMP", cycles: 4 },
    { name: "SBC", operate: this.SBC, addrmode: this.ABX, addrName: "ABX", cycles: 4 },
    { name: "INC", operate: this.INC, addrmode: this.ABX, addrName: "ABX", cycles: 7 },
    { name: "???", operate: this.XXX, addrmode: this.IMP, addrName: "IMP", cycles: 7 },
	]
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