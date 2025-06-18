/* mmm-infomirror
 * Magic Mirror Module for InfoMirror Project
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
        
        // Hardware configuration
        ledIntensity: 50,           // LED brightness (0-100)
        motionTimeout: 30000,       // Motion timeout in ms (30 seconds)
        motionSensitivity: 80,      // Motion sensor sensitivity (0-100)
        
        // Display states
        displayEnabled: false,      // Current display state
        hardwareReady: false,       // Hardware initialization status
        
        // Update intervals
        updateInterval: 60000,      // General update interval (1 minute)
        
        // Styling
        fadeSpeed: 1000,           // Fade animation speed
        fontSize: "medium",         // small, medium, large
        
        // Configuration server
        configPort: 3001,          // Port for configuration API
        
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
        
        // Start hardware initialization
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
                this.config.hardwareReady = true;
                this.loaded = true;
                Log.info(`${this.name}: Hardware initialized successfully`);
                this.updateDom(this.config.fadeSpeed);
                break;

            case "MOTION_DETECTED":
                if (this.config.debugMode) {
                    Log.info(`${this.name}: Motion detected`);
                }
                this.config.displayEnabled = true;
                this.sendSocketNotification("UPDATE_LEDS", {
                    enabled: true,
                    intensity: this.config.ledIntensity,
                    identifier: this.identifier
                });
                this.updateDom(this.config.fadeSpeed);
                break;

            case "MOTION_TIMEOUT":
                if (this.config.debugMode) {
                    Log.info(`${this.name}: Motion timeout - turning off display`);
                }
                this.config.displayEnabled = false;
                this.sendSocketNotification("UPDATE_LEDS", {
                    enabled: false,
                    intensity: 0,
                    identifier: this.identifier
                });
                this.updateDom(this.config.fadeSpeed);
                break;

            case "LIGHT_INTENSITY_CHANGED":
                this.config.ledIntensity = payload.intensity;
                if (this.config.displayEnabled) {
                    this.sendSocketNotification("UPDATE_LEDS", {
                        enabled: true,
                        intensity: this.config.ledIntensity,
                        identifier: this.identifier
                    });
                }
                if (this.config.debugMode) {
                    Log.info(`${this.name}: Light intensity changed to ${payload.intensity}%`);
                }
                break;

            case "CONFIG_UPDATED":
                const oldConfig = Object.assign({}, this.config);
                this.config = Object.assign(this.config, payload.config);
                
                Log.info(`${this.name}: Configuration updated`, payload.config);
                
                // Handle LED intensity changes
                if (oldConfig.ledIntensity !== this.config.ledIntensity && this.config.displayEnabled) {
                    this.sendSocketNotification("UPDATE_LEDS", {
                        enabled: true,
                        intensity: this.config.ledIntensity,
                        identifier: this.identifier
                    });
                }
                
                // Handle motion sensitivity changes
                if (oldConfig.motionSensitivity !== this.config.motionSensitivity) {
                    this.sendSocketNotification("UPDATE_MOTION_SENSITIVITY", {
                        sensitivity: this.config.motionSensitivity,
                        identifier: this.identifier
                    });
                }
                
                this.updateDom(this.config.fadeSpeed);
                break;

            case "HARDWARE_ERROR":
                Log.error(`${this.name}: Hardware error - ${payload.error}`);
                break;

            case "CONFIG_SERVER_STARTED":
                Log.info(`${this.name}: Configuration server started on port ${payload.port}`);
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

        // If hardware not ready, show loading
        if (!this.loaded) {
            wrapper.innerHTML = `
                <div class="loading">
                    <i class="fa fa-cog fa-spin"></i>
                    <div>Initializing InfoMirror...</div>
                </div>
            `;
            return wrapper;
        }

        // If display is disabled (no motion), return empty div
        if (!this.config.displayEnabled) {
            wrapper.style.display = "none";
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

        // Add hardware status indicator
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
            "You've got this!"
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
            <div class="status-item">Hardware: ${this.config.hardwareReady ? 'Ready' : 'Not Ready'}</div>
            <div class="status-item">Motion: ${this.config.displayEnabled ? 'Active' : 'Inactive'}</div>
            <div class="status-item">LED Intensity: ${this.config.ledIntensity}%</div>
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
            'wind': 'wi-windy'
        };
        
        return iconMap[condition.toLowerCase()] || 'wi-day-sunny';
    },

    // Schedule periodic updates
    scheduleUpdate: function() {
        setInterval(() => {
            this.currentTime = new Date();
            if (this.config.displayEnabled) {
                this.updateDom(this.config.fadeSpeed);
            }
        }, this.config.updateInterval);
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