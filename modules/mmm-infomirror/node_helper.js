/* mmm-infomirror Node Helper - Simplified Python Communication Only
 * Handles configuration API server and Python app communication
 * Arduino handles all hardware directly
 * MIT Licensed.
 */

const NodeHelper = require("node_helper");
const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");

module.exports = NodeHelper.create({
    
    start: function() {
        console.log(`Starting node helper for: ${this.name}`);
        
        // Inicializa componentes
        this.configServer = null;
        this.pythonProcess = null;
        this.moduleInstances = new Map();
        this.currentConfig = null;
        this.pythonAppReady = false;
        this.lastArduinoData = {};
        this.configPath = path.join(__dirname, "config", "hardware_config.json");
        this.ensureConfigDirectory();
        this.currentConfig = this.loadConfiguration();
    },

    // Maneja notificaciones del socket
    socketNotificationReceived: function(notification, payload) {
        const identifier = payload.identifier;
        
        switch (notification) {
            case "INIT_HARDWARE":
                this.initializeSystem(payload.config, identifier);
                break;
                
            case "START_CONFIG_SERVER":
                this.startConfigurationServer(payload.port, identifier);
                break;
                
            case "START_PYTHON_APP":
                this.startPythonApplication(payload);
                break;
                
            case "SEND_CONFIG_TO_PYTHON":
                this.sendConfigurationToPython(payload.config, identifier);
                break;
                
            case "GET_SYSTEM_STATUS":
                this.sendSystemStatus(identifier);
                break;
                
            default:
                console.log(`${this.name}: Unhandled notification: ${notification}`);
        }
    },

    initializeSystem: function(config, identifier) {
        console.log(`${this.name}: Initializing system communication for instance ${identifier}`);
        
        try {
            // Guarda la configuración del módulo
            this.moduleInstances.set(identifier, config);
            
            // Agrega la configuración actual
            this.currentConfig = { ...this.currentConfig, ...config };
            console.log(`${this.name}: System communication initialized successfully`);
            this.sendSocketNotification("HARDWARE_READY", { identifier: identifier });
            
        } catch (error) {
            console.error(`${this.name}: System initialization failed:`, error);
            this.sendSocketNotification("HARDWARE_ERROR", { 
                error: error.message,
                identifier: identifier 
            });
        }
    },

    // Inicia el servidor de configuración
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
                const config = this.currentConfig;
                const systemStatus = this.getSystemStatus();
                
                res.json({
                    success: true,
                    config: config,
                    systemStatus: systemStatus,
                    timestamp: new Date().toISOString()
                });
            } catch (error) {
                res.status(500).json({
                    success: false,
                    error: error.message
                });
            }
        });

        // Modifica configuración
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

                // Update current configuration
                this.currentConfig = { ...this.currentConfig, ...newConfig };

                // Save configuration to file
                this.saveConfiguration(this.currentConfig);

                // Send to Python app if running
                if (this.pythonAppReady) {
                    this.sendConfigurationToPython(newConfig);
                }

                // Notify all module instances
                for (let [instanceId, _] of this.moduleInstances) {
                    this.sendSocketNotification("CONFIG_UPDATED", {
                        config: newConfig,
                        identifier: instanceId
                    });
                }

                res.json({
                    success: true,
                    message: "Configuration updated successfully",
                    timestamp: new Date().toISOString()
                });

            } catch (error) {
                console.error(`${this.name}: Configuration update error:`, error);
                res.status(500).json({
                    success: false,
                    error: error.message
                });
            }
        });

        // Get system status
        app.get('/api/status', (req, res) => {
            res.json({
                success: true,
                status: this.getSystemStatus(),
                timestamp: new Date().toISOString()
            });
        });

        // Send configuration to Python app
        app.post('/api/send-to-python', (req, res) => {
            try {
                const success = this.sendConfigurationToPython(req.body);
                res.json({
                    success: success,
                    message: success ? "Sent to Python app" : "Python app not ready"
                });
            } catch (error) {
                res.status(500).json({
                    success: false,
                    error: error.message
                });
            }
        });

        // Start Python application
        app.post('/api/start-python', (req, res) => {
            try {
                const { scriptPath } = req.body;
                this.startPythonApplication({ scriptPath });
                res.json({
                    success: true,
                    message: "Python application start initiated"
                });
            } catch (error) {
                res.status(500).json({
                    success: false,
                    error: error.message
                });
            }
        });

        // Stop Python application
        app.post('/api/stop-python', (req, res) => {
            try {
                this.stopPythonApplication();
                res.json({
                    success: true,
                    message: "Python application stopped"
                });
            } catch (error) {
                res.status(500).json({
                    success: false,
                    error: error.message
                });
            }
        });

        // Serve a simple web interface
        app.get('/', (req, res) => {
            res.send(`
                <html>
                <head><title>InfoMirror Configuration</title></head>
                <body>
                    <h1>InfoMirror Configuration Server</h1>
                    <p>Server running on port ${port}</p>
                    <h2>API Endpoints:</h2>
                    <ul>
                        <li>GET /api/config - Get current configuration</li>
                        <li>POST /api/config - Update configuration</li>
                        <li>GET /api/status - Get system status</li>
                        <li>GET /api/arduino - Get Arduino data</li>
                        <li>POST /api/send-to-python - Send config to Python app</li>
                        <li>POST /api/start-python - Start Python app</li>
                        <li>POST /api/stop-python - Stop Python app</li>
                    </ul>
                    <p>Current time: ${new Date().toISOString()}</p>
                </body>
                </html>
            `);
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

    startPythonApplication: function(payload) {
        if (this.pythonProcess) {
            console.log(`${this.name}: Python app already running`);
            return;
        }

        const scriptPath = payload.scriptPath || path.join(__dirname, 'python_app.py');
        
        console.log(`${this.name}: Starting Python application: ${scriptPath}`);

        try {
            // Start Python process
            this.pythonProcess = spawn('python3', [scriptPath], {
                stdio: ['pipe', 'pipe', 'pipe']
            });

            // Handle Python output
            this.pythonProcess.stdout.on('data', (data) => {
                const output = data.toString().trim();
                console.log(`Python: ${output}`);
                
                try {
                    const message = JSON.parse(output);
                    this.handlePythonMessage(message);
                } catch (error) {
                    // Not JSON, just log it
                    if (output.includes('READY')) {
                        this.pythonAppReady = true;
                        this.sendSocketNotification("PYTHON_APP_READY", {});
                    }
                }
            });

            this.pythonProcess.stderr.on('data', (data) => {
                console.error(`Python Error: ${data.toString()}`);
            });

            this.pythonProcess.on('close', (code) => {
                console.log(`Python process exited with code ${code}`);
                this.pythonAppReady = false;
                this.pythonProcess = null;
                this.sendSocketNotification("PYTHON_APP_STOPPED", { code });
            });

            this.pythonProcess.on('error', (error) => {
                console.error(`Failed to start Python process: ${error}`);
                this.pythonAppReady = false;
                this.pythonProcess = null;
                this.sendSocketNotification("PYTHON_APP_ERROR", { error: error.message });
            });

        } catch (error) {
            console.error(`${this.name}: Failed to start Python app:`, error);
        }
    },

    // Stop Python application
    stopPythonApplication: function() {
        if (this.pythonProcess) {
            console.log(`${this.name}: Stopping Python application`);
            this.pythonProcess.kill('SIGTERM');
            this.pythonProcess = null;
            this.pythonAppReady = false;
        }
    },

    // Handle messages from Python app
    handlePythonMessage: function(message) {
        switch (message.type) {
            case 'arduino_data':
                this.lastArduinoData = message.data;
                // Broadcast to all module instances
                for (let [instanceId, _] of this.moduleInstances) {
                    this.sendSocketNotification("ARDUINO_DATA_UPDATE", {
                        data: message.data,
                        identifier: instanceId
                    });
                }
                break;

            case 'status_update':
                // Broadcast status updates
                for (let [instanceId, _] of this.moduleInstances) {
                    this.sendSocketNotification("PYTHON_STATUS_UPDATE", {
                        status: message.data,
                        identifier: instanceId
                    });
                }
                break;

            case 'error':
                console.error('Python app error:', message.data);
                break;

            case 'ready':
                this.pythonAppReady = true;
                console.log(`${this.name}: Python app is ready`);
                break;

            default:
                console.log(`${this.name}: Unknown Python message type: ${message.type}`);
        }
    },

    // Send configuration to Python app
    sendConfigurationToPython: function(config, identifier) {
        if (!this.pythonProcess || !this.pythonAppReady) {
            console.log(`${this.name}: Python app not ready, cannot send configuration`);
            return false;
        }

        try {
            const message = {
                type: 'config_update',
                data: config,
                timestamp: new Date().toISOString()
            };

            this.pythonProcess.stdin.write(JSON.stringify(message) + '\n');
            console.log(`${this.name}: Configuration sent to Python app`);
            return true;

        } catch (error) {
            console.error(`${this.name}: Failed to send config to Python:`, error);
            return false;
        }
    },

    // Get comprehensive system status
    getSystemStatus: function() {
        return {
            configServerRunning: !!this.configServer,
            pythonAppReady: this.pythonAppReady,
            pythonProcessRunning: !!this.pythonProcess,
            moduleInstances: this.moduleInstances.size,
            lastArduinoData: this.lastArduinoData,
            currentConfig: this.currentConfig,
            timestamp: new Date().toISOString()
        };
    },

    // Send system status
    sendSystemStatus: function(identifier) {
        this.sendSocketNotification("SYSTEM_STATUS", {
            status: this.getSystemStatus(),
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
            detectionDistance: 100,
            debugMode: false,
            pythonAppPath: path.join(__dirname, 'python_app.py'),
            arduinoPort: '/dev/ttyACM0'
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
        
        // Stop Python application
        this.stopPythonApplication();
        
        // Close configuration server
        if (this.configServer) {
            this.configServer.close();
            this.configServer = null;
        }
        
        // Clear module instances
        this.moduleInstances.clear();
    }
});