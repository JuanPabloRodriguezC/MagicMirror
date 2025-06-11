# MMM-InfoMirror

A comprehensive Magic Mirror module for the InfoMirror project (CE5507 - TEC).

## Features

- **Motion Detection**: Automatically turns display on/off based on presence
- **LED Control**: 4 strategic LEDs with intensity regulation
- **Remote Configuration**: Web-based configuration interface
- **Multiple Display Modes**: Weather, time, calendar, compliments
- **Hardware Integration**: Full GPIO control for Raspberry Pi
- **Real-time Updates**: Live configuration changes without restart

## Hardware Requirements

- Raspberry Pi (3B+ or newer recommended)
- Motion Sensor (PIR) - GPIO 18
- 4 LEDs - GPIO 12, 16, 20, 21
- Potentiometer for light regulation - GPIO 13
- Resistors and breadboard for connections

## Installation

1. Clone into MagicMirror modules directory:
```bash
cd ~/MagicMirror/modules
git clone https://github.com/your-team/MMM-InfoMirror.git