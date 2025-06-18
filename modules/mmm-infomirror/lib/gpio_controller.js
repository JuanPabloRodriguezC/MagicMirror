/* GPIO Controller for InfoMirror - HC-SR04 & NeoPixel Version
 * Handles ultrasonic sensor and NeoPixel LED strip operations
 */

const EventEmitter = require('events');

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
            neopixelCount: config.neopixelCount || 30,
            neopixelType: config.neopixelType || 'ws2812',
            
            // ADC for Potentiometer (if using MCP3008)
            adcChannel: config.adcChannel || 0,
            spiDevice: config.spiDevice || '/dev/spidev0.0',
            
            debugMode: config.debugMode || false
        };
        
        this.initialized = false;
        this.pigpio = null;
        this.neopixels = null;
        this.currentLedIntensity = 0;
        this.currentDistance = 999; // Start with no detection
        this.adcController = null;
        
        // Ultrasonic sensor variables
        this.triggerPin = null;
        this.echoPin = null;
        this.startTime = 0;
        this.endTime = 0;
        
        // Try to load required libraries
        try {
            // For ultrasonic sensor timing
            this.pigpio = require('pigpio').Gpio;
            
            // For NeoPixel control
            this.ws281x = require('rpi-ws281x-native');
            
            // For ADC (potentiometer)
            this.mcp3008 = require('mcp-spi-adc');
            
        } catch (error) {
            if (this.config.debugMode) {
                console.log('Hardware libraries not available - using mock mode');
                this.mockMode = true;
            } else {
                throw new Error('Required libraries not available. Install: pigpio, rpi-ws281x-native, mcp-spi-adc');
            }
        }
    }

    async initialize() {
        console.log('Initializing GPIO controller for HC-SR04 & NeoPixel...');
        
        if (this.mockMode) {
            return this.initializeMockMode();
        }
        
        try {
            // Initialize ultrasonic sensor
            await this.setupUltrasonicSensor();
            
            // Initialize NeoPixel strip
            await this.setupNeoPixelStrip();
            
            // Initialize ADC for potentiometer
            await this.setupADC();
            
            this.initialized = true;
            console.log('GPIO controller initialized successfully');
            
        } catch (error) {
            console.error('Failed to initialize GPIO:', error);
            throw error;
        }
    }

    async initializeMockMode() {
        console.log('Initializing GPIO controller in mock mode...');
        this.initialized = true;
        
        // Simulate distance readings
        setInterval(() => {
            if (this.config.debugMode) {
                // Simulate someone approaching
                const mockDistance = Math.random() > 0.8 ? 50 : 150;
                this.currentDistance = mockDistance;
                this.emit('distanceChanged', mockDistance);
            }
        }, 2000);
        
        return Promise.resolve();
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
                    // Rising edge - start timing
                    this.startTime = tick;
                } else {
                    // Falling edge - end timing
                    this.endTime = tick;
                    this.calculateDistance();
                }
            });
            
            console.log('HC-SR04 sensor initialized successfully');
            
        } catch (error) {
            console.error('Failed to setup ultrasonic sensor:', error);
            throw error;
        }
    }

    async setupNeoPixelStrip() {
        console.log('Setting up NeoPixel LED strip...');
        
        try {
            // Configure NeoPixel strip
            const config = {
                num: this.config.neopixelCount,
                strip: this.config.neopixelType,
                gpio: this.config.neopixelPin,
                brightness: 255,
                clear_on_exit: true
            };
            
            // Initialize the strip
            this.ws281x.init(config);
            
            // Create pixel array
            this.pixels = new Uint32Array(this.config.neopixelCount);
            
            // Turn off all LEDs initially
            this.clearAllLEDs();
            
            console.log(`NeoPixel strip initialized: ${this.config.neopixelCount} LEDs on GPIO ${this.config.neopixelPin}`);
            
        } catch (error) {
            console.error('Failed to setup NeoPixel strip:', error);
            throw error;
        }
    }

    async setupADC() {
        console.log('Setting up ADC for potentiometer...');
        
        try {
            // Initialize MCP3008 ADC
            this.adcController = this.mcp3008.open(this.config.adcChannel, {
                speedHz: 20000
            }, (err) => {
                if (err) {
                    console.error('Failed to initialize ADC:', err);
                } else {
                    console.log('ADC initialized successfully');
                }
            });
            
        } catch (error) {
            console.warn('ADC setup failed, potentiometer control disabled:', error);
            // ADC is optional, continue without it
        }
    }

    // Trigger ultrasonic sensor measurement
    triggerDistanceMeasurement() {
        if (!this.initialized || this.mockMode) return;
        
        try {
            // Send 10µs trigger pulse
            this.triggerPin.digitalWrite(1);
            setTimeout(() => {
                this.triggerPin.digitalWrite(0);
            }, 0.01); // 10 microseconds
            
        } catch (error) {
            console.error('Error triggering distance measurement:', error);
            this.emit('error', error);
        }
    }

    // Calculate distance from ultrasonic timing
    calculateDistance() {
        if (this.startTime && this.endTime) {
            // Calculate time difference in microseconds
            let timeDiff = this.endTime - this.startTime;
            
            // Handle tick rollover (pigpio ticks are 32-bit)
            if (timeDiff < 0) {
                timeDiff += (1 << 32);
            }
            
            // Convert to distance in cm
            // Sound speed = 34300 cm/s, divide by 2 for round trip
            const distance = (timeDiff * 34300) / (2 * 1000000);
            
            // Validate distance reading (HC-SR04 range: 2-400cm)
            if (distance >= 2 && distance <= 400) {
                this.currentDistance = distance;
                this.emit('distanceChanged', distance);
                
                if (this.config.debugMode) {
                    console.log(`Distance measured: ${distance.toFixed(1)} cm`);
                }
            }
            
            // Reset timing variables
            this.startTime = 0;
            this.endTime = 0;
        }
    }

    // Start continuous distance monitoring
    startDistanceMonitoring(interval = 500) {
        if (this.distanceInterval) {
            clearInterval(this.distanceInterval);
        }
        
        this.distanceInterval = setInterval(() => {
            this.triggerDistanceMeasurement();
        }, interval);
        
        console.log(`Distance monitoring started (${interval}ms interval)`);
    }

    // Stop distance monitoring
    stopDistanceMonitoring() {
        if (this.distanceInterval) {
            clearInterval(this.distanceInterval);
            this.distanceInterval = null;
            console.log('Distance monitoring stopped');
        }
    }

    // Get current distance
    getCurrentDistance() {
        return this.currentDistance;
    }

    // Check if object is within detection range
    isObjectDetected() {
        return this.currentDistance <= this.config.detectionDistance;
    }

    // Set LED strip intensity (0-100)
    setLEDIntensity(intensity) {
        if (!this.initialized) {
            console.warn('GPIO not initialized');
            return;
        }
        
        const clampedIntensity = Math.max(0, Math.min(100, intensity));
        this.currentLedIntensity = clampedIntensity;
        
        if (this.mockMode) {
            console.log(`Mock: Setting NeoPixel intensity to ${clampedIntensity}%`);
            return;
        }
        
        try {
            if (clampedIntensity === 0) {
                this.clearAllLEDs();
            } else {
                this.setStripColor(255, 255, 255, clampedIntensity); // White light
            }
            
            if (this.config.debugMode) {
                console.log(`NeoPixel intensity set to ${clampedIntensity}%`);
            }
            
        } catch (error) {
            console.error('Error setting LED intensity:', error);
            this.emit('error', error);
        }
    }

    // Set strip to specific color with intensity
    setStripColor(red, green, blue, intensity = 100) {
        if (!this.initialized || this.mockMode) return;
        
        try {
            // Calculate actual RGB values based on intensity
            const actualR = Math.round((red * intensity) / 100);
            const actualG = Math.round((green * intensity) / 100);
            const actualB = Math.round((blue * intensity) / 100);
            
            // Create color value (0xWWRRGGBB format for ws281x)
            const color = (actualR << 16) | (actualG << 8) | actualB;
            
            // Set all pixels to the same color
            for (let i = 0; i < this.config.neopixelCount; i++) {
                this.pixels[i] = color;
            }
            
            // Update the strip
            this.ws281x.render(this.pixels);
            
        } catch (error) {
            console.error('Error setting strip color:', error);
            this.emit('error', error);
        }
    }

    // Turn off all LEDs
    turnOffLEDs() {
        this.setLEDIntensity(0);
    }

    // Clear all LEDs (same as turn off but explicit)
    clearAllLEDs() {
        if (!this.initialized || this.mockMode) return;
        
        try {
            // Set all pixels to black (off)
            this.pixels.fill(0);
            this.ws281x.render(this.pixels);
            
        } catch (error) {
            console.error('Error clearing LEDs:', error);
        }
    }

    // Test LED functionality with color patterns
    async testLEDs(intensity = 50, duration = 3000) {
        console.log(`Testing NeoPixel strip at ${intensity}% for ${duration}ms`);
        
        if (this.mockMode) {
            console.log('Mock: LED test completed');
            return Promise.resolve();
        }
        
        try {
            // Test sequence: Red -> Green -> Blue -> White -> Off
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
            
            // Turn off
            this.clearAllLEDs();
            
        } catch (error) {
            console.error('LED test failed:', error);
            throw error;
        }
    }

    // Read potentiometer value (0-100)
    readPotentiometer() {
        if (this.mockMode) {
            // Return random value for testing
            return Math.floor(Math.random() * 100);
        }
        
        if (!this.adcController) {
            return 50; // Default value if ADC not available
        }
        
        return new Promise((resolve, reject) => {
            this.adcController.read((err, reading) => {
                if (err) {
                    reject(err);
                } else {
                    // Convert ADC reading (0-1) to percentage (0-100)
                    const percentage = Math.round(reading.value * 100);
                    resolve(percentage);
                }
            });
        });
    }

    // Get system status
    getStatus() {
        return {
            initialized: this.initialized,
            mockMode: this.mockMode,
            currentDistance: this.currentDistance,
            objectDetected: this.isObjectDetected(),
            ledIntensity: this.currentLedIntensity,
            detectionDistance: this.config.detectionDistance
        };
    }

    // Update detection distance threshold
    setDetectionDistance(distance) {
        this.config.detectionDistance = Math.max(10, Math.min(400, distance));
        console.log(`Detection distance set to ${this.config.detectionDistance} cm`);
    }

    // Cleanup GPIO resources
    cleanup() {
        console.log('Cleaning up GPIO controller...');
        
        if (this.mockMode) {
            return;
        }
        
        try {
            // Stop distance monitoring
            this.stopDistanceMonitoring();
            
            // Clear NeoPixel strip
            if (this.ws281x) {
                this.clearAllLEDs();
                this.ws281x.finalize();
            }
            
            // Clean up GPIO pins
            if (this.triggerPin) {
                this.triggerPin.digitalWrite(0);
            }
            
            // Close ADC
            if (this.adcController) {
                this.adcController.close();
            }
            
            console.log('GPIO cleanup completed');
            
        } catch (error) {
            console.error('Error during GPIO cleanup:', error);
        }
    }
}

module.exports = GPIOController;