function Bus () {
	this.ram = initRam()
	this.cpu = new Cpu()
	this.cpu.connectBus(this)

	this.connectRam = ram => {
		this.ram = ram
	}

	this.read = (addr, readOnly) => {
		return (addr >= 0x0000 && addr <= 0xFFFF) ? this.ram[addr] : 0x00
	}

	this.write = (addr, data) => {
		if (addr >= 0x0000 && addr <= 0xFFFF) this.ram[addr] = data
	}
}

function initRam () {
	const arr = []
	for (let i = 0; i < (64 * 1024); i++) arr[i] = 0x00
	return arr
}