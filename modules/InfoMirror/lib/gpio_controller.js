/* GPIO Controller for InfoMirror
 * Handles all GPIO operations for sensors and LEDs
 */

const EventEmitter = require('events');

class GPIOController extends EventEmitter {
    constructor(config) {
        super();
        
        this.config = {
            motionSensorPin: config.motionSensorPin || 18,
            ledPins: config.ledPins || [12, 16, 20, 21],
            lightRegulatorPin: config.lightRegulatorPin || 13,
            debugMode: config.debugMode || false
        };
        
        this.initialized = false;
        this.gpio = null;
        this.pwm = null;
        this.currentLedIntensity = 0;
        
        // Try to load GPIO library
        try {
            // For production on Raspberry Pi
            this.gpio = require('rpi-gpio');
            this.pwm = require('pigpio').Gpio;
        } catch (error) {
            if (this.config.debugMode) {
                console.log('GPIO libraries not available - using mock mode');
                this.mockMode = true;
            } else {
                throw new Error('GPIO libraries not available. Run on Raspberry Pi or enable debug mode.');
            }
        }
    }

    async initialize() {
        console.log('Initializing GPIO controller...');
        
        if (this.mockMode) {
            return this.initializeMockMode();
        }
        
        try {
            // Set up motion sensor pin (input)
            await this.setupPin(this.config.motionSensorPin, this.gpio.DIR_IN);
            
            // Set up LED pins (output)
            for (let pin of this.config.ledPins) {
                await this.setupPin(pin, this.gpio.DIR_OUT);
                await this.gpio.write(pin, false); // Start with LEDs off
            }
            
            // Set up PWM for LED intensity control
            this.setupPWM();
            
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
        
        // Simulate hardware responses
        setTimeout(() => {
            if (this.config.debugMode) {
                console.log('Mock: Simulating motion detection');
                this.emit('motionDetected');
            }
        }, 5000);
        
        return Promise.resolve();
    }

    async setupPin(pin, direction) {
        return new Promise((resolve, reject) => {
            this.gpio.setup(pin, direction, (err) => {
                if (err) {
                    reject(err);
                } else {
                    resolve();
                }
            });
        });
    }

    setupPWM() {
        if (this.mockMode) return;
        
        try {
            // Initialize PWM for first LED pin (others will follow same pattern)
            this.ledPWM = this.config.ledPins.map(pin => {
                const pwmPin = new this.pwm(pin, { mode: this.pwm.OUTPUT });
                return pwmPin;
            });
        } catch (error) {
            console.error('Failed to setup PWM:', error);
        }
    }

    // Read motion sensor
    readMotionSensor() {
        if (this.mockMode) {
            // Return random motion for testing
            return Math.random() > 0.7;
        }
        
        return new Promise((resolve, reject) => {
            this.gpio.read(this.config.motionSensorPin, (err, value) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(Boolean(value));
                }
            });
        });
    }

    // Set LED intensity (0-100)
    setLEDIntensity(intensity) {
        if (!this.initialized) {
            console.warn('GPIO not initialized');
            return;
        }
        
        const clampedIntensity = Math.max(0, Math.min(100, intensity));
        this.currentLedIntensity = clampedIntensity;
        
        if (this.mockMode) {
            console.log(`Mock: Setting LED intensity to ${clampedIntensity}%`);
            return;
        }
        
        try {
            // Convert percentage to PWM value (0-255)
            const pwmValue = Math.round((clampedIntensity / 100) * 255);
            
            if (this.ledPWM) {
                this.ledPWM.forEach(led => {
                    led.pwmWrite(pwmValue);
                });
            } else {
                // Fallback to digital on/off
                const isOn = clampedIntensity > 0;
                this.config.ledPins.forEach(pin => {
                    this.gpio.write(pin, isOn);
                });
            }
            
            if (this.config.debugMode) {
                console.log(`LED intensity set to ${clampedIntensity}% (PWM: ${pwmValue})`);
            }
            
        } catch (error) {
            console.error('Error setting LED intensity:', error);
            this.emit('error', error);
        }
    }

    // Turn off all LEDs
    turnOffLEDs() {
        this.setLEDIntensity(0);
    }

    // Test LED functionality
    async testLEDs(intensity = 50, duration = 2000) {
        console.log(`Testing LEDs at ${intensity}% for ${duration}ms`);
        
        this.setLEDIntensity(intensity);
        
        return new Promise(resolve => {
            setTimeout(() => {
                this.turnOffLEDs();
                resolve();
            }, duration);
        });
    }

    // Read light regulator (potentiometer)
    readLightRegulator() {
        if (this.mockMode) {
            // Return random value for testing
            return Math.floor(Math.random() * 100);
        }
        
        // This would typically use an ADC converter
        // For now, return a simulated value
        return Math.floor(Math.random() * 100);
    }

    // Cleanup GPIO resources
    cleanup() {
        console.log('Cleaning up GPIO controller...');
        
        if (this.mockMode) {
            return;
        }
        
        try {
            // Turn off all LEDs
            this.turnOffLEDs();
            
            // Clean up PWM
            if (this.ledPWM) {
                this.ledPWM.forEach(led => {
                    led.digitalWrite(0);
                });
            }
            
            // Destroy GPIO
            if (this.gpio) {
                this.gpio.destroy();
            }
            
        } catch (error) {
            console.error('Error during GPIO cleanup:', error);
        }
    }
}

module.exports = GPIOController;