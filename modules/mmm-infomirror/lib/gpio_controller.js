/* GPIO Controller for InfoMirror - Updated for rpi-ws281x and modern ADC
 * Handles ultrasonic sensor and NeoPixel LED strip operations
 */

const EventEmitter = require('events');
const { spawn } = require('child_process');

class GPIOController extends EventEmitter {
    constructor(config) {
        super();
        
        this.config = {
            // HC-SR04 Ultrasonic Sensor
            ultrasonicTrigPin: config.ultrasonicTrigPin || 18,
            ultrasonicEchoPin: config.ultrasonicEchoPin || 24,
            detectionDistance: config.detectionDistance || 100, // cm
            
            // NeoPixel LED Strip
            neopixelPin: config.neopixelPin || 12,
            neopixelCount: config.neopixelCount || 10,
            neopixelType: config.neopixelType || 'grb', // For WS2812B
            
            // ADC Configuration
            adcType: config.adcType || 'mcp3008', // 'mcp3008', 'mcp3421', 'hx711', 'builtin'
            adcChannel: config.adcChannel || 0,
            spiDevice: config.spiDevice || 0, // SPI device number
            
            debugMode: config.debugMode || false
        };
        
        this.initialized = false;
        this.pigpio = null;
        this.neopixels = null;
        this.currentLedIntensity = 0;
        this.currentDistance = 999;
        this.adcController = null;
        this.neopixelMockMode = false;
        this.mockMode = false;
        
        // Ultrasonic sensor variables
        this.triggerPin = null;
        this.echoPin = null;
        this.startTime = 0;
        this.endTime = 0;
        
        // Initialize libraries
        this.initializeLibraries();
    }

    initializeLibraries() {
        try {
            // For ultrasonic sensor timing
            this.pigpio = require('pigpio').Gpio;
            console.log('✓ pigpio loaded successfully');
        } catch (error) {
            console.warn('⚠ pigpio not available, using mock mode for ultrasonic sensor');
            this.mockMode = true;
        }

        // Try to load NeoPixel library (new rpi-ws281x API)
        try {
            this.ws281x = require('rpi-ws281x');
            console.log('✓ rpi-ws281x loaded successfully');
        } catch (error) {
            console.warn('⚠ rpi-ws281x not available, using mock mode for LEDs');
            this.neopixelMockMode = true;
        }

        // ADC will be initialized separately based on type
        console.log(`ADC type configured: ${this.config.adcType}`);
    }

    async initialize() {
        console.log('Initializing GPIO controller...');
        
        if (this.mockMode && this.neopixelMockMode) {
            return this.initializeFullMockMode();
        }
        
        try {
            // Initialize ultrasonic sensor
            if (!this.mockMode) {
                await this.setupUltrasonicSensor();
            } else {
                await this.setupMockUltrasonicSensor();
            }
            
            // Initialize NeoPixel strip
            if (!this.neopixelMockMode) {
                await this.setupNeoPixelStrip();
            } else {
                await this.setupMockNeoPixelStrip();
            }
            
            // Initialize ADC based on type
            await this.setupADC();
            
            this.initialized = true;
            console.log('✓ GPIO controller initialized successfully');
            
        } catch (error) {
            console.error('✗ Failed to initialize GPIO:', error);
            throw error;
        }
    }

    async initializeFullMockMode() {
        console.log('Initializing GPIO controller in full mock mode...');
        this.initialized = true;
        
        // Simulate distance readings
        setInterval(() => {
            const mockDistance = Math.random() > 0.9 ? 50 : 150;
            this.currentDistance = mockDistance;
            this.emit('distanceChanged', mockDistance);
        }, 2000);
        
        return Promise.resolve();
    }

    async setupMockUltrasonicSensor() {
        console.log('Setting up mock ultrasonic sensor...');
        
        setInterval(() => {
            const mockDistance = Math.random() > 0.8 ? 
                Math.random() * 80 + 20 : 
                Math.random() * 200 + 150;
            
            this.currentDistance = mockDistance;
            this.emit('distanceChanged', mockDistance);
        }, 1000);
        
        console.log('✓ Mock ultrasonic sensor initialized');
    }

    async setupMockNeoPixelStrip() {
        console.log('Setting up mock NeoPixel strip...');
        this.pixels = new Array(this.config.neopixelCount).fill(0);
        console.log(`✓ Mock NeoPixel strip initialized: ${this.config.neopixelCount} LEDs`);
    }

    async setupUltrasonicSensor() {
        console.log('Setting up HC-SR04 ultrasonic sensor...');
        
        try {
            // Initialize trigger pin (output)
            this.triggerPin = new this.pigpio(this.config.ultrasonicTrigPin, {
                mode: this.pigpio.OUTPUT
            });
            this.triggerPin.digitalWrite(0);
            
            // Initialize echo pin (input)
            this.echoPin = new this.pigpio(this.config.ultrasonicEchoPin, {
                mode: this.pigpio.INPUT,
                pullUpDown: this.pigpio.PUD_DOWN,
                edge: this.pigpio.EITHER_EDGE
            });
            
            // Set up echo pin interrupt
            this.echoPin.on('interrupt', (level, tick) => {
                if (level === 1) {
                    this.startTime = tick;
                } else {
                    this.endTime = tick;
                    this.calculateDistance();
                }
            });
            
            console.log('✓ HC-SR04 sensor initialized successfully');
            
        } catch (error) {
            console.error('✗ Failed to setup ultrasonic sensor:', error);
            throw error;
        }
    }

    async setupNeoPixelStrip() {
        console.log('Setting up NeoPixel LED strip with new rpi-ws281x API...');
        
        try {
            // New rpi-ws281x API configuration
            const options = {
                count: this.config.neopixelCount,
                stripType: this.config.neopixelType, // 'grb' for WS2812B
                gpio: this.config.neopixelPin,
                brightness: 255
            };
            
            // Initialize the strip
            this.ws281x.configure(options);
            
            // Create pixel array (RGB values 0-255)
            this.pixels = new Array(this.config.neopixelCount);
            for (let i = 0; i < this.config.neopixelCount; i++) {
                this.pixels[i] = { r: 0, g: 0, b: 0 };
            }
            
            // Turn off all LEDs initially
            this.clearAllLEDs();
            
            console.log(`✓ NeoPixel strip initialized: ${this.config.neopixelCount} LEDs on GPIO ${this.config.neopixelPin}`);
            
        } catch (error) {
            console.error('✗ Failed to setup NeoPixel strip:', error);
            console.log('Falling back to mock mode for NeoPixels...');
            this.neopixelMockMode = true;
            await this.setupMockNeoPixelStrip();
        }
    }

    async setupADC() {
        console.log(`Setting up ADC: ${this.config.adcType}...`);
        
        switch (this.config.adcType) {
            case 'arduino':
                await this.setupArduinoADC();
                break;
            case 'mcp3008':
                await this.setupMCP3008();
                break;
            case 'mcp3421':
                await this.setupMCP3421();
                break;
            case 'hx711':
                await this.setupHX711();
                break;
            case 'builtin':
                await this.setupBuiltinADC();
                break;
            case 'python':
                await this.setupPythonADC();
                break;
            default:
                console.log('No ADC configured, potentiometer disabled');
        }
    }

    async setupArduinoADC() {
        console.log('Setting up Arduino ADC bridge...');
        
        try {
            const SerialPort = require('serialport');
            const { ReadlineParser } = require('@serialport/parser-readline');
            
            // Try common Arduino serial ports
            const possiblePorts = ['/dev/ttyACM0', '/dev/ttyACM1', '/dev/ttyUSB0', '/dev/ttyUSB1'];
            
            for (const portPath of possiblePorts) {
                try {
                    this.arduinoPort = new SerialPort({
                        path: portPath,
                        baudRate: 9600,
                        autoOpen: false
                    });
                    
                    await new Promise((resolve, reject) => {
                        this.arduinoPort.open((err) => {
                            if (err) reject(err);
                            else resolve();
                        });
                    });
                    
                    console.log(`✓ Arduino connected on ${portPath}`);
                    break;
                    
                } catch (error) {
                    // Try next port
                    continue;
                }
            }
            
            if (!this.arduinoPort || !this.arduinoPort.isOpen) {
                throw new Error('No Arduino found on common serial ports');
            }
            
            // Set up parser for Arduino messages
            this.arduinoParser = this.arduinoPort.pipe(new ReadlineParser({ delimiter: '\n' }));
            this.arduinoParser.on('data', (data) => {
                this.handleArduinoData(data);
            });
            
            this.adcType = 'arduino';
            this.adcReady = true;
            this.lastPotValue = 50; // Default value
            
            // Wait for Arduino to be ready
            await new Promise((resolve) => {
                const checkReady = (data) => {
                    if (data.includes('ARDUINO_READY')) {
                        this.arduinoParser.removeListener('data', checkReady);
                        resolve();
                    }
                };
                this.arduinoParser.on('data', checkReady);
                
                // Timeout after 5 seconds
                setTimeout(resolve, 5000);
            });
            
            console.log('✓ Arduino ADC bridge ready');
            
        } catch (error) {
            console.error('Failed to setup Arduino ADC:', error);
            console.log('Install: npm install serialport @serialport/parser-readline');
            this.adcReady = false;
        }
    }

    handleArduinoData(data) {
        try {
            const message = JSON.parse(data);
            
            if (message.type === 'potentiometer') {
                this.lastPotValue = message.value;
                
                if (this.config.debugMode) {
                    console.log(`Potentiometer: ${message.value}% (raw: ${message.raw})`);
                }
                
                // Emit potentiometer change event
                this.emit('potentiometerChanged', message.value);
            }
            
        } catch (error) {
            // Ignore parsing errors (startup messages, etc.)
            if (this.config.debugMode && !data.includes('ARDUINO_READY')) {
                console.log('Arduino message:', data.trim());
            }
        }
    }

    async setupMCP3008() {
        // Use Python script for MCP3008 (most reliable with modern Node.js)
        console.log('Setting up MCP3008 via Python bridge...');
        this.adcType = 'python_mcp3008';
        this.adcReady = true;
    }

    async setupMCP3421() {
        console.log('Setting up MCP3421 via I2C...');
        // MCP3421 uses I2C, more reliable than SPI for newer systems
        this.adcType = 'python_mcp3421';
        this.adcReady = true;
    }

    async setupHX711() {
        console.log('Setting up HX711 load cell ADC...');
        // HX711 is commonly used for weight sensors
        this.adcType = 'python_hx711';
        this.adcReady = true;
    }

    async setupBuiltinADC() {
        console.log('Using Pi 5 built-in ADC...');
        // Raspberry Pi 5 has built-in ADC
        this.adcType = 'builtin';
        this.adcReady = true;
    }

    async setupPythonADC() {
        console.log('Setting up Python-based ADC bridge...');
        this.adcType = 'python';
        this.adcReady = true;
    }

    // Trigger ultrasonic sensor measurement
    triggerDistanceMeasurement() {
        if (!this.initialized || this.mockMode) return;
        
        try {
            this.triggerPin.digitalWrite(1);
            setTimeout(() => {
                this.triggerPin.digitalWrite(0);
            }, 0.01);
            
        } catch (error) {
            console.error('Error triggering distance measurement:', error);
            this.emit('error', error);
        }
    }

    calculateDistance() {
        if (this.startTime && this.endTime) {
            let timeDiff = this.endTime - this.startTime;
            
            if (timeDiff < 0) {
                timeDiff += (1 << 32);
            }
            
            const distance = (timeDiff * 34300) / (2 * 1000000);
            
            if (distance >= 2 && distance <= 400) {
                this.currentDistance = distance;
                this.emit('distanceChanged', distance);
                
                if (this.config.debugMode) {
                    console.log(`Distance measured: ${distance.toFixed(1)} cm`);
                }
            }
            
            this.startTime = 0;
            this.endTime = 0;
        }
    }

    startDistanceMonitoring(interval = 500) {
        if (this.mockMode) {
            console.log('Distance monitoring started (mock mode)');
            return;
        }

        if (this.distanceInterval) {
            clearInterval(this.distanceInterval);
        }
        
        this.distanceInterval = setInterval(() => {
            this.triggerDistanceMeasurement();
        }, interval);
        
        console.log(`Distance monitoring started (${interval}ms interval)`);
    }

    stopDistanceMonitoring() {
        if (this.distanceInterval) {
            clearInterval(this.distanceInterval);
            this.distanceInterval = null;
            console.log('Distance monitoring stopped');
        }
    }

    getCurrentDistance() {
        return this.currentDistance;
    }

    isObjectDetected() {
        return this.currentDistance <= this.config.detectionDistance;
    }

    // Updated LED methods for new rpi-ws281x API
    setLEDIntensity(intensity) {
        if (!this.initialized) {
            console.warn('GPIO not initialized');
            return;
        }
        
        const clampedIntensity = Math.max(0, Math.min(100, intensity));
        this.currentLedIntensity = clampedIntensity;
        
        if (this.neopixelMockMode) {
            console.log(`Mock: Setting NeoPixel intensity to ${clampedIntensity}%`);
            return;
        }
        
        try {
            if (clampedIntensity === 0) {
                this.clearAllLEDs();
            } else {
                this.setStripColor(255, 255, 255, clampedIntensity);
            }
            
            if (this.config.debugMode) {
                console.log(`NeoPixel intensity set to ${clampedIntensity}%`);
            }
            
        } catch (error) {
            console.error('Error setting LED intensity:', error);
            this.emit('error', error);
        }
    }

    setStripColor(red, green, blue, intensity = 100) {
        if (!this.initialized || this.neopixelMockMode) {
            if (this.config.debugMode) {
                console.log(`Mock: Setting color RGB(${red}, ${green}, ${blue}) at ${intensity}%`);
            }
            return;
        }
        
        try {
            // Calculate actual RGB values based on intensity
            const actualR = Math.round((red * intensity) / 100);
            const actualG = Math.round((green * intensity) / 100);
            const actualB = Math.round((blue * intensity) / 100);
            
            // Set all pixels to the same color using new API
            for (let i = 0; i < this.config.neopixelCount; i++) {
                this.pixels[i] = {
                    r: actualR,
                    g: actualG,
                    b: actualB
                };
            }
            
            // Render the changes
            this.ws281x.render(this.pixels);
            
        } catch (error) {
            console.error('Error setting strip color:', error);
            this.emit('error', error);
        }
    }

    turnOffLEDs() {
        this.setLEDIntensity(0);
    }

    clearAllLEDs() {
        if (!this.initialized || this.neopixelMockMode) return;
        
        try {
            // Set all pixels to black (off)
            for (let i = 0; i < this.config.neopixelCount; i++) {
                this.pixels[i] = { r: 0, g: 0, b: 0 };
            }
            
            this.ws281x.render(this.pixels);
            
        } catch (error) {
            console.error('Error clearing LEDs:', error);
        }
    }

    async testLEDs(intensity = 50, duration = 3000) {
        console.log(`Testing NeoPixel strip at ${intensity}% for ${duration}ms`);
        
        if (this.neopixelMockMode) {
            console.log('Mock: LED test completed');
            return Promise.resolve();
        }
        
        try {
            const colors = [
                [255, 0, 0],   // Red
                [0, 255, 0],   // Green
                [0, 0, 255],   // Blue
                [255, 255, 255] // White
            ];
            
            const stepDuration = duration / (colors.length + 1);
            
            for (let color of colors) {
                this.setStripColor(color[0], color[1], color[2], intensity);
                await new Promise(resolve => setTimeout(resolve, stepDuration));
            }
            
            this.clearAllLEDs();
            
        } catch (error) {
            console.error('LED test failed:', error);
            throw error;
        }
    }

    // Updated potentiometer reading with Arduino bridge
    async readPotentiometer() {
        if (this.mockMode || this.neopixelMockMode) {
            return Promise.resolve(Math.floor(Math.random() * 100));
        }
        
        if (!this.adcReady) {
            return Promise.resolve(50);
        }
        
        if (this.adcType === 'arduino') {
            // Return last value from Arduino (already in percentage)
            return Promise.resolve(this.lastPotValue || 50);
        }
        
        // For other ADC types, use Python bridge
        try {
            const value = await this.readADCValue();
            return Math.round(value * 100); // Convert to percentage
        } catch (error) {
            if (this.config.debugMode) {
                console.error('Error reading potentiometer:', error);
            }
            return 50; // Default value
        }
    }

    // Generic ADC reading method (NOT used for Arduino)
    async readADCValue() {
        // This method is only called for Python-based ADCs, not Arduino
        return new Promise((resolve, reject) => {
            let pythonScript;
            
            switch (this.adcType) {
                case 'python_mcp3008':
                    pythonScript = this.createMCP3008Script();
                    break;
                case 'python_mcp3421':
                    pythonScript = this.createMCP3421Script();
                    break;
                case 'python_hx711':
                    pythonScript = this.createHX711Script();
                    break;
                case 'mock':
                    resolve(Math.random()); // Random value 0-1
                    return;
                default:
                    resolve(0.5); // Default middle value
                    return;
            }
            
            const python = spawn('python3', ['-c', pythonScript]);
            let output = '';
            
            python.stdout.on('data', (data) => {
                output += data.toString();
            });
            
            python.on('close', (code) => {
                if (code === 0) {
                    try {
                        const value = parseFloat(output.trim());
                        resolve(isNaN(value) ? 0.5 : value);
                    } catch (error) {
                        reject(error);
                    }
                } else {
                    reject(new Error(`Python script failed with code ${code}`));
                }
            });
            
            python.on('error', (error) => {
                reject(error);
            });
        });
    }

    createMCP3008Script() {
        return `
import spidev
import time

try:
    spi = spidev.SpiDev()
    spi.open(0, ${this.config.spiDevice})
    spi.max_speed_hz = 1000000
    
    def read_channel(channel):
        adc = spi.xfer2([1, (8 + channel) << 4, 0])
        data = ((adc[1] & 3) << 8) + adc[2]
        return data / 1023.0
    
    value = read_channel(${this.config.adcChannel})
    print(value)
    spi.close()
except Exception as e:
    print(0.5)  # Default value on error
`;
    }

    createMCP3421Script() {
        return `
import smbus
import time

try:
    bus = smbus.SMBus(1)  # I2C bus 1
    address = 0x68  # Default MCP3421 address
    
    # Read ADC value
    data = bus.read_i2c_block_data(address, 0x00, 3)
    value = ((data[0] & 0x1F) << 8 | data[1]) / 2048.0
    print(value)
except Exception as e:
    print(0.5)  # Default value on error
`;
    }

    createHX711Script() {
        return `
# HX711 reading would require specific library
# For now, return middle value
print(0.5)
`;
    }

    getStatus() {
        return {
            initialized: this.initialized,
            mockMode: this.mockMode,
            neopixelMockMode: this.neopixelMockMode,
            adcType: this.adcType,
            adcReady: this.adcReady,
            currentDistance: this.currentDistance,
            objectDetected: this.isObjectDetected(),
            ledIntensity: this.currentLedIntensity,
            detectionDistance: this.config.detectionDistance
        };
    }

    setDetectionDistance(distance) {
        this.config.detectionDistance = Math.max(10, Math.min(400, distance));
        console.log(`Detection distance set to ${this.config.detectionDistance} cm`);
    }

    cleanup() {
        console.log('Cleaning up GPIO controller...');
        
        try {
            this.stopDistanceMonitoring();
            
            if (this.ws281x && !this.neopixelMockMode) {
                this.clearAllLEDs();
                this.ws281x.reset();
            }
            
            if (this.triggerPin && !this.mockMode) {
                this.triggerPin.digitalWrite(0);
            }
            
            // Close Arduino connection
            if (this.arduinoPort && this.arduinoPort.isOpen) {
                this.arduinoPort.close();
                console.log('Arduino connection closed');
            }
            
            console.log('GPIO cleanup completed');
            
        } catch (error) {
            console.error('Error during GPIO cleanup:', error);
        }
    }
}

module.exports = GPIOController;