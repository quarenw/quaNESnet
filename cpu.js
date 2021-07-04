function Cpu () {
	this.a = 0x00
	this.x = 0x00
	this.y = 0x00
	this.stkp = 0x00
	this.pc = 0x0000
	this.status = 0x00

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

	this.fetched = 0x00
	this.temp = 0x0000
	this.addrAbs = 0x0000
	this.addrRel = 0x00
	this.opcode = 0x00
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
		this.addrAbs = 0xFFFC
		let lo = this.read(this.addrAbs + 0)
		let hi = this.read(this.addrAbs + 1)

		this.pc = (hi << 8) | lo
		this.a = 0
		this.x = 0
		this.y = 0
		this.stkp = 0xFD
		this.status = 0x00 | this.FLAGS6502.U

		this.addrRel = 0x0000
		this.addrAbs = 0x0000
		this.fetched = 0x00
		this.cycles = 8
	}

	this.irq = () => {
		if (this.getFlag('I') == 0) {
			this.write(0x0100 + this.stkp, (this.pc >> 8) & 0x00FF)
			this.stkp--
			this.write(0x0100 + this.stkp, this.pc & 0x00FF)
			this.stkp--

			this.setFlag('B', 0)
			this.setFlag('U', 1)
			this.setFlag('I', 1)
			this.write(0x0100 + this.stkp, this.status)
			this.stkp--

			this.addrAbs = 0xFFFE
			let lo = read(this.addrAbs + 0)
			let hi = read(this.addrAbs + 1)
			this.pc = (hi << 8) | lo
			this.cycles = 7
		}
	}

	this.nmi = () => {
		this.write(0x0100 + this.stkp, (this.pc >> 8) & 0x00FF)
		this.stkp--
		this.write(0x0100 + this.stkp, this.pc & 0x00FF)
		this.stkp--

		this.setFlag('B', 0)
		this.setFlag('U', 1)
		this.setFlag('I', 1)
		this.write(0x0100 + this.stkp, this.status)
		this.stkp--

		this.addrAbs = 0xFFFA
		let lo = read(this.addrAbs + 0)
		let hi = read(this.addrAbs + 1)
		this.pc = (hi << 8) | lo
		this.cycles = 8
	}

	this.clock = () => {
		if (this.cycles == 0) {
			this.opcode = this.read(this.pc)

			// console.log(`${this.clockCount} | ${convertDecToHexString(this.pc)}: ${this.lookup[this.opcode].name}`)
			this.setFlag('U', true)
			this.pc++
			this.cycles = this.lookup[this.opcode].cycles
			const additionalCyclesAddr = this.lookup[this.opcode].addrmode()
			const additionalCyclesOper = this.lookup[this.opcode].operate()
			this.cycles += (additionalCyclesAddr + additionalCyclesOper)
			this.setFlag('U', true)
		}
		this.clockCount++
		this.cycles--
	}

	this.getFlag = flag => {
		return ((this.status & this.FLAGS6502[flag]) > 0) ? 1 : 0
	}

	this.setFlag = (flag, boolValue) => {
		if (boolValue) this.status |= this.FLAGS6502[flag]
		else this.status &= ~this.FLAGS6502[flag]
	}

	this.complete = () => this.cycles == 0

	///////////
	// FETCH //
	///////////

	this.fetch = () => {
		if (!(this.lookup[this.opcode].addrmode == this.IMP)) this.fetched = this.read(this.addrAbs)
		return this.fetched
	}

	////////////////
	// ADDRESSING //
	////////////////

	this.IMP = () => {
		this.fetched = this.a
		return 0
	}

	this.IMM = () => {
		this.addrAbs = this.pc++
		return 0
	}

	this.ZP0 = () => {
		this.addrAbs = this.read(pc)
		this.pc++
		this.addrAbs &= 0x00FF
		return 0
	}

	this.ZPX = () => {
		this.addrAbs = (this.read(pc) + this.x)
		this.pc++
		this.addrAbs &= 0x00FF
		return 0
	}

	this.ZPY = () => {
		this.addrAbs = (this.read(pc) + this.y)
		this.pc++
		this.addrAbs &= 0x00FF
		return 0
	}

	this.REL = () => {
		this.addrRel = this.read(this.pc)
		this.pc++
		if (this.addrRel & 0x80) this.addrRel |= 0xFF00
		return 0
	}

	this.ABS = () => {
		let lo = this.read(this.pc)
		this.pc++
		let hi = this.read(this.pc)
		this.pc++

		this.addrAbs = (hi << 8) | lo
		return 0
	}

	this.ABX = () => {
		let lo = this.read(this.pc)
		this.pc++
		let hi = this.read(this.pc)
		this.pc++

		this.addrAbs = (hi << 8) | lo
		this.addrAbs += this.x
		if ((this.addrAbs & 0xFF00) != (hi << 8)) return 1
		else return 0
	}

	this.ABY = () => {
		let lo = this.read(this.pc)
		this.pc++
		let hi = this.read(this.pc)
		this.pc++

		this.addrAbs = (hi << 8) | lo
		this.addrAbs += this.y
		if ((this.addrAbs & 0xFF00) != (hi << 8)) return 1
		else return 0
	}

	this.IND = () => {
		let ptrlo = this.read(this.pc)
		this.pc++
		let ptrhi = this.read(this.pc)
		this.pc++

		let ptr = (ptrhi << 8) | ptrlo

		if (ptrlo == 0x00FF) this.addrAbs = (this.read(ptr & 0xFF00) << 8) | this.read(ptr + 0)
		else this.addrAbs = (this.read(ptr + 1) << 8) | this.read(ptr + 0)
		return 0
	}

	this.IZX = () => {
		let ptr = this.read(this.pc)
		this.pc++

		let lo = this.read((ptr + this.x) & 0x00FF)
		let hi = this.read((ptr + this.x + 1) & 0x00FF)
		this.addrAbs = (hi << 8) | lo
		return 0
	}

	this.IZY = () => {
		let ptr = this.read(this.pc)
		this.pc++

		let lo = this.read(ptr & 0x00FF)
		let hi = this.read((ptr + 1) & 0x00FF)

		this.addrAbs = (hi << 8) | lo
		this.addrAbs += this.y

		if((this.addrAbs & 0xFF00) != (hi << 8)) return 1
		else return 0
	}

	//////////////////
	// INSTRUCTIONS //
	//////////////////

	this.ADC = () => {
		this.fetch()
		this.temp = this.a + this.fetched + this.getFlag('C')
		this.setFlag('C', this.temp > 255)
		this.setFlag('Z', (this.temp & 0x00FF) == 0)
		this.setFlag('V', (~(this.a ^ this.fetched) & (this.a ^ this.temp) & 0x0080))
		this.setFlag('N', this.temp & 0x80)
		this.a = this.temp & 0x00FF
		return 1
	}

	this.SBC = () => {
		this.fetch()
		let value = this.fetched ^ 0x00FF

		this.temp = this.a + value + this.getFlag('C')
		this.setFlag('C', this.temp & 0xFF00)
		this.setFlag('Z', (this.temp & 0x00FF) == 0)
		this.setFlag('V', ((this.temp ^ this.a) & (this.temp ^ value) & 0x0080))
		this.setFlag('N', this.temp & 0x0080)
		this.a = this.temp & 0x00FF
		return 1
	}

	this.AND = () => {
		this.fetch()
		this.a = this.a & this.fetched
		this.setFlag('Z', this.a == 0x00)
		this.setFlag('N', this.a & 0x80)
		return 1
	}

	this.ASL = () => {
		this.fetch()
		this.temp = this.fetched << 1
		this.setFlag('C', (this.temp & 0xFF00) > 0)
		this.setFlag('Z', (this.temp & 0x00FF) == 0x00)
		this.setFlag('N', this.temp & 0x80)
		if (this.lookup[this.opcode].addrmode == this.IMP) this.a = this.temp & 0x00FF
		else this.write(this.addrAbs, this.temp & 0x00FF)
		return 0
	}

	this.BCC = () => {
		if (this.getFlag('C') == 0) {
			this.cycles++
			this.addrAbs = this.pc + this.addrRel
			if ((this.addrAbs & 0xFF00) != (this.pc & 0xFF00)) this.cycles++
			this.pc = this.addrAbs
		}
		return 0
	}

	this.BCS = () => {
		if (this.getFlag('C') == 1) {
			this.cycles++
			this.addrAbs = this.pc + this.addrRel
			if ((this.addrAbs & 0xFF00) != (this.pc & 0xFF00)) this.cycles++
			this.pc = this.addrAbs
		}
		return 0
	}

	this.BEQ = () => {
		if (this.getFlag('Z') == 1) {
			this.cycles++
			this.addrAbs = this.pc + this.addrRel
			if ((this.addrAbs & 0xFF00) != (this.pc & 0xFF00)) this.cycles++
			this.pc = this.addrAbs
		}
		return 0
	}

	this.BIT = () => {
		this.fetch()
		this.temp = this.a & this.fetched
		this.setFlag('Z', (this.temp & 0x00FF) == 0x00)
		this.setFlag('N', this.fetched & (1 << 7))
		this.setFlag('V', this.fetched & (1 << 6))
		return 0
	}

	this.BMI = () => {
		if (this.getFlag('N') == 1) {
			this.cycles++
			this.addrAbs = this.pc + this.addrRel
			if ((this.addrAbs & 0xFF00) != (this.pc & 0xFF00)) this.cycles++
			this.pc = this.addrAbs
		}
		return 0
	}

	this.BNE = () => {
		if (this.getFlag('Z') == 0) {
			this.cycles++
			this.addrAbs = this.pc + this.addrRel
			if ((this.addrAbs & 0xFF00) != (this.pc & 0xFF00)) this.cycles++
			this.pc = this.addrAbs
		}
		return 0
	}

	this.BPL = () => {
		if (this.getFlag('N') == 0) {
			this.cycles++
			this.addrAbs = this.pc + this.addrRel
			if ((this.addrAbs & 0xFF00) != (this.pc & 0xFF00)) this.cycles++
			this.pc = this.addrAbs
		}
		return 0
	}

	this.BRK = () => {
		this.pc++

		this.setFlag('I', 1)
		this.write(0x0100 + this.stkp, (this.pc >> 8) * 0x00FF)
		this.stkp--
		this.write(0x0100 + this.stkp, this.pc & 0x00FF)
		this.stkp--

		this.setFlag('B', 1)
		this.write(0x0100 + this.stkp, this.status)
		this.stkp--
		this.setFlag('B', 0)

		this.pc = this.read(0xFFFE) | (this.read(0xFFFF) << 8)
		return 0
	}

	this.BVC = () => {
		if (this.getFlag('V') == 0) {
			this.cycles++
			this.addrAbs = this.pc + this.addrRel
			if ((this.addrAbs & 0xFF00) != (this.pc & 0xFF00)) this.cycles++
			this.pc = this.addrAbs
		}
		return 0
	}

	this.BVS = () => {
		if (this.getFlag('V') == 1) {
			this.cycles++
			this.addrAbs = this.pc + this.addrRel
			if ((this.addrAbs & 0xFF00) != (this.pc & 0xFF00)) this.cycles++
			this.pc = this.addrAbs
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
		this.temp = this.a - this.fetched
		this.setFlag('C', this.a >= this.fetched)
		this.setFlag('Z', (this.temp & 0x00FF) == 0x0000)
		this.setFlag('N', this.temp & 0x0080)
		return 1
	}


	this.CMX = () => {
		this.fetch()
		this.temp = this.x - this.fetched
		this.setFlag('C', this.x >= this.fetched)
		this.setFlag('Z', (this.temp & 0x00FF) == 0x0000)
		this.setFlag('N', this.temp & 0x0080)
		return 1
	}

	this.CMY = () => {
		this.fetch()
		this.temp = this.y - this.fetched
		this.setFlag('C', this.y >= this.fetched)
		this.setFlag('Z', (this.temp & 0x00FF) == 0x0000)
		this.setFlag('N', this.temp & 0x0080)
		return 1
	}

	this.DEC = () => {
		this.fetch()
		this.temp = this.fetched - 1
		this.write(this.addrAbs, this.temp & 0x00FF)
		this.setFlag('Z', (this.temp & 0x00FF) == 0x0000)
		this.setFlag('N', this.temp & 0x0080)
		return 0
	}

	this.DEX = () => {
		this.x--
		this.setFlag('Z', this.x == 0x00)
		this.setFlag('N', this.x & 0x80)
		return 0
	}

	this.DEY = () => {
		this.y--
		this.setFlag('Z', this.y == 0x00)
		this.setFlag('N', this.y & 0x80)
		return 0
	}
	
	this.EOR = () => {
		this.fetch()
		this.a = this.a ^ this.fetched
		this.setFlag('Z', this.a == 0x00)
		this.setFlag('N'. this.a & 0x80)
		return 1
	}

	this.INC = () => {
		this.fetch()
		this.temp = this.fetched + 1
		this.write(this.addrAbs, this.temp & 0x00FF)
		this.setFlag('Z', (this.temp & 0x00FF) == 0x0000)
		this.setFlag('N', this.temp & 0x0080)
		return 0
	}

	this.INX = () => {
		this.x++
		this.setFlag('Z', this.x == 0x00)
		this.setFlag('N', this.x & 0x80)
		return 0
	}

	this.INY = () => {
		this.y++
		this.setFlag('Z', this.y == 0x00)
		this.setFlag('N', this.y & 0x80)
		return 0
	} 

	this.JMP = () => {
		this.pc = this.addrAbs
		return 0
	}

	this.JSR = () => {
		this.pc--
		this.write(0x0100 + this.stkp, (this.pc >> 8) & 0x00FF)
		this.stkp--
		this.write(0x0100 + this.stkp, this.pc & 0x00FF)
		this.stkp--

		this.pc = this.addrAbs
		return 0
	}

	this.LDA = () => {
		this.fetch()
		this.a = this.fetched
		this.setFlag('Z', this.a == 0x00)
		this.setFlag('N', this.a & 0x80)
		return 1
	}
	
	this.LDX = () => {
		this.fetch()
		this.x = this.fetched
		this.setFlag('Z', this.x == 0x00)
		this.setFlag('N', this.x & 0x80)
		return 1
	}
	
	this.LDY = () => {
		this.fetch()
		this.y = this.fetched
		this.setFlag('Z', this.y == 0x00)
		this.setFlag('N', this.y & 0x80)
		return 1
	}
	
	this.LSR = () => {
		this.fetch()
		this.setFlag('C', this.fetched & 0x0001)
		this.temp = this.fetched >> 1
		this.setFlag('Z', (this.temp & 0x00FF) == 0x0000)
		this.setFlag('N', this.temp & 0x0080)
		if (this.lookup[this.opcode].addrmode == this.IMP) this.a = this.temp & 0x00FF
		else this.write(this.addrAbs, this.temp & 0x00FF)
		return 0
	}
	
	this.NOP = () => {
		switch (this.opcode) {
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
		this.a = this.a | this.fetched
		this.setFlag('Z', this.a == 0x00)
		this.setFlag('N', this.a & 0x80)
		return 1
	}
	
	this.PHA = () => {
		this.write(0x0100 + this.stkp, this.a)
		this.stkp--
		return 0
	}
	
	this.PHP = () => {
		this.write(0x0100 + this.stkp, this.status | this.FLAGS6502['B'] | this.FLAGS6502['U'])
		this.setFlag('B', 0)
		this.setFlag('U', 0)
		this.stkp--
		return 0
	}
	
	this.PLA = () => {
		this.stkp++
		this.a = this.read(0x0100 + this.stkp)
		this.setFlag('Z', this.a == 0x00)
		this.setFlag('N', this.a & 0x80)
		return 0
	}
	
	this.PLP = () => {
		this.stkp++
		this.status = this.read(0x0100 + this.stkp)
		this.setFlag('U', 1)
		return 0
	}
	
	this.ROL = () => {
		this.fetch()
		this.temp = (this.fetched << 1) | this.getFlag('C')
		this.setFlag('C', this.temp & 0xFF00)
		this.setFlag('Z', (this.temp * 0x00FF) == 0x0000)
		this.setFlag('N', this.temp & 0x0080)
		if (this.lookup[this.opcode].addrmode == this.IMP) this.a = this.temp & 0x00FF
		else this.write(this.addrAbs, this.temp & 0x00FF)
		return 0
	}
	
	this.ROR = () => {
		this.fetch()
		this.temp = (this.getFlag('C') << 7) | (this.fetched >> 1)
		this.setFlag('C', this.fetched & 0x01)
		this.setFlag('Z', (this.temp * 0x00FF) == 0x0000)
		this.setFlag('N', this.temp & 0x0080)
		if (this.lookup[this.opcode].addrmode == this.IMP) this.a = this.temp & 0x00FF
		else this.write(this.addrAbs, this.temp & 0x00FF)
		return 0
	}
	
	this.RTI = () => {
		this.stkp++
		this.status = this.read(0x0100 + this.stkp)
		this.status &= ~(this.FLAGS6502['B'])
		this.status &= ~(this.FLAGS6502['U'])

		this.stkp++
		this.pc = this.read(0x0100 + this.stkp)
		this.stkp++
		this.pc |= this.read(0x0100 + this.stkp) << 8
		return 0
	}
	
	this.RTS = () => {
		this.stkp++
		this.pc = this.read(0x0100 + this.stkp)
		this.stkp++
		this.pc |= this.read(0x0100 + this.stkp) << 8

		this.pc++
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
		this.write(this.addrAbs, this.a)
		return 0
	}
	
	this.STX = () => {
		this.write(this.addrAbs, this.x)
		return 0
	}
	
	this.STY = () => {
		this.write(this.addrAbs, this.y)
		return 0
	}
	
	this.TAX = () => {
		this.x = this.a
		this.setFlag('Z', this.x == 0x00)
		this.setFlag('N', this.x & 0x80)
		return 0
	}
	
	this.TAY = () => {
		this.y = this.a
		this.setFlag('Z', this.y == 0x00)
		this.setFlag('N', this.y & 0x80)
		return 0
	}
	
	this.TSX = () => {
		this.x = this.stkp
		this.setFlag('Z', this.x == 0x00)
		this.setFlag('N', this.x & 0x80)
		return 0
	}
	
	this.TXA = () => {
		this.a = this.x
		this.setFlag('Z', this.a == 0x00)
		this.setFlag('N', this.a & 0x80)
		return 0
	}
	
	this.TXS = () => {
		this.stkp = this.x
		return 0
	}
	
	this.TYA = () => {
		this.a = this.y
		this.setFlag('Z', this.a == 0x00)
		this.setFlag('N', this.a & 0x80)
		return 0
	}
	
	this.XXX = () => {
		return 0
	}
	
	///////////////////
	// OPCODE LOOKUP //
	///////////////////

	this.lookup = [
		{ name: "BRK", operate: this.BRK, addrmode: this.IMM, cycles: 7 },
    { name: "ORA", operate: this.ORA, addrmode: this.IZX, cycles: 6 },
    { name: "???", operate: this.XXX, addrmode: this.IMP, cycles: 2 },
    { name: "???", operate: this.XXX, addrmode: this.IMP, cycles: 8 },
    { name: "???", operate: this.NOP, addrmode: this.IMP, cycles: 3 },
    { name: "ORA", operate: this.ORA, addrmode: this.ZP0, cycles: 3 },
    { name: "ASL", operate: this.ASL, addrmode: this.ZP0, cycles: 5 },
    { name: "???", operate: this.XXX, addrmode: this.IMP, cycles: 5 },
    { name: "PHP", operate: this.PHP, addrmode: this.IMP, cycles: 3 },
    { name: "ORA", operate: this.ORA, addrmode: this.IMM, cycles: 2 },
    { name: "ASL", operate: this.ASL, addrmode: this.IMP, cycles: 2 },
    { name: "???", operate: this.XXX, addrmode: this.IMP, cycles: 2 },
    { name: "???", operate: this.NOP, addrmode: this.IMP, cycles: 4 },
    { name: "ORA", operate: this.ORA, addrmode: this.ABS, cycles: 4 },
    { name: "ASL", operate: this.ASL, addrmode: this.ABS, cycles: 6 },
    { name: "???", operate: this.XXX, addrmode: this.IMP, cycles: 6 },
		{ name: "BPL", operate: this.BPL, addrmode: this.REL, cycles: 2 },
    { name: "ORA", operate: this.ORA, addrmode: this.IZY, cycles: 5 },
    { name: "???", operate: this.XXX, addrmode: this.IMP, cycles: 2 },
    { name: "???", operate: this.XXX, addrmode: this.IMP, cycles: 8 },
    { name: "???", operate: this.NOP, addrmode: this.IMP, cycles: 4 },
    { name: "ORA", operate: this.ORA, addrmode: this.ZPX, cycles: 4 },
    { name: "ASL", operate: this.ASL, addrmode: this.ZPX, cycles: 6 },
    { name: "???", operate: this.XXX, addrmode: this.IMP, cycles: 6 },
    { name: "CLC", operate: this.CLC, addrmode: this.IMP, cycles: 2 },
    { name: "ORA", operate: this.ORA, addrmode: this.ABY, cycles: 4 },
    { name: "???", operate: this.NOP, addrmode: this.IMP, cycles: 2 },
    { name: "???", operate: this.XXX, addrmode: this.IMP, cycles: 7 },
    { name: "???", operate: this.NOP, addrmode: this.IMP, cycles: 4 },
    { name: "ORA", operate: this.ORA, addrmode: this.ABX, cycles: 4 },
    { name: "ASL", operate: this.ASL, addrmode: this.ABX, cycles: 7 },
    { name: "???", operate: this.XXX, addrmode: this.IMP, cycles: 7 },
		{ name: "JSR", operate: this.JSR, addrmode: this.ABS, cycles: 6 },
    { name: "AND", operate: this.AND, addrmode: this.IZX, cycles: 6 },
    { name: "???", operate: this.XXX, addrmode: this.IMP, cycles: 2 },
    { name: "???", operate: this.XXX, addrmode: this.IMP, cycles: 8 },
    { name: "BIT", operate: this.BIT, addrmode: this.ZP0, cycles: 3 },
    { name: "AND", operate: this.AND, addrmode: this.ZP0, cycles: 3 },
    { name: "ROL", operate: this.ROL, addrmode: this.ZP0, cycles: 5 },
    { name: "???", operate: this.XXX, addrmode: this.IMP, cycles: 5 },
    { name: "PLP", operate: this.PLP, addrmode: this.IMP, cycles: 4 },
    { name: "AND", operate: this.AND, addrmode: this.IMM, cycles: 2 },
    { name: "ROL", operate: this.ROL, addrmode: this.IMP, cycles: 2 },
    { name: "???", operate: this.XXX, addrmode: this.IMP, cycles: 2 },
    { name: "BIT", operate: this.BIT, addrmode: this.ABS, cycles: 4 },
    { name: "AND", operate: this.AND, addrmode: this.ABS, cycles: 4 },
    { name: "ROL", operate: this.ROL, addrmode: this.ABS, cycles: 6 },
    { name: "???", operate: this.XXX, addrmode: this.IMP, cycles: 6 },
		{ name: "BMI", operate: this.BMI, addrmode: this.REL, cycles: 2 },
    { name: "AND", operate: this.AND, addrmode: this.IZY, cycles: 5 },
    { name: "???", operate: this.XXX, addrmode: this.IMP, cycles: 2 },
    { name: "???", operate: this.XXX, addrmode: this.IMP, cycles: 8 },
    { name: "???", operate: this.NOP, addrmode: this.IMP, cycles: 4 },
    { name: "AND", operate: this.AND, addrmode: this.ZPX, cycles: 4 },
    { name: "ROL", operate: this.ROL, addrmode: this.ZPX, cycles: 6 },
    { name: "???", operate: this.XXX, addrmode: this.IMP, cycles: 6 },
    { name: "SEC", operate: this.SEC, addrmode: this.IMP, cycles: 2 },
    { name: "AND", operate: this.AND, addrmode: this.ABY, cycles: 4 },
    { name: "???", operate: this.NOP, addrmode: this.IMP, cycles: 2 },
    { name: "???", operate: this.XXX, addrmode: this.IMP, cycles: 7 },
    { name: "???", operate: this.NOP, addrmode: this.IMP, cycles: 4 },
    { name: "AND", operate: this.AND, addrmode: this.ABX, cycles: 4 },
    { name: "ROL", operate: this.ROL, addrmode: this.ABX, cycles: 7 },
    { name: "???", operate: this.XXX, addrmode: this.IMP, cycles: 7 },
		{ name: "RTI", operate: this.RTI, addrmode: this.IMP, cycles: 6 },
    { name: "EOR", operate: this.EOR, addrmode: this.IZX, cycles: 6 },
    { name: "???", operate: this.XXX, addrmode: this.IMP, cycles: 2 },
    { name: "???", operate: this.XXX, addrmode: this.IMP, cycles: 8 },
    { name: "???", operate: this.NOP, addrmode: this.IMP, cycles: 3 },
    { name: "EOR", operate: this.EOR, addrmode: this.ZP0, cycles: 3 },
    { name: "LSR", operate: this.LSR, addrmode: this.ZP0, cycles: 5 },
    { name: "???", operate: this.XXX, addrmode: this.IMP, cycles: 5 },
    { name: "PHA", operate: this.PHA, addrmode: this.IMP, cycles: 3 },
    { name: "EOR", operate: this.EOR, addrmode: this.IMM, cycles: 2 },
    { name: "LSR", operate: this.LSR, addrmode: this.IMP, cycles: 2 },
    { name: "???", operate: this.XXX, addrmode: this.IMP, cycles: 2 },
    { name: "JMP", operate: this.JMP, addrmode: this.ABS, cycles: 3 },
    { name: "EOR", operate: this.EOR, addrmode: this.ABS, cycles: 4 },
    { name: "LSR", operate: this.LSR, addrmode: this.ABS, cycles: 6 },
    { name: "???", operate: this.XXX, addrmode: this.IMP, cycles: 6 },
		{ name: "BVC", operate: this.BVC, addrmode: this.REL, cycles: 2 },
    { name: "EOR", operate: this.EOR, addrmode: this.IZY, cycles: 5 },
    { name: "???", operate: this.XXX, addrmode: this.IMP, cycles: 2 },
    { name: "???", operate: this.XXX, addrmode: this.IMP, cycles: 8 },
    { name: "???", operate: this.NOP, addrmode: this.IMP, cycles: 4 },
    { name: "EOR", operate: this.EOR, addrmode: this.ZPX, cycles: 4 },
    { name: "LSR", operate: this.LSR, addrmode: this.ZPX, cycles: 6 },
    { name: "???", operate: this.XXX, addrmode: this.IMP, cycles: 6 },
    { name: "CLI", operate: this.CLI, addrmode: this.IMP, cycles: 2 },
    { name: "EOR", operate: this.EOR, addrmode: this.ABY, cycles: 4 },
    { name: "???", operate: this.NOP, addrmode: this.IMP, cycles: 2 },
    { name: "???", operate: this.XXX, addrmode: this.IMP, cycles: 7 },
    { name: "???", operate: this.NOP, addrmode: this.IMP, cycles: 4 },
    { name: "EOR", operate: this.EOR, addrmode: this.ABX, cycles: 4 },
    { name: "LSR", operate: this.LSR, addrmode: this.ABX, cycles: 7 },
    { name: "???", operate: this.XXX, addrmode: this.IMP, cycles: 7 },
		{ name: "RTS", operate: this.RTS, addrmode: this.IMP, cycles: 6 },
    { name: "ADC", operate: this.ADC, addrmode: this.IZX, cycles: 6 },
    { name: "???", operate: this.XXX, addrmode: this.IMP, cycles: 2 },
    { name: "???", operate: this.XXX, addrmode: this.IMP, cycles: 8 },
    { name: "???", operate: this.NOP, addrmode: this.IMP, cycles: 3 },
    { name: "ADC", operate: this.ADC, addrmode: this.ZP0, cycles: 3 },
    { name: "ROR", operate: this.ROR, addrmode: this.ZP0, cycles: 5 },
    { name: "???", operate: this.XXX, addrmode: this.IMP, cycles: 5 },
    { name: "PLA", operate: this.PLA, addrmode: this.IMP, cycles: 4 },
    { name: "ADC", operate: this.ADC, addrmode: this.IMM, cycles: 2 },
    { name: "ROR", operate: this.ROR, addrmode: this.IMP, cycles: 2 },
    { name: "???", operate: this.XXX, addrmode: this.IMP, cycles: 2 },
    { name: "JMP", operate: this.JMP, addrmode: this.IND, cycles: 5 },
    { name: "ADC", operate: this.ADC, addrmode: this.ABS, cycles: 4 },
    { name: "ROR", operate: this.ROR, addrmode: this.ABS, cycles: 6 },
    { name: "???", operate: this.XXX, addrmode: this.IMP, cycles: 6 },
		{ name: "BVS", operate: this.BVS, addrmode: this.REL, cycles: 2 },
    { name: "ADC", operate: this.ADC, addrmode: this.IZY, cycles: 5 },
    { name: "???", operate: this.XXX, addrmode: this.IMP, cycles: 2 },
    { name: "???", operate: this.XXX, addrmode: this.IMP, cycles: 8 },
    { name: "???", operate: this.NOP, addrmode: this.IMP, cycles: 4 },
    { name: "ADC", operate: this.ADC, addrmode: this.ZPX, cycles: 4 },
    { name: "ROR", operate: this.ROR, addrmode: this.ZPX, cycles: 6 },
    { name: "???", operate: this.XXX, addrmode: this.IMP, cycles: 6 },
    { name: "SEI", operate: this.SEI, addrmode: this.IMP, cycles: 2 },
    { name: "ADC", operate: this.ADC, addrmode: this.ABY, cycles: 4 },
    { name: "???", operate: this.NOP, addrmode: this.IMP, cycles: 2 },
    { name: "???", operate: this.XXX, addrmode: this.IMP, cycles: 7 },
    { name: "???", operate: this.NOP, addrmode: this.IMP, cycles: 4 },
    { name: "ADC", operate: this.ADC, addrmode: this.ABX, cycles: 4 },
    { name: "ROR", operate: this.ROR, addrmode: this.ABX, cycles: 7 },
    { name: "???", operate: this.XXX, addrmode: this.IMP, cycles: 7 },
		{ name: "???", operate: this.NOP, addrmode: this.IMP, cycles: 2 },
    { name: "STA", operate: this.STA, addrmode: this.IZX, cycles: 6 },
    { name: "???", operate: this.NOP, addrmode: this.IMP, cycles: 2 },
    { name: "???", operate: this.XXX, addrmode: this.IMP, cycles: 6 },
    { name: "STY", operate: this.STY, addrmode: this.ZP0, cycles: 3 },
    { name: "STA", operate: this.STA, addrmode: this.ZP0, cycles: 3 },
    { name: "STX", operate: this.STX, addrmode: this.ZP0, cycles: 3 },
    { name: "???", operate: this.XXX, addrmode: this.IMP, cycles: 3 },
    { name: "DEY", operate: this.DEY, addrmode: this.IMP, cycles: 2 },
    { name: "???", operate: this.NOP, addrmode: this.IMP, cycles: 2 },
    { name: "TXA", operate: this.TXA, addrmode: this.IMP, cycles: 2 },
    { name: "???", operate: this.XXX, addrmode: this.IMP, cycles: 2 },
    { name: "STY", operate: this.STY, addrmode: this.ABS, cycles: 4 },
    { name: "STA", operate: this.STA, addrmode: this.ABS, cycles: 4 },
    { name: "STX", operate: this.STX, addrmode: this.ABS, cycles: 4 },
    { name: "???", operate: this.XXX, addrmode: this.IMP, cycles: 4 },
		{ name: "BCC", operate: this.BCC, addrmode: this.REL, cycles: 2 },
    { name: "STA", operate: this.STA, addrmode: this.IZY, cycles: 6 },
    { name: "???", operate: this.XXX, addrmode: this.IMP, cycles: 2 },
    { name: "???", operate: this.XXX, addrmode: this.IMP, cycles: 6 },
    { name: "STY", operate: this.STY, addrmode: this.ZPX, cycles: 4 },
    { name: "STA", operate: this.STA, addrmode: this.ZPX, cycles: 4 },
    { name: "STX", operate: this.STX, addrmode: this.ZPY, cycles: 4 },
    { name: "???", operate: this.XXX, addrmode: this.IMP, cycles: 4 },
    { name: "TYA", operate: this.TYA, addrmode: this.IMP, cycles: 2 },
    { name: "STA", operate: this.STA, addrmode: this.ABY, cycles: 5 },
    { name: "TXS", operate: this.TXS, addrmode: this.IMP, cycles: 2 },
    { name: "???", operate: this.XXX, addrmode: this.IMP, cycles: 5 },
    { name: "???", operate: this.NOP, addrmode: this.IMP, cycles: 5 },
    { name: "STA", operate: this.STA, addrmode: this.ABX, cycles: 5 },
    { name: "???", operate: this.XXX, addrmode: this.IMP, cycles: 5 },
    { name: "???", operate: this.XXX, addrmode: this.IMP, cycles: 5 },
		{ name: "LDY", operate: this.LDY, addrmode: this.IMM, cycles: 2 },
    { name: "LDA", operate: this.LDA, addrmode: this.IZX, cycles: 6 },
    { name: "LDX", operate: this.LDX, addrmode: this.IMM, cycles: 2 },
    { name: "???", operate: this.XXX, addrmode: this.IMP, cycles: 6 },
    { name: "LDY", operate: this.LDY, addrmode: this.ZP0, cycles: 3 },
    { name: "LDA", operate: this.LDA, addrmode: this.ZP0, cycles: 3 },
    { name: "LDX", operate: this.LDX, addrmode: this.ZP0, cycles: 3 },
    { name: "???", operate: this.XXX, addrmode: this.IMP, cycles: 3 },
    { name: "TAY", operate: this.TAY, addrmode: this.IMP, cycles: 2 },
    { name: "LDA", operate: this.LDA, addrmode: this.IMM, cycles: 2 },
    { name: "TAX", operate: this.TAX, addrmode: this.IMP, cycles: 2 },
    { name: "???", operate: this.XXX, addrmode: this.IMP, cycles: 2 },
    { name: "LDY", operate: this.LDY, addrmode: this.ABS, cycles: 4 },
    { name: "LDA", operate: this.LDA, addrmode: this.ABS, cycles: 4 },
    { name: "LDX", operate: this.LDX, addrmode: this.ABS, cycles: 4 },
    { name: "???", operate: this.XXX, addrmode: this.IMP, cycles: 4 },
		{ name: "BCS", operate: this.BCS, addrmode: this.REL, cycles: 2 },
    { name: "LDA", operate: this.LDA, addrmode: this.IZY, cycles: 5 },
    { name: "???", operate: this.XXX, addrmode: this.IMP, cycles: 2 },
    { name: "???", operate: this.XXX, addrmode: this.IMP, cycles: 5 },
    { name: "LDY", operate: this.LDY, addrmode: this.ZPX, cycles: 4 },
    { name: "LDA", operate: this.LDA, addrmode: this.ZPX, cycles: 4 },
    { name: "LDX", operate: this.LDX, addrmode: this.ZPY, cycles: 4 },
    { name: "???", operate: this.XXX, addrmode: this.IMP, cycles: 4 },
    { name: "CLV", operate: this.CLV, addrmode: this.IMP, cycles: 2 },
    { name: "LDA", operate: this.LDA, addrmode: this.ABY, cycles: 4 },
    { name: "TSX", operate: this.TSX, addrmode: this.IMP, cycles: 2 },
    { name: "???", operate: this.XXX, addrmode: this.IMP, cycles: 4 },
    { name: "LDY", operate: this.LDY, addrmode: this.ABX, cycles: 4 },
    { name: "LDA", operate: this.LDA, addrmode: this.ABX, cycles: 4 },
    { name: "LDX", operate: this.LDX, addrmode: this.ABY, cycles: 4 },
    { name: "???", operate: this.XXX, addrmode: this.IMP, cycles: 4 },
		{ name: "CPY", operate: this.CPY, addrmode: this.IMM, cycles: 2 },
    { name: "CMP", operate: this.CMP, addrmode: this.IZX, cycles: 6 },
    { name: "???", operate: this.NOP, addrmode: this.IMP, cycles: 2 },
    { name: "???", operate: this.XXX, addrmode: this.IMP, cycles: 8 },
    { name: "CPY", operate: this.CPY, addrmode: this.ZP0, cycles: 3 },
    { name: "CMP", operate: this.CMP, addrmode: this.ZP0, cycles: 3 },
    { name: "DEC", operate: this.DEC, addrmode: this.ZP0, cycles: 5 },
    { name: "???", operate: this.XXX, addrmode: this.IMP, cycles: 5 },
    { name: "INY", operate: this.INY, addrmode: this.IMP, cycles: 2 },
    { name: "CMP", operate: this.CMP, addrmode: this.IMM, cycles: 2 },
    { name: "DEX", operate: this.DEX, addrmode: this.IMP, cycles: 2 },
    { name: "???", operate: this.XXX, addrmode: this.IMP, cycles: 2 },
    { name: "CPY", operate: this.CPY, addrmode: this.ABS, cycles: 4 },
    { name: "CMP", operate: this.CMP, addrmode: this.ABS, cycles: 4 },
    { name: "DEC", operate: this.DEC, addrmode: this.ABS, cycles: 6 },
    { name: "???", operate: this.XXX, addrmode: this.IMP, cycles: 6 },
		{ name: "BNE", operate: this.BNE, addrmode: this.REL, cycles: 2 },
    { name: "CMP", operate: this.CMP, addrmode: this.IZY, cycles: 5 },
    { name: "???", operate: this.XXX, addrmode: this.IMP, cycles: 2 },
    { name: "???", operate: this.XXX, addrmode: this.IMP, cycles: 8 },
    { name: "???", operate: this.NOP, addrmode: this.IMP, cycles: 4 },
    { name: "CMP", operate: this.CMP, addrmode: this.ZPX, cycles: 4 },
    { name: "DEC", operate: this.DEC, addrmode: this.ZPX, cycles: 6 },
    { name: "???", operate: this.XXX, addrmode: this.IMP, cycles: 6 },
    { name: "CLD", operate: this.CLD, addrmode: this.IMP, cycles: 2 },
    { name: "CMP", operate: this.CMP, addrmode: this.ABY, cycles: 4 },
    { name: "NOP", operate: this.NOP, addrmode: this.IMP, cycles: 2 },
    { name: "???", operate: this.XXX, addrmode: this.IMP, cycles: 7 },
    { name: "???", operate: this.NOP, addrmode: this.IMP, cycles: 4 },
    { name: "CMP", operate: this.CMP, addrmode: this.ABX, cycles: 4 },
    { name: "DEC", operate: this.DEC, addrmode: this.ABX, cycles: 7 },
    { name: "???", operate: this.XXX, addrmode: this.IMP, cycles: 7 },
		{ name: "CPX", operate: this.CPX, addrmode: this.IMM, cycles: 2 },
    { name: "SBC", operate: this.SBC, addrmode: this.IZX, cycles: 6 },
    { name: "???", operate: this.NOP, addrmode: this.IMP, cycles: 2 },
    { name: "???", operate: this.XXX, addrmode: this.IMP, cycles: 8 },
    { name: "CPX", operate: this.CPX, addrmode: this.ZP0, cycles: 3 },
    { name: "SBC", operate: this.SBC, addrmode: this.ZP0, cycles: 3 },
    { name: "INC", operate: this.INC, addrmode: this.ZP0, cycles: 5 },
    { name: "???", operate: this.XXX, addrmode: this.IMP, cycles: 5 },
    { name: "INX", operate: this.INX, addrmode: this.IMP, cycles: 2 },
    { name: "SBC", operate: this.SBC, addrmode: this.IMM, cycles: 2 },
    { name: "NOP", operate: this.NOP, addrmode: this.IMP, cycles: 2 },
    { name: "???", operate: this.SBC, addrmode: this.IMP, cycles: 2 },
    { name: "CPX", operate: this.CPX, addrmode: this.ABS, cycles: 4 },
    { name: "SBC", operate: this.SBC, addrmode: this.ABS, cycles: 4 },
    { name: "INC", operate: this.INC, addrmode: this.ABS, cycles: 6 },
    { name: "???", operate: this.XXX, addrmode: this.IMP, cycles: 6 },
		{ name: "BEQ", operate: this.BEQ, addrmode: this.REL, cycles: 2 },
    { name: "SBC", operate: this.SBC, addrmode: this.IZY, cycles: 5 },
    { name: "???", operate: this.XXX, addrmode: this.IMP, cycles: 2 },
    { name: "???", operate: this.XXX, addrmode: this.IMP, cycles: 8 },
    { name: "???", operate: this.NOP, addrmode: this.IMP, cycles: 4 },
    { name: "SBC", operate: this.SBC, addrmode: this.ZPX, cycles: 4 },
    { name: "INC", operate: this.INC, addrmode: this.ZPX, cycles: 6 },
    { name: "???", operate: this.XXX, addrmode: this.IMP, cycles: 6 },
    { name: "SED", operate: this.SED, addrmode: this.IMP, cycles: 2 },
    { name: "SBC", operate: this.SBC, addrmode: this.ABY, cycles: 4 },
    { name: "NOP", operate: this.NOP, addrmode: this.IMP, cycles: 2 },
    { name: "???", operate: this.XXX, addrmode: this.IMP, cycles: 7 },
    { name: "???", operate: this.NOP, addrmode: this.IMP, cycles: 4 },
    { name: "SBC", operate: this.SBC, addrmode: this.ABX, cycles: 4 },
    { name: "INC", operate: this.INC, addrmode: this.ABX, cycles: 7 },
    { name: "???", operate: this.XXX, addrmode: this.IMP, cycles: 7 },
	]
}

function convertDecToHexString (num, width, noPrefix) {
	let base = ''
  let prefix = ''
	const str = num.toString(16)

  if (num < 0) prefix += '-'
  if (!noPrefix) prefix += '0x'
  if (width === undefined) return prefix + str

  for (var i = 0; i < width; i++) base += '0'

  return prefix + (base + str).substr(-1 * width)
}