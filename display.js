function Display (canvas) {
	this.ctx = canvas.getContext('2d')
	this.height = canvas.height
	this.width = canvas.width
	this.data = this.ctx.createImageData(this.width, this.height)
	this.uint32 = new Uint32Array(this.data.data.buffer)
}

Display.prototype.isDisplay = true

Display.prototype.renderPixel = function (x, y, rgb) {
	const index = (y * this.width + x) 
	this.uint32[index] = 4278202179
	// this.data.data[index] = rgb
	// this.data.data[index + 1] = rgb
	// this.data.data[index + 2] = rgb
	// this.data.data[index + 3] = 255
}

Display.prototype.updateScreen = function () {
	this.ctx.putImageData(this.data, 0, 0)
}
