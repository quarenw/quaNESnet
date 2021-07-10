function Cartridge (buffer) {
	this.nMapperId = 0
	this.nPRGBanks = 0
	this.nCHRBanks = 0
	this.vPRGMemory = []
	this.vCHRMemory = []
	this.bImageValid = false
	this.trainerOffest = 0

  this.header = {
    headerString: '',
    numRomBanks: 0,
    numVRomBanks: 0,
    info: [],
    numPrgRamBanks: 0,
    info2: '',
    reserved: [],
    sizeOfHeader: 16,
    prgRomSize: 16384,
    chrRomSize: 8192
  }

	this.data = new Uint8Array(buffer)
  console.log('CARTRIDGE: ', this.data)

  this.header.headerString = new TextDecoder("ascii").decode(this.data.slice(0, 4))
  this.header.numRomBanks = this.data.slice(4, 5)[0]
  this.header.numVRomBanks = this.data.slice(5, 6)[0]
  this.header.info.push(...this.data.slice(6, 8))
  this.header.numPrgRamBanks = this.data.slice(8, 9)[0]
  this.header.info2 = this.data.slice(9, 10)[0]
  this.header.reserved.push(...this.data.slice(10, 16))
  console.log('HEADER: ', this.header)

	if (this.header.info[0] & 0x04) this.trainerOffest = 512

	this.nMapperId = ((this.header.info[1] >> 4) << 4) | (this.header.info[0] >> 4)
	this.mirror = (this.header.info[0] & 0x01) ? 'VERTICAL' : 'HORIZONTAL'

	this.nFileType = 1
	if (this.nFileType == 0) {}
	if (this.nFileType == 1) {
		this.nPRGBanks = this.header.numRomBanks
		const prgOffest = (this.header.prgRomSize * this.nPRGBanks) + this.trainerOffest + 16
		this.vPRGMemory.push(...this.data.slice(16, prgOffest))

		this.nCHRBanks = this.header.numVRomBanks
		const chrOffset = prgOffest + (this.header.chrRomSize * (this.nCHRBanks || 1))
		this.vCHRMemory.push(...this.data.slice(prgOffest, chrOffset))
	}
	if (this.nFileType ==2) {}

	this.bImageValid = true

	switch (this.nMapperId) {
		case 0:
			this.pMapper = new Mapper000(this.nPRGBanks, this.nCHRBanks, this.nPRGBanks, this.nCHRBanks)
			break
	}

	console.log('vPRGMemory: ', this.vPRGMemory)
	console.log('vCHRMemory: ', this.vCHRMemory)

	this.imageValid = () => {
		return this.bImageValid
	}

	this.cpuRead = (addr) => {
		const read = this.pMapper.cpuMapRead(addr)
		if (read.output) {
			return { data: this.vPRGMemory[read.mappedAddr], output: true }
		}
		else return { output: false }
	}

	this.cpuWrite = (addr, data) => {
		const read = this.pMapper.cpuMapWrite(addr)
		if (read.output) {
			this.vPRGMemory[read.mappedAddr] = data
			return true
		}
		else return false
	}

	this.ppuRead = (addr) => {
		const read = this.pMapper.ppuMapRead(addr)
		if (read.output) {
			return { data: this.vPRGMemory[read.mappedAddr], output: true }
		}
		else return { output: false }
	}

	this.ppuWrite = (addr, data) => {
		const read = this.pMapper.ppuMapWrite(addr)
		if (read.output) {
			this.vPRGMemory[read.mappedAddr] = data
			return true
		}
		else return false
	}

	this.reset = () => {
		if (this.pMapper) this.pMapper.reset()
	}
}
