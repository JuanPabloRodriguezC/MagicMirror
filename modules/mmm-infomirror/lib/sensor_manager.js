/* Sensor Manager for InfoMirror - HC-SR04 Ultrasonic Version
 * Manages distance detection and potentiometer-based light regulation
 */

const EventEmitter = require('events');

class SensorManager extends EventEmitter {
    constructor(config) {
        super();
        
        this.config = {
            // Distance detection settings
            detectionDistance: config.detectionDistance || 100,    // cm - distance to trigger
            presenceTimeout: config.presenceTimeout || 30000,      // ms - how long to stay on after detection
            distanceCheckInterval: config.distanceCheckInterval || 500, // ms - how often to check distance
            
            // Potentiometer settings
            potentiometerPollingInterval: config.potentiometerPollingInterval || 1000, // ms
            potentiometerThreshold: config.potentiometerThreshold || 5, // % change needed to trigger event
            
            // Smoothing and filtering
            distanceSmoothing: config.distanceSmoothing || true,   // Enable distance smoothing
            smoothingFactor: config.smoothingFactor || 0.3,       // Smoothing factor (0-1)
            minValidDistance: config.minValidDistance || 10,       // cm - minimum valid distance
            maxValidDistance: config.maxValidDistance || 300,      // cm - maximum valid distance
            
            debugMode: config.debugMode || false
        };
        
        this.gpioController = null;
        this.presenceTimer = null;
        this.distanceMonitoringInterval = null;
        this.potentiometerTimer = null;
        
        // State tracking
        this.currentDistance = 999;
        this.smoothedDistance = 999;
        this.lastPotentiometerValue = 50;
        this.objectPresent = false;
        this.initialized = false;
        
        // Distance history for smoothing
        this.distanceHistory = [];
        this.maxHistoryLength = 5;
    }

    initialize(gpioController) {
        this.gpioController = gpioController;
        
        console.log('Initializing sensor manager for HC-SR04...');
        
        // Set up event listeners for GPIO controller
        this.setupGPIOListeners();
        
        // Start distance monitoring
        this.startDistanceMonitoring();
        
        // Start potentiometer monitoring
        this.startPotentiometerMonitoring();
        
        this.initialized = true;
        console.log('Sensor manager initialized successfully');
    }

    setupGPIOListeners() {
        if (!this.gpioController) return;

        // Listen for distance changes from GPIO controller
        this.gpioController.on('distanceChanged', (distance) => {
            this.handleDistanceChange(distance);
        });

        // Listen for GPIO errors
        this.gpioController.on('error', (error) => {
            console.error('GPIO controller error:', error);
            this.emit('error', error);
        });
    }

    startDistanceMonitoring() {
        console.log('Starting distance monitoring...');
        
        // Start the GPIO distance monitoring
        this.gpioController.startDistanceMonitoring(this.config.distanceCheckInterval);
        
        // Set up our own monitoring interval for presence logic
        this.distanceMonitoringInterval = setInterval(() => {
            this.checkPresenceLogic();
        }, this.config.distanceCheckInterval);
    }

    handleDistanceChange(rawDistance) {
        // Validate distance reading
        if (rawDistance < this.config.minValidDistance || rawDistance > this.config.maxValidDistance) {
            if (this.config.debugMode) {
                console.log(`Invalid distance reading: ${rawDistance} cm (outside valid range)`);
            }
            return;
        }

        this.currentDistance = rawDistance;

        // Apply smoothing if enabled
        if (this.config.distanceSmoothing) {
            this.smoothedDistance = this.applySmoothingFilter(rawDistance);
        } else {
            this.smoothedDistance = rawDistance;
        }

        if (this.config.debugMode) {
            console.log(`Distance: ${rawDistance.toFixed(1)} cm, Smoothed: ${this.smoothedDistance.toFixed(1)} cm`);
        }

        // Emit distance change event
        this.emit('distanceUpdate', {
            raw: rawDistance,
            smoothed: this.smoothedDistance,
            withinRange: this.smoothedDistance <= this.config.detectionDistance
        });
    }

    applySmoothingFilter(newDistance) {
        // Add to history
        this.distanceHistory.push(newDistance);
        
        // Keep history within limits
        if (this.distanceHistory.length > this.maxHistoryLength) {
            this.distanceHistory.shift();
        }

        // Apply exponential moving average
        if (this.distanceHistory.length === 1) {
            return newDistance;
        }

        const factor = this.config.smoothingFactor;
        const previousSmoothed = this.smoothedDistance || newDistance;
        
        return (factor * newDistance) + ((1 - factor) * previousSmoothed);
    }

    checkPresenceLogic() {
        const isWithinRange = this.smoothedDistance <= this.config.detectionDistance;
        const wasPresent = this.objectPresent;

        if (isWithinRange && !this.objectPresent) {
            // Object detected - start presence
            this.objectPresent = true;
            this.emit('presenceDetected', {
                distance: this.smoothedDistance,
                detectionDistance: this.config.detectionDistance
            });

            if (this.config.debugMode) {
                console.log(`Presence detected at ${this.smoothedDistance.toFixed(1)} cm`);
            }

            // Reset the presence timer
            this.resetPresenceTimer();

        } else if (isWithinRange && this.objectPresent) {
            // Object still present - reset timer
            this.resetPresenceTimer();

        } else if (!isWithinRange && this.objectPresent) {
            // Object moved away - don't immediately turn off, wait for timeout
            if (this.config.debugMode) {
                console.log(`Object moved away (${this.smoothedDistance.toFixed(1)} cm), waiting for timeout...`);
            }
        }
    }

    resetPresenceTimer() {
        // Clear existing timer
        if (this.presenceTimer) {
            clearTimeout(this.presenceTimer);
        }

        // Set new timer
        this.presenceTimer = setTimeout(() => {
            this.objectPresent = false;
            this.emit('presenceTimeout');

            if (this.config.debugMode) {
                console.log('Presence timeout - no object detected within range');
            }
        }, this.config.presenceTimeout);
    }

    startPotentiometerMonitoring() {
        console.log('Starting potentiometer monitoring...');
        
        const checkPotentiometer = async () => {
            try {
                const currentValue = await this.gpioController.readPotentiometer();
                
                // Check if change is significant enough
                const changePercent = Math.abs(currentValue - this.lastPotentiometerValue);
                
                if (changePercent >= this.config.potentiometerThreshold) {
                    this.lastPotentiometerValue = currentValue;
                    this.emit('potentiometerChanged', currentValue);
                    
                    if (this.config.debugMode) {
                        console.log(`Potentiometer changed to ${currentValue}%`);
                    }
                }
                
            } catch (error) {
                if (this.config.debugMode) {
                    console.error('Error reading potentiometer:', error);
                }
            }
        };
        
        this.potentiometerTimer = setInterval(
            checkPotentiometer, 
            this.config.potentiometerPollingInterval
        );
    }

    // Set detection distance
    setDetectionDistance(distance) {
        const oldDistance = this.config.detectionDistance;
        this.config.detectionDistance = Math.max(10, Math.min(400, distance));
        
        // Update GPIO controller as well
        if (this.gpioController) {
            this.gpioController.setDetectionDistance(this.config.detectionDistance);
        }
        
        if (this.config.debugMode) {
            console.log(`Detection distance changed from ${oldDistance} cm to ${this.config.detectionDistance} cm`);
        }
        
        this.emit('detectionDistanceChanged', this.config.detectionDistance);
    }

    // Set presence timeout
    setPresenceTimeout(timeout) {
        const oldTimeout = this.config.presenceTimeout;
        this.config.presenceTimeout = Math.max(1000, timeout); // Minimum 1 second
        
        if (this.config.debugMode) {
            console.log(`Presence timeout changed from ${oldTimeout} ms to ${this.config.presenceTimeout} ms`);
        }
        
        this.emit('presenceTimeoutChanged', this.config.presenceTimeout);
    }

    // Force presence detection (for testing)
    forcePresenceDetection() {
        if (!this.objectPresent) {
            this.objectPresent = true;
            this.emit('presenceDetected', {
                distance: this.smoothedDistance,
                detectionDistance: this.config.detectionDistance,
                forced: true
            });
            
            this.resetPresenceTimer();
            
            console.log('Presence detection forced manually');
        }
    }

    // Force presence timeout (for testing)
    forcePresenceTimeout() {
        if (this.objectPresent) {
            this.objectPresent = false;
            
            if (this.presenceTimer) {
                clearTimeout(this.presenceTimer);
                this.presenceTimer = null;
            }
            
            this.emit('presenceTimeout', { forced: true });
            console.log('Presence timeout forced manually');
        }
    }

    // Get current sensor status
    getStatus() {
        return {
            initialized: this.initialized,
            currentDistance: this.currentDistance,
            smoothedDistance: this.smoothedDistance,
            detectionDistance: this.config.detectionDistance,
            objectPresent: this.objectPresent,
            potentiometerValue: this.lastPotentiometerValue,
            presenceTimeout: this.config.presenceTimeout
        };
    }

    // Get configuration
    getConfiguration() {
        return {
            detectionDistance: this.config.detectionDistance,
            presenceTimeout: this.config.presenceTimeout,
            distanceCheckInterval: this.config.distanceCheckInterval,
            potentiometerPollingInterval: this.config.potentiometerPollingInterval,
            distanceSmoothing: this.config.distanceSmoothing,
            smoothingFactor: this.config.smoothingFactor,
            debugMode: this.config.debugMode
        };
    }

    // Update configuration
    updateConfiguration(newConfig) {
        const oldConfig = { ...this.config };
        
        // Update configuration
        Object.assign(this.config, newConfig);
        
        // Apply changes that require restarting monitoring
        if (newConfig.hasOwnProperty('distanceCheckInterval') && 
            newConfig.distanceCheckInterval !== oldConfig.distanceCheckInterval) {
            this.stopDistanceMonitoring();
            this.startDistanceMonitoring();
        }
        
        if (newConfig.hasOwnProperty('potentiometerPollingInterval') && 
            newConfig.potentiometerPollingInterval !== oldConfig.potentiometerPollingInterval) {
            this.stopPotentiometerMonitoring();
            this.startPotentiometerMonitoring();
        }
        
        // Update detection distance
        if (newConfig.hasOwnProperty('detectionDistance')) {
            this.setDetectionDistance(newConfig.detectionDistance);
        }
        
        // Update presence timeout
        if (newConfig.hasOwnProperty('presenceTimeout')) {
            this.setPresenceTimeout(newConfig.presenceTimeout);
        }
        
        console.log('Sensor manager configuration updated');
        this.emit('configurationUpdated', this.config);
    }

    stopDistanceMonitoring() {
        if (this.distanceMonitoringInterval) {
            clearInterval(this.distanceMonitoringInterval);
            this.distanceMonitoringInterval = null;
        }
        
        if (this.gpioController) {
            this.gpioController.stopDistanceMonitoring();
        }
    }

    stopPotentiometerMonitoring() {
        if (this.potentiometerTimer) {
            clearInterval(this.potentiometerTimer);
            this.potentiometerTimer = null;
        }
    }

    // Cleanup resources
    cleanup() {
        console.log('Cleaning up sensor manager...');
        
        // Stop all monitoring
        this.stopDistanceMonitoring();
        this.stopPotentiometerMonitoring();
        
        // Clear presence timer
        if (this.presenceTimer) {
            clearTimeout(this.presenceTimer);
            this.presenceTimer = null;
        }
        
        // Clear distance history
        this.distanceHistory = [];
        
        console.log('Sensor manager cleanup completed');
    }
}

module.exports = SensorManager;