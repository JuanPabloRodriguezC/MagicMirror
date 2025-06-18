/* mmm-infomirror Node Helper - HC-SR04 & NeoPixel Version
 * Hardware communication and configuration API server
 * MIT Licensed.
 */

const NodeHelper = require("node_helper");
const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");

// Import hardware controllers
const GPIOController = require("./lib/gpio_controller");
const SensorManager = require("./lib/sensor_manager");

module.exports = NodeHelper.create({
    
    start: function() {
        console.log(`Starting node helper for: ${this.name}`);
        
        // Initialize components
        this.configServer = null;
        this.gpioController = null;
        this.sensorManager = null;
        this.moduleInstances = new Map(); // Track multiple module instances
        
        // Hardware state
        this.hardwareInitialized = false;
        this.objectPresent = false;
        this.currentDistance = 999;
        this.currentLedIntensity = 0;
        this.currentPotentiometerValue = 50;
        
        // Configuration file path
        this.configPath = path.join(__dirname, "config", "hardware_config.json");
        this.ensureConfigDirectory();
    },

    // Handle socket notifications from module
    socketNotificationReceived: function(notification, payload) {
        const identifier = payload.identifier;
        
        switch (notification) {
            case "INIT_HARDWARE":
                this.initializeHardware(payload.config, identifier);
                break;
                
            case "START_CONFIG_SERVER":
                this.startConfigurationServer(payload.port, identifier);
                break;
                
            case "UPDATE_LEDS":
                this.updateLEDs(payload);
                break;
                
            case "UPDATE_DETECTION_DISTANCE":
                this.updateDetectionDistance(payload);
                break;
                
            case "UPDATE_PRESENCE_TIMEOUT":
                this.updatePresenceTimeout(payload);
                break;
                
            case "FORCE_PRESENCE_DETECTION":
                this.forcePresenceDetection(identifier);
                break;
                
            case "GET_HARDWARE_STATUS":
                this.sendHardwareStatus(identifier);
                break;
                
            default:
                console.log(`${this.name}: Unhandled notification: ${notification}`);
        }
    },

    // Initialize hardware components
    initializeHardware: function(config, identifier) {
        console.log(`${this.name}: Initializing HC-SR04 & NeoPixel hardware for instance ${identifier}`);
        
        try {
            // Initialize GPIO controller with HC-SR04 and NeoPixel configuration
            this.gpioController = new GPIOController({
                ultrasonicTrigPin: 18,        // HC-SR04 Trigger
                ultrasonicEchoPin: 24,        // HC-SR04 Echo
                detectionDistance: 100,       // cm
                neopixelPin: 12,              // NeoPixel data pin
                neopixelCount: 30,            // Number of LEDs
                neopixelType: 'ws2812',       // LED type
                adcChannel: 0,                // MCP3008 channel for potentiometer
                debugMode: config.debugMode
            });

            // Initialize sensor manager
            this.sensorManager = new SensorManager({
                detectionDistance: config.detectionDistance || 100,
                presenceTimeout: config.motionTimeout || 30000, // Renamed from motionTimeout
                distanceCheckInterval: 500,
                potentiometerPollingInterval: 1000,
                debugMode: config.debugMode
            });

            // Set up event listeners
            this.setupEventListeners(identifier);

            // Initialize hardware
            this.gpioController.initialize()
                .then(() => {
                    this.sensorManager.initialize(this.gpioController);
                    this.hardwareInitialized = true;
                    
                    console.log(`${this.name}: Hardware initialized successfully`);
                    this.sendSocketNotification("HARDWARE_READY", { identifier: identifier });
                })
                .catch((error) => {
                    console.error(`${this.name}: Hardware initialization failed:`, error);
                    this.sendSocketNotification("HARDWARE_ERROR", { 
                        error: error.message,
                        identifier: identifier 
                    });
                });
                
        } catch (error) {
            console.error(`${this.name}: Failed to initialize hardware:`, error);
            this.sendSocketNotification("HARDWARE_ERROR", { 
                error: error.message,
                identifier: identifier 
            });
        }
    },

    // Set up hardware event listeners
    setupEventListeners: function(identifier) {
        if (!this.sensorManager) return;

        // Presence detection events (replaces motion detection)
        this.sensorManager.on('presenceDetected', (data) => {
            console.log(`${this.name}: Object detected at ${data.distance.toFixed(1)} cm`);
            this.objectPresent = true;
            this.currentDistance = data.distance;
            this.sendSocketNotification("MOTION_DETECTED", { 
                identifier: identifier,
                distance: data.distance,
                detectionDistance: data.detectionDistance
            });
        });

        this.sensorManager.on('presenceTimeout', (data) => {
            console.log(`${this.name}: Presence timeout - no object within detection range`);
            this.objectPresent = false;
            this.sendSocketNotification("MOTION_TIMEOUT", { identifier: identifier });
        });

        // Distance updates
        this.sensorManager.on('distanceUpdate', (data) => {
            this.currentDistance = data.smoothed;
            
            // Only emit significant changes to avoid spam
            if (Math.abs(data.raw - data.smoothed) > 5) {
                this.sendSocketNotification("DISTANCE_CHANGED", {
                    identifier: identifier,
                    rawDistance: data.raw,
                    smoothedDistance: data.smoothed,
                    withinRange: data.withinRange
                });
            }
        });

        // Potentiometer changes (replaces light intensity changes)
        this.sensorManager.on('potentiometerChanged', (value) => {
            this.currentPotentiometerValue = value;
            this.sendSocketNotification("LIGHT_INTENSITY_CHANGED", { 
                intensity: value,
                identifier: identifier 
            });
        });

        // Detection distance changes
        this.sensorManager.on('detectionDistanceChanged', (distance) => {
            this.sendSocketNotification("DETECTION_DISTANCE_CHANGED", {
                distance: distance,
                identifier: identifier
            });
        });

        // Hardware errors
        this.sensorManager.on('error', (error) => {
            console.error(`${this.name}: Sensor manager error:`, error);
            this.sendSocketNotification("HARDWARE_ERROR", { 
                error: error.message,
                identifier: identifier 
            });
        });

        this.gpioController.on('error', (error) => {
            console.error(`${this.name}: GPIO controller error:`, error);
            this.sendSocketNotification("HARDWARE_ERROR", { 
                error: error.message,
                identifier: identifier 
            });
        });
    },

    // Start configuration API server
    startConfigurationServer: function(port, identifier) {
        if (this.configServer) {
            console.log(`${this.name}: Configuration server already running`);
            return;
        }

        const app = express();
        
        // Middleware
        app.use(cors());
        app.use(express.json());
        app.use(express.static(path.join(__dirname, 'public')));

        // API Routes
        
        // Get current configuration
        app.get('/api/config', (req, res) => {
            try {
                const config = this.loadConfiguration();
                const hardwareStatus = this.getHardwareStatus();
                
                res.json({
                    success: true,
                    config: config,
                    hardwareStatus: hardwareStatus
                });
            } catch (error) {
                res.status(500).json({
                    success: false,
                    error: error.message
                });
            }
        });

        // Update configuration
        app.post('/api/config', (req, res) => {
            try {
                const newConfig = req.body;
                console.log(`${this.name}: Received configuration update:`, newConfig);
                
                // Validate configuration
                if (!this.validateConfiguration(newConfig)) {
                    return res.status(400).json({
                        success: false,
                        error: "Invalid configuration format"
                    });
                }

                // Save configuration
                this.saveConfiguration(newConfig);

                // Apply hardware-specific changes
                this.applyHardwareConfiguration(newConfig);

                // Notify all module instances
                for (let [instanceId, _] of this.moduleInstances) {
                    this.sendSocketNotification("CONFIG_UPDATED", {
                        config: newConfig,
                        identifier: instanceId
                    });
                }

                res.json({
                    success: true,
                    message: "Configuration updated successfully"
                });

            } catch (error) {
                console.error(`${this.name}: Configuration update error:`, error);
                res.status(500).json({
                    success: false,
                    error: error.message
                });
            }
        });

        // Get hardware status
        app.get('/api/status', (req, res) => {
            res.json({
                success: true,
                status: this.getHardwareStatus()
            });
        });

        // Test NeoPixel strip
        app.post('/api/test-led', (req, res) => {
            const { intensity = 50, duration = 3000 } = req.body;
            
            if (this.gpioController) {
                this.gpioController.testLEDs(intensity, duration)
                    .then(() => {
                        res.json({ success: true, message: "NeoPixel test completed" });
                    })
                    .catch((error) => {
                        res.status(500).json({ success: false, error: error.message });
                    });
            } else {
                res.status(503).json({ success: false, error: "Hardware not initialized" });
            }
        });

        // Force presence detection (for testing)
        app.post('/api/force-presence', (req, res) => {
            if (this.sensorManager) {
                this.sensorManager.forcePresenceDetection();
                res.json({ success: true, message: "Presence detection forced" });
            } else {
                res.status(503).json({ success: false, error: "Sensor manager not initialized" });
            }
        });

        // Get distance readings
        app.get('/api/distance', (req, res) => {
            if (this.gpioController) {
                const status = this.gpioController.getStatus();
                res.json({
                    success: true,
                    distance: {
                        current: status.currentDistance,
                        detectionThreshold: status.detectionDistance,
                        objectDetected: status.objectDetected
                    }
                });
            } else {
                res.status(503).json({ success: false, error: "Hardware not initialized" });
            }
        });

        // Start server
        this.configServer = app.listen(port, () => {
            console.log(`${this.name}: Configuration server started on port ${port}`);
            this.sendSocketNotification("CONFIG_SERVER_STARTED", { 
                port: port,
                identifier: identifier 
            });
        });
    },

    // Apply hardware-specific configuration changes
    applyHardwareConfiguration: function(config) {
        if (!this.sensorManager || !this.gpioController) return;

        // Update detection distance
        if (config.hasOwnProperty('detectionDistance')) {
            this.sensorManager.setDetectionDistance(config.detectionDistance);
        }

        // Update presence timeout (was motionTimeout)
        if (config.hasOwnProperty('motionTimeout')) {
            this.sensorManager.setPresenceTimeout(config.motionTimeout);
        }

        // Update LED intensity if specified
        if (config.hasOwnProperty('ledIntensity')) {
            this.currentLedIntensity = config.ledIntensity;
            if (this.objectPresent) {
                this.gpioController.setLEDIntensity(config.ledIntensity);
            }
        }
    },

    // Get comprehensive hardware status
    getHardwareStatus: function() {
        const gpioStatus = this.gpioController ? this.gpioController.getStatus() : {};
        const sensorStatus = this.sensorManager ? this.sensorManager.getStatus() : {};

        return {
            hardwareInitialized: this.hardwareInitialized,
            objectPresent: this.objectPresent,
            currentDistance: this.currentDistance,
            detectionDistance: sensorStatus.detectionDistance || 100,
            ledIntensity: this.currentLedIntensity,
            potentiometerValue: this.currentPotentiometerValue,
            presenceTimeout: sensorStatus.presenceTimeout || 30000,
            timestamp: new Date().toISOString(),
            gpio: gpioStatus,
            sensor: sensorStatus
        };
    },

    // Update LED settings
    updateLEDs: function(payload) {
        if (!this.gpioController) {
            console.error(`${this.name}: GPIO controller not initialized`);
            return;
        }

        const { enabled, intensity } = payload;
        
        if (enabled) {
            this.gpioController.setLEDIntensity(intensity);
            this.currentLedIntensity = intensity;
        } else {
            this.gpioController.turnOffLEDs();
            this.currentLedIntensity = 0;
        }
    },

    // Update detection distance
    updateDetectionDistance: function(payload) {
        if (!this.sensorManager) {
            console.error(`${this.name}: Sensor manager not initialized`);
            return;
        }

        this.sensorManager.setDetectionDistance(payload.distance);
    },

    // Update presence timeout
    updatePresenceTimeout: function(payload) {
        if (!this.sensorManager) {
            console.error(`${this.name}: Sensor manager not initialized`);
            return;
        }

        this.sensorManager.setPresenceTimeout(payload.timeout);
    },

    // Force presence detection
    forcePresenceDetection: function(identifier) {
        if (!this.sensorManager) {
            console.error(`${this.name}: Sensor manager not initialized`);
            return;
        }

        this.sensorManager.forcePresenceDetection();
    },

    // Send hardware status
    sendHardwareStatus: function(identifier) {
        this.sendSocketNotification("HARDWARE_STATUS", {
            status: this.getHardwareStatus(),
            identifier: identifier
        });
    },

    // Configuration management
    ensureConfigDirectory: function() {
        const configDir = path.dirname(this.configPath);
        if (!fs.existsSync(configDir)) {
            fs.mkdirSync(configDir, { recursive: true });
        }
    },

    loadConfiguration: function() {
        try {
            if (fs.existsSync(this.configPath)) {
                const configData = fs.readFileSync(this.configPath, 'utf8');
                return JSON.parse(configData);
            }
        } catch (error) {
            console.error(`${this.name}: Error loading configuration:`, error);
        }
        
        // Return default configuration for HC-SR04 setup
        return {
            showWeather: true,
            showTime: true,
            showCalendar: true,
            showCompliments: false,
            ledIntensity: 50,
            motionTimeout: 30000,           // Presence timeout
            detectionDistance: 100,         // Detection distance in cm
            distanceSmoothing: true,
            debugMode: false
        };
    },

    saveConfiguration: function(config) {
        try {
            const configToSave = {
                ...config,
                lastUpdated: new Date().toISOString()
            };
            fs.writeFileSync(this.configPath, JSON.stringify(configToSave, null, 2));
            console.log(`${this.name}: Configuration saved successfully`);
        } catch (error) {
            console.error(`${this.name}: Error saving configuration:`, error);
            throw error;
        }
    },

    validateConfiguration: function(config) {
        // Basic validation
        if (typeof config !== 'object') return false;
        
        // Check for required boolean fields
        const booleanFields = ['showWeather', 'showTime', 'showCalendar', 'showCompliments', 'debugMode'];
        for (let field of booleanFields) {
            if (config.hasOwnProperty(field) && typeof config[field] !== 'boolean') {
                return false;
            }
        }
        
        // Check for numeric fields
        const numericFields = ['ledIntensity', 'motionTimeout', 'detectionDistance'];
        for (let field of numericFields) {
            if (config.hasOwnProperty(field)) {
                const value = config[field];
                if (typeof value !== 'number' || isNaN(value)) {
                    return false;
                }
            }
        }
        
        // Validate ranges
        if (config.ledIntensity !== undefined && (config.ledIntensity < 0 || config.ledIntensity > 100)) {
            return false;
        }
        
        if (config.detectionDistance !== undefined && (config.detectionDistance < 10 || config.detectionDistance > 400)) {
            return false;
        }
        
        return true;
    },

    // Cleanup on stop
    stop: function() {
        console.log(`${this.name}: Stopping node helper`);
        
        if (this.configServer) {
            this.configServer.close();
            this.configServer = null;
        }
        
        if (this.sensorManager) {
            this.sensorManager.cleanup();
        }
        
        if (this.gpioController) {
            this.gpioController.cleanup();
        }
    }
});