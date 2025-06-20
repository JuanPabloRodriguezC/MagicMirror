/* mmm-infomirror
 * Magic Mirror Module for InfoMirror Project - Controller Module
 * Controls visibility and behavior of existing Magic Mirror modules
 * Hardware handled independently by Arduino
 * MIT Licensed.
 */

Module.register("mmm-infomirror", {
    // Module defaults
    defaults: {
        // Module visibility control
        showWeather: true,
        showTime: true,
        showCalendar: true,
        showCompliments: false,
        showNewsfeed: false,
        
        // Display behavior
        motionTimeout: 30000,       // Display timeout in ms (30 seconds) - for reference only
        displayEnabled: true,       // Current display state (can be controlled via API)
        
        // Update intervals
        updateInterval: 60000,      // General update interval (1 minute)
        
        // Module control settings
        fadeSpeed: 1000,           // Fade animation speed
        
        // Configuration server
        configPort: 3001,          // Port for configuration API
        
        // System status
        systemReady: false,         // System initialization status
        
        // Debug mode
        debugMode: false,
        
        // Modules to control (mapping to their identifiers)
        controlledModules: {
            weather: ["weather", "currentweather", "weatherforecast"],
            time: ["clock"],
            calendar: ["calendar"],
            compliments: ["compliments"],
            newsfeed: ["newsfeed"]
        }
    },

    // Required version
    requiresVersion: "2.1.0",

    // Start the module
    start: function() {
        Log.info(`Starting InfoMirror controller module: ${this.name}`);
        
        // Initialize module state
        this.loaded = false;
        this.moduleStates = new Map();
        
        // Start system initialization (no hardware)
        this.sendSocketNotification("INIT_HARDWARE", {
            config: this.config,
            identifier: this.identifier
        });
        
        // Start configuration server
        this.sendSocketNotification("START_CONFIG_SERVER", {
            port: this.config.configPort,
            identifier: this.identifier
        });
        
        Log.info(`${this.name} started with config:`, this.config);
    },

    // Handle notifications from other modules
    notificationReceived: function(notification, payload, sender) {
        // Listen for module visibility confirmations
        if (notification === "MODULE_VISIBILITY_CHANGED") {
            if (this.config.debugMode) {
                Log.info(`${this.name}: Module visibility changed:`, payload);
            }
            this.moduleStates.set(payload.module, payload.hidden);
        }
        
        // Handle display control notifications
        if (notification === "INFOMIRROR_DISPLAY_CONTROL") {
            this.handleDisplayControl(payload);
        }
    },

    // Handle socket notifications from node helper
    socketNotificationReceived: function(notification, payload) {
        // Ensure the notification is for this instance
        if (payload.identifier !== this.identifier && payload.identifier !== undefined) {
            return;
        }

        switch (notification) {
            case "HARDWARE_READY":
                this.config.systemReady = true;
                this.loaded = true;
                Log.info(`${this.name}: System initialized successfully`);
                
                // Apply initial module visibility
                this.applyModuleVisibility();
                this.updateDom(this.config.fadeSpeed);
                break;

            case "CONFIG_UPDATED":
                const oldConfig = Object.assign({}, this.config);
                this.config = Object.assign(this.config, payload.config);
                
                Log.info(`${this.name}: Configuration updated`, payload.config);
                
                // Apply module visibility changes
                this.handleConfigurationChange(oldConfig, this.config);
                this.updateDom(this.config.fadeSpeed);
                break;

            case "DISPLAY_CONTROL":
                this.config.displayEnabled = payload.enabled;
                if (this.config.debugMode) {
                    Log.info(`${this.name}: Display ${payload.enabled ? 'enabled' : 'disabled'} via API`);
                }
                
                // Control all modules based on display state
                this.controlAllModules(payload.enabled);
                this.updateDom(this.config.fadeSpeed);
                break;

            case "SYSTEM_ERROR":
                Log.error(`${this.name}: System error - ${payload.error}`);
                break;

            case "CONFIG_SERVER_STARTED":
                Log.info(`${this.name}: Configuration server started on port ${payload.port}`);
                Log.info(`${this.name}: Access configuration at http://PI_IP:${payload.port}`);
                break;

            case "PYTHON_APP_READY":
                Log.info(`${this.name}: Python configuration app ready`);
                break;

            case "PYTHON_APP_STOPPED":
                Log.info(`${this.name}: Python configuration app stopped`);
                break;

            default:
                if (this.config.debugMode) {
                    Log.info(`${this.name}: Unhandled notification: ${notification}`);
                }
        }
    },

    // Apply module visibility based on current configuration
    applyModuleVisibility: function() {
        const moduleVisibility = {
            weather: this.config.showWeather,
            time: this.config.showTime,
            calendar: this.config.showCalendar,
            compliments: this.config.showCompliments,
            newsfeed: this.config.showNewsfeed
        };

        for (const [moduleType, shouldShow] of Object.entries(moduleVisibility)) {
            this.controlModuleType(moduleType, shouldShow);
        }
    },

    // Handle configuration changes and update module visibility
    handleConfigurationChange: function(oldConfig, newConfig) {
        const changes = [];

        // Check each module type for changes
        if (oldConfig.showWeather !== newConfig.showWeather) {
            this.controlModuleType('weather', newConfig.showWeather);
            changes.push(`Weather: ${newConfig.showWeather ? 'shown' : 'hidden'}`);
        }

        if (oldConfig.showTime !== newConfig.showTime) {
            this.controlModuleType('time', newConfig.showTime);
            changes.push(`Time: ${newConfig.showTime ? 'shown' : 'hidden'}`);
        }

        if (oldConfig.showCalendar !== newConfig.showCalendar) {
            this.controlModuleType('calendar', newConfig.showCalendar);
            changes.push(`Calendar: ${newConfig.showCalendar ? 'shown' : 'hidden'}`);
        }

        if (oldConfig.showCompliments !== newConfig.showCompliments) {
            this.controlModuleType('compliments', newConfig.showCompliments);
            changes.push(`Compliments: ${newConfig.showCompliments ? 'shown' : 'hidden'}`);
        }

        if (oldConfig.showNewsfeed !== newConfig.showNewsfeed) {
            this.controlModuleType('newsfeed', newConfig.showNewsfeed);
            changes.push(`Newsfeed: ${newConfig.showNewsfeed ? 'shown' : 'hidden'}`);
        }

        if (changes.length > 0) {
            Log.info(`${this.name}: Module visibility changes: ${changes.join(', ')}`);
        }
    },

    // Control specific module type visibility
    controlModuleType: function(moduleType, shouldShow) {
        const moduleNames = this.config.controlledModules[moduleType];
        if (!moduleNames) {
            Log.warn(`${this.name}: Unknown module type: ${moduleType}`);
            return;
        }

        moduleNames.forEach(moduleName => {
            this.sendNotification("MODULE_VISIBILITY_REQUEST", {
                module: moduleName,
                hidden: !shouldShow,
                sender: this.name
            });
        });

        if (this.config.debugMode) {
            Log.info(`${this.name}: ${moduleType} modules ${shouldShow ? 'shown' : 'hidden'}: ${moduleNames.join(', ')}`);
        }
    },

    // Control all modules (for display on/off)
    controlAllModules: function(enable) {
        const allModuleTypes = Object.keys(this.config.controlledModules);
        
        allModuleTypes.forEach(moduleType => {
            const shouldShow = enable && this.config[`show${moduleType.charAt(0).toUpperCase() + moduleType.slice(1)}`];
            this.controlModuleType(moduleType, shouldShow);
        });

        Log.info(`${this.name}: All controlled modules ${enable ? 'enabled' : 'disabled'}`);
    },

    // Handle display control requests
    handleDisplayControl: function(payload) {
        if (payload.action === 'enable') {
            this.config.displayEnabled = true;
            this.controlAllModules(true);
        } else if (payload.action === 'disable') {
            this.config.displayEnabled = false;
            this.controlAllModules(false);
        } else if (payload.action === 'toggle') {
            this.config.displayEnabled = !this.config.displayEnabled;
            this.controlAllModules(this.config.displayEnabled);
        }

        Log.info(`${this.name}: Display control - ${payload.action}, enabled: ${this.config.displayEnabled}`);
    },

    // Generate DOM content (minimal - just status display)
    getDom: function() {
        const wrapper = document.createElement("div");
        wrapper.className = "mmm-infomirror-controller";

        // If system not ready, show loading
        if (!this.loaded) {
            wrapper.innerHTML = `
                <div class="infomirror-status loading">
                    <i class="fa fa-cog fa-spin"></i>
                    <div>Initializing InfoMirror Controller...</div>
                    <small>Preparing module communication</small>
                </div>
            `;
            return wrapper;
        }

        // Show minimal status in debug mode only
        if (this.config.debugMode) {
            wrapper.innerHTML = `
                <div class="infomirror-status debug">
                    <div class="status-header">InfoMirror Controller</div>
                    <div class="status-items">
                        <div class="status-item ${this.config.systemReady ? 'ready' : 'not-ready'}">
                            System: ${this.config.systemReady ? 'Ready' : 'Not Ready'}
                        </div>
                        <div class="status-item ${this.config.displayEnabled ? 'enabled' : 'disabled'}">
                            Display: ${this.config.displayEnabled ? 'Active' : 'Disabled'}
                        </div>
                        <div class="status-item">
                            Config Port: ${this.config.configPort}
                        </div>
                        <div class="status-item">
                            Controlled Modules: Weather(${this.config.showWeather}), 
                            Time(${this.config.showTime}), 
                            Calendar(${this.config.showCalendar}), 
                            Compliments(${this.config.showCompliments}), 
                            News(${this.config.showNewsfeed})
                        </div>
                    </div>
                </div>
            `;
        } else {
            // In production mode, show nothing (invisible controller)
            wrapper.style.display = 'none';
        }

        return wrapper;
    },

    // Force apply current configuration (can be called via notifications)
    forceApplyConfiguration: function() {
        if (this.loaded) {
            this.applyModuleVisibility();
        }
    },

    // Get current module status (for API queries)
    getModuleStatus: function() {
        return {
            loaded: this.loaded,
            systemReady: this.config.systemReady,
            displayEnabled: this.config.displayEnabled,
            moduleVisibility: {
                weather: this.config.showWeather,
                time: this.config.showTime,
                calendar: this.config.showCalendar,
                compliments: this.config.showCompliments,
                newsfeed: this.config.showNewsfeed
            },
            controlledModules: this.config.controlledModules,
            moduleStates: Object.fromEntries(this.moduleStates),
            configPort: this.config.configPort,
            debugMode: this.config.debugMode,
            lastUpdate: new Date().toISOString()
        };
    },

    // Public methods that can be called by other modules
    showWeather: function() { this.controlModuleType('weather', true); },
    hideWeather: function() { this.controlModuleType('weather', false); },
    showTime: function() { this.controlModuleType('time', true); },
    hideTime: function() { this.controlModuleType('time', false); },
    showCalendar: function() { this.controlModuleType('calendar', true); },
    hideCalendar: function() { this.controlModuleType('calendar', false); },
    showCompliments: function() { this.controlModuleType('compliments', true); },
    hideCompliments: function() { this.controlModuleType('compliments', false); },
    showNewsfeed: function() { this.controlModuleType('newsfeed', true); },
    hideNewsfeed: function() { this.controlModuleType('newsfeed', false); },

    enableDisplay: function() { this.handleDisplayControl({action: 'enable'}); },
    disableDisplay: function() { this.handleDisplayControl({action: 'disable'}); },
    toggleDisplay: function() { this.handleDisplayControl({action: 'toggle'}); },

    // Get required stylesheets
    getStyles: function() {
        return ["mmm-infomirror.css"];
    },

    // Get required scripts
    getScripts: function() {
        return [];
    }
});