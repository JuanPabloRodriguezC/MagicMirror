/* MMM-InfoMirror Node Helper
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
        this.motionDetected = false;
        this.currentLightIntensity = 50;
        
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
                
            case "UPDATE_MOTION_SENSITIVITY":
                this.updateMotionSensitivity(payload);
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
        console.log(`${this.name}: Initializing hardware for instance ${identifier}`);
        
        try {
            // Initialize GPIO controller
            this.gpioController = new GPIOController({
                motionSensorPin: 18,
                ledPins: [12, 16, 20, 21], // 4 LEDs as required
                lightRegulatorPin: 13,
                debugMode: config.debugMode
            });

            // Initialize sensor manager
            this.sensorManager = new SensorManager({
                motionTimeout: config.motionTimeout,
                motionSensitivity: config.motionSensitivity,
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

        // Motion detection events
        this.sensorManager.on('motionDetected', () => {
            console.log(`${this.name}: Motion detected`);
            this.motionDetected = true;
            this.sendSocketNotification("MOTION_DETECTED", { identifier: identifier });
        });

        this.sensorManager.on('motionTimeout', () => {
            console.log(`${this.name}: Motion timeout`);
            this.motionDetected = false;
            this.sendSocketNotification("MOTION_TIMEOUT", { identifier: identifier });
        });

        // Light intensity changes
        this.sensorManager.on('lightIntensityChanged', (intensity) => {
            this.currentLightIntensity = intensity;
            this.sendSocketNotification("LIGHT_INTENSITY_CHANGED", { 
                intensity: intensity,
                identifier: identifier 
            });
        });

        // Hardware errors
        this.sensorManager.on('error', (error) => {
            console.error(`${this.name}: Hardware error:`, error);
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
                res.json({
                    success: true,
                    config: config,
                    hardwareStatus: {
                        initialized: this.hardwareInitialized,
                        motionDetected: this.motionDetected,
                        lightIntensity: this.currentLightIntensity
                    }
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
                status: {
                    hardwareInitialized: this.hardwareInitialized,
                    motionDetected: this.motionDetected,
                    currentLightIntensity: this.currentLightIntensity,
                    timestamp: new Date().toISOString()
                }
            });
        });

        // Test LED endpoint
        app.post('/api/test-led', (req, res) => {
            const { intensity = 50, duration = 2000 } = req.body;
            
            if (this.gpioController) {
                this.gpioController.testLEDs(intensity, duration)
                    .then(() => {
                        res.json({ success: true, message: "LED test completed" });
                    })
                    .catch((error) => {
                        res.status(500).json({ success: false, error: error.message });
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

    // Update LED settings
    updateLEDs: function(payload) {
        if (!this.gpioController) {
            console.error(`${this.name}: GPIO controller not initialized`);
            return;
        }

        const { enabled, intensity } = payload;
        
        if (enabled) {
            this.gpioController.setLEDIntensity(intensity);
        } else {
            this.gpioController.turnOffLEDs();
        }
    },

    // Update motion sensor sensitivity
    updateMotionSensitivity: function(payload) {
        if (!this.sensorManager) {
            console.error(`${this.name}: Sensor manager not initialized`);
            return;
        }

        this.sensorManager.setMotionSensitivity(payload.sensitivity);
    },

    // Send hardware status
    sendHardwareStatus: function(identifier) {
        this.sendSocketNotification("HARDWARE_STATUS", {
            initialized: this.hardwareInitialized,
            motionDetected: this.motionDetected,
            lightIntensity: this.currentLightIntensity,
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
        
        // Return default configuration
        return {
            showWeather: true,
            showTime: true,
            showCalendar: true,
            showCompliments: false,
            ledIntensity: 50,
            motionTimeout: 30000,
            motionSensitivity: 80
        };
    },

    saveConfiguration: function(config) {
        try {
            fs.writeFileSync(this.configPath, JSON.stringify(config, null, 2));
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
        const booleanFields = ['showWeather', 'showTime', 'showCalendar', 'showCompliments'];
        for (let field of booleanFields) {
            if (config.hasOwnProperty(field) && typeof config[field] !== 'boolean') {
                return false;
            }
        }
        
        // Check for numeric fields
        const numericFields = ['ledIntensity', 'motionTimeout', 'motionSensitivity'];
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
        
        if (config.motionSensitivity !== undefined && (config.motionSensitivity < 0 || config.motionSensitivity > 100)) {
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