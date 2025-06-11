/* Sensor Manager for InfoMirror
 * Manages motion detection and light regulation
 */

const EventEmitter = require('events');

class SensorManager extends EventEmitter {
    constructor(config) {
        super();
        
        this.config = {
            motionTimeout: config.motionTimeout || 30000,
            motionSensitivity: config.motionSensitivity || 80,
            lightRegulatorPollingInterval: 1000,
            debugMode: config.debugMode || false
        };
        
        this.gpioController = null;
        this.motionTimer = null;
        this.lightRegulatorTimer = null;
        this.lastLightIntensity = 50;
        this.motionActive = false;
        this.initialized = false;
    }

    initialize(gpioController) {
        this.gpioController = gpioController;
        
        console.log('Initializing sensor manager...');
        
        // Start motion monitoring
        this.startMotionMonitoring();
        
        // Start light regulator monitoring
        this.startLightRegulatorMonitoring();
        
        this.initialized = true;
        console.log('Sensor manager initialized successfully');
    }

    startMotionMonitoring() {
        const checkMotion = async () => {
            try {
                const motionDetected = await this.gpioController.readMotionSensor();
                
                if (motionDetected && !this.motionActive) {
                    this.motionActive = true;
                    this.emit('motionDetected');
                    
                    if (this.config.debugMode) {
                        console.log('Motion detected - starting timeout timer');
                    }
                }
                
                if (motionDetected) {
                    // Reset timeout timer
                    this.resetMotionTimer();
                }
                
            } catch (error) {
                console.error('Error reading motion sensor:', error);
                this.emit('error', error);
            }
        };
        
        // Check motion every 500ms
        this.motionMonitoringInterval = setInterval(checkMotion, 500);
    }

    resetMotionTimer() {
        if (this.motionTimer) {
            clearTimeout(this.motionTimer);
        }
        
        this.motionTimer = setTimeout(() => {
            this.motionActive = false;
            this.emit('motionTimeout');
            
            if (this.config.debugMode) {
                console.log('Motion timeout - no motion detected');
            }
        }, this.config.motionTimeout);
    }

    startLightRegulatorMonitoring() {
        const checkLightRegulator = () => {
            try {
                const currentIntensity = this.gpioController.readLightRegulator();
                
                // Only emit change if difference is significant (>5%)
                if (Math.abs(currentIntensity - this.lastLightIntensity) > 5) {
                    this.lastLightIntensity = currentIntensity;
                    this.emit('lightIntensityChanged', currentIntensity);
                    
                    if (this.config.debugMode) {
                        console.log(`Light intensity changed to ${currentIntensity}%`);
                    }
                }
                
            } catch (error) {
                console.error('Error reading light regulator:', error);
                this.emit('error', error);
            }
        };
        
        this.lightRegulatorTimer = setInterval(
            checkLightRegulator, 
            this.config.lightRegulatorPollingInterval
        );
    }

    setMotionSensitivity(sensitivity) {
        this.config.motionSensitivity = Math.max(0, Math.min(100, sensitivity));
        
        if (this.config.debugMode) {
            console.log(`Motion sensitivity set to ${this.config.motionSensitivity}%`);
        }
    }

    setMotionTimeout(timeout) {
        this.config.motionTimeout = Math.max(1000, timeout); // Minimum 1 second
        
        if (this.config.debugMode) {
            console.log(`Motion timeout set to ${this.config.motionTimeout}ms`);
        }
    }

    // Cleanup resources
    cleanup() {
        console.log('Cleaning up sensor manager...');
        
        if (this.motionMonitoringInterval) {
            clearInterval(this.motionMonitoringInterval);
        }
        
        if (this.motionTimer) {
            clearTimeout(this.motionTimer);
        }
        
        if (this.lightRegulatorTimer) {
            clearInterval(this.lightRegulatorTimer);
        }
    }
}

module.exports = SensorManager;