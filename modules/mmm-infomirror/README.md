# mmm-infomirror

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
git clone https://github.com/your-team/mmm-infomirror.git
```

#ERROR LOG
npm warn deprecated boolean@3.2.0: Package no longer supported. Contact Support at https://www.npmjs.com/support for more info.
npm error code 1
npm error path /home/modelado/MagicMirror/modules/mmm-infomirror/node_modules/rpi-ws281x-native
npm error command failed
npm error command sh -c node-gyp rebuild
npm error make: Entering directory '/home/modelado/MagicMirror/modules/mmm-infomirror/node_modules/rpi-ws281x-native/build'
npm error CC(target) Release/obj.target/rpi_libws2811/src/rpi_ws281x/ws2811.o
npm error CC(target) Release/obj.target/rpi_libws2811/src/rpi_ws281x/pwm.o
npm error CC(target) Release/obj.target/rpi_libws2811/src/rpi_ws281x/dma.o
npm error CC(target) Release/obj.target/rpi_libws2811/src/rpi_ws281x/mailbox.o
npm error CC(target) Release/obj.target/rpi_libws2811/src/rpi_ws281x/board_info.o
npm error rm -f Release/obj.target/rpi_libws2811.a Release/obj.target/rpi_libws2811.a.ar-file-list; mkdir -p `dirname Release/obj.target/rpi_libws2811.a`
npm error ar crs Release/obj.target/rpi_libws2811.a @Release/obj.target/rpi_libws2811.a.ar-file-list
npm error COPY Release/rpi_libws2811.a
npm error CXX(target) Release/obj.target/rpi_ws281x/src/rpi-ws281x.o
npm error make: Leaving directory '/home/modelado/MagicMirror/modules/mmm-infomirror/node_modules/rpi-ws281x-native/build'
npm error gyp info it worked if it ends with ok
npm error gyp info using node-gyp@11.0.0
npm error gyp info using node@22.16.0 | linux | arm64
npm error gyp info find Python using Python version 3.11.2 found at "/usr/bin/python3"
npm error gyp info spawn /usr/bin/python3
npm error gyp info spawn args [
npm error gyp info spawn args '/usr/lib/node_modules/npm/node_modules/node-gyp/gyp/gyp_main.py',
npm error gyp info spawn args 'binding.gyp',
npm error gyp info spawn args '-f',
npm error gyp info spawn args 'make',
npm error gyp info spawn args '-I',
npm error gyp info spawn args '/home/modelado/MagicMirror/modules/mmm-infomirror/node_modules/rpi-ws281x-native/build/config.gypi',
npm error gyp info spawn args '-I',
npm error gyp info spawn args '/usr/lib/node_modules/npm/node_modules/node-gyp/addon.gypi',
npm error gyp info spawn args '-I',
npm error gyp info spawn args '/root/.cache/node-gyp/22.16.0/include/node/common.gypi',
npm error gyp info spawn args '-Dlibrary=shared_library',
npm error gyp info spawn args '-Dvisibility=default',
npm error gyp info spawn args '-Dnode_root_dir=/root/.cache/node-gyp/22.16.0',
npm error gyp info spawn args '-Dnode_gyp_dir=/usr/lib/node_modules/npm/node_modules/node-gyp',
npm error gyp info spawn args '-Dnode_lib_file=/root/.cache/node-gyp/22.16.0/<(target_arch)/node.lib',
npm error gyp info spawn args '-Dmodule_root_dir=/home/modelado/MagicMirror/modules/mmm-infomirror/node_modules/rpi-ws281x-native',
npm error gyp info spawn args '-Dnode_engine=v8',
npm error gyp info spawn args '--depth=.',
npm error gyp info spawn args '--no-parallel',
npm error gyp info spawn args '--generator-output',
npm error gyp info spawn args 'build',
npm error gyp info spawn args '-Goutput_dir=.'
npm error gyp info spawn args ]
npm error gyp info spawn make
npm error gyp info spawn args [ 'BUILDTYPE=Release', '-C', 'build' ]
npm error ../src/rpi_ws281x/ws2811.c: In function ‘unmap_device’:
npm error ../src/rpi_ws281x/ws2811.c:128:21: warning: cast from pointer to integer of different size [-Wpointer-to-int-cast]
npm error 128 | uint32_t virt = (uint32_t)addr;
npm error | ^
npm error ../src/rpi_ws281x/ws2811.c: In function ‘setup_pwm’:
npm error ../src/rpi_ws281x/ws2811.c:307:23: warning: cast from pointer to integer of different size [-Wpointer-to-int-cast]
npm error 307 | dma_cb->dest_ad = (uint32_t)&((pwm_t _)PWM_PERIPH_PHYS)->fif1;
npm error | ^
npm error ../src/rpi_ws281x/mailbox.c: In function ‘mapmem’:
npm error ../src/rpi_ws281x/mailbox.c:68:33: warning: cast from pointer to integer of different size [-Wpointer-to-int-cast]
npm error 68 | printf("mmap error %d\n", (int)mem);
npm error | ^
npm error ../src/rpi_ws281x/mailbox.c: In function ‘mbox_open’:
npm error ../src/rpi_ws281x/mailbox.c:289:51: warning: implicit declaration of function ‘makedev’ [-Wimplicit-function-declaration]
npm error 289 | if (mknod(filename, S_IFCHR|0600, makedev(100, 0)) < 0) {
npm error | ^~~~~~~
npm error ../src/rpi-ws281x.cc: In function ‘void render(const Nan::FunctionCallbackInfo<v8::Value>&)’:
npm error ../src/rpi-ws281x.cc:43:43: error: no matching function for call to ‘v8::Value::ToObject()’
npm error 43 | Local<Object> buffer = info[0]->ToObject();
npm error | ~~~~~~~~~~~~~~~~~^~
npm error In file included from /root/.cache/node-gyp/22.16.0/include/node/v8-primitive.h:11,
npm error from /root/.cache/node-gyp/22.16.0/include/node/v8-object.h:11,
npm error from /root/.cache/node-gyp/22.16.0/include/node/v8-array-buffer.h:13,
npm error from /root/.cache/node-gyp/22.16.0/include/node/v8.h:24,
npm error from /root/.cache/node-gyp/22.16.0/include/node/node.h:74,
npm error from ../../nan/nan.h:62,
npm error from ../src/rpi-ws281x.cc:1:
npm error /root/.cache/node-gyp/22.16.0/include/node/v8-value.h:401:44: note: candidate: ‘v8::MaybeLocal<v8::Object> v8::Value::ToObject(v8::Local<v8::Context>) const’
npm error 401 | V8_WARN_UNUSED_RESULT MaybeLocal<Object> ToObject(
npm error | ^~~~~~~~
npm error /root/.cache/node-gyp/22.16.0/include/node/v8-value.h:401:44: note: candidate expects 1 argument, 0 provided
npm error ../src/rpi-ws281x.cc: In function ‘void init(const Nan::FunctionCallbackInfo<v8::Value>&)’:
npm error ../src/rpi-ws281x.cc:87:51: error: no matching function for call to ‘v8::Value::Int32Value()’
npm error 87 | ledstring.channel[0].count = info[0]->Int32Value();
npm error | ~~~~~~~~~~~~~~~~~~~^~
npm error /root/.cache/node-gyp/22.16.0/include/node/v8-value.h:448:40: note: candidate: ‘v8::Maybe<int> v8::Value::Int32Value(v8::Local<v8::Context>) const’
npm error 448 | V8_WARN_UNUSED_RESULT Maybe<int32_t> Int32Value(Local<Context> context) const;
npm error | ^~~~~~~~~~
npm error /root/.cache/node-gyp/22.16.0/include/node/v8-value.h:448:40: note: candidate expects 1 argument, 0 provided
npm error ../src/rpi-ws281x.cc:91:45: error: no matching function for call to ‘v8::Value::ToObject()’
npm error 91 | Local<Object> config = info[1]->ToObject();
npm error | ~~~~~~~~~~~~~~~~~^~
npm error /root/.cache/node-gyp/22.16.0/include/node/v8-value.h:401:44: note: candidate: ‘v8::MaybeLocal<v8::Object> v8::Value::ToObject(v8::Local<v8::Context>) const’
npm error 401 | V8_WARN_UNUSED_RESULT MaybeLocal<Object> ToObject(
npm error | ^~~~~~~~
npm error /root/.cache/node-gyp/22.16.0/include/node/v8-value.h:401:44: note: candidate expects 1 argument, 0 provided
npm error ../src/rpi-ws281x.cc:101:35: error: no matching function for call to ‘v8::Object::Get(v8::Local<v8::String>&)’
npm error 101 | ledstring.freq = config->Get(symFreq)->Uint32Value();
npm error | ~~~~~~~~~~~^~~~~~~~~
npm error /root/.cache/node-gyp/22.16.0/include/node/v8-object.h:295:43: note: candidate: ‘v8::MaybeLocal<v8::Value> v8::Object::Get(v8::Local<v8::Context>, v8::Local<v8::Value>)’
npm error 295 | V8_WARN_UNUSED_RESULT MaybeLocal<Value> Get(Local<Context> context,
npm error | ^~~
npm error /root/.cache/node-gyp/22.16.0/include/node/v8-object.h:295:43: note: candidate expects 2 arguments, 1 provided
npm error /root/.cache/node-gyp/22.16.0/include/node/v8-object.h:298:43: note: candidate: ‘v8::MaybeLocal<v8::Value> v8::Object::Get(v8::Local<v8::Context>, uint32_t)’
npm error 298 | V8_WARN_UNUSED_RESULT MaybeLocal<Value> Get(Local<Context> context,
npm error | ^~~
npm error /root/.cache/node-gyp/22.16.0/include/node/v8-object.h:298:43: note: candidate expects 2 arguments, 1 provided
npm error ../src/rpi-ws281x.cc:105:37: error: no matching function for call to ‘v8::Object::Get(v8::Local<v8::String>&)’
npm error 105 | ledstring.dmanum = config->Get(symDmaNum)->Int32Value();
npm error | ~~~~~~~~~~~^~~~~~~~~~~
npm error /root/.cache/node-gyp/22.16.0/include/node/v8-object.h:295:43: note: candidate: ‘v8::MaybeLocal<v8::Value> v8::Object::Get(v8::Local<v8::Context>, v8::Local<v8::Value>)’
npm error 295 | V8_WARN_UNUSED_RESULT MaybeLocal<Value> Get(Local<Context> context,
npm error | ^~~
npm error /root/.cache/node-gyp/22.16.0/include/node/v8-object.h:295:43: note: candidate expects 2 arguments, 1 provided
npm error /root/.cache/node-gyp/22.16.0/include/node/v8-object.h:298:43: note: candidate: ‘v8::MaybeLocal<v8::Value> v8::Object::Get(v8::Local<v8::Context>, uint32_t)’
npm error 298 | V8_WARN_UNUSED_RESULT MaybeLocal<Value> Get(Local<Context> context,
npm error | ^~~
npm error /root/.cache/node-gyp/22.16.0/include/node/v8-object.h:298:43: note: candidate expects 2 arguments, 1 provided
npm error ../src/rpi-ws281x.cc:109:49: error: no matching function for call to ‘v8::Object::Get(v8::Local<v8::String>&)’
npm error 109 | ledstring.channel[0].gpionum = config->Get(symGpioPin)->Int32Value();
npm error | ~~~~~~~~~~~^~~~~~~~~~~~
npm error /root/.cache/node-gyp/22.16.0/include/node/v8-object.h:295:43: note: candidate: ‘v8::MaybeLocal<v8::Value> v8::Object::Get(v8::Local<v8::Context>, v8::Local<v8::Value>)’
npm error 295 | V8_WARN_UNUSED_RESULT MaybeLocal<Value> Get(Local<Context> context,
npm error | ^~~
npm error /root/.cache/node-gyp/22.16.0/include/node/v8-object.h:295:43: note: candidate expects 2 arguments, 1 provided
npm error /root/.cache/node-gyp/22.16.0/include/node/v8-object.h:298:43: note: candidate: ‘v8::MaybeLocal<v8::Value> v8::Object::Get(v8::Local<v8::Context>, uint32_t)’
npm error 298 | V8_WARN_UNUSED_RESULT MaybeLocal<Value> Get(Local<Context> context,
npm error | ^~~
npm error /root/.cache/node-gyp/22.16.0/include/node/v8-object.h:298:43: note: candidate expects 2 arguments, 1 provided
npm error ../src/rpi-ws281x.cc:113:48: error: no matching function for call to ‘v8::Object::Get(v8::Local<v8::String>&)’
npm error 113 | ledstring.channel[0].invert = config->Get(symInvert)->Int32Value();
npm error | ~~~~~~~~~~~^~~~~~~~~~~
npm error /root/.cache/node-gyp/22.16.0/include/node/v8-object.h:295:43: note: candidate: ‘v8::MaybeLocal<v8::Value> v8::Object::Get(v8::Local<v8::Context>, v8::Local<v8::Value>)’
npm error 295 | V8_WARN_UNUSED_RESULT MaybeLocal<Value> Get(Local<Context> context,
npm error | ^~~
npm error /root/.cache/node-gyp/22.16.0/include/node/v8-object.h:295:43: note: candidate expects 2 arguments, 1 provided
npm error /root/.cache/node-gyp/22.16.0/include/node/v8-object.h:298:43: note: candidate: ‘v8::MaybeLocal<v8::Value> v8::Object::Get(v8::Local<v8::Context>, uint32_t)’
npm error 298 | V8_WARN_UNUSED_RESULT MaybeLocal<Value> Get(Local<Context> context,
npm error | ^~~
npm error /root/.cache/node-gyp/22.16.0/include/node/v8-object.h:298:43: note: candidate expects 2 arguments, 1 provided
npm error ../src/rpi-ws281x.cc:117:52: error: no matching function for call to ‘v8::Object::Get(v8::Local<v8::String>&)’
npm error 117 | ledstring.channel[0].brightness = config->Get(symBrightness)->Int32Value();
npm error | ~~~~~~~~~~~^~~~~~~~~~~~~~~
npm error /root/.cache/node-gyp/22.16.0/include/node/v8-object.h:295:43: note: candidate: ‘v8::MaybeLocal<v8::Value> v8::Object::Get(v8::Local<v8::Context>, v8::Local<v8::Value>)’
npm error 295 | V8_WARN_UNUSED_RESULT MaybeLocal<Value> Get(Local<Context> context,
npm error | ^~~
npm error /root/.cache/node-gyp/22.16.0/include/node/v8-object.h:295:43: note: candidate expects 2 arguments, 1 provided
npm error /root/.cache/node-gyp/22.16.0/include/node/v8-object.h:298:43: note: candidate: ‘v8::MaybeLocal<v8::Value> v8::Object::Get(v8::Local<v8::Context>, uint32_t)’
npm error 298 | V8_WARN_UNUSED_RESULT MaybeLocal<Value> Get(Local<Context> context,
npm error | ^~~
npm error /root/.cache/node-gyp/22.16.0/include/node/v8-object.h:298:43: note: candidate expects 2 arguments, 1 provided
npm error ../src/rpi-ws281x.cc: In function ‘void setBrightness(const Nan::FunctionCallbackInfo<v8::Value>&)’:
npm error ../src/rpi-ws281x.cc:144:56: error: no matching function for call to ‘v8::Value::Int32Value()’
npm error 144 | ledstring.channel[0].brightness = info[0]->Int32Value();
npm error | ~~~~~~~~~~~~~~~~~~~^~
npm error /root/.cache/node-gyp/22.16.0/include/node/v8-value.h:448:40: note: candidate: ‘v8::Maybe<int> v8::Value::Int32Value(v8::Local<v8::Context>) const’
npm error 448 | V8_WARN_UNUSED_RESULT Maybe<int32_t> Int32Value(Local<Context> context) const;
npm error | ^~~~~~~~~~
npm error /root/.cache/node-gyp/22.16.0/include/node/v8-value.h:448:40: note: candidate expects 1 argument, 0 provided
npm error ../src/rpi-ws281x.cc: At global scope:
npm error /root/.cache/node-gyp/22.16.0/include/node/node.h:1228:7: warning: cast between incompatible function types from ‘void (_)(v8::Handle<v8::Object>)’ {aka ‘void (_)(v8::Local<v8::Object>)’} to ‘node::addon_register_func’ {aka ‘void (_)(v8::Local<v8::Object>, v8::Local<v8::Value>, void\*)’} [-Wcast-function-type]
npm error 1228 | (node::addon_register_func) (regfunc), \
npm error | ^~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
npm error /root/.cache/node-gyp/22.16.0/include/node/node.h:1262:3: note: in expansion of macro ‘NODE_MODULE_X’
npm error 1262 | NODE_MODULE_X(modname, regfunc, NULL, 0) // NOLINT (readability/null_usage)
npm error | ^~~~~~~~~~~~~
npm error ../src/rpi-ws281x.cc:175:1: note: in expansion of macro ‘NODE_MODULE’
npm error 175 | NODE_MODULE(rpi_ws281x, initialize)
npm error | ^~~~~~~~~~~
npm error make: \*\*\* [rpi_ws281x.target.mk:111: Release/obj.target/rpi_ws281x/src/rpi-ws281x.o] Error 1
npm error gyp ERR! build error
npm error gyp ERR! stack Error: `make` failed with exit code: 2
npm error gyp ERR! stack at ChildProcess.<anonymous> (/usr/lib/node_modules/npm/node_modules/node-gyp/lib/build.js:216:23)
npm error gyp ERR! System Linux 6.12.25+rpt-rpi-v8
npm error gyp ERR! command "/usr/bin/node" "/usr/lib/node_modules/npm/node_modules/node-gyp/bin/node-gyp.js" "rebuild"
npm error gyp ERR! cwd /home/modelado/MagicMirror/modules/mmm-infomirror/node_modules/rpi-ws281x-native
npm error gyp ERR! node -v v22.16.0
npm error gyp ERR! node-gyp -v v11.0.0
npm error gyp ERR! not ok
npm error A complete log of this run can be found in: /root/.npm/\_logs/2025-06-19T14_36_56_964Z-debug-0.log
