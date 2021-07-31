function Mapper000 (nPRGBanks, nCHRBanks) {
	this.nPRGBanks = nPRGBanks
	this.nCHRBanks = nCHRBanks

	this.reset = () => {}

	this.cpuMapRead = (addr) => {
		if (addr >= 0x8000 && addr <= 0xFFFF) {
			return { mappedAddr: addr & (this.nPRGBanks > 1 ? 0x7FFF : 0x3FFF), output: true }
		}
		else return { output: false }
	}

	this.cpuMapWrite = (addr) => {
		if (addr >= 0x8000 && addr <= 0xFFFF) {
			return { mappedAddr: addr & (this.nPRGBanks > 1 ? 0x7FFF : 0x3FFF), output: true }
		}
		else return { output: false }
	}

	this.ppuMapRead = (addr) => {
		if (addr >= 0x0000 && addr <= 0x1FFF) {
			return { mappedAddr: addr, output: true }
		}
		else return { output: false }
	}

	this.ppuMapWrite = (addr) => {
		if (addr >= 0x0000 && addr <= 0x1FFF) {
			if (this.nCHRBanks == 0) return { mappedAddr: addr, output: true }
		}
		return { output: false }
	}
}