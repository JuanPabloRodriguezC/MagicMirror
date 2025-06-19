/* mmm-infomirror
 * Magic Mirror Module for InfoMirror Project - Display Interface Only
 * Hardware handled independently by Arduino
 * MIT Licensed.
 */

Module.register("mmm-infomirror", {
    // Module defaults
    defaults: {
        // Display configuration
        showWeather: true,
        showTime: true,
        showCalendar: true,
        showCompliments: false,
        
        // Display behavior
        motionTimeout: 30000,       // Display timeout in ms (30 seconds) - for reference only
        displayEnabled: true,       // Current display state (can be controlled via API)
        
        // Update intervals
        updateInterval: 60000,      // General update interval (1 minute)
        
        // Styling
        fadeSpeed: 1000,           // Fade animation speed
        fontSize: "medium",         // small, medium, large
        
        // Configuration server
        configPort: 3001,          // Port for configuration API
        
        // System status
        systemReady: false,         // System initialization status
        
        // Debug mode
        debugMode: false
    },

    // Required version
    requiresVersion: "2.1.0",

    // Start the module
    start: function() {
        Log.info(`Starting module: ${this.name}`);
        
        // Initialize module state
        this.loaded = false;
        this.weatherData = null;
        this.calendarEvents = [];
        this.currentTime = new Date();
        
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
        
        // Set up periodic updates
        this.scheduleUpdate();
        
        Log.info(`${this.name} started with config:`, this.config);
        Log.info(`${this.name}: Hardware (LEDs, sensors) handled independently by Arduino`);
    },

    // Handle notifications from other modules
    notificationReceived: function(notification, payload, sender) {
        if (notification === "WEATHER_DATA" && this.config.showWeather) {
            this.weatherData = payload;
            this.updateDom(this.config.fadeSpeed);
        }
        
        if (notification === "CALENDAR_EVENTS" && this.config.showCalendar) {
            this.calendarEvents = payload;
            this.updateDom(this.config.fadeSpeed);
        }
        
        if (notification === "CLOCK_SECOND" && this.config.showTime) {
            this.currentTime = new Date();
            // Only update DOM every minute to avoid excessive updates
            if (this.currentTime.getSeconds() === 0) {
                this.updateDom(this.config.fadeSpeed);
            }
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
                // Actually means "system ready" now (no hardware involved)
                this.config.systemReady = true;
                this.loaded = true;
                Log.info(`${this.name}: System initialized successfully`);
                this.updateDom(this.config.fadeSpeed);
                break;

            case "CONFIG_UPDATED":
                const oldConfig = Object.assign({}, this.config);
                this.config = Object.assign(this.config, payload.config);
                
                Log.info(`${this.name}: Configuration updated`, payload.config);
                
                // Log any display-related changes
                if (oldConfig.showWeather !== this.config.showWeather) {
                    Log.info(`${this.name}: Weather display ${this.config.showWeather ? 'enabled' : 'disabled'}`);
                }
                
                if (oldConfig.showTime !== this.config.showTime) {
                    Log.info(`${this.name}: Time display ${this.config.showTime ? 'enabled' : 'disabled'}`);
                }
                
                if (oldConfig.showCalendar !== this.config.showCalendar) {
                    Log.info(`${this.name}: Calendar display ${this.config.showCalendar ? 'enabled' : 'disabled'}`);
                }
                
                if (oldConfig.showCompliments !== this.config.showCompliments) {
                    Log.info(`${this.name}: Compliments display ${this.config.showCompliments ? 'enabled' : 'disabled'}`);
                }
                
                this.updateDom(this.config.fadeSpeed);
                break;

            case "DISPLAY_CONTROL":
                // Allow external control of display visibility
                this.config.displayEnabled = payload.enabled;
                if (this.config.debugMode) {
                    Log.info(`${this.name}: Display ${payload.enabled ? 'enabled' : 'disabled'} via API`);
                }
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

    // Generate DOM content
    getDom: function() {
        const wrapper = document.createElement("div");
        wrapper.className = "mmm-infomirror";

        // If system not ready, show loading
        if (!this.loaded) {
            wrapper.innerHTML = `
                <div class="loading">
                    <i class="fa fa-cog fa-spin"></i>
                    <div>Initializing InfoMirror...</div>
                    <small>Hardware controlled by Arduino independently</small>
                </div>
            `;
            return wrapper;
        }

        // If display is disabled via API, return minimal display
        if (!this.config.displayEnabled) {
            wrapper.innerHTML = `
                <div class="loading">
                    <i class="fa fa-moon-o"></i>
                    <div>Display Disabled</div>
                    <small>Enable via configuration API</small>
                </div>
            `;
            return wrapper;
        }

        // Create main content container
        const contentContainer = document.createElement("div");
        contentContainer.className = "content-container";

        // Add components based on configuration
        if (this.config.showTime) {
            contentContainer.appendChild(this.createTimeDisplay());
        }

        if (this.config.showWeather && this.weatherData) {
            contentContainer.appendChild(this.createWeatherDisplay());
        }

        if (this.config.showCalendar && this.calendarEvents.length > 0) {
            contentContainer.appendChild(this.createCalendarDisplay());
        }

        if (this.config.showCompliments) {
            contentContainer.appendChild(this.createComplimentsDisplay());
        }

        // Add system status indicator in debug mode
        if (this.config.debugMode) {
            contentContainer.appendChild(this.createStatusDisplay());
        }

        wrapper.appendChild(contentContainer);
        return wrapper;
    },

    // Create time display component
    createTimeDisplay: function() {
        const timeContainer = document.createElement("div");
        timeContainer.className = "time-display";
        
        const time = this.currentTime.toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
        });
        
        const date = this.currentTime.toLocaleDateString([], {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });

        timeContainer.innerHTML = `
            <div class="time">${time}</div>
            <div class="date">${date}</div>
        `;

        return timeContainer;
    },

    // Create weather display component
    createWeatherDisplay: function() {
        const weatherContainer = document.createElement("div");
        weatherContainer.className = "weather-display";
        
        if (this.weatherData && this.weatherData.current) {
            const current = this.weatherData.current;
            weatherContainer.innerHTML = `
                <div class="weather-icon">
                    <i class="wi ${this.getWeatherIcon(current.condition)}"></i>
                </div>
                <div class="weather-info">
                    <div class="temperature">${Math.round(current.temperature)}°</div>
                    <div class="condition">${current.condition}</div>
                    <div class="details">
                        Humidity: ${current.humidity}% | Wind: ${current.windSpeed} km/h
                    </div>
                </div>
            `;
        } else {
            weatherContainer.innerHTML = `
                <div class="weather-loading">
                    <i class="fa fa-cloud"></i>
                    <div>Loading weather...</div>
                </div>
            `;
        }

        return weatherContainer;
    },

    // Create calendar display component
    createCalendarDisplay: function() {
        const calendarContainer = document.createElement("div");
        calendarContainer.className = "calendar-display";
        
        const upcomingEvents = this.calendarEvents.slice(0, 3); // Show max 3 events
        
        if (upcomingEvents.length > 0) {
            let eventsHTML = '<div class="calendar-header">Upcoming Events</div>';
            
            upcomingEvents.forEach(event => {
                const eventDate = new Date(event.startDate);
                const timeStr = eventDate.toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit'
                });
                
                eventsHTML += `
                    <div class="calendar-event">
                        <div class="event-time">${timeStr}</div>
                        <div class="event-title">${event.title}</div>
                    </div>
                `;
            });
            
            calendarContainer.innerHTML = eventsHTML;
        }

        return calendarContainer;
    },

    // Create compliments display component
    createComplimentsDisplay: function() {
        const complimentsContainer = document.createElement("div");
        complimentsContainer.className = "compliments-display";
        
        const compliments = [
            "You look great today!",
            "Have a wonderful day!",
            "You're amazing!",
            "Stay positive!",
            "You've got this!",
            "Ready to conquer the day!",
            "You're unstoppable!",
            "Believe in yourself!"
        ];
        
        const randomCompliment = compliments[Math.floor(Math.random() * compliments.length)];
        complimentsContainer.innerHTML = `<div class="compliment">${randomCompliment}</div>`;
        
        return complimentsContainer;
    },

    // Create status display for debugging
    createStatusDisplay: function() {
        const statusContainer = document.createElement("div");
        statusContainer.className = "status-display";
        
        statusContainer.innerHTML = `
            <div class="status-item">System: ${this.config.systemReady ? 'Ready' : 'Not Ready'}</div>
            <div class="status-item">Display: ${this.config.displayEnabled ? 'Active' : 'Disabled'}</div>
            <div class="status-item">Config Port: ${this.config.configPort}</div>
            <div class="status-item">Hardware: Arduino Independent</div>
        `;
        
        return statusContainer;
    },

    // Get weather icon class
    getWeatherIcon: function(condition) {
        const iconMap = {
            'clear': 'wi-day-sunny',
            'sunny': 'wi-day-sunny',
            'cloudy': 'wi-cloudy',
            'partly-cloudy': 'wi-day-cloudy',
            'rain': 'wi-rain',
            'snow': 'wi-snow',
            'fog': 'wi-fog',
            'wind': 'wi-windy',
            'thunderstorm': 'wi-thunderstorm',
            'drizzle': 'wi-sprinkle'
        };
        
        return iconMap[condition.toLowerCase()] || 'wi-day-sunny';
    },

    // Schedule periodic updates
    scheduleUpdate: function() {
        setInterval(() => {
            this.currentTime = new Date();
            // Always update if display is enabled (no hardware motion dependency)
            if (this.config.displayEnabled) {
                this.updateDom(this.config.fadeSpeed);
            }
        }, this.config.updateInterval);
    },

    // Force display update (can be called via notifications)
    forceUpdate: function() {
        this.currentTime = new Date();
        this.updateDom(this.config.fadeSpeed);
    },

    // Get current module status (for API queries)
    getModuleStatus: function() {
        return {
            loaded: this.loaded,
            systemReady: this.config.systemReady,
            displayEnabled: this.config.displayEnabled,
            showWeather: this.config.showWeather,
            showTime: this.config.showTime,
            showCalendar: this.config.showCalendar,
            showCompliments: this.config.showCompliments,
            weatherDataAvailable: !!this.weatherData,
            calendarEventsCount: this.calendarEvents.length,
            lastUpdate: this.currentTime.toISOString(),
            configPort: this.config.configPort,
            debugMode: this.config.debugMode
        };
    },

    // Get required stylesheets
    getStyles: function() {
        return [
            "mmm-infomirror.css",
            "font-awesome.css",
            "weather-icons.css"
        ];
    },

    // Get required scripts
    getScripts: function() {
        return [];
    }
});