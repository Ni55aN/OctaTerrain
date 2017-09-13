// The Module object: Our interface to the outside world. We import
// and export values on it, and do the work to get that through
// closure compiler if necessary. There are various ways Module can be used:
// 1. Not defined. We create it here
// 2. A function parameter, function(Module) { ..generated code.. }
// 3. pre-run appended it, var Module = {}; ..generated code..
// 4. External script tag defines var Module.
// We need to do an eval in order to handle the closure compiler
// case, where this code here is minified but Module was defined
// elsewhere (e.g. case 4 above). We also need to check if Module
// already exists (e.g. case 3 above).
// Note that if you want to run closure, and also to use Module
// after the generated code, you will need to define   var Module = {};
// before the code. Then that object will be used in the code, and you
// can continue to use Module afterwards as well.
var Module;
if (!Module) Module = (typeof OctaTerrain !== 'undefined' ? OctaTerrain : null) || {};

// Sometimes an existing Module object exists with properties
// meant to overwrite the default module functionality. Here
// we collect those properties and reapply _after_ we configure
// the current environment's defaults to avoid having to be so
// defensive during initialization.
var moduleOverrides = {};
for (var key in Module) {
  if (Module.hasOwnProperty(key)) {
    moduleOverrides[key] = Module[key];
  }
}

// The environment setup code below is customized to use Module.
// *** Environment setup code ***
var ENVIRONMENT_IS_WEB = false;
var ENVIRONMENT_IS_WORKER = false;
var ENVIRONMENT_IS_NODE = false;
var ENVIRONMENT_IS_SHELL = false;

// Three configurations we can be running in:
// 1) We could be the application main() thread running in the main JS UI thread. (ENVIRONMENT_IS_WORKER == false and ENVIRONMENT_IS_PTHREAD == false)
// 2) We could be the application main() thread proxied to worker. (with Emscripten -s PROXY_TO_WORKER=1) (ENVIRONMENT_IS_WORKER == true, ENVIRONMENT_IS_PTHREAD == false)
// 3) We could be an application pthread running in a worker. (ENVIRONMENT_IS_WORKER == true and ENVIRONMENT_IS_PTHREAD == true)

if (Module['ENVIRONMENT']) {
  if (Module['ENVIRONMENT'] === 'WEB') {
    ENVIRONMENT_IS_WEB = true;
  } else if (Module['ENVIRONMENT'] === 'WORKER') {
    ENVIRONMENT_IS_WORKER = true;
  } else if (Module['ENVIRONMENT'] === 'NODE') {
    ENVIRONMENT_IS_NODE = true;
  } else if (Module['ENVIRONMENT'] === 'SHELL') {
    ENVIRONMENT_IS_SHELL = true;
  } else {
    throw new Error('The provided Module[\'ENVIRONMENT\'] value is not valid. It must be one of: WEB|WORKER|NODE|SHELL.');
  }
} else {
  ENVIRONMENT_IS_WEB = typeof window === 'object';
  ENVIRONMENT_IS_WORKER = typeof importScripts === 'function';
  ENVIRONMENT_IS_NODE = typeof process === 'object' && typeof require === 'function' && !ENVIRONMENT_IS_WEB && !ENVIRONMENT_IS_WORKER;
  ENVIRONMENT_IS_SHELL = !ENVIRONMENT_IS_WEB && !ENVIRONMENT_IS_NODE && !ENVIRONMENT_IS_WORKER;
}


if (ENVIRONMENT_IS_NODE) {
  // Expose functionality in the same simple way that the shells work
  // Note that we pollute the global namespace here, otherwise we break in node
  if (!Module['print']) Module['print'] = console.log;
  if (!Module['printErr']) Module['printErr'] = console.warn;

  var nodeFS;
  var nodePath;

  Module['read'] = function read(filename, binary) {
    if (!nodeFS) nodeFS = require('fs');
    if (!nodePath) nodePath = require('path');
    filename = nodePath['normalize'](filename);
    var ret = nodeFS['readFileSync'](filename);
    return binary ? ret : ret.toString();
  };

  Module['readBinary'] = function readBinary(filename) {
    var ret = Module['read'](filename, true);
    if (!ret.buffer) {
      ret = new Uint8Array(ret);
    }
    assert(ret.buffer);
    return ret;
  };

  Module['load'] = function load(f) {
    globalEval(read(f));
  };

  if (!Module['thisProgram']) {
    if (process['argv'].length > 1) {
      Module['thisProgram'] = process['argv'][1].replace(/\\/g, '/');
    } else {
      Module['thisProgram'] = 'unknown-program';
    }
  }

  Module['arguments'] = process['argv'].slice(2);

  if (typeof module !== 'undefined') {
    module['exports'] = Module;
  }

  process['on']('uncaughtException', function(ex) {
    // suppress ExitStatus exceptions from showing an error
    if (!(ex instanceof ExitStatus)) {
      throw ex;
    }
  });

  Module['inspect'] = function () { return '[Emscripten Module object]'; };
}
else if (ENVIRONMENT_IS_SHELL) {
  if (!Module['print']) Module['print'] = print;
  if (typeof printErr != 'undefined') Module['printErr'] = printErr; // not present in v8 or older sm

  if (typeof read != 'undefined') {
    Module['read'] = read;
  } else {
    Module['read'] = function read() { throw 'no read() available' };
  }

  Module['readBinary'] = function readBinary(f) {
    if (typeof readbuffer === 'function') {
      return new Uint8Array(readbuffer(f));
    }
    var data = read(f, 'binary');
    assert(typeof data === 'object');
    return data;
  };

  if (typeof scriptArgs != 'undefined') {
    Module['arguments'] = scriptArgs;
  } else if (typeof arguments != 'undefined') {
    Module['arguments'] = arguments;
  }

}
else if (ENVIRONMENT_IS_WEB || ENVIRONMENT_IS_WORKER) {
  Module['read'] = function read(url) {
    var xhr = new XMLHttpRequest();
    xhr.open('GET', url, false);
    xhr.send(null);
    return xhr.responseText;
  };

  Module['readAsync'] = function readAsync(url, onload, onerror) {
    var xhr = new XMLHttpRequest();
    xhr.open('GET', url, true);
    xhr.responseType = 'arraybuffer';
    xhr.onload = function xhr_onload() {
      if (xhr.status == 200 || (xhr.status == 0 && xhr.response)) { // file URLs can return 0
        onload(xhr.response);
      } else {
        onerror();
      }
    };
    xhr.onerror = onerror;
    xhr.send(null);
  };

  if (typeof arguments != 'undefined') {
    Module['arguments'] = arguments;
  }

  if (typeof console !== 'undefined') {
    if (!Module['print']) Module['print'] = function print(x) {
      console.log(x);
    };
    if (!Module['printErr']) Module['printErr'] = function printErr(x) {
      console.warn(x);
    };
  } else {
    // Probably a worker, and without console.log. We can do very little here...
    var TRY_USE_DUMP = false;
    if (!Module['print']) Module['print'] = (TRY_USE_DUMP && (typeof(dump) !== "undefined") ? (function(x) {
      dump(x);
    }) : (function(x) {
      // self.postMessage(x); // enable this if you want stdout to be sent as messages
    }));
  }

  if (ENVIRONMENT_IS_WORKER) {
    Module['load'] = importScripts;
  }

  if (typeof Module['setWindowTitle'] === 'undefined') {
    Module['setWindowTitle'] = function(title) { document.title = title };
  }
}
else {
  // Unreachable because SHELL is dependant on the others
  throw 'Unknown runtime environment. Where are we?';
}

function globalEval(x) {
  eval.call(null, x);
}
if (!Module['load'] && Module['read']) {
  Module['load'] = function load(f) {
    globalEval(Module['read'](f));
  };
}
if (!Module['print']) {
  Module['print'] = function(){};
}
if (!Module['printErr']) {
  Module['printErr'] = Module['print'];
}
if (!Module['arguments']) {
  Module['arguments'] = [];
}
if (!Module['thisProgram']) {
  Module['thisProgram'] = './this.program';
}

// *** Environment setup code ***

// Closure helpers
Module.print = Module['print'];
Module.printErr = Module['printErr'];

// Callbacks
Module['preRun'] = [];
Module['postRun'] = [];

// Merge back in the overrides
for (var key in moduleOverrides) {
  if (moduleOverrides.hasOwnProperty(key)) {
    Module[key] = moduleOverrides[key];
  }
}
// Free the object hierarchy contained in the overrides, this lets the GC
// reclaim data used e.g. in memoryInitializerRequest, which is a large typed array.
moduleOverrides = undefined;



// {{PREAMBLE_ADDITIONS}}

// === Preamble library stuff ===

// Documentation for the public APIs defined in this file must be updated in:
//    site/source/docs/api_reference/preamble.js.rst
// A prebuilt local version of the documentation is available at:
//    site/build/text/docs/api_reference/preamble.js.txt
// You can also build docs locally as HTML or other formats in site/
// An online HTML version (which may be of a different version of Emscripten)
//    is up at http://kripken.github.io/emscripten-site/docs/api_reference/preamble.js.html

//========================================
// Runtime code shared with compiler
//========================================

var Runtime = {
  setTempRet0: function (value) {
    tempRet0 = value;
  },
  getTempRet0: function () {
    return tempRet0;
  },
  stackSave: function () {
    return STACKTOP;
  },
  stackRestore: function (stackTop) {
    STACKTOP = stackTop;
  },
  getNativeTypeSize: function (type) {
    switch (type) {
      case 'i1': case 'i8': return 1;
      case 'i16': return 2;
      case 'i32': return 4;
      case 'i64': return 8;
      case 'float': return 4;
      case 'double': return 8;
      default: {
        if (type[type.length-1] === '*') {
          return Runtime.QUANTUM_SIZE; // A pointer
        } else if (type[0] === 'i') {
          var bits = parseInt(type.substr(1));
          assert(bits % 8 === 0);
          return bits/8;
        } else {
          return 0;
        }
      }
    }
  },
  getNativeFieldSize: function (type) {
    return Math.max(Runtime.getNativeTypeSize(type), Runtime.QUANTUM_SIZE);
  },
  STACK_ALIGN: 16,
  prepVararg: function (ptr, type) {
    if (type === 'double' || type === 'i64') {
      // move so the load is aligned
      if (ptr & 7) {
        assert((ptr & 7) === 4);
        ptr += 4;
      }
    } else {
      assert((ptr & 3) === 0);
    }
    return ptr;
  },
  getAlignSize: function (type, size, vararg) {
    // we align i64s and doubles on 64-bit boundaries, unlike x86
    if (!vararg && (type == 'i64' || type == 'double')) return 8;
    if (!type) return Math.min(size, 8); // align structures internally to 64 bits
    return Math.min(size || (type ? Runtime.getNativeFieldSize(type) : 0), Runtime.QUANTUM_SIZE);
  },
  dynCall: function (sig, ptr, args) {
    if (args && args.length) {
      return Module['dynCall_' + sig].apply(null, [ptr].concat(args));
    } else {
      return Module['dynCall_' + sig].call(null, ptr);
    }
  },
  functionPointers: [],
  addFunction: function (func) {
    for (var i = 0; i < Runtime.functionPointers.length; i++) {
      if (!Runtime.functionPointers[i]) {
        Runtime.functionPointers[i] = func;
        return 2*(1 + i);
      }
    }
    throw 'Finished up all reserved function pointers. Use a higher value for RESERVED_FUNCTION_POINTERS.';
  },
  removeFunction: function (index) {
    Runtime.functionPointers[(index-2)/2] = null;
  },
  warnOnce: function (text) {
    if (!Runtime.warnOnce.shown) Runtime.warnOnce.shown = {};
    if (!Runtime.warnOnce.shown[text]) {
      Runtime.warnOnce.shown[text] = 1;
      Module.printErr(text);
    }
  },
  funcWrappers: {},
  getFuncWrapper: function (func, sig) {
    assert(sig);
    if (!Runtime.funcWrappers[sig]) {
      Runtime.funcWrappers[sig] = {};
    }
    var sigCache = Runtime.funcWrappers[sig];
    if (!sigCache[func]) {
      // optimize away arguments usage in common cases
      if (sig.length === 1) {
        sigCache[func] = function dynCall_wrapper() {
          return Runtime.dynCall(sig, func);
        };
      } else if (sig.length === 2) {
        sigCache[func] = function dynCall_wrapper(arg) {
          return Runtime.dynCall(sig, func, [arg]);
        };
      } else {
        // general case
        sigCache[func] = function dynCall_wrapper() {
          return Runtime.dynCall(sig, func, Array.prototype.slice.call(arguments));
        };
      }
    }
    return sigCache[func];
  },
  getCompilerSetting: function (name) {
    throw 'You must build with -s RETAIN_COMPILER_SETTINGS=1 for Runtime.getCompilerSetting or emscripten_get_compiler_setting to work';
  },
  stackAlloc: function (size) { var ret = STACKTOP;STACKTOP = (STACKTOP + size)|0;STACKTOP = (((STACKTOP)+15)&-16); return ret; },
  staticAlloc: function (size) { var ret = STATICTOP;STATICTOP = (STATICTOP + size)|0;STATICTOP = (((STATICTOP)+15)&-16); return ret; },
  dynamicAlloc: function (size) { var ret = HEAP32[DYNAMICTOP_PTR>>2];var end = (((ret + size + 15)|0) & -16);HEAP32[DYNAMICTOP_PTR>>2] = end;if (end >= TOTAL_MEMORY) {var success = enlargeMemory();if (!success) {HEAP32[DYNAMICTOP_PTR>>2] = ret;return 0;}}return ret;},
  alignMemory: function (size,quantum) { var ret = size = Math.ceil((size)/(quantum ? quantum : 16))*(quantum ? quantum : 16); return ret; },
  makeBigInt: function (low,high,unsigned) { var ret = (unsigned ? ((+((low>>>0)))+((+((high>>>0)))*4294967296.0)) : ((+((low>>>0)))+((+((high|0)))*4294967296.0))); return ret; },
  GLOBAL_BASE: 8,
  QUANTUM_SIZE: 4,
  __dummy__: 0
}



Module["Runtime"] = Runtime;



//========================================
// Runtime essentials
//========================================

var ABORT = 0; // whether we are quitting the application. no code should run after this. set in exit() and abort()
var EXITSTATUS = 0;

function assert(condition, text) {
  if (!condition) {
    abort('Assertion failed: ' + text);
  }
}

var globalScope = this;

// Returns the C function with a specified identifier (for C++, you need to do manual name mangling)
function getCFunc(ident) {
  var func = Module['_' + ident]; // closure exported function
  if (!func) {
    try { func = eval('_' + ident); } catch(e) {}
  }
  assert(func, 'Cannot call unknown function ' + ident + ' (perhaps LLVM optimizations or closure removed it?)');
  return func;
}

var cwrap, ccall;
(function(){
  var JSfuncs = {
    // Helpers for cwrap -- it can't refer to Runtime directly because it might
    // be renamed by closure, instead it calls JSfuncs['stackSave'].body to find
    // out what the minified function name is.
    'stackSave': function() {
      Runtime.stackSave()
    },
    'stackRestore': function() {
      Runtime.stackRestore()
    },
    // type conversion from js to c
    'arrayToC' : function(arr) {
      var ret = Runtime.stackAlloc(arr.length);
      writeArrayToMemory(arr, ret);
      return ret;
    },
    'stringToC' : function(str) {
      var ret = 0;
      if (str !== null && str !== undefined && str !== 0) { // null string
        // at most 4 bytes per UTF-8 code point, +1 for the trailing '\0'
        var len = (str.length << 2) + 1;
        ret = Runtime.stackAlloc(len);
        stringToUTF8(str, ret, len);
      }
      return ret;
    }
  };
  // For fast lookup of conversion functions
  var toC = {'string' : JSfuncs['stringToC'], 'array' : JSfuncs['arrayToC']};

  // C calling interface.
  ccall = function ccallFunc(ident, returnType, argTypes, args, opts) {
    var func = getCFunc(ident);
    var cArgs = [];
    var stack = 0;
    if (args) {
      for (var i = 0; i < args.length; i++) {
        var converter = toC[argTypes[i]];
        if (converter) {
          if (stack === 0) stack = Runtime.stackSave();
          cArgs[i] = converter(args[i]);
        } else {
          cArgs[i] = args[i];
        }
      }
    }
    var ret = func.apply(null, cArgs);
    if (returnType === 'string') ret = Pointer_stringify(ret);
    if (stack !== 0) {
      if (opts && opts.async) {
        EmterpreterAsync.asyncFinalizers.push(function() {
          Runtime.stackRestore(stack);
        });
        return;
      }
      Runtime.stackRestore(stack);
    }
    return ret;
  }

  var sourceRegex = /^function\s*[a-zA-Z$_0-9]*\s*\(([^)]*)\)\s*{\s*([^*]*?)[\s;]*(?:return\s*(.*?)[;\s]*)?}$/;
  function parseJSFunc(jsfunc) {
    // Match the body and the return value of a javascript function source
    var parsed = jsfunc.toString().match(sourceRegex).slice(1);
    return {arguments : parsed[0], body : parsed[1], returnValue: parsed[2]}
  }

  // sources of useful functions. we create this lazily as it can trigger a source decompression on this entire file
  var JSsource = null;
  function ensureJSsource() {
    if (!JSsource) {
      JSsource = {};
      for (var fun in JSfuncs) {
        if (JSfuncs.hasOwnProperty(fun)) {
          // Elements of toCsource are arrays of three items:
          // the code, and the return value
          JSsource[fun] = parseJSFunc(JSfuncs[fun]);
        }
      }
    }
  }

  cwrap = function cwrap(ident, returnType, argTypes) {
    argTypes = argTypes || [];
    var cfunc = getCFunc(ident);
    // When the function takes numbers and returns a number, we can just return
    // the original function
    var numericArgs = argTypes.every(function(type){ return type === 'number'});
    var numericRet = (returnType !== 'string');
    if ( numericRet && numericArgs) {
      return cfunc;
    }
    // Creation of the arguments list (["$1","$2",...,"$nargs"])
    var argNames = argTypes.map(function(x,i){return '$'+i});
    var funcstr = "(function(" + argNames.join(',') + ") {";
    var nargs = argTypes.length;
    if (!numericArgs) {
      // Generate the code needed to convert the arguments from javascript
      // values to pointers
      ensureJSsource();
      funcstr += 'var stack = ' + JSsource['stackSave'].body + ';';
      for (var i = 0; i < nargs; i++) {
        var arg = argNames[i], type = argTypes[i];
        if (type === 'number') continue;
        var convertCode = JSsource[type + 'ToC']; // [code, return]
        funcstr += 'var ' + convertCode.arguments + ' = ' + arg + ';';
        funcstr += convertCode.body + ';';
        funcstr += arg + '=(' + convertCode.returnValue + ');';
      }
    }

    // When the code is compressed, the name of cfunc is not literally 'cfunc' anymore
    var cfuncname = parseJSFunc(function(){return cfunc}).returnValue;
    // Call the function
    funcstr += 'var ret = ' + cfuncname + '(' + argNames.join(',') + ');';
    if (!numericRet) { // Return type can only by 'string' or 'number'
      // Convert the result to a string
      var strgfy = parseJSFunc(function(){return Pointer_stringify}).returnValue;
      funcstr += 'ret = ' + strgfy + '(ret);';
    }
    if (!numericArgs) {
      // If we had a stack, restore it
      ensureJSsource();
      funcstr += JSsource['stackRestore'].body.replace('()', '(stack)') + ';';
    }
    funcstr += 'return ret})';
    return eval(funcstr);
  };
})();
Module["ccall"] = ccall;
Module["cwrap"] = cwrap;

function setValue(ptr, value, type, noSafe) {
  type = type || 'i8';
  if (type.charAt(type.length-1) === '*') type = 'i32'; // pointers are 32-bit
    switch(type) {
      case 'i1': HEAP8[((ptr)>>0)]=value; break;
      case 'i8': HEAP8[((ptr)>>0)]=value; break;
      case 'i16': HEAP16[((ptr)>>1)]=value; break;
      case 'i32': HEAP32[((ptr)>>2)]=value; break;
      case 'i64': (tempI64 = [value>>>0,(tempDouble=value,(+(Math_abs(tempDouble))) >= 1.0 ? (tempDouble > 0.0 ? ((Math_min((+(Math_floor((tempDouble)/4294967296.0))), 4294967295.0))|0)>>>0 : (~~((+(Math_ceil((tempDouble - +(((~~(tempDouble)))>>>0))/4294967296.0)))))>>>0) : 0)],HEAP32[((ptr)>>2)]=tempI64[0],HEAP32[(((ptr)+(4))>>2)]=tempI64[1]); break;
      case 'float': HEAPF32[((ptr)>>2)]=value; break;
      case 'double': HEAPF64[((ptr)>>3)]=value; break;
      default: abort('invalid type for setValue: ' + type);
    }
}
Module["setValue"] = setValue;


function getValue(ptr, type, noSafe) {
  type = type || 'i8';
  if (type.charAt(type.length-1) === '*') type = 'i32'; // pointers are 32-bit
    switch(type) {
      case 'i1': return HEAP8[((ptr)>>0)];
      case 'i8': return HEAP8[((ptr)>>0)];
      case 'i16': return HEAP16[((ptr)>>1)];
      case 'i32': return HEAP32[((ptr)>>2)];
      case 'i64': return HEAP32[((ptr)>>2)];
      case 'float': return HEAPF32[((ptr)>>2)];
      case 'double': return HEAPF64[((ptr)>>3)];
      default: abort('invalid type for setValue: ' + type);
    }
  return null;
}
Module["getValue"] = getValue;

var ALLOC_NORMAL = 0; // Tries to use _malloc()
var ALLOC_STACK = 1; // Lives for the duration of the current function call
var ALLOC_STATIC = 2; // Cannot be freed
var ALLOC_DYNAMIC = 3; // Cannot be freed except through sbrk
var ALLOC_NONE = 4; // Do not allocate
Module["ALLOC_NORMAL"] = ALLOC_NORMAL;
Module["ALLOC_STACK"] = ALLOC_STACK;
Module["ALLOC_STATIC"] = ALLOC_STATIC;
Module["ALLOC_DYNAMIC"] = ALLOC_DYNAMIC;
Module["ALLOC_NONE"] = ALLOC_NONE;

// allocate(): This is for internal use. You can use it yourself as well, but the interface
//             is a little tricky (see docs right below). The reason is that it is optimized
//             for multiple syntaxes to save space in generated code. So you should
//             normally not use allocate(), and instead allocate memory using _malloc(),
//             initialize it with setValue(), and so forth.
// @slab: An array of data, or a number. If a number, then the size of the block to allocate,
//        in *bytes* (note that this is sometimes confusing: the next parameter does not
//        affect this!)
// @types: Either an array of types, one for each byte (or 0 if no type at that position),
//         or a single type which is used for the entire block. This only matters if there
//         is initial data - if @slab is a number, then this does not matter at all and is
//         ignored.
// @allocator: How to allocate memory, see ALLOC_*
function allocate(slab, types, allocator, ptr) {
  var zeroinit, size;
  if (typeof slab === 'number') {
    zeroinit = true;
    size = slab;
  } else {
    zeroinit = false;
    size = slab.length;
  }

  var singleType = typeof types === 'string' ? types : null;

  var ret;
  if (allocator == ALLOC_NONE) {
    ret = ptr;
  } else {
    ret = [typeof _malloc === 'function' ? _malloc : Runtime.staticAlloc, Runtime.stackAlloc, Runtime.staticAlloc, Runtime.dynamicAlloc][allocator === undefined ? ALLOC_STATIC : allocator](Math.max(size, singleType ? 1 : types.length));
  }

  if (zeroinit) {
    var ptr = ret, stop;
    assert((ret & 3) == 0);
    stop = ret + (size & ~3);
    for (; ptr < stop; ptr += 4) {
      HEAP32[((ptr)>>2)]=0;
    }
    stop = ret + size;
    while (ptr < stop) {
      HEAP8[((ptr++)>>0)]=0;
    }
    return ret;
  }

  if (singleType === 'i8') {
    if (slab.subarray || slab.slice) {
      HEAPU8.set(slab, ret);
    } else {
      HEAPU8.set(new Uint8Array(slab), ret);
    }
    return ret;
  }

  var i = 0, type, typeSize, previousType;
  while (i < size) {
    var curr = slab[i];

    if (typeof curr === 'function') {
      curr = Runtime.getFunctionIndex(curr);
    }

    type = singleType || types[i];
    if (type === 0) {
      i++;
      continue;
    }

    if (type == 'i64') type = 'i32'; // special case: we have one i32 here, and one i32 later

    setValue(ret+i, curr, type);

    // no need to look up size unless type changes, so cache it
    if (previousType !== type) {
      typeSize = Runtime.getNativeTypeSize(type);
      previousType = type;
    }
    i += typeSize;
  }

  return ret;
}
Module["allocate"] = allocate;

// Allocate memory during any stage of startup - static memory early on, dynamic memory later, malloc when ready
function getMemory(size) {
  if (!staticSealed) return Runtime.staticAlloc(size);
  if (!runtimeInitialized) return Runtime.dynamicAlloc(size);
  return _malloc(size);
}
Module["getMemory"] = getMemory;

function Pointer_stringify(ptr, /* optional */ length) {
  if (length === 0 || !ptr) return '';
  // TODO: use TextDecoder
  // Find the length, and check for UTF while doing so
  var hasUtf = 0;
  var t;
  var i = 0;
  while (1) {
    t = HEAPU8[(((ptr)+(i))>>0)];
    hasUtf |= t;
    if (t == 0 && !length) break;
    i++;
    if (length && i == length) break;
  }
  if (!length) length = i;

  var ret = '';

  if (hasUtf < 128) {
    var MAX_CHUNK = 1024; // split up into chunks, because .apply on a huge string can overflow the stack
    var curr;
    while (length > 0) {
      curr = String.fromCharCode.apply(String, HEAPU8.subarray(ptr, ptr + Math.min(length, MAX_CHUNK)));
      ret = ret ? ret + curr : curr;
      ptr += MAX_CHUNK;
      length -= MAX_CHUNK;
    }
    return ret;
  }
  return Module['UTF8ToString'](ptr);
}
Module["Pointer_stringify"] = Pointer_stringify;

// Given a pointer 'ptr' to a null-terminated ASCII-encoded string in the emscripten HEAP, returns
// a copy of that string as a Javascript String object.

function AsciiToString(ptr) {
  var str = '';
  while (1) {
    var ch = HEAP8[((ptr++)>>0)];
    if (!ch) return str;
    str += String.fromCharCode(ch);
  }
}
Module["AsciiToString"] = AsciiToString;

// Copies the given Javascript String object 'str' to the emscripten HEAP at address 'outPtr',
// null-terminated and encoded in ASCII form. The copy will require at most str.length+1 bytes of space in the HEAP.

function stringToAscii(str, outPtr) {
  return writeAsciiToMemory(str, outPtr, false);
}
Module["stringToAscii"] = stringToAscii;

// Given a pointer 'ptr' to a null-terminated UTF8-encoded string in the given array that contains uint8 values, returns
// a copy of that string as a Javascript String object.

var UTF8Decoder = typeof TextDecoder !== 'undefined' ? new TextDecoder('utf8') : undefined;
function UTF8ArrayToString(u8Array, idx) {
  var endPtr = idx;
  // TextDecoder needs to know the byte length in advance, it doesn't stop on null terminator by itself.
  // Also, use the length info to avoid running tiny strings through TextDecoder, since .subarray() allocates garbage.
  while (u8Array[endPtr]) ++endPtr;

  if (endPtr - idx > 16 && u8Array.subarray && UTF8Decoder) {
    return UTF8Decoder.decode(u8Array.subarray(idx, endPtr));
  } else {
    var u0, u1, u2, u3, u4, u5;

    var str = '';
    while (1) {
      // For UTF8 byte structure, see http://en.wikipedia.org/wiki/UTF-8#Description and https://www.ietf.org/rfc/rfc2279.txt and https://tools.ietf.org/html/rfc3629
      u0 = u8Array[idx++];
      if (!u0) return str;
      if (!(u0 & 0x80)) { str += String.fromCharCode(u0); continue; }
      u1 = u8Array[idx++] & 63;
      if ((u0 & 0xE0) == 0xC0) { str += String.fromCharCode(((u0 & 31) << 6) | u1); continue; }
      u2 = u8Array[idx++] & 63;
      if ((u0 & 0xF0) == 0xE0) {
        u0 = ((u0 & 15) << 12) | (u1 << 6) | u2;
      } else {
        u3 = u8Array[idx++] & 63;
        if ((u0 & 0xF8) == 0xF0) {
          u0 = ((u0 & 7) << 18) | (u1 << 12) | (u2 << 6) | u3;
        } else {
          u4 = u8Array[idx++] & 63;
          if ((u0 & 0xFC) == 0xF8) {
            u0 = ((u0 & 3) << 24) | (u1 << 18) | (u2 << 12) | (u3 << 6) | u4;
          } else {
            u5 = u8Array[idx++] & 63;
            u0 = ((u0 & 1) << 30) | (u1 << 24) | (u2 << 18) | (u3 << 12) | (u4 << 6) | u5;
          }
        }
      }
      if (u0 < 0x10000) {
        str += String.fromCharCode(u0);
      } else {
        var ch = u0 - 0x10000;
        str += String.fromCharCode(0xD800 | (ch >> 10), 0xDC00 | (ch & 0x3FF));
      }
    }
  }
}
Module["UTF8ArrayToString"] = UTF8ArrayToString;

// Given a pointer 'ptr' to a null-terminated UTF8-encoded string in the emscripten HEAP, returns
// a copy of that string as a Javascript String object.

function UTF8ToString(ptr) {
  return UTF8ArrayToString(HEAPU8,ptr);
}
Module["UTF8ToString"] = UTF8ToString;

// Copies the given Javascript String object 'str' to the given byte array at address 'outIdx',
// encoded in UTF8 form and null-terminated. The copy will require at most str.length*4+1 bytes of space in the HEAP.
// Use the function lengthBytesUTF8 to compute the exact number of bytes (excluding null terminator) that this function will write.
// Parameters:
//   str: the Javascript string to copy.
//   outU8Array: the array to copy to. Each index in this array is assumed to be one 8-byte element.
//   outIdx: The starting offset in the array to begin the copying.
//   maxBytesToWrite: The maximum number of bytes this function can write to the array. This count should include the null
//                    terminator, i.e. if maxBytesToWrite=1, only the null terminator will be written and nothing else.
//                    maxBytesToWrite=0 does not write any bytes to the output, not even the null terminator.
// Returns the number of bytes written, EXCLUDING the null terminator.

function stringToUTF8Array(str, outU8Array, outIdx, maxBytesToWrite) {
  if (!(maxBytesToWrite > 0)) // Parameter maxBytesToWrite is not optional. Negative values, 0, null, undefined and false each don't write out any bytes.
    return 0;

  var startIdx = outIdx;
  var endIdx = outIdx + maxBytesToWrite - 1; // -1 for string null terminator.
  for (var i = 0; i < str.length; ++i) {
    // Gotcha: charCodeAt returns a 16-bit word that is a UTF-16 encoded code unit, not a Unicode code point of the character! So decode UTF16->UTF32->UTF8.
    // See http://unicode.org/faq/utf_bom.html#utf16-3
    // For UTF8 byte structure, see http://en.wikipedia.org/wiki/UTF-8#Description and https://www.ietf.org/rfc/rfc2279.txt and https://tools.ietf.org/html/rfc3629
    var u = str.charCodeAt(i); // possibly a lead surrogate
    if (u >= 0xD800 && u <= 0xDFFF) u = 0x10000 + ((u & 0x3FF) << 10) | (str.charCodeAt(++i) & 0x3FF);
    if (u <= 0x7F) {
      if (outIdx >= endIdx) break;
      outU8Array[outIdx++] = u;
    } else if (u <= 0x7FF) {
      if (outIdx + 1 >= endIdx) break;
      outU8Array[outIdx++] = 0xC0 | (u >> 6);
      outU8Array[outIdx++] = 0x80 | (u & 63);
    } else if (u <= 0xFFFF) {
      if (outIdx + 2 >= endIdx) break;
      outU8Array[outIdx++] = 0xE0 | (u >> 12);
      outU8Array[outIdx++] = 0x80 | ((u >> 6) & 63);
      outU8Array[outIdx++] = 0x80 | (u & 63);
    } else if (u <= 0x1FFFFF) {
      if (outIdx + 3 >= endIdx) break;
      outU8Array[outIdx++] = 0xF0 | (u >> 18);
      outU8Array[outIdx++] = 0x80 | ((u >> 12) & 63);
      outU8Array[outIdx++] = 0x80 | ((u >> 6) & 63);
      outU8Array[outIdx++] = 0x80 | (u & 63);
    } else if (u <= 0x3FFFFFF) {
      if (outIdx + 4 >= endIdx) break;
      outU8Array[outIdx++] = 0xF8 | (u >> 24);
      outU8Array[outIdx++] = 0x80 | ((u >> 18) & 63);
      outU8Array[outIdx++] = 0x80 | ((u >> 12) & 63);
      outU8Array[outIdx++] = 0x80 | ((u >> 6) & 63);
      outU8Array[outIdx++] = 0x80 | (u & 63);
    } else {
      if (outIdx + 5 >= endIdx) break;
      outU8Array[outIdx++] = 0xFC | (u >> 30);
      outU8Array[outIdx++] = 0x80 | ((u >> 24) & 63);
      outU8Array[outIdx++] = 0x80 | ((u >> 18) & 63);
      outU8Array[outIdx++] = 0x80 | ((u >> 12) & 63);
      outU8Array[outIdx++] = 0x80 | ((u >> 6) & 63);
      outU8Array[outIdx++] = 0x80 | (u & 63);
    }
  }
  // Null-terminate the pointer to the buffer.
  outU8Array[outIdx] = 0;
  return outIdx - startIdx;
}
Module["stringToUTF8Array"] = stringToUTF8Array;

// Copies the given Javascript String object 'str' to the emscripten HEAP at address 'outPtr',
// null-terminated and encoded in UTF8 form. The copy will require at most str.length*4+1 bytes of space in the HEAP.
// Use the function lengthBytesUTF8 to compute the exact number of bytes (excluding null terminator) that this function will write.
// Returns the number of bytes written, EXCLUDING the null terminator.

function stringToUTF8(str, outPtr, maxBytesToWrite) {
  return stringToUTF8Array(str, HEAPU8,outPtr, maxBytesToWrite);
}
Module["stringToUTF8"] = stringToUTF8;

// Returns the number of bytes the given Javascript string takes if encoded as a UTF8 byte array, EXCLUDING the null terminator byte.

function lengthBytesUTF8(str) {
  var len = 0;
  for (var i = 0; i < str.length; ++i) {
    // Gotcha: charCodeAt returns a 16-bit word that is a UTF-16 encoded code unit, not a Unicode code point of the character! So decode UTF16->UTF32->UTF8.
    // See http://unicode.org/faq/utf_bom.html#utf16-3
    var u = str.charCodeAt(i); // possibly a lead surrogate
    if (u >= 0xD800 && u <= 0xDFFF) u = 0x10000 + ((u & 0x3FF) << 10) | (str.charCodeAt(++i) & 0x3FF);
    if (u <= 0x7F) {
      ++len;
    } else if (u <= 0x7FF) {
      len += 2;
    } else if (u <= 0xFFFF) {
      len += 3;
    } else if (u <= 0x1FFFFF) {
      len += 4;
    } else if (u <= 0x3FFFFFF) {
      len += 5;
    } else {
      len += 6;
    }
  }
  return len;
}
Module["lengthBytesUTF8"] = lengthBytesUTF8;

// Given a pointer 'ptr' to a null-terminated UTF16LE-encoded string in the emscripten HEAP, returns
// a copy of that string as a Javascript String object.

var UTF16Decoder = typeof TextDecoder !== 'undefined' ? new TextDecoder('utf-16le') : undefined;
function UTF16ToString(ptr) {
  var endPtr = ptr;
  // TextDecoder needs to know the byte length in advance, it doesn't stop on null terminator by itself.
  // Also, use the length info to avoid running tiny strings through TextDecoder, since .subarray() allocates garbage.
  var idx = endPtr >> 1;
  while (HEAP16[idx]) ++idx;
  endPtr = idx << 1;

  if (endPtr - ptr > 32 && UTF16Decoder) {
    return UTF16Decoder.decode(HEAPU8.subarray(ptr, endPtr));
  } else {
    var i = 0;

    var str = '';
    while (1) {
      var codeUnit = HEAP16[(((ptr)+(i*2))>>1)];
      if (codeUnit == 0) return str;
      ++i;
      // fromCharCode constructs a character from a UTF-16 code unit, so we can pass the UTF16 string right through.
      str += String.fromCharCode(codeUnit);
    }
  }
}


// Copies the given Javascript String object 'str' to the emscripten HEAP at address 'outPtr',
// null-terminated and encoded in UTF16 form. The copy will require at most str.length*4+2 bytes of space in the HEAP.
// Use the function lengthBytesUTF16() to compute the exact number of bytes (excluding null terminator) that this function will write.
// Parameters:
//   str: the Javascript string to copy.
//   outPtr: Byte address in Emscripten HEAP where to write the string to.
//   maxBytesToWrite: The maximum number of bytes this function can write to the array. This count should include the null
//                    terminator, i.e. if maxBytesToWrite=2, only the null terminator will be written and nothing else.
//                    maxBytesToWrite<2 does not write any bytes to the output, not even the null terminator.
// Returns the number of bytes written, EXCLUDING the null terminator.

function stringToUTF16(str, outPtr, maxBytesToWrite) {
  // Backwards compatibility: if max bytes is not specified, assume unsafe unbounded write is allowed.
  if (maxBytesToWrite === undefined) {
    maxBytesToWrite = 0x7FFFFFFF;
  }
  if (maxBytesToWrite < 2) return 0;
  maxBytesToWrite -= 2; // Null terminator.
  var startPtr = outPtr;
  var numCharsToWrite = (maxBytesToWrite < str.length*2) ? (maxBytesToWrite / 2) : str.length;
  for (var i = 0; i < numCharsToWrite; ++i) {
    // charCodeAt returns a UTF-16 encoded code unit, so it can be directly written to the HEAP.
    var codeUnit = str.charCodeAt(i); // possibly a lead surrogate
    HEAP16[((outPtr)>>1)]=codeUnit;
    outPtr += 2;
  }
  // Null-terminate the pointer to the HEAP.
  HEAP16[((outPtr)>>1)]=0;
  return outPtr - startPtr;
}


// Returns the number of bytes the given Javascript string takes if encoded as a UTF16 byte array, EXCLUDING the null terminator byte.

function lengthBytesUTF16(str) {
  return str.length*2;
}


function UTF32ToString(ptr) {
  var i = 0;

  var str = '';
  while (1) {
    var utf32 = HEAP32[(((ptr)+(i*4))>>2)];
    if (utf32 == 0)
      return str;
    ++i;
    // Gotcha: fromCharCode constructs a character from a UTF-16 encoded code (pair), not from a Unicode code point! So encode the code point to UTF-16 for constructing.
    // See http://unicode.org/faq/utf_bom.html#utf16-3
    if (utf32 >= 0x10000) {
      var ch = utf32 - 0x10000;
      str += String.fromCharCode(0xD800 | (ch >> 10), 0xDC00 | (ch & 0x3FF));
    } else {
      str += String.fromCharCode(utf32);
    }
  }
}


// Copies the given Javascript String object 'str' to the emscripten HEAP at address 'outPtr',
// null-terminated and encoded in UTF32 form. The copy will require at most str.length*4+4 bytes of space in the HEAP.
// Use the function lengthBytesUTF32() to compute the exact number of bytes (excluding null terminator) that this function will write.
// Parameters:
//   str: the Javascript string to copy.
//   outPtr: Byte address in Emscripten HEAP where to write the string to.
//   maxBytesToWrite: The maximum number of bytes this function can write to the array. This count should include the null
//                    terminator, i.e. if maxBytesToWrite=4, only the null terminator will be written and nothing else.
//                    maxBytesToWrite<4 does not write any bytes to the output, not even the null terminator.
// Returns the number of bytes written, EXCLUDING the null terminator.

function stringToUTF32(str, outPtr, maxBytesToWrite) {
  // Backwards compatibility: if max bytes is not specified, assume unsafe unbounded write is allowed.
  if (maxBytesToWrite === undefined) {
    maxBytesToWrite = 0x7FFFFFFF;
  }
  if (maxBytesToWrite < 4) return 0;
  var startPtr = outPtr;
  var endPtr = startPtr + maxBytesToWrite - 4;
  for (var i = 0; i < str.length; ++i) {
    // Gotcha: charCodeAt returns a 16-bit word that is a UTF-16 encoded code unit, not a Unicode code point of the character! We must decode the string to UTF-32 to the heap.
    // See http://unicode.org/faq/utf_bom.html#utf16-3
    var codeUnit = str.charCodeAt(i); // possibly a lead surrogate
    if (codeUnit >= 0xD800 && codeUnit <= 0xDFFF) {
      var trailSurrogate = str.charCodeAt(++i);
      codeUnit = 0x10000 + ((codeUnit & 0x3FF) << 10) | (trailSurrogate & 0x3FF);
    }
    HEAP32[((outPtr)>>2)]=codeUnit;
    outPtr += 4;
    if (outPtr + 4 > endPtr) break;
  }
  // Null-terminate the pointer to the HEAP.
  HEAP32[((outPtr)>>2)]=0;
  return outPtr - startPtr;
}


// Returns the number of bytes the given Javascript string takes if encoded as a UTF16 byte array, EXCLUDING the null terminator byte.

function lengthBytesUTF32(str) {
  var len = 0;
  for (var i = 0; i < str.length; ++i) {
    // Gotcha: charCodeAt returns a 16-bit word that is a UTF-16 encoded code unit, not a Unicode code point of the character! We must decode the string to UTF-32 to the heap.
    // See http://unicode.org/faq/utf_bom.html#utf16-3
    var codeUnit = str.charCodeAt(i);
    if (codeUnit >= 0xD800 && codeUnit <= 0xDFFF) ++i; // possibly a lead surrogate, so skip over the tail surrogate.
    len += 4;
  }

  return len;
}


function demangle(func) {
  var __cxa_demangle_func = Module['___cxa_demangle'] || Module['__cxa_demangle'];
  if (__cxa_demangle_func) {
    try {
      var s =
        func.substr(1);
      var len = lengthBytesUTF8(s)+1;
      var buf = _malloc(len);
      stringToUTF8(s, buf, len);
      var status = _malloc(4);
      var ret = __cxa_demangle_func(buf, 0, 0, status);
      if (getValue(status, 'i32') === 0 && ret) {
        return Pointer_stringify(ret);
      }
      // otherwise, libcxxabi failed
    } catch(e) {
      // ignore problems here
    } finally {
      if (buf) _free(buf);
      if (status) _free(status);
      if (ret) _free(ret);
    }
    // failure when using libcxxabi, don't demangle
    return func;
  }
  Runtime.warnOnce('warning: build with  -s DEMANGLE_SUPPORT=1  to link in libcxxabi demangling');
  return func;
}

function demangleAll(text) {
  var regex =
    /__Z[\w\d_]+/g;
  return text.replace(regex,
    function(x) {
      var y = demangle(x);
      return x === y ? x : (x + ' [' + y + ']');
    });
}

function jsStackTrace() {
  var err = new Error();
  if (!err.stack) {
    // IE10+ special cases: It does have callstack info, but it is only populated if an Error object is thrown,
    // so try that as a special-case.
    try {
      throw new Error(0);
    } catch(e) {
      err = e;
    }
    if (!err.stack) {
      return '(no stack trace available)';
    }
  }
  return err.stack.toString();
}

function stackTrace() {
  var js = jsStackTrace();
  if (Module['extraStackTrace']) js += '\n' + Module['extraStackTrace']();
  return demangleAll(js);
}
Module["stackTrace"] = stackTrace;

// Memory management

var PAGE_SIZE = 4096;

function alignMemoryPage(x) {
  if (x % 4096 > 0) {
    x += (4096 - (x % 4096));
  }
  return x;
}

var HEAP;
var buffer;
var HEAP8, HEAPU8, HEAP16, HEAPU16, HEAP32, HEAPU32, HEAPF32, HEAPF64;

function updateGlobalBuffer(buf) {
  Module['buffer'] = buffer = buf;
}

function updateGlobalBufferViews() {
  Module['HEAP8'] = HEAP8 = new Int8Array(buffer);
  Module['HEAP16'] = HEAP16 = new Int16Array(buffer);
  Module['HEAP32'] = HEAP32 = new Int32Array(buffer);
  Module['HEAPU8'] = HEAPU8 = new Uint8Array(buffer);
  Module['HEAPU16'] = HEAPU16 = new Uint16Array(buffer);
  Module['HEAPU32'] = HEAPU32 = new Uint32Array(buffer);
  Module['HEAPF32'] = HEAPF32 = new Float32Array(buffer);
  Module['HEAPF64'] = HEAPF64 = new Float64Array(buffer);
}

var STATIC_BASE, STATICTOP, staticSealed; // static area
var STACK_BASE, STACKTOP, STACK_MAX; // stack area
var DYNAMIC_BASE, DYNAMICTOP_PTR; // dynamic area handled by sbrk

  STATIC_BASE = STATICTOP = STACK_BASE = STACKTOP = STACK_MAX = DYNAMIC_BASE = DYNAMICTOP_PTR = 0;
  staticSealed = false;



function abortOnCannotGrowMemory() {
  abort('Cannot enlarge memory arrays. Either (1) compile with  -s TOTAL_MEMORY=X  with X higher than the current value ' + TOTAL_MEMORY + ', (2) compile with  -s ALLOW_MEMORY_GROWTH=1  which adjusts the size at runtime but prevents some optimizations, (3) set Module.TOTAL_MEMORY to a higher value before the program runs, or if you want malloc to return NULL (0) instead of this abort, compile with  -s ABORTING_MALLOC=0 ');
}


function enlargeMemory() {
  abortOnCannotGrowMemory();
}


var TOTAL_STACK = Module['TOTAL_STACK'] || 5242880;
var TOTAL_MEMORY = Module['TOTAL_MEMORY'] || 16777216;

var WASM_PAGE_SIZE = 64 * 1024;

var totalMemory = WASM_PAGE_SIZE;
while (totalMemory < TOTAL_MEMORY || totalMemory < 2*TOTAL_STACK) {
  if (totalMemory < 16*1024*1024) {
    totalMemory *= 2;
  } else {
    totalMemory += 16*1024*1024;
  }
}
if (totalMemory !== TOTAL_MEMORY) {
  TOTAL_MEMORY = totalMemory;
}

// Initialize the runtime's memory



// Use a provided buffer, if there is one, or else allocate a new one
if (Module['buffer']) {
  buffer = Module['buffer'];
} else {
  // Use a WebAssembly memory where available
  {
    buffer = new ArrayBuffer(TOTAL_MEMORY);
  }
}
updateGlobalBufferViews();


function getTotalMemory() {
  return TOTAL_MEMORY;
}

// Endianness check (note: assumes compiler arch was little-endian)
  HEAP32[0] = 0x63736d65; /* 'emsc' */
HEAP16[1] = 0x6373;
if (HEAPU8[2] !== 0x73 || HEAPU8[3] !== 0x63) throw 'Runtime error: expected the system to be little-endian!';

Module['HEAP'] = HEAP;
Module['buffer'] = buffer;
Module['HEAP8'] = HEAP8;
Module['HEAP16'] = HEAP16;
Module['HEAP32'] = HEAP32;
Module['HEAPU8'] = HEAPU8;
Module['HEAPU16'] = HEAPU16;
Module['HEAPU32'] = HEAPU32;
Module['HEAPF32'] = HEAPF32;
Module['HEAPF64'] = HEAPF64;

function callRuntimeCallbacks(callbacks) {
  while(callbacks.length > 0) {
    var callback = callbacks.shift();
    if (typeof callback == 'function') {
      callback();
      continue;
    }
    var func = callback.func;
    if (typeof func === 'number') {
      if (callback.arg === undefined) {
        Module['dynCall_v'](func);
      } else {
        Module['dynCall_vi'](func, callback.arg);
      }
    } else {
      func(callback.arg === undefined ? null : callback.arg);
    }
  }
}

var __ATPRERUN__  = []; // functions called before the runtime is initialized
var __ATINIT__    = []; // functions called during startup
var __ATMAIN__    = []; // functions called when main() is to be run
var __ATEXIT__    = []; // functions called during shutdown
var __ATPOSTRUN__ = []; // functions called after the runtime has exited

var runtimeInitialized = false;
var runtimeExited = false;


function preRun() {
  // compatibility - merge in anything from Module['preRun'] at this time
  if (Module['preRun']) {
    if (typeof Module['preRun'] == 'function') Module['preRun'] = [Module['preRun']];
    while (Module['preRun'].length) {
      addOnPreRun(Module['preRun'].shift());
    }
  }
  callRuntimeCallbacks(__ATPRERUN__);
}

function ensureInitRuntime() {
  if (runtimeInitialized) return;
  runtimeInitialized = true;
  callRuntimeCallbacks(__ATINIT__);
}

function preMain() {
  callRuntimeCallbacks(__ATMAIN__);
}

function exitRuntime() {
  callRuntimeCallbacks(__ATEXIT__);
  runtimeExited = true;
}

function postRun() {
  // compatibility - merge in anything from Module['postRun'] at this time
  if (Module['postRun']) {
    if (typeof Module['postRun'] == 'function') Module['postRun'] = [Module['postRun']];
    while (Module['postRun'].length) {
      addOnPostRun(Module['postRun'].shift());
    }
  }
  callRuntimeCallbacks(__ATPOSTRUN__);
}

function addOnPreRun(cb) {
  __ATPRERUN__.unshift(cb);
}
Module["addOnPreRun"] = addOnPreRun;

function addOnInit(cb) {
  __ATINIT__.unshift(cb);
}
Module["addOnInit"] = addOnInit;

function addOnPreMain(cb) {
  __ATMAIN__.unshift(cb);
}
Module["addOnPreMain"] = addOnPreMain;

function addOnExit(cb) {
  __ATEXIT__.unshift(cb);
}
Module["addOnExit"] = addOnExit;

function addOnPostRun(cb) {
  __ATPOSTRUN__.unshift(cb);
}
Module["addOnPostRun"] = addOnPostRun;

// Tools


function intArrayFromString(stringy, dontAddNull, length /* optional */) {
  var len = length > 0 ? length : lengthBytesUTF8(stringy)+1;
  var u8array = new Array(len);
  var numBytesWritten = stringToUTF8Array(stringy, u8array, 0, u8array.length);
  if (dontAddNull) u8array.length = numBytesWritten;
  return u8array;
}
Module["intArrayFromString"] = intArrayFromString;

function intArrayToString(array) {
  var ret = [];
  for (var i = 0; i < array.length; i++) {
    var chr = array[i];
    if (chr > 0xFF) {
      chr &= 0xFF;
    }
    ret.push(String.fromCharCode(chr));
  }
  return ret.join('');
}
Module["intArrayToString"] = intArrayToString;

// Deprecated: This function should not be called because it is unsafe and does not provide
// a maximum length limit of how many bytes it is allowed to write. Prefer calling the
// function stringToUTF8Array() instead, which takes in a maximum length that can be used
// to be secure from out of bounds writes.
function writeStringToMemory(string, buffer, dontAddNull) {
  Runtime.warnOnce('writeStringToMemory is deprecated and should not be called! Use stringToUTF8() instead!');

  var lastChar, end;
  if (dontAddNull) {
    // stringToUTF8Array always appends null. If we don't want to do that, remember the
    // character that existed at the location where the null will be placed, and restore
    // that after the write (below).
    end = buffer + lengthBytesUTF8(string);
    lastChar = HEAP8[end];
  }
  stringToUTF8(string, buffer, Infinity);
  if (dontAddNull) HEAP8[end] = lastChar; // Restore the value under the null character.
}
Module["writeStringToMemory"] = writeStringToMemory;

function writeArrayToMemory(array, buffer) {
  HEAP8.set(array, buffer);
}
Module["writeArrayToMemory"] = writeArrayToMemory;

function writeAsciiToMemory(str, buffer, dontAddNull) {
  for (var i = 0; i < str.length; ++i) {
    HEAP8[((buffer++)>>0)]=str.charCodeAt(i);
  }
  // Null-terminate the pointer to the HEAP.
  if (!dontAddNull) HEAP8[((buffer)>>0)]=0;
}
Module["writeAsciiToMemory"] = writeAsciiToMemory;

function unSign(value, bits, ignore) {
  if (value >= 0) {
    return value;
  }
  return bits <= 32 ? 2*Math.abs(1 << (bits-1)) + value // Need some trickery, since if bits == 32, we are right at the limit of the bits JS uses in bitshifts
                    : Math.pow(2, bits)         + value;
}
function reSign(value, bits, ignore) {
  if (value <= 0) {
    return value;
  }
  var half = bits <= 32 ? Math.abs(1 << (bits-1)) // abs is needed if bits == 32
                        : Math.pow(2, bits-1);
  if (value >= half && (bits <= 32 || value > half)) { // for huge values, we can hit the precision limit and always get true here. so don't do that
                                                       // but, in general there is no perfect solution here. With 64-bit ints, we get rounding and errors
                                                       // TODO: In i64 mode 1, resign the two parts separately and safely
    value = -2*half + value; // Cannot bitshift half, as it may be at the limit of the bits JS uses in bitshifts
  }
  return value;
}


// check for imul support, and also for correctness ( https://bugs.webkit.org/show_bug.cgi?id=126345 )
if (!Math['imul'] || Math['imul'](0xffffffff, 5) !== -5) Math['imul'] = function imul(a, b) {
  var ah  = a >>> 16;
  var al = a & 0xffff;
  var bh  = b >>> 16;
  var bl = b & 0xffff;
  return (al*bl + ((ah*bl + al*bh) << 16))|0;
};
Math.imul = Math['imul'];


if (!Math['clz32']) Math['clz32'] = function(x) {
  x = x >>> 0;
  for (var i = 0; i < 32; i++) {
    if (x & (1 << (31 - i))) return i;
  }
  return 32;
};
Math.clz32 = Math['clz32']

if (!Math['trunc']) Math['trunc'] = function(x) {
  return x < 0 ? Math.ceil(x) : Math.floor(x);
};
Math.trunc = Math['trunc'];

var Math_abs = Math.abs;
var Math_cos = Math.cos;
var Math_sin = Math.sin;
var Math_tan = Math.tan;
var Math_acos = Math.acos;
var Math_asin = Math.asin;
var Math_atan = Math.atan;
var Math_atan2 = Math.atan2;
var Math_exp = Math.exp;
var Math_log = Math.log;
var Math_sqrt = Math.sqrt;
var Math_ceil = Math.ceil;
var Math_floor = Math.floor;
var Math_pow = Math.pow;
var Math_imul = Math.imul;
var Math_fround = Math.fround;
var Math_round = Math.round;
var Math_min = Math.min;
var Math_clz32 = Math.clz32;
var Math_trunc = Math.trunc;

// A counter of dependencies for calling run(). If we need to
// do asynchronous work before running, increment this and
// decrement it. Incrementing must happen in a place like
// PRE_RUN_ADDITIONS (used by emcc to add file preloading).
// Note that you can add dependencies in preRun, even though
// it happens right before run - run will be postponed until
// the dependencies are met.
var runDependencies = 0;
var runDependencyWatcher = null;
var dependenciesFulfilled = null; // overridden to take different actions when all run dependencies are fulfilled

function getUniqueRunDependency(id) {
  return id;
}

function addRunDependency(id) {
  runDependencies++;
  if (Module['monitorRunDependencies']) {
    Module['monitorRunDependencies'](runDependencies);
  }
}
Module["addRunDependency"] = addRunDependency;

function removeRunDependency(id) {
  runDependencies--;
  if (Module['monitorRunDependencies']) {
    Module['monitorRunDependencies'](runDependencies);
  }
  if (runDependencies == 0) {
    if (runDependencyWatcher !== null) {
      clearInterval(runDependencyWatcher);
      runDependencyWatcher = null;
    }
    if (dependenciesFulfilled) {
      var callback = dependenciesFulfilled;
      dependenciesFulfilled = null;
      callback(); // can add another dependenciesFulfilled
    }
  }
}
Module["removeRunDependency"] = removeRunDependency;

Module["preloadedImages"] = {}; // maps url to image data
Module["preloadedAudios"] = {}; // maps url to audio data



var memoryInitializer = null;






// === Body ===

var ASM_CONSTS = [];




STATIC_BASE = 8;

STATICTOP = STATIC_BASE + 8320;
  /* global initializers */  __ATINIT__.push({ func: function() { __GLOBAL__sub_I_em_cpp() } }, { func: function() { __GLOBAL__sub_I_bind_cpp() } });
  

/* memory initializer */ allocate([160,4,0,0,219,5,0,0,200,4,0,0,203,5,0,0,8,0,0,0,0,0,0,0,32,5,0,0,233,5,0,0,0,0,0,0,16,0,0,0,32,5,0,0,250,5,0,0,1,0,0,0,16,0,0,0,160,4,0,0,41,6,0,0,160,4,0,0,47,6,0,0,160,4,0,0,151,6,0,0,60,5,0,0,98,6,0,0,0,0,0,0,1,0,0,0,80,0,0,0,0,0,0,0,60,5,0,0,53,6,0,0,0,0,0,0,1,0,0,0,88,0,0,0,0,0,0,0,60,5,0,0,241,6,0,0,0,0,0,0,1,0,0,0,80,0,0,0,0,0,0,0,60,5,0,0,199,6,0,0,0,0,0,0,1,0,0,0,136,0,0,0,0,0,0,0,160,4,0,0,35,7,0,0,160,4,0,0,60,7,0,0,32,5,0,0,96,7,0,0,0,0,0,0,112,0,0,0,32,5,0,0,142,7,0,0,1,0,0,0,112,0,0,0,160,4,0,0,195,7,0,0,32,5,0,0,225,7,0,0,0,0,0,0,160,0,0,0,32,5,0,0,12,8,0,0,1,0,0,0,160,0,0,0,160,4,0,0,78,10,0,0,160,4,0,0,141,10,0,0,160,4,0,0,203,10,0,0,160,4,0,0,17,11,0,0,160,4,0,0,78,11,0,0,160,4,0,0,109,11,0,0,160,4,0,0,140,11,0,0,160,4,0,0,171,11,0,0,160,4,0,0,202,11,0,0,160,4,0,0,233,11,0,0,160,4,0,0,8,12,0,0,160,4,0,0,69,12,0,0,60,5,0,0,100,12,0,0,0,0,0,0,1,0,0,0,136,1,0,0,0,0,0,0,160,4,0,0,163,12,0,0,60,5,0,0,201,12,0,0,0,0,0,0,1,0,0,0,136,1,0,0,0,0,0,0,60,5,0,0,8,13,0,0,0,0,0,0,1,0,0,0,136,1,0,0,0,0,0,0,160,4,0,0,38,24,0,0,200,4,0,0,134,24,0,0,216,1,0,0,0,0,0,0,200,4,0,0,51,24,0,0,232,1,0,0,0,0,0,0,160,4,0,0,84,24,0,0,200,4,0,0,97,24,0,0,200,1,0,0,0,0,0,0,200,4,0,0,119,25,0,0,192,1,0,0,0,0,0,0,200,4,0,0,168,25,0,0,216,1,0,0,0,0,0,0,200,4,0,0,132,25,0,0,16,2,0,0,0,0,0,0,200,4,0,0,202,25,0,0,216,1,0,0,0,0,0,0,4,5,0,0,242,25,0,0,4,5,0,0,244,25,0,0,4,5,0,0,247,25,0,0,4,5,0,0,249,25,0,0,4,5,0,0,251,25,0,0,4,5,0,0,253,25,0,0,4,5,0,0,255,25,0,0,4,5,0,0,1,26,0,0,4,5,0,0,3,26,0,0,4,5,0,0,5,26,0,0,4,5,0,0,7,26,0,0,4,5,0,0,9,26,0,0,4,5,0,0,11,26,0,0,4,5,0,0,13,26,0,0,200,4,0,0,15,26,0,0,200,1,0,0,0,0,0,0,32,0,0,0,160,2,0,0,128,2,0,0,160,2,0,0,32,0,0,0,160,2,0,0,128,2,0,0,160,2,0,0,80,2,0,0,32,0,0,0,160,2,0,0,128,2,0,0,160,2,0,0,80,2,0,0,80,2,0,0,64,2,0,0,32,0,0,0,64,0,0,0,72,0,0,0,112,0,0,0,112,0,0,0,32,0,0,0,160,0,0,0,32,0,0,0,200,0,0,0,64,2,0,0,200,0,0,0,184,0,0,0,64,2,0,0,200,0,0,0,136,2,0,0,184,0,0,0,136,2,0,0,216,0,0,0,232,0,0,0,112,0,0,0,136,2,0,0,80,2,0,0,112,0,0,0,136,2,0,0,184,0,0,0,240,0,0,0,64,2,0,0,240,0,0,0,192,0,0,0,64,2,0,0,240,0,0,0,136,2,0,0,192,0,0,0,136,2,0,0,0,1,0,0,232,0,0,0,160,0,0,0,136,2,0,0,80,2,0,0,160,0,0,0,136,2,0,0,192,0,0,0,172,3,0,0,5,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,2,0,0,0,108,28,0,0,0,0,0,0,0,0,0,0,0,0,0,0,2,0,0,0,0,0,0,0,0,0,0,0,0,0,0,255,255,255,255,255,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,5,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,3,0,0,0,2,0,0,0,116,28,0,0,0,4,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,10,255,255,255,255,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,28,4,0,0,1,0,0,0,29,24,0,0,0,0,0,0,200,1,0,0,1,0,0,0,2,0,0,0,3,0,0,0,4,0,0,0,4,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,0,0,0,0,240,1,0,0,1,0,0,0,5,0,0,0,3,0,0,0,4,0,0,0,4,0,0,0,2,0,0,0,2,0,0,0,2,0,0,0,0,0,0,0,0,2,0,0,6,0,0,0,7,0,0,0,2,0,0,0,0,0,0,0,48,2,0,0,1,0,0,0,8,0,0,0,3,0,0,0,4,0,0,0,5,0,0,0,0,0,0,0,32,2,0,0,1,0,0,0,9,0,0,0,3,0,0,0,4,0,0,0,6,0,0,0,0,0,0,0,176,2,0,0,1,0,0,0,10,0,0,0,3,0,0,0,4,0,0,0,4,0,0,0,3,0,0,0,3,0,0,0,3,0,0,0,79,99,116,97,84,101,114,114,97,105,110,0,103,101,110,101,114,97,116,101,0,103,101,116,65,100,100,101,100,0,103,101,116,82,101,109,111,118,101,100,0,103,101,116,75,101,101,112,101,100,0,103,101,116,86,101,114,116,105,99,101,115,0,67,104,117,110,107,73,100,0,118,101,99,51,0,118,101,99,57,0,109,97,116,52,0,67,104,117,110,107,73,100,86,101,99,116,111,114,0,118,101,99,57,86,101,99,116,111,114,0,49,51,101,109,79,99,116,97,84,101,114,114,97,105,110,0,49,49,79,99,116,97,84,101,114,114,97,105,110,0,80,49,51,101,109,79,99,116,97,84,101,114,114,97,105,110,0,80,75,49,51,101,109,79,99,116,97,84,101,114,114,97,105,110,0,105,105,0,118,0,118,105,0,105,105,102,105,102,0,105,105,102,105,102,105,0,105,105,102,105,102,105,105,0,52,118,101,99,51,0,52,109,97,116,52,0,78,83,116,51,95,95,50,54,118,101,99,116,111,114,73,55,67,104,117,110,107,73,100,78,83,95,57,97,108,108,111,99,97,116,111,114,73,83,49,95,69,69,69,69,0,78,83,116,51,95,95,50,49,51,95,95,118,101,99,116,111,114,95,98,97,115,101,73,55,67,104,117,110,107,73,100,78,83,95,57,97,108,108,111,99,97,116,111,114,73,83,49,95,69,69,69,69,0,78,83,116,51,95,95,50,50,48,95,95,118,101,99,116,111,114,95,98,97,115,101,95,99,111,109,109,111,110,73,76,98,49,69,69,69,0,118,105,105,105,105,105,0,105,105,105,0,78,83,116,51,95,95,50,54,118,101,99,116,111,114,73,52,118,101,99,57,78,83,95,57,97,108,108,111,99,97,116,111,114,73,83,49,95,69,69,69,69,0,78,83,116,51,95,95,50,49,51,95,95,118,101,99,116,111,114,95,98,97,115,101,73,52,118,101,99,57,78,83,95,57,97,108,108,111,99,97,116,111,114,73,83,49,95,69,69,69,69,0,55,67,104,117,110,107,73,100,0,105,0,118,105,105,105,0,102,105,105,0,118,105,105,102,0,52,118,101,99,57,0,112,117,115,104,95,98,97,99,107,0,114,101,115,105,122,101,0,115,105,122,101,0,103,101,116,0,115,101,116,0,80,78,83,116,51,95,95,50,54,118,101,99,116,111,114,73,55,67,104,117,110,107,73,100,78,83,95,57,97,108,108,111,99,97,116,111,114,73,83,49,95,69,69,69,69,0,80,75,78,83,116,51,95,95,50,54,118,101,99,116,111,114,73,55,67,104,117,110,107,73,100,78,83,95,57,97,108,108,111,99,97,116,111,114,73,83,49,95,69,69,69,69,0,118,105,105,105,105,0,78,49,48,101,109,115,99,114,105,112,116,101,110,51,118,97,108,69,0,105,105,105,105,0,105,105,105,105,105,0,80,78,83,116,51,95,95,50,54,118,101,99,116,111,114,73,52,118,101,99,57,78,83,95,57,97,108,108,111,99,97,116,111,114,73,83,49,95,69,69,69,69,0,80,75,78,83,116,51,95,95,50,54,118,101,99,116,111,114,73,52,118,101,99,57,78,83,95,57,97,108,108,111,99,97,116,111,114,73,83,49,95,69,69,69,69,0,118,111,105,100,0,98,111,111,108,0,115,116,100,58,58,115,116,114,105,110,103,0,115,116,100,58,58,98,97,115,105,99,95,115,116,114,105,110,103,60,117,110,115,105,103,110,101,100,32,99,104,97,114,62,0,115,116,100,58,58,119,115,116,114,105,110,103,0,101,109,115,99,114,105,112,116,101,110,58,58,118,97,108,0,101,109,115,99,114,105,112,116,101,110,58,58,109,101,109,111,114,121,95,118,105,101,119,60,115,105,103,110,101,100,32,99,104,97,114,62,0,101,109,115,99,114,105,112,116,101,110,58,58,109,101,109,111,114,121,95,118,105,101,119,60,117,110,115,105,103,110,101,100,32,99,104,97,114,62,0,101,109,115,99,114,105,112,116,101,110,58,58,109,101,109,111,114,121,95,118,105,101,119,60,115,104,111,114,116,62,0,101,109,115,99,114,105,112,116,101,110,58,58,109,101,109,111,114,121,95,118,105,101,119,60,117,110,115,105,103,110,101,100,32,115,104,111,114,116,62,0,101,109,115,99,114,105,112,116,101,110,58,58,109,101,109,111,114,121,95,118,105,101,119,60,105,110,116,62,0,101,109,115,99,114,105,112,116,101,110,58,58,109,101,109,111,114,121,95,118,105,101,119,60,117,110,115,105,103,110,101,100,32,105,110,116,62,0,101,109,115,99,114,105,112,116,101,110,58,58,109,101,109,111,114,121,95,118,105,101,119,60,105,110,116,56,95,116,62,0,101,109,115,99,114,105,112,116,101,110,58,58,109,101,109,111,114,121,95,118,105,101,119,60,117,105,110,116,56,95,116,62,0,101,109,115,99,114,105,112,116,101,110,58,58,109,101,109,111,114,121,95,118,105,101,119,60,105,110,116,49,54,95,116,62,0,101,109,115,99,114,105,112,116,101,110,58,58,109,101,109,111,114,121,95,118,105,101,119,60,117,105,110,116,49,54,95,116,62,0,101,109,115,99,114,105,112,116,101,110,58,58,109,101,109,111,114,121,95,118,105,101,119,60,105,110,116,51,50,95,116,62,0,101,109,115,99,114,105,112,116,101,110,58,58,109,101,109,111,114,121,95,118,105,101,119,60,117,105,110,116,51,50,95,116,62,0,101,109,115,99,114,105,112,116,101,110,58,58,109,101,109,111,114,121,95,118,105,101,119,60,108,111,110,103,32,100,111,117,98,108,101,62,0,78,49,48,101,109,115,99,114,105,112,116,101,110,49,49,109,101,109,111,114,121,95,118,105,101,119,73,101,69,69,0,101,109,115,99,114,105,112,116,101,110,58,58,109,101,109,111,114,121,95,118,105,101,119,60,100,111,117,98,108,101,62,0,78,49,48,101,109,115,99,114,105,112,116,101,110,49,49,109,101,109,111,114,121,95,118,105,101,119,73,100,69,69,0,101,109,115,99,114,105,112,116,101,110,58,58,109,101,109,111,114,121,95,118,105,101,119,60,102,108,111,97,116,62,0,78,49,48,101,109,115,99,114,105,112,116,101,110,49,49,109,101,109,111,114,121,95,118,105,101,119,73,102,69,69,0,101,109,115,99,114,105,112,116,101,110,58,58,109,101,109,111,114,121,95,118,105,101,119,60,117,110,115,105,103,110,101,100,32,108,111,110,103,62,0,78,49,48,101,109,115,99,114,105,112,116,101,110,49,49,109,101,109,111,114,121,95,118,105,101,119,73,109,69,69,0,101,109,115,99,114,105,112,116,101,110,58,58,109,101,109,111,114,121,95,118,105,101,119,60,108,111,110,103,62,0,78,49,48,101,109,115,99,114,105,112,116,101,110,49,49,109,101,109,111,114,121,95,118,105,101,119,73,108,69,69,0,78,49,48,101,109,115,99,114,105,112,116,101,110,49,49,109,101,109,111,114,121,95,118,105,101,119,73,106,69,69,0,78,49,48,101,109,115,99,114,105,112,116,101,110,49,49,109,101,109,111,114,121,95,118,105,101,119,73,105,69,69,0,78,49,48,101,109,115,99,114,105,112,116,101,110,49,49,109,101,109,111,114,121,95,118,105,101,119,73,116,69,69,0,78,49,48,101,109,115,99,114,105,112,116,101,110,49,49,109,101,109,111,114,121,95,118,105,101,119,73,115,69,69,0,78,49,48,101,109,115,99,114,105,112,116,101,110,49,49,109,101,109,111,114,121,95,118,105,101,119,73,104,69,69,0,78,49,48,101,109,115,99,114,105,112,116,101,110,49,49,109,101,109,111,114,121,95,118,105,101,119,73,97,69,69,0,101,109,115,99,114,105,112,116,101,110,58,58,109,101,109,111,114,121,95,118,105,101,119,60,99,104,97,114,62,0,78,49,48,101,109,115,99,114,105,112,116,101,110,49,49,109,101,109,111,114,121,95,118,105,101,119,73,99,69,69,0,78,83,116,51,95,95,50,49,50,98,97,115,105,99,95,115,116,114,105,110,103,73,119,78,83,95,49,49,99,104,97,114,95,116,114,97,105,116,115,73,119,69,69,78,83,95,57,97,108,108,111,99,97,116,111,114,73,119,69,69,69,69,0,78,83,116,51,95,95,50,50,49,95,95,98,97,115,105,99,95,115,116,114,105,110,103,95,99,111,109,109,111,110,73,76,98,49,69,69,69,0,78,83,116,51,95,95,50,49,50,98,97,115,105,99,95,115,116,114,105,110,103,73,104,78,83,95,49,49,99,104,97,114,95,116,114,97,105,116,115,73,104,69,69,78,83,95,57,97,108,108,111,99,97,116,111,114,73,104,69,69,69,69,0,78,83,116,51,95,95,50,49,50,98,97,115,105,99,95,115,116,114,105,110,103,73,99,78,83,95,49,49,99,104,97,114,95,116,114,97,105,116,115,73,99,69,69,78,83,95,57,97,108,108,111,99,97,116,111,114,73,99,69,69,69,69,0,100,111,117,98,108,101,0,102,108,111,97,116,0,117,110,115,105,103,110,101,100,32,108,111,110,103,0,108,111,110,103,0,117,110,115,105,103,110,101,100,32,105,110,116,0,105,110,116,0,117,110,115,105,103,110,101,100,32,115,104,111,114,116,0,115,104,111,114,116,0,117,110,115,105,103,110,101,100,32,99,104,97,114,0,115,105,103,110,101,100,32,99,104,97,114,0,99,104,97,114,0,84,33,34,25,13,1,2,3,17,75,28,12,16,4,11,29,18,30,39,104,110,111,112,113,98,32,5,6,15,19,20,21,26,8,22,7,40,36,23,24,9,10,14,27,31,37,35,131,130,125,38,42,43,60,61,62,63,67,71,74,77,88,89,90,91,92,93,94,95,96,97,99,100,101,102,103,105,106,107,108,114,115,116,121,122,123,124,0,73,108,108,101,103,97,108,32,98,121,116,101,32,115,101,113,117,101,110,99,101,0,68,111,109,97,105,110,32,101,114,114,111,114,0,82,101,115,117,108,116,32,110,111,116,32,114,101,112,114,101,115,101,110,116,97,98,108,101,0,78,111,116,32,97,32,116,116,121,0,80,101,114,109,105,115,115,105,111,110,32,100,101,110,105,101,100,0,79,112,101,114,97,116,105,111,110,32,110,111,116,32,112,101,114,109,105,116,116,101,100,0,78,111,32,115,117,99,104,32,102,105,108,101,32,111,114,32,100,105,114,101,99,116,111,114,121,0,78,111,32,115,117,99,104,32,112,114,111,99,101,115,115,0,70,105,108,101,32,101,120,105,115,116,115,0,86,97,108,117,101,32,116,111,111,32,108,97,114,103,101,32,102,111,114,32,100,97,116,97,32,116,121,112,101,0,78,111,32,115,112,97,99,101,32,108,101,102,116,32,111,110,32,100,101,118,105,99,101,0,79,117,116,32,111,102,32,109,101,109,111,114,121,0,82,101,115,111,117,114,99,101,32,98,117,115,121,0,73,110,116,101,114,114,117,112,116,101,100,32,115,121,115,116,101,109,32,99,97,108,108,0,82,101,115,111,117,114,99,101,32,116,101,109,112,111,114,97,114,105,108,121,32,117,110,97,118,97,105,108,97,98,108,101,0,73,110,118,97,108,105,100,32,115,101,101,107,0,67,114,111,115,115,45,100,101,118,105,99,101,32,108,105,110,107,0,82,101,97,100,45,111,110,108,121,32,102,105,108,101,32,115,121,115,116,101,109,0,68,105,114,101,99,116,111,114,121,32,110,111,116,32,101,109,112,116,121,0,67,111,110,110,101,99,116,105,111,110,32,114,101,115,101,116,32,98,121,32,112,101,101,114,0,79,112,101,114,97,116,105,111,110,32,116,105,109,101,100,32,111,117,116,0,67,111,110,110,101,99,116,105,111,110,32,114,101,102,117,115,101,100,0,72,111,115,116,32,105,115,32,100,111,119,110,0,72,111,115,116,32,105,115,32,117,110,114,101,97,99,104,97,98,108,101,0,65,100,100,114,101,115,115,32,105,110,32,117,115,101,0,66,114,111,107,101,110,32,112,105,112,101,0,73,47,79,32,101,114,114,111,114,0,78,111,32,115,117,99,104,32,100,101,118,105,99,101,32,111,114,32,97,100,100,114,101,115,115,0,66,108,111,99,107,32,100,101,118,105,99,101,32,114,101,113,117,105,114,101,100,0,78,111,32,115,117,99,104,32,100,101,118,105,99,101,0,78,111,116,32,97,32,100,105,114,101,99,116,111,114,121,0,73,115,32,97,32,100,105,114,101,99,116,111,114,121,0,84,101,120,116,32,102,105,108,101,32,98,117,115,121,0,69,120,101,99,32,102,111,114,109,97,116,32,101,114,114,111,114,0,73,110,118,97,108,105,100,32,97,114,103,117,109,101,110,116,0,65,114,103,117,109,101,110,116,32,108,105,115,116,32,116,111,111,32,108,111,110,103,0,83,121,109,98,111,108,105,99,32,108,105,110,107,32,108,111,111,112,0,70,105,108,101,110,97,109,101,32,116,111,111,32,108,111,110,103,0,84,111,111,32,109,97,110,121,32,111,112,101,110,32,102,105,108,101,115,32,105,110,32,115,121,115,116,101,109,0,78,111,32,102,105,108,101,32,100,101,115,99,114,105,112,116,111,114,115,32,97,118,97,105,108,97,98,108,101,0,66,97,100,32,102,105,108,101,32,100,101,115,99,114,105,112,116,111,114,0,78,111,32,99,104,105,108,100,32,112,114,111,99,101,115,115,0,66,97,100,32,97,100,100,114,101,115,115,0,70,105,108,101,32,116,111,111,32,108,97,114,103,101,0,84,111,111,32,109,97,110,121,32,108,105,110,107,115,0,78,111,32,108,111,99,107,115,32,97,118,97,105,108,97,98,108,101,0,82,101,115,111,117,114,99,101,32,100,101,97,100,108,111,99,107,32,119,111,117,108,100,32,111,99,99,117,114,0,83,116,97,116,101,32,110,111,116,32,114,101,99,111,118,101,114,97,98,108,101,0,80,114,101,118,105,111,117,115,32,111,119,110,101,114,32,100,105,101,100,0,79,112,101,114,97,116,105,111,110,32,99,97,110,99,101,108,101,100,0,70,117,110,99,116,105,111,110,32,110,111,116,32,105,109,112,108,101,109,101,110,116,101,100,0,78,111,32,109,101,115,115,97,103,101,32,111,102,32,100,101,115,105,114,101,100,32,116,121,112,101,0,73,100,101,110,116,105,102,105,101,114,32,114,101,109,111,118,101,100,0,68,101,118,105,99,101,32,110,111,116,32,97,32,115,116,114,101,97,109,0,78,111,32,100,97,116,97,32,97,118,97,105,108,97,98,108,101,0,68,101,118,105,99,101,32,116,105,109,101,111,117,116,0,79,117,116,32,111,102,32,115,116,114,101,97,109,115,32,114,101,115,111,117,114,99,101,115,0,76,105,110,107,32,104,97,115,32,98,101,101,110,32,115,101,118,101,114,101,100,0,80,114,111,116,111,99,111,108,32,101,114,114,111,114,0,66,97,100,32,109,101,115,115,97,103,101,0,70,105,108,101,32,100,101,115,99,114,105,112,116,111,114,32,105,110,32,98,97,100,32,115,116,97,116,101,0,78,111,116,32,97,32,115,111,99,107,101,116,0,68,101,115,116,105,110,97,116,105,111,110,32,97,100,100,114,101,115,115,32,114,101,113,117,105,114,101,100,0,77,101,115,115,97,103,101,32,116,111,111,32,108,97,114,103,101,0,80,114,111,116,111,99,111,108,32,119,114,111,110,103,32,116,121,112,101,32,102,111,114,32,115,111,99,107,101,116,0,80,114,111,116,111,99,111,108,32,110,111,116,32,97,118,97,105,108,97,98,108,101,0,80,114,111,116,111,99,111,108,32,110,111,116,32,115,117,112,112,111,114,116,101,100,0,83,111,99,107,101,116,32,116,121,112,101,32,110,111,116,32,115,117,112,112,111,114,116,101,100,0,78,111,116,32,115,117,112,112,111,114,116,101,100,0,80,114,111,116,111,99,111,108,32,102,97,109,105,108,121,32,110,111,116,32,115,117,112,112,111,114,116,101,100,0,65,100,100,114,101,115,115,32,102,97,109,105,108,121,32,110,111,116,32,115,117,112,112,111,114,116,101,100,32,98,121,32,112,114,111,116,111,99,111,108,0,65,100,100,114,101,115,115,32,110,111,116,32,97,118,97,105,108,97,98,108,101,0,78,101,116,119,111,114,107,32,105,115,32,100,111,119,110,0,78,101,116,119,111,114,107,32,117,110,114,101,97,99,104,97,98,108,101,0,67,111,110,110,101,99,116,105,111,110,32,114,101,115,101,116,32,98,121,32,110,101,116,119,111,114,107,0,67,111,110,110,101,99,116,105,111,110,32,97,98,111,114,116,101,100,0,78,111,32,98,117,102,102,101,114,32,115,112,97,99,101,32,97,118,97,105,108,97,98,108,101,0,83,111,99,107,101,116,32,105,115,32,99,111,110,110,101,99,116,101,100,0,83,111,99,107,101,116,32,110,111,116,32,99,111,110,110,101,99,116,101,100,0,67,97,110,110,111,116,32,115,101,110,100,32,97,102,116,101,114,32,115,111,99,107,101,116,32,115,104,117,116,100,111,119,110,0,79,112,101,114,97,116,105,111,110,32,97,108,114,101,97,100,121,32,105,110,32,112,114,111,103,114,101,115,115,0,79,112,101,114,97,116,105,111,110,32,105,110,32,112,114,111,103,114,101,115,115,0,83,116,97,108,101,32,102,105,108,101,32,104,97,110,100,108,101,0,82,101,109,111,116,101,32,73,47,79,32,101,114,114,111,114,0,81,117,111,116,97,32,101,120,99,101,101,100,101,100,0,78,111,32,109,101,100,105,117,109,32,102,111,117,110,100,0,87,114,111,110,103,32,109,101,100,105,117,109,32,116,121,112,101,0,78,111,32,101,114,114,111,114,32,105,110,102,111,114,109,97,116,105,111,110,0,0,17,0,10,0,17,17,17,0,0,0,0,5,0,0,0,0,0,0,9,0,0,0,0,11,0,0,0,0,0,0,0,0,17,0,15,10,17,17,17,3,10,7,0,1,19,9,11,11,0,0,9,6,11,0,0,11,0,6,17,0,0,0,17,17,17,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,11,0,0,0,0,0,0,0,0,17,0,10,10,17,17,17,0,10,0,0,2,0,9,11,0,0,0,9,0,11,0,0,11,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,12,0,0,0,0,0,0,0,0,0,0,0,12,0,0,0,0,12,0,0,0,0,9,12,0,0,0,0,0,12,0,0,12,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,14,0,0,0,0,0,0,0,0,0,0,0,13,0,0,0,4,13,0,0,0,0,9,14,0,0,0,0,0,14,0,0,14,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,16,0,0,0,0,0,0,0,0,0,0,0,15,0,0,0,0,15,0,0,0,0,9,16,0,0,0,0,0,16,0,0,16,0,0,18,0,0,0,18,18,18,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,18,0,0,0,18,18,18,0,0,0,0,0,0,9,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,11,0,0,0,0,0,0,0,0,0,0,0,10,0,0,0,0,10,0,0,0,0,9,11,0,0,0,0,0,11,0,0,11,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,12,0,0,0,0,0,0,0,0,0,0,0,12,0,0,0,0,12,0,0,0,0,9,12,0,0,0,0,0,12,0,0,12,0,0,48,49,50,51,52,53,54,55,56,57,65,66,67,68,69,70,45,43,32,32,32,48,88,48,120,0,40,110,117,108,108,41,0,45,48,88,43,48,88,32,48,88,45,48,120,43,48,120,32,48,120,0,105,110,102,0,73,78,70,0,110,97,110,0,78,65,78,0,46,0,33,34,118,101,99,116,111,114,32,108,101,110,103,116,104,95,101,114,114,111,114,34,0,47,101,109,115,100,107,95,112,111,114,116,97,98,108,101,47,101,109,115,99,114,105,112,116,101,110,47,116,97,103,45,49,46,51,55,46,51,47,115,121,115,116,101,109,47,105,110,99,108,117,100,101,47,108,105,98,99,120,120,47,118,101,99,116,111,114,0,95,95,116,104,114,111,119,95,108,101,110,103,116,104,95,101,114,114,111,114,0,116,101,114,109,105,110,97,116,105,110,103,32,119,105,116,104,32,37,115,32,101,120,99,101,112,116,105,111,110,32,111,102,32,116,121,112,101,32,37,115,58,32,37,115,0,116,101,114,109,105,110,97,116,105,110,103,32,119,105,116,104,32,37,115,32,101,120,99,101,112,116,105,111,110,32,111,102,32,116,121,112,101,32,37,115,0,116,101,114,109,105,110,97,116,105,110,103,32,119,105,116,104,32,37,115,32,102,111,114,101,105,103,110,32,101,120,99,101,112,116,105,111,110,0,116,101,114,109,105,110,97,116,105,110,103,0,117,110,99,97,117,103,104,116,0,83,116,57,101,120,99,101,112,116,105,111,110,0,78,49,48,95,95,99,120,120,97,98,105,118,49,49,54,95,95,115,104,105,109,95,116,121,112,101,95,105,110,102,111,69,0,83,116,57,116,121,112,101,95,105,110,102,111,0,78,49,48,95,95,99,120,120,97,98,105,118,49,50,48,95,95,115,105,95,99,108,97,115,115,95,116,121,112,101,95,105,110,102,111,69,0,78,49,48,95,95,99,120,120,97,98,105,118,49,49,55,95,95,99,108,97,115,115,95,116,121,112,101,95,105,110,102,111,69,0,112,116,104,114,101,97,100,95,111,110,99,101,32,102,97,105,108,117,114,101,32,105,110,32,95,95,99,120,97,95,103,101,116,95,103,108,111,98,97,108,115,95,102,97,115,116,40,41,0,99,97,110,110,111,116,32,99,114,101,97,116,101,32,112,116,104,114,101,97,100,32,107,101,121,32,102,111,114,32,95,95,99,120,97,95,103,101,116,95,103,108,111,98,97,108,115,40,41,0,99,97,110,110,111,116,32,122,101,114,111,32,111,117,116,32,116,104,114,101,97,100,32,118,97,108,117,101,32,102,111,114,32,95,95,99,120,97,95,103,101,116,95,103,108,111,98,97,108,115,40,41,0,116,101,114,109,105,110,97,116,101,95,104,97,110,100,108,101,114,32,117,110,101,120,112,101,99,116,101,100,108,121,32,114,101,116,117,114,110,101,100,0,115,116,100,58,58,98,97,100,95,97,108,108,111,99,0,83,116,57,98,97,100,95,97,108,108,111,99,0,78,49,48,95,95,99,120,120,97,98,105,118,49,49,57,95,95,112,111,105,110,116,101,114,95,116,121,112,101,95,105,110,102,111,69,0,78,49,48,95,95,99,120,120,97,98,105,118,49,49,55,95,95,112,98,97,115,101,95,116,121,112,101,95,105,110,102,111,69,0,78,49,48,95,95,99,120,120,97,98,105,118,49,50,51,95,95,102,117,110,100,97,109,101,110,116,97,108,95,116,121,112,101,95,105,110,102,111,69,0,118,0,68,110,0,98,0,99,0,104,0,97,0,115,0,116,0,105,0,106,0,108,0,109,0,102,0,100,0,78,49,48,95,95,99,120,120,97,98,105,118,49,50,49,95,95,118,109,105,95,99,108,97,115,115,95,116,121,112,101,95,105,110,102,111,69,0], "i8", ALLOC_NONE, Runtime.GLOBAL_BASE);





/* no memory initializer */
var tempDoublePtr = STATICTOP; STATICTOP += 16;

function copyTempFloat(ptr) { // functions, because inlining this code increases code size too much

  HEAP8[tempDoublePtr] = HEAP8[ptr];

  HEAP8[tempDoublePtr+1] = HEAP8[ptr+1];

  HEAP8[tempDoublePtr+2] = HEAP8[ptr+2];

  HEAP8[tempDoublePtr+3] = HEAP8[ptr+3];

}

function copyTempDouble(ptr) {

  HEAP8[tempDoublePtr] = HEAP8[ptr];

  HEAP8[tempDoublePtr+1] = HEAP8[ptr+1];

  HEAP8[tempDoublePtr+2] = HEAP8[ptr+2];

  HEAP8[tempDoublePtr+3] = HEAP8[ptr+3];

  HEAP8[tempDoublePtr+4] = HEAP8[ptr+4];

  HEAP8[tempDoublePtr+5] = HEAP8[ptr+5];

  HEAP8[tempDoublePtr+6] = HEAP8[ptr+6];

  HEAP8[tempDoublePtr+7] = HEAP8[ptr+7];

}

// {{PRE_LIBRARY}}


   
  Module["_i64Subtract"] = _i64Subtract;

  function ___assert_fail(condition, filename, line, func) {
      ABORT = true;
      throw 'Assertion failed: ' + Pointer_stringify(condition) + ', at: ' + [filename ? Pointer_stringify(filename) : 'unknown filename', line, func ? Pointer_stringify(func) : 'unknown function'] + ' at ' + stackTrace();
    }

  
  
  
  function embind_init_charCodes() {
      var codes = new Array(256);
      for (var i = 0; i < 256; ++i) {
          codes[i] = String.fromCharCode(i);
      }
      embind_charCodes = codes;
    }var embind_charCodes=undefined;function readLatin1String(ptr) {
      var ret = "";
      var c = ptr;
      while (HEAPU8[c]) {
          ret += embind_charCodes[HEAPU8[c++]];
      }
      return ret;
    }
  
  
  var awaitingDependencies={};
  
  var registeredTypes={};
  
  var typeDependencies={};
  
  
  
  
  
  
  var char_0=48;
  
  var char_9=57;function makeLegalFunctionName(name) {
      if (undefined === name) {
          return '_unknown';
      }
      name = name.replace(/[^a-zA-Z0-9_]/g, '$');
      var f = name.charCodeAt(0);
      if (f >= char_0 && f <= char_9) {
          return '_' + name;
      } else {
          return name;
      }
    }function createNamedFunction(name, body) {
      name = makeLegalFunctionName(name);
      /*jshint evil:true*/
      return new Function(
          "body",
          "return function " + name + "() {\n" +
          "    \"use strict\";" +
          "    return body.apply(this, arguments);\n" +
          "};\n"
      )(body);
    }function extendError(baseErrorType, errorName) {
      var errorClass = createNamedFunction(errorName, function(message) {
          this.name = errorName;
          this.message = message;
  
          var stack = (new Error(message)).stack;
          if (stack !== undefined) {
              this.stack = this.toString() + '\n' +
                  stack.replace(/^Error(:[^\n]*)?\n/, '');
          }
      });
      errorClass.prototype = Object.create(baseErrorType.prototype);
      errorClass.prototype.constructor = errorClass;
      errorClass.prototype.toString = function() {
          if (this.message === undefined) {
              return this.name;
          } else {
              return this.name + ': ' + this.message;
          }
      };
  
      return errorClass;
    }var BindingError=undefined;function throwBindingError(message) {
      throw new BindingError(message);
    }
  
  
  
  var InternalError=undefined;function throwInternalError(message) {
      throw new InternalError(message);
    }function whenDependentTypesAreResolved(myTypes, dependentTypes, getTypeConverters) {
      myTypes.forEach(function(type) {
          typeDependencies[type] = dependentTypes;
      });
  
      function onComplete(typeConverters) {
          var myTypeConverters = getTypeConverters(typeConverters);
          if (myTypeConverters.length !== myTypes.length) {
              throwInternalError('Mismatched type converter count');
          }
          for (var i = 0; i < myTypes.length; ++i) {
              registerType(myTypes[i], myTypeConverters[i]);
          }
      }
  
      var typeConverters = new Array(dependentTypes.length);
      var unregisteredTypes = [];
      var registered = 0;
      dependentTypes.forEach(function(dt, i) {
          if (registeredTypes.hasOwnProperty(dt)) {
              typeConverters[i] = registeredTypes[dt];
          } else {
              unregisteredTypes.push(dt);
              if (!awaitingDependencies.hasOwnProperty(dt)) {
                  awaitingDependencies[dt] = [];
              }
              awaitingDependencies[dt].push(function() {
                  typeConverters[i] = registeredTypes[dt];
                  ++registered;
                  if (registered === unregisteredTypes.length) {
                      onComplete(typeConverters);
                  }
              });
          }
      });
      if (0 === unregisteredTypes.length) {
          onComplete(typeConverters);
      }
    }function registerType(rawType, registeredInstance, options) {
      options = options || {};
  
      if (!('argPackAdvance' in registeredInstance)) {
          throw new TypeError('registerType registeredInstance requires argPackAdvance');
      }
  
      var name = registeredInstance.name;
      if (!rawType) {
          throwBindingError('type "' + name + '" must have a positive integer typeid pointer');
      }
      if (registeredTypes.hasOwnProperty(rawType)) {
          if (options.ignoreDuplicateRegistrations) {
              return;
          } else {
              throwBindingError("Cannot register type '" + name + "' twice");
          }
      }
  
      registeredTypes[rawType] = registeredInstance;
      delete typeDependencies[rawType];
  
      if (awaitingDependencies.hasOwnProperty(rawType)) {
          var callbacks = awaitingDependencies[rawType];
          delete awaitingDependencies[rawType];
          callbacks.forEach(function(cb) {
              cb();
          });
      }
    }function __embind_register_void(rawType, name) {
      name = readLatin1String(name);
      registerType(rawType, {
          isVoid: true, // void return values can be optimized out sometimes
          name: name,
          'argPackAdvance': 0,
          'fromWireType': function() {
              return undefined;
          },
          'toWireType': function(destructors, o) {
              // TODO: assert if anything else is given?
              return undefined;
          },
      });
    }

  
  function __ZSt18uncaught_exceptionv() { // std::uncaught_exception()
      return !!__ZSt18uncaught_exceptionv.uncaught_exception;
    }
  
  
  
  var EXCEPTIONS={last:0,caught:[],infos:{},deAdjust:function (adjusted) {
        if (!adjusted || EXCEPTIONS.infos[adjusted]) return adjusted;
        for (var ptr in EXCEPTIONS.infos) {
          var info = EXCEPTIONS.infos[ptr];
          if (info.adjusted === adjusted) {
            return ptr;
          }
        }
        return adjusted;
      },addRef:function (ptr) {
        if (!ptr) return;
        var info = EXCEPTIONS.infos[ptr];
        info.refcount++;
      },decRef:function (ptr) {
        if (!ptr) return;
        var info = EXCEPTIONS.infos[ptr];
        assert(info.refcount > 0);
        info.refcount--;
        // A rethrown exception can reach refcount 0; it must not be discarded
        // Its next handler will clear the rethrown flag and addRef it, prior to
        // final decRef and destruction here
        if (info.refcount === 0 && !info.rethrown) {
          if (info.destructor) {
            Module['dynCall_vi'](info.destructor, ptr);
          }
          delete EXCEPTIONS.infos[ptr];
          ___cxa_free_exception(ptr);
        }
      },clearRef:function (ptr) {
        if (!ptr) return;
        var info = EXCEPTIONS.infos[ptr];
        info.refcount = 0;
      }};
  function ___resumeException(ptr) {
      if (!EXCEPTIONS.last) { EXCEPTIONS.last = ptr; }
      throw ptr + " - Exception catching is disabled, this exception cannot be caught. Compile with -s DISABLE_EXCEPTION_CATCHING=0 or DISABLE_EXCEPTION_CATCHING=2 to catch.";
    }function ___cxa_find_matching_catch() {
      var thrown = EXCEPTIONS.last;
      if (!thrown) {
        // just pass through the null ptr
        return ((asm["setTempRet0"](0),0)|0);
      }
      var info = EXCEPTIONS.infos[thrown];
      var throwntype = info.type;
      if (!throwntype) {
        // just pass through the thrown ptr
        return ((asm["setTempRet0"](0),thrown)|0);
      }
      var typeArray = Array.prototype.slice.call(arguments);
  
      var pointer = Module['___cxa_is_pointer_type'](throwntype);
      // can_catch receives a **, add indirection
      if (!___cxa_find_matching_catch.buffer) ___cxa_find_matching_catch.buffer = _malloc(4);
      HEAP32[((___cxa_find_matching_catch.buffer)>>2)]=thrown;
      thrown = ___cxa_find_matching_catch.buffer;
      // The different catch blocks are denoted by different types.
      // Due to inheritance, those types may not precisely match the
      // type of the thrown object. Find one which matches, and
      // return the type of the catch block which should be called.
      for (var i = 0; i < typeArray.length; i++) {
        if (typeArray[i] && Module['___cxa_can_catch'](typeArray[i], throwntype, thrown)) {
          thrown = HEAP32[((thrown)>>2)]; // undo indirection
          info.adjusted = thrown;
          return ((asm["setTempRet0"](typeArray[i]),thrown)|0);
        }
      }
      // Shouldn't happen unless we have bogus data in typeArray
      // or encounter a type for which emscripten doesn't have suitable
      // typeinfo defined. Best-efforts match just in case.
      thrown = HEAP32[((thrown)>>2)]; // undo indirection
      return ((asm["setTempRet0"](throwntype),thrown)|0);
    }function ___cxa_throw(ptr, type, destructor) {
      EXCEPTIONS.infos[ptr] = {
        ptr: ptr,
        adjusted: ptr,
        type: type,
        destructor: destructor,
        refcount: 0,
        caught: false,
        rethrown: false
      };
      EXCEPTIONS.last = ptr;
      if (!("uncaught_exception" in __ZSt18uncaught_exceptionv)) {
        __ZSt18uncaught_exceptionv.uncaught_exception = 1;
      } else {
        __ZSt18uncaught_exceptionv.uncaught_exception++;
      }
      throw ptr + " - Exception catching is disabled, this exception cannot be caught. Compile with -s DISABLE_EXCEPTION_CATCHING=0 or DISABLE_EXCEPTION_CATCHING=2 to catch.";
    }

   
  Module["_memset"] = _memset;

  
  function getShiftFromSize(size) {
      switch (size) {
          case 1: return 0;
          case 2: return 1;
          case 4: return 2;
          case 8: return 3;
          default:
              throw new TypeError('Unknown type size: ' + size);
      }
    }function __embind_register_bool(rawType, name, size, trueValue, falseValue) {
      var shift = getShiftFromSize(size);
  
      name = readLatin1String(name);
      registerType(rawType, {
          name: name,
          'fromWireType': function(wt) {
              // ambiguous emscripten ABI: sometimes return values are
              // true or false, and sometimes integers (0 or 1)
              return !!wt;
          },
          'toWireType': function(destructors, o) {
              return o ? trueValue : falseValue;
          },
          'argPackAdvance': 8,
          'readValueFromPointer': function(pointer) {
              // TODO: if heap is fixed (like in asm.js) this could be executed outside
              var heap;
              if (size === 1) {
                  heap = HEAP8;
              } else if (size === 2) {
                  heap = HEAP16;
              } else if (size === 4) {
                  heap = HEAP32;
              } else {
                  throw new TypeError("Unknown boolean type size: " + name);
              }
              return this['fromWireType'](heap[pointer >> shift]);
          },
          destructorFunction: null, // This type does not need a destructor
      });
    }

   
  Module["_bitshift64Shl"] = _bitshift64Shl;

  function _abort() {
      Module['abort']();
    }

  
  function _free() {
  }
  Module["_free"] = _free;
  
  function _malloc(bytes) {
      /* Over-allocate to make sure it is byte-aligned by 8.
       * This will leak memory, but this is only the dummy
       * implementation (replaced by dlmalloc normally) so
       * not an issue.
       */
      var ptr = Runtime.dynamicAlloc(bytes + 8);
      return (ptr+8) & 0xFFFFFFF8;
    }
  Module["_malloc"] = _malloc;
  
  function simpleReadValueFromPointer(pointer) {
      return this['fromWireType'](HEAPU32[pointer >> 2]);
    }function __embind_register_std_string(rawType, name) {
      name = readLatin1String(name);
      registerType(rawType, {
          name: name,
          'fromWireType': function(value) {
              var length = HEAPU32[value >> 2];
              var a = new Array(length);
              for (var i = 0; i < length; ++i) {
                  a[i] = String.fromCharCode(HEAPU8[value + 4 + i]);
              }
              _free(value);
              return a.join('');
          },
          'toWireType': function(destructors, value) {
              if (value instanceof ArrayBuffer) {
                  value = new Uint8Array(value);
              }
  
              function getTAElement(ta, index) {
                  return ta[index];
              }
              function getStringElement(string, index) {
                  return string.charCodeAt(index);
              }
              var getElement;
              if (value instanceof Uint8Array) {
                  getElement = getTAElement;
              } else if (value instanceof Uint8ClampedArray) {
                  getElement = getTAElement;
              } else if (value instanceof Int8Array) {
                  getElement = getTAElement;
              } else if (typeof value === 'string') {
                  getElement = getStringElement;
              } else {
                  throwBindingError('Cannot pass non-string to std::string');
              }
  
              // assumes 4-byte alignment
              var length = value.length;
              var ptr = _malloc(4 + length);
              HEAPU32[ptr >> 2] = length;
              for (var i = 0; i < length; ++i) {
                  var charCode = getElement(value, i);
                  if (charCode > 255) {
                      _free(ptr);
                      throwBindingError('String has UTF-16 code units that do not fit in 8 bits');
                  }
                  HEAPU8[ptr + 4 + i] = charCode;
              }
              if (destructors !== null) {
                  destructors.push(_free, ptr);
              }
              return ptr;
          },
          'argPackAdvance': 8,
          'readValueFromPointer': simpleReadValueFromPointer,
          destructorFunction: function(ptr) { _free(ptr); },
      });
    }

  function __embind_register_std_wstring(rawType, charSize, name) {
      // nb. do not cache HEAPU16 and HEAPU32, they may be destroyed by enlargeMemory().
      name = readLatin1String(name);
      var getHeap, shift;
      if (charSize === 2) {
          getHeap = function() { return HEAPU16; };
          shift = 1;
      } else if (charSize === 4) {
          getHeap = function() { return HEAPU32; };
          shift = 2;
      }
      registerType(rawType, {
          name: name,
          'fromWireType': function(value) {
              var HEAP = getHeap();
              var length = HEAPU32[value >> 2];
              var a = new Array(length);
              var start = (value + 4) >> shift;
              for (var i = 0; i < length; ++i) {
                  a[i] = String.fromCharCode(HEAP[start + i]);
              }
              _free(value);
              return a.join('');
          },
          'toWireType': function(destructors, value) {
              // assumes 4-byte alignment
              var HEAP = getHeap();
              var length = value.length;
              var ptr = _malloc(4 + length * charSize);
              HEAPU32[ptr >> 2] = length;
              var start = (ptr + 4) >> shift;
              for (var i = 0; i < length; ++i) {
                  HEAP[start + i] = value.charCodeAt(i);
              }
              if (destructors !== null) {
                  destructors.push(_free, ptr);
              }
              return ptr;
          },
          'argPackAdvance': 8,
          'readValueFromPointer': simpleReadValueFromPointer,
          destructorFunction: function(ptr) { _free(ptr); },
      });
    }

  function _pthread_once(ptr, func) {
      if (!_pthread_once.seen) _pthread_once.seen = {};
      if (ptr in _pthread_once.seen) return;
      Module['dynCall_v'](func);
      _pthread_once.seen[ptr] = 1;
    }

  
  
  
  function ClassHandle_isAliasOf(other) {
      if (!(this instanceof ClassHandle)) {
          return false;
      }
      if (!(other instanceof ClassHandle)) {
          return false;
      }
  
      var leftClass = this.$$.ptrType.registeredClass;
      var left = this.$$.ptr;
      var rightClass = other.$$.ptrType.registeredClass;
      var right = other.$$.ptr;
  
      while (leftClass.baseClass) {
          left = leftClass.upcast(left);
          leftClass = leftClass.baseClass;
      }
  
      while (rightClass.baseClass) {
          right = rightClass.upcast(right);
          rightClass = rightClass.baseClass;
      }
  
      return leftClass === rightClass && left === right;
    }
  
  
  function shallowCopyInternalPointer(o) {
      return {
          count: o.count,
          deleteScheduled: o.deleteScheduled,
          preservePointerOnDelete: o.preservePointerOnDelete,
          ptr: o.ptr,
          ptrType: o.ptrType,
          smartPtr: o.smartPtr,
          smartPtrType: o.smartPtrType,
      };
    }
  
  function throwInstanceAlreadyDeleted(obj) {
      function getInstanceTypeName(handle) {
        return handle.$$.ptrType.registeredClass.name;
      }
      throwBindingError(getInstanceTypeName(obj) + ' instance already deleted');
    }function ClassHandle_clone() {
      if (!this.$$.ptr) {
          throwInstanceAlreadyDeleted(this);
      }
  
      if (this.$$.preservePointerOnDelete) {
          this.$$.count.value += 1;
          return this;
      } else {
          var clone = Object.create(Object.getPrototypeOf(this), {
              $$: {
                  value: shallowCopyInternalPointer(this.$$),
              }
          });
  
          clone.$$.count.value += 1;
          clone.$$.deleteScheduled = false;
          return clone;
      }
    }
  
  
  function runDestructor(handle) {
      var $$ = handle.$$;
      if ($$.smartPtr) {
          $$.smartPtrType.rawDestructor($$.smartPtr);
      } else {
          $$.ptrType.registeredClass.rawDestructor($$.ptr);
      }
    }function ClassHandle_delete() {
      if (!this.$$.ptr) {
          throwInstanceAlreadyDeleted(this);
      }
  
      if (this.$$.deleteScheduled && !this.$$.preservePointerOnDelete) {
          throwBindingError('Object already scheduled for deletion');
      }
  
      this.$$.count.value -= 1;
      var toDelete = 0 === this.$$.count.value;
      if (toDelete) {
          runDestructor(this);
      }
      if (!this.$$.preservePointerOnDelete) {
          this.$$.smartPtr = undefined;
          this.$$.ptr = undefined;
      }
    }
  
  function ClassHandle_isDeleted() {
      return !this.$$.ptr;
    }
  
  
  var delayFunction=undefined;
  
  var deletionQueue=[];
  
  function flushPendingDeletes() {
      while (deletionQueue.length) {
          var obj = deletionQueue.pop();
          obj.$$.deleteScheduled = false;
          obj['delete']();
      }
    }function ClassHandle_deleteLater() {
      if (!this.$$.ptr) {
          throwInstanceAlreadyDeleted(this);
      }
      if (this.$$.deleteScheduled && !this.$$.preservePointerOnDelete) {
          throwBindingError('Object already scheduled for deletion');
      }
      deletionQueue.push(this);
      if (deletionQueue.length === 1 && delayFunction) {
          delayFunction(flushPendingDeletes);
      }
      this.$$.deleteScheduled = true;
      return this;
    }function init_ClassHandle() {
      ClassHandle.prototype['isAliasOf'] = ClassHandle_isAliasOf;
      ClassHandle.prototype['clone'] = ClassHandle_clone;
      ClassHandle.prototype['delete'] = ClassHandle_delete;
      ClassHandle.prototype['isDeleted'] = ClassHandle_isDeleted;
      ClassHandle.prototype['deleteLater'] = ClassHandle_deleteLater;
    }function ClassHandle() {
    }
  
  var registeredPointers={};
  
  
  function ensureOverloadTable(proto, methodName, humanName) {
      if (undefined === proto[methodName].overloadTable) {
          var prevFunc = proto[methodName];
          // Inject an overload resolver function that routes to the appropriate overload based on the number of arguments.
          proto[methodName] = function() {
              // TODO This check can be removed in -O3 level "unsafe" optimizations.
              if (!proto[methodName].overloadTable.hasOwnProperty(arguments.length)) {
                  throwBindingError("Function '" + humanName + "' called with an invalid number of arguments (" + arguments.length + ") - expects one of (" + proto[methodName].overloadTable + ")!");
              }
              return proto[methodName].overloadTable[arguments.length].apply(this, arguments);
          };
          // Move the previous function into the overload table.
          proto[methodName].overloadTable = [];
          proto[methodName].overloadTable[prevFunc.argCount] = prevFunc;
      }
    }function exposePublicSymbol(name, value, numArguments) {
      if (Module.hasOwnProperty(name)) {
          if (undefined === numArguments || (undefined !== Module[name].overloadTable && undefined !== Module[name].overloadTable[numArguments])) {
              throwBindingError("Cannot register public name '" + name + "' twice");
          }
  
          // We are exposing a function with the same name as an existing function. Create an overload table and a function selector
          // that routes between the two.
          ensureOverloadTable(Module, name, name);
          if (Module.hasOwnProperty(numArguments)) {
              throwBindingError("Cannot register multiple overloads of a function with the same number of arguments (" + numArguments + ")!");
          }
          // Add the new function into the overload table.
          Module[name].overloadTable[numArguments] = value;
      }
      else {
          Module[name] = value;
          if (undefined !== numArguments) {
              Module[name].numArguments = numArguments;
          }
      }
    }
  
  function RegisteredClass(
      name,
      constructor,
      instancePrototype,
      rawDestructor,
      baseClass,
      getActualType,
      upcast,
      downcast
    ) {
      this.name = name;
      this.constructor = constructor;
      this.instancePrototype = instancePrototype;
      this.rawDestructor = rawDestructor;
      this.baseClass = baseClass;
      this.getActualType = getActualType;
      this.upcast = upcast;
      this.downcast = downcast;
      this.pureVirtualFunctions = [];
    }
  
  
  
  function upcastPointer(ptr, ptrClass, desiredClass) {
      while (ptrClass !== desiredClass) {
          if (!ptrClass.upcast) {
              throwBindingError("Expected null or instance of " + desiredClass.name + ", got an instance of " + ptrClass.name);
          }
          ptr = ptrClass.upcast(ptr);
          ptrClass = ptrClass.baseClass;
      }
      return ptr;
    }function constNoSmartPtrRawPointerToWireType(destructors, handle) {
      if (handle === null) {
          if (this.isReference) {
              throwBindingError('null is not a valid ' + this.name);
          }
          return 0;
      }
  
      if (!handle.$$) {
          throwBindingError('Cannot pass "' + _embind_repr(handle) + '" as a ' + this.name);
      }
      if (!handle.$$.ptr) {
          throwBindingError('Cannot pass deleted object as a pointer of type ' + this.name);
      }
      var handleClass = handle.$$.ptrType.registeredClass;
      var ptr = upcastPointer(handle.$$.ptr, handleClass, this.registeredClass);
      return ptr;
    }
  
  function genericPointerToWireType(destructors, handle) {
      if (handle === null) {
          if (this.isReference) {
              throwBindingError('null is not a valid ' + this.name);
          }
  
          if (this.isSmartPointer) {
              var ptr = this.rawConstructor();
              if (destructors !== null) {
                  destructors.push(this.rawDestructor, ptr);
              }
              return ptr;
          } else {
              return 0;
          }
      }
  
      if (!handle.$$) {
          throwBindingError('Cannot pass "' + _embind_repr(handle) + '" as a ' + this.name);
      }
      if (!handle.$$.ptr) {
          throwBindingError('Cannot pass deleted object as a pointer of type ' + this.name);
      }
      if (!this.isConst && handle.$$.ptrType.isConst) {
          throwBindingError('Cannot convert argument of type ' + (handle.$$.smartPtrType ? handle.$$.smartPtrType.name : handle.$$.ptrType.name) + ' to parameter type ' + this.name);
      }
      var handleClass = handle.$$.ptrType.registeredClass;
      var ptr = upcastPointer(handle.$$.ptr, handleClass, this.registeredClass);
  
      if (this.isSmartPointer) {
          // TODO: this is not strictly true
          // We could support BY_EMVAL conversions from raw pointers to smart pointers
          // because the smart pointer can hold a reference to the handle
          if (undefined === handle.$$.smartPtr) {
              throwBindingError('Passing raw pointer to smart pointer is illegal');
          }
  
          switch (this.sharingPolicy) {
              case 0: // NONE
                  // no upcasting
                  if (handle.$$.smartPtrType === this) {
                      ptr = handle.$$.smartPtr;
                  } else {
                      throwBindingError('Cannot convert argument of type ' + (handle.$$.smartPtrType ? handle.$$.smartPtrType.name : handle.$$.ptrType.name) + ' to parameter type ' + this.name);
                  }
                  break;
  
              case 1: // INTRUSIVE
                  ptr = handle.$$.smartPtr;
                  break;
  
              case 2: // BY_EMVAL
                  if (handle.$$.smartPtrType === this) {
                      ptr = handle.$$.smartPtr;
                  } else {
                      var clonedHandle = handle['clone']();
                      ptr = this.rawShare(
                          ptr,
                          __emval_register(function() {
                              clonedHandle['delete']();
                          })
                      );
                      if (destructors !== null) {
                          destructors.push(this.rawDestructor, ptr);
                      }
                  }
                  break;
  
              default:
                  throwBindingError('Unsupporting sharing policy');
          }
      }
      return ptr;
    }
  
  function nonConstNoSmartPtrRawPointerToWireType(destructors, handle) {
      if (handle === null) {
          if (this.isReference) {
              throwBindingError('null is not a valid ' + this.name);
          }
          return 0;
      }
  
      if (!handle.$$) {
          throwBindingError('Cannot pass "' + _embind_repr(handle) + '" as a ' + this.name);
      }
      if (!handle.$$.ptr) {
          throwBindingError('Cannot pass deleted object as a pointer of type ' + this.name);
      }
      if (handle.$$.ptrType.isConst) {
          throwBindingError('Cannot convert argument of type ' + handle.$$.ptrType.name + ' to parameter type ' + this.name);
      }
      var handleClass = handle.$$.ptrType.registeredClass;
      var ptr = upcastPointer(handle.$$.ptr, handleClass, this.registeredClass);
      return ptr;
    }
  
  
  function RegisteredPointer_getPointee(ptr) {
      if (this.rawGetPointee) {
          ptr = this.rawGetPointee(ptr);
      }
      return ptr;
    }
  
  function RegisteredPointer_destructor(ptr) {
      if (this.rawDestructor) {
          this.rawDestructor(ptr);
      }
    }
  
  function RegisteredPointer_deleteObject(handle) {
      if (handle !== null) {
          handle['delete']();
      }
    }
  
  
  function downcastPointer(ptr, ptrClass, desiredClass) {
      if (ptrClass === desiredClass) {
          return ptr;
      }
      if (undefined === desiredClass.baseClass) {
          return null; // no conversion
      }
  
      var rv = downcastPointer(ptr, ptrClass, desiredClass.baseClass);
      if (rv === null) {
          return null;
      }
      return desiredClass.downcast(rv);
    }
  
  
  
  
  function getInheritedInstanceCount() {
      return Object.keys(registeredInstances).length;
    }
  
  function getLiveInheritedInstances() {
      var rv = [];
      for (var k in registeredInstances) {
          if (registeredInstances.hasOwnProperty(k)) {
              rv.push(registeredInstances[k]);
          }
      }
      return rv;
    }
  
  function setDelayFunction(fn) {
      delayFunction = fn;
      if (deletionQueue.length && delayFunction) {
          delayFunction(flushPendingDeletes);
      }
    }function init_embind() {
      Module['getInheritedInstanceCount'] = getInheritedInstanceCount;
      Module['getLiveInheritedInstances'] = getLiveInheritedInstances;
      Module['flushPendingDeletes'] = flushPendingDeletes;
      Module['setDelayFunction'] = setDelayFunction;
    }var registeredInstances={};
  
  function getBasestPointer(class_, ptr) {
      if (ptr === undefined) {
          throwBindingError('ptr should not be undefined');
      }
      while (class_.baseClass) {
          ptr = class_.upcast(ptr);
          class_ = class_.baseClass;
      }
      return ptr;
    }function getInheritedInstance(class_, ptr) {
      ptr = getBasestPointer(class_, ptr);
      return registeredInstances[ptr];
    }
  
  function makeClassHandle(prototype, record) {
      if (!record.ptrType || !record.ptr) {
          throwInternalError('makeClassHandle requires ptr and ptrType');
      }
      var hasSmartPtrType = !!record.smartPtrType;
      var hasSmartPtr = !!record.smartPtr;
      if (hasSmartPtrType !== hasSmartPtr) {
          throwInternalError('Both smartPtrType and smartPtr must be specified');
      }
      record.count = { value: 1 };
      return Object.create(prototype, {
          $$: {
              value: record,
          },
      });
    }function RegisteredPointer_fromWireType(ptr) {
      // ptr is a raw pointer (or a raw smartpointer)
  
      // rawPointer is a maybe-null raw pointer
      var rawPointer = this.getPointee(ptr);
      if (!rawPointer) {
          this.destructor(ptr);
          return null;
      }
  
      var registeredInstance = getInheritedInstance(this.registeredClass, rawPointer);
      if (undefined !== registeredInstance) {
          // JS object has been neutered, time to repopulate it
          if (0 === registeredInstance.$$.count.value) {
              registeredInstance.$$.ptr = rawPointer;
              registeredInstance.$$.smartPtr = ptr;
              return registeredInstance['clone']();
          } else {
              // else, just increment reference count on existing object
              // it already has a reference to the smart pointer
              var rv = registeredInstance['clone']();
              this.destructor(ptr);
              return rv;
          }
      }
  
      function makeDefaultHandle() {
          if (this.isSmartPointer) {
              return makeClassHandle(this.registeredClass.instancePrototype, {
                  ptrType: this.pointeeType,
                  ptr: rawPointer,
                  smartPtrType: this,
                  smartPtr: ptr,
              });
          } else {
              return makeClassHandle(this.registeredClass.instancePrototype, {
                  ptrType: this,
                  ptr: ptr,
              });
          }
      }
  
      var actualType = this.registeredClass.getActualType(rawPointer);
      var registeredPointerRecord = registeredPointers[actualType];
      if (!registeredPointerRecord) {
          return makeDefaultHandle.call(this);
      }
  
      var toType;
      if (this.isConst) {
          toType = registeredPointerRecord.constPointerType;
      } else {
          toType = registeredPointerRecord.pointerType;
      }
      var dp = downcastPointer(
          rawPointer,
          this.registeredClass,
          toType.registeredClass);
      if (dp === null) {
          return makeDefaultHandle.call(this);
      }
      if (this.isSmartPointer) {
          return makeClassHandle(toType.registeredClass.instancePrototype, {
              ptrType: toType,
              ptr: dp,
              smartPtrType: this,
              smartPtr: ptr,
          });
      } else {
          return makeClassHandle(toType.registeredClass.instancePrototype, {
              ptrType: toType,
              ptr: dp,
          });
      }
    }function init_RegisteredPointer() {
      RegisteredPointer.prototype.getPointee = RegisteredPointer_getPointee;
      RegisteredPointer.prototype.destructor = RegisteredPointer_destructor;
      RegisteredPointer.prototype['argPackAdvance'] = 8;
      RegisteredPointer.prototype['readValueFromPointer'] = simpleReadValueFromPointer;
      RegisteredPointer.prototype['deleteObject'] = RegisteredPointer_deleteObject;
      RegisteredPointer.prototype['fromWireType'] = RegisteredPointer_fromWireType;
    }function RegisteredPointer(
      name,
      registeredClass,
      isReference,
      isConst,
  
      // smart pointer properties
      isSmartPointer,
      pointeeType,
      sharingPolicy,
      rawGetPointee,
      rawConstructor,
      rawShare,
      rawDestructor
    ) {
      this.name = name;
      this.registeredClass = registeredClass;
      this.isReference = isReference;
      this.isConst = isConst;
  
      // smart pointer properties
      this.isSmartPointer = isSmartPointer;
      this.pointeeType = pointeeType;
      this.sharingPolicy = sharingPolicy;
      this.rawGetPointee = rawGetPointee;
      this.rawConstructor = rawConstructor;
      this.rawShare = rawShare;
      this.rawDestructor = rawDestructor;
  
      if (!isSmartPointer && registeredClass.baseClass === undefined) {
          if (isConst) {
              this['toWireType'] = constNoSmartPtrRawPointerToWireType;
              this.destructorFunction = null;
          } else {
              this['toWireType'] = nonConstNoSmartPtrRawPointerToWireType;
              this.destructorFunction = null;
          }
      } else {
          this['toWireType'] = genericPointerToWireType;
          // Here we must leave this.destructorFunction undefined, since whether genericPointerToWireType returns
          // a pointer that needs to be freed up is runtime-dependent, and cannot be evaluated at registration time.
          // TODO: Create an alternative mechanism that allows removing the use of var destructors = []; array in
          //       craftInvokerFunction altogether.
      }
    }
  
  function replacePublicSymbol(name, value, numArguments) {
      if (!Module.hasOwnProperty(name)) {
          throwInternalError('Replacing nonexistant public symbol');
      }
      // If there's an overload table for this symbol, replace the symbol in the overload table instead.
      if (undefined !== Module[name].overloadTable && undefined !== numArguments) {
          Module[name].overloadTable[numArguments] = value;
      }
      else {
          Module[name] = value;
          Module[name].argCount = numArguments;
      }
    }
  
  function requireFunction(signature, rawFunction) {
      signature = readLatin1String(signature);
  
      function makeDynCaller(dynCall) {
          var args = [];
          for (var i = 1; i < signature.length; ++i) {
              args.push('a' + i);
          }
  
          var name = 'dynCall_' + signature + '_' + rawFunction;
          var body = 'return function ' + name + '(' + args.join(', ') + ') {\n';
          body    += '    return dynCall(rawFunction' + (args.length ? ', ' : '') + args.join(', ') + ');\n';
          body    += '};\n';
  
          return (new Function('dynCall', 'rawFunction', body))(dynCall, rawFunction);
      }
  
      var fp;
      if (Module['FUNCTION_TABLE_' + signature] !== undefined) {
          fp = Module['FUNCTION_TABLE_' + signature][rawFunction];
      } else if (typeof FUNCTION_TABLE !== "undefined") {
          fp = FUNCTION_TABLE[rawFunction];
      } else {
          // asm.js does not give direct access to the function tables,
          // and thus we must go through the dynCall interface which allows
          // calling into a signature's function table by pointer value.
          //
          // https://github.com/dherman/asm.js/issues/83
          //
          // This has three main penalties:
          // - dynCall is another function call in the path from JavaScript to C++.
          // - JITs may not predict through the function table indirection at runtime.
          var dc = asm['dynCall_' + signature];
          if (dc === undefined) {
              // We will always enter this branch if the signature
              // contains 'f' and PRECISE_F32 is not enabled.
              //
              // Try again, replacing 'f' with 'd'.
              dc = asm['dynCall_' + signature.replace(/f/g, 'd')];
              if (dc === undefined) {
                  throwBindingError("No dynCall invoker for signature: " + signature);
              }
          }
          fp = makeDynCaller(dc);
      }
  
      if (typeof fp !== "function") {
          throwBindingError("unknown function pointer with signature " + signature + ": " + rawFunction);
      }
      return fp;
    }
  
  
  var UnboundTypeError=undefined;
  
  function getTypeName(type) {
      var ptr = ___getTypeName(type);
      var rv = readLatin1String(ptr);
      _free(ptr);
      return rv;
    }function throwUnboundTypeError(message, types) {
      var unboundTypes = [];
      var seen = {};
      function visit(type) {
          if (seen[type]) {
              return;
          }
          if (registeredTypes[type]) {
              return;
          }
          if (typeDependencies[type]) {
              typeDependencies[type].forEach(visit);
              return;
          }
          unboundTypes.push(type);
          seen[type] = true;
      }
      types.forEach(visit);
  
      throw new UnboundTypeError(message + ': ' + unboundTypes.map(getTypeName).join([', ']));
    }function __embind_register_class(
      rawType,
      rawPointerType,
      rawConstPointerType,
      baseClassRawType,
      getActualTypeSignature,
      getActualType,
      upcastSignature,
      upcast,
      downcastSignature,
      downcast,
      name,
      destructorSignature,
      rawDestructor
    ) {
      name = readLatin1String(name);
      getActualType = requireFunction(getActualTypeSignature, getActualType);
      if (upcast) {
          upcast = requireFunction(upcastSignature, upcast);
      }
      if (downcast) {
          downcast = requireFunction(downcastSignature, downcast);
      }
      rawDestructor = requireFunction(destructorSignature, rawDestructor);
      var legalFunctionName = makeLegalFunctionName(name);
  
      exposePublicSymbol(legalFunctionName, function() {
          // this code cannot run if baseClassRawType is zero
          throwUnboundTypeError('Cannot construct ' + name + ' due to unbound types', [baseClassRawType]);
      });
  
      whenDependentTypesAreResolved(
          [rawType, rawPointerType, rawConstPointerType],
          baseClassRawType ? [baseClassRawType] : [],
          function(base) {
              base = base[0];
  
              var baseClass;
              var basePrototype;
              if (baseClassRawType) {
                  baseClass = base.registeredClass;
                  basePrototype = baseClass.instancePrototype;
              } else {
                  basePrototype = ClassHandle.prototype;
              }
  
              var constructor = createNamedFunction(legalFunctionName, function() {
                  if (Object.getPrototypeOf(this) !== instancePrototype) {
                      throw new BindingError("Use 'new' to construct " + name);
                  }
                  if (undefined === registeredClass.constructor_body) {
                      throw new BindingError(name + " has no accessible constructor");
                  }
                  var body = registeredClass.constructor_body[arguments.length];
                  if (undefined === body) {
                      throw new BindingError("Tried to invoke ctor of " + name + " with invalid number of parameters (" + arguments.length + ") - expected (" + Object.keys(registeredClass.constructor_body).toString() + ") parameters instead!");
                  }
                  return body.apply(this, arguments);
              });
  
              var instancePrototype = Object.create(basePrototype, {
                  constructor: { value: constructor },
              });
  
              constructor.prototype = instancePrototype;
  
              var registeredClass = new RegisteredClass(
                  name,
                  constructor,
                  instancePrototype,
                  rawDestructor,
                  baseClass,
                  getActualType,
                  upcast,
                  downcast);
  
              var referenceConverter = new RegisteredPointer(
                  name,
                  registeredClass,
                  true,
                  false,
                  false);
  
              var pointerConverter = new RegisteredPointer(
                  name + '*',
                  registeredClass,
                  false,
                  false,
                  false);
  
              var constPointerConverter = new RegisteredPointer(
                  name + ' const*',
                  registeredClass,
                  false,
                  true,
                  false);
  
              registeredPointers[rawType] = {
                  pointerType: pointerConverter,
                  constPointerType: constPointerConverter
              };
  
              replacePublicSymbol(legalFunctionName, constructor);
  
              return [referenceConverter, pointerConverter, constPointerConverter];
          }
      );
    }

  function ___lock() {}

  function ___unlock() {}

  
  var emval_free_list=[];
  
  var emval_handle_array=[{},{value:undefined},{value:null},{value:true},{value:false}];function __emval_decref(handle) {
      if (handle > 4 && 0 === --emval_handle_array[handle].refcount) {
          emval_handle_array[handle] = undefined;
          emval_free_list.push(handle);
      }
    }

  
  var PTHREAD_SPECIFIC={};function _pthread_getspecific(key) {
      return PTHREAD_SPECIFIC[key] || 0;
    }

   
  Module["_i64Add"] = _i64Add;

  
  var PTHREAD_SPECIFIC_NEXT_KEY=1;
  
  var ERRNO_CODES={EPERM:1,ENOENT:2,ESRCH:3,EINTR:4,EIO:5,ENXIO:6,E2BIG:7,ENOEXEC:8,EBADF:9,ECHILD:10,EAGAIN:11,EWOULDBLOCK:11,ENOMEM:12,EACCES:13,EFAULT:14,ENOTBLK:15,EBUSY:16,EEXIST:17,EXDEV:18,ENODEV:19,ENOTDIR:20,EISDIR:21,EINVAL:22,ENFILE:23,EMFILE:24,ENOTTY:25,ETXTBSY:26,EFBIG:27,ENOSPC:28,ESPIPE:29,EROFS:30,EMLINK:31,EPIPE:32,EDOM:33,ERANGE:34,ENOMSG:42,EIDRM:43,ECHRNG:44,EL2NSYNC:45,EL3HLT:46,EL3RST:47,ELNRNG:48,EUNATCH:49,ENOCSI:50,EL2HLT:51,EDEADLK:35,ENOLCK:37,EBADE:52,EBADR:53,EXFULL:54,ENOANO:55,EBADRQC:56,EBADSLT:57,EDEADLOCK:35,EBFONT:59,ENOSTR:60,ENODATA:61,ETIME:62,ENOSR:63,ENONET:64,ENOPKG:65,EREMOTE:66,ENOLINK:67,EADV:68,ESRMNT:69,ECOMM:70,EPROTO:71,EMULTIHOP:72,EDOTDOT:73,EBADMSG:74,ENOTUNIQ:76,EBADFD:77,EREMCHG:78,ELIBACC:79,ELIBBAD:80,ELIBSCN:81,ELIBMAX:82,ELIBEXEC:83,ENOSYS:38,ENOTEMPTY:39,ENAMETOOLONG:36,ELOOP:40,EOPNOTSUPP:95,EPFNOSUPPORT:96,ECONNRESET:104,ENOBUFS:105,EAFNOSUPPORT:97,EPROTOTYPE:91,ENOTSOCK:88,ENOPROTOOPT:92,ESHUTDOWN:108,ECONNREFUSED:111,EADDRINUSE:98,ECONNABORTED:103,ENETUNREACH:101,ENETDOWN:100,ETIMEDOUT:110,EHOSTDOWN:112,EHOSTUNREACH:113,EINPROGRESS:115,EALREADY:114,EDESTADDRREQ:89,EMSGSIZE:90,EPROTONOSUPPORT:93,ESOCKTNOSUPPORT:94,EADDRNOTAVAIL:99,ENETRESET:102,EISCONN:106,ENOTCONN:107,ETOOMANYREFS:109,EUSERS:87,EDQUOT:122,ESTALE:116,ENOTSUP:95,ENOMEDIUM:123,EILSEQ:84,EOVERFLOW:75,ECANCELED:125,ENOTRECOVERABLE:131,EOWNERDEAD:130,ESTRPIPE:86};function _pthread_key_create(key, destructor) {
      if (key == 0) {
        return ERRNO_CODES.EINVAL;
      }
      HEAP32[((key)>>2)]=PTHREAD_SPECIFIC_NEXT_KEY;
      // values start at 0
      PTHREAD_SPECIFIC[PTHREAD_SPECIFIC_NEXT_KEY] = 0;
      PTHREAD_SPECIFIC_NEXT_KEY++;
      return 0;
    }

  
  
  
  function count_emval_handles() {
      var count = 0;
      for (var i = 5; i < emval_handle_array.length; ++i) {
          if (emval_handle_array[i] !== undefined) {
              ++count;
          }
      }
      return count;
    }
  
  function get_first_emval() {
      for (var i = 5; i < emval_handle_array.length; ++i) {
          if (emval_handle_array[i] !== undefined) {
              return emval_handle_array[i];
          }
      }
      return null;
    }function init_emval() {
      Module['count_emval_handles'] = count_emval_handles;
      Module['get_first_emval'] = get_first_emval;
    }function __emval_register(value) {
  
      switch(value){
        case undefined :{ return 1; }
        case null :{ return 2; }
        case true :{ return 3; }
        case false :{ return 4; }
        default:{
          var handle = emval_free_list.length ?
              emval_free_list.pop() :
              emval_handle_array.length;
  
          emval_handle_array[handle] = {refcount: 1, value: value};
          return handle;
          }
        }
    }
  
  function requireRegisteredType(rawType, humanName) {
      var impl = registeredTypes[rawType];
      if (undefined === impl) {
          throwBindingError(humanName + " has unknown type " + getTypeName(rawType));
      }
      return impl;
    }function __emval_take_value(type, argv) {
      type = requireRegisteredType(type, '_emval_take_value');
      var v = type['readValueFromPointer'](argv);
      return __emval_register(v);
    }

  
  function _embind_repr(v) {
      if (v === null) {
          return 'null';
      }
      var t = typeof v;
      if (t === 'object' || t === 'array' || t === 'function') {
          return v.toString();
      } else {
          return '' + v;
      }
    }
  
  function integerReadValueFromPointer(name, shift, signed) {
      // integers are quite common, so generate very specialized functions
      switch (shift) {
          case 0: return signed ?
              function readS8FromPointer(pointer) { return HEAP8[pointer]; } :
              function readU8FromPointer(pointer) { return HEAPU8[pointer]; };
          case 1: return signed ?
              function readS16FromPointer(pointer) { return HEAP16[pointer >> 1]; } :
              function readU16FromPointer(pointer) { return HEAPU16[pointer >> 1]; };
          case 2: return signed ?
              function readS32FromPointer(pointer) { return HEAP32[pointer >> 2]; } :
              function readU32FromPointer(pointer) { return HEAPU32[pointer >> 2]; };
          default:
              throw new TypeError("Unknown integer type: " + name);
      }
    }function __embind_register_integer(primitiveType, name, size, minRange, maxRange) {
      name = readLatin1String(name);
      if (maxRange === -1) { // LLVM doesn't have signed and unsigned 32-bit types, so u32 literals come out as 'i32 -1'. Always treat those as max u32.
          maxRange = 4294967295;
      }
  
      var shift = getShiftFromSize(size);
      
      var fromWireType = function(value) {
          return value;
      };
      
      if (minRange === 0) {
          var bitshift = 32 - 8*size;
          fromWireType = function(value) {
              return (value << bitshift) >>> bitshift;
          };
      }
  
      registerType(primitiveType, {
          name: name,
          'fromWireType': fromWireType,
          'toWireType': function(destructors, value) {
              // todo: Here we have an opportunity for -O3 level "unsafe" optimizations: we could
              // avoid the following two if()s and assume value is of proper type.
              if (typeof value !== "number" && typeof value !== "boolean") {
                  throw new TypeError('Cannot convert "' + _embind_repr(value) + '" to ' + this.name);
              }
              if (value < minRange || value > maxRange) {
                  throw new TypeError('Passing a number "' + _embind_repr(value) + '" from JS side to C/C++ side to an argument of type "' + name + '", which is outside the valid range [' + minRange + ', ' + maxRange + ']!');
              }
              return value | 0;
          },
          'argPackAdvance': 8,
          'readValueFromPointer': integerReadValueFromPointer(name, shift, minRange !== 0),
          destructorFunction: null, // This type does not need a destructor
      });
    }

  function __embind_register_emval(rawType, name) {
      name = readLatin1String(name);
      registerType(rawType, {
          name: name,
          'fromWireType': function(handle) {
              var rv = emval_handle_array[handle].value;
              __emval_decref(handle);
              return rv;
          },
          'toWireType': function(destructors, value) {
              return __emval_register(value);
          },
          'argPackAdvance': 8,
          'readValueFromPointer': simpleReadValueFromPointer,
          destructorFunction: null, // This type does not need a destructor
  
          // TODO: do we need a deleteObject here?  write a test where
          // emval is passed into JS via an interface
      });
    }

  function _pthread_setspecific(key, value) {
      if (!(key in PTHREAD_SPECIFIC)) {
        return ERRNO_CODES.EINVAL;
      }
      PTHREAD_SPECIFIC[key] = value;
      return 0;
    }

  function ___cxa_allocate_exception(size) {
      return _malloc(size);
    }

  
  var SYSCALLS={varargs:0,get:function (varargs) {
        SYSCALLS.varargs += 4;
        var ret = HEAP32[(((SYSCALLS.varargs)-(4))>>2)];
        return ret;
      },getStr:function () {
        var ret = Pointer_stringify(SYSCALLS.get());
        return ret;
      },get64:function () {
        var low = SYSCALLS.get(), high = SYSCALLS.get();
        if (low >= 0) assert(high === 0);
        else assert(high === -1);
        return low;
      },getZero:function () {
        assert(SYSCALLS.get() === 0);
      }};function ___syscall54(which, varargs) {SYSCALLS.varargs = varargs;
  try {
   // ioctl
      return 0;
    } catch (e) {
    if (typeof FS === 'undefined' || !(e instanceof FS.ErrnoError)) abort(e);
    return -e.errno;
  }
  }

  
  var tupleRegistrations={};function __embind_register_value_array(
      rawType,
      name,
      constructorSignature,
      rawConstructor,
      destructorSignature,
      rawDestructor
    ) {
      tupleRegistrations[rawType] = {
          name: readLatin1String(name),
          rawConstructor: requireFunction(constructorSignature, rawConstructor),
          rawDestructor: requireFunction(destructorSignature, rawDestructor),
          elements: [],
      };
    }

   
  Module["_bitshift64Ashr"] = _bitshift64Ashr;

   
  Module["_bitshift64Lshr"] = _bitshift64Lshr;

  
  function heap32VectorToArray(count, firstElement) {
      var array = [];
      for (var i = 0; i < count; i++) {
          array.push(HEAP32[(firstElement >> 2) + i]);
      }
      return array;
    }
  
  function runDestructors(destructors) {
      while (destructors.length) {
          var ptr = destructors.pop();
          var del = destructors.pop();
          del(ptr);
      }
    }function __embind_register_class_constructor(
      rawClassType,
      argCount,
      rawArgTypesAddr,
      invokerSignature,
      invoker,
      rawConstructor
    ) {
      var rawArgTypes = heap32VectorToArray(argCount, rawArgTypesAddr);
      invoker = requireFunction(invokerSignature, invoker);
  
      whenDependentTypesAreResolved([], [rawClassType], function(classType) {
          classType = classType[0];
          var humanName = 'constructor ' + classType.name;
  
          if (undefined === classType.registeredClass.constructor_body) {
              classType.registeredClass.constructor_body = [];
          }
          if (undefined !== classType.registeredClass.constructor_body[argCount - 1]) {
              throw new BindingError("Cannot register multiple constructors with identical number of parameters (" + (argCount-1) + ") for class '" + classType.name + "'! Overload resolution is currently only performed using the parameter count, not actual type info!");
          }
          classType.registeredClass.constructor_body[argCount - 1] = function unboundTypeHandler() {
              throwUnboundTypeError('Cannot construct ' + classType.name + ' due to unbound types', rawArgTypes);
          };
  
          whenDependentTypesAreResolved([], rawArgTypes, function(argTypes) {
              classType.registeredClass.constructor_body[argCount - 1] = function constructor_body() {
                  if (arguments.length !== argCount - 1) {
                      throwBindingError(humanName + ' called with ' + arguments.length + ' arguments, expected ' + (argCount-1));
                  }
                  var destructors = [];
                  var args = new Array(argCount);
                  args[0] = rawConstructor;
                  for (var i = 1; i < argCount; ++i) {
                      args[i] = argTypes[i]['toWireType'](destructors, arguments[i - 1]);
                  }
  
                  var ptr = invoker.apply(null, args);
                  runDestructors(destructors);
  
                  return argTypes[0]['fromWireType'](ptr);
              };
              return [];
          });
          return [];
      });
    }

  
  function floatReadValueFromPointer(name, shift) {
      switch (shift) {
          case 2: return function(pointer) {
              return this['fromWireType'](HEAPF32[pointer >> 2]);
          };
          case 3: return function(pointer) {
              return this['fromWireType'](HEAPF64[pointer >> 3]);
          };
          default:
              throw new TypeError("Unknown float type: " + name);
      }
    }function __embind_register_float(rawType, name, size) {
      var shift = getShiftFromSize(size);
      name = readLatin1String(name);
      registerType(rawType, {
          name: name,
          'fromWireType': function(value) {
              return value;
          },
          'toWireType': function(destructors, value) {
              // todo: Here we have an opportunity for -O3 level "unsafe" optimizations: we could
              // avoid the following if() and assume value is of proper type.
              if (typeof value !== "number" && typeof value !== "boolean") {
                  throw new TypeError('Cannot convert "' + _embind_repr(value) + '" to ' + this.name);
              }
              return value;
          },
          'argPackAdvance': 8,
          'readValueFromPointer': floatReadValueFromPointer(name, shift),
          destructorFunction: null, // This type does not need a destructor
      });
    }

  function _pthread_cleanup_push(routine, arg) {
      __ATEXIT__.push(function() { Module['dynCall_vi'](routine, arg) })
      _pthread_cleanup_push.level = __ATEXIT__.length;
    }

  function __embind_finalize_value_array(rawTupleType) {
      var reg = tupleRegistrations[rawTupleType];
      delete tupleRegistrations[rawTupleType];
      var elements = reg.elements;
      var elementsLength = elements.length;
      var elementTypes = elements.map(function(elt) { return elt.getterReturnType; }).
                  concat(elements.map(function(elt) { return elt.setterArgumentType; }));
  
      var rawConstructor = reg.rawConstructor;
      var rawDestructor = reg.rawDestructor;
  
      whenDependentTypesAreResolved([rawTupleType], elementTypes, function(elementTypes) {
          elements.forEach(function(elt, i) {
              var getterReturnType = elementTypes[i];
              var getter = elt.getter;
              var getterContext = elt.getterContext;
              var setterArgumentType = elementTypes[i + elementsLength];
              var setter = elt.setter;
              var setterContext = elt.setterContext;
              elt.read = function(ptr) {
                  return getterReturnType['fromWireType'](getter(getterContext, ptr));
              };
              elt.write = function(ptr, o) {
                  var destructors = [];
                  setter(setterContext, ptr, setterArgumentType['toWireType'](destructors, o));
                  runDestructors(destructors);
              };
          });
  
          return [{
              name: reg.name,
              'fromWireType': function(ptr) {
                  var rv = new Array(elementsLength);
                  for (var i = 0; i < elementsLength; ++i) {
                      rv[i] = elements[i].read(ptr);
                  }
                  rawDestructor(ptr);
                  return rv;
              },
              'toWireType': function(destructors, o) {
                  if (elementsLength !== o.length) {
                      throw new TypeError("Incorrect number of tuple elements for " + reg.name + ": expected=" + elementsLength + ", actual=" + o.length);
                  }
                  var ptr = rawConstructor();
                  for (var i = 0; i < elementsLength; ++i) {
                      elements[i].write(ptr, o[i]);
                  }
                  if (destructors !== null) {
                      destructors.push(rawDestructor, ptr);
                  }
                  return ptr;
              },
              'argPackAdvance': 8,
              'readValueFromPointer': simpleReadValueFromPointer,
              destructorFunction: rawDestructor,
          }];
      });
    }

  function _pthread_cleanup_pop() {
      assert(_pthread_cleanup_push.level == __ATEXIT__.length, 'cannot pop if something else added meanwhile!');
      __ATEXIT__.pop();
      _pthread_cleanup_push.level = __ATEXIT__.length;
    }

  function ___cxa_begin_catch(ptr) {
      var info = EXCEPTIONS.infos[ptr];
      if (info && !info.caught) {
        info.caught = true;
        __ZSt18uncaught_exceptionv.uncaught_exception--;
      }
      if (info) info.rethrown = false;
      EXCEPTIONS.caught.push(ptr);
      EXCEPTIONS.addRef(EXCEPTIONS.deAdjust(ptr));
      return ptr;
    }

  
  function _emscripten_memcpy_big(dest, src, num) {
      HEAPU8.set(HEAPU8.subarray(src, src+num), dest);
      return dest;
    } 
  Module["_memcpy"] = _memcpy;

  function ___syscall6(which, varargs) {SYSCALLS.varargs = varargs;
  try {
   // close
      var stream = SYSCALLS.getStreamFromFD();
      FS.close(stream);
      return 0;
    } catch (e) {
    if (typeof FS === 'undefined' || !(e instanceof FS.ErrnoError)) abort(e);
    return -e.errno;
  }
  }

  
  
  var cttz_i8 = allocate([8,0,1,0,2,0,1,0,3,0,1,0,2,0,1,0,4,0,1,0,2,0,1,0,3,0,1,0,2,0,1,0,5,0,1,0,2,0,1,0,3,0,1,0,2,0,1,0,4,0,1,0,2,0,1,0,3,0,1,0,2,0,1,0,6,0,1,0,2,0,1,0,3,0,1,0,2,0,1,0,4,0,1,0,2,0,1,0,3,0,1,0,2,0,1,0,5,0,1,0,2,0,1,0,3,0,1,0,2,0,1,0,4,0,1,0,2,0,1,0,3,0,1,0,2,0,1,0,7,0,1,0,2,0,1,0,3,0,1,0,2,0,1,0,4,0,1,0,2,0,1,0,3,0,1,0,2,0,1,0,5,0,1,0,2,0,1,0,3,0,1,0,2,0,1,0,4,0,1,0,2,0,1,0,3,0,1,0,2,0,1,0,6,0,1,0,2,0,1,0,3,0,1,0,2,0,1,0,4,0,1,0,2,0,1,0,3,0,1,0,2,0,1,0,5,0,1,0,2,0,1,0,3,0,1,0,2,0,1,0,4,0,1,0,2,0,1,0,3,0,1,0,2,0,1,0], "i8", ALLOC_STATIC); 
  Module["_llvm_cttz_i32"] = _llvm_cttz_i32; 
  Module["___udivmoddi4"] = ___udivmoddi4; 
  Module["___udivdi3"] = ___udivdi3;

  function __embind_register_value_array_element(
      rawTupleType,
      getterReturnType,
      getterSignature,
      getter,
      getterContext,
      setterArgumentType,
      setterSignature,
      setter,
      setterContext
    ) {
      tupleRegistrations[rawTupleType].elements.push({
          getterReturnType: getterReturnType,
          getter: requireFunction(getterSignature, getter),
          getterContext: getterContext,
          setterArgumentType: setterArgumentType,
          setter: requireFunction(setterSignature, setter),
          setterContext: setterContext,
      });
    }

  
  function ___setErrNo(value) {
      if (Module['___errno_location']) HEAP32[((Module['___errno_location']())>>2)]=value;
      return value;
    } 
  Module["_sbrk"] = _sbrk;

   
  Module["_memmove"] = _memmove;

  function ___gxx_personality_v0() {
    }

   
  Module["___uremdi3"] = ___uremdi3;

  function __embind_register_memory_view(rawType, dataTypeIndex, name) {
      var typeMapping = [
          Int8Array,
          Uint8Array,
          Int16Array,
          Uint16Array,
          Int32Array,
          Uint32Array,
          Float32Array,
          Float64Array,
      ];
  
      var TA = typeMapping[dataTypeIndex];
  
      function decodeMemoryView(handle) {
          handle = handle >> 2;
          var heap = HEAPU32;
          var size = heap[handle]; // in elements
          var data = heap[handle + 1]; // byte offset into emscripten heap
          return new TA(heap['buffer'], data, size);
      }
  
      name = readLatin1String(name);
      registerType(rawType, {
          name: name,
          'fromWireType': decodeMemoryView,
          'argPackAdvance': 8,
          'readValueFromPointer': decodeMemoryView,
      }, {
          ignoreDuplicateRegistrations: true,
      });
    }

   
  Module["_pthread_self"] = _pthread_self;

  function ___syscall140(which, varargs) {SYSCALLS.varargs = varargs;
  try {
   // llseek
      var stream = SYSCALLS.getStreamFromFD(), offset_high = SYSCALLS.get(), offset_low = SYSCALLS.get(), result = SYSCALLS.get(), whence = SYSCALLS.get();
      var offset = offset_low;
      assert(offset_high === 0);
      FS.llseek(stream, offset, whence);
      HEAP32[((result)>>2)]=stream.position;
      if (stream.getdents && offset === 0 && whence === 0) stream.getdents = null; // reset readdir state
      return 0;
    } catch (e) {
    if (typeof FS === 'undefined' || !(e instanceof FS.ErrnoError)) abort(e);
    return -e.errno;
  }
  }

  function __emval_incref(handle) {
      if (handle > 4) {
          emval_handle_array[handle].refcount += 1;
      }
    }

  function ___syscall146(which, varargs) {SYSCALLS.varargs = varargs;
  try {
   // writev
      // hack to support printf in NO_FILESYSTEM
      var stream = SYSCALLS.get(), iov = SYSCALLS.get(), iovcnt = SYSCALLS.get();
      var ret = 0;
      if (!___syscall146.buffer) {
        ___syscall146.buffers = [null, [], []]; // 1 => stdout, 2 => stderr
        ___syscall146.printChar = function(stream, curr) {
          var buffer = ___syscall146.buffers[stream];
          assert(buffer);
          if (curr === 0 || curr === 10) {
            (stream === 1 ? Module['print'] : Module['printErr'])(UTF8ArrayToString(buffer, 0));
            buffer.length = 0;
          } else {
            buffer.push(curr);
          }
        };
      }
      for (var i = 0; i < iovcnt; i++) {
        var ptr = HEAP32[(((iov)+(i*8))>>2)];
        var len = HEAP32[(((iov)+(i*8 + 4))>>2)];
        for (var j = 0; j < len; j++) {
          ___syscall146.printChar(stream, HEAPU8[ptr+j]);
        }
        ret += len;
      }
      return ret;
    } catch (e) {
    if (typeof FS === 'undefined' || !(e instanceof FS.ErrnoError)) abort(e);
    return -e.errno;
  }
  }

  
  
  function new_(constructor, argumentList) {
      if (!(constructor instanceof Function)) {
          throw new TypeError('new_ called with constructor type ' + typeof(constructor) + " which is not a function");
      }
  
      /*
       * Previously, the following line was just:
  
       function dummy() {};
  
       * Unfortunately, Chrome was preserving 'dummy' as the object's name, even though at creation, the 'dummy' has the
       * correct constructor name.  Thus, objects created with IMVU.new would show up in the debugger as 'dummy', which
       * isn't very helpful.  Using IMVU.createNamedFunction addresses the issue.  Doublely-unfortunately, there's no way
       * to write a test for this behavior.  -NRD 2013.02.22
       */
      var dummy = createNamedFunction(constructor.name || 'unknownFunctionName', function(){});
      dummy.prototype = constructor.prototype;
      var obj = new dummy;
  
      var r = constructor.apply(obj, argumentList);
      return (r instanceof Object) ? r : obj;
    }function craftInvokerFunction(humanName, argTypes, classType, cppInvokerFunc, cppTargetFunc) {
      // humanName: a human-readable string name for the function to be generated.
      // argTypes: An array that contains the embind type objects for all types in the function signature.
      //    argTypes[0] is the type object for the function return value.
      //    argTypes[1] is the type object for function this object/class type, or null if not crafting an invoker for a class method.
      //    argTypes[2...] are the actual function parameters.
      // classType: The embind type object for the class to be bound, or null if this is not a method of a class.
      // cppInvokerFunc: JS Function object to the C++-side function that interops into C++ code.
      // cppTargetFunc: Function pointer (an integer to FUNCTION_TABLE) to the target C++ function the cppInvokerFunc will end up calling.
      var argCount = argTypes.length;
  
      if (argCount < 2) {
          throwBindingError("argTypes array size mismatch! Must at least get return value and 'this' types!");
      }
  
      var isClassMethodFunc = (argTypes[1] !== null && classType !== null);
  
      // Free functions with signature "void function()" do not need an invoker that marshalls between wire types.
  // TODO: This omits argument count check - enable only at -O3 or similar.
  //    if (ENABLE_UNSAFE_OPTS && argCount == 2 && argTypes[0].name == "void" && !isClassMethodFunc) {
  //       return FUNCTION_TABLE[fn];
  //    }
  
      var argsList = "";
      var argsListWired = "";
      for(var i = 0; i < argCount - 2; ++i) {
          argsList += (i!==0?", ":"")+"arg"+i;
          argsListWired += (i!==0?", ":"")+"arg"+i+"Wired";
      }
  
      var invokerFnBody =
          "return function "+makeLegalFunctionName(humanName)+"("+argsList+") {\n" +
          "if (arguments.length !== "+(argCount - 2)+") {\n" +
              "throwBindingError('function "+humanName+" called with ' + arguments.length + ' arguments, expected "+(argCount - 2)+" args!');\n" +
          "}\n";
  
  
      // Determine if we need to use a dynamic stack to store the destructors for the function parameters.
      // TODO: Remove this completely once all function invokers are being dynamically generated.
      var needsDestructorStack = false;
  
      for(var i = 1; i < argTypes.length; ++i) { // Skip return value at index 0 - it's not deleted here.
          if (argTypes[i] !== null && argTypes[i].destructorFunction === undefined) { // The type does not define a destructor function - must use dynamic stack
              needsDestructorStack = true;
              break;
          }
      }
  
      if (needsDestructorStack) {
          invokerFnBody +=
              "var destructors = [];\n";
      }
  
      var dtorStack = needsDestructorStack ? "destructors" : "null";
      var args1 = ["throwBindingError", "invoker", "fn", "runDestructors", "retType", "classParam"];
      var args2 = [throwBindingError, cppInvokerFunc, cppTargetFunc, runDestructors, argTypes[0], argTypes[1]];
  
  
      if (isClassMethodFunc) {
          invokerFnBody += "var thisWired = classParam.toWireType("+dtorStack+", this);\n";
      }
  
      for(var i = 0; i < argCount - 2; ++i) {
          invokerFnBody += "var arg"+i+"Wired = argType"+i+".toWireType("+dtorStack+", arg"+i+"); // "+argTypes[i+2].name+"\n";
          args1.push("argType"+i);
          args2.push(argTypes[i+2]);
      }
  
      if (isClassMethodFunc) {
          argsListWired = "thisWired" + (argsListWired.length > 0 ? ", " : "") + argsListWired;
      }
  
      var returns = (argTypes[0].name !== "void");
  
      invokerFnBody +=
          (returns?"var rv = ":"") + "invoker(fn"+(argsListWired.length>0?", ":"")+argsListWired+");\n";
  
      if (needsDestructorStack) {
          invokerFnBody += "runDestructors(destructors);\n";
      } else {
          for(var i = isClassMethodFunc?1:2; i < argTypes.length; ++i) { // Skip return value at index 0 - it's not deleted here. Also skip class type if not a method.
              var paramName = (i === 1 ? "thisWired" : ("arg"+(i - 2)+"Wired"));
              if (argTypes[i].destructorFunction !== null) {
                  invokerFnBody += paramName+"_dtor("+paramName+"); // "+argTypes[i].name+"\n";
                  args1.push(paramName+"_dtor");
                  args2.push(argTypes[i].destructorFunction);
              }
          }
      }
  
      if (returns) {
          invokerFnBody += "var ret = retType.fromWireType(rv);\n" +
                           "return ret;\n";
      } else {
      }
      invokerFnBody += "}\n";
  
      args1.push(invokerFnBody);
  
      var invokerFunction = new_(Function, args1).apply(null, args2);
      return invokerFunction;
    }function __embind_register_class_function(
      rawClassType,
      methodName,
      argCount,
      rawArgTypesAddr, // [ReturnType, ThisType, Args...]
      invokerSignature,
      rawInvoker,
      context,
      isPureVirtual
    ) {
      var rawArgTypes = heap32VectorToArray(argCount, rawArgTypesAddr);
      methodName = readLatin1String(methodName);
      rawInvoker = requireFunction(invokerSignature, rawInvoker);
  
      whenDependentTypesAreResolved([], [rawClassType], function(classType) {
          classType = classType[0];
          var humanName = classType.name + '.' + methodName;
  
          if (isPureVirtual) {
              classType.registeredClass.pureVirtualFunctions.push(methodName);
          }
  
          function unboundTypesHandler() {
              throwUnboundTypeError('Cannot call ' + humanName + ' due to unbound types', rawArgTypes);
          }
  
          var proto = classType.registeredClass.instancePrototype;
          var method = proto[methodName];
          if (undefined === method || (undefined === method.overloadTable && method.className !== classType.name && method.argCount === argCount - 2)) {
              // This is the first overload to be registered, OR we are replacing a function in the base class with a function in the derived class.
              unboundTypesHandler.argCount = argCount - 2;
              unboundTypesHandler.className = classType.name;
              proto[methodName] = unboundTypesHandler;
          } else {
              // There was an existing function with the same name registered. Set up a function overload routing table.
              ensureOverloadTable(proto, methodName, humanName);
              proto[methodName].overloadTable[argCount - 2] = unboundTypesHandler;
          }
  
          whenDependentTypesAreResolved([], rawArgTypes, function(argTypes) {
  
              var memberFunction = craftInvokerFunction(humanName, argTypes, classType, rawInvoker, context);
  
              // Replace the initial unbound-handler-stub function with the appropriate member function, now that all types
              // are resolved. If multiple overloads are registered for this function, the function goes into an overload table.
              if (undefined === proto[methodName].overloadTable) {
                  // Set argCount in case an overload is registered later
                  memberFunction.argCount = argCount - 2;
                  proto[methodName] = memberFunction;
              } else {
                  proto[methodName].overloadTable[argCount - 2] = memberFunction;
              }
  
              return [];
          });
          return [];
      });
    }
embind_init_charCodes();
BindingError = Module['BindingError'] = extendError(Error, 'BindingError');;
InternalError = Module['InternalError'] = extendError(Error, 'InternalError');;
init_ClassHandle();
init_RegisteredPointer();
init_embind();;
UnboundTypeError = Module['UnboundTypeError'] = extendError(Error, 'UnboundTypeError');;
init_emval();;
/* flush anything remaining in the buffer during shutdown */ __ATEXIT__.push(function() { var fflush = Module["_fflush"]; if (fflush) fflush(0); var printChar = ___syscall146.printChar; if (!printChar) return; var buffers = ___syscall146.buffers; if (buffers[1].length) printChar(1, 10); if (buffers[2].length) printChar(2, 10); });;
DYNAMICTOP_PTR = allocate(1, "i32", ALLOC_STATIC);

STACK_BASE = STACKTOP = Runtime.alignMemory(STATICTOP);

STACK_MAX = STACK_BASE + TOTAL_STACK;

DYNAMIC_BASE = Runtime.alignMemory(STACK_MAX);

HEAP32[DYNAMICTOP_PTR>>2] = DYNAMIC_BASE;

staticSealed = true; // seal the static portion of memory



function invoke_vi(index,a1) {
  try {
    Module["dynCall_vi"](index,a1);
  } catch(e) {
    if (typeof e !== 'number' && e !== 'longjmp') throw e;
    asm["setThrew"](1, 0);
  }
}

function invoke_iiii(index,a1,a2,a3) {
  try {
    return Module["dynCall_iiii"](index,a1,a2,a3);
  } catch(e) {
    if (typeof e !== 'number' && e !== 'longjmp') throw e;
    asm["setThrew"](1, 0);
  }
}

function invoke_iididi(index,a1,a2,a3,a4,a5) {
  try {
    return Module["dynCall_iididi"](index,a1,a2,a3,a4,a5);
  } catch(e) {
    if (typeof e !== 'number' && e !== 'longjmp') throw e;
    asm["setThrew"](1, 0);
  }
}

function invoke_dii(index,a1,a2) {
  try {
    return Module["dynCall_dii"](index,a1,a2);
  } catch(e) {
    if (typeof e !== 'number' && e !== 'longjmp') throw e;
    asm["setThrew"](1, 0);
  }
}

function invoke_viiiii(index,a1,a2,a3,a4,a5) {
  try {
    Module["dynCall_viiiii"](index,a1,a2,a3,a4,a5);
  } catch(e) {
    if (typeof e !== 'number' && e !== 'longjmp') throw e;
    asm["setThrew"](1, 0);
  }
}

function invoke_i(index) {
  try {
    return Module["dynCall_i"](index);
  } catch(e) {
    if (typeof e !== 'number' && e !== 'longjmp') throw e;
    asm["setThrew"](1, 0);
  }
}

function invoke_iii(index,a1,a2) {
  try {
    return Module["dynCall_iii"](index,a1,a2);
  } catch(e) {
    if (typeof e !== 'number' && e !== 'longjmp') throw e;
    asm["setThrew"](1, 0);
  }
}

function invoke_vii(index,a1,a2) {
  try {
    Module["dynCall_vii"](index,a1,a2);
  } catch(e) {
    if (typeof e !== 'number' && e !== 'longjmp') throw e;
    asm["setThrew"](1, 0);
  }
}

function invoke_ii(index,a1) {
  try {
    return Module["dynCall_ii"](index,a1);
  } catch(e) {
    if (typeof e !== 'number' && e !== 'longjmp') throw e;
    asm["setThrew"](1, 0);
  }
}

function invoke_iididii(index,a1,a2,a3,a4,a5,a6) {
  try {
    return Module["dynCall_iididii"](index,a1,a2,a3,a4,a5,a6);
  } catch(e) {
    if (typeof e !== 'number' && e !== 'longjmp') throw e;
    asm["setThrew"](1, 0);
  }
}

function invoke_viii(index,a1,a2,a3) {
  try {
    Module["dynCall_viii"](index,a1,a2,a3);
  } catch(e) {
    if (typeof e !== 'number' && e !== 'longjmp') throw e;
    asm["setThrew"](1, 0);
  }
}

function invoke_v(index) {
  try {
    Module["dynCall_v"](index);
  } catch(e) {
    if (typeof e !== 'number' && e !== 'longjmp') throw e;
    asm["setThrew"](1, 0);
  }
}

function invoke_viid(index,a1,a2,a3) {
  try {
    Module["dynCall_viid"](index,a1,a2,a3);
  } catch(e) {
    if (typeof e !== 'number' && e !== 'longjmp') throw e;
    asm["setThrew"](1, 0);
  }
}

function invoke_iiiii(index,a1,a2,a3,a4) {
  try {
    return Module["dynCall_iiiii"](index,a1,a2,a3,a4);
  } catch(e) {
    if (typeof e !== 'number' && e !== 'longjmp') throw e;
    asm["setThrew"](1, 0);
  }
}

function invoke_viiiiii(index,a1,a2,a3,a4,a5,a6) {
  try {
    Module["dynCall_viiiiii"](index,a1,a2,a3,a4,a5,a6);
  } catch(e) {
    if (typeof e !== 'number' && e !== 'longjmp') throw e;
    asm["setThrew"](1, 0);
  }
}

function invoke_iidid(index,a1,a2,a3,a4) {
  try {
    return Module["dynCall_iidid"](index,a1,a2,a3,a4);
  } catch(e) {
    if (typeof e !== 'number' && e !== 'longjmp') throw e;
    asm["setThrew"](1, 0);
  }
}

function invoke_iiiiii(index,a1,a2,a3,a4,a5) {
  try {
    return Module["dynCall_iiiiii"](index,a1,a2,a3,a4,a5);
  } catch(e) {
    if (typeof e !== 'number' && e !== 'longjmp') throw e;
    asm["setThrew"](1, 0);
  }
}

function invoke_viiii(index,a1,a2,a3,a4) {
  try {
    Module["dynCall_viiii"](index,a1,a2,a3,a4);
  } catch(e) {
    if (typeof e !== 'number' && e !== 'longjmp') throw e;
    asm["setThrew"](1, 0);
  }
}

Module.asmGlobalArg = { "Math": Math, "Int8Array": Int8Array, "Int16Array": Int16Array, "Int32Array": Int32Array, "Uint8Array": Uint8Array, "Uint16Array": Uint16Array, "Uint32Array": Uint32Array, "Float32Array": Float32Array, "Float64Array": Float64Array, "NaN": NaN, "Infinity": Infinity };

Module.asmLibraryArg = { "abort": abort, "assert": assert, "enlargeMemory": enlargeMemory, "getTotalMemory": getTotalMemory, "abortOnCannotGrowMemory": abortOnCannotGrowMemory, "invoke_vi": invoke_vi, "invoke_iiii": invoke_iiii, "invoke_iididi": invoke_iididi, "invoke_dii": invoke_dii, "invoke_viiiii": invoke_viiiii, "invoke_i": invoke_i, "invoke_iii": invoke_iii, "invoke_vii": invoke_vii, "invoke_ii": invoke_ii, "invoke_iididii": invoke_iididii, "invoke_viii": invoke_viii, "invoke_v": invoke_v, "invoke_viid": invoke_viid, "invoke_iiiii": invoke_iiiii, "invoke_viiiiii": invoke_viiiiii, "invoke_iidid": invoke_iidid, "invoke_iiiiii": invoke_iiiiii, "invoke_viiii": invoke_viiii, "floatReadValueFromPointer": floatReadValueFromPointer, "simpleReadValueFromPointer": simpleReadValueFromPointer, "throwInternalError": throwInternalError, "get_first_emval": get_first_emval, "getLiveInheritedInstances": getLiveInheritedInstances, "___assert_fail": ___assert_fail, "__ZSt18uncaught_exceptionv": __ZSt18uncaught_exceptionv, "ClassHandle": ClassHandle, "getShiftFromSize": getShiftFromSize, "___cxa_begin_catch": ___cxa_begin_catch, "_emscripten_memcpy_big": _emscripten_memcpy_big, "runDestructor": runDestructor, "throwInstanceAlreadyDeleted": throwInstanceAlreadyDeleted, "__embind_register_std_string": __embind_register_std_string, "init_RegisteredPointer": init_RegisteredPointer, "ClassHandle_isAliasOf": ClassHandle_isAliasOf, "flushPendingDeletes": flushPendingDeletes, "makeClassHandle": makeClassHandle, "whenDependentTypesAreResolved": whenDependentTypesAreResolved, "__embind_register_class_constructor": __embind_register_class_constructor, "__embind_finalize_value_array": __embind_finalize_value_array, "init_ClassHandle": init_ClassHandle, "_pthread_cleanup_push": _pthread_cleanup_push, "___syscall140": ___syscall140, "ClassHandle_clone": ClassHandle_clone, "___syscall146": ___syscall146, "_pthread_cleanup_pop": _pthread_cleanup_pop, "RegisteredClass": RegisteredClass, "___cxa_find_matching_catch": ___cxa_find_matching_catch, "embind_init_charCodes": embind_init_charCodes, "___setErrNo": ___setErrNo, "__embind_register_bool": __embind_register_bool, "___resumeException": ___resumeException, "createNamedFunction": createNamedFunction, "__embind_register_emval": __embind_register_emval, "__emval_decref": __emval_decref, "_pthread_once": _pthread_once, "__embind_register_class": __embind_register_class, "constNoSmartPtrRawPointerToWireType": constNoSmartPtrRawPointerToWireType, "heap32VectorToArray": heap32VectorToArray, "ClassHandle_delete": ClassHandle_delete, "RegisteredPointer_destructor": RegisteredPointer_destructor, "___syscall6": ___syscall6, "ensureOverloadTable": ensureOverloadTable, "new_": new_, "downcastPointer": downcastPointer, "replacePublicSymbol": replacePublicSymbol, "init_embind": init_embind, "ClassHandle_deleteLater": ClassHandle_deleteLater, "integerReadValueFromPointer": integerReadValueFromPointer, "RegisteredPointer_deleteObject": RegisteredPointer_deleteObject, "ClassHandle_isDeleted": ClassHandle_isDeleted, "__embind_register_integer": __embind_register_integer, "___cxa_allocate_exception": ___cxa_allocate_exception, "__emval_take_value": __emval_take_value, "_embind_repr": _embind_repr, "_pthread_getspecific": _pthread_getspecific, "throwUnboundTypeError": throwUnboundTypeError, "craftInvokerFunction": craftInvokerFunction, "runDestructors": runDestructors, "requireRegisteredType": requireRegisteredType, "makeLegalFunctionName": makeLegalFunctionName, "_pthread_key_create": _pthread_key_create, "upcastPointer": upcastPointer, "init_emval": init_emval, "shallowCopyInternalPointer": shallowCopyInternalPointer, "nonConstNoSmartPtrRawPointerToWireType": nonConstNoSmartPtrRawPointerToWireType, "__embind_register_value_array": __embind_register_value_array, "_abort": _abort, "throwBindingError": throwBindingError, "getTypeName": getTypeName, "exposePublicSymbol": exposePublicSymbol, "RegisteredPointer_fromWireType": RegisteredPointer_fromWireType, "___lock": ___lock, "__embind_register_value_array_element": __embind_register_value_array_element, "__embind_register_memory_view": __embind_register_memory_view, "getInheritedInstance": getInheritedInstance, "setDelayFunction": setDelayFunction, "___gxx_personality_v0": ___gxx_personality_v0, "extendError": extendError, "__embind_register_void": __embind_register_void, "RegisteredPointer_getPointee": RegisteredPointer_getPointee, "__emval_register": __emval_register, "__embind_register_std_wstring": __embind_register_std_wstring, "__embind_register_class_function": __embind_register_class_function, "__emval_incref": __emval_incref, "RegisteredPointer": RegisteredPointer, "readLatin1String": readLatin1String, "getBasestPointer": getBasestPointer, "getInheritedInstanceCount": getInheritedInstanceCount, "__embind_register_float": __embind_register_float, "___syscall54": ___syscall54, "___unlock": ___unlock, "_pthread_setspecific": _pthread_setspecific, "genericPointerToWireType": genericPointerToWireType, "registerType": registerType, "___cxa_throw": ___cxa_throw, "count_emval_handles": count_emval_handles, "requireFunction": requireFunction, "DYNAMICTOP_PTR": DYNAMICTOP_PTR, "tempDoublePtr": tempDoublePtr, "ABORT": ABORT, "STACKTOP": STACKTOP, "STACK_MAX": STACK_MAX, "cttz_i8": cttz_i8 };
// EMSCRIPTEN_START_ASM
var asm = (function(global, env, buffer) {
  'use asm';
  
  
  var HEAP8 = new global.Int8Array(buffer);
  var HEAP16 = new global.Int16Array(buffer);
  var HEAP32 = new global.Int32Array(buffer);
  var HEAPU8 = new global.Uint8Array(buffer);
  var HEAPU16 = new global.Uint16Array(buffer);
  var HEAPU32 = new global.Uint32Array(buffer);
  var HEAPF32 = new global.Float32Array(buffer);
  var HEAPF64 = new global.Float64Array(buffer);


  var DYNAMICTOP_PTR=env.DYNAMICTOP_PTR|0;
  var tempDoublePtr=env.tempDoublePtr|0;
  var ABORT=env.ABORT|0;
  var STACKTOP=env.STACKTOP|0;
  var STACK_MAX=env.STACK_MAX|0;
  var cttz_i8=env.cttz_i8|0;

  var __THREW__ = 0;
  var threwValue = 0;
  var setjmpId = 0;
  var undef = 0;
  var nan = global.NaN, inf = global.Infinity;
  var tempInt = 0, tempBigInt = 0, tempBigIntP = 0, tempBigIntS = 0, tempBigIntR = 0.0, tempBigIntI = 0, tempBigIntD = 0, tempValue = 0, tempDouble = 0.0;
  var tempRet0 = 0;

  var Math_floor=global.Math.floor;
  var Math_abs=global.Math.abs;
  var Math_sqrt=global.Math.sqrt;
  var Math_pow=global.Math.pow;
  var Math_cos=global.Math.cos;
  var Math_sin=global.Math.sin;
  var Math_tan=global.Math.tan;
  var Math_acos=global.Math.acos;
  var Math_asin=global.Math.asin;
  var Math_atan=global.Math.atan;
  var Math_atan2=global.Math.atan2;
  var Math_exp=global.Math.exp;
  var Math_log=global.Math.log;
  var Math_ceil=global.Math.ceil;
  var Math_imul=global.Math.imul;
  var Math_min=global.Math.min;
  var Math_max=global.Math.max;
  var Math_clz32=global.Math.clz32;
  var abort=env.abort;
  var assert=env.assert;
  var enlargeMemory=env.enlargeMemory;
  var getTotalMemory=env.getTotalMemory;
  var abortOnCannotGrowMemory=env.abortOnCannotGrowMemory;
  var invoke_vi=env.invoke_vi;
  var invoke_iiii=env.invoke_iiii;
  var invoke_iididi=env.invoke_iididi;
  var invoke_dii=env.invoke_dii;
  var invoke_viiiii=env.invoke_viiiii;
  var invoke_i=env.invoke_i;
  var invoke_iii=env.invoke_iii;
  var invoke_vii=env.invoke_vii;
  var invoke_ii=env.invoke_ii;
  var invoke_iididii=env.invoke_iididii;
  var invoke_viii=env.invoke_viii;
  var invoke_v=env.invoke_v;
  var invoke_viid=env.invoke_viid;
  var invoke_iiiii=env.invoke_iiiii;
  var invoke_viiiiii=env.invoke_viiiiii;
  var invoke_iidid=env.invoke_iidid;
  var invoke_iiiiii=env.invoke_iiiiii;
  var invoke_viiii=env.invoke_viiii;
  var floatReadValueFromPointer=env.floatReadValueFromPointer;
  var simpleReadValueFromPointer=env.simpleReadValueFromPointer;
  var throwInternalError=env.throwInternalError;
  var get_first_emval=env.get_first_emval;
  var getLiveInheritedInstances=env.getLiveInheritedInstances;
  var ___assert_fail=env.___assert_fail;
  var __ZSt18uncaught_exceptionv=env.__ZSt18uncaught_exceptionv;
  var ClassHandle=env.ClassHandle;
  var getShiftFromSize=env.getShiftFromSize;
  var ___cxa_begin_catch=env.___cxa_begin_catch;
  var _emscripten_memcpy_big=env._emscripten_memcpy_big;
  var runDestructor=env.runDestructor;
  var throwInstanceAlreadyDeleted=env.throwInstanceAlreadyDeleted;
  var __embind_register_std_string=env.__embind_register_std_string;
  var init_RegisteredPointer=env.init_RegisteredPointer;
  var ClassHandle_isAliasOf=env.ClassHandle_isAliasOf;
  var flushPendingDeletes=env.flushPendingDeletes;
  var makeClassHandle=env.makeClassHandle;
  var whenDependentTypesAreResolved=env.whenDependentTypesAreResolved;
  var __embind_register_class_constructor=env.__embind_register_class_constructor;
  var __embind_finalize_value_array=env.__embind_finalize_value_array;
  var init_ClassHandle=env.init_ClassHandle;
  var _pthread_cleanup_push=env._pthread_cleanup_push;
  var ___syscall140=env.___syscall140;
  var ClassHandle_clone=env.ClassHandle_clone;
  var ___syscall146=env.___syscall146;
  var _pthread_cleanup_pop=env._pthread_cleanup_pop;
  var RegisteredClass=env.RegisteredClass;
  var ___cxa_find_matching_catch=env.___cxa_find_matching_catch;
  var embind_init_charCodes=env.embind_init_charCodes;
  var ___setErrNo=env.___setErrNo;
  var __embind_register_bool=env.__embind_register_bool;
  var ___resumeException=env.___resumeException;
  var createNamedFunction=env.createNamedFunction;
  var __embind_register_emval=env.__embind_register_emval;
  var __emval_decref=env.__emval_decref;
  var _pthread_once=env._pthread_once;
  var __embind_register_class=env.__embind_register_class;
  var constNoSmartPtrRawPointerToWireType=env.constNoSmartPtrRawPointerToWireType;
  var heap32VectorToArray=env.heap32VectorToArray;
  var ClassHandle_delete=env.ClassHandle_delete;
  var RegisteredPointer_destructor=env.RegisteredPointer_destructor;
  var ___syscall6=env.___syscall6;
  var ensureOverloadTable=env.ensureOverloadTable;
  var new_=env.new_;
  var downcastPointer=env.downcastPointer;
  var replacePublicSymbol=env.replacePublicSymbol;
  var init_embind=env.init_embind;
  var ClassHandle_deleteLater=env.ClassHandle_deleteLater;
  var integerReadValueFromPointer=env.integerReadValueFromPointer;
  var RegisteredPointer_deleteObject=env.RegisteredPointer_deleteObject;
  var ClassHandle_isDeleted=env.ClassHandle_isDeleted;
  var __embind_register_integer=env.__embind_register_integer;
  var ___cxa_allocate_exception=env.___cxa_allocate_exception;
  var __emval_take_value=env.__emval_take_value;
  var _embind_repr=env._embind_repr;
  var _pthread_getspecific=env._pthread_getspecific;
  var throwUnboundTypeError=env.throwUnboundTypeError;
  var craftInvokerFunction=env.craftInvokerFunction;
  var runDestructors=env.runDestructors;
  var requireRegisteredType=env.requireRegisteredType;
  var makeLegalFunctionName=env.makeLegalFunctionName;
  var _pthread_key_create=env._pthread_key_create;
  var upcastPointer=env.upcastPointer;
  var init_emval=env.init_emval;
  var shallowCopyInternalPointer=env.shallowCopyInternalPointer;
  var nonConstNoSmartPtrRawPointerToWireType=env.nonConstNoSmartPtrRawPointerToWireType;
  var __embind_register_value_array=env.__embind_register_value_array;
  var _abort=env._abort;
  var throwBindingError=env.throwBindingError;
  var getTypeName=env.getTypeName;
  var exposePublicSymbol=env.exposePublicSymbol;
  var RegisteredPointer_fromWireType=env.RegisteredPointer_fromWireType;
  var ___lock=env.___lock;
  var __embind_register_value_array_element=env.__embind_register_value_array_element;
  var __embind_register_memory_view=env.__embind_register_memory_view;
  var getInheritedInstance=env.getInheritedInstance;
  var setDelayFunction=env.setDelayFunction;
  var ___gxx_personality_v0=env.___gxx_personality_v0;
  var extendError=env.extendError;
  var __embind_register_void=env.__embind_register_void;
  var RegisteredPointer_getPointee=env.RegisteredPointer_getPointee;
  var __emval_register=env.__emval_register;
  var __embind_register_std_wstring=env.__embind_register_std_wstring;
  var __embind_register_class_function=env.__embind_register_class_function;
  var __emval_incref=env.__emval_incref;
  var RegisteredPointer=env.RegisteredPointer;
  var readLatin1String=env.readLatin1String;
  var getBasestPointer=env.getBasestPointer;
  var getInheritedInstanceCount=env.getInheritedInstanceCount;
  var __embind_register_float=env.__embind_register_float;
  var ___syscall54=env.___syscall54;
  var ___unlock=env.___unlock;
  var _pthread_setspecific=env._pthread_setspecific;
  var genericPointerToWireType=env.genericPointerToWireType;
  var registerType=env.registerType;
  var ___cxa_throw=env.___cxa_throw;
  var count_emval_handles=env.count_emval_handles;
  var requireFunction=env.requireFunction;
  var tempFloat = 0.0;

// EMSCRIPTEN_START_FUNCS

function stackAlloc(size) {
  size = size|0;
  var ret = 0;
  ret = STACKTOP;
  STACKTOP = (STACKTOP + size)|0;
  STACKTOP = (STACKTOP + 15)&-16;

  return ret|0;
}
function stackSave() {
  return STACKTOP|0;
}
function stackRestore(top) {
  top = top|0;
  STACKTOP = top;
}
function establishStackSpace(stackBase, stackMax) {
  stackBase = stackBase|0;
  stackMax = stackMax|0;
  STACKTOP = stackBase;
  STACK_MAX = stackMax;
}

function setThrew(threw, value) {
  threw = threw|0;
  value = value|0;
  if ((__THREW__|0) == 0) {
    __THREW__ = threw;
    threwValue = value;
  }
}

function setTempRet0(value) {
  value = value|0;
  tempRet0 = value;
}
function getTempRet0() {
  return tempRet0|0;
}

function ___cxx_global_var_init() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 __ZN38EmscriptenBindingInitializer_my_moduleC2Ev(0);
 return;
}
function __ZN38EmscriptenBindingInitializer_my_moduleC2Ev($0) {
 $0 = $0|0;
 var $$byval_copy27 = 0, $$fca$1$gep$i = 0, $$fca$1$gep$i16 = 0, $$fca$1$gep$i22 = 0, $$fca$1$gep$i28 = 0, $$fca$1$gep$i34 = 0, $1 = 0, $10 = 0, $100 = 0, $101 = 0, $102 = 0, $103 = 0, $104 = 0, $105 = 0, $106 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0;
 var $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0, $27 = 0, $28 = 0, $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0;
 var $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0, $41 = 0, $42 = 0, $43 = 0, $44 = 0, $45 = 0, $46 = 0, $47 = 0, $48 = 0, $49 = 0, $5 = 0, $50 = 0, $51 = 0;
 var $52 = 0, $53 = 0, $54 = 0, $55 = 0, $56 = 0, $57 = 0, $58 = 0, $59 = 0, $6 = 0, $60 = 0, $61 = 0, $62 = 0, $63 = 0, $64 = 0, $65 = 0, $66 = 0, $67 = 0, $68 = 0, $69 = 0, $7 = 0;
 var $70 = 0, $71 = 0, $72 = 0, $73 = 0, $74 = 0, $75 = 0, $76 = 0, $77 = 0, $78 = 0, $79 = 0, $8 = 0, $80 = 0, $81 = 0, $82 = 0, $83 = 0, $84 = 0, $85 = 0, $86 = 0, $87 = 0, $88 = 0;
 var $89 = 0, $9 = 0, $90 = 0, $91 = 0, $92 = 0, $93 = 0, $94 = 0, $95 = 0, $96 = 0, $97 = 0, $98 = 0, $99 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 48|0;
 $$byval_copy27 = sp;
 $1 = sp + 12|0;
 $2 = sp + 40|0;
 $3 = sp + 39|0;
 $4 = sp + 38|0;
 $5 = sp + 37|0;
 $6 = sp + 36|0;
 $7 = sp + 35|0;
 $8 = sp + 34|0;
 $9 = sp + 33|0;
 $10 = sp + 32|0;
 $11 = sp + 31|0;
 $12 = sp + 30|0;
 $13 = sp + 29|0;
 $14 = sp + 28|0;
 $15 = sp + 27|0;
 $16 = sp + 26|0;
 $17 = sp + 25|0;
 $18 = sp + 24|0;
 $19 = sp + 23|0;
 $20 = sp + 22|0;
 $21 = sp + 21|0;
 $22 = sp + 20|0;
 $23 = sp + 19|0;
 $24 = sp + 18|0;
 $25 = sp + 17|0;
 $26 = sp + 16|0;
 $27 = sp + 15|0;
 $28 = sp + 14|0;
 $29 = sp + 13|0;
 $30 = sp + 11|0;
 $31 = sp + 10|0;
 $32 = sp + 9|0;
 $33 = sp + 8|0;
 __ZN10emscripten8internal11NoBaseClass6verifyI13emOctaTerrainEEvv();
 $34 = (__ZN10emscripten8internal11NoBaseClass11getUpcasterI13emOctaTerrainEEPFvvEv()|0);
 $35 = (__ZN10emscripten8internal11NoBaseClass13getDowncasterI13emOctaTerrainEEPFvvEv()|0);
 $36 = (__ZN10emscripten8internal6TypeIDI13emOctaTerrainE3getEv()|0);
 $37 = (__ZN10emscripten8internal6TypeIDINS0_17AllowedRawPointerI13emOctaTerrainEEE3getEv()|0);
 $38 = (__ZN10emscripten8internal6TypeIDINS0_17AllowedRawPointerIK13emOctaTerrainEEE3getEv()|0);
 $39 = (__ZN10emscripten8internal11NoBaseClass3getEv()|0);
 $40 = (__ZN10emscripten8internal19getGenericSignatureIJiiEEEPKcv()|0);
 $41 = (__ZN10emscripten8internal19getGenericSignatureIJvEEEPKcv()|0);
 $42 = (__ZN10emscripten8internal19getGenericSignatureIJvEEEPKcv()|0);
 $43 = (__ZN10emscripten8internal19getGenericSignatureIJviEEEPKcv()|0);
 __embind_register_class(($36|0),($37|0),($38|0),($39|0),($40|0),(3|0),($41|0),($34|0),($42|0),($35|0),(1372|0),($43|0),(11|0));
 $44 = (__ZN10emscripten8internal6TypeIDI13emOctaTerrainE3getEv()|0);
 $45 = (__ZNK10emscripten8internal12WithPoliciesIJNS_18allow_raw_pointersEEE11ArgTypeListIJP13emOctaTerrainOfOiS7_EE8getCountEv($$byval_copy27)|0);
 $46 = (__ZNK10emscripten8internal12WithPoliciesIJNS_18allow_raw_pointersEEE11ArgTypeListIJP13emOctaTerrainOfOiS7_EE8getTypesEv($$byval_copy27)|0);
 $47 = (__ZN10emscripten8internal19getGenericSignatureIJiififEEEPKcv()|0);
 __embind_register_class_constructor(($44|0),($45|0),($46|0),($47|0),(1|0),(7|0));
 $48 = (__ZN10emscripten8internal6TypeIDI13emOctaTerrainE3getEv()|0);
 $49 = (__ZNK10emscripten8internal12WithPoliciesIJNS_18allow_raw_pointersEEE11ArgTypeListIJP13emOctaTerrainOfOiS7_ObEE8getCountEv($$byval_copy27)|0);
 $50 = (__ZNK10emscripten8internal12WithPoliciesIJNS_18allow_raw_pointersEEE11ArgTypeListIJP13emOctaTerrainOfOiS7_ObEE8getTypesEv($$byval_copy27)|0);
 $51 = (__ZN10emscripten8internal19getGenericSignatureIJiififiEEEPKcv()|0);
 __embind_register_class_constructor(($48|0),($49|0),($50|0),($51|0),(1|0),(1|0));
 $52 = (__ZN10emscripten8internal6TypeIDI13emOctaTerrainE3getEv()|0);
 $53 = (__ZNK10emscripten8internal12WithPoliciesIJNS_18allow_raw_pointersEEE11ArgTypeListIJP13emOctaTerrainOfOiS7_ObS9_EE8getCountEv($$byval_copy27)|0);
 $54 = (__ZNK10emscripten8internal12WithPoliciesIJNS_18allow_raw_pointersEEE11ArgTypeListIJP13emOctaTerrainOfOiS7_ObS9_EE8getTypesEv($$byval_copy27)|0);
 $55 = (__ZN10emscripten8internal19getGenericSignatureIJiififiiEEEPKcv()|0);
 __embind_register_class_constructor(($52|0),($53|0),($54|0),($55|0),(1|0),(1|0));
 HEAP32[$$byval_copy27>>2] = (4);
 $$fca$1$gep$i = ((($$byval_copy27)) + 4|0);
 HEAP32[$$fca$1$gep$i>>2] = 0;
 $56 = (__ZN10emscripten8internal6TypeIDI13emOctaTerrainE3getEv()|0);
 $57 = (__ZNK10emscripten8internal12WithPoliciesIJEE11ArgTypeListIJvNS0_17AllowedRawPointerI13emOctaTerrainEE4vec34mat4NSt3__26vectorI7ChunkIdNS9_9allocatorISB_EEEEEE8getCountEv($1)|0);
 $58 = (__ZNK10emscripten8internal12WithPoliciesIJEE11ArgTypeListIJvNS0_17AllowedRawPointerI13emOctaTerrainEE4vec34mat4NSt3__26vectorI7ChunkIdNS9_9allocatorISB_EEEEEE8getTypesEv($1)|0);
 $59 = (__ZN10emscripten8internal19getGenericSignatureIJviiiiiEEEPKcv()|0);
 $60 = (__ZN10emscripten8internal10getContextIM13emOctaTerrainFv4vec34mat4NSt3__26vectorI7ChunkIdNS5_9allocatorIS7_EEEEEEEPT_RKSD_($$byval_copy27)|0);
 __embind_register_class_function(($56|0),(1384|0),($57|0),($58|0),($59|0),(4|0),($60|0),0);
 HEAP32[$$byval_copy27>>2] = (1);
 $$fca$1$gep$i16 = ((($$byval_copy27)) + 4|0);
 HEAP32[$$fca$1$gep$i16>>2] = 0;
 $61 = (__ZN10emscripten8internal6TypeIDI13emOctaTerrainE3getEv()|0);
 $62 = (__ZNK10emscripten8internal12WithPoliciesIJEE11ArgTypeListIJNSt3__26vectorI7ChunkIdNS4_9allocatorIS6_EEEENS0_17AllowedRawPointerI13emOctaTerrainEEEE8getCountEv($1)|0);
 $63 = (__ZNK10emscripten8internal12WithPoliciesIJEE11ArgTypeListIJNSt3__26vectorI7ChunkIdNS4_9allocatorIS6_EEEENS0_17AllowedRawPointerI13emOctaTerrainEEEE8getTypesEv($1)|0);
 $64 = (__ZN10emscripten8internal19getGenericSignatureIJiiiEEEPKcv()|0);
 $65 = (__ZN10emscripten8internal10getContextIM13emOctaTerrainFNSt3__26vectorI7ChunkIdNS3_9allocatorIS5_EEEEvEEEPT_RKSB_($$byval_copy27)|0);
 __embind_register_class_function(($61|0),(1393|0),($62|0),($63|0),($64|0),(1|0),($65|0),0);
 HEAP32[$$byval_copy27>>2] = (2);
 $$fca$1$gep$i22 = ((($$byval_copy27)) + 4|0);
 HEAP32[$$fca$1$gep$i22>>2] = 0;
 $66 = (__ZN10emscripten8internal6TypeIDI13emOctaTerrainE3getEv()|0);
 $67 = (__ZNK10emscripten8internal12WithPoliciesIJEE11ArgTypeListIJNSt3__26vectorI7ChunkIdNS4_9allocatorIS6_EEEENS0_17AllowedRawPointerI13emOctaTerrainEEEE8getCountEv($1)|0);
 $68 = (__ZNK10emscripten8internal12WithPoliciesIJEE11ArgTypeListIJNSt3__26vectorI7ChunkIdNS4_9allocatorIS6_EEEENS0_17AllowedRawPointerI13emOctaTerrainEEEE8getTypesEv($1)|0);
 $69 = (__ZN10emscripten8internal19getGenericSignatureIJiiiEEEPKcv()|0);
 $70 = (__ZN10emscripten8internal10getContextIM13emOctaTerrainFNSt3__26vectorI7ChunkIdNS3_9allocatorIS5_EEEEvEEEPT_RKSB_($$byval_copy27)|0);
 __embind_register_class_function(($66|0),(1402|0),($67|0),($68|0),($69|0),(1|0),($70|0),0);
 HEAP32[$$byval_copy27>>2] = (3);
 $$fca$1$gep$i28 = ((($$byval_copy27)) + 4|0);
 HEAP32[$$fca$1$gep$i28>>2] = 0;
 $71 = (__ZN10emscripten8internal6TypeIDI13emOctaTerrainE3getEv()|0);
 $72 = (__ZNK10emscripten8internal12WithPoliciesIJEE11ArgTypeListIJNSt3__26vectorI7ChunkIdNS4_9allocatorIS6_EEEENS0_17AllowedRawPointerI13emOctaTerrainEEEE8getCountEv($1)|0);
 $73 = (__ZNK10emscripten8internal12WithPoliciesIJEE11ArgTypeListIJNSt3__26vectorI7ChunkIdNS4_9allocatorIS6_EEEENS0_17AllowedRawPointerI13emOctaTerrainEEEE8getTypesEv($1)|0);
 $74 = (__ZN10emscripten8internal19getGenericSignatureIJiiiEEEPKcv()|0);
 $75 = (__ZN10emscripten8internal10getContextIM13emOctaTerrainFNSt3__26vectorI7ChunkIdNS3_9allocatorIS5_EEEEvEEEPT_RKSB_($$byval_copy27)|0);
 __embind_register_class_function(($71|0),(1413|0),($72|0),($73|0),($74|0),(1|0),($75|0),0);
 HEAP32[$$byval_copy27>>2] = (4);
 $$fca$1$gep$i34 = ((($$byval_copy27)) + 4|0);
 HEAP32[$$fca$1$gep$i34>>2] = 0;
 $76 = (__ZN10emscripten8internal6TypeIDI13emOctaTerrainE3getEv()|0);
 $77 = (__ZNK10emscripten8internal12WithPoliciesIJEE11ArgTypeListIJNSt3__26vectorI4vec9NS4_9allocatorIS6_EEEENS0_17AllowedRawPointerI13emOctaTerrainEEEE8getCountEv($1)|0);
 $78 = (__ZNK10emscripten8internal12WithPoliciesIJEE11ArgTypeListIJNSt3__26vectorI4vec9NS4_9allocatorIS6_EEEENS0_17AllowedRawPointerI13emOctaTerrainEEEE8getTypesEv($1)|0);
 $79 = (__ZN10emscripten8internal19getGenericSignatureIJiiiEEEPKcv()|0);
 $80 = (__ZN10emscripten8internal10getContextIM13emOctaTerrainFNSt3__26vectorI4vec9NS3_9allocatorIS5_EEEEvEEEPT_RKSB_($$byval_copy27)|0);
 __embind_register_class_function(($76|0),(1423|0),($77|0),($78|0),($79|0),(2|0),($80|0),0);
 __ZN10emscripten11value_arrayI7ChunkIdEC2EPKc($2,1435);
 $81 = (__ZN10emscripten11value_arrayI7ChunkIdE7elementIS1_jEERS2_MT_T0_($2,0)|0);
 (__ZN10emscripten11value_arrayI7ChunkIdE7elementIS1_jEERS2_MT_T0_($81,4)|0);
 __ZN10emscripten11value_arrayI7ChunkIdED2Ev($2);
 __ZN10emscripten11value_arrayI4vec3EC2EPKc($3,1443);
 ;HEAP8[$$byval_copy27>>0]=HEAP8[$4>>0]|0;
 $82 = (__ZN10emscripten11value_arrayI4vec3E7elementILi0EEERS2_NS_5indexIXT_EEE($3,$$byval_copy27)|0);
 ;HEAP8[$$byval_copy27>>0]=HEAP8[$5>>0]|0;
 $83 = (__ZN10emscripten11value_arrayI4vec3E7elementILi1EEERS2_NS_5indexIXT_EEE($82,$$byval_copy27)|0);
 ;HEAP8[$$byval_copy27>>0]=HEAP8[$6>>0]|0;
 (__ZN10emscripten11value_arrayI4vec3E7elementILi2EEERS2_NS_5indexIXT_EEE($83,$$byval_copy27)|0);
 __ZN10emscripten11value_arrayI4vec3ED2Ev($3);
 __ZN10emscripten11value_arrayI4vec9EC2EPKc($7,1448);
 ;HEAP8[$$byval_copy27>>0]=HEAP8[$8>>0]|0;
 $84 = (__ZN10emscripten11value_arrayI4vec9E7elementILi0EEERS2_NS_5indexIXT_EEE($7,$$byval_copy27)|0);
 ;HEAP8[$$byval_copy27>>0]=HEAP8[$9>>0]|0;
 $85 = (__ZN10emscripten11value_arrayI4vec9E7elementILi1EEERS2_NS_5indexIXT_EEE($84,$$byval_copy27)|0);
 ;HEAP8[$$byval_copy27>>0]=HEAP8[$10>>0]|0;
 $86 = (__ZN10emscripten11value_arrayI4vec9E7elementILi2EEERS2_NS_5indexIXT_EEE($85,$$byval_copy27)|0);
 ;HEAP8[$$byval_copy27>>0]=HEAP8[$11>>0]|0;
 $87 = (__ZN10emscripten11value_arrayI4vec9E7elementILi3EEERS2_NS_5indexIXT_EEE($86,$$byval_copy27)|0);
 ;HEAP8[$$byval_copy27>>0]=HEAP8[$12>>0]|0;
 $88 = (__ZN10emscripten11value_arrayI4vec9E7elementILi4EEERS2_NS_5indexIXT_EEE($87,$$byval_copy27)|0);
 ;HEAP8[$$byval_copy27>>0]=HEAP8[$13>>0]|0;
 $89 = (__ZN10emscripten11value_arrayI4vec9E7elementILi5EEERS2_NS_5indexIXT_EEE($88,$$byval_copy27)|0);
 ;HEAP8[$$byval_copy27>>0]=HEAP8[$14>>0]|0;
 $90 = (__ZN10emscripten11value_arrayI4vec9E7elementILi6EEERS2_NS_5indexIXT_EEE($89,$$byval_copy27)|0);
 ;HEAP8[$$byval_copy27>>0]=HEAP8[$15>>0]|0;
 $91 = (__ZN10emscripten11value_arrayI4vec9E7elementILi7EEERS2_NS_5indexIXT_EEE($90,$$byval_copy27)|0);
 ;HEAP8[$$byval_copy27>>0]=HEAP8[$16>>0]|0;
 (__ZN10emscripten11value_arrayI4vec9E7elementILi8EEERS2_NS_5indexIXT_EEE($91,$$byval_copy27)|0);
 __ZN10emscripten11value_arrayI4vec9ED2Ev($7);
 __ZN10emscripten11value_arrayI4mat4EC2EPKc($17,1453);
 ;HEAP8[$$byval_copy27>>0]=HEAP8[$18>>0]|0;
 $92 = (__ZN10emscripten11value_arrayI4mat4E7elementILi0EEERS2_NS_5indexIXT_EEE($17,$$byval_copy27)|0);
 ;HEAP8[$$byval_copy27>>0]=HEAP8[$19>>0]|0;
 $93 = (__ZN10emscripten11value_arrayI4mat4E7elementILi1EEERS2_NS_5indexIXT_EEE($92,$$byval_copy27)|0);
 ;HEAP8[$$byval_copy27>>0]=HEAP8[$20>>0]|0;
 $94 = (__ZN10emscripten11value_arrayI4mat4E7elementILi2EEERS2_NS_5indexIXT_EEE($93,$$byval_copy27)|0);
 ;HEAP8[$$byval_copy27>>0]=HEAP8[$21>>0]|0;
 $95 = (__ZN10emscripten11value_arrayI4mat4E7elementILi3EEERS2_NS_5indexIXT_EEE($94,$$byval_copy27)|0);
 ;HEAP8[$$byval_copy27>>0]=HEAP8[$22>>0]|0;
 $96 = (__ZN10emscripten11value_arrayI4mat4E7elementILi4EEERS2_NS_5indexIXT_EEE($95,$$byval_copy27)|0);
 ;HEAP8[$$byval_copy27>>0]=HEAP8[$23>>0]|0;
 $97 = (__ZN10emscripten11value_arrayI4mat4E7elementILi5EEERS2_NS_5indexIXT_EEE($96,$$byval_copy27)|0);
 ;HEAP8[$$byval_copy27>>0]=HEAP8[$24>>0]|0;
 $98 = (__ZN10emscripten11value_arrayI4mat4E7elementILi6EEERS2_NS_5indexIXT_EEE($97,$$byval_copy27)|0);
 ;HEAP8[$$byval_copy27>>0]=HEAP8[$25>>0]|0;
 $99 = (__ZN10emscripten11value_arrayI4mat4E7elementILi7EEERS2_NS_5indexIXT_EEE($98,$$byval_copy27)|0);
 ;HEAP8[$$byval_copy27>>0]=HEAP8[$26>>0]|0;
 $100 = (__ZN10emscripten11value_arrayI4mat4E7elementILi8EEERS2_NS_5indexIXT_EEE($99,$$byval_copy27)|0);
 ;HEAP8[$$byval_copy27>>0]=HEAP8[$27>>0]|0;
 $101 = (__ZN10emscripten11value_arrayI4mat4E7elementILi9EEERS2_NS_5indexIXT_EEE($100,$$byval_copy27)|0);
 ;HEAP8[$$byval_copy27>>0]=HEAP8[$28>>0]|0;
 $102 = (__ZN10emscripten11value_arrayI4mat4E7elementILi10EEERS2_NS_5indexIXT_EEE($101,$$byval_copy27)|0);
 ;HEAP8[$$byval_copy27>>0]=HEAP8[$29>>0]|0;
 $103 = (__ZN10emscripten11value_arrayI4mat4E7elementILi11EEERS2_NS_5indexIXT_EEE($102,$$byval_copy27)|0);
 ;HEAP8[$$byval_copy27>>0]=HEAP8[$30>>0]|0;
 $104 = (__ZN10emscripten11value_arrayI4mat4E7elementILi12EEERS2_NS_5indexIXT_EEE($103,$$byval_copy27)|0);
 ;HEAP8[$$byval_copy27>>0]=HEAP8[$31>>0]|0;
 $105 = (__ZN10emscripten11value_arrayI4mat4E7elementILi13EEERS2_NS_5indexIXT_EEE($104,$$byval_copy27)|0);
 ;HEAP8[$$byval_copy27>>0]=HEAP8[$32>>0]|0;
 $106 = (__ZN10emscripten11value_arrayI4mat4E7elementILi14EEERS2_NS_5indexIXT_EEE($105,$$byval_copy27)|0);
 ;HEAP8[$$byval_copy27>>0]=HEAP8[$33>>0]|0;
 (__ZN10emscripten11value_arrayI4mat4E7elementILi15EEERS2_NS_5indexIXT_EEE($106,$$byval_copy27)|0);
 __ZN10emscripten11value_arrayI4mat4ED2Ev($17);
 __ZN10emscripten15register_vectorI7ChunkIdEENS_6class_INSt3__26vectorIT_NS3_9allocatorIS5_EEEENS_8internal11NoBaseClassEEEPKc($$byval_copy27,1458);
 __ZN10emscripten15register_vectorI4vec9EENS_6class_INSt3__26vectorIT_NS3_9allocatorIS5_EEEENS_8internal11NoBaseClassEEEPKc($$byval_copy27,1472);
 STACKTOP = sp;return;
}
function __ZN13emOctaTerrain8generateE4vec34mat4NSt3__26vectorI7ChunkIdNS2_9allocatorIS4_EEEE($0,$1,$2,$3) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 $3 = $3|0;
 var $$byval_copy = 0, $$byval_copy1 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, dest = 0, label = 0, sp = 0, src = 0, stop = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 176|0;
 $$byval_copy1 = sp + 112|0;
 $$byval_copy = sp + 100|0;
 $4 = sp + 88|0;
 $5 = sp + 24|0;
 $6 = sp + 12|0;
 $7 = sp;
 ;HEAP32[$4>>2]=HEAP32[$1>>2]|0;HEAP32[$4+4>>2]=HEAP32[$1+4>>2]|0;HEAP32[$4+8>>2]=HEAP32[$1+8>>2]|0;
 dest=$5; src=$2; stop=dest+64|0; do { HEAP32[dest>>2]=HEAP32[src>>2]|0; dest=dest+4|0; src=src+4|0; } while ((dest|0) < (stop|0));
 __ZNSt3__26vectorI7ChunkIdNS_9allocatorIS1_EEEC2ERKS4_($7,$3);
 __ZN13emOctaTerrain15chunk2intVectorENSt3__26vectorI7ChunkIdNS0_9allocatorIS2_EEEE($6,$0,$7);
 ;HEAP32[$$byval_copy>>2]=HEAP32[$4>>2]|0;HEAP32[$$byval_copy+4>>2]=HEAP32[$4+4>>2]|0;HEAP32[$$byval_copy+8>>2]=HEAP32[$4+8>>2]|0;
 dest=$$byval_copy1; src=$5; stop=dest+64|0; do { HEAP32[dest>>2]=HEAP32[src>>2]|0; dest=dest+4|0; src=src+4|0; } while ((dest|0) < (stop|0));
 __ZN11OctaTerrain8generateE4vec34mat4NSt3__26vectorIxNS2_9allocatorIxEEEE($0,$$byval_copy,$$byval_copy1,$6);
 __ZNSt3__213__vector_baseIxNS_9allocatorIxEEED2Ev($6);
 __ZNSt3__213__vector_baseI7ChunkIdNS_9allocatorIS1_EEED2Ev($7);
 STACKTOP = sp;return;
}
function __ZN13emOctaTerrain8getAddedEv($0,$1) {
 $0 = $0|0;
 $1 = $1|0;
 var $2 = 0, $3 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0;
 $2 = sp;
 $3 = ((($1)) + 40|0);
 __ZNSt3__26vectorIxNS_9allocatorIxEEEC2ERKS3_($2,$3);
 __ZN13emOctaTerrain15int2chunkVectorENSt3__26vectorIxNS0_9allocatorIxEEEE($0,$1,$2);
 __ZNSt3__213__vector_baseIxNS_9allocatorIxEEED2Ev($2);
 STACKTOP = sp;return;
}
function __ZN13emOctaTerrain10getRemovedEv($0,$1) {
 $0 = $0|0;
 $1 = $1|0;
 var $2 = 0, $3 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0;
 $2 = sp;
 $3 = ((($1)) + 52|0);
 __ZNSt3__26vectorIxNS_9allocatorIxEEEC2ERKS3_($2,$3);
 __ZN13emOctaTerrain15int2chunkVectorENSt3__26vectorIxNS0_9allocatorIxEEEE($0,$1,$2);
 __ZNSt3__213__vector_baseIxNS_9allocatorIxEEED2Ev($2);
 STACKTOP = sp;return;
}
function __ZN13emOctaTerrain9getKeepedEv($0,$1) {
 $0 = $0|0;
 $1 = $1|0;
 var $2 = 0, $3 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0;
 $2 = sp;
 $3 = ((($1)) + 28|0);
 __ZNSt3__26vectorIxNS_9allocatorIxEEEC2ERKS3_($2,$3);
 __ZN13emOctaTerrain15int2chunkVectorENSt3__26vectorIxNS0_9allocatorIxEEEE($0,$1,$2);
 __ZNSt3__213__vector_baseIxNS_9allocatorIxEEED2Ev($2);
 STACKTOP = sp;return;
}
function __ZN13emOctaTerrain11getVerticesEv($0,$1) {
 $0 = $0|0;
 $1 = $1|0;
 var label = 0, sp = 0;
 sp = STACKTOP;
 __ZN11OctaTerrain11getVerticesEv($0,$1);
 return;
}
function __ZN10emscripten11value_arrayI7ChunkIdEC2EPKc($0,$1) {
 $0 = $0|0;
 $1 = $1|0;
 var $2 = 0, $3 = 0, $4 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 __ZN10emscripten8internal11noncopyableC2Ev($0);
 $2 = (__ZN10emscripten8internal6TypeIDI7ChunkIdE3getEv()|0);
 $3 = (__ZN10emscripten8internal19getGenericSignatureIJiEEEPKcv()|0);
 $4 = (__ZN10emscripten8internal19getGenericSignatureIJviEEEPKcv()|0);
 __embind_register_value_array(($2|0),($1|0),($3|0),(1|0),($4|0),(12|0));
 return;
}
function __ZN10emscripten11value_arrayI7ChunkIdE7elementIS1_jEERS2_MT_T0_($0,$1) {
 $0 = $0|0;
 $1 = $1|0;
 var $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0;
 $2 = sp;
 HEAP32[$2>>2] = $1;
 $3 = (__ZN10emscripten8internal6TypeIDI7ChunkIdE3getEv()|0);
 $4 = (__ZN10emscripten8internal6TypeIDIjE3getEv()|0);
 $5 = (__ZN10emscripten8internal19getGenericSignatureIJiiiEEEPKcv()|0);
 $6 = (__ZN10emscripten8internal10getContextIM7ChunkIdjEEPT_RKS4_($2)|0);
 $7 = (__ZN10emscripten8internal6TypeIDIjE3getEv()|0);
 $8 = (__ZN10emscripten8internal19getGenericSignatureIJviiiEEEPKcv()|0);
 $9 = (__ZN10emscripten8internal10getContextIM7ChunkIdjEEPT_RKS4_($2)|0);
 __embind_register_value_array_element(($3|0),($4|0),($5|0),(3|0),($6|0),($7|0),($8|0),(1|0),($9|0));
 STACKTOP = sp;return ($0|0);
}
function __ZN10emscripten11value_arrayI7ChunkIdED2Ev($0) {
 $0 = $0|0;
 var $1 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $1 = (__ZN10emscripten8internal6TypeIDI7ChunkIdE3getEv()|0);
 __embind_finalize_value_array(($1|0));
 __ZN10emscripten8internal11noncopyableD2Ev($0);
 return;
}
function __ZN10emscripten11value_arrayI4vec3EC2EPKc($0,$1) {
 $0 = $0|0;
 $1 = $1|0;
 var $2 = 0, $3 = 0, $4 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 __ZN10emscripten8internal11noncopyableC2Ev($0);
 $2 = (__ZN10emscripten8internal6TypeIDI4vec3E3getEv()|0);
 $3 = (__ZN10emscripten8internal19getGenericSignatureIJiEEEPKcv()|0);
 $4 = (__ZN10emscripten8internal19getGenericSignatureIJviEEEPKcv()|0);
 __embind_register_value_array(($2|0),($1|0),($3|0),(2|0),($4|0),(13|0));
 return;
}
function __ZN10emscripten11value_arrayI4vec3E7elementILi0EEERS2_NS_5indexIXT_EEE($0,$1) {
 $0 = $0|0;
 $1 = $1|0;
 var $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $2 = (__ZN10emscripten8internal6TypeIDI4vec3E3getEv()|0);
 $3 = (__ZN10emscripten8internal6TypeIDIfE3getEv()|0);
 $4 = (__ZN10emscripten8internal19getGenericSignatureIJfiiEEEPKcv()|0);
 $5 = (__ZN10emscripten8internal6TypeIDIfE3getEv()|0);
 $6 = (__ZN10emscripten8internal19getGenericSignatureIJviifEEEPKcv()|0);
 __embind_register_value_array_element(($2|0),($3|0),($4|0),(1|0),(0|0),($5|0),($6|0),(1|0),(0|0));
 return ($0|0);
}
function __ZN10emscripten11value_arrayI4vec3E7elementILi1EEERS2_NS_5indexIXT_EEE($0,$1) {
 $0 = $0|0;
 $1 = $1|0;
 var $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $2 = (__ZN10emscripten8internal6TypeIDI4vec3E3getEv()|0);
 $3 = (__ZN10emscripten8internal6TypeIDIfE3getEv()|0);
 $4 = (__ZN10emscripten8internal19getGenericSignatureIJfiiEEEPKcv()|0);
 $5 = (__ZN10emscripten8internal6TypeIDIfE3getEv()|0);
 $6 = (__ZN10emscripten8internal19getGenericSignatureIJviifEEEPKcv()|0);
 __embind_register_value_array_element(($2|0),($3|0),($4|0),(1|0),((1)|0),($5|0),($6|0),(1|0),((1)|0));
 return ($0|0);
}
function __ZN10emscripten11value_arrayI4vec3E7elementILi2EEERS2_NS_5indexIXT_EEE($0,$1) {
 $0 = $0|0;
 $1 = $1|0;
 var $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $2 = (__ZN10emscripten8internal6TypeIDI4vec3E3getEv()|0);
 $3 = (__ZN10emscripten8internal6TypeIDIfE3getEv()|0);
 $4 = (__ZN10emscripten8internal19getGenericSignatureIJfiiEEEPKcv()|0);
 $5 = (__ZN10emscripten8internal6TypeIDIfE3getEv()|0);
 $6 = (__ZN10emscripten8internal19getGenericSignatureIJviifEEEPKcv()|0);
 __embind_register_value_array_element(($2|0),($3|0),($4|0),(1|0),((2)|0),($5|0),($6|0),(1|0),((2)|0));
 return ($0|0);
}
function __ZN10emscripten11value_arrayI4vec3ED2Ev($0) {
 $0 = $0|0;
 var $1 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $1 = (__ZN10emscripten8internal6TypeIDI4vec3E3getEv()|0);
 __embind_finalize_value_array(($1|0));
 __ZN10emscripten8internal11noncopyableD2Ev($0);
 return;
}
function __ZN10emscripten11value_arrayI4vec9EC2EPKc($0,$1) {
 $0 = $0|0;
 $1 = $1|0;
 var $2 = 0, $3 = 0, $4 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 __ZN10emscripten8internal11noncopyableC2Ev($0);
 $2 = (__ZN10emscripten8internal6TypeIDI4vec9E3getEv()|0);
 $3 = (__ZN10emscripten8internal19getGenericSignatureIJiEEEPKcv()|0);
 $4 = (__ZN10emscripten8internal19getGenericSignatureIJviEEEPKcv()|0);
 __embind_register_value_array(($2|0),($1|0),($3|0),(3|0),($4|0),(14|0));
 return;
}
function __ZN10emscripten11value_arrayI4vec9E7elementILi0EEERS2_NS_5indexIXT_EEE($0,$1) {
 $0 = $0|0;
 $1 = $1|0;
 var $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $2 = (__ZN10emscripten8internal6TypeIDI4vec9E3getEv()|0);
 $3 = (__ZN10emscripten8internal6TypeIDIfE3getEv()|0);
 $4 = (__ZN10emscripten8internal19getGenericSignatureIJfiiEEEPKcv()|0);
 $5 = (__ZN10emscripten8internal6TypeIDIfE3getEv()|0);
 $6 = (__ZN10emscripten8internal19getGenericSignatureIJviifEEEPKcv()|0);
 __embind_register_value_array_element(($2|0),($3|0),($4|0),(2|0),(0|0),($5|0),($6|0),(2|0),(0|0));
 return ($0|0);
}
function __ZN10emscripten11value_arrayI4vec9E7elementILi1EEERS2_NS_5indexIXT_EEE($0,$1) {
 $0 = $0|0;
 $1 = $1|0;
 var $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $2 = (__ZN10emscripten8internal6TypeIDI4vec9E3getEv()|0);
 $3 = (__ZN10emscripten8internal6TypeIDIfE3getEv()|0);
 $4 = (__ZN10emscripten8internal19getGenericSignatureIJfiiEEEPKcv()|0);
 $5 = (__ZN10emscripten8internal6TypeIDIfE3getEv()|0);
 $6 = (__ZN10emscripten8internal19getGenericSignatureIJviifEEEPKcv()|0);
 __embind_register_value_array_element(($2|0),($3|0),($4|0),(2|0),((1)|0),($5|0),($6|0),(2|0),((1)|0));
 return ($0|0);
}
function __ZN10emscripten11value_arrayI4vec9E7elementILi2EEERS2_NS_5indexIXT_EEE($0,$1) {
 $0 = $0|0;
 $1 = $1|0;
 var $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $2 = (__ZN10emscripten8internal6TypeIDI4vec9E3getEv()|0);
 $3 = (__ZN10emscripten8internal6TypeIDIfE3getEv()|0);
 $4 = (__ZN10emscripten8internal19getGenericSignatureIJfiiEEEPKcv()|0);
 $5 = (__ZN10emscripten8internal6TypeIDIfE3getEv()|0);
 $6 = (__ZN10emscripten8internal19getGenericSignatureIJviifEEEPKcv()|0);
 __embind_register_value_array_element(($2|0),($3|0),($4|0),(2|0),((2)|0),($5|0),($6|0),(2|0),((2)|0));
 return ($0|0);
}
function __ZN10emscripten11value_arrayI4vec9E7elementILi3EEERS2_NS_5indexIXT_EEE($0,$1) {
 $0 = $0|0;
 $1 = $1|0;
 var $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $2 = (__ZN10emscripten8internal6TypeIDI4vec9E3getEv()|0);
 $3 = (__ZN10emscripten8internal6TypeIDIfE3getEv()|0);
 $4 = (__ZN10emscripten8internal19getGenericSignatureIJfiiEEEPKcv()|0);
 $5 = (__ZN10emscripten8internal6TypeIDIfE3getEv()|0);
 $6 = (__ZN10emscripten8internal19getGenericSignatureIJviifEEEPKcv()|0);
 __embind_register_value_array_element(($2|0),($3|0),($4|0),(2|0),((3)|0),($5|0),($6|0),(2|0),((3)|0));
 return ($0|0);
}
function __ZN10emscripten11value_arrayI4vec9E7elementILi4EEERS2_NS_5indexIXT_EEE($0,$1) {
 $0 = $0|0;
 $1 = $1|0;
 var $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $2 = (__ZN10emscripten8internal6TypeIDI4vec9E3getEv()|0);
 $3 = (__ZN10emscripten8internal6TypeIDIfE3getEv()|0);
 $4 = (__ZN10emscripten8internal19getGenericSignatureIJfiiEEEPKcv()|0);
 $5 = (__ZN10emscripten8internal6TypeIDIfE3getEv()|0);
 $6 = (__ZN10emscripten8internal19getGenericSignatureIJviifEEEPKcv()|0);
 __embind_register_value_array_element(($2|0),($3|0),($4|0),(2|0),((4)|0),($5|0),($6|0),(2|0),((4)|0));
 return ($0|0);
}
function __ZN10emscripten11value_arrayI4vec9E7elementILi5EEERS2_NS_5indexIXT_EEE($0,$1) {
 $0 = $0|0;
 $1 = $1|0;
 var $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $2 = (__ZN10emscripten8internal6TypeIDI4vec9E3getEv()|0);
 $3 = (__ZN10emscripten8internal6TypeIDIfE3getEv()|0);
 $4 = (__ZN10emscripten8internal19getGenericSignatureIJfiiEEEPKcv()|0);
 $5 = (__ZN10emscripten8internal6TypeIDIfE3getEv()|0);
 $6 = (__ZN10emscripten8internal19getGenericSignatureIJviifEEEPKcv()|0);
 __embind_register_value_array_element(($2|0),($3|0),($4|0),(2|0),((5)|0),($5|0),($6|0),(2|0),((5)|0));
 return ($0|0);
}
function __ZN10emscripten11value_arrayI4vec9E7elementILi6EEERS2_NS_5indexIXT_EEE($0,$1) {
 $0 = $0|0;
 $1 = $1|0;
 var $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $2 = (__ZN10emscripten8internal6TypeIDI4vec9E3getEv()|0);
 $3 = (__ZN10emscripten8internal6TypeIDIfE3getEv()|0);
 $4 = (__ZN10emscripten8internal19getGenericSignatureIJfiiEEEPKcv()|0);
 $5 = (__ZN10emscripten8internal6TypeIDIfE3getEv()|0);
 $6 = (__ZN10emscripten8internal19getGenericSignatureIJviifEEEPKcv()|0);
 __embind_register_value_array_element(($2|0),($3|0),($4|0),(2|0),((6)|0),($5|0),($6|0),(2|0),((6)|0));
 return ($0|0);
}
function __ZN10emscripten11value_arrayI4vec9E7elementILi7EEERS2_NS_5indexIXT_EEE($0,$1) {
 $0 = $0|0;
 $1 = $1|0;
 var $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $2 = (__ZN10emscripten8internal6TypeIDI4vec9E3getEv()|0);
 $3 = (__ZN10emscripten8internal6TypeIDIfE3getEv()|0);
 $4 = (__ZN10emscripten8internal19getGenericSignatureIJfiiEEEPKcv()|0);
 $5 = (__ZN10emscripten8internal6TypeIDIfE3getEv()|0);
 $6 = (__ZN10emscripten8internal19getGenericSignatureIJviifEEEPKcv()|0);
 __embind_register_value_array_element(($2|0),($3|0),($4|0),(2|0),((7)|0),($5|0),($6|0),(2|0),((7)|0));
 return ($0|0);
}
function __ZN10emscripten11value_arrayI4vec9E7elementILi8EEERS2_NS_5indexIXT_EEE($0,$1) {
 $0 = $0|0;
 $1 = $1|0;
 var $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $2 = (__ZN10emscripten8internal6TypeIDI4vec9E3getEv()|0);
 $3 = (__ZN10emscripten8internal6TypeIDIfE3getEv()|0);
 $4 = (__ZN10emscripten8internal19getGenericSignatureIJfiiEEEPKcv()|0);
 $5 = (__ZN10emscripten8internal6TypeIDIfE3getEv()|0);
 $6 = (__ZN10emscripten8internal19getGenericSignatureIJviifEEEPKcv()|0);
 __embind_register_value_array_element(($2|0),($3|0),($4|0),(2|0),((8)|0),($5|0),($6|0),(2|0),((8)|0));
 return ($0|0);
}
function __ZN10emscripten11value_arrayI4vec9ED2Ev($0) {
 $0 = $0|0;
 var $1 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $1 = (__ZN10emscripten8internal6TypeIDI4vec9E3getEv()|0);
 __embind_finalize_value_array(($1|0));
 __ZN10emscripten8internal11noncopyableD2Ev($0);
 return;
}
function __ZN10emscripten11value_arrayI4mat4EC2EPKc($0,$1) {
 $0 = $0|0;
 $1 = $1|0;
 var $2 = 0, $3 = 0, $4 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 __ZN10emscripten8internal11noncopyableC2Ev($0);
 $2 = (__ZN10emscripten8internal6TypeIDI4mat4E3getEv()|0);
 $3 = (__ZN10emscripten8internal19getGenericSignatureIJiEEEPKcv()|0);
 $4 = (__ZN10emscripten8internal19getGenericSignatureIJviEEEPKcv()|0);
 __embind_register_value_array(($2|0),($1|0),($3|0),(4|0),($4|0),(15|0));
 return;
}
function __ZN10emscripten11value_arrayI4mat4E7elementILi0EEERS2_NS_5indexIXT_EEE($0,$1) {
 $0 = $0|0;
 $1 = $1|0;
 var $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $2 = (__ZN10emscripten8internal6TypeIDI4mat4E3getEv()|0);
 $3 = (__ZN10emscripten8internal6TypeIDIfE3getEv()|0);
 $4 = (__ZN10emscripten8internal19getGenericSignatureIJfiiEEEPKcv()|0);
 $5 = (__ZN10emscripten8internal6TypeIDIfE3getEv()|0);
 $6 = (__ZN10emscripten8internal19getGenericSignatureIJviifEEEPKcv()|0);
 __embind_register_value_array_element(($2|0),($3|0),($4|0),(3|0),(0|0),($5|0),($6|0),(3|0),(0|0));
 return ($0|0);
}
function __ZN10emscripten11value_arrayI4mat4E7elementILi1EEERS2_NS_5indexIXT_EEE($0,$1) {
 $0 = $0|0;
 $1 = $1|0;
 var $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $2 = (__ZN10emscripten8internal6TypeIDI4mat4E3getEv()|0);
 $3 = (__ZN10emscripten8internal6TypeIDIfE3getEv()|0);
 $4 = (__ZN10emscripten8internal19getGenericSignatureIJfiiEEEPKcv()|0);
 $5 = (__ZN10emscripten8internal6TypeIDIfE3getEv()|0);
 $6 = (__ZN10emscripten8internal19getGenericSignatureIJviifEEEPKcv()|0);
 __embind_register_value_array_element(($2|0),($3|0),($4|0),(3|0),((1)|0),($5|0),($6|0),(3|0),((1)|0));
 return ($0|0);
}
function __ZN10emscripten11value_arrayI4mat4E7elementILi2EEERS2_NS_5indexIXT_EEE($0,$1) {
 $0 = $0|0;
 $1 = $1|0;
 var $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $2 = (__ZN10emscripten8internal6TypeIDI4mat4E3getEv()|0);
 $3 = (__ZN10emscripten8internal6TypeIDIfE3getEv()|0);
 $4 = (__ZN10emscripten8internal19getGenericSignatureIJfiiEEEPKcv()|0);
 $5 = (__ZN10emscripten8internal6TypeIDIfE3getEv()|0);
 $6 = (__ZN10emscripten8internal19getGenericSignatureIJviifEEEPKcv()|0);
 __embind_register_value_array_element(($2|0),($3|0),($4|0),(3|0),((2)|0),($5|0),($6|0),(3|0),((2)|0));
 return ($0|0);
}
function __ZN10emscripten11value_arrayI4mat4E7elementILi3EEERS2_NS_5indexIXT_EEE($0,$1) {
 $0 = $0|0;
 $1 = $1|0;
 var $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $2 = (__ZN10emscripten8internal6TypeIDI4mat4E3getEv()|0);
 $3 = (__ZN10emscripten8internal6TypeIDIfE3getEv()|0);
 $4 = (__ZN10emscripten8internal19getGenericSignatureIJfiiEEEPKcv()|0);
 $5 = (__ZN10emscripten8internal6TypeIDIfE3getEv()|0);
 $6 = (__ZN10emscripten8internal19getGenericSignatureIJviifEEEPKcv()|0);
 __embind_register_value_array_element(($2|0),($3|0),($4|0),(3|0),((3)|0),($5|0),($6|0),(3|0),((3)|0));
 return ($0|0);
}
function __ZN10emscripten11value_arrayI4mat4E7elementILi4EEERS2_NS_5indexIXT_EEE($0,$1) {
 $0 = $0|0;
 $1 = $1|0;
 var $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $2 = (__ZN10emscripten8internal6TypeIDI4mat4E3getEv()|0);
 $3 = (__ZN10emscripten8internal6TypeIDIfE3getEv()|0);
 $4 = (__ZN10emscripten8internal19getGenericSignatureIJfiiEEEPKcv()|0);
 $5 = (__ZN10emscripten8internal6TypeIDIfE3getEv()|0);
 $6 = (__ZN10emscripten8internal19getGenericSignatureIJviifEEEPKcv()|0);
 __embind_register_value_array_element(($2|0),($3|0),($4|0),(3|0),((4)|0),($5|0),($6|0),(3|0),((4)|0));
 return ($0|0);
}
function __ZN10emscripten11value_arrayI4mat4E7elementILi5EEERS2_NS_5indexIXT_EEE($0,$1) {
 $0 = $0|0;
 $1 = $1|0;
 var $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $2 = (__ZN10emscripten8internal6TypeIDI4mat4E3getEv()|0);
 $3 = (__ZN10emscripten8internal6TypeIDIfE3getEv()|0);
 $4 = (__ZN10emscripten8internal19getGenericSignatureIJfiiEEEPKcv()|0);
 $5 = (__ZN10emscripten8internal6TypeIDIfE3getEv()|0);
 $6 = (__ZN10emscripten8internal19getGenericSignatureIJviifEEEPKcv()|0);
 __embind_register_value_array_element(($2|0),($3|0),($4|0),(3|0),((5)|0),($5|0),($6|0),(3|0),((5)|0));
 return ($0|0);
}
function __ZN10emscripten11value_arrayI4mat4E7elementILi6EEERS2_NS_5indexIXT_EEE($0,$1) {
 $0 = $0|0;
 $1 = $1|0;
 var $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $2 = (__ZN10emscripten8internal6TypeIDI4mat4E3getEv()|0);
 $3 = (__ZN10emscripten8internal6TypeIDIfE3getEv()|0);
 $4 = (__ZN10emscripten8internal19getGenericSignatureIJfiiEEEPKcv()|0);
 $5 = (__ZN10emscripten8internal6TypeIDIfE3getEv()|0);
 $6 = (__ZN10emscripten8internal19getGenericSignatureIJviifEEEPKcv()|0);
 __embind_register_value_array_element(($2|0),($3|0),($4|0),(3|0),((6)|0),($5|0),($6|0),(3|0),((6)|0));
 return ($0|0);
}
function __ZN10emscripten11value_arrayI4mat4E7elementILi7EEERS2_NS_5indexIXT_EEE($0,$1) {
 $0 = $0|0;
 $1 = $1|0;
 var $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $2 = (__ZN10emscripten8internal6TypeIDI4mat4E3getEv()|0);
 $3 = (__ZN10emscripten8internal6TypeIDIfE3getEv()|0);
 $4 = (__ZN10emscripten8internal19getGenericSignatureIJfiiEEEPKcv()|0);
 $5 = (__ZN10emscripten8internal6TypeIDIfE3getEv()|0);
 $6 = (__ZN10emscripten8internal19getGenericSignatureIJviifEEEPKcv()|0);
 __embind_register_value_array_element(($2|0),($3|0),($4|0),(3|0),((7)|0),($5|0),($6|0),(3|0),((7)|0));
 return ($0|0);
}
function __ZN10emscripten11value_arrayI4mat4E7elementILi8EEERS2_NS_5indexIXT_EEE($0,$1) {
 $0 = $0|0;
 $1 = $1|0;
 var $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $2 = (__ZN10emscripten8internal6TypeIDI4mat4E3getEv()|0);
 $3 = (__ZN10emscripten8internal6TypeIDIfE3getEv()|0);
 $4 = (__ZN10emscripten8internal19getGenericSignatureIJfiiEEEPKcv()|0);
 $5 = (__ZN10emscripten8internal6TypeIDIfE3getEv()|0);
 $6 = (__ZN10emscripten8internal19getGenericSignatureIJviifEEEPKcv()|0);
 __embind_register_value_array_element(($2|0),($3|0),($4|0),(3|0),((8)|0),($5|0),($6|0),(3|0),((8)|0));
 return ($0|0);
}
function __ZN10emscripten11value_arrayI4mat4E7elementILi9EEERS2_NS_5indexIXT_EEE($0,$1) {
 $0 = $0|0;
 $1 = $1|0;
 var $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $2 = (__ZN10emscripten8internal6TypeIDI4mat4E3getEv()|0);
 $3 = (__ZN10emscripten8internal6TypeIDIfE3getEv()|0);
 $4 = (__ZN10emscripten8internal19getGenericSignatureIJfiiEEEPKcv()|0);
 $5 = (__ZN10emscripten8internal6TypeIDIfE3getEv()|0);
 $6 = (__ZN10emscripten8internal19getGenericSignatureIJviifEEEPKcv()|0);
 __embind_register_value_array_element(($2|0),($3|0),($4|0),(3|0),((9)|0),($5|0),($6|0),(3|0),((9)|0));
 return ($0|0);
}
function __ZN10emscripten11value_arrayI4mat4E7elementILi10EEERS2_NS_5indexIXT_EEE($0,$1) {
 $0 = $0|0;
 $1 = $1|0;
 var $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $2 = (__ZN10emscripten8internal6TypeIDI4mat4E3getEv()|0);
 $3 = (__ZN10emscripten8internal6TypeIDIfE3getEv()|0);
 $4 = (__ZN10emscripten8internal19getGenericSignatureIJfiiEEEPKcv()|0);
 $5 = (__ZN10emscripten8internal6TypeIDIfE3getEv()|0);
 $6 = (__ZN10emscripten8internal19getGenericSignatureIJviifEEEPKcv()|0);
 __embind_register_value_array_element(($2|0),($3|0),($4|0),(3|0),((10)|0),($5|0),($6|0),(3|0),((10)|0));
 return ($0|0);
}
function __ZN10emscripten11value_arrayI4mat4E7elementILi11EEERS2_NS_5indexIXT_EEE($0,$1) {
 $0 = $0|0;
 $1 = $1|0;
 var $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $2 = (__ZN10emscripten8internal6TypeIDI4mat4E3getEv()|0);
 $3 = (__ZN10emscripten8internal6TypeIDIfE3getEv()|0);
 $4 = (__ZN10emscripten8internal19getGenericSignatureIJfiiEEEPKcv()|0);
 $5 = (__ZN10emscripten8internal6TypeIDIfE3getEv()|0);
 $6 = (__ZN10emscripten8internal19getGenericSignatureIJviifEEEPKcv()|0);
 __embind_register_value_array_element(($2|0),($3|0),($4|0),(3|0),((11)|0),($5|0),($6|0),(3|0),((11)|0));
 return ($0|0);
}
function __ZN10emscripten11value_arrayI4mat4E7elementILi12EEERS2_NS_5indexIXT_EEE($0,$1) {
 $0 = $0|0;
 $1 = $1|0;
 var $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $2 = (__ZN10emscripten8internal6TypeIDI4mat4E3getEv()|0);
 $3 = (__ZN10emscripten8internal6TypeIDIfE3getEv()|0);
 $4 = (__ZN10emscripten8internal19getGenericSignatureIJfiiEEEPKcv()|0);
 $5 = (__ZN10emscripten8internal6TypeIDIfE3getEv()|0);
 $6 = (__ZN10emscripten8internal19getGenericSignatureIJviifEEEPKcv()|0);
 __embind_register_value_array_element(($2|0),($3|0),($4|0),(3|0),((12)|0),($5|0),($6|0),(3|0),((12)|0));
 return ($0|0);
}
function __ZN10emscripten11value_arrayI4mat4E7elementILi13EEERS2_NS_5indexIXT_EEE($0,$1) {
 $0 = $0|0;
 $1 = $1|0;
 var $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $2 = (__ZN10emscripten8internal6TypeIDI4mat4E3getEv()|0);
 $3 = (__ZN10emscripten8internal6TypeIDIfE3getEv()|0);
 $4 = (__ZN10emscripten8internal19getGenericSignatureIJfiiEEEPKcv()|0);
 $5 = (__ZN10emscripten8internal6TypeIDIfE3getEv()|0);
 $6 = (__ZN10emscripten8internal19getGenericSignatureIJviifEEEPKcv()|0);
 __embind_register_value_array_element(($2|0),($3|0),($4|0),(3|0),((13)|0),($5|0),($6|0),(3|0),((13)|0));
 return ($0|0);
}
function __ZN10emscripten11value_arrayI4mat4E7elementILi14EEERS2_NS_5indexIXT_EEE($0,$1) {
 $0 = $0|0;
 $1 = $1|0;
 var $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $2 = (__ZN10emscripten8internal6TypeIDI4mat4E3getEv()|0);
 $3 = (__ZN10emscripten8internal6TypeIDIfE3getEv()|0);
 $4 = (__ZN10emscripten8internal19getGenericSignatureIJfiiEEEPKcv()|0);
 $5 = (__ZN10emscripten8internal6TypeIDIfE3getEv()|0);
 $6 = (__ZN10emscripten8internal19getGenericSignatureIJviifEEEPKcv()|0);
 __embind_register_value_array_element(($2|0),($3|0),($4|0),(3|0),((14)|0),($5|0),($6|0),(3|0),((14)|0));
 return ($0|0);
}
function __ZN10emscripten11value_arrayI4mat4E7elementILi15EEERS2_NS_5indexIXT_EEE($0,$1) {
 $0 = $0|0;
 $1 = $1|0;
 var $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $2 = (__ZN10emscripten8internal6TypeIDI4mat4E3getEv()|0);
 $3 = (__ZN10emscripten8internal6TypeIDIfE3getEv()|0);
 $4 = (__ZN10emscripten8internal19getGenericSignatureIJfiiEEEPKcv()|0);
 $5 = (__ZN10emscripten8internal6TypeIDIfE3getEv()|0);
 $6 = (__ZN10emscripten8internal19getGenericSignatureIJviifEEEPKcv()|0);
 __embind_register_value_array_element(($2|0),($3|0),($4|0),(3|0),((15)|0),($5|0),($6|0),(3|0),((15)|0));
 return ($0|0);
}
function __ZN10emscripten11value_arrayI4mat4ED2Ev($0) {
 $0 = $0|0;
 var $1 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $1 = (__ZN10emscripten8internal6TypeIDI4mat4E3getEv()|0);
 __embind_finalize_value_array(($1|0));
 __ZN10emscripten8internal11noncopyableD2Ev($0);
 return;
}
function __ZN10emscripten15register_vectorI7ChunkIdEENS_6class_INSt3__26vectorIT_NS3_9allocatorIS5_EEEENS_8internal11NoBaseClassEEEPKc($0,$1) {
 $0 = $0|0;
 $1 = $1|0;
 var $$fca$1$gep$i = 0, $$fca$1$gep$i28 = 0, $$fca$1$gep$i34 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0;
 var $26 = 0, $27 = 0, $28 = 0, $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0, $41 = 0, $42 = 0, $5 = 0;
 var $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0;
 $2 = sp;
 $3 = sp + 8|0;
 __ZN10emscripten8internal11NoBaseClass6verifyINSt3__26vectorI7ChunkIdNS3_9allocatorIS5_EEEEEEvv();
 $4 = (__ZN10emscripten8internal11NoBaseClass11getUpcasterINSt3__26vectorI7ChunkIdNS3_9allocatorIS5_EEEEEEPFvvEv()|0);
 $5 = (__ZN10emscripten8internal11NoBaseClass13getDowncasterINSt3__26vectorI7ChunkIdNS3_9allocatorIS5_EEEEEEPFvvEv()|0);
 $6 = (__ZN10emscripten8internal6TypeIDINSt3__26vectorI7ChunkIdNS2_9allocatorIS4_EEEEE3getEv()|0);
 $7 = (__ZN10emscripten8internal6TypeIDINS0_17AllowedRawPointerINSt3__26vectorI7ChunkIdNS3_9allocatorIS5_EEEEEEE3getEv()|0);
 $8 = (__ZN10emscripten8internal6TypeIDINS0_17AllowedRawPointerIKNSt3__26vectorI7ChunkIdNS3_9allocatorIS5_EEEEEEE3getEv()|0);
 $9 = (__ZN10emscripten8internal11NoBaseClass3getEv()|0);
 $10 = (__ZN10emscripten8internal19getGenericSignatureIJiiEEEPKcv()|0);
 $11 = (__ZN10emscripten8internal19getGenericSignatureIJvEEEPKcv()|0);
 $12 = (__ZN10emscripten8internal19getGenericSignatureIJvEEEPKcv()|0);
 $13 = (__ZN10emscripten8internal19getGenericSignatureIJviEEEPKcv()|0);
 __embind_register_class(($6|0),($7|0),($8|0),($9|0),($10|0),(4|0),($11|0),($4|0),($12|0),($5|0),($1|0),($13|0),(16|0));
 $14 = (__ZN10emscripten8internal6TypeIDINSt3__26vectorI7ChunkIdNS2_9allocatorIS4_EEEEE3getEv()|0);
 $15 = (__ZNK10emscripten8internal12WithPoliciesIJNS_18allow_raw_pointersEEE11ArgTypeListIJPNSt3__26vectorI7ChunkIdNS5_9allocatorIS7_EEEEEE8getCountEv($2)|0);
 $16 = (__ZNK10emscripten8internal12WithPoliciesIJNS_18allow_raw_pointersEEE11ArgTypeListIJPNSt3__26vectorI7ChunkIdNS5_9allocatorIS7_EEEEEE8getTypesEv($2)|0);
 $17 = (__ZN10emscripten8internal19getGenericSignatureIJiiEEEPKcv()|0);
 __embind_register_class_constructor(($14|0),($15|0),($16|0),($17|0),(5|0),(5|0));
 HEAP32[$2>>2] = (5);
 $$fca$1$gep$i = ((($2)) + 4|0);
 HEAP32[$$fca$1$gep$i>>2] = 0;
 $18 = (__ZN10emscripten8internal6TypeIDINSt3__26vectorI7ChunkIdNS2_9allocatorIS4_EEEEE3getEv()|0);
 $19 = (__ZNK10emscripten8internal12WithPoliciesIJEE11ArgTypeListIJvNS0_17AllowedRawPointerINSt3__26vectorI7ChunkIdNS5_9allocatorIS7_EEEEEERKS7_EE8getCountEv($3)|0);
 $20 = (__ZNK10emscripten8internal12WithPoliciesIJEE11ArgTypeListIJvNS0_17AllowedRawPointerINSt3__26vectorI7ChunkIdNS5_9allocatorIS7_EEEEEERKS7_EE8getTypesEv($3)|0);
 $21 = (__ZN10emscripten8internal19getGenericSignatureIJviiiEEEPKcv()|0);
 $22 = (__ZN10emscripten8internal10getContextIMNSt3__26vectorI7ChunkIdNS2_9allocatorIS4_EEEEFvRKS4_EEEPT_RKSC_($2)|0);
 __embind_register_class_function(($18|0),(1858|0),($19|0),($20|0),($21|0),(2|0),($22|0),0);
 HEAP32[$2>>2] = (3);
 $$fca$1$gep$i28 = ((($2)) + 4|0);
 HEAP32[$$fca$1$gep$i28>>2] = 0;
 $23 = (__ZN10emscripten8internal6TypeIDINSt3__26vectorI7ChunkIdNS2_9allocatorIS4_EEEEE3getEv()|0);
 $24 = (__ZNK10emscripten8internal12WithPoliciesIJEE11ArgTypeListIJvNS0_17AllowedRawPointerINSt3__26vectorI7ChunkIdNS5_9allocatorIS7_EEEEEEjRKS7_EE8getCountEv($3)|0);
 $25 = (__ZNK10emscripten8internal12WithPoliciesIJEE11ArgTypeListIJvNS0_17AllowedRawPointerINSt3__26vectorI7ChunkIdNS5_9allocatorIS7_EEEEEEjRKS7_EE8getTypesEv($3)|0);
 $26 = (__ZN10emscripten8internal19getGenericSignatureIJviiiiEEEPKcv()|0);
 $27 = (__ZN10emscripten8internal10getContextIMNSt3__26vectorI7ChunkIdNS2_9allocatorIS4_EEEEFvjRKS4_EEEPT_RKSC_($2)|0);
 __embind_register_class_function(($23|0),(1868|0),($24|0),($25|0),($26|0),(5|0),($27|0),0);
 HEAP32[$2>>2] = (6);
 $$fca$1$gep$i34 = ((($2)) + 4|0);
 HEAP32[$$fca$1$gep$i34>>2] = 0;
 $28 = (__ZN10emscripten8internal6TypeIDINSt3__26vectorI7ChunkIdNS2_9allocatorIS4_EEEEE3getEv()|0);
 $29 = (__ZNK10emscripten8internal12WithPoliciesIJEE11ArgTypeListIJjNS0_17AllowedRawPointerIKNSt3__26vectorI7ChunkIdNS5_9allocatorIS7_EEEEEEEE8getCountEv($3)|0);
 $30 = (__ZNK10emscripten8internal12WithPoliciesIJEE11ArgTypeListIJjNS0_17AllowedRawPointerIKNSt3__26vectorI7ChunkIdNS5_9allocatorIS7_EEEEEEEE8getTypesEv($3)|0);
 $31 = (__ZN10emscripten8internal19getGenericSignatureIJiiiEEEPKcv()|0);
 $32 = (__ZN10emscripten8internal10getContextIMNSt3__26vectorI7ChunkIdNS2_9allocatorIS4_EEEEKFjvEEEPT_RKSA_($2)|0);
 __embind_register_class_function(($28|0),(1875|0),($29|0),($30|0),($31|0),(4|0),($32|0),0);
 HEAP32[$2>>2] = 5;
 $33 = (__ZN10emscripten8internal6TypeIDINSt3__26vectorI7ChunkIdNS2_9allocatorIS4_EEEEE3getEv()|0);
 $34 = (__ZNK10emscripten8internal12WithPoliciesIJEE11ArgTypeListIJNS_3valERKNSt3__26vectorI7ChunkIdNS5_9allocatorIS7_EEEEjEE8getCountEv($3)|0);
 $35 = (__ZNK10emscripten8internal12WithPoliciesIJEE11ArgTypeListIJNS_3valERKNSt3__26vectorI7ChunkIdNS5_9allocatorIS7_EEEEjEE8getTypesEv($3)|0);
 $36 = (__ZN10emscripten8internal19getGenericSignatureIJiiiiEEEPKcv()|0);
 $37 = (__ZN10emscripten8internal10getContextIPFNS_3valERKNSt3__26vectorI7ChunkIdNS3_9allocatorIS5_EEEEjEEEPT_RKSD_($2)|0);
 __embind_register_class_function(($33|0),(1880|0),($34|0),($35|0),($36|0),(8|0),($37|0),0);
 HEAP32[$2>>2] = 9;
 $38 = (__ZN10emscripten8internal6TypeIDINSt3__26vectorI7ChunkIdNS2_9allocatorIS4_EEEEE3getEv()|0);
 $39 = (__ZNK10emscripten8internal12WithPoliciesIJEE11ArgTypeListIJbRNSt3__26vectorI7ChunkIdNS4_9allocatorIS6_EEEEjRKS6_EE8getCountEv($3)|0);
 $40 = (__ZNK10emscripten8internal12WithPoliciesIJEE11ArgTypeListIJbRNSt3__26vectorI7ChunkIdNS4_9allocatorIS6_EEEEjRKS6_EE8getTypesEv($3)|0);
 $41 = (__ZN10emscripten8internal19getGenericSignatureIJiiiiiEEEPKcv()|0);
 $42 = (__ZN10emscripten8internal10getContextIPFbRNSt3__26vectorI7ChunkIdNS2_9allocatorIS4_EEEEjRKS4_EEEPT_RKSD_($2)|0);
 __embind_register_class_function(($38|0),(1884|0),($39|0),($40|0),($41|0),(2|0),($42|0),0);
 STACKTOP = sp;return;
}
function __ZN10emscripten15register_vectorI4vec9EENS_6class_INSt3__26vectorIT_NS3_9allocatorIS5_EEEENS_8internal11NoBaseClassEEEPKc($0,$1) {
 $0 = $0|0;
 $1 = $1|0;
 var $$fca$1$gep$i = 0, $$fca$1$gep$i28 = 0, $$fca$1$gep$i34 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0;
 var $26 = 0, $27 = 0, $28 = 0, $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0, $41 = 0, $42 = 0, $5 = 0;
 var $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0;
 $2 = sp;
 $3 = sp + 8|0;
 __ZN10emscripten8internal11NoBaseClass6verifyINSt3__26vectorI4vec9NS3_9allocatorIS5_EEEEEEvv();
 $4 = (__ZN10emscripten8internal11NoBaseClass11getUpcasterINSt3__26vectorI4vec9NS3_9allocatorIS5_EEEEEEPFvvEv()|0);
 $5 = (__ZN10emscripten8internal11NoBaseClass13getDowncasterINSt3__26vectorI4vec9NS3_9allocatorIS5_EEEEEEPFvvEv()|0);
 $6 = (__ZN10emscripten8internal6TypeIDINSt3__26vectorI4vec9NS2_9allocatorIS4_EEEEE3getEv()|0);
 $7 = (__ZN10emscripten8internal6TypeIDINS0_17AllowedRawPointerINSt3__26vectorI4vec9NS3_9allocatorIS5_EEEEEEE3getEv()|0);
 $8 = (__ZN10emscripten8internal6TypeIDINS0_17AllowedRawPointerIKNSt3__26vectorI4vec9NS3_9allocatorIS5_EEEEEEE3getEv()|0);
 $9 = (__ZN10emscripten8internal11NoBaseClass3getEv()|0);
 $10 = (__ZN10emscripten8internal19getGenericSignatureIJiiEEEPKcv()|0);
 $11 = (__ZN10emscripten8internal19getGenericSignatureIJvEEEPKcv()|0);
 $12 = (__ZN10emscripten8internal19getGenericSignatureIJvEEEPKcv()|0);
 $13 = (__ZN10emscripten8internal19getGenericSignatureIJviEEEPKcv()|0);
 __embind_register_class(($6|0),($7|0),($8|0),($9|0),($10|0),(7|0),($11|0),($4|0),($12|0),($5|0),($1|0),($13|0),(17|0));
 $14 = (__ZN10emscripten8internal6TypeIDINSt3__26vectorI4vec9NS2_9allocatorIS4_EEEEE3getEv()|0);
 $15 = (__ZNK10emscripten8internal12WithPoliciesIJNS_18allow_raw_pointersEEE11ArgTypeListIJPNSt3__26vectorI4vec9NS5_9allocatorIS7_EEEEEE8getCountEv($2)|0);
 $16 = (__ZNK10emscripten8internal12WithPoliciesIJNS_18allow_raw_pointersEEE11ArgTypeListIJPNSt3__26vectorI4vec9NS5_9allocatorIS7_EEEEEE8getTypesEv($2)|0);
 $17 = (__ZN10emscripten8internal19getGenericSignatureIJiiEEEPKcv()|0);
 __embind_register_class_constructor(($14|0),($15|0),($16|0),($17|0),(8|0),(6|0));
 HEAP32[$2>>2] = (6);
 $$fca$1$gep$i = ((($2)) + 4|0);
 HEAP32[$$fca$1$gep$i>>2] = 0;
 $18 = (__ZN10emscripten8internal6TypeIDINSt3__26vectorI4vec9NS2_9allocatorIS4_EEEEE3getEv()|0);
 $19 = (__ZNK10emscripten8internal12WithPoliciesIJEE11ArgTypeListIJvNS0_17AllowedRawPointerINSt3__26vectorI4vec9NS5_9allocatorIS7_EEEEEERKS7_EE8getCountEv($3)|0);
 $20 = (__ZNK10emscripten8internal12WithPoliciesIJEE11ArgTypeListIJvNS0_17AllowedRawPointerINSt3__26vectorI4vec9NS5_9allocatorIS7_EEEEEERKS7_EE8getTypesEv($3)|0);
 $21 = (__ZN10emscripten8internal19getGenericSignatureIJviiiEEEPKcv()|0);
 $22 = (__ZN10emscripten8internal10getContextIMNSt3__26vectorI4vec9NS2_9allocatorIS4_EEEEFvRKS4_EEEPT_RKSC_($2)|0);
 __embind_register_class_function(($18|0),(1858|0),($19|0),($20|0),($21|0),(4|0),($22|0),0);
 HEAP32[$2>>2] = (5);
 $$fca$1$gep$i28 = ((($2)) + 4|0);
 HEAP32[$$fca$1$gep$i28>>2] = 0;
 $23 = (__ZN10emscripten8internal6TypeIDINSt3__26vectorI4vec9NS2_9allocatorIS4_EEEEE3getEv()|0);
 $24 = (__ZNK10emscripten8internal12WithPoliciesIJEE11ArgTypeListIJvNS0_17AllowedRawPointerINSt3__26vectorI4vec9NS5_9allocatorIS7_EEEEEEjRKS7_EE8getCountEv($3)|0);
 $25 = (__ZNK10emscripten8internal12WithPoliciesIJEE11ArgTypeListIJvNS0_17AllowedRawPointerINSt3__26vectorI4vec9NS5_9allocatorIS7_EEEEEEjRKS7_EE8getTypesEv($3)|0);
 $26 = (__ZN10emscripten8internal19getGenericSignatureIJviiiiEEEPKcv()|0);
 $27 = (__ZN10emscripten8internal10getContextIMNSt3__26vectorI4vec9NS2_9allocatorIS4_EEEEFvjRKS4_EEEPT_RKSC_($2)|0);
 __embind_register_class_function(($23|0),(1868|0),($24|0),($25|0),($26|0),(6|0),($27|0),0);
 HEAP32[$2>>2] = (9);
 $$fca$1$gep$i34 = ((($2)) + 4|0);
 HEAP32[$$fca$1$gep$i34>>2] = 0;
 $28 = (__ZN10emscripten8internal6TypeIDINSt3__26vectorI4vec9NS2_9allocatorIS4_EEEEE3getEv()|0);
 $29 = (__ZNK10emscripten8internal12WithPoliciesIJEE11ArgTypeListIJjNS0_17AllowedRawPointerIKNSt3__26vectorI4vec9NS5_9allocatorIS7_EEEEEEEE8getCountEv($3)|0);
 $30 = (__ZNK10emscripten8internal12WithPoliciesIJEE11ArgTypeListIJjNS0_17AllowedRawPointerIKNSt3__26vectorI4vec9NS5_9allocatorIS7_EEEEEEEE8getTypesEv($3)|0);
 $31 = (__ZN10emscripten8internal19getGenericSignatureIJiiiEEEPKcv()|0);
 $32 = (__ZN10emscripten8internal10getContextIMNSt3__26vectorI4vec9NS2_9allocatorIS4_EEEEKFjvEEEPT_RKSA_($2)|0);
 __embind_register_class_function(($28|0),(1875|0),($29|0),($30|0),($31|0),(6|0),($32|0),0);
 HEAP32[$2>>2] = 7;
 $33 = (__ZN10emscripten8internal6TypeIDINSt3__26vectorI4vec9NS2_9allocatorIS4_EEEEE3getEv()|0);
 $34 = (__ZNK10emscripten8internal12WithPoliciesIJEE11ArgTypeListIJNS_3valERKNSt3__26vectorI4vec9NS5_9allocatorIS7_EEEEjEE8getCountEv($3)|0);
 $35 = (__ZNK10emscripten8internal12WithPoliciesIJEE11ArgTypeListIJNS_3valERKNSt3__26vectorI4vec9NS5_9allocatorIS7_EEEEjEE8getTypesEv($3)|0);
 $36 = (__ZN10emscripten8internal19getGenericSignatureIJiiiiEEEPKcv()|0);
 $37 = (__ZN10emscripten8internal10getContextIPFNS_3valERKNSt3__26vectorI4vec9NS3_9allocatorIS5_EEEEjEEEPT_RKSD_($2)|0);
 __embind_register_class_function(($33|0),(1880|0),($34|0),($35|0),($36|0),(10|0),($37|0),0);
 HEAP32[$2>>2] = 11;
 $38 = (__ZN10emscripten8internal6TypeIDINSt3__26vectorI4vec9NS2_9allocatorIS4_EEEEE3getEv()|0);
 $39 = (__ZNK10emscripten8internal12WithPoliciesIJEE11ArgTypeListIJbRNSt3__26vectorI4vec9NS4_9allocatorIS6_EEEEjRKS6_EE8getCountEv($3)|0);
 $40 = (__ZNK10emscripten8internal12WithPoliciesIJEE11ArgTypeListIJbRNSt3__26vectorI4vec9NS4_9allocatorIS6_EEEEjRKS6_EE8getTypesEv($3)|0);
 $41 = (__ZN10emscripten8internal19getGenericSignatureIJiiiiiEEEPKcv()|0);
 $42 = (__ZN10emscripten8internal10getContextIPFbRNSt3__26vectorI4vec9NS2_9allocatorIS4_EEEEjRKS4_EEEPT_RKSD_($2)|0);
 __embind_register_class_function(($38|0),(1884|0),($39|0),($40|0),($41|0),(3|0),($42|0),0);
 STACKTOP = sp;return;
}
function __ZN11OctaTerrain8generateE4vec34mat4NSt3__26vectorIxNS2_9allocatorIxEEEE($0,$1,$2,$3) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 $3 = $3|0;
 var $$byval_copy1 = 0, $$byval_copy2 = 0, $$byval_copy3 = 0, $$byval_copy4 = 0, $$cast = 0, $$cast$i = 0, $$cast$i14 = 0, $$cast$i4 = 0, $$cast$i9 = 0, $$cast52 = 0, $$cast53 = 0, $$cast54 = 0, $$sroa_raw_idx = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0;
 var $17 = 0, $18 = 0, $19 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0, $27 = 0, $28 = 0, $29 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0;
 var $37 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0, $41 = 0, $42 = 0, $43 = 0, $44 = 0, $45 = 0, $46 = 0, $47 = 0, $48 = 0, $49 = 0, $5 = 0, $50 = 0, $51 = 0, $52 = 0, $53 = 0, $54 = 0;
 var $55 = 0, $56 = 0, $57 = 0, $58 = 0, $59 = 0, $6 = 0, $60 = 0, $61 = 0, $62 = 0, $63 = 0, $64 = 0, $65 = 0, $66 = 0, $67 = 0, $68 = 0, $69 = 0, $7 = 0, $70 = 0, $71 = 0, $72 = 0;
 var $8 = 0, $9 = 0, $scevgep$i$i$i = 0, $scevgep$i$i$i10 = 0, $scevgep$i$i$i15 = 0, $scevgep$i$i$i5 = 0, $scevgep4$i$i$i = 0, $scevgep4$i$i$i11 = 0, $scevgep4$i$i$i16 = 0, $scevgep4$i$i$i6 = 0, $tmpcast$i$i$byval_copy = 0, dest = 0, label = 0, sp = 0, src = 0, stop = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 224|0;
 $tmpcast$i$i$byval_copy = sp + 16|0;
 $$byval_copy4 = sp + 120|0;
 $$byval_copy3 = sp + 112|0;
 $$byval_copy2 = sp + 108|0;
 $$byval_copy1 = sp + 104|0;
 $4 = sp + 100|0;
 $5 = sp + 96|0;
 $6 = sp + 92|0;
 $7 = sp + 88|0;
 $8 = sp + 8|0;
 $9 = sp;
 $10 = sp + 80|0;
 $11 = ((($0)) + 76|0);
 ;HEAP32[$11>>2]=HEAP32[$1>>2]|0;HEAP32[$11+4>>2]=HEAP32[$1+4>>2]|0;HEAP32[$11+8>>2]=HEAP32[$1+8>>2]|0;
 $12 = ((($0)) + 88|0);
 dest=$tmpcast$i$i$byval_copy; src=$2; stop=dest+64|0; do { HEAP32[dest>>2]=HEAP32[src>>2]|0; dest=dest+4|0; src=src+4|0; } while ((dest|0) < (stop|0));
 __ZN7FrustumC2E4mat4($$byval_copy4,$tmpcast$i$i$byval_copy);
 dest=$12; src=$$byval_copy4; stop=dest+96|0; do { HEAP32[dest>>2]=HEAP32[src>>2]|0; dest=dest+4|0; src=src+4|0; } while ((dest|0) < (stop|0));
 $13 = ((($0)) + 16|0);
 $14 = ($13|0)==($3|0);
 if (!($14)) {
  $15 = HEAP32[$3>>2]|0;
  $16 = ((($3)) + 4|0);
  $17 = HEAP32[$16>>2]|0;
  __ZNSt3__26vectorIxNS_9allocatorIxEEE6assignIPxEENS_9enable_ifIXaasr21__is_forward_iteratorIT_EE5valuesr16is_constructibleIxNS_15iterator_traitsIS7_E9referenceEEE5valueEvE4typeES7_S7_($13,$15,$17);
 }
 $18 = ((($0)) + 40|0);
 $19 = ((($0)) + 44|0);
 $20 = HEAP32[$19>>2]|0;
 $21 = HEAP32[$18>>2]|0;
 $22 = (($20) - ($21))|0;
 $23 = $22 >> 3;
 $$cast$i = $21;
 $$cast = $20;
 $24 = ($$cast|0)==($$cast$i|0);
 if (!($24)) {
  $scevgep$i$i$i = ((($$cast)) + -8|0);
  $25 = $scevgep$i$i$i;
  $26 = (($25) - ($21))|0;
  $27 = $26 >>> 3;
  $28 = $27 ^ -1;
  $scevgep4$i$i$i = (($$cast) + ($28<<3)|0);
  HEAP32[$19>>2] = $scevgep4$i$i$i;
 }
 __ZNKSt3__26vectorIxNS_9allocatorIxEEE17__annotate_shrinkEj($18,$23);
 $29 = ((($0)) + 52|0);
 $30 = ((($0)) + 56|0);
 $31 = HEAP32[$30>>2]|0;
 $32 = HEAP32[$29>>2]|0;
 $33 = (($31) - ($32))|0;
 $34 = $33 >> 3;
 $$cast$i4 = $32;
 $$cast52 = $31;
 $35 = ($$cast52|0)==($$cast$i4|0);
 if (!($35)) {
  $scevgep$i$i$i5 = ((($$cast52)) + -8|0);
  $36 = $scevgep$i$i$i5;
  $37 = (($36) - ($32))|0;
  $38 = $37 >>> 3;
  $39 = $38 ^ -1;
  $scevgep4$i$i$i6 = (($$cast52) + ($39<<3)|0);
  HEAP32[$30>>2] = $scevgep4$i$i$i6;
 }
 __ZNKSt3__26vectorIxNS_9allocatorIxEEE17__annotate_shrinkEj($29,$34);
 $40 = ((($0)) + 28|0);
 $41 = ((($0)) + 32|0);
 $42 = HEAP32[$41>>2]|0;
 $43 = HEAP32[$40>>2]|0;
 $44 = (($42) - ($43))|0;
 $45 = $44 >> 3;
 $$cast$i9 = $43;
 $$cast53 = $42;
 $46 = ($$cast53|0)==($$cast$i9|0);
 if (!($46)) {
  $scevgep$i$i$i10 = ((($$cast53)) + -8|0);
  $47 = $scevgep$i$i$i10;
  $48 = (($47) - ($43))|0;
  $49 = $48 >>> 3;
  $50 = $49 ^ -1;
  $scevgep4$i$i$i11 = (($$cast53) + ($50<<3)|0);
  HEAP32[$41>>2] = $scevgep4$i$i$i11;
 }
 __ZNKSt3__26vectorIxNS_9allocatorIxEEE17__annotate_shrinkEj($40,$45);
 $51 = ((($0)) + 64|0);
 $52 = ((($0)) + 68|0);
 $53 = HEAP32[$52>>2]|0;
 $54 = HEAP32[$51>>2]|0;
 $55 = (($53) - ($54))|0;
 $56 = (($55|0) / 36)&-1;
 $$cast$i14 = $54;
 $$cast54 = $53;
 $57 = ($$cast54|0)==($$cast$i14|0);
 if (!($57)) {
  $scevgep$i$i$i15 = ((($$cast54)) + -36|0);
  $58 = $scevgep$i$i$i15;
  $59 = (($58) - ($54))|0;
  $60 = (($59>>>0) / 36)&-1;
  $61 = $60 ^ -1;
  $scevgep4$i$i$i16 = (($$cast54) + (($61*36)|0)|0);
  HEAP32[$52>>2] = $scevgep4$i$i$i16;
 }
 __ZNKSt3__26vectorI4vec9NS_9allocatorIS1_EEE17__annotate_shrinkEj($51,$56);
 __ZN11OctaTerrain7addSideEi($0,0);
 __ZN11OctaTerrain7addSideEi($0,1);
 __ZN11OctaTerrain7addSideEi($0,2);
 __ZN11OctaTerrain7addSideEi($0,3);
 __ZN11OctaTerrain7addSideEi($0,4);
 __ZN11OctaTerrain7addSideEi($0,5);
 __ZN11OctaTerrain7addSideEi($0,6);
 __ZN11OctaTerrain7addSideEi($0,7);
 $62 = HEAP32[$13>>2]|0;
 $63 = ((($0)) + 20|0);
 $64 = HEAP32[$63>>2]|0;
 __ZNSt3__26__sortIRNS_6__lessIxxEEPxEEvT0_S5_T_($62,$64,$tmpcast$i$i$byval_copy);
 $65 = HEAP32[$40>>2]|0;
 $66 = HEAP32[$41>>2]|0;
 __ZNSt3__26__sortIRNS_6__lessIxxEEPxEEvT0_S5_T_($65,$66,$tmpcast$i$i$byval_copy);
 $67 = HEAP32[$13>>2]|0;
 $68 = HEAP32[$63>>2]|0;
 $69 = HEAP32[$40>>2]|0;
 $70 = HEAP32[$41>>2]|0;
 $71 = HEAP32[$30>>2]|0;
 $72 = $29;
 HEAP32[$4>>2] = $67;
 HEAP32[$5>>2] = $68;
 HEAP32[$6>>2] = $69;
 HEAP32[$7>>2] = $70;
 HEAP32[$8>>2] = $72;
 $$sroa_raw_idx = ((($8)) + 4|0);
 HEAP32[$$sroa_raw_idx>>2] = $71;
 ;HEAP32[$$byval_copy1>>2]=HEAP32[$4>>2]|0;
 ;HEAP32[$$byval_copy2>>2]=HEAP32[$5>>2]|0;
 ;HEAP32[$$byval_copy3>>2]=HEAP32[$6>>2]|0;
 ;HEAP32[$$byval_copy4>>2]=HEAP32[$7>>2]|0;
 ;HEAP32[$tmpcast$i$i$byval_copy>>2]=HEAP32[$8>>2]|0;HEAP32[$tmpcast$i$i$byval_copy+4>>2]=HEAP32[$8+4>>2]|0;
 __ZNSt3__216__set_differenceIRNS_6__lessIxxEENS_11__wrap_iterIPxEES6_NS_15insert_iteratorINS_6vectorIxNS_9allocatorIxEEEEEEEET2_T0_SE_T1_SF_SD_T_($10,$$byval_copy1,$$byval_copy2,$$byval_copy3,$$byval_copy4,$tmpcast$i$i$byval_copy,$9);
 STACKTOP = sp;return;
}
function __ZN13emOctaTerrain15chunk2intVectorENSt3__26vectorI7ChunkIdNS0_9allocatorIS2_EEEE($0,$1,$2) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 var $$sroa$013$018 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0, $27 = 0, $28 = 0;
 var $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0, $41 = 0, $42 = 0, $43 = 0, $44 = 0, $45 = 0, $5 = 0;
 var $6 = 0, $7 = 0, $8 = 0, $9 = 0, $tmpcast$byval_copy = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 32|0;
 $tmpcast$byval_copy = sp + 16|0;
 $3 = sp;
 $4 = sp + 8|0;
 HEAP32[$0>>2] = 0;
 $5 = ((($0)) + 4|0);
 HEAP32[$5>>2] = 0;
 $6 = ((($0)) + 8|0);
 HEAP32[$6>>2] = 0;
 $7 = HEAP32[$2>>2]|0;
 $8 = ((($2)) + 4|0);
 $9 = HEAP32[$8>>2]|0;
 $10 = ($7|0)==($9|0);
 if ($10) {
  STACKTOP = sp;return;
 }
 $11 = ((($0)) + 8|0);
 $$sroa$013$018 = $7;
 while(1) {
  $12 = $$sroa$013$018;
  $13 = $12;
  $14 = HEAP32[$13>>2]|0;
  $15 = (($12) + 4)|0;
  $16 = $15;
  $17 = HEAP32[$16>>2]|0;
  $18 = $4;
  $19 = $18;
  HEAP32[$19>>2] = $14;
  $20 = (($18) + 4)|0;
  $21 = $20;
  HEAP32[$21>>2] = $17;
  ;HEAP32[$tmpcast$byval_copy>>2]=HEAP32[$4>>2]|0;HEAP32[$tmpcast$byval_copy+4>>2]=HEAP32[$4+4>>2]|0;
  $22 = (__ZN13emOctaTerrain12ChunkIdtoIntE7ChunkId($1,$tmpcast$byval_copy)|0);
  $23 = tempRet0;
  $24 = $3;
  $25 = $24;
  HEAP32[$25>>2] = $22;
  $26 = (($24) + 4)|0;
  $27 = $26;
  HEAP32[$27>>2] = $23;
  $28 = HEAP32[$5>>2]|0;
  $29 = HEAP32[$11>>2]|0;
  $30 = ($28>>>0)<($29>>>0);
  if ($30) {
   __ZNSt3__26vectorIxNS_9allocatorIxEEE24__RAII_IncreaseAnnotatorC2ERKS3_j($tmpcast$byval_copy,$0,1);
   $31 = HEAP32[$5>>2]|0;
   $32 = $3;
   $33 = $32;
   $34 = HEAP32[$33>>2]|0;
   $35 = (($32) + 4)|0;
   $36 = $35;
   $37 = HEAP32[$36>>2]|0;
   $38 = $31;
   $39 = $38;
   HEAP32[$39>>2] = $34;
   $40 = (($38) + 4)|0;
   $41 = $40;
   HEAP32[$41>>2] = $37;
   __ZNSt3__26vectorIxNS_9allocatorIxEEE24__RAII_IncreaseAnnotator6__doneEv($tmpcast$byval_copy);
   $42 = HEAP32[$5>>2]|0;
   $43 = ((($42)) + 8|0);
   HEAP32[$5>>2] = $43;
  } else {
   __ZNSt3__26vectorIxNS_9allocatorIxEEE21__push_back_slow_pathIxEEvOT_($0,$3);
  }
  $44 = ((($$sroa$013$018)) + 8|0);
  $45 = ($44|0)==($9|0);
  if ($45) {
   break;
  } else {
   $$sroa$013$018 = $44;
  }
 }
 STACKTOP = sp;return;
}
function __ZNSt3__26vectorI7ChunkIdNS_9allocatorIS1_EEEC2ERKS4_($0,$1) {
 $0 = $0|0;
 $1 = $1|0;
 var $10 = 0, $11 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 HEAP32[$0>>2] = 0;
 $2 = ((($0)) + 4|0);
 HEAP32[$2>>2] = 0;
 $3 = ((($0)) + 8|0);
 HEAP32[$3>>2] = 0;
 $4 = ((($1)) + 4|0);
 $5 = HEAP32[$4>>2]|0;
 $6 = HEAP32[$1>>2]|0;
 $7 = (($5) - ($6))|0;
 $8 = $7 >> 3;
 $9 = ($8|0)==(0);
 if ($9) {
  return;
 }
 __ZNSt3__26vectorI7ChunkIdNS_9allocatorIS1_EEE8allocateEj($0,$8);
 $10 = HEAP32[$1>>2]|0;
 $11 = HEAP32[$4>>2]|0;
 __ZNSt3__26vectorI7ChunkIdNS_9allocatorIS1_EEE18__construct_at_endIPS1_EENS_9enable_ifIXsr21__is_forward_iteratorIT_EE5valueEvE4typeES8_S8_j($0,$10,$11,$8);
 return;
}
function __ZNSt3__213__vector_baseIxNS_9allocatorIxEEED2Ev($0) {
 $0 = $0|0;
 var $1 = 0, $10 = 0, $11 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, $scevgep$i$i = 0, $scevgep4$i$i = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $1 = HEAP32[$0>>2]|0;
 $2 = ($1|0)==(0|0);
 if ($2) {
  return;
 }
 $3 = ((($0)) + 4|0);
 $4 = HEAP32[$3>>2]|0;
 $5 = ($4|0)==($1|0);
 if (!($5)) {
  $scevgep$i$i = ((($4)) + -8|0);
  $6 = $scevgep$i$i;
  $7 = $1;
  $8 = (($6) - ($7))|0;
  $9 = $8 >>> 3;
  $10 = $9 ^ -1;
  $scevgep4$i$i = (($4) + ($10<<3)|0);
  HEAP32[$3>>2] = $scevgep4$i$i;
 }
 $11 = HEAP32[$0>>2]|0;
 __ZdlPv($11);
 return;
}
function __ZNSt3__213__vector_baseI7ChunkIdNS_9allocatorIS1_EEED2Ev($0) {
 $0 = $0|0;
 var $1 = 0, $10 = 0, $11 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, $scevgep$i$i = 0, $scevgep4$i$i = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $1 = HEAP32[$0>>2]|0;
 $2 = ($1|0)==(0|0);
 if ($2) {
  return;
 }
 $3 = ((($0)) + 4|0);
 $4 = HEAP32[$3>>2]|0;
 $5 = ($4|0)==($1|0);
 if (!($5)) {
  $scevgep$i$i = ((($4)) + -8|0);
  $6 = $scevgep$i$i;
  $7 = $1;
  $8 = (($6) - ($7))|0;
  $9 = $8 >>> 3;
  $10 = $9 ^ -1;
  $scevgep4$i$i = (($4) + ($10<<3)|0);
  HEAP32[$3>>2] = $scevgep4$i$i;
 }
 $11 = HEAP32[$0>>2]|0;
 __ZdlPv($11);
 return;
}
function __ZN7FrustumC2E4mat4($0,$1) {
 $0 = $0|0;
 $1 = $1|0;
 var $$sroa$0$0$$sroa_idx = 0, $$sroa$019$0$$sroa_idx = 0, $$sroa$030$0$$sroa_idx = 0, $$sroa$041$0$$sroa_idx = 0, $$sroa$08$0$$sroa_idx = 0, $$sroa$4$0$$sroa_idx2 = 0, $$sroa$410$0$$sroa_idx11 = 0, $$sroa$421$0$$sroa_idx22 = 0, $$sroa$432$0$$sroa_idx33 = 0, $$sroa$443$0$$sroa_idx44 = 0, $$sroa$454$0$$sroa_idx55 = 0, $$sroa$5$0$$sroa_idx4 = 0, $$sroa$513$0$$sroa_idx14 = 0, $$sroa$524$0$$sroa_idx25 = 0, $$sroa$535$0$$sroa_idx36 = 0, $$sroa$546$0$$sroa_idx47 = 0, $$sroa$557$0$$sroa_idx58 = 0, $$sroa$6$0$$sroa_idx6 = 0, $$sroa$616$0$$sroa_idx17 = 0, $$sroa$627$0$$sroa_idx28 = 0;
 var $$sroa$638$0$$sroa_idx39 = 0, $$sroa$649$0$$sroa_idx50 = 0, $$sroa$660$0$$sroa_idx61 = 0, $10 = 0.0, $100 = 0.0, $101 = 0.0, $102 = 0, $103 = 0.0, $104 = 0, $105 = 0.0, $106 = 0.0, $107 = 0, $108 = 0.0, $109 = 0, $11 = 0.0, $110 = 0.0, $111 = 0.0, $112 = 0, $113 = 0.0, $114 = 0;
 var $115 = 0.0, $116 = 0.0, $117 = 0, $118 = 0.0, $119 = 0, $12 = 0, $120 = 0.0, $121 = 0.0, $122 = 0, $123 = 0, $124 = 0, $125 = 0, $126 = 0, $13 = 0.0, $14 = 0, $15 = 0.0, $16 = 0.0, $17 = 0, $18 = 0.0, $19 = 0;
 var $2 = 0, $20 = 0.0, $21 = 0.0, $22 = 0, $23 = 0.0, $24 = 0, $25 = 0.0, $26 = 0.0, $27 = 0, $28 = 0.0, $29 = 0, $3 = 0.0, $30 = 0.0, $31 = 0.0, $32 = 0, $33 = 0.0, $34 = 0, $35 = 0.0, $36 = 0.0, $37 = 0;
 var $38 = 0.0, $39 = 0, $4 = 0, $40 = 0.0, $41 = 0.0, $42 = 0, $43 = 0.0, $44 = 0, $45 = 0.0, $46 = 0.0, $47 = 0, $48 = 0.0, $49 = 0, $5 = 0.0, $50 = 0.0, $51 = 0.0, $52 = 0, $53 = 0.0, $54 = 0, $55 = 0.0;
 var $56 = 0.0, $57 = 0, $58 = 0.0, $59 = 0, $6 = 0.0, $60 = 0.0, $61 = 0.0, $62 = 0, $63 = 0.0, $64 = 0, $65 = 0.0, $66 = 0.0, $67 = 0, $68 = 0.0, $69 = 0, $7 = 0, $70 = 0.0, $71 = 0.0, $72 = 0, $73 = 0.0;
 var $74 = 0, $75 = 0.0, $76 = 0.0, $77 = 0, $78 = 0.0, $79 = 0, $8 = 0.0, $80 = 0.0, $81 = 0.0, $82 = 0, $83 = 0.0, $84 = 0, $85 = 0.0, $86 = 0.0, $87 = 0, $88 = 0.0, $89 = 0, $9 = 0, $90 = 0.0, $91 = 0.0;
 var $92 = 0, $93 = 0.0, $94 = 0, $95 = 0.0, $96 = 0.0, $97 = 0, $98 = 0.0, $99 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $2 = (__ZN4mat4ixEj($1,3)|0);
 $3 = +HEAPF32[$2>>2];
 $4 = (__ZN4mat4ixEj($1,0)|0);
 $5 = +HEAPF32[$4>>2];
 $6 = $3 - $5;
 $7 = (__ZN4mat4ixEj($1,7)|0);
 $8 = +HEAPF32[$7>>2];
 $9 = (__ZN4mat4ixEj($1,4)|0);
 $10 = +HEAPF32[$9>>2];
 $11 = $8 - $10;
 $12 = (__ZN4mat4ixEj($1,11)|0);
 $13 = +HEAPF32[$12>>2];
 $14 = (__ZN4mat4ixEj($1,8)|0);
 $15 = +HEAPF32[$14>>2];
 $16 = $13 - $15;
 $17 = (__ZN4mat4ixEj($1,15)|0);
 $18 = +HEAPF32[$17>>2];
 $19 = (__ZN4mat4ixEj($1,12)|0);
 $20 = +HEAPF32[$19>>2];
 $21 = $18 - $20;
 HEAPF32[$0>>2] = $6;
 $$sroa$454$0$$sroa_idx55 = ((($0)) + 4|0);
 HEAPF32[$$sroa$454$0$$sroa_idx55>>2] = $11;
 $$sroa$557$0$$sroa_idx58 = ((($0)) + 8|0);
 HEAPF32[$$sroa$557$0$$sroa_idx58>>2] = $16;
 $$sroa$660$0$$sroa_idx61 = ((($0)) + 12|0);
 HEAPF32[$$sroa$660$0$$sroa_idx61>>2] = $21;
 $22 = (__ZN4mat4ixEj($1,3)|0);
 $23 = +HEAPF32[$22>>2];
 $24 = (__ZN4mat4ixEj($1,0)|0);
 $25 = +HEAPF32[$24>>2];
 $26 = $23 + $25;
 $27 = (__ZN4mat4ixEj($1,7)|0);
 $28 = +HEAPF32[$27>>2];
 $29 = (__ZN4mat4ixEj($1,4)|0);
 $30 = +HEAPF32[$29>>2];
 $31 = $28 + $30;
 $32 = (__ZN4mat4ixEj($1,11)|0);
 $33 = +HEAPF32[$32>>2];
 $34 = (__ZN4mat4ixEj($1,8)|0);
 $35 = +HEAPF32[$34>>2];
 $36 = $33 + $35;
 $37 = (__ZN4mat4ixEj($1,15)|0);
 $38 = +HEAPF32[$37>>2];
 $39 = (__ZN4mat4ixEj($1,12)|0);
 $40 = +HEAPF32[$39>>2];
 $41 = $38 + $40;
 $$sroa$041$0$$sroa_idx = ((($0)) + 16|0);
 HEAPF32[$$sroa$041$0$$sroa_idx>>2] = $26;
 $$sroa$443$0$$sroa_idx44 = ((($0)) + 20|0);
 HEAPF32[$$sroa$443$0$$sroa_idx44>>2] = $31;
 $$sroa$546$0$$sroa_idx47 = ((($0)) + 24|0);
 HEAPF32[$$sroa$546$0$$sroa_idx47>>2] = $36;
 $$sroa$649$0$$sroa_idx50 = ((($0)) + 28|0);
 HEAPF32[$$sroa$649$0$$sroa_idx50>>2] = $41;
 $42 = (__ZN4mat4ixEj($1,3)|0);
 $43 = +HEAPF32[$42>>2];
 $44 = (__ZN4mat4ixEj($1,1)|0);
 $45 = +HEAPF32[$44>>2];
 $46 = $43 + $45;
 $47 = (__ZN4mat4ixEj($1,7)|0);
 $48 = +HEAPF32[$47>>2];
 $49 = (__ZN4mat4ixEj($1,5)|0);
 $50 = +HEAPF32[$49>>2];
 $51 = $48 + $50;
 $52 = (__ZN4mat4ixEj($1,11)|0);
 $53 = +HEAPF32[$52>>2];
 $54 = (__ZN4mat4ixEj($1,9)|0);
 $55 = +HEAPF32[$54>>2];
 $56 = $53 + $55;
 $57 = (__ZN4mat4ixEj($1,15)|0);
 $58 = +HEAPF32[$57>>2];
 $59 = (__ZN4mat4ixEj($1,13)|0);
 $60 = +HEAPF32[$59>>2];
 $61 = $58 + $60;
 $$sroa$030$0$$sroa_idx = ((($0)) + 32|0);
 HEAPF32[$$sroa$030$0$$sroa_idx>>2] = $46;
 $$sroa$432$0$$sroa_idx33 = ((($0)) + 36|0);
 HEAPF32[$$sroa$432$0$$sroa_idx33>>2] = $51;
 $$sroa$535$0$$sroa_idx36 = ((($0)) + 40|0);
 HEAPF32[$$sroa$535$0$$sroa_idx36>>2] = $56;
 $$sroa$638$0$$sroa_idx39 = ((($0)) + 44|0);
 HEAPF32[$$sroa$638$0$$sroa_idx39>>2] = $61;
 $62 = (__ZN4mat4ixEj($1,3)|0);
 $63 = +HEAPF32[$62>>2];
 $64 = (__ZN4mat4ixEj($1,1)|0);
 $65 = +HEAPF32[$64>>2];
 $66 = $63 - $65;
 $67 = (__ZN4mat4ixEj($1,7)|0);
 $68 = +HEAPF32[$67>>2];
 $69 = (__ZN4mat4ixEj($1,5)|0);
 $70 = +HEAPF32[$69>>2];
 $71 = $68 - $70;
 $72 = (__ZN4mat4ixEj($1,11)|0);
 $73 = +HEAPF32[$72>>2];
 $74 = (__ZN4mat4ixEj($1,9)|0);
 $75 = +HEAPF32[$74>>2];
 $76 = $73 - $75;
 $77 = (__ZN4mat4ixEj($1,15)|0);
 $78 = +HEAPF32[$77>>2];
 $79 = (__ZN4mat4ixEj($1,13)|0);
 $80 = +HEAPF32[$79>>2];
 $81 = $78 - $80;
 $$sroa$019$0$$sroa_idx = ((($0)) + 48|0);
 HEAPF32[$$sroa$019$0$$sroa_idx>>2] = $66;
 $$sroa$421$0$$sroa_idx22 = ((($0)) + 52|0);
 HEAPF32[$$sroa$421$0$$sroa_idx22>>2] = $71;
 $$sroa$524$0$$sroa_idx25 = ((($0)) + 56|0);
 HEAPF32[$$sroa$524$0$$sroa_idx25>>2] = $76;
 $$sroa$627$0$$sroa_idx28 = ((($0)) + 60|0);
 HEAPF32[$$sroa$627$0$$sroa_idx28>>2] = $81;
 $82 = (__ZN4mat4ixEj($1,3)|0);
 $83 = +HEAPF32[$82>>2];
 $84 = (__ZN4mat4ixEj($1,2)|0);
 $85 = +HEAPF32[$84>>2];
 $86 = $83 - $85;
 $87 = (__ZN4mat4ixEj($1,7)|0);
 $88 = +HEAPF32[$87>>2];
 $89 = (__ZN4mat4ixEj($1,6)|0);
 $90 = +HEAPF32[$89>>2];
 $91 = $88 - $90;
 $92 = (__ZN4mat4ixEj($1,11)|0);
 $93 = +HEAPF32[$92>>2];
 $94 = (__ZN4mat4ixEj($1,10)|0);
 $95 = +HEAPF32[$94>>2];
 $96 = $93 - $95;
 $97 = (__ZN4mat4ixEj($1,15)|0);
 $98 = +HEAPF32[$97>>2];
 $99 = (__ZN4mat4ixEj($1,14)|0);
 $100 = +HEAPF32[$99>>2];
 $101 = $98 - $100;
 $$sroa$08$0$$sroa_idx = ((($0)) + 64|0);
 HEAPF32[$$sroa$08$0$$sroa_idx>>2] = $86;
 $$sroa$410$0$$sroa_idx11 = ((($0)) + 68|0);
 HEAPF32[$$sroa$410$0$$sroa_idx11>>2] = $91;
 $$sroa$513$0$$sroa_idx14 = ((($0)) + 72|0);
 HEAPF32[$$sroa$513$0$$sroa_idx14>>2] = $96;
 $$sroa$616$0$$sroa_idx17 = ((($0)) + 76|0);
 HEAPF32[$$sroa$616$0$$sroa_idx17>>2] = $101;
 $102 = (__ZN4mat4ixEj($1,3)|0);
 $103 = +HEAPF32[$102>>2];
 $104 = (__ZN4mat4ixEj($1,2)|0);
 $105 = +HEAPF32[$104>>2];
 $106 = $103 + $105;
 $107 = (__ZN4mat4ixEj($1,7)|0);
 $108 = +HEAPF32[$107>>2];
 $109 = (__ZN4mat4ixEj($1,6)|0);
 $110 = +HEAPF32[$109>>2];
 $111 = $108 + $110;
 $112 = (__ZN4mat4ixEj($1,11)|0);
 $113 = +HEAPF32[$112>>2];
 $114 = (__ZN4mat4ixEj($1,10)|0);
 $115 = +HEAPF32[$114>>2];
 $116 = $113 + $115;
 $117 = (__ZN4mat4ixEj($1,15)|0);
 $118 = +HEAPF32[$117>>2];
 $119 = (__ZN4mat4ixEj($1,14)|0);
 $120 = +HEAPF32[$119>>2];
 $121 = $118 + $120;
 $$sroa$0$0$$sroa_idx = ((($0)) + 80|0);
 HEAPF32[$$sroa$0$0$$sroa_idx>>2] = $106;
 $$sroa$4$0$$sroa_idx2 = ((($0)) + 84|0);
 HEAPF32[$$sroa$4$0$$sroa_idx2>>2] = $111;
 $$sroa$5$0$$sroa_idx4 = ((($0)) + 88|0);
 HEAPF32[$$sroa$5$0$$sroa_idx4>>2] = $116;
 $$sroa$6$0$$sroa_idx6 = ((($0)) + 92|0);
 HEAPF32[$$sroa$6$0$$sroa_idx6>>2] = $121;
 __ZN5Plane9normalizeEv($0);
 $122 = ((($0)) + 16|0);
 __ZN5Plane9normalizeEv($122);
 $123 = ((($0)) + 32|0);
 __ZN5Plane9normalizeEv($123);
 $124 = ((($0)) + 48|0);
 __ZN5Plane9normalizeEv($124);
 $125 = ((($0)) + 64|0);
 __ZN5Plane9normalizeEv($125);
 $126 = ((($0)) + 80|0);
 __ZN5Plane9normalizeEv($126);
 return;
}
function __ZN11OctaTerrain7addSideEi($0,$1) {
 $0 = $0|0;
 $1 = $1|0;
 var $$byval_copy2 = 0, $$sroa$4$0$$sroa_idx2 = 0, $$sroa$411$0$$sroa_idx12 = 0, $$sroa$46$0$$sroa_idx7 = 0, $10 = 0, $11 = 0.0, $12 = 0, $13 = 0.0, $14 = 0.0, $15 = 0, $16 = 0.0, $17 = 0.0, $18 = 0.0, $19 = 0.0, $2 = 0, $20 = 0, $21 = 0, $3 = 0, $4 = 0, $5 = 0;
 var $6 = 0, $7 = 0, $8 = 0, $9 = 0.0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 80|0;
 $$byval_copy2 = sp + 64|0;
 $2 = sp + 40|0;
 $3 = sp + 56|0;
 $4 = sp + 20|0;
 $5 = sp + 32|0;
 $6 = sp + 8|0;
 $7 = sp;
 $8 = ($1|0)>(3);
 $9 = $8 ? -1.0 : 1.0;
 $10 = (($1|0) % 4)&-1;
 $11 = (+($10|0));
 $12 = ((($0)) + 184|0);
 $13 = +HEAPF32[$12>>2];
 $14 = $9 * $13;
 $15 = ((($0)) + 188|0);
 $16 = +HEAPF32[$15>>2];
 $17 = $11 * $16;
 $18 = $11 + 1.0;
 $19 = $18 * $16;
 HEAPF32[$3>>2] = $14;
 $$sroa$411$0$$sroa_idx12 = ((($3)) + 4|0);
 HEAPF32[$$sroa$411$0$$sroa_idx12>>2] = $17;
 ;HEAP32[$$byval_copy2>>2]=HEAP32[$3>>2]|0;HEAP32[$$byval_copy2+4>>2]=HEAP32[$3+4>>2]|0;
 __ZN11OctaTerrain7toPointE4vec2($2,$0,$$byval_copy2);
 HEAPF32[$5>>2] = 0.0;
 $$sroa$46$0$$sroa_idx7 = ((($5)) + 4|0);
 HEAPF32[$$sroa$46$0$$sroa_idx7>>2] = $17;
 ;HEAP32[$$byval_copy2>>2]=HEAP32[$5>>2]|0;HEAP32[$$byval_copy2+4>>2]=HEAP32[$5+4>>2]|0;
 __ZN11OctaTerrain7toPointE4vec2($4,$0,$$byval_copy2);
 HEAPF32[$7>>2] = 0.0;
 $$sroa$4$0$$sroa_idx2 = ((($7)) + 4|0);
 HEAPF32[$$sroa$4$0$$sroa_idx2>>2] = $19;
 ;HEAP32[$$byval_copy2>>2]=HEAP32[$7>>2]|0;HEAP32[$$byval_copy2+4>>2]=HEAP32[$7+4>>2]|0;
 __ZN11OctaTerrain7toPointE4vec2($6,$0,$$byval_copy2);
 $20 = (__ZN11OctaTerrain9setIdSideEi($0,$1)|0);
 $21 = tempRet0;
 __ZN11OctaTerrain8addChunkER4vec3S1_S1_xbb($0,$2,$4,$6,$20,$21,1,1);
 STACKTOP = sp;return;
}
function __ZN4mat4ixEj($0,$1) {
 $0 = $0|0;
 $1 = $1|0;
 var $2 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $2 = (($0) + ($1<<2)|0);
 return ($2|0);
}
function __ZN5Plane9normalizeEv($0) {
 $0 = $0|0;
 var $1 = 0.0, $10 = 0.0, $11 = 0.0, $12 = 0.0, $13 = 0.0, $14 = 0.0, $15 = 0.0, $16 = 0.0, $17 = 0, $18 = 0.0, $19 = 0.0, $2 = 0.0, $3 = 0, $4 = 0.0, $5 = 0.0, $6 = 0.0, $7 = 0, $8 = 0.0, $9 = 0.0, label = 0;
 var sp = 0;
 sp = STACKTOP;
 $1 = +HEAPF32[$0>>2];
 $2 = $1 * $1;
 $3 = ((($0)) + 4|0);
 $4 = +HEAPF32[$3>>2];
 $5 = $4 * $4;
 $6 = $2 + $5;
 $7 = ((($0)) + 8|0);
 $8 = +HEAPF32[$7>>2];
 $9 = $8 * $8;
 $10 = $6 + $9;
 $11 = (+Math_sqrt((+$10)));
 $12 = $1 / $11;
 HEAPF32[$0>>2] = $12;
 $13 = +HEAPF32[$3>>2];
 $14 = $13 / $11;
 HEAPF32[$3>>2] = $14;
 $15 = +HEAPF32[$7>>2];
 $16 = $15 / $11;
 HEAPF32[$7>>2] = $16;
 $17 = ((($0)) + 12|0);
 $18 = +HEAPF32[$17>>2];
 $19 = $18 / $11;
 HEAPF32[$17>>2] = $19;
 return;
}
function __ZNSt3__26vectorIxNS_9allocatorIxEEE6assignIPxEENS_9enable_ifIXaasr21__is_forward_iteratorIT_EE5valuesr16is_constructibleIxNS_15iterator_traitsIS7_E9referenceEEE5valueEvE4typeES7_S7_($0,$1,$2) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 var $$ = 0, $$0$i = 0, $$cast$i = 0, $$sroa$speculated$i = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0;
 var $26 = 0, $27 = 0, $28 = 0, $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0, $41 = 0, $42 = 0, $43 = 0;
 var $44 = 0, $45 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, $scevgep$i$i = 0, $scevgep4$i$i = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $3 = $2;
 $4 = $1;
 $5 = (($3) - ($4))|0;
 $6 = $5 >> 3;
 $7 = ((($0)) + 8|0);
 $8 = HEAP32[$7>>2]|0;
 $9 = HEAP32[$0>>2]|0;
 $10 = (($8) - ($9))|0;
 $11 = $10 >> 3;
 $12 = ($6>>>0)>($11>>>0);
 if ($12) {
  __ZNSt3__26vectorIxNS_9allocatorIxEEE10deallocateEv($0);
  $36 = (__ZNKSt3__26vectorIxNS_9allocatorIxEEE8max_sizeEv($0)|0);
  $37 = ($36>>>0)<($6>>>0);
  if ($37) {
   __ZNKSt3__220__vector_base_commonILb1EE20__throw_length_errorEv($0);
   // unreachable;
  }
  $38 = HEAP32[$7>>2]|0;
  $39 = HEAP32[$0>>2]|0;
  $40 = (($38) - ($39))|0;
  $41 = $40 >> 3;
  $42 = $36 >>> 1;
  $43 = ($41>>>0)<($42>>>0);
  $44 = $40 >> 2;
  $45 = ($44>>>0)<($6>>>0);
  $$sroa$speculated$i = $45 ? $6 : $44;
  $$0$i = $43 ? $$sroa$speculated$i : $36;
  __ZNSt3__26vectorIxNS_9allocatorIxEEE8allocateEj($0,$$0$i);
  __ZNSt3__26vectorIxNS_9allocatorIxEEE18__construct_at_endIPxEENS_9enable_ifIXsr21__is_forward_iteratorIT_EE5valueEvE4typeES7_S7_j($0,$1,$2,$6);
  return;
 }
 $13 = ((($0)) + 4|0);
 $14 = HEAP32[$13>>2]|0;
 $15 = (($14) - ($9))|0;
 $16 = $15 >> 3;
 $17 = ($6>>>0)>($16>>>0);
 $18 = (($1) + ($16<<3)|0);
 $$ = $17 ? $18 : $2;
 $19 = HEAP32[$0>>2]|0;
 $20 = $$;
 $21 = (($20) - ($4))|0;
 $22 = $21 >> 3;
 $23 = ($22|0)==(0);
 if (!($23)) {
  _memmove(($19|0),($1|0),($21|0))|0;
 }
 $24 = (($19) + ($22<<3)|0);
 $25 = HEAP32[$13>>2]|0;
 $26 = HEAP32[$0>>2]|0;
 $27 = (($25) - ($26))|0;
 $28 = $27 >> 3;
 if ($17) {
  $29 = (($6) - ($28))|0;
  __ZNSt3__26vectorIxNS_9allocatorIxEEE18__construct_at_endIPxEENS_9enable_ifIXsr21__is_forward_iteratorIT_EE5valueEvE4typeES7_S7_j($0,$$,$2,$29);
  return;
 }
 $$cast$i = $25;
 $30 = ($$cast$i|0)==($24|0);
 if (!($30)) {
  $scevgep$i$i = ((($$cast$i)) + -8|0);
  $31 = $scevgep$i$i;
  $32 = $24;
  $33 = (($31) - ($32))|0;
  $34 = $33 >>> 3;
  $35 = $34 ^ -1;
  $scevgep4$i$i = (($$cast$i) + ($35<<3)|0);
  HEAP32[$13>>2] = $scevgep4$i$i;
 }
 __ZNKSt3__26vectorIxNS_9allocatorIxEEE17__annotate_shrinkEj($0,$28);
 return;
}
function __ZNSt3__26vectorIxNS_9allocatorIxEEE18__construct_at_endIPxEENS_9enable_ifIXsr21__is_forward_iteratorIT_EE5valueEvE4typeES7_S7_j($0,$1,$2,$3) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 $3 = $3|0;
 var $10 = 0, $11 = 0, $12 = 0, $13 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0;
 $4 = sp;
 __ZNSt3__26vectorIxNS_9allocatorIxEEE24__RAII_IncreaseAnnotatorC2ERKS3_j($4,$0,$3);
 $5 = ((($0)) + 4|0);
 $6 = $2;
 $7 = $1;
 $8 = (($6) - ($7))|0;
 $9 = ($8|0)>(0);
 if ($9) {
  $10 = $8 >> 3;
  $11 = HEAP32[$5>>2]|0;
  _memcpy(($11|0),($1|0),($8|0))|0;
  $12 = HEAP32[$5>>2]|0;
  $13 = (($12) + ($10<<3)|0);
  HEAP32[$5>>2] = $13;
 }
 __ZNSt3__26vectorIxNS_9allocatorIxEEE24__RAII_IncreaseAnnotator6__doneEv($4);
 STACKTOP = sp;return;
}
function __ZNSt3__26vectorIxNS_9allocatorIxEEE10deallocateEv($0) {
 $0 = $0|0;
 var $$cast = 0, $$cast$i = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, $scevgep$i$i$i = 0, $scevgep4$i$i$i = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $1 = HEAP32[$0>>2]|0;
 $2 = ($1|0)==(0|0);
 if ($2) {
  return;
 }
 $3 = ((($0)) + 4|0);
 $4 = HEAP32[$3>>2]|0;
 $5 = HEAP32[$0>>2]|0;
 $6 = (($4) - ($5))|0;
 $7 = $6 >> 3;
 $$cast$i = $5;
 $$cast = $4;
 $8 = ($$cast|0)==($$cast$i|0);
 if (!($8)) {
  $scevgep$i$i$i = ((($$cast)) + -8|0);
  $9 = $scevgep$i$i$i;
  $10 = (($9) - ($5))|0;
  $11 = $10 >>> 3;
  $12 = $11 ^ -1;
  $scevgep4$i$i$i = (($$cast) + ($12<<3)|0);
  HEAP32[$3>>2] = $scevgep4$i$i$i;
 }
 __ZNKSt3__26vectorIxNS_9allocatorIxEEE17__annotate_shrinkEj($0,$7);
 $13 = HEAP32[$0>>2]|0;
 __ZdlPv($13);
 $14 = ((($0)) + 8|0);
 HEAP32[$14>>2] = 0;
 HEAP32[$3>>2] = 0;
 HEAP32[$0>>2] = 0;
 return;
}
function __ZNSt3__26vectorIxNS_9allocatorIxEEE8allocateEj($0,$1) {
 $0 = $0|0;
 $1 = $1|0;
 var $10 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $2 = (__ZNKSt3__26vectorIxNS_9allocatorIxEEE8max_sizeEv($0)|0);
 $3 = ($2>>>0)<($1>>>0);
 if ($3) {
  __ZNKSt3__220__vector_base_commonILb1EE20__throw_length_errorEv($0);
  // unreachable;
 }
 $4 = ($1>>>0)>(536870911);
 if ($4) {
  $5 = (___cxa_allocate_exception(4)|0);
  __ZNSt9bad_allocC2Ev($5);
  ___cxa_throw(($5|0),(512|0),(6|0));
  // unreachable;
 } else {
  $6 = $1 << 3;
  $7 = (__Znwj($6)|0);
  $8 = ((($0)) + 4|0);
  HEAP32[$8>>2] = $7;
  HEAP32[$0>>2] = $7;
  $9 = (($7) + ($1<<3)|0);
  $10 = ((($0)) + 8|0);
  HEAP32[$10>>2] = $9;
  __ZNKSt3__26vectorIxNS_9allocatorIxEEE14__annotate_newEj($0,0);
  return;
 }
}
function __ZNSt3__26vectorIxNS_9allocatorIxEEE24__RAII_IncreaseAnnotatorC2ERKS3_j($0,$1,$2) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 var label = 0, sp = 0;
 sp = STACKTOP;
 return;
}
function __ZNSt3__26vectorIxNS_9allocatorIxEEE24__RAII_IncreaseAnnotator6__doneEv($0) {
 $0 = $0|0;
 var label = 0, sp = 0;
 sp = STACKTOP;
 return;
}
function __ZNKSt3__26vectorIxNS_9allocatorIxEEE17__annotate_shrinkEj($0,$1) {
 $0 = $0|0;
 $1 = $1|0;
 var $$cast = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $2 = HEAP32[$0>>2]|0;
 $3 = ((($0)) + 8|0);
 $4 = HEAP32[$3>>2]|0;
 $$cast = $2;
 $5 = (($4) - ($$cast))|0;
 $6 = $5 >> 3;
 $7 = (($2) + ($6<<3)|0);
 $8 = (($2) + ($1<<3)|0);
 $9 = ((($0)) + 4|0);
 $10 = HEAP32[$9>>2]|0;
 $11 = (($10) - ($$cast))|0;
 $12 = $11 >> 3;
 $13 = (($2) + ($12<<3)|0);
 __ZNKSt3__26vectorIxNS_9allocatorIxEEE31__annotate_contiguous_containerEPKvS5_S5_S5_($0,$2,$7,$8,$13);
 return;
}
function ___clang_call_terminate($0) {
 $0 = $0|0;
 var label = 0, sp = 0;
 sp = STACKTOP;
 (___cxa_begin_catch(($0|0))|0);
 __ZSt9terminatev();
 // unreachable;
}
function __ZNKSt3__26vectorIxNS_9allocatorIxEEE31__annotate_contiguous_containerEPKvS5_S5_S5_($0,$1,$2,$3,$4) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 $3 = $3|0;
 $4 = $4|0;
 var label = 0, sp = 0;
 sp = STACKTOP;
 return;
}
function __ZNKSt3__26vectorIxNS_9allocatorIxEEE8max_sizeEv($0) {
 $0 = $0|0;
 var label = 0, sp = 0;
 sp = STACKTOP;
 return 536870911;
}
function __ZNKSt3__26vectorIxNS_9allocatorIxEEE14__annotate_newEj($0,$1) {
 $0 = $0|0;
 $1 = $1|0;
 var $$cast = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $2 = HEAP32[$0>>2]|0;
 $3 = ((($0)) + 8|0);
 $4 = HEAP32[$3>>2]|0;
 $$cast = $2;
 $5 = (($4) - ($$cast))|0;
 $6 = $5 >> 3;
 $7 = (($2) + ($6<<3)|0);
 $8 = (($2) + ($1<<3)|0);
 __ZNKSt3__26vectorIxNS_9allocatorIxEEE31__annotate_contiguous_containerEPKvS5_S5_S5_($0,$2,$7,$7,$8);
 return;
}
function __ZNKSt3__26vectorI4vec9NS_9allocatorIS1_EEE4sizeEv($0) {
 $0 = $0|0;
 var $1 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $1 = ((($0)) + 4|0);
 $2 = HEAP32[$1>>2]|0;
 $3 = HEAP32[$0>>2]|0;
 $4 = (($2) - ($3))|0;
 $5 = (($4|0) / 36)&-1;
 return ($5|0);
}
function __ZNKSt3__26vectorI4vec9NS_9allocatorIS1_EEE17__annotate_shrinkEj($0,$1) {
 $0 = $0|0;
 $1 = $1|0;
 var $$cast = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $2 = HEAP32[$0>>2]|0;
 $3 = ((($0)) + 8|0);
 $4 = HEAP32[$3>>2]|0;
 $$cast = $2;
 $5 = (($4) - ($$cast))|0;
 $6 = (($5|0) / 36)&-1;
 $7 = (($2) + (($6*36)|0)|0);
 $8 = (($2) + (($1*36)|0)|0);
 $9 = ((($0)) + 4|0);
 $10 = HEAP32[$9>>2]|0;
 $11 = (($10) - ($$cast))|0;
 $12 = (($11|0) / 36)&-1;
 $13 = (($2) + (($12*36)|0)|0);
 __ZNKSt3__26vectorI4vec9NS_9allocatorIS1_EEE31__annotate_contiguous_containerEPKvS6_S6_S6_($0,$2,$7,$8,$13);
 return;
}
function __ZNKSt3__26vectorI4vec9NS_9allocatorIS1_EEE31__annotate_contiguous_containerEPKvS6_S6_S6_($0,$1,$2,$3,$4) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 $3 = $3|0;
 $4 = $4|0;
 var label = 0, sp = 0;
 sp = STACKTOP;
 return;
}
function __ZN11OctaTerrain7toPointE4vec2($0,$1,$2) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 var $3 = 0, $4 = 0.0, $5 = 0, $6 = 0.0, label = 0, sp = 0;
 sp = STACKTOP;
 $3 = (__ZN4vec2ixEj($2,0)|0);
 $4 = +HEAPF32[$3>>2];
 $5 = (__ZN4vec2ixEj($2,1)|0);
 $6 = +HEAPF32[$5>>2];
 __ZN11OctaTerrain7toPointEff($0,$1,$4,$6);
 return;
}
function __ZN11OctaTerrain8addChunkER4vec3S1_S1_xbb($0,$1,$2,$3,$4,$5,$6,$7) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 $3 = $3|0;
 $4 = $4|0;
 $5 = $5|0;
 $6 = $6|0;
 $7 = $7|0;
 var $$byval_copy2 = 0, $10 = 0, $100 = 0, $101 = 0, $102 = 0, $103 = 0, $104 = 0, $105 = 0, $106 = 0, $107 = 0, $108 = 0, $109 = 0, $11 = 0, $110 = 0, $111 = 0, $112 = 0, $113 = 0, $114 = 0, $115 = 0, $116 = 0;
 var $117 = 0, $118 = 0, $119 = 0, $12 = 0, $120 = 0, $121 = 0, $122 = 0, $123 = 0, $124 = 0, $125 = 0, $126 = 0, $127 = 0, $128 = 0, $129 = 0, $13 = 0, $130 = 0, $131 = 0, $132 = 0, $133 = 0, $134 = 0;
 var $135 = 0, $136 = 0, $137 = 0, $138 = 0, $139 = 0, $14 = 0, $140 = 0, $141 = 0, $142 = 0, $143 = 0, $144 = 0, $145 = 0, $146 = 0, $147 = 0, $148 = 0, $149 = 0, $15 = 0, $150 = 0, $151 = 0, $152 = 0;
 var $153 = 0, $154 = 0, $155 = 0, $156 = 0, $157 = 0, $158 = 0, $159 = 0, $16 = 0, $160 = 0, $161 = 0, $162 = 0, $163 = 0, $164 = 0, $165 = 0, $166 = 0, $167 = 0, $168 = 0, $169 = 0, $17 = 0, $170 = 0;
 var $171 = 0, $172 = 0, $173 = 0, $174 = 0, $175 = 0, $176 = 0, $177 = 0, $178 = 0, $179 = 0, $18 = 0, $180 = 0, $181 = 0, $182 = 0, $183 = 0, $184 = 0, $185 = 0, $186 = 0, $187 = 0, $188 = 0, $189 = 0;
 var $19 = 0, $190 = 0, $191 = 0, $192 = 0, $193 = 0, $194 = 0, $195 = 0, $196 = 0, $197 = 0, $198 = 0, $20 = 0.0, $21 = 0.0, $22 = 0.0, $23 = 0, $24 = 0, $25 = 0, $26 = 0, $27 = 0, $28 = 0, $29 = 0;
 var $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $40 = 0, $41 = 0, $42 = 0, $43 = 0, $44 = 0, $45 = 0, $46 = 0, $47 = 0, $48 = 0, $49 = 0;
 var $50 = 0, $51 = 0, $52 = 0, $53 = 0, $54 = 0, $55 = 0, $56 = 0, $57 = 0, $58 = 0, $59 = 0, $60 = 0, $61 = 0, $62 = 0, $63 = 0, $64 = 0, $65 = 0, $66 = 0, $67 = 0, $68 = 0, $69 = 0;
 var $70 = 0, $71 = 0, $72 = 0, $73 = 0, $74 = 0, $75 = 0, $76 = 0, $77 = 0, $78 = 0, $79 = 0, $8 = 0, $80 = 0, $81 = 0, $82 = 0, $83 = 0, $84 = 0, $85 = 0, $86 = 0, $87 = 0, $88 = 0;
 var $89 = 0, $9 = 0, $90 = 0, $91 = 0, $92 = 0, $93 = 0, $94 = 0, $95 = 0, $96 = 0, $97 = 0, $98 = 0, $99 = 0, $phitmp = 0, dest = 0, label = 0, sp = 0, src = 0, stop = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 128|0;
 $$byval_copy2 = sp + 116|0;
 $8 = sp;
 $9 = sp + 68|0;
 $10 = sp + 104|0;
 $11 = sp + 56|0;
 $12 = sp + 92|0;
 $13 = sp + 44|0;
 $14 = sp + 80|0;
 $15 = sp + 8|0;
 $16 = $8;
 $17 = $16;
 HEAP32[$17>>2] = $4;
 $18 = (($16) + 4)|0;
 $19 = $18;
 HEAP32[$19>>2] = $5;
 $20 = +HEAPF32[$0>>2];
 __ZN4vec39normalizeEf($$byval_copy2,$1,$20);
 ;HEAP32[$1>>2]=HEAP32[$$byval_copy2>>2]|0;HEAP32[$1+4>>2]=HEAP32[$$byval_copy2+4>>2]|0;HEAP32[$1+8>>2]=HEAP32[$$byval_copy2+8>>2]|0;
 $21 = +HEAPF32[$0>>2];
 __ZN4vec39normalizeEf($$byval_copy2,$2,$21);
 ;HEAP32[$2>>2]=HEAP32[$$byval_copy2>>2]|0;HEAP32[$2+4>>2]=HEAP32[$$byval_copy2+4>>2]|0;HEAP32[$2+8>>2]=HEAP32[$$byval_copy2+8>>2]|0;
 $22 = +HEAPF32[$0>>2];
 __ZN4vec39normalizeEf($$byval_copy2,$3,$22);
 ;HEAP32[$3>>2]=HEAP32[$$byval_copy2>>2]|0;HEAP32[$3+4>>2]=HEAP32[$$byval_copy2+4>>2]|0;HEAP32[$3+8>>2]=HEAP32[$$byval_copy2+8>>2]|0;
 if ($6) {
  $23 = $8;
  $24 = $23;
  $25 = HEAP32[$24>>2]|0;
  $26 = (($23) + 4)|0;
  $27 = $26;
  $28 = HEAP32[$27>>2]|0;
  $29 = (__ZN11OctaTerrain10getIdLevelEx($0,$25,$28)|0);
  $30 = ((($0)) + 4|0);
  $31 = HEAP32[$30>>2]|0;
  $32 = ($29|0)<($31|0);
  if ($32) {
   $33 = ((($0)) + 76|0);
   $34 = (__ZN11OctaTerrain10needDivideER4vec3S1_S1_S1_i($0,$33,$1,$2,$3,$29)|0);
   if ($34) {
    $35 = ((($0)) + 13|0);
    $36 = HEAP8[$35>>0]|0;
    $37 = ($36<<24>>24)==(0);
    if ($37) {
     $59 = 1;
    } else {
     $38 = $8;
     $39 = $38;
     $40 = HEAP32[$39>>2]|0;
     $41 = (($38) + 4)|0;
     $42 = $41;
     $43 = HEAP32[$42>>2]|0;
     $44 = (__ZN11OctaTerrain10existChunkEx($0,$40,$43)|0);
     $phitmp = $44 ^ 1;
     $59 = $phitmp;
    }
    ;HEAP32[$$byval_copy2>>2]=HEAP32[$2>>2]|0;HEAP32[$$byval_copy2+4>>2]=HEAP32[$2+4>>2]|0;HEAP32[$$byval_copy2+8>>2]=HEAP32[$2+8>>2]|0;
    __ZN4vec3plES_($10,$1,$$byval_copy2);
    __ZN4vec3dvEf($9,$10,2.0);
    ;HEAP32[$$byval_copy2>>2]=HEAP32[$3>>2]|0;HEAP32[$$byval_copy2+4>>2]=HEAP32[$3+4>>2]|0;HEAP32[$$byval_copy2+8>>2]=HEAP32[$3+8>>2]|0;
    __ZN4vec3plES_($12,$2,$$byval_copy2);
    __ZN4vec3dvEf($11,$12,2.0);
    ;HEAP32[$$byval_copy2>>2]=HEAP32[$1>>2]|0;HEAP32[$$byval_copy2+4>>2]=HEAP32[$1+4>>2]|0;HEAP32[$$byval_copy2+8>>2]=HEAP32[$1+8>>2]|0;
    __ZN4vec3plES_($14,$3,$$byval_copy2);
    __ZN4vec3dvEf($13,$14,2.0);
    $45 = $8;
    $46 = $45;
    $47 = HEAP32[$46>>2]|0;
    $48 = (($45) + 4)|0;
    $49 = $48;
    $50 = HEAP32[$49>>2]|0;
    $51 = (__ZN11OctaTerrain15increaseIdLevelEx($0,$47,$50)|0);
    $52 = tempRet0;
    $53 = $8;
    $54 = $53;
    HEAP32[$54>>2] = $51;
    $55 = (($53) + 4)|0;
    $56 = $55;
    HEAP32[$56>>2] = $52;
    $57 = (__ZN11OctaTerrain10setIdIndexExi($0,$51,$52,0)|0);
    $58 = tempRet0;
    if ($7) {
     __ZN11OctaTerrain8addChunkER4vec3S1_S1_xbb($0,$1,$9,$13,$57,$58,$59,1);
     $60 = $8;
     $61 = $60;
     $62 = HEAP32[$61>>2]|0;
     $63 = (($60) + 4)|0;
     $64 = $63;
     $65 = HEAP32[$64>>2]|0;
     $66 = (__ZN11OctaTerrain10setIdIndexExi($0,$62,$65,1)|0);
     $67 = tempRet0;
     __ZN11OctaTerrain8addChunkER4vec3S1_S1_xbb($0,$9,$11,$13,$66,$67,$59,0);
     $68 = $8;
     $69 = $68;
     $70 = HEAP32[$69>>2]|0;
     $71 = (($68) + 4)|0;
     $72 = $71;
     $73 = HEAP32[$72>>2]|0;
     $74 = (__ZN11OctaTerrain10setIdIndexExi($0,$70,$73,2)|0);
     $75 = tempRet0;
     __ZN11OctaTerrain8addChunkER4vec3S1_S1_xbb($0,$9,$2,$11,$74,$75,$59,1);
     $76 = $8;
     $77 = $76;
     $78 = HEAP32[$77>>2]|0;
     $79 = (($76) + 4)|0;
     $80 = $79;
     $81 = HEAP32[$80>>2]|0;
     $82 = (__ZN11OctaTerrain10setIdIndexExi($0,$78,$81,3)|0);
     $83 = tempRet0;
     __ZN11OctaTerrain8addChunkER4vec3S1_S1_xbb($0,$13,$11,$3,$82,$83,$59,1);
    } else {
     __ZN11OctaTerrain8addChunkER4vec3S1_S1_xbb($0,$1,$9,$13,$57,$58,$59,0);
     $84 = $8;
     $85 = $84;
     $86 = HEAP32[$85>>2]|0;
     $87 = (($84) + 4)|0;
     $88 = $87;
     $89 = HEAP32[$88>>2]|0;
     $90 = (__ZN11OctaTerrain10setIdIndexExi($0,$86,$89,2)|0);
     $91 = tempRet0;
     __ZN11OctaTerrain8addChunkER4vec3S1_S1_xbb($0,$13,$11,$3,$90,$91,$59,0);
     $92 = $8;
     $93 = $92;
     $94 = HEAP32[$93>>2]|0;
     $95 = (($92) + 4)|0;
     $96 = $95;
     $97 = HEAP32[$96>>2]|0;
     $98 = (__ZN11OctaTerrain10setIdIndexExi($0,$94,$97,1)|0);
     $99 = tempRet0;
     __ZN11OctaTerrain8addChunkER4vec3S1_S1_xbb($0,$13,$9,$11,$98,$99,$59,1);
     $100 = $8;
     $101 = $100;
     $102 = HEAP32[$101>>2]|0;
     $103 = (($100) + 4)|0;
     $104 = $103;
     $105 = HEAP32[$104>>2]|0;
     $106 = (__ZN11OctaTerrain10setIdIndexExi($0,$102,$105,3)|0);
     $107 = tempRet0;
     __ZN11OctaTerrain8addChunkER4vec3S1_S1_xbb($0,$9,$2,$11,$106,$107,$59,0);
    }
    STACKTOP = sp;return;
   }
  }
 }
 $108 = $8;
 $109 = $108;
 $110 = HEAP32[$109>>2]|0;
 $111 = (($108) + 4)|0;
 $112 = $111;
 $113 = HEAP32[$112>>2]|0;
 $114 = (__ZN11OctaTerrain10existChunkEx($0,$110,$113)|0);
 if ($114) {
  $115 = ((($0)) + 28|0);
  $116 = ((($0)) + 32|0);
  $117 = HEAP32[$116>>2]|0;
  $118 = ((($0)) + 36|0);
  $119 = HEAP32[$118>>2]|0;
  $120 = ($117|0)==($119|0);
  if ($120) {
   __ZNSt3__26vectorIxNS_9allocatorIxEEE21__push_back_slow_pathIRKxEEvOT_($115,$8);
   STACKTOP = sp;return;
  } else {
   __ZNSt3__26vectorIxNS_9allocatorIxEEE24__RAII_IncreaseAnnotatorC2ERKS3_j($$byval_copy2,$115,1);
   $121 = HEAP32[$116>>2]|0;
   $122 = $8;
   $123 = $122;
   $124 = HEAP32[$123>>2]|0;
   $125 = (($122) + 4)|0;
   $126 = $125;
   $127 = HEAP32[$126>>2]|0;
   $128 = $121;
   $129 = $128;
   HEAP32[$129>>2] = $124;
   $130 = (($128) + 4)|0;
   $131 = $130;
   HEAP32[$131>>2] = $127;
   __ZNSt3__26vectorIxNS_9allocatorIxEEE24__RAII_IncreaseAnnotator6__doneEv($$byval_copy2);
   $132 = HEAP32[$116>>2]|0;
   $133 = ((($132)) + 8|0);
   HEAP32[$116>>2] = $133;
   STACKTOP = sp;return;
  }
 }
 $134 = ((($0)) + 40|0);
 $135 = ((($0)) + 44|0);
 $136 = HEAP32[$135>>2]|0;
 $137 = ((($0)) + 48|0);
 $138 = HEAP32[$137>>2]|0;
 $139 = ($136|0)==($138|0);
 if ($139) {
  __ZNSt3__26vectorIxNS_9allocatorIxEEE21__push_back_slow_pathIRKxEEvOT_($134,$8);
 } else {
  __ZNSt3__26vectorIxNS_9allocatorIxEEE24__RAII_IncreaseAnnotatorC2ERKS3_j($$byval_copy2,$134,1);
  $140 = HEAP32[$135>>2]|0;
  $141 = $8;
  $142 = $141;
  $143 = HEAP32[$142>>2]|0;
  $144 = (($141) + 4)|0;
  $145 = $144;
  $146 = HEAP32[$145>>2]|0;
  $147 = $140;
  $148 = $147;
  HEAP32[$148>>2] = $143;
  $149 = (($147) + 4)|0;
  $150 = $149;
  HEAP32[$150>>2] = $146;
  __ZNSt3__26vectorIxNS_9allocatorIxEEE24__RAII_IncreaseAnnotator6__doneEv($$byval_copy2);
  $151 = HEAP32[$135>>2]|0;
  $152 = ((($151)) + 8|0);
  HEAP32[$135>>2] = $152;
 }
 $153 = ((($0)) + 12|0);
 $154 = HEAP8[$153>>0]|0;
 $155 = ($154<<24>>24)==(0);
 if ($155) {
  STACKTOP = sp;return;
 }
 ;HEAP32[$9>>2]=HEAP32[$1>>2]|0;HEAP32[$9+4>>2]=HEAP32[$1+4>>2]|0;HEAP32[$9+8>>2]=HEAP32[$1+8>>2]|0;
 ;HEAP32[$11>>2]=HEAP32[$2>>2]|0;HEAP32[$11+4>>2]=HEAP32[$2+4>>2]|0;HEAP32[$11+8>>2]=HEAP32[$2+8>>2]|0;
 ;HEAP32[$13>>2]=HEAP32[$3>>2]|0;HEAP32[$13+4>>2]=HEAP32[$3+4>>2]|0;HEAP32[$13+8>>2]=HEAP32[$3+8>>2]|0;
 $156 = $8;
 $157 = $156;
 $158 = HEAP32[$157>>2]|0;
 $159 = (($156) + 4)|0;
 $160 = $159;
 $161 = HEAP32[$160>>2]|0;
 $162 = (__ZN11OctaTerrain9getIdSideEx($0,$158,$161)|0);
 $163 = ($162|0)>(3);
 if ($163) {
  ;HEAP32[$$byval_copy2>>2]=HEAP32[$11>>2]|0;HEAP32[$$byval_copy2+4>>2]=HEAP32[$11+4>>2]|0;HEAP32[$$byval_copy2+8>>2]=HEAP32[$11+8>>2]|0;
  ;HEAP32[$11>>2]=HEAP32[$13>>2]|0;HEAP32[$11+4>>2]=HEAP32[$13+4>>2]|0;HEAP32[$11+8>>2]=HEAP32[$13+8>>2]|0;
  ;HEAP32[$13>>2]=HEAP32[$$byval_copy2>>2]|0;HEAP32[$13+4>>2]=HEAP32[$$byval_copy2+4>>2]|0;HEAP32[$13+8>>2]=HEAP32[$$byval_copy2+8>>2]|0;
 }
 $164 = ((($0)) + 64|0);
 $165 = (__ZN4vec3ixEj($9,0)|0);
 $166 = HEAP32[$165>>2]|0;
 HEAP32[$15>>2] = $166;
 $167 = ((($15)) + 4|0);
 $168 = (__ZN4vec3ixEj($9,1)|0);
 $169 = HEAP32[$168>>2]|0;
 HEAP32[$167>>2] = $169;
 $170 = ((($15)) + 8|0);
 $171 = (__ZN4vec3ixEj($9,2)|0);
 $172 = HEAP32[$171>>2]|0;
 HEAP32[$170>>2] = $172;
 $173 = ((($15)) + 12|0);
 $174 = (__ZN4vec3ixEj($11,0)|0);
 $175 = HEAP32[$174>>2]|0;
 HEAP32[$173>>2] = $175;
 $176 = ((($15)) + 16|0);
 $177 = (__ZN4vec3ixEj($11,1)|0);
 $178 = HEAP32[$177>>2]|0;
 HEAP32[$176>>2] = $178;
 $179 = ((($15)) + 20|0);
 $180 = (__ZN4vec3ixEj($11,2)|0);
 $181 = HEAP32[$180>>2]|0;
 HEAP32[$179>>2] = $181;
 $182 = ((($15)) + 24|0);
 $183 = (__ZN4vec3ixEj($13,0)|0);
 $184 = HEAP32[$183>>2]|0;
 HEAP32[$182>>2] = $184;
 $185 = ((($15)) + 28|0);
 $186 = (__ZN4vec3ixEj($13,1)|0);
 $187 = HEAP32[$186>>2]|0;
 HEAP32[$185>>2] = $187;
 $188 = ((($15)) + 32|0);
 $189 = (__ZN4vec3ixEj($13,2)|0);
 $190 = HEAP32[$189>>2]|0;
 HEAP32[$188>>2] = $190;
 $191 = ((($0)) + 68|0);
 $192 = HEAP32[$191>>2]|0;
 $193 = ((($0)) + 72|0);
 $194 = HEAP32[$193>>2]|0;
 $195 = ($192>>>0)<($194>>>0);
 if ($195) {
  __ZNSt3__26vectorI4vec9NS_9allocatorIS1_EEE24__RAII_IncreaseAnnotatorC2ERKS4_j($$byval_copy2,$164,1);
  $196 = HEAP32[$191>>2]|0;
  dest=$196; src=$15; stop=dest+36|0; do { HEAP32[dest>>2]=HEAP32[src>>2]|0; dest=dest+4|0; src=src+4|0; } while ((dest|0) < (stop|0));
  __ZNSt3__26vectorI4vec9NS_9allocatorIS1_EEE24__RAII_IncreaseAnnotator6__doneEv($$byval_copy2);
  $197 = HEAP32[$191>>2]|0;
  $198 = ((($197)) + 36|0);
  HEAP32[$191>>2] = $198;
 } else {
  __ZNSt3__26vectorI4vec9NS_9allocatorIS1_EEE21__push_back_slow_pathIS1_EEvOT_($164,$15);
 }
 STACKTOP = sp;return;
}
function __ZN11OctaTerrain9setIdSideEi($0,$1) {
 $0 = $0|0;
 $1 = $1|0;
 var $2 = 0, $3 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $2 = (_bitshift64Shl(($1|0),0,48)|0);
 $3 = tempRet0;
 tempRet0 = ($3);
 return ($2|0);
}
function __ZN11OctaTerrain7toPointEff($0,$1,$2,$3) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = +$2;
 $3 = +$3;
 var $10 = 0.0, $11 = 0.0, $12 = 0.0, $13 = 0, $14 = 0.0, $15 = 0.0, $16 = 0.0, $4 = 0.0, $5 = 0.0, $6 = 0.0, $7 = 0.0, $8 = 0.0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $4 = +HEAPF32[$1>>2];
 $5 = (+Math_cos((+$2)));
 $6 = $4 * $5;
 $7 = (+Math_sin((+$3)));
 $8 = $6 * $7;
 HEAPF32[$0>>2] = $8;
 $9 = ((($0)) + 4|0);
 $10 = +HEAPF32[$1>>2];
 $11 = (+Math_sin((+$2)));
 $12 = $10 * $11;
 HEAPF32[$9>>2] = $12;
 $13 = ((($0)) + 8|0);
 $14 = $5 * $10;
 $15 = (+Math_cos((+$3)));
 $16 = $14 * $15;
 HEAPF32[$13>>2] = $16;
 return;
}
function __ZN4vec2ixEj($0,$1) {
 $0 = $0|0;
 $1 = $1|0;
 var $2 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $2 = (($0) + ($1<<2)|0);
 return ($2|0);
}
function __ZN4vec39normalizeEf($0,$1,$2) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = +$2;
 var $10 = 0, $11 = 0.0, $12 = 0.0, $13 = 0.0, $14 = 0.0, $15 = 0.0, $16 = 0.0, $3 = 0, $4 = 0.0, $5 = 0.0, $6 = 0, $7 = 0.0, $8 = 0.0, $9 = 0.0, $pow2 = 0.0, $pow24 = 0.0, $pow25 = 0.0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0;
 $3 = sp;
 $4 = +HEAPF32[$1>>2];
 $5 = $4;
 $pow2 = $5 * $5;
 $6 = ((($1)) + 4|0);
 $7 = +HEAPF32[$6>>2];
 $8 = $7;
 $pow24 = $8 * $8;
 $9 = $pow2 + $pow24;
 $10 = ((($1)) + 8|0);
 $11 = +HEAPF32[$10>>2];
 $12 = $11;
 $pow25 = $12 * $12;
 $13 = $9 + $pow25;
 $14 = (+Math_sqrt((+$13)));
 $15 = $14;
 ;HEAP32[$3>>2]=HEAP32[$1>>2]|0;HEAP32[$3+4>>2]=HEAP32[$1+4>>2]|0;HEAP32[$3+8>>2]=HEAP32[$1+8>>2]|0;
 $16 = $15 * $2;
 __ZN4vec3dvEf($0,$3,$16);
 STACKTOP = sp;return;
}
function __ZN11OctaTerrain10getIdLevelEx($0,$1,$2) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 var $3 = 0, $4 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $3 = (_bitshift64Ashr(($1|0),($2|0),56)|0);
 $4 = tempRet0;
 return ($3|0);
}
function __ZN11OctaTerrain10needDivideER4vec3S1_S1_S1_i($0,$1,$2,$3,$4,$5) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 $3 = $3|0;
 $4 = $4|0;
 $5 = $5|0;
 var $$0 = 0, $$byval_copy = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0.0, $14 = 0, $15 = 0.0, $16 = 0.0, $17 = 0, $6 = 0, $7 = 0.0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 32|0;
 $$byval_copy = sp + 12|0;
 $6 = sp;
 __ZN11OctaTerrain14getChunkCenterER4vec3S1_S1_($6,$0,$2,$3,$4);
 $7 = (+__ZN11OctaTerrain14boundingRadiusER4vec3S1_S1_S1_($0,$6,$2,$3,$4));
 $8 = ((($0)) + 14|0);
 $9 = HEAP8[$8>>0]|0;
 $10 = ($9<<24>>24)==(0);
 if (!($10)) {
  $11 = ((($0)) + 88|0);
  ;HEAP32[$$byval_copy>>2]=HEAP32[$6>>2]|0;HEAP32[$$byval_copy+4>>2]=HEAP32[$6+4>>2]|0;HEAP32[$$byval_copy+8>>2]=HEAP32[$6+8>>2]|0;
  $12 = (__ZN7Frustum15intersectSphereE4vec3f($11,$$byval_copy,$7)|0);
  if (!($12)) {
   $$0 = 0;
   STACKTOP = sp;return ($$0|0);
  }
 }
 $13 = (+__ZN11OctaTerrain8distanceER4vec3S1_($0,$1,$6));
 $14 = ((($0)) + 8|0);
 $15 = +HEAPF32[$14>>2];
 $16 = $7 * $15;
 $17 = $13 < $16;
 $$0 = $17;
 STACKTOP = sp;return ($$0|0);
}
function __ZN11OctaTerrain10existChunkEx($0,$1,$2) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 var $$sroa$06$0 = 0, $$sroa$06$1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $20 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0;
 var label = 0, sp = 0;
 sp = STACKTOP;
 $3 = ((($0)) + 16|0);
 $4 = HEAP32[$3>>2]|0;
 $5 = ((($0)) + 20|0);
 $6 = HEAP32[$5>>2]|0;
 $7 = ($4|0)==($6|0);
 L1: do {
  if ($7) {
   $$sroa$06$1 = $4;
  } else {
   $$sroa$06$0 = $4;
   while(1) {
    $8 = $$sroa$06$0;
    $9 = $8;
    $10 = HEAP32[$9>>2]|0;
    $11 = (($8) + 4)|0;
    $12 = $11;
    $13 = HEAP32[$12>>2]|0;
    $14 = ($10|0)==($1|0);
    $15 = ($13|0)==($2|0);
    $16 = $14 & $15;
    if ($16) {
     $$sroa$06$1 = $$sroa$06$0;
     break L1;
    }
    $17 = ((($$sroa$06$0)) + 8|0);
    $18 = ($17|0)==($6|0);
    if ($18) {
     $$sroa$06$1 = $17;
     break;
    } else {
     $$sroa$06$0 = $17;
    }
   }
  }
 } while(0);
 $19 = HEAP32[$5>>2]|0;
 $20 = ($$sroa$06$1|0)!=($19|0);
 return ($20|0);
}
function __ZN4vec3plES_($0,$1,$2) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 var $10 = 0, $11 = 0.0, $12 = 0.0, $13 = 0, $14 = 0, $15 = 0.0, $16 = 0, $17 = 0.0, $18 = 0.0, $3 = 0.0, $4 = 0, $5 = 0.0, $6 = 0.0, $7 = 0, $8 = 0, $9 = 0.0, label = 0, sp = 0;
 sp = STACKTOP;
 $3 = +HEAPF32[$1>>2];
 $4 = (__ZN4vec3ixEj($2,0)|0);
 $5 = +HEAPF32[$4>>2];
 $6 = $3 + $5;
 HEAPF32[$0>>2] = $6;
 $7 = ((($0)) + 4|0);
 $8 = ((($1)) + 4|0);
 $9 = +HEAPF32[$8>>2];
 $10 = (__ZN4vec3ixEj($2,1)|0);
 $11 = +HEAPF32[$10>>2];
 $12 = $9 + $11;
 HEAPF32[$7>>2] = $12;
 $13 = ((($0)) + 8|0);
 $14 = ((($1)) + 8|0);
 $15 = +HEAPF32[$14>>2];
 $16 = (__ZN4vec3ixEj($2,2)|0);
 $17 = +HEAPF32[$16>>2];
 $18 = $15 + $17;
 HEAPF32[$13>>2] = $18;
 return;
}
function __ZN4vec3dvEf($0,$1,$2) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = +$2;
 var $10 = 0, $11 = 0.0, $12 = 0.0, $3 = 0.0, $4 = 0.0, $5 = 0, $6 = 0, $7 = 0.0, $8 = 0.0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $3 = +HEAPF32[$1>>2];
 $4 = $3 / $2;
 HEAPF32[$0>>2] = $4;
 $5 = ((($0)) + 4|0);
 $6 = ((($1)) + 4|0);
 $7 = +HEAPF32[$6>>2];
 $8 = $7 / $2;
 HEAPF32[$5>>2] = $8;
 $9 = ((($0)) + 8|0);
 $10 = ((($1)) + 8|0);
 $11 = +HEAPF32[$10>>2];
 $12 = $11 / $2;
 HEAPF32[$9>>2] = $12;
 return;
}
function __ZN11OctaTerrain15increaseIdLevelEx($0,$1,$2) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 var $3 = 0, $4 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $3 = (_i64Add(($1|0),($2|0),0,16777216)|0);
 $4 = tempRet0;
 tempRet0 = ($4);
 return ($3|0);
}
function __ZN11OctaTerrain10setIdIndexExi($0,$1,$2,$3) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 $3 = $3|0;
 var $10 = 0, $11 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $4 = (__ZN11OctaTerrain10getIdLevelEx($0,$1,$2)|0);
 $5 = ($3|0)<(0);
 $6 = $5 << 31 >> 31;
 $7 = $4 << 1;
 $8 = (_bitshift64Shl(($3|0),($6|0),($7|0))|0);
 $9 = tempRet0;
 $10 = $8 | $1;
 $11 = $9 | $2;
 tempRet0 = ($11);
 return ($10|0);
}
function __ZN11OctaTerrain9getIdSideEx($0,$1,$2) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 var $3 = 0, $4 = 0, $5 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $3 = (_bitshift64Lshr(($1|0),($2|0),48)|0);
 $4 = tempRet0;
 $5 = $3 & 255;
 return ($5|0);
}
function __ZN4vec3ixEj($0,$1) {
 $0 = $0|0;
 $1 = $1|0;
 var $2 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $2 = (($0) + ($1<<2)|0);
 return ($2|0);
}
function __ZN11OctaTerrain14getChunkCenterER4vec3S1_S1_($0,$1,$2,$3,$4) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 $3 = $3|0;
 $4 = $4|0;
 var $$byval_copy1 = 0, $5 = 0, $6 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 48|0;
 $$byval_copy1 = sp + 24|0;
 $5 = sp + 12|0;
 $6 = sp;
 ;HEAP32[$$byval_copy1>>2]=HEAP32[$3>>2]|0;HEAP32[$$byval_copy1+4>>2]=HEAP32[$3+4>>2]|0;HEAP32[$$byval_copy1+8>>2]=HEAP32[$3+8>>2]|0;
 __ZN4vec3plES_($5,$2,$$byval_copy1);
 ;HEAP32[$$byval_copy1>>2]=HEAP32[$4>>2]|0;HEAP32[$$byval_copy1+4>>2]=HEAP32[$4+4>>2]|0;HEAP32[$$byval_copy1+8>>2]=HEAP32[$4+8>>2]|0;
 __ZN4vec3plES_($6,$5,$$byval_copy1);
 __ZN4vec3dvEf($0,$6,3.0);
 STACKTOP = sp;return;
}
function __ZN11OctaTerrain14boundingRadiusER4vec3S1_S1_S1_($0,$1,$2,$3,$4) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 $3 = $3|0;
 $4 = $4|0;
 var $$sroa$speculated = 0.0, $10 = 0, $5 = 0.0, $6 = 0.0, $7 = 0.0, $8 = 0, $9 = 0.0, label = 0, sp = 0;
 sp = STACKTOP;
 $5 = (+__ZN11OctaTerrain8distanceER4vec3S1_($0,$1,$2));
 $6 = (+__ZN11OctaTerrain8distanceER4vec3S1_($0,$1,$3));
 $7 = (+__ZN11OctaTerrain8distanceER4vec3S1_($0,$1,$4));
 $8 = $6 < $7;
 $9 = $8 ? $7 : $6;
 $10 = $5 < $9;
 $$sroa$speculated = $10 ? $9 : $5;
 return (+$$sroa$speculated);
}
function __ZN7Frustum15intersectSphereE4vec3f($0,$1,$2) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = +$2;
 var $$01012 = 0, $10 = 0.0, $11 = 0, $12 = 0.0, $13 = 0, $14 = 0.0, $15 = 0.0, $16 = 0.0, $17 = 0, $18 = 0.0, $19 = 0, $20 = 0.0, $21 = 0.0, $22 = 0.0, $23 = 0, $24 = 0.0, $25 = 0.0, $26 = 0, $27 = 0, $3 = 0.0;
 var $4 = 0, $5 = 0, $6 = 0, $7 = 0.0, $8 = 0, $9 = 0.0, label = 0, sp = 0;
 sp = STACKTOP;
 $3 = -$2;
 $$01012 = 0;
 while(1) {
  $6 = (($0) + ($$01012<<4)|0);
  $7 = +HEAPF32[$6>>2];
  $8 = (__ZN4vec3ixEj($1,0)|0);
  $9 = +HEAPF32[$8>>2];
  $10 = $7 * $9;
  $11 = (((($0) + ($$01012<<4)|0)) + 4|0);
  $12 = +HEAPF32[$11>>2];
  $13 = (__ZN4vec3ixEj($1,1)|0);
  $14 = +HEAPF32[$13>>2];
  $15 = $12 * $14;
  $16 = $10 + $15;
  $17 = (((($0) + ($$01012<<4)|0)) + 8|0);
  $18 = +HEAPF32[$17>>2];
  $19 = (__ZN4vec3ixEj($1,2)|0);
  $20 = +HEAPF32[$19>>2];
  $21 = $18 * $20;
  $22 = $16 + $21;
  $23 = (((($0) + ($$01012<<4)|0)) + 12|0);
  $24 = +HEAPF32[$23>>2];
  $25 = $24 + $22;
  $26 = !($25 <= $3);
  $4 = (($$01012) + 1)|0;
  if (!($26)) {
   $27 = 0;
   label = 4;
   break;
  }
  $5 = ($4|0)<(6);
  if ($5) {
   $$01012 = $4;
  } else {
   $27 = 1;
   label = 4;
   break;
  }
 }
 if ((label|0) == 4) {
  return ($27|0);
 }
 return (0)|0;
}
function __ZN11OctaTerrain8distanceER4vec3S1_($0,$1,$2) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 var $10 = 0.0, $11 = 0, $12 = 0.0, $13 = 0.0, $14 = 0.0, $15 = 0.0, $16 = 0, $17 = 0.0, $18 = 0, $19 = 0.0, $20 = 0.0, $21 = 0.0, $22 = 0.0, $23 = 0.0, $24 = 0.0, $3 = 0, $4 = 0.0, $5 = 0, $6 = 0.0, $7 = 0.0;
 var $8 = 0.0, $9 = 0, $pow2 = 0.0, $pow27 = 0.0, $pow28 = 0.0, label = 0, sp = 0;
 sp = STACKTOP;
 $3 = (__ZN4vec3ixEj($1,0)|0);
 $4 = +HEAPF32[$3>>2];
 $5 = (__ZN4vec3ixEj($2,0)|0);
 $6 = +HEAPF32[$5>>2];
 $7 = $4 - $6;
 $8 = $7;
 $pow2 = $8 * $8;
 $9 = (__ZN4vec3ixEj($1,1)|0);
 $10 = +HEAPF32[$9>>2];
 $11 = (__ZN4vec3ixEj($2,1)|0);
 $12 = +HEAPF32[$11>>2];
 $13 = $10 - $12;
 $14 = $13;
 $pow27 = $14 * $14;
 $15 = $pow2 + $pow27;
 $16 = (__ZN4vec3ixEj($1,2)|0);
 $17 = +HEAPF32[$16>>2];
 $18 = (__ZN4vec3ixEj($2,2)|0);
 $19 = +HEAPF32[$18>>2];
 $20 = $17 - $19;
 $21 = $20;
 $pow28 = $21 * $21;
 $22 = $15 + $pow28;
 $23 = (+Math_sqrt((+$22)));
 $24 = $23;
 return (+$24);
}
function __ZNSt3__26vectorIxNS_9allocatorIxEEE21__push_back_slow_pathIRKxEEvOT_($0,$1) {
 $0 = $0|0;
 $1 = $1|0;
 var $$0$i = 0, $$sroa$speculated$i = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0;
 var $27 = 0, $28 = 0, $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 32|0;
 $2 = sp;
 $3 = ((($0)) + 8|0);
 $4 = ((($0)) + 4|0);
 $5 = HEAP32[$4>>2]|0;
 $6 = HEAP32[$0>>2]|0;
 $7 = (($5) - ($6))|0;
 $8 = $7 >> 3;
 $9 = (($8) + 1)|0;
 $10 = (__ZNKSt3__26vectorIxNS_9allocatorIxEEE8max_sizeEv($0)|0);
 $11 = ($10>>>0)<($9>>>0);
 if ($11) {
  __ZNKSt3__220__vector_base_commonILb1EE20__throw_length_errorEv($0);
  // unreachable;
 } else {
  $12 = ((($0)) + 8|0);
  $13 = HEAP32[$12>>2]|0;
  $14 = HEAP32[$0>>2]|0;
  $15 = (($13) - ($14))|0;
  $16 = $15 >> 3;
  $17 = $10 >>> 1;
  $18 = ($16>>>0)<($17>>>0);
  $19 = $15 >> 2;
  $20 = ($19>>>0)<($9>>>0);
  $$sroa$speculated$i = $20 ? $9 : $19;
  $$0$i = $18 ? $$sroa$speculated$i : $10;
  $21 = HEAP32[$4>>2]|0;
  $22 = (($21) - ($14))|0;
  $23 = $22 >> 3;
  __ZNSt3__214__split_bufferIxRNS_9allocatorIxEEEC2EjjS3_($2,$$0$i,$23,$3);
  $24 = ((($2)) + 8|0);
  $25 = HEAP32[$24>>2]|0;
  $26 = $1;
  $27 = $26;
  $28 = HEAP32[$27>>2]|0;
  $29 = (($26) + 4)|0;
  $30 = $29;
  $31 = HEAP32[$30>>2]|0;
  $32 = $25;
  $33 = $32;
  HEAP32[$33>>2] = $28;
  $34 = (($32) + 4)|0;
  $35 = $34;
  HEAP32[$35>>2] = $31;
  $36 = HEAP32[$24>>2]|0;
  $37 = ((($36)) + 8|0);
  HEAP32[$24>>2] = $37;
  __ZNSt3__26vectorIxNS_9allocatorIxEEE26__swap_out_circular_bufferERNS_14__split_bufferIxRS2_EE($0,$2);
  __ZNSt3__214__split_bufferIxRNS_9allocatorIxEEED2Ev($2);
  STACKTOP = sp;return;
 }
}
function __ZNSt3__214__split_bufferIxRNS_9allocatorIxEEEC2EjjS3_($0,$1,$2,$3) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 $3 = $3|0;
 var $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $4 = ((($0)) + 12|0);
 HEAP32[$4>>2] = 0;
 $5 = ((($0)) + 16|0);
 HEAP32[$5>>2] = $3;
 $6 = ($1|0)==(0);
 do {
  if ($6) {
   $11 = 0;
  } else {
   $7 = ($1>>>0)>(536870911);
   if ($7) {
    $8 = (___cxa_allocate_exception(4)|0);
    __ZNSt9bad_allocC2Ev($8);
    ___cxa_throw(($8|0),(512|0),(6|0));
    // unreachable;
   } else {
    $9 = $1 << 3;
    $10 = (__Znwj($9)|0);
    $11 = $10;
    break;
   }
  }
 } while(0);
 HEAP32[$0>>2] = $11;
 $12 = (($11) + ($2<<3)|0);
 $13 = ((($0)) + 8|0);
 HEAP32[$13>>2] = $12;
 $14 = ((($0)) + 4|0);
 HEAP32[$14>>2] = $12;
 $15 = (($11) + ($1<<3)|0);
 $16 = ((($0)) + 12|0);
 HEAP32[$16>>2] = $15;
 return;
}
function __ZNSt3__26vectorIxNS_9allocatorIxEEE26__swap_out_circular_bufferERNS_14__split_bufferIxRS2_EE($0,$1) {
 $0 = $0|0;
 $1 = $1|0;
 var $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0, $3 = 0, $4 = 0;
 var $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 __ZNKSt3__26vectorIxNS_9allocatorIxEEE17__annotate_deleteEv($0);
 $2 = HEAP32[$0>>2]|0;
 $3 = ((($0)) + 4|0);
 $4 = HEAP32[$3>>2]|0;
 $5 = ((($1)) + 4|0);
 $6 = $2;
 $7 = (($4) - ($6))|0;
 $8 = $7 >> 3;
 $9 = HEAP32[$5>>2]|0;
 $10 = (0 - ($8))|0;
 $11 = (($9) + ($10<<3)|0);
 HEAP32[$5>>2] = $11;
 $12 = ($7|0)>(0);
 if ($12) {
  _memcpy(($11|0),($2|0),($7|0))|0;
 }
 $13 = HEAP32[$0>>2]|0;
 $14 = HEAP32[$5>>2]|0;
 HEAP32[$0>>2] = $14;
 HEAP32[$5>>2] = $13;
 $15 = ((($1)) + 8|0);
 $16 = HEAP32[$3>>2]|0;
 $17 = HEAP32[$15>>2]|0;
 HEAP32[$3>>2] = $17;
 HEAP32[$15>>2] = $16;
 $18 = ((($0)) + 8|0);
 $19 = ((($1)) + 12|0);
 $20 = HEAP32[$18>>2]|0;
 $21 = HEAP32[$19>>2]|0;
 HEAP32[$18>>2] = $21;
 HEAP32[$19>>2] = $20;
 $22 = HEAP32[$5>>2]|0;
 HEAP32[$1>>2] = $22;
 $23 = HEAP32[$3>>2]|0;
 $24 = HEAP32[$0>>2]|0;
 $25 = (($23) - ($24))|0;
 $26 = $25 >> 3;
 __ZNKSt3__26vectorIxNS_9allocatorIxEEE14__annotate_newEj($0,$26);
 return;
}
function __ZNSt3__214__split_bufferIxRNS_9allocatorIxEEED2Ev($0) {
 $0 = $0|0;
 var $1 = 0, $10 = 0, $11 = 0, $12 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, $scevgep$i$i$i = 0, $scevgep4$i$i$i = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $1 = ((($0)) + 4|0);
 $2 = HEAP32[$1>>2]|0;
 $3 = ((($0)) + 8|0);
 $4 = HEAP32[$3>>2]|0;
 $5 = ($4|0)==($2|0);
 if (!($5)) {
  $scevgep$i$i$i = ((($4)) + -8|0);
  $6 = $scevgep$i$i$i;
  $7 = $2;
  $8 = (($6) - ($7))|0;
  $9 = $8 >>> 3;
  $10 = $9 ^ -1;
  $scevgep4$i$i$i = (($4) + ($10<<3)|0);
  HEAP32[$3>>2] = $scevgep4$i$i$i;
 }
 $11 = HEAP32[$0>>2]|0;
 $12 = ($11|0)==(0|0);
 if ($12) {
  return;
 }
 __ZdlPv($11);
 return;
}
function __ZNKSt3__26vectorIxNS_9allocatorIxEEE17__annotate_deleteEv($0) {
 $0 = $0|0;
 var $$cast = 0, $1 = 0, $10 = 0, $11 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $1 = HEAP32[$0>>2]|0;
 $2 = ((($0)) + 8|0);
 $3 = HEAP32[$2>>2]|0;
 $$cast = $1;
 $4 = (($3) - ($$cast))|0;
 $5 = $4 >> 3;
 $6 = (($1) + ($5<<3)|0);
 $7 = ((($0)) + 4|0);
 $8 = HEAP32[$7>>2]|0;
 $9 = (($8) - ($$cast))|0;
 $10 = $9 >> 3;
 $11 = (($1) + ($10<<3)|0);
 __ZNKSt3__26vectorIxNS_9allocatorIxEEE31__annotate_contiguous_containerEPKvS5_S5_S5_($0,$1,$6,$11,$6);
 return;
}
function __ZNSt3__26vectorI4vec9NS_9allocatorIS1_EEE24__RAII_IncreaseAnnotatorC2ERKS4_j($0,$1,$2) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 var label = 0, sp = 0;
 sp = STACKTOP;
 return;
}
function __ZNSt3__26vectorI4vec9NS_9allocatorIS1_EEE24__RAII_IncreaseAnnotator6__doneEv($0) {
 $0 = $0|0;
 var label = 0, sp = 0;
 sp = STACKTOP;
 return;
}
function __ZNSt3__26vectorI4vec9NS_9allocatorIS1_EEE21__push_back_slow_pathIS1_EEvOT_($0,$1) {
 $0 = $0|0;
 $1 = $1|0;
 var $$0$i = 0, $$sroa$speculated$i = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0;
 var $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, dest = 0, label = 0, sp = 0, src = 0, stop = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 32|0;
 $2 = sp;
 $3 = ((($0)) + 8|0);
 $4 = ((($0)) + 4|0);
 $5 = HEAP32[$4>>2]|0;
 $6 = HEAP32[$0>>2]|0;
 $7 = (($5) - ($6))|0;
 $8 = (($7|0) / 36)&-1;
 $9 = (($8) + 1)|0;
 $10 = (__ZNKSt3__26vectorI4vec9NS_9allocatorIS1_EEE8max_sizeEv($0)|0);
 $11 = ($10>>>0)<($9>>>0);
 if ($11) {
  __ZNKSt3__220__vector_base_commonILb1EE20__throw_length_errorEv($0);
  // unreachable;
 } else {
  $12 = ((($0)) + 8|0);
  $13 = HEAP32[$12>>2]|0;
  $14 = HEAP32[$0>>2]|0;
  $15 = (($13) - ($14))|0;
  $16 = (($15|0) / 36)&-1;
  $17 = $10 >>> 1;
  $18 = ($16>>>0)<($17>>>0);
  $19 = $16 << 1;
  $20 = ($19>>>0)<($9>>>0);
  $$sroa$speculated$i = $20 ? $9 : $19;
  $$0$i = $18 ? $$sroa$speculated$i : $10;
  $21 = HEAP32[$4>>2]|0;
  $22 = (($21) - ($14))|0;
  $23 = (($22|0) / 36)&-1;
  __ZNSt3__214__split_bufferI4vec9RNS_9allocatorIS1_EEEC2EjjS4_($2,$$0$i,$23,$3);
  $24 = ((($2)) + 8|0);
  $25 = HEAP32[$24>>2]|0;
  dest=$25; src=$1; stop=dest+36|0; do { HEAP32[dest>>2]=HEAP32[src>>2]|0; dest=dest+4|0; src=src+4|0; } while ((dest|0) < (stop|0));
  $26 = ((($25)) + 36|0);
  HEAP32[$24>>2] = $26;
  __ZNSt3__26vectorI4vec9NS_9allocatorIS1_EEE26__swap_out_circular_bufferERNS_14__split_bufferIS1_RS3_EE($0,$2);
  __ZNSt3__214__split_bufferI4vec9RNS_9allocatorIS1_EEED2Ev($2);
  STACKTOP = sp;return;
 }
}
function __ZNSt3__214__split_bufferI4vec9RNS_9allocatorIS1_EEEC2EjjS4_($0,$1,$2,$3) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 $3 = $3|0;
 var $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $4 = ((($0)) + 12|0);
 HEAP32[$4>>2] = 0;
 $5 = ((($0)) + 16|0);
 HEAP32[$5>>2] = $3;
 $6 = ($1|0)==(0);
 do {
  if ($6) {
   $11 = 0;
  } else {
   $7 = ($1>>>0)>(119304647);
   if ($7) {
    $8 = (___cxa_allocate_exception(4)|0);
    __ZNSt9bad_allocC2Ev($8);
    ___cxa_throw(($8|0),(512|0),(6|0));
    // unreachable;
   } else {
    $9 = ($1*36)|0;
    $10 = (__Znwj($9)|0);
    $11 = $10;
    break;
   }
  }
 } while(0);
 HEAP32[$0>>2] = $11;
 $12 = (($11) + (($2*36)|0)|0);
 $13 = ((($0)) + 8|0);
 HEAP32[$13>>2] = $12;
 $14 = ((($0)) + 4|0);
 HEAP32[$14>>2] = $12;
 $15 = (($11) + (($1*36)|0)|0);
 $16 = ((($0)) + 12|0);
 HEAP32[$16>>2] = $15;
 return;
}
function __ZNSt3__26vectorI4vec9NS_9allocatorIS1_EEE26__swap_out_circular_bufferERNS_14__split_bufferIS1_RS3_EE($0,$1) {
 $0 = $0|0;
 $1 = $1|0;
 var $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $3 = 0, $4 = 0, $5 = 0;
 var $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 __ZNKSt3__26vectorI4vec9NS_9allocatorIS1_EEE17__annotate_deleteEv($0);
 $2 = HEAP32[$0>>2]|0;
 $3 = ((($0)) + 4|0);
 $4 = HEAP32[$3>>2]|0;
 $5 = ((($1)) + 4|0);
 $6 = $2;
 $7 = (($4) - ($6))|0;
 $8 = HEAP32[$5>>2]|0;
 $9 = (($7|0) / -36)&-1;
 $10 = (($8) + (($9*36)|0)|0);
 HEAP32[$5>>2] = $10;
 $11 = ($7|0)>(0);
 if ($11) {
  _memcpy(($10|0),($2|0),($7|0))|0;
 }
 $12 = HEAP32[$0>>2]|0;
 $13 = HEAP32[$5>>2]|0;
 HEAP32[$0>>2] = $13;
 HEAP32[$5>>2] = $12;
 $14 = ((($1)) + 8|0);
 $15 = HEAP32[$3>>2]|0;
 $16 = HEAP32[$14>>2]|0;
 HEAP32[$3>>2] = $16;
 HEAP32[$14>>2] = $15;
 $17 = ((($0)) + 8|0);
 $18 = ((($1)) + 12|0);
 $19 = HEAP32[$17>>2]|0;
 $20 = HEAP32[$18>>2]|0;
 HEAP32[$17>>2] = $20;
 HEAP32[$18>>2] = $19;
 $21 = HEAP32[$5>>2]|0;
 HEAP32[$1>>2] = $21;
 $22 = HEAP32[$3>>2]|0;
 $23 = HEAP32[$0>>2]|0;
 $24 = (($22) - ($23))|0;
 $25 = (($24|0) / 36)&-1;
 __ZNKSt3__26vectorI4vec9NS_9allocatorIS1_EEE14__annotate_newEj($0,$25);
 return;
}
function __ZNSt3__214__split_bufferI4vec9RNS_9allocatorIS1_EEED2Ev($0) {
 $0 = $0|0;
 var $1 = 0, $10 = 0, $11 = 0, $12 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, $scevgep$i$i$i = 0, $scevgep4$i$i$i = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $1 = ((($0)) + 4|0);
 $2 = HEAP32[$1>>2]|0;
 $3 = ((($0)) + 8|0);
 $4 = HEAP32[$3>>2]|0;
 $5 = ($4|0)==($2|0);
 if (!($5)) {
  $scevgep$i$i$i = ((($4)) + -36|0);
  $6 = $scevgep$i$i$i;
  $7 = $2;
  $8 = (($6) - ($7))|0;
  $9 = (($8>>>0) / 36)&-1;
  $10 = $9 ^ -1;
  $scevgep4$i$i$i = (($4) + (($10*36)|0)|0);
  HEAP32[$3>>2] = $scevgep4$i$i$i;
 }
 $11 = HEAP32[$0>>2]|0;
 $12 = ($11|0)==(0|0);
 if ($12) {
  return;
 }
 __ZdlPv($11);
 return;
}
function __ZNKSt3__26vectorI4vec9NS_9allocatorIS1_EEE8max_sizeEv($0) {
 $0 = $0|0;
 var label = 0, sp = 0;
 sp = STACKTOP;
 return 119304647;
}
function __ZNKSt3__26vectorI4vec9NS_9allocatorIS1_EEE17__annotate_deleteEv($0) {
 $0 = $0|0;
 var $$cast = 0, $1 = 0, $10 = 0, $11 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $1 = HEAP32[$0>>2]|0;
 $2 = ((($0)) + 8|0);
 $3 = HEAP32[$2>>2]|0;
 $$cast = $1;
 $4 = (($3) - ($$cast))|0;
 $5 = (($4|0) / 36)&-1;
 $6 = (($1) + (($5*36)|0)|0);
 $7 = ((($0)) + 4|0);
 $8 = HEAP32[$7>>2]|0;
 $9 = (($8) - ($$cast))|0;
 $10 = (($9|0) / 36)&-1;
 $11 = (($1) + (($10*36)|0)|0);
 __ZNKSt3__26vectorI4vec9NS_9allocatorIS1_EEE31__annotate_contiguous_containerEPKvS6_S6_S6_($0,$1,$6,$11,$6);
 return;
}
function __ZNKSt3__26vectorI4vec9NS_9allocatorIS1_EEE14__annotate_newEj($0,$1) {
 $0 = $0|0;
 $1 = $1|0;
 var $$cast = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $2 = HEAP32[$0>>2]|0;
 $3 = ((($0)) + 8|0);
 $4 = HEAP32[$3>>2]|0;
 $$cast = $2;
 $5 = (($4) - ($$cast))|0;
 $6 = (($5|0) / 36)&-1;
 $7 = (($2) + (($6*36)|0)|0);
 $8 = (($2) + (($1*36)|0)|0);
 __ZNKSt3__26vectorI4vec9NS_9allocatorIS1_EEE31__annotate_contiguous_containerEPKvS6_S6_S6_($0,$2,$7,$7,$8);
 return;
}
function __ZNSt3__216__set_differenceIRNS_6__lessIxxEENS_11__wrap_iterIPxEES6_NS_15insert_iteratorINS_6vectorIxNS_9allocatorIxEEEEEEEET2_T0_SE_T1_SF_SD_T_($0,$1,$2,$3,$4,$5,$6) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 $3 = $3|0;
 $4 = $4|0;
 $5 = $5|0;
 $6 = $6|0;
 var $$04$i$i = 0, $$byval_copy1 = 0, $$sroa$0$0$$sroa_idx$i = 0, $$sroa$5$0$i = 0, $$sroa$5$1$i = 0, $$sroa_idx8$i = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0;
 var $24 = 0, $25 = 0, $26 = 0, $27 = 0, $28 = 0, $29 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $40 = 0, $41 = 0, $42 = 0, $43 = 0;
 var $44 = 0, $45 = 0, $46 = 0, $47 = 0, $48 = 0, $49 = 0, $50 = 0, $51 = 0, $52 = 0, $53 = 0, $54 = 0, $55 = 0, $56 = 0, $57 = 0, $58 = 0, $59 = 0, $60 = 0, $61 = 0, $62 = 0, $63 = 0;
 var $64 = 0, $65 = 0, $66 = 0, $67 = 0, $68 = 0, $69 = 0, $7 = 0, $70 = 0, $71 = 0, $72 = 0, $73 = 0, $74 = 0, $75 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0;
 $$byval_copy1 = sp + 4|0;
 $7 = sp;
 $8 = HEAP32[$1>>2]|0;
 $9 = HEAP32[$2>>2]|0;
 $10 = ($8|0)==($9|0);
 L1: do {
  if (!($10)) {
   $11 = HEAP32[$4>>2]|0;
   $12 = HEAP32[$5>>2]|0;
   $13 = ((($5)) + 4|0);
   $$sroa$0$0$$sroa_idx$i = ((($5)) + 4|0);
   $14 = HEAP32[$2>>2]|0;
   $32 = $8;
   while(1) {
    $15 = HEAP32[$3>>2]|0;
    $16 = ($15|0)==($11|0);
    if ($16) {
     break;
    }
    $33 = $32;
    $34 = $33;
    $35 = HEAP32[$34>>2]|0;
    $36 = (($33) + 4)|0;
    $37 = $36;
    $38 = HEAP32[$37>>2]|0;
    $39 = $15;
    $40 = $39;
    $41 = HEAP32[$40>>2]|0;
    $42 = (($39) + 4)|0;
    $43 = $42;
    $44 = HEAP32[$43>>2]|0;
    $45 = ($38|0)<($44|0);
    $46 = ($35>>>0)<($41>>>0);
    $47 = ($38|0)==($44|0);
    $48 = $47 & $46;
    $49 = $45 | $48;
    if ($49) {
     $50 = HEAP32[$13>>2]|0;
     HEAP32[$7>>2] = $50;
     ;HEAP32[$$byval_copy1>>2]=HEAP32[$7>>2]|0;
     $51 = (__ZNSt3__26vectorIxNS_9allocatorIxEEE6insertENS_11__wrap_iterIPKxEERS5_($12,$$byval_copy1,$32)|0);
     HEAP32[$$sroa$0$0$$sroa_idx$i>>2] = $51;
     $52 = HEAP32[$13>>2]|0;
     $53 = ((($52)) + 8|0);
     HEAP32[$13>>2] = $53;
     $54 = HEAP32[$1>>2]|0;
     $55 = ((($54)) + 8|0);
     HEAP32[$1>>2] = $55;
    } else {
     $56 = ($44|0)<($38|0);
     $57 = ($41>>>0)<($35>>>0);
     $58 = ($44|0)==($38|0);
     $59 = $58 & $57;
     $60 = $56 | $59;
     if (!($60)) {
      $61 = ((($32)) + 8|0);
      HEAP32[$1>>2] = $61;
     }
     $62 = HEAP32[$3>>2]|0;
     $63 = ((($62)) + 8|0);
     HEAP32[$3>>2] = $63;
    }
    $64 = HEAP32[$1>>2]|0;
    $65 = ($64|0)==($14|0);
    if ($65) {
     break L1;
    } else {
     $32 = $64;
    }
   }
   $17 = HEAP32[$1>>2]|0;
   $18 = HEAP32[$2>>2]|0;
   $19 = $5;
   $20 = $19;
   $21 = HEAP32[$20>>2]|0;
   $22 = (($19) + 4)|0;
   $23 = $22;
   $24 = HEAP32[$23>>2]|0;
   $25 = ($17|0)==($18|0);
   if ($25) {
    $$sroa$5$1$i = $24;
   } else {
    $26 = $21;
    $$04$i$i = $17;$$sroa$5$0$i = $24;
    while(1) {
     HEAP32[$7>>2] = $$sroa$5$0$i;
     ;HEAP32[$$byval_copy1>>2]=HEAP32[$7>>2]|0;
     $27 = (__ZNSt3__26vectorIxNS_9allocatorIxEEE6insertENS_11__wrap_iterIPKxEERS5_($26,$$byval_copy1,$$04$i$i)|0);
     $28 = ((($27)) + 8|0);
     $29 = $28;
     $30 = ((($$04$i$i)) + 8|0);
     $31 = ($30|0)==($18|0);
     if ($31) {
      $$sroa$5$1$i = $29;
      break;
     } else {
      $$04$i$i = $30;$$sroa$5$0$i = $29;
     }
    }
   }
   HEAP32[$0>>2] = $21;
   $$sroa_idx8$i = ((($0)) + 4|0);
   HEAP32[$$sroa_idx8$i>>2] = $$sroa$5$1$i;
   STACKTOP = sp;return;
  }
 } while(0);
 $66 = $5;
 $67 = $66;
 $68 = HEAP32[$67>>2]|0;
 $69 = (($66) + 4)|0;
 $70 = $69;
 $71 = HEAP32[$70>>2]|0;
 $72 = $0;
 $73 = $72;
 HEAP32[$73>>2] = $68;
 $74 = (($72) + 4)|0;
 $75 = $74;
 HEAP32[$75>>2] = $71;
 STACKTOP = sp;return;
}
function __ZNSt3__26vectorIxNS_9allocatorIxEEE6insertENS_11__wrap_iterIPKxEERS5_($0,$1,$2) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 var $$ = 0, $$0 = 0, $$0$i = 0, $$025 = 0, $$byval_copy = 0, $$byval_copy1 = 0, $$sroa$speculated$i = 0, $$sroa$speculated$i26 = 0, $10 = 0, $100 = 0, $101 = 0, $102 = 0, $103 = 0, $104 = 0, $105 = 0, $106 = 0, $107 = 0, $108 = 0, $109 = 0, $11 = 0;
 var $110 = 0, $111 = 0, $112 = 0, $113 = 0, $114 = 0, $115 = 0, $116 = 0, $117 = 0, $118 = 0, $119 = 0, $12 = 0, $120 = 0, $121 = 0, $122 = 0, $123 = 0, $124 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0;
 var $17 = 0, $18 = 0, $19 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0, $27 = 0, $28 = 0, $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0;
 var $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0, $41 = 0, $42 = 0, $43 = 0, $44 = 0, $45 = 0, $46 = 0, $47 = 0, $48 = 0, $49 = 0, $5 = 0, $50 = 0, $51 = 0, $52 = 0, $53 = 0;
 var $54 = 0, $55 = 0, $56 = 0, $57 = 0, $58 = 0, $59 = 0, $6 = 0, $60 = 0, $61 = 0, $62 = 0, $63 = 0, $64 = 0, $65 = 0, $66 = 0, $67 = 0, $68 = 0, $69 = 0, $7 = 0, $70 = 0, $71 = 0;
 var $72 = 0, $73 = 0, $74 = 0, $75 = 0, $76 = 0, $77 = 0, $78 = 0, $79 = 0, $8 = 0, $80 = 0, $81 = 0, $82 = 0, $83 = 0, $84 = 0, $85 = 0, $86 = 0, $87 = 0, $88 = 0, $89 = 0, $9 = 0;
 var $90 = 0, $91 = 0, $92 = 0, $93 = 0, $94 = 0, $95 = 0, $96 = 0, $97 = 0, $98 = 0, $99 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 64|0;
 $$byval_copy1 = sp + 52|0;
 $$byval_copy = sp + 48|0;
 $3 = sp + 28|0;
 $4 = sp + 24|0;
 $5 = sp + 20|0;
 $6 = sp;
 $7 = HEAP32[$0>>2]|0;
 $8 = $7;
 $9 = HEAP32[$1>>2]|0;
 $10 = (($9) - ($8))|0;
 $11 = $10 >> 3;
 $12 = (($7) + ($11<<3)|0);
 $13 = ((($0)) + 4|0);
 $14 = HEAP32[$13>>2]|0;
 $15 = ((($0)) + 8|0);
 $16 = HEAP32[$15>>2]|0;
 $17 = ($14>>>0)<($16>>>0);
 if ($17) {
  __ZNSt3__26vectorIxNS_9allocatorIxEEE24__RAII_IncreaseAnnotatorC2ERKS3_j($$byval_copy1,$0,1);
  $18 = HEAP32[$13>>2]|0;
  $19 = ($12|0)==($18|0);
  if ($19) {
   $20 = $2;
   $21 = $20;
   $22 = HEAP32[$21>>2]|0;
   $23 = (($20) + 4)|0;
   $24 = $23;
   $25 = HEAP32[$24>>2]|0;
   $26 = $18;
   $27 = $26;
   HEAP32[$27>>2] = $22;
   $28 = (($26) + 4)|0;
   $29 = $28;
   HEAP32[$29>>2] = $25;
   $30 = HEAP32[$13>>2]|0;
   $31 = ((($30)) + 8|0);
   HEAP32[$13>>2] = $31;
  } else {
   $32 = ((($12)) + 8|0);
   __ZNSt3__26vectorIxNS_9allocatorIxEEE12__move_rangeEPxS4_S4_($0,$12,$18,$32);
   $33 = ($12>>>0)>($2>>>0);
   if ($33) {
    $$025 = $2;
   } else {
    $34 = HEAP32[$13>>2]|0;
    $35 = ($34>>>0)>($2>>>0);
    $36 = ((($2)) + 8|0);
    $$ = $35 ? $36 : $2;
    $$025 = $$;
   }
   $37 = $$025;
   $38 = $37;
   $39 = HEAP32[$38>>2]|0;
   $40 = (($37) + 4)|0;
   $41 = $40;
   $42 = HEAP32[$41>>2]|0;
   $43 = $12;
   $44 = $43;
   HEAP32[$44>>2] = $39;
   $45 = (($43) + 4)|0;
   $46 = $45;
   HEAP32[$46>>2] = $42;
  }
  __ZNSt3__26vectorIxNS_9allocatorIxEEE24__RAII_IncreaseAnnotator6__doneEv($$byval_copy1);
  $$0 = $12;
  STACKTOP = sp;return ($$0|0);
 }
 $47 = ((($0)) + 8|0);
 $48 = HEAP32[$13>>2]|0;
 $49 = HEAP32[$0>>2]|0;
 $50 = (($48) - ($49))|0;
 $51 = $50 >> 3;
 $52 = (($51) + 1)|0;
 $53 = (__ZNKSt3__26vectorIxNS_9allocatorIxEEE8max_sizeEv($0)|0);
 $54 = ($53>>>0)<($52>>>0);
 if ($54) {
  __ZNKSt3__220__vector_base_commonILb1EE20__throw_length_errorEv($0);
  // unreachable;
 }
 $55 = ((($0)) + 8|0);
 $56 = HEAP32[$55>>2]|0;
 $57 = HEAP32[$0>>2]|0;
 $58 = (($56) - ($57))|0;
 $59 = $58 >> 3;
 $60 = $53 >>> 1;
 $61 = ($59>>>0)<($60>>>0);
 $62 = $58 >> 2;
 $63 = ($62>>>0)<($52>>>0);
 $$sroa$speculated$i26 = $63 ? $52 : $62;
 $$0$i = $61 ? $$sroa$speculated$i26 : $53;
 $64 = $12;
 $65 = (($64) - ($57))|0;
 $66 = $65 >> 3;
 __ZNSt3__214__split_bufferIxRNS_9allocatorIxEEEC2EjjS3_($6,$$0$i,$66,$47);
 $67 = ((($6)) + 8|0);
 $68 = HEAP32[$67>>2]|0;
 $69 = ((($6)) + 12|0);
 $70 = HEAP32[$69>>2]|0;
 $71 = ($68|0)==($70|0);
 do {
  if ($71) {
   $72 = ((($6)) + 4|0);
   $73 = HEAP32[$72>>2]|0;
   $74 = HEAP32[$6>>2]|0;
   $75 = ($73>>>0)>($74>>>0);
   if (!($75)) {
    $90 = HEAP32[$69>>2]|0;
    $91 = HEAP32[$6>>2]|0;
    $92 = (($90) - ($91))|0;
    $93 = $92 >> 2;
    $94 = ($93|0)==(0);
    $$sroa$speculated$i = $94 ? 1 : $93;
    $95 = $$sroa$speculated$i >>> 2;
    $96 = ((($6)) + 16|0);
    $97 = HEAP32[$96>>2]|0;
    __ZNSt3__214__split_bufferIxRNS_9allocatorIxEEEC2EjjS3_($3,$$sroa$speculated$i,$95,$97);
    $98 = HEAP32[$72>>2]|0;
    HEAP32[$4>>2] = $98;
    $99 = HEAP32[$67>>2]|0;
    HEAP32[$5>>2] = $99;
    ;HEAP32[$$byval_copy>>2]=HEAP32[$4>>2]|0;
    ;HEAP32[$$byval_copy1>>2]=HEAP32[$5>>2]|0;
    __ZNSt3__214__split_bufferIxRNS_9allocatorIxEEE18__construct_at_endINS_13move_iteratorIPxEEEENS_9enable_ifIXsr21__is_forward_iteratorIT_EE5valueEvE4typeESA_SA_($3,$$byval_copy,$$byval_copy1);
    $100 = HEAP32[$6>>2]|0;
    $101 = HEAP32[$3>>2]|0;
    HEAP32[$6>>2] = $101;
    HEAP32[$3>>2] = $100;
    $102 = ((($3)) + 4|0);
    $103 = HEAP32[$72>>2]|0;
    $104 = HEAP32[$102>>2]|0;
    HEAP32[$72>>2] = $104;
    HEAP32[$102>>2] = $103;
    $105 = ((($3)) + 8|0);
    $106 = HEAP32[$67>>2]|0;
    $107 = HEAP32[$105>>2]|0;
    HEAP32[$67>>2] = $107;
    HEAP32[$105>>2] = $106;
    $108 = ((($3)) + 12|0);
    $109 = HEAP32[$69>>2]|0;
    $110 = HEAP32[$108>>2]|0;
    HEAP32[$69>>2] = $110;
    HEAP32[$108>>2] = $109;
    __ZNSt3__214__split_bufferIxRNS_9allocatorIxEEED2Ev($3);
    break;
   }
   $76 = $73;
   $77 = $74;
   $78 = (($76) - ($77))|0;
   $79 = $78 >> 3;
   $80 = (($79) + 1)|0;
   $81 = (($80|0) / -2)&-1;
   $82 = (($73) + ($81<<3)|0);
   $83 = $68;
   $84 = (($83) - ($76))|0;
   $85 = $84 >> 3;
   $86 = ($85|0)==(0);
   if (!($86)) {
    _memmove(($82|0),($73|0),($84|0))|0;
   }
   $87 = (($82) + ($85<<3)|0);
   HEAP32[$67>>2] = $87;
   $88 = HEAP32[$72>>2]|0;
   $89 = (($88) + ($81<<3)|0);
   HEAP32[$72>>2] = $89;
  }
 } while(0);
 $111 = HEAP32[$67>>2]|0;
 $112 = $2;
 $113 = $112;
 $114 = HEAP32[$113>>2]|0;
 $115 = (($112) + 4)|0;
 $116 = $115;
 $117 = HEAP32[$116>>2]|0;
 $118 = $111;
 $119 = $118;
 HEAP32[$119>>2] = $114;
 $120 = (($118) + 4)|0;
 $121 = $120;
 HEAP32[$121>>2] = $117;
 $122 = HEAP32[$67>>2]|0;
 $123 = ((($122)) + 8|0);
 HEAP32[$67>>2] = $123;
 $124 = (__ZNSt3__26vectorIxNS_9allocatorIxEEE26__swap_out_circular_bufferERNS_14__split_bufferIxRS2_EEPx($0,$6,$12)|0);
 __ZNSt3__214__split_bufferIxRNS_9allocatorIxEEED2Ev($6);
 $$0 = $124;
 STACKTOP = sp;return ($$0|0);
}
function __ZNSt3__26vectorIxNS_9allocatorIxEEE12__move_rangeEPxS4_S4_($0,$1,$2,$3) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 $3 = $3|0;
 var $$017 = 0, $$promoted = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0, $27 = 0;
 var $28 = 0, $29 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, $scevgep = 0, $scevgep20 = 0, $uglygep = 0, $uglygep19 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $4 = ((($0)) + 4|0);
 $5 = HEAP32[$4>>2]|0;
 $6 = $5;
 $7 = $3;
 $8 = (($6) - ($7))|0;
 $9 = $8 >> 3;
 $10 = (($1) + ($9<<3)|0);
 $11 = ($10>>>0)<($2>>>0);
 if ($11) {
  $12 = $1;
  $$promoted = HEAP32[$4>>2]|0;
  $13 = (0 - ($9))|0;
  $scevgep = (($2) + ($13<<3)|0);
  $14 = $12 ^ -1;
  $uglygep = (($scevgep) + ($14)|0);
  $uglygep19 = $uglygep;
  $15 = $uglygep19 >>> 3;
  $16 = (($15) + 1)|0;
  $$017 = $10;$27 = $$promoted;
  while(1) {
   $21 = $$017;
   $22 = $21;
   $23 = HEAP32[$22>>2]|0;
   $24 = (($21) + 4)|0;
   $25 = $24;
   $26 = HEAP32[$25>>2]|0;
   $28 = $27;
   $29 = $28;
   HEAP32[$29>>2] = $23;
   $30 = (($28) + 4)|0;
   $31 = $30;
   HEAP32[$31>>2] = $26;
   $32 = ((($$017)) + 8|0);
   $33 = ((($27)) + 8|0);
   $34 = ($32>>>0)<($2>>>0);
   if ($34) {
    $$017 = $32;$27 = $33;
   } else {
    break;
   }
  }
  $scevgep20 = (($$promoted) + ($16<<3)|0);
  HEAP32[$4>>2] = $scevgep20;
 }
 $17 = $8 >> 3;
 $18 = ($17|0)==(0);
 if ($18) {
  return;
 }
 $19 = (0 - ($17))|0;
 $20 = (($5) + ($19<<3)|0);
 _memmove(($20|0),($1|0),($8|0))|0;
 return;
}
function __ZNSt3__26vectorIxNS_9allocatorIxEEE26__swap_out_circular_bufferERNS_14__split_bufferIxRS2_EEPx($0,$1,$2) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 var $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0, $27 = 0, $28 = 0, $29 = 0;
 var $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 __ZNKSt3__26vectorIxNS_9allocatorIxEEE17__annotate_deleteEv($0);
 $3 = ((($1)) + 4|0);
 $4 = HEAP32[$3>>2]|0;
 $5 = HEAP32[$0>>2]|0;
 $6 = $2;
 $7 = $5;
 $8 = (($6) - ($7))|0;
 $9 = $8 >> 3;
 $10 = (0 - ($9))|0;
 $11 = (($4) + ($10<<3)|0);
 HEAP32[$3>>2] = $11;
 $12 = ($8|0)>(0);
 if ($12) {
  _memcpy(($11|0),($5|0),($8|0))|0;
 }
 $13 = ((($0)) + 4|0);
 $14 = HEAP32[$13>>2]|0;
 $15 = ((($1)) + 8|0);
 $16 = (($14) - ($6))|0;
 $17 = ($16|0)>(0);
 if ($17) {
  $18 = $16 >> 3;
  $19 = HEAP32[$15>>2]|0;
  _memcpy(($19|0),($2|0),($16|0))|0;
  $20 = HEAP32[$15>>2]|0;
  $21 = (($20) + ($18<<3)|0);
  HEAP32[$15>>2] = $21;
 }
 $22 = HEAP32[$0>>2]|0;
 $23 = HEAP32[$3>>2]|0;
 HEAP32[$0>>2] = $23;
 HEAP32[$3>>2] = $22;
 $24 = HEAP32[$13>>2]|0;
 $25 = HEAP32[$15>>2]|0;
 HEAP32[$13>>2] = $25;
 HEAP32[$15>>2] = $24;
 $26 = ((($0)) + 8|0);
 $27 = ((($1)) + 12|0);
 $28 = HEAP32[$26>>2]|0;
 $29 = HEAP32[$27>>2]|0;
 HEAP32[$26>>2] = $29;
 HEAP32[$27>>2] = $28;
 $30 = HEAP32[$3>>2]|0;
 HEAP32[$1>>2] = $30;
 $31 = HEAP32[$13>>2]|0;
 $32 = HEAP32[$0>>2]|0;
 $33 = (($31) - ($32))|0;
 $34 = $33 >> 3;
 __ZNKSt3__26vectorIxNS_9allocatorIxEEE14__annotate_newEj($0,$34);
 return ($4|0);
}
function __ZNSt3__214__split_bufferIxRNS_9allocatorIxEEE18__construct_at_endINS_13move_iteratorIPxEEEENS_9enable_ifIXsr21__is_forward_iteratorIT_EE5valueEvE4typeESA_SA_($0,$1,$2) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 var $$promoted = 0, $$promoted3 = 0, $$promoted37 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0;
 var $27 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, $scevgep = 0, $scevgep10 = 0, $scevgep9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $3 = HEAP32[$1>>2]|0;
 $4 = HEAP32[$2>>2]|0;
 $5 = ($3|0)==($4|0);
 if ($5) {
  return;
 }
 $6 = ((($0)) + 8|0);
 $7 = HEAP32[$2>>2]|0;
 $$promoted = HEAP32[$6>>2]|0;
 $$promoted3 = HEAP32[$1>>2]|0;
 $$promoted37 = $$promoted3;
 $scevgep = ((($7)) + -8|0);
 $8 = $scevgep;
 $9 = (($8) - ($$promoted37))|0;
 $10 = $9 >>> 3;
 $11 = (($10) + 1)|0;
 $scevgep9 = (($$promoted) + ($11<<3)|0);
 $12 = $3;$19 = $$promoted;$26 = $$promoted3;
 while(1) {
  $13 = $12;
  $14 = $13;
  $15 = HEAP32[$14>>2]|0;
  $16 = (($13) + 4)|0;
  $17 = $16;
  $18 = HEAP32[$17>>2]|0;
  $20 = $19;
  $21 = $20;
  HEAP32[$21>>2] = $15;
  $22 = (($20) + 4)|0;
  $23 = $22;
  HEAP32[$23>>2] = $18;
  $24 = ((($19)) + 8|0);
  $25 = ((($26)) + 8|0);
  $27 = ($25|0)==($7|0);
  if ($27) {
   break;
  } else {
   $12 = $25;$19 = $24;$26 = $25;
  }
 }
 $scevgep10 = (($$promoted3) + ($11<<3)|0);
 HEAP32[$6>>2] = $scevgep9;
 HEAP32[$1>>2] = $scevgep10;
 return;
}
function __ZN13emOctaTerrain12ChunkIdtoIntE7ChunkId($0,$1) {
 $0 = $0|0;
 $1 = $1|0;
 var $2 = 0, $3 = 0, $4 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $2 = HEAP32[$1>>2]|0;
 $3 = ((($1)) + 4|0);
 $4 = HEAP32[$3>>2]|0;
 tempRet0 = ($2);
 return ($4|0);
}
function __ZNSt3__26vectorIxNS_9allocatorIxEEE21__push_back_slow_pathIxEEvOT_($0,$1) {
 $0 = $0|0;
 $1 = $1|0;
 var $$0$i = 0, $$sroa$speculated$i = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0;
 var $27 = 0, $28 = 0, $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 32|0;
 $2 = sp;
 $3 = ((($0)) + 8|0);
 $4 = ((($0)) + 4|0);
 $5 = HEAP32[$4>>2]|0;
 $6 = HEAP32[$0>>2]|0;
 $7 = (($5) - ($6))|0;
 $8 = $7 >> 3;
 $9 = (($8) + 1)|0;
 $10 = (__ZNKSt3__26vectorIxNS_9allocatorIxEEE8max_sizeEv($0)|0);
 $11 = ($10>>>0)<($9>>>0);
 if ($11) {
  __ZNKSt3__220__vector_base_commonILb1EE20__throw_length_errorEv($0);
  // unreachable;
 } else {
  $12 = ((($0)) + 8|0);
  $13 = HEAP32[$12>>2]|0;
  $14 = HEAP32[$0>>2]|0;
  $15 = (($13) - ($14))|0;
  $16 = $15 >> 3;
  $17 = $10 >>> 1;
  $18 = ($16>>>0)<($17>>>0);
  $19 = $15 >> 2;
  $20 = ($19>>>0)<($9>>>0);
  $$sroa$speculated$i = $20 ? $9 : $19;
  $$0$i = $18 ? $$sroa$speculated$i : $10;
  $21 = HEAP32[$4>>2]|0;
  $22 = (($21) - ($14))|0;
  $23 = $22 >> 3;
  __ZNSt3__214__split_bufferIxRNS_9allocatorIxEEEC2EjjS3_($2,$$0$i,$23,$3);
  $24 = ((($2)) + 8|0);
  $25 = HEAP32[$24>>2]|0;
  $26 = $1;
  $27 = $26;
  $28 = HEAP32[$27>>2]|0;
  $29 = (($26) + 4)|0;
  $30 = $29;
  $31 = HEAP32[$30>>2]|0;
  $32 = $25;
  $33 = $32;
  HEAP32[$33>>2] = $28;
  $34 = (($32) + 4)|0;
  $35 = $34;
  HEAP32[$35>>2] = $31;
  $36 = HEAP32[$24>>2]|0;
  $37 = ((($36)) + 8|0);
  HEAP32[$24>>2] = $37;
  __ZNSt3__26vectorIxNS_9allocatorIxEEE26__swap_out_circular_bufferERNS_14__split_bufferIxRS2_EE($0,$2);
  __ZNSt3__214__split_bufferIxRNS_9allocatorIxEEED2Ev($2);
  STACKTOP = sp;return;
 }
}
function __ZNKSt3__26vectorI7ChunkIdNS_9allocatorIS1_EEE4sizeEv($0) {
 $0 = $0|0;
 var $1 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $1 = ((($0)) + 4|0);
 $2 = HEAP32[$1>>2]|0;
 $3 = HEAP32[$0>>2]|0;
 $4 = (($2) - ($3))|0;
 $5 = $4 >> 3;
 return ($5|0);
}
function __ZNSt3__26vectorI7ChunkIdNS_9allocatorIS1_EEE8allocateEj($0,$1) {
 $0 = $0|0;
 $1 = $1|0;
 var $10 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $2 = (__ZNKSt3__26vectorI7ChunkIdNS_9allocatorIS1_EEE8max_sizeEv($0)|0);
 $3 = ($2>>>0)<($1>>>0);
 if ($3) {
  __ZNKSt3__220__vector_base_commonILb1EE20__throw_length_errorEv($0);
  // unreachable;
 }
 $4 = ($1>>>0)>(536870911);
 if ($4) {
  $5 = (___cxa_allocate_exception(4)|0);
  __ZNSt9bad_allocC2Ev($5);
  ___cxa_throw(($5|0),(512|0),(6|0));
  // unreachable;
 } else {
  $6 = $1 << 3;
  $7 = (__Znwj($6)|0);
  $8 = ((($0)) + 4|0);
  HEAP32[$8>>2] = $7;
  HEAP32[$0>>2] = $7;
  $9 = (($7) + ($1<<3)|0);
  $10 = ((($0)) + 8|0);
  HEAP32[$10>>2] = $9;
  __ZNKSt3__26vectorI7ChunkIdNS_9allocatorIS1_EEE14__annotate_newEj($0,0);
  return;
 }
}
function __ZNSt3__26vectorI7ChunkIdNS_9allocatorIS1_EEE18__construct_at_endIPS1_EENS_9enable_ifIXsr21__is_forward_iteratorIT_EE5valueEvE4typeES8_S8_j($0,$1,$2,$3) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 $3 = $3|0;
 var $10 = 0, $11 = 0, $12 = 0, $13 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0;
 $4 = sp;
 __ZNSt3__26vectorI7ChunkIdNS_9allocatorIS1_EEE24__RAII_IncreaseAnnotatorC2ERKS4_j($4,$0,$3);
 $5 = ((($0)) + 4|0);
 $6 = $2;
 $7 = $1;
 $8 = (($6) - ($7))|0;
 $9 = ($8|0)>(0);
 if ($9) {
  $10 = $8 >> 3;
  $11 = HEAP32[$5>>2]|0;
  _memcpy(($11|0),($1|0),($8|0))|0;
  $12 = HEAP32[$5>>2]|0;
  $13 = (($12) + ($10<<3)|0);
  HEAP32[$5>>2] = $13;
 }
 __ZNSt3__26vectorI7ChunkIdNS_9allocatorIS1_EEE24__RAII_IncreaseAnnotator6__doneEv($4);
 STACKTOP = sp;return;
}
function __ZNKSt3__26vectorI7ChunkIdNS_9allocatorIS1_EEE8max_sizeEv($0) {
 $0 = $0|0;
 var label = 0, sp = 0;
 sp = STACKTOP;
 return 536870911;
}
function __ZNKSt3__26vectorI7ChunkIdNS_9allocatorIS1_EEE14__annotate_newEj($0,$1) {
 $0 = $0|0;
 $1 = $1|0;
 var $$cast = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $2 = HEAP32[$0>>2]|0;
 $3 = ((($0)) + 8|0);
 $4 = HEAP32[$3>>2]|0;
 $$cast = $2;
 $5 = (($4) - ($$cast))|0;
 $6 = $5 >> 3;
 $7 = (($2) + ($6<<3)|0);
 $8 = (($2) + ($1<<3)|0);
 __ZNKSt3__26vectorI7ChunkIdNS_9allocatorIS1_EEE31__annotate_contiguous_containerEPKvS6_S6_S6_($0,$2,$7,$7,$8);
 return;
}
function __ZNKSt3__26vectorI7ChunkIdNS_9allocatorIS1_EEE31__annotate_contiguous_containerEPKvS6_S6_S6_($0,$1,$2,$3,$4) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 $3 = $3|0;
 $4 = $4|0;
 var label = 0, sp = 0;
 sp = STACKTOP;
 return;
}
function __ZNSt3__26vectorI7ChunkIdNS_9allocatorIS1_EEE24__RAII_IncreaseAnnotatorC2ERKS4_j($0,$1,$2) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 var label = 0, sp = 0;
 sp = STACKTOP;
 return;
}
function __ZNSt3__26vectorI7ChunkIdNS_9allocatorIS1_EEE24__RAII_IncreaseAnnotator6__doneEv($0) {
 $0 = $0|0;
 var label = 0, sp = 0;
 sp = STACKTOP;
 return;
}
function __ZN13emOctaTerrain15int2chunkVectorENSt3__26vectorIxNS0_9allocatorIxEEEE($0,$1,$2) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 var $$sroa$013$018 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0, $27 = 0, $28 = 0;
 var $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0;
 $3 = sp + 8|0;
 $4 = sp;
 HEAP32[$0>>2] = 0;
 $5 = ((($0)) + 4|0);
 HEAP32[$5>>2] = 0;
 $6 = ((($0)) + 8|0);
 HEAP32[$6>>2] = 0;
 $7 = HEAP32[$2>>2]|0;
 $8 = ((($2)) + 4|0);
 $9 = HEAP32[$8>>2]|0;
 $10 = ($7|0)==($9|0);
 if ($10) {
  STACKTOP = sp;return;
 }
 $11 = ((($0)) + 8|0);
 $$sroa$013$018 = $7;
 while(1) {
  $12 = $$sroa$013$018;
  $13 = $12;
  $14 = HEAP32[$13>>2]|0;
  $15 = (($12) + 4)|0;
  $16 = $15;
  $17 = HEAP32[$16>>2]|0;
  __ZN13emOctaTerrain14Int64toChunkIdEx($4,$1,$14,$17);
  $18 = HEAP32[$5>>2]|0;
  $19 = HEAP32[$11>>2]|0;
  $20 = ($18>>>0)<($19>>>0);
  if ($20) {
   __ZNSt3__26vectorI7ChunkIdNS_9allocatorIS1_EEE24__RAII_IncreaseAnnotatorC2ERKS4_j($3,$0,1);
   $21 = HEAP32[$5>>2]|0;
   $22 = $4;
   $23 = $22;
   $24 = HEAP32[$23>>2]|0;
   $25 = (($22) + 4)|0;
   $26 = $25;
   $27 = HEAP32[$26>>2]|0;
   $28 = $21;
   $29 = $28;
   HEAP32[$29>>2] = $24;
   $30 = (($28) + 4)|0;
   $31 = $30;
   HEAP32[$31>>2] = $27;
   __ZNSt3__26vectorI7ChunkIdNS_9allocatorIS1_EEE24__RAII_IncreaseAnnotator6__doneEv($3);
   $32 = HEAP32[$5>>2]|0;
   $33 = ((($32)) + 8|0);
   HEAP32[$5>>2] = $33;
  } else {
   __ZNSt3__26vectorI7ChunkIdNS_9allocatorIS1_EEE21__push_back_slow_pathIS1_EEvOT_($0,$4);
  }
  $34 = ((($$sroa$013$018)) + 8|0);
  $35 = ($34|0)==($9|0);
  if ($35) {
   break;
  } else {
   $$sroa$013$018 = $34;
  }
 }
 STACKTOP = sp;return;
}
function __ZNSt3__26vectorIxNS_9allocatorIxEEEC2ERKS3_($0,$1) {
 $0 = $0|0;
 $1 = $1|0;
 var $10 = 0, $11 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 HEAP32[$0>>2] = 0;
 $2 = ((($0)) + 4|0);
 HEAP32[$2>>2] = 0;
 $3 = ((($0)) + 8|0);
 HEAP32[$3>>2] = 0;
 $4 = ((($1)) + 4|0);
 $5 = HEAP32[$4>>2]|0;
 $6 = HEAP32[$1>>2]|0;
 $7 = (($5) - ($6))|0;
 $8 = $7 >> 3;
 $9 = ($8|0)==(0);
 if ($9) {
  return;
 }
 __ZNSt3__26vectorIxNS_9allocatorIxEEE8allocateEj($0,$8);
 $10 = HEAP32[$1>>2]|0;
 $11 = HEAP32[$4>>2]|0;
 __ZNSt3__26vectorIxNS_9allocatorIxEEE18__construct_at_endIPxEENS_9enable_ifIXsr21__is_forward_iteratorIT_EE5valueEvE4typeES7_S7_j($0,$10,$11,$8);
 return;
}
function __ZN13emOctaTerrain14Int64toChunkIdEx($0,$1,$2,$3) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 $3 = $3|0;
 var $4 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 HEAP32[$0>>2] = $3;
 $4 = ((($0)) + 4|0);
 HEAP32[$4>>2] = $2;
 return;
}
function __ZNSt3__26vectorI7ChunkIdNS_9allocatorIS1_EEE21__push_back_slow_pathIS1_EEvOT_($0,$1) {
 $0 = $0|0;
 $1 = $1|0;
 var $$0$i = 0, $$sroa$speculated$i = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0;
 var $27 = 0, $28 = 0, $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 32|0;
 $2 = sp;
 $3 = ((($0)) + 8|0);
 $4 = ((($0)) + 4|0);
 $5 = HEAP32[$4>>2]|0;
 $6 = HEAP32[$0>>2]|0;
 $7 = (($5) - ($6))|0;
 $8 = $7 >> 3;
 $9 = (($8) + 1)|0;
 $10 = (__ZNKSt3__26vectorI7ChunkIdNS_9allocatorIS1_EEE8max_sizeEv($0)|0);
 $11 = ($10>>>0)<($9>>>0);
 if ($11) {
  __ZNKSt3__220__vector_base_commonILb1EE20__throw_length_errorEv($0);
  // unreachable;
 } else {
  $12 = ((($0)) + 8|0);
  $13 = HEAP32[$12>>2]|0;
  $14 = HEAP32[$0>>2]|0;
  $15 = (($13) - ($14))|0;
  $16 = $15 >> 3;
  $17 = $10 >>> 1;
  $18 = ($16>>>0)<($17>>>0);
  $19 = $15 >> 2;
  $20 = ($19>>>0)<($9>>>0);
  $$sroa$speculated$i = $20 ? $9 : $19;
  $$0$i = $18 ? $$sroa$speculated$i : $10;
  $21 = HEAP32[$4>>2]|0;
  $22 = (($21) - ($14))|0;
  $23 = $22 >> 3;
  __ZNSt3__214__split_bufferI7ChunkIdRNS_9allocatorIS1_EEEC2EjjS4_($2,$$0$i,$23,$3);
  $24 = ((($2)) + 8|0);
  $25 = HEAP32[$24>>2]|0;
  $26 = $1;
  $27 = $26;
  $28 = HEAP32[$27>>2]|0;
  $29 = (($26) + 4)|0;
  $30 = $29;
  $31 = HEAP32[$30>>2]|0;
  $32 = $25;
  $33 = $32;
  HEAP32[$33>>2] = $28;
  $34 = (($32) + 4)|0;
  $35 = $34;
  HEAP32[$35>>2] = $31;
  $36 = HEAP32[$24>>2]|0;
  $37 = ((($36)) + 8|0);
  HEAP32[$24>>2] = $37;
  __ZNSt3__26vectorI7ChunkIdNS_9allocatorIS1_EEE26__swap_out_circular_bufferERNS_14__split_bufferIS1_RS3_EE($0,$2);
  __ZNSt3__214__split_bufferI7ChunkIdRNS_9allocatorIS1_EEED2Ev($2);
  STACKTOP = sp;return;
 }
}
function __ZNSt3__214__split_bufferI7ChunkIdRNS_9allocatorIS1_EEEC2EjjS4_($0,$1,$2,$3) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 $3 = $3|0;
 var $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $4 = ((($0)) + 12|0);
 HEAP32[$4>>2] = 0;
 $5 = ((($0)) + 16|0);
 HEAP32[$5>>2] = $3;
 $6 = ($1|0)==(0);
 do {
  if ($6) {
   $11 = 0;
  } else {
   $7 = ($1>>>0)>(536870911);
   if ($7) {
    $8 = (___cxa_allocate_exception(4)|0);
    __ZNSt9bad_allocC2Ev($8);
    ___cxa_throw(($8|0),(512|0),(6|0));
    // unreachable;
   } else {
    $9 = $1 << 3;
    $10 = (__Znwj($9)|0);
    $11 = $10;
    break;
   }
  }
 } while(0);
 HEAP32[$0>>2] = $11;
 $12 = (($11) + ($2<<3)|0);
 $13 = ((($0)) + 8|0);
 HEAP32[$13>>2] = $12;
 $14 = ((($0)) + 4|0);
 HEAP32[$14>>2] = $12;
 $15 = (($11) + ($1<<3)|0);
 $16 = ((($0)) + 12|0);
 HEAP32[$16>>2] = $15;
 return;
}
function __ZNSt3__26vectorI7ChunkIdNS_9allocatorIS1_EEE26__swap_out_circular_bufferERNS_14__split_bufferIS1_RS3_EE($0,$1) {
 $0 = $0|0;
 $1 = $1|0;
 var $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0, $3 = 0, $4 = 0;
 var $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 __ZNKSt3__26vectorI7ChunkIdNS_9allocatorIS1_EEE17__annotate_deleteEv($0);
 $2 = HEAP32[$0>>2]|0;
 $3 = ((($0)) + 4|0);
 $4 = HEAP32[$3>>2]|0;
 $5 = ((($1)) + 4|0);
 $6 = $2;
 $7 = (($4) - ($6))|0;
 $8 = $7 >> 3;
 $9 = HEAP32[$5>>2]|0;
 $10 = (0 - ($8))|0;
 $11 = (($9) + ($10<<3)|0);
 HEAP32[$5>>2] = $11;
 $12 = ($7|0)>(0);
 if ($12) {
  _memcpy(($11|0),($2|0),($7|0))|0;
 }
 $13 = HEAP32[$0>>2]|0;
 $14 = HEAP32[$5>>2]|0;
 HEAP32[$0>>2] = $14;
 HEAP32[$5>>2] = $13;
 $15 = ((($1)) + 8|0);
 $16 = HEAP32[$3>>2]|0;
 $17 = HEAP32[$15>>2]|0;
 HEAP32[$3>>2] = $17;
 HEAP32[$15>>2] = $16;
 $18 = ((($0)) + 8|0);
 $19 = ((($1)) + 12|0);
 $20 = HEAP32[$18>>2]|0;
 $21 = HEAP32[$19>>2]|0;
 HEAP32[$18>>2] = $21;
 HEAP32[$19>>2] = $20;
 $22 = HEAP32[$5>>2]|0;
 HEAP32[$1>>2] = $22;
 $23 = HEAP32[$3>>2]|0;
 $24 = HEAP32[$0>>2]|0;
 $25 = (($23) - ($24))|0;
 $26 = $25 >> 3;
 __ZNKSt3__26vectorI7ChunkIdNS_9allocatorIS1_EEE14__annotate_newEj($0,$26);
 return;
}
function __ZNSt3__214__split_bufferI7ChunkIdRNS_9allocatorIS1_EEED2Ev($0) {
 $0 = $0|0;
 var $1 = 0, $10 = 0, $11 = 0, $12 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, $scevgep$i$i$i = 0, $scevgep4$i$i$i = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $1 = ((($0)) + 4|0);
 $2 = HEAP32[$1>>2]|0;
 $3 = ((($0)) + 8|0);
 $4 = HEAP32[$3>>2]|0;
 $5 = ($4|0)==($2|0);
 if (!($5)) {
  $scevgep$i$i$i = ((($4)) + -8|0);
  $6 = $scevgep$i$i$i;
  $7 = $2;
  $8 = (($6) - ($7))|0;
  $9 = $8 >>> 3;
  $10 = $9 ^ -1;
  $scevgep4$i$i$i = (($4) + ($10<<3)|0);
  HEAP32[$3>>2] = $scevgep4$i$i$i;
 }
 $11 = HEAP32[$0>>2]|0;
 $12 = ($11|0)==(0|0);
 if ($12) {
  return;
 }
 __ZdlPv($11);
 return;
}
function __ZNKSt3__26vectorI7ChunkIdNS_9allocatorIS1_EEE17__annotate_deleteEv($0) {
 $0 = $0|0;
 var $$cast = 0, $1 = 0, $10 = 0, $11 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $1 = HEAP32[$0>>2]|0;
 $2 = ((($0)) + 8|0);
 $3 = HEAP32[$2>>2]|0;
 $$cast = $1;
 $4 = (($3) - ($$cast))|0;
 $5 = $4 >> 3;
 $6 = (($1) + ($5<<3)|0);
 $7 = ((($0)) + 4|0);
 $8 = HEAP32[$7>>2]|0;
 $9 = (($8) - ($$cast))|0;
 $10 = $9 >> 3;
 $11 = (($1) + ($10<<3)|0);
 __ZNKSt3__26vectorI7ChunkIdNS_9allocatorIS1_EEE31__annotate_contiguous_containerEPKvS6_S6_S6_($0,$1,$6,$11,$6);
 return;
}
function __ZN11OctaTerrain11getVerticesEv($0,$1) {
 $0 = $0|0;
 $1 = $1|0;
 var $2 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $2 = ((($1)) + 64|0);
 __ZNSt3__26vectorI4vec9NS_9allocatorIS1_EEEC2ERKS4_($0,$2);
 return;
}
function __ZNSt3__26vectorI4vec9NS_9allocatorIS1_EEEC2ERKS4_($0,$1) {
 $0 = $0|0;
 $1 = $1|0;
 var $10 = 0, $11 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 HEAP32[$0>>2] = 0;
 $2 = ((($0)) + 4|0);
 HEAP32[$2>>2] = 0;
 $3 = ((($0)) + 8|0);
 HEAP32[$3>>2] = 0;
 $4 = ((($1)) + 4|0);
 $5 = HEAP32[$4>>2]|0;
 $6 = HEAP32[$1>>2]|0;
 $7 = (($5) - ($6))|0;
 $8 = (($7|0) / 36)&-1;
 $9 = ($7|0)==(0);
 if ($9) {
  return;
 }
 __ZNSt3__26vectorI4vec9NS_9allocatorIS1_EEE8allocateEj($0,$8);
 $10 = HEAP32[$1>>2]|0;
 $11 = HEAP32[$4>>2]|0;
 __ZNSt3__26vectorI4vec9NS_9allocatorIS1_EEE18__construct_at_endIPS1_EENS_9enable_ifIXsr21__is_forward_iteratorIT_EE5valueEvE4typeES8_S8_j($0,$10,$11,$8);
 return;
}
function __ZNSt3__26vectorI4vec9NS_9allocatorIS1_EEE8allocateEj($0,$1) {
 $0 = $0|0;
 $1 = $1|0;
 var $10 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $2 = (__ZNKSt3__26vectorI4vec9NS_9allocatorIS1_EEE8max_sizeEv($0)|0);
 $3 = ($2>>>0)<($1>>>0);
 if ($3) {
  __ZNKSt3__220__vector_base_commonILb1EE20__throw_length_errorEv($0);
  // unreachable;
 }
 $4 = ($1>>>0)>(119304647);
 if ($4) {
  $5 = (___cxa_allocate_exception(4)|0);
  __ZNSt9bad_allocC2Ev($5);
  ___cxa_throw(($5|0),(512|0),(6|0));
  // unreachable;
 } else {
  $6 = ($1*36)|0;
  $7 = (__Znwj($6)|0);
  $8 = ((($0)) + 4|0);
  HEAP32[$8>>2] = $7;
  HEAP32[$0>>2] = $7;
  $9 = (($7) + (($1*36)|0)|0);
  $10 = ((($0)) + 8|0);
  HEAP32[$10>>2] = $9;
  __ZNKSt3__26vectorI4vec9NS_9allocatorIS1_EEE14__annotate_newEj($0,0);
  return;
 }
}
function __ZNSt3__26vectorI4vec9NS_9allocatorIS1_EEE18__construct_at_endIPS1_EENS_9enable_ifIXsr21__is_forward_iteratorIT_EE5valueEvE4typeES8_S8_j($0,$1,$2,$3) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 $3 = $3|0;
 var $10 = 0, $11 = 0, $12 = 0, $13 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0;
 $4 = sp;
 __ZNSt3__26vectorI4vec9NS_9allocatorIS1_EEE24__RAII_IncreaseAnnotatorC2ERKS4_j($4,$0,$3);
 $5 = ((($0)) + 4|0);
 $6 = $2;
 $7 = $1;
 $8 = (($6) - ($7))|0;
 $9 = ($8|0)>(0);
 if ($9) {
  $10 = (($8>>>0) / 36)&-1;
  $11 = HEAP32[$5>>2]|0;
  _memcpy(($11|0),($1|0),($8|0))|0;
  $12 = HEAP32[$5>>2]|0;
  $13 = (($12) + (($10*36)|0)|0);
  HEAP32[$5>>2] = $13;
 }
 __ZNSt3__26vectorI4vec9NS_9allocatorIS1_EEE24__RAII_IncreaseAnnotator6__doneEv($4);
 STACKTOP = sp;return;
}
function __ZN10emscripten8internal11NoBaseClass6verifyI13emOctaTerrainEEvv() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 return;
}
function __ZN10emscripten8internal13getActualTypeI13emOctaTerrainEEPKvPT_($0) {
 $0 = $0|0;
 var $1 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $1 = (__ZN10emscripten8internal14getLightTypeIDI13emOctaTerrainEEPKvRKT_($0)|0);
 return ($1|0);
}
function __ZN10emscripten8internal11NoBaseClass11getUpcasterI13emOctaTerrainEEPFvvEv() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 return (0|0);
}
function __ZN10emscripten8internal11NoBaseClass13getDowncasterI13emOctaTerrainEEPFvvEv() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 return (0|0);
}
function __ZN10emscripten8internal14raw_destructorI13emOctaTerrainEEvPT_($0) {
 $0 = $0|0;
 var $1 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $1 = ($0|0)==(0|0);
 if ($1) {
  return;
 }
 __ZN11OctaTerrainD2Ev($0);
 __ZdlPv($0);
 return;
}
function __ZN10emscripten8internal6TypeIDI13emOctaTerrainE3getEv() {
 var $0 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = (__ZN10emscripten8internal11LightTypeIDI13emOctaTerrainE3getEv()|0);
 return ($0|0);
}
function __ZN10emscripten8internal6TypeIDINS0_17AllowedRawPointerI13emOctaTerrainEEE3getEv() {
 var $0 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = (__ZN10emscripten8internal11LightTypeIDIP13emOctaTerrainE3getEv()|0);
 return ($0|0);
}
function __ZN10emscripten8internal6TypeIDINS0_17AllowedRawPointerIK13emOctaTerrainEEE3getEv() {
 var $0 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = (__ZN10emscripten8internal11LightTypeIDIPK13emOctaTerrainE3getEv()|0);
 return ($0|0);
}
function __ZN10emscripten8internal11NoBaseClass3getEv() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 return (0|0);
}
function __ZN10emscripten8internal14getLightTypeIDI13emOctaTerrainEEPKvRKT_($0) {
 $0 = $0|0;
 var label = 0, sp = 0;
 sp = STACKTOP;
 return (16|0);
}
function __ZN11OctaTerrainD2Ev($0) {
 $0 = $0|0;
 var $1 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $1 = ((($0)) + 64|0);
 __ZNSt3__213__vector_baseI4vec9NS_9allocatorIS1_EEED2Ev($1);
 $2 = ((($0)) + 52|0);
 __ZNSt3__213__vector_baseIxNS_9allocatorIxEEED2Ev($2);
 $3 = ((($0)) + 40|0);
 __ZNSt3__213__vector_baseIxNS_9allocatorIxEEED2Ev($3);
 $4 = ((($0)) + 28|0);
 __ZNSt3__213__vector_baseIxNS_9allocatorIxEEED2Ev($4);
 $5 = ((($0)) + 16|0);
 __ZNSt3__213__vector_baseIxNS_9allocatorIxEEED2Ev($5);
 return;
}
function __ZNSt3__213__vector_baseI4vec9NS_9allocatorIS1_EEED2Ev($0) {
 $0 = $0|0;
 var $1 = 0, $10 = 0, $11 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, $scevgep$i$i = 0, $scevgep4$i$i = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $1 = HEAP32[$0>>2]|0;
 $2 = ($1|0)==(0|0);
 if ($2) {
  return;
 }
 $3 = ((($0)) + 4|0);
 $4 = HEAP32[$3>>2]|0;
 $5 = ($4|0)==($1|0);
 if (!($5)) {
  $scevgep$i$i = ((($4)) + -36|0);
  $6 = $scevgep$i$i;
  $7 = $1;
  $8 = (($6) - ($7))|0;
  $9 = (($8>>>0) / 36)&-1;
  $10 = $9 ^ -1;
  $scevgep4$i$i = (($4) + (($10*36)|0)|0);
  HEAP32[$3>>2] = $scevgep4$i$i;
 }
 $11 = HEAP32[$0>>2]|0;
 __ZdlPv($11);
 return;
}
function __ZN10emscripten8internal11LightTypeIDI13emOctaTerrainE3getEv() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 return (16|0);
}
function __ZN10emscripten8internal11LightTypeIDIP13emOctaTerrainE3getEv() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 return (32|0);
}
function __ZN10emscripten8internal11LightTypeIDIPK13emOctaTerrainE3getEv() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 return (48|0);
}
function __ZN10emscripten8internal19getGenericSignatureIJiiEEEPKcv() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 return (1548|0);
}
function __ZN10emscripten8internal19getGenericSignatureIJvEEEPKcv() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 return (1551|0);
}
function __ZN10emscripten8internal19getGenericSignatureIJviEEEPKcv() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 return (1553|0);
}
function __ZN10emscripten8internal12operator_newI13emOctaTerrainJfifEEEPT_DpOT0_($0,$1,$2) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 var $3 = 0, $4 = 0.0, $5 = 0, $6 = 0.0, label = 0, sp = 0;
 sp = STACKTOP;
 $3 = (__Znwj(192)|0);
 $4 = +HEAPF32[$0>>2];
 $5 = HEAP32[$1>>2]|0;
 $6 = +HEAPF32[$2>>2];
 __ZN13emOctaTerrainC2Efifbb($3,$4,$5,$6,0,0);
 return ($3|0);
}
function __ZN10emscripten8internal7InvokerIP13emOctaTerrainJOfOiS4_EE6invokeEPFS3_S4_S5_S4_Efif($0,$1,$2,$3) {
 $0 = $0|0;
 $1 = +$1;
 $2 = $2|0;
 $3 = +$3;
 var $10 = 0, $11 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0.0, $8 = 0, $9 = 0.0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0;
 $4 = sp + 8|0;
 $5 = sp + 4|0;
 $6 = sp;
 $7 = (+__ZN10emscripten8internal11BindingTypeIOfE12fromWireTypeEf($1));
 HEAPF32[$4>>2] = $7;
 $8 = (__ZN10emscripten8internal11BindingTypeIOiE12fromWireTypeEi($2)|0);
 HEAP32[$5>>2] = $8;
 $9 = (+__ZN10emscripten8internal11BindingTypeIOfE12fromWireTypeEf($3));
 HEAPF32[$6>>2] = $9;
 $10 = (FUNCTION_TABLE_iiii[$0 & 15]($4,$5,$6)|0);
 $11 = (__ZN10emscripten8internal11BindingTypeIP13emOctaTerrainE10toWireTypeES3_($10)|0);
 STACKTOP = sp;return ($11|0);
}
function __ZNK10emscripten8internal12WithPoliciesIJNS_18allow_raw_pointersEEE11ArgTypeListIJP13emOctaTerrainOfOiS7_EE8getCountEv($0) {
 $0 = $0|0;
 var label = 0, sp = 0;
 sp = STACKTOP;
 return 4;
}
function __ZNK10emscripten8internal12WithPoliciesIJNS_18allow_raw_pointersEEE11ArgTypeListIJP13emOctaTerrainOfOiS7_EE8getTypesEv($0) {
 $0 = $0|0;
 var $1 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $1 = (__ZN10emscripten8internal14ArgArrayGetterINS0_8TypeListIJNS0_17AllowedRawPointerI13emOctaTerrainEEOfOiS6_EEEE3getEv()|0);
 return ($1|0);
}
function __ZN10emscripten8internal11BindingTypeIP13emOctaTerrainE10toWireTypeES3_($0) {
 $0 = $0|0;
 var label = 0, sp = 0;
 sp = STACKTOP;
 return ($0|0);
}
function __ZN10emscripten8internal11BindingTypeIOfE12fromWireTypeEf($0) {
 $0 = +$0;
 var $1 = 0.0, label = 0, sp = 0;
 sp = STACKTOP;
 $1 = (+__ZN10emscripten8internal11BindingTypeIfE12fromWireTypeEf($0));
 return (+$1);
}
function __ZN10emscripten8internal11BindingTypeIOiE12fromWireTypeEi($0) {
 $0 = $0|0;
 var $1 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $1 = (__ZN10emscripten8internal11BindingTypeIiE12fromWireTypeEi($0)|0);
 return ($1|0);
}
function __ZN10emscripten8internal11BindingTypeIfE12fromWireTypeEf($0) {
 $0 = +$0;
 var label = 0, sp = 0;
 sp = STACKTOP;
 return (+$0);
}
function __ZN10emscripten8internal11BindingTypeIiE12fromWireTypeEi($0) {
 $0 = $0|0;
 var label = 0, sp = 0;
 sp = STACKTOP;
 return ($0|0);
}
function __ZN10emscripten8internal14ArgArrayGetterINS0_8TypeListIJNS0_17AllowedRawPointerI13emOctaTerrainEEOfOiS6_EEEE3getEv() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 return (704|0);
}
function __ZN10emscripten8internal19getGenericSignatureIJiififEEEPKcv() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 return (1556|0);
}
function __ZN13emOctaTerrainC2Efifbb($0,$1,$2,$3,$4,$5) {
 $0 = $0|0;
 $1 = +$1;
 $2 = $2|0;
 $3 = +$3;
 $4 = $4|0;
 $5 = $5|0;
 var label = 0, sp = 0;
 sp = STACKTOP;
 __ZN11OctaTerrainC2Efifbbb($0,$1,$2,$3,$4,$5,1);
 return;
}
function __ZN11OctaTerrainC2Efifbbb($0,$1,$2,$3,$4,$5,$6) {
 $0 = $0|0;
 $1 = +$1;
 $2 = $2|0;
 $3 = +$3;
 $4 = $4|0;
 $5 = $5|0;
 $6 = $6|0;
 var $$0 = 0, $$off = 0, $$sroa$0$0$$sroa_idx = 0, $$sroa$4$0$$sroa_idx3 = 0, $$sroa$5$0$$sroa_idx5 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0.0, $17 = 0, $18 = 0, $19 = 0, $20 = 0, $21 = 0, $22 = 0, $7 = 0, $8 = 0;
 var $9 = 0, dest = 0, label = 0, sp = 0, stop = 0;
 sp = STACKTOP;
 $7 = ((($0)) + 16|0);
 $8 = ((($0)) + 88|0);
 dest=$7; stop=dest+60|0; do { HEAP32[dest>>2]=0|0; dest=dest+4|0; } while ((dest|0) < (stop|0));
 __ZN7FrustumC2Ev($8);
 $9 = ((($0)) + 184|0);
 HEAPF32[$9>>2] = 1.5707963705062866;
 $10 = ((($0)) + 188|0);
 HEAPF32[$10>>2] = 1.5707963705062866;
 $$off = (($2) + -1)|0;
 $11 = ($$off>>>0)>(23);
 $12 = ($2|0)<(1);
 $13 = $12 ? 0 : 24;
 $$0 = $11 ? $13 : $2;
 HEAPF32[$0>>2] = $1;
 $14 = ((($0)) + 4|0);
 HEAP32[$14>>2] = $$0;
 $15 = ((($0)) + 8|0);
 HEAPF32[$15>>2] = $3;
 $16 = $1 * 2.0;
 $$sroa$0$0$$sroa_idx = ((($0)) + 76|0);
 HEAPF32[$$sroa$0$0$$sroa_idx>>2] = $16;
 $$sroa$4$0$$sroa_idx3 = ((($0)) + 80|0);
 HEAPF32[$$sroa$4$0$$sroa_idx3>>2] = 0.0;
 $$sroa$5$0$$sroa_idx5 = ((($0)) + 84|0);
 HEAPF32[$$sroa$5$0$$sroa_idx5>>2] = 0.0;
 $17 = ((($0)) + 12|0);
 $18 = $4&1;
 HEAP8[$17>>0] = $18;
 $19 = ((($0)) + 13|0);
 $20 = $5&1;
 HEAP8[$19>>0] = $20;
 $21 = ((($0)) + 14|0);
 $22 = $6&1;
 HEAP8[$21>>0] = $22;
 return;
}
function __ZN7FrustumC2Ev($0) {
 $0 = $0|0;
 var label = 0, sp = 0;
 sp = STACKTOP;
 return;
}
function __ZN10emscripten8internal12operator_newI13emOctaTerrainJfifbEEEPT_DpOT0_($0,$1,$2,$3) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 $3 = $3|0;
 var $4 = 0, $5 = 0.0, $6 = 0, $7 = 0.0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $4 = (__Znwj(192)|0);
 $5 = +HEAPF32[$0>>2];
 $6 = HEAP32[$1>>2]|0;
 $7 = +HEAPF32[$2>>2];
 $8 = HEAP8[$3>>0]|0;
 $9 = ($8<<24>>24)!=(0);
 __ZN13emOctaTerrainC2Efifbb($4,$5,$6,$7,$9,0);
 return ($4|0);
}
function __ZN10emscripten8internal7InvokerIP13emOctaTerrainJOfOiS4_ObEE6invokeEPFS3_S4_S5_S4_S6_Efifb($0,$1,$2,$3,$4) {
 $0 = $0|0;
 $1 = +$1;
 $2 = $2|0;
 $3 = +$3;
 $4 = $4|0;
 var $10 = 0, $11 = 0.0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0.0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0;
 $5 = sp + 8|0;
 $6 = sp + 4|0;
 $7 = sp;
 $8 = sp + 12|0;
 $9 = (+__ZN10emscripten8internal11BindingTypeIOfE12fromWireTypeEf($1));
 HEAPF32[$5>>2] = $9;
 $10 = (__ZN10emscripten8internal11BindingTypeIOiE12fromWireTypeEi($2)|0);
 HEAP32[$6>>2] = $10;
 $11 = (+__ZN10emscripten8internal11BindingTypeIOfE12fromWireTypeEf($3));
 HEAPF32[$7>>2] = $11;
 $12 = (__ZN10emscripten8internal11BindingTypeIObE12fromWireTypeEb($4)|0);
 $13 = $12&1;
 HEAP8[$8>>0] = $13;
 $14 = (FUNCTION_TABLE_iiiii[$0 & 3]($5,$6,$7,$8)|0);
 $15 = (__ZN10emscripten8internal11BindingTypeIP13emOctaTerrainE10toWireTypeES3_($14)|0);
 STACKTOP = sp;return ($15|0);
}
function __ZNK10emscripten8internal12WithPoliciesIJNS_18allow_raw_pointersEEE11ArgTypeListIJP13emOctaTerrainOfOiS7_ObEE8getCountEv($0) {
 $0 = $0|0;
 var label = 0, sp = 0;
 sp = STACKTOP;
 return 5;
}
function __ZNK10emscripten8internal12WithPoliciesIJNS_18allow_raw_pointersEEE11ArgTypeListIJP13emOctaTerrainOfOiS7_ObEE8getTypesEv($0) {
 $0 = $0|0;
 var $1 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $1 = (__ZN10emscripten8internal14ArgArrayGetterINS0_8TypeListIJNS0_17AllowedRawPointerI13emOctaTerrainEEOfOiS6_ObEEEE3getEv()|0);
 return ($1|0);
}
function __ZN10emscripten8internal11BindingTypeIObE12fromWireTypeEb($0) {
 $0 = $0|0;
 var $1 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $1 = (__ZN10emscripten8internal11BindingTypeIbE12fromWireTypeEb($0)|0);
 return ($1|0);
}
function __ZN10emscripten8internal11BindingTypeIbE12fromWireTypeEb($0) {
 $0 = $0|0;
 var label = 0, sp = 0;
 sp = STACKTOP;
 return ($0|0);
}
function __ZN10emscripten8internal14ArgArrayGetterINS0_8TypeListIJNS0_17AllowedRawPointerI13emOctaTerrainEEOfOiS6_ObEEEE3getEv() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 return (720|0);
}
function __ZN10emscripten8internal19getGenericSignatureIJiififiEEEPKcv() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 return (1562|0);
}
function __ZN10emscripten8internal12operator_newI13emOctaTerrainJfifbbEEEPT_DpOT0_($0,$1,$2,$3,$4) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 $3 = $3|0;
 $4 = $4|0;
 var $10 = 0, $11 = 0, $12 = 0, $5 = 0, $6 = 0.0, $7 = 0, $8 = 0.0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $5 = (__Znwj(192)|0);
 $6 = +HEAPF32[$0>>2];
 $7 = HEAP32[$1>>2]|0;
 $8 = +HEAPF32[$2>>2];
 $9 = HEAP8[$3>>0]|0;
 $10 = ($9<<24>>24)!=(0);
 $11 = HEAP8[$4>>0]|0;
 $12 = ($11<<24>>24)!=(0);
 __ZN13emOctaTerrainC2Efifbb($5,$6,$7,$8,$10,$12);
 return ($5|0);
}
function __ZN10emscripten8internal7InvokerIP13emOctaTerrainJOfOiS4_ObS6_EE6invokeEPFS3_S4_S5_S4_S6_S6_Efifbb($0,$1,$2,$3,$4,$5) {
 $0 = $0|0;
 $1 = +$1;
 $2 = $2|0;
 $3 = +$3;
 $4 = $4|0;
 $5 = $5|0;
 var $10 = 0, $11 = 0.0, $12 = 0, $13 = 0.0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0;
 $6 = sp + 8|0;
 $7 = sp + 4|0;
 $8 = sp;
 $9 = sp + 13|0;
 $10 = sp + 12|0;
 $11 = (+__ZN10emscripten8internal11BindingTypeIOfE12fromWireTypeEf($1));
 HEAPF32[$6>>2] = $11;
 $12 = (__ZN10emscripten8internal11BindingTypeIOiE12fromWireTypeEi($2)|0);
 HEAP32[$7>>2] = $12;
 $13 = (+__ZN10emscripten8internal11BindingTypeIOfE12fromWireTypeEf($3));
 HEAPF32[$8>>2] = $13;
 $14 = (__ZN10emscripten8internal11BindingTypeIObE12fromWireTypeEb($4)|0);
 $15 = $14&1;
 HEAP8[$9>>0] = $15;
 $16 = (__ZN10emscripten8internal11BindingTypeIObE12fromWireTypeEb($5)|0);
 $17 = $16&1;
 HEAP8[$10>>0] = $17;
 $18 = (FUNCTION_TABLE_iiiiii[$0 & 1]($6,$7,$8,$9,$10)|0);
 $19 = (__ZN10emscripten8internal11BindingTypeIP13emOctaTerrainE10toWireTypeES3_($18)|0);
 STACKTOP = sp;return ($19|0);
}
function __ZNK10emscripten8internal12WithPoliciesIJNS_18allow_raw_pointersEEE11ArgTypeListIJP13emOctaTerrainOfOiS7_ObS9_EE8getCountEv($0) {
 $0 = $0|0;
 var label = 0, sp = 0;
 sp = STACKTOP;
 return 6;
}
function __ZNK10emscripten8internal12WithPoliciesIJNS_18allow_raw_pointersEEE11ArgTypeListIJP13emOctaTerrainOfOiS7_ObS9_EE8getTypesEv($0) {
 $0 = $0|0;
 var $1 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $1 = (__ZN10emscripten8internal14ArgArrayGetterINS0_8TypeListIJNS0_17AllowedRawPointerI13emOctaTerrainEEOfOiS6_ObS8_EEEE3getEv()|0);
 return ($1|0);
}
function __ZN10emscripten8internal14ArgArrayGetterINS0_8TypeListIJNS0_17AllowedRawPointerI13emOctaTerrainEEOfOiS6_ObS8_EEEE3getEv() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 return (740|0);
}
function __ZN10emscripten8internal19getGenericSignatureIJiififiiEEEPKcv() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 return (1569|0);
}
function __ZN10emscripten8internal13MethodInvokerIM13emOctaTerrainFv4vec34mat4NSt3__26vectorI7ChunkIdNS5_9allocatorIS7_EEEEEvPS2_JS3_S4_SA_EE6invokeERKSC_SD_PS3_PS4_PSA_($0,$1,$2,$3,$4) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 $3 = $3|0;
 $4 = $4|0;
 var $$byval_copy = 0, $$byval_copy1 = 0, $$elt6 = 0, $$unpack = 0, $$unpack7 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $20 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0;
 var $9 = 0, dest = 0, label = 0, sp = 0, src = 0, stop = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 176|0;
 $$byval_copy1 = sp + 104|0;
 $$byval_copy = sp + 92|0;
 $5 = sp + 80|0;
 $6 = sp + 16|0;
 $7 = sp;
 $$unpack = HEAP32[$0>>2]|0;
 $$elt6 = ((($0)) + 4|0);
 $$unpack7 = HEAP32[$$elt6>>2]|0;
 $8 = (__ZN10emscripten8internal11BindingTypeIP13emOctaTerrainE12fromWireTypeES3_($1)|0);
 $9 = $$unpack7 >> 1;
 $10 = (($8) + ($9)|0);
 $11 = $$unpack7 & 1;
 $12 = ($11|0)==(0);
 if ($12) {
  $16 = $$unpack;
  $20 = $16;
 } else {
  $13 = HEAP32[$10>>2]|0;
  $14 = (($13) + ($$unpack)|0);
  $15 = HEAP32[$14>>2]|0;
  $20 = $15;
 }
 $17 = (__ZN10emscripten8internal18GenericBindingTypeI4vec3E12fromWireTypeEPS2_($2)|0);
 ;HEAP32[$5>>2]=HEAP32[$17>>2]|0;HEAP32[$5+4>>2]=HEAP32[$17+4>>2]|0;HEAP32[$5+8>>2]=HEAP32[$17+8>>2]|0;
 $18 = (__ZN10emscripten8internal18GenericBindingTypeI4mat4E12fromWireTypeEPS2_($3)|0);
 dest=$6; src=$18; stop=dest+64|0; do { HEAP32[dest>>2]=HEAP32[src>>2]|0; dest=dest+4|0; src=src+4|0; } while ((dest|0) < (stop|0));
 $19 = (__ZN10emscripten8internal18GenericBindingTypeINSt3__26vectorI7ChunkIdNS2_9allocatorIS4_EEEEE12fromWireTypeEPS7_($4)|0);
 __ZNSt3__26vectorI7ChunkIdNS_9allocatorIS1_EEEC2ERKS4_($7,$19);
 ;HEAP32[$$byval_copy>>2]=HEAP32[$5>>2]|0;HEAP32[$$byval_copy+4>>2]=HEAP32[$5+4>>2]|0;HEAP32[$$byval_copy+8>>2]=HEAP32[$5+8>>2]|0;
 dest=$$byval_copy1; src=$6; stop=dest+64|0; do { HEAP32[dest>>2]=HEAP32[src>>2]|0; dest=dest+4|0; src=src+4|0; } while ((dest|0) < (stop|0));
 FUNCTION_TABLE_viiii[$20 & 7]($10,$$byval_copy,$$byval_copy1,$7);
 __ZNSt3__213__vector_baseI7ChunkIdNS_9allocatorIS1_EEED2Ev($7);
 STACKTOP = sp;return;
}
function __ZNK10emscripten8internal12WithPoliciesIJEE11ArgTypeListIJvNS0_17AllowedRawPointerI13emOctaTerrainEE4vec34mat4NSt3__26vectorI7ChunkIdNS9_9allocatorISB_EEEEEE8getCountEv($0) {
 $0 = $0|0;
 var label = 0, sp = 0;
 sp = STACKTOP;
 return 5;
}
function __ZNK10emscripten8internal12WithPoliciesIJEE11ArgTypeListIJvNS0_17AllowedRawPointerI13emOctaTerrainEE4vec34mat4NSt3__26vectorI7ChunkIdNS9_9allocatorISB_EEEEEE8getTypesEv($0) {
 $0 = $0|0;
 var $1 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $1 = (__ZN10emscripten8internal14ArgArrayGetterINS0_8TypeListIJvNS0_17AllowedRawPointerI13emOctaTerrainEE4vec34mat4NSt3__26vectorI7ChunkIdNS8_9allocatorISA_EEEEEEEE3getEv()|0);
 return ($1|0);
}
function __ZN10emscripten8internal10getContextIM13emOctaTerrainFv4vec34mat4NSt3__26vectorI7ChunkIdNS5_9allocatorIS7_EEEEEEEPT_RKSD_($0) {
 $0 = $0|0;
 var $$elt1 = 0, $$repack4 = 0, $$unpack = 0, $$unpack2 = 0, $1 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $1 = (__Znwj(8)|0);
 $$unpack = HEAP32[$0>>2]|0;
 $$elt1 = ((($0)) + 4|0);
 $$unpack2 = HEAP32[$$elt1>>2]|0;
 HEAP32[$1>>2] = $$unpack;
 $$repack4 = ((($1)) + 4|0);
 HEAP32[$$repack4>>2] = $$unpack2;
 return ($1|0);
}
function __ZN10emscripten8internal11BindingTypeIP13emOctaTerrainE12fromWireTypeES3_($0) {
 $0 = $0|0;
 var label = 0, sp = 0;
 sp = STACKTOP;
 return ($0|0);
}
function __ZN10emscripten8internal18GenericBindingTypeI4vec3E12fromWireTypeEPS2_($0) {
 $0 = $0|0;
 var label = 0, sp = 0;
 sp = STACKTOP;
 return ($0|0);
}
function __ZN10emscripten8internal18GenericBindingTypeI4mat4E12fromWireTypeEPS2_($0) {
 $0 = $0|0;
 var label = 0, sp = 0;
 sp = STACKTOP;
 return ($0|0);
}
function __ZN10emscripten8internal18GenericBindingTypeINSt3__26vectorI7ChunkIdNS2_9allocatorIS4_EEEEE12fromWireTypeEPS7_($0) {
 $0 = $0|0;
 var label = 0, sp = 0;
 sp = STACKTOP;
 return ($0|0);
}
function __ZN10emscripten8internal14ArgArrayGetterINS0_8TypeListIJvNS0_17AllowedRawPointerI13emOctaTerrainEE4vec34mat4NSt3__26vectorI7ChunkIdNS8_9allocatorISA_EEEEEEEE3getEv() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 return (764|0);
}
function __ZN10emscripten8internal19getGenericSignatureIJviiiiiEEEPKcv() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 return (1724|0);
}
function __ZN10emscripten8internal13MethodInvokerIM13emOctaTerrainFNSt3__26vectorI7ChunkIdNS3_9allocatorIS5_EEEEvES8_PS2_JEE6invokeERKSA_SB_($0,$1) {
 $0 = $0|0;
 $1 = $1|0;
 var $$elt3 = 0, $$unpack = 0, $$unpack4 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0;
 $2 = sp;
 $$unpack = HEAP32[$0>>2]|0;
 $$elt3 = ((($0)) + 4|0);
 $$unpack4 = HEAP32[$$elt3>>2]|0;
 $3 = (__ZN10emscripten8internal11BindingTypeIP13emOctaTerrainE12fromWireTypeES3_($1)|0);
 $4 = $$unpack4 >> 1;
 $5 = (($3) + ($4)|0);
 $6 = $$unpack4 & 1;
 $7 = ($6|0)==(0);
 if ($7) {
  $11 = $$unpack;
  $12 = $11;
 } else {
  $8 = HEAP32[$5>>2]|0;
  $9 = (($8) + ($$unpack)|0);
  $10 = HEAP32[$9>>2]|0;
  $12 = $10;
 }
 FUNCTION_TABLE_vii[$12 & 7]($2,$5);
 $13 = (__ZN10emscripten8internal18GenericBindingTypeINSt3__26vectorI7ChunkIdNS2_9allocatorIS4_EEEEE10toWireTypeEOS7_($2)|0);
 __ZNSt3__213__vector_baseI7ChunkIdNS_9allocatorIS1_EEED2Ev($2);
 STACKTOP = sp;return ($13|0);
}
function __ZNK10emscripten8internal12WithPoliciesIJEE11ArgTypeListIJNSt3__26vectorI7ChunkIdNS4_9allocatorIS6_EEEENS0_17AllowedRawPointerI13emOctaTerrainEEEE8getCountEv($0) {
 $0 = $0|0;
 var label = 0, sp = 0;
 sp = STACKTOP;
 return 2;
}
function __ZNK10emscripten8internal12WithPoliciesIJEE11ArgTypeListIJNSt3__26vectorI7ChunkIdNS4_9allocatorIS6_EEEENS0_17AllowedRawPointerI13emOctaTerrainEEEE8getTypesEv($0) {
 $0 = $0|0;
 var $1 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $1 = (__ZN10emscripten8internal14ArgArrayGetterINS0_8TypeListIJNSt3__26vectorI7ChunkIdNS3_9allocatorIS5_EEEENS0_17AllowedRawPointerI13emOctaTerrainEEEEEE3getEv()|0);
 return ($1|0);
}
function __ZN10emscripten8internal10getContextIM13emOctaTerrainFNSt3__26vectorI7ChunkIdNS3_9allocatorIS5_EEEEvEEEPT_RKSB_($0) {
 $0 = $0|0;
 var $$elt1 = 0, $$repack4 = 0, $$unpack = 0, $$unpack2 = 0, $1 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $1 = (__Znwj(8)|0);
 $$unpack = HEAP32[$0>>2]|0;
 $$elt1 = ((($0)) + 4|0);
 $$unpack2 = HEAP32[$$elt1>>2]|0;
 HEAP32[$1>>2] = $$unpack;
 $$repack4 = ((($1)) + 4|0);
 HEAP32[$$repack4>>2] = $$unpack2;
 return ($1|0);
}
function __ZN10emscripten8internal18GenericBindingTypeINSt3__26vectorI7ChunkIdNS2_9allocatorIS4_EEEEE10toWireTypeEOS7_($0) {
 $0 = $0|0;
 var $1 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $1 = (__Znwj(12)|0);
 $2 = ((($1)) + 4|0);
 $3 = HEAP32[$0>>2]|0;
 HEAP32[$1>>2] = $3;
 $4 = ((($0)) + 4|0);
 $5 = HEAP32[$4>>2]|0;
 HEAP32[$2>>2] = $5;
 $6 = ((($0)) + 8|0);
 $7 = HEAP32[$6>>2]|0;
 $8 = ((($1)) + 8|0);
 HEAP32[$8>>2] = $7;
 HEAP32[$6>>2] = 0;
 HEAP32[$4>>2] = 0;
 HEAP32[$0>>2] = 0;
 return ($1|0);
}
function __ZN10emscripten8internal14ArgArrayGetterINS0_8TypeListIJNSt3__26vectorI7ChunkIdNS3_9allocatorIS5_EEEENS0_17AllowedRawPointerI13emOctaTerrainEEEEEE3getEv() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 return (784|0);
}
function __ZN10emscripten8internal19getGenericSignatureIJiiiEEEPKcv() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 return (1731|0);
}
function __ZN10emscripten8internal13MethodInvokerIM13emOctaTerrainFNSt3__26vectorI4vec9NS3_9allocatorIS5_EEEEvES8_PS2_JEE6invokeERKSA_SB_($0,$1) {
 $0 = $0|0;
 $1 = $1|0;
 var $$elt3 = 0, $$unpack = 0, $$unpack4 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0;
 $2 = sp;
 $$unpack = HEAP32[$0>>2]|0;
 $$elt3 = ((($0)) + 4|0);
 $$unpack4 = HEAP32[$$elt3>>2]|0;
 $3 = (__ZN10emscripten8internal11BindingTypeIP13emOctaTerrainE12fromWireTypeES3_($1)|0);
 $4 = $$unpack4 >> 1;
 $5 = (($3) + ($4)|0);
 $6 = $$unpack4 & 1;
 $7 = ($6|0)==(0);
 if ($7) {
  $11 = $$unpack;
  $12 = $11;
 } else {
  $8 = HEAP32[$5>>2]|0;
  $9 = (($8) + ($$unpack)|0);
  $10 = HEAP32[$9>>2]|0;
  $12 = $10;
 }
 FUNCTION_TABLE_vii[$12 & 7]($2,$5);
 $13 = (__ZN10emscripten8internal18GenericBindingTypeINSt3__26vectorI4vec9NS2_9allocatorIS4_EEEEE10toWireTypeEOS7_($2)|0);
 __ZNSt3__213__vector_baseI4vec9NS_9allocatorIS1_EEED2Ev($2);
 STACKTOP = sp;return ($13|0);
}
function __ZNK10emscripten8internal12WithPoliciesIJEE11ArgTypeListIJNSt3__26vectorI4vec9NS4_9allocatorIS6_EEEENS0_17AllowedRawPointerI13emOctaTerrainEEEE8getCountEv($0) {
 $0 = $0|0;
 var label = 0, sp = 0;
 sp = STACKTOP;
 return 2;
}
function __ZNK10emscripten8internal12WithPoliciesIJEE11ArgTypeListIJNSt3__26vectorI4vec9NS4_9allocatorIS6_EEEENS0_17AllowedRawPointerI13emOctaTerrainEEEE8getTypesEv($0) {
 $0 = $0|0;
 var $1 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $1 = (__ZN10emscripten8internal14ArgArrayGetterINS0_8TypeListIJNSt3__26vectorI4vec9NS3_9allocatorIS5_EEEENS0_17AllowedRawPointerI13emOctaTerrainEEEEEE3getEv()|0);
 return ($1|0);
}
function __ZN10emscripten8internal10getContextIM13emOctaTerrainFNSt3__26vectorI4vec9NS3_9allocatorIS5_EEEEvEEEPT_RKSB_($0) {
 $0 = $0|0;
 var $$elt1 = 0, $$repack4 = 0, $$unpack = 0, $$unpack2 = 0, $1 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $1 = (__Znwj(8)|0);
 $$unpack = HEAP32[$0>>2]|0;
 $$elt1 = ((($0)) + 4|0);
 $$unpack2 = HEAP32[$$elt1>>2]|0;
 HEAP32[$1>>2] = $$unpack;
 $$repack4 = ((($1)) + 4|0);
 HEAP32[$$repack4>>2] = $$unpack2;
 return ($1|0);
}
function __ZN10emscripten8internal18GenericBindingTypeINSt3__26vectorI4vec9NS2_9allocatorIS4_EEEEE10toWireTypeEOS7_($0) {
 $0 = $0|0;
 var $1 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $1 = (__Znwj(12)|0);
 $2 = ((($1)) + 4|0);
 $3 = HEAP32[$0>>2]|0;
 HEAP32[$1>>2] = $3;
 $4 = ((($0)) + 4|0);
 $5 = HEAP32[$4>>2]|0;
 HEAP32[$2>>2] = $5;
 $6 = ((($0)) + 8|0);
 $7 = HEAP32[$6>>2]|0;
 $8 = ((($1)) + 8|0);
 HEAP32[$8>>2] = $7;
 HEAP32[$6>>2] = 0;
 HEAP32[$4>>2] = 0;
 HEAP32[$0>>2] = 0;
 return ($1|0);
}
function __ZN10emscripten8internal14ArgArrayGetterINS0_8TypeListIJNSt3__26vectorI4vec9NS3_9allocatorIS5_EEEENS0_17AllowedRawPointerI13emOctaTerrainEEEEEE3getEv() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 return (792|0);
}
function __ZN10emscripten8internal11noncopyableC2Ev($0) {
 $0 = $0|0;
 var label = 0, sp = 0;
 sp = STACKTOP;
 return;
}
function __ZN10emscripten8internal15raw_constructorI7ChunkIdJEEEPT_DpNS0_11BindingTypeIT0_E8WireTypeE() {
 var $0 = 0, $1 = 0, $2 = 0, $3 = 0, $4 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = (__Znwj(8)|0);
 $1 = $0;
 $2 = $1;
 HEAP32[$2>>2] = 0;
 $3 = (($1) + 4)|0;
 $4 = $3;
 HEAP32[$4>>2] = 0;
 return ($0|0);
}
function __ZN10emscripten8internal14raw_destructorI7ChunkIdEEvPT_($0) {
 $0 = $0|0;
 var $1 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $1 = ($0|0)==(0|0);
 if ($1) {
  return;
 }
 __ZdlPv($0);
 return;
}
function __ZN10emscripten8internal6TypeIDI7ChunkIdE3getEv() {
 var $0 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = (__ZN10emscripten8internal11LightTypeIDI7ChunkIdE3getEv()|0);
 return ($0|0);
}
function __ZN10emscripten8internal11noncopyableD2Ev($0) {
 $0 = $0|0;
 var label = 0, sp = 0;
 sp = STACKTOP;
 return;
}
function __ZN10emscripten8internal11LightTypeIDI7ChunkIdE3getEv() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 return (184|0);
}
function __ZN10emscripten8internal19getGenericSignatureIJiEEEPKcv() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 return (1836|0);
}
function __ZN10emscripten8internal12MemberAccessI7ChunkIdjE7getWireIS2_EEjRKMS2_jRKT_($0,$1) {
 $0 = $0|0;
 $1 = $1|0;
 var $2 = 0, $3 = 0, $4 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $2 = HEAP32[$0>>2]|0;
 $3 = (($1) + ($2)|0);
 $4 = (__ZN10emscripten8internal11BindingTypeIjE10toWireTypeERKj($3)|0);
 return ($4|0);
}
function __ZN10emscripten8internal12MemberAccessI7ChunkIdjE7setWireIS2_EEvRKMS2_jRT_j($0,$1,$2) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 var $3 = 0, $4 = 0, $5 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $3 = (__ZN10emscripten8internal11BindingTypeIjE12fromWireTypeEj($2)|0);
 $4 = HEAP32[$0>>2]|0;
 $5 = (($1) + ($4)|0);
 HEAP32[$5>>2] = $3;
 return;
}
function __ZN10emscripten8internal6TypeIDIjE3getEv() {
 var $0 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = (__ZN10emscripten8internal11LightTypeIDIjE3getEv()|0);
 return ($0|0);
}
function __ZN10emscripten8internal10getContextIM7ChunkIdjEEPT_RKS4_($0) {
 $0 = $0|0;
 var $1 = 0, $2 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $1 = (__Znwj(4)|0);
 $2 = HEAP32[$0>>2]|0;
 HEAP32[$1>>2] = $2;
 return ($1|0);
}
function __ZN10emscripten8internal11BindingTypeIjE10toWireTypeERKj($0) {
 $0 = $0|0;
 var $1 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $1 = HEAP32[$0>>2]|0;
 return ($1|0);
}
function __ZN10emscripten8internal11BindingTypeIjE12fromWireTypeEj($0) {
 $0 = $0|0;
 var label = 0, sp = 0;
 sp = STACKTOP;
 return ($0|0);
}
function __ZN10emscripten8internal11LightTypeIDIjE3getEv() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 return (648|0);
}
function __ZN10emscripten8internal19getGenericSignatureIJviiiEEEPKcv() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 return (1838|0);
}
function __ZN10emscripten8internal15raw_constructorI4vec3JEEEPT_DpNS0_11BindingTypeIT0_E8WireTypeE() {
 var $0 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = (__Znwj(12)|0);
 ;HEAP32[$0>>2]=0|0;HEAP32[$0+4>>2]=0|0;HEAP32[$0+8>>2]=0|0;
 return ($0|0);
}
function __ZN10emscripten8internal14raw_destructorI4vec3EEvPT_($0) {
 $0 = $0|0;
 var $1 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $1 = ($0|0)==(0|0);
 if ($1) {
  return;
 }
 __ZdlPv($0);
 return;
}
function __ZN10emscripten8internal6TypeIDI4vec3E3getEv() {
 var $0 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = (__ZN10emscripten8internal11LightTypeIDI4vec3E3getEv()|0);
 return ($0|0);
}
function __ZN10emscripten8internal11LightTypeIDI4vec3E3getEv() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 return (64|0);
}
function __ZN10emscripten8internal12get_by_indexI4vec3fEENS0_11BindingTypeIT0_E8WireTypeEiRT_($0,$1) {
 $0 = $0|0;
 $1 = $1|0;
 var $2 = 0, $3 = 0.0, label = 0, sp = 0;
 sp = STACKTOP;
 $2 = (__ZN4vec3ixEj($1,$0)|0);
 $3 = (+__ZN10emscripten8internal11BindingTypeIfE10toWireTypeERKf($2));
 return (+$3);
}
function __ZN10emscripten8internal12set_by_indexI4vec3fEEviRT_NS0_11BindingTypeIT0_E8WireTypeE($0,$1,$2) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = +$2;
 var $3 = 0.0, $4 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $3 = (+__ZN10emscripten8internal11BindingTypeIfE12fromWireTypeEf($2));
 $4 = (__ZN4vec3ixEj($1,$0)|0);
 HEAPF32[$4>>2] = $3;
 return;
}
function __ZN10emscripten8internal6TypeIDIfE3getEv() {
 var $0 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = (__ZN10emscripten8internal11LightTypeIDIfE3getEv()|0);
 return ($0|0);
}
function __ZN10emscripten8internal11BindingTypeIfE10toWireTypeERKf($0) {
 $0 = $0|0;
 var $1 = 0.0, label = 0, sp = 0;
 sp = STACKTOP;
 $1 = +HEAPF32[$0>>2];
 return (+$1);
}
function __ZN10emscripten8internal11LightTypeIDIfE3getEv() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 return (672|0);
}
function __ZN10emscripten8internal19getGenericSignatureIJfiiEEEPKcv() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 return (1843|0);
}
function __ZN10emscripten8internal19getGenericSignatureIJviifEEEPKcv() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 return (1847|0);
}
function __ZN10emscripten8internal15raw_constructorI4vec9JEEEPT_DpNS0_11BindingTypeIT0_E8WireTypeE() {
 var $0 = 0, dest = 0, label = 0, sp = 0, stop = 0;
 sp = STACKTOP;
 $0 = (__Znwj(36)|0);
 dest=$0; stop=dest+36|0; do { HEAP32[dest>>2]=0|0; dest=dest+4|0; } while ((dest|0) < (stop|0));
 return ($0|0);
}
function __ZN10emscripten8internal14raw_destructorI4vec9EEvPT_($0) {
 $0 = $0|0;
 var $1 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $1 = ($0|0)==(0|0);
 if ($1) {
  return;
 }
 __ZdlPv($0);
 return;
}
function __ZN10emscripten8internal6TypeIDI4vec9E3getEv() {
 var $0 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = (__ZN10emscripten8internal11LightTypeIDI4vec9E3getEv()|0);
 return ($0|0);
}
function __ZN10emscripten8internal11LightTypeIDI4vec9E3getEv() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 return (192|0);
}
function __ZN10emscripten8internal12get_by_indexI4vec9fEENS0_11BindingTypeIT0_E8WireTypeEiRT_($0,$1) {
 $0 = $0|0;
 $1 = $1|0;
 var $2 = 0, $3 = 0.0, label = 0, sp = 0;
 sp = STACKTOP;
 $2 = (__ZN4vec9ixEj($1,$0)|0);
 $3 = (+__ZN10emscripten8internal11BindingTypeIfE10toWireTypeERKf($2));
 return (+$3);
}
function __ZN10emscripten8internal12set_by_indexI4vec9fEEviRT_NS0_11BindingTypeIT0_E8WireTypeE($0,$1,$2) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = +$2;
 var $3 = 0.0, $4 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $3 = (+__ZN10emscripten8internal11BindingTypeIfE12fromWireTypeEf($2));
 $4 = (__ZN4vec9ixEj($1,$0)|0);
 HEAPF32[$4>>2] = $3;
 return;
}
function __ZN4vec9ixEj($0,$1) {
 $0 = $0|0;
 $1 = $1|0;
 var $2 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $2 = (($0) + ($1<<2)|0);
 return ($2|0);
}
function __ZN10emscripten8internal15raw_constructorI4mat4JEEEPT_DpNS0_11BindingTypeIT0_E8WireTypeE() {
 var $0 = 0, dest = 0, label = 0, sp = 0, stop = 0;
 sp = STACKTOP;
 $0 = (__Znwj(64)|0);
 dest=$0; stop=dest+64|0; do { HEAP32[dest>>2]=0|0; dest=dest+4|0; } while ((dest|0) < (stop|0));
 return ($0|0);
}
function __ZN10emscripten8internal14raw_destructorI4mat4EEvPT_($0) {
 $0 = $0|0;
 var $1 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $1 = ($0|0)==(0|0);
 if ($1) {
  return;
 }
 __ZdlPv($0);
 return;
}
function __ZN10emscripten8internal6TypeIDI4mat4E3getEv() {
 var $0 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = (__ZN10emscripten8internal11LightTypeIDI4mat4E3getEv()|0);
 return ($0|0);
}
function __ZN10emscripten8internal11LightTypeIDI4mat4E3getEv() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 return (72|0);
}
function __ZN10emscripten8internal12get_by_indexI4mat4fEENS0_11BindingTypeIT0_E8WireTypeEiRT_($0,$1) {
 $0 = $0|0;
 $1 = $1|0;
 var $2 = 0, $3 = 0.0, label = 0, sp = 0;
 sp = STACKTOP;
 $2 = (__ZN4mat4ixEj($1,$0)|0);
 $3 = (+__ZN10emscripten8internal11BindingTypeIfE10toWireTypeERKf($2));
 return (+$3);
}
function __ZN10emscripten8internal12set_by_indexI4mat4fEEviRT_NS0_11BindingTypeIT0_E8WireTypeE($0,$1,$2) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = +$2;
 var $3 = 0.0, $4 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $3 = (+__ZN10emscripten8internal11BindingTypeIfE12fromWireTypeEf($2));
 $4 = (__ZN4mat4ixEj($1,$0)|0);
 HEAPF32[$4>>2] = $3;
 return;
}
function __ZNSt3__26vectorI7ChunkIdNS_9allocatorIS1_EEE9push_backERKS1_($0,$1) {
 $0 = $0|0;
 $1 = $1|0;
 var $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0;
 var sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0;
 $2 = sp;
 $3 = ((($0)) + 4|0);
 $4 = HEAP32[$3>>2]|0;
 $5 = ((($0)) + 8|0);
 $6 = HEAP32[$5>>2]|0;
 $7 = ($4|0)==($6|0);
 if ($7) {
  __ZNSt3__26vectorI7ChunkIdNS_9allocatorIS1_EEE21__push_back_slow_pathIRKS1_EEvOT_($0,$1);
  STACKTOP = sp;return;
 } else {
  __ZNSt3__26vectorI7ChunkIdNS_9allocatorIS1_EEE24__RAII_IncreaseAnnotatorC2ERKS4_j($2,$0,1);
  $8 = HEAP32[$3>>2]|0;
  $9 = $1;
  $10 = $9;
  $11 = HEAP32[$10>>2]|0;
  $12 = (($9) + 4)|0;
  $13 = $12;
  $14 = HEAP32[$13>>2]|0;
  $15 = $8;
  $16 = $15;
  HEAP32[$16>>2] = $11;
  $17 = (($15) + 4)|0;
  $18 = $17;
  HEAP32[$18>>2] = $14;
  __ZNSt3__26vectorI7ChunkIdNS_9allocatorIS1_EEE24__RAII_IncreaseAnnotator6__doneEv($2);
  $19 = HEAP32[$3>>2]|0;
  $20 = ((($19)) + 8|0);
  HEAP32[$3>>2] = $20;
  STACKTOP = sp;return;
 }
}
function __ZNSt3__26vectorI7ChunkIdNS_9allocatorIS1_EEE6resizeEjRKS1_($0,$1,$2) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 var $$cast$i = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, $scevgep$i$i = 0, $scevgep4$i$i = 0, label = 0;
 var sp = 0;
 sp = STACKTOP;
 $3 = ((($0)) + 4|0);
 $4 = HEAP32[$3>>2]|0;
 $5 = HEAP32[$0>>2]|0;
 $6 = (($4) - ($5))|0;
 $7 = $6 >> 3;
 $8 = ($7>>>0)<($1>>>0);
 if ($8) {
  $9 = (($1) - ($7))|0;
  __ZNSt3__26vectorI7ChunkIdNS_9allocatorIS1_EEE8__appendEjRKS1_($0,$9,$2);
  return;
 }
 $10 = ($7>>>0)>($1>>>0);
 if (!($10)) {
  return;
 }
 $11 = HEAP32[$0>>2]|0;
 $12 = (($11) + ($1<<3)|0);
 $$cast$i = $4;
 $13 = ($$cast$i|0)==($12|0);
 if (!($13)) {
  $scevgep$i$i = ((($$cast$i)) + -8|0);
  $14 = $scevgep$i$i;
  $15 = $12;
  $16 = (($14) - ($15))|0;
  $17 = $16 >>> 3;
  $18 = $17 ^ -1;
  $scevgep4$i$i = (($$cast$i) + ($18<<3)|0);
  HEAP32[$3>>2] = $scevgep4$i$i;
 }
 __ZNKSt3__26vectorI7ChunkIdNS_9allocatorIS1_EEE17__annotate_shrinkEj($0,$7);
 return;
}
function __ZN10emscripten8internal12VectorAccessINSt3__26vectorI7ChunkIdNS2_9allocatorIS4_EEEEE3getERKS7_j($0,$1) {
 $0 = $0|0;
 $1 = $1|0;
 var $10 = 0, $11 = 0, $12 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0;
 $2 = sp;
 $3 = ((($0)) + 4|0);
 $4 = HEAP32[$3>>2]|0;
 $5 = HEAP32[$0>>2]|0;
 $6 = (($4) - ($5))|0;
 $7 = $6 >> 3;
 $8 = ($7>>>0)>($1>>>0);
 if ($8) {
  $9 = HEAP32[$0>>2]|0;
  $10 = (($9) + ($1<<3)|0);
  __ZN10emscripten3valC2IRK7ChunkIdEEOT_($2,$10);
  $12 = HEAP32[$2>>2]|0;
  STACKTOP = sp;return ($12|0);
 } else {
  $11 = (__ZN10emscripten3val9undefinedEv()|0);
  HEAP32[$2>>2] = $11;
  $12 = HEAP32[$2>>2]|0;
  STACKTOP = sp;return ($12|0);
 }
 return (0)|0;
}
function __ZN10emscripten8internal12VectorAccessINSt3__26vectorI7ChunkIdNS2_9allocatorIS4_EEEEE3setERS7_jRKS4_($0,$1,$2) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 var $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $3 = HEAP32[$0>>2]|0;
 $4 = (($3) + ($1<<3)|0);
 $5 = $2;
 $6 = $5;
 $7 = HEAP32[$6>>2]|0;
 $8 = (($5) + 4)|0;
 $9 = $8;
 $10 = HEAP32[$9>>2]|0;
 $11 = $4;
 $12 = $11;
 HEAP32[$12>>2] = $7;
 $13 = (($11) + 4)|0;
 $14 = $13;
 HEAP32[$14>>2] = $10;
 return 1;
}
function __ZNSt3__26vectorI7ChunkIdNS_9allocatorIS1_EEE21__push_back_slow_pathIRKS1_EEvOT_($0,$1) {
 $0 = $0|0;
 $1 = $1|0;
 var $$0$i = 0, $$sroa$speculated$i = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0;
 var $27 = 0, $28 = 0, $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 32|0;
 $2 = sp;
 $3 = ((($0)) + 8|0);
 $4 = ((($0)) + 4|0);
 $5 = HEAP32[$4>>2]|0;
 $6 = HEAP32[$0>>2]|0;
 $7 = (($5) - ($6))|0;
 $8 = $7 >> 3;
 $9 = (($8) + 1)|0;
 $10 = (__ZNKSt3__26vectorI7ChunkIdNS_9allocatorIS1_EEE8max_sizeEv($0)|0);
 $11 = ($10>>>0)<($9>>>0);
 if ($11) {
  __ZNKSt3__220__vector_base_commonILb1EE20__throw_length_errorEv($0);
  // unreachable;
 } else {
  $12 = ((($0)) + 8|0);
  $13 = HEAP32[$12>>2]|0;
  $14 = HEAP32[$0>>2]|0;
  $15 = (($13) - ($14))|0;
  $16 = $15 >> 3;
  $17 = $10 >>> 1;
  $18 = ($16>>>0)<($17>>>0);
  $19 = $15 >> 2;
  $20 = ($19>>>0)<($9>>>0);
  $$sroa$speculated$i = $20 ? $9 : $19;
  $$0$i = $18 ? $$sroa$speculated$i : $10;
  $21 = HEAP32[$4>>2]|0;
  $22 = (($21) - ($14))|0;
  $23 = $22 >> 3;
  __ZNSt3__214__split_bufferI7ChunkIdRNS_9allocatorIS1_EEEC2EjjS4_($2,$$0$i,$23,$3);
  $24 = ((($2)) + 8|0);
  $25 = HEAP32[$24>>2]|0;
  $26 = $1;
  $27 = $26;
  $28 = HEAP32[$27>>2]|0;
  $29 = (($26) + 4)|0;
  $30 = $29;
  $31 = HEAP32[$30>>2]|0;
  $32 = $25;
  $33 = $32;
  HEAP32[$33>>2] = $28;
  $34 = (($32) + 4)|0;
  $35 = $34;
  HEAP32[$35>>2] = $31;
  $36 = HEAP32[$24>>2]|0;
  $37 = ((($36)) + 8|0);
  HEAP32[$24>>2] = $37;
  __ZNSt3__26vectorI7ChunkIdNS_9allocatorIS1_EEE26__swap_out_circular_bufferERNS_14__split_bufferIS1_RS3_EE($0,$2);
  __ZNSt3__214__split_bufferI7ChunkIdRNS_9allocatorIS1_EEED2Ev($2);
  STACKTOP = sp;return;
 }
}
function __ZNSt3__26vectorI7ChunkIdNS_9allocatorIS1_EEE8__appendEjRKS1_($0,$1,$2) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 var $$0$i = 0, $$0$i11 = 0, $$sroa$speculated$i = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0;
 var $27 = 0, $28 = 0, $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0, $41 = 0, $42 = 0, $43 = 0, $44 = 0;
 var $45 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 32|0;
 $3 = sp;
 $4 = ((($0)) + 8|0);
 $5 = HEAP32[$4>>2]|0;
 $6 = ((($0)) + 4|0);
 $7 = HEAP32[$6>>2]|0;
 $8 = (($5) - ($7))|0;
 $9 = $8 >> 3;
 $10 = ($9>>>0)<($1>>>0);
 if (!($10)) {
  $$0$i = $1;
  while(1) {
   __ZNSt3__26vectorI7ChunkIdNS_9allocatorIS1_EEE24__RAII_IncreaseAnnotatorC2ERKS4_j($3,$0,1);
   $11 = HEAP32[$6>>2]|0;
   $12 = $2;
   $13 = $12;
   $14 = HEAP32[$13>>2]|0;
   $15 = (($12) + 4)|0;
   $16 = $15;
   $17 = HEAP32[$16>>2]|0;
   $18 = $11;
   $19 = $18;
   HEAP32[$19>>2] = $14;
   $20 = (($18) + 4)|0;
   $21 = $20;
   HEAP32[$21>>2] = $17;
   $22 = HEAP32[$6>>2]|0;
   $23 = ((($22)) + 8|0);
   HEAP32[$6>>2] = $23;
   $24 = (($$0$i) + -1)|0;
   __ZNSt3__26vectorI7ChunkIdNS_9allocatorIS1_EEE24__RAII_IncreaseAnnotator6__doneEv($3);
   $25 = ($24|0)==(0);
   if ($25) {
    break;
   } else {
    $$0$i = $24;
   }
  }
  STACKTOP = sp;return;
 }
 $26 = ((($0)) + 8|0);
 $27 = HEAP32[$6>>2]|0;
 $28 = HEAP32[$0>>2]|0;
 $29 = (($27) - ($28))|0;
 $30 = $29 >> 3;
 $31 = (($30) + ($1))|0;
 $32 = (__ZNKSt3__26vectorI7ChunkIdNS_9allocatorIS1_EEE8max_sizeEv($0)|0);
 $33 = ($32>>>0)<($31>>>0);
 if ($33) {
  __ZNKSt3__220__vector_base_commonILb1EE20__throw_length_errorEv($0);
  // unreachable;
 }
 $34 = ((($0)) + 8|0);
 $35 = HEAP32[$34>>2]|0;
 $36 = HEAP32[$0>>2]|0;
 $37 = (($35) - ($36))|0;
 $38 = $37 >> 3;
 $39 = $32 >>> 1;
 $40 = ($38>>>0)<($39>>>0);
 $41 = $37 >> 2;
 $42 = ($41>>>0)<($31>>>0);
 $$sroa$speculated$i = $42 ? $31 : $41;
 $$0$i11 = $40 ? $$sroa$speculated$i : $32;
 $43 = HEAP32[$6>>2]|0;
 $44 = (($43) - ($36))|0;
 $45 = $44 >> 3;
 __ZNSt3__214__split_bufferI7ChunkIdRNS_9allocatorIS1_EEEC2EjjS4_($3,$$0$i11,$45,$26);
 __ZNSt3__214__split_bufferI7ChunkIdRNS_9allocatorIS1_EEE18__construct_at_endEjRKS1_($3,$1,$2);
 __ZNSt3__26vectorI7ChunkIdNS_9allocatorIS1_EEE26__swap_out_circular_bufferERNS_14__split_bufferIS1_RS3_EE($0,$3);
 __ZNSt3__214__split_bufferI7ChunkIdRNS_9allocatorIS1_EEED2Ev($3);
 STACKTOP = sp;return;
}
function __ZNSt3__214__split_bufferI7ChunkIdRNS_9allocatorIS1_EEE18__construct_at_endEjRKS1_($0,$1,$2) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 var $$0 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $3 = ((($0)) + 8|0);
 $$0 = $1;
 while(1) {
  $4 = HEAP32[$3>>2]|0;
  $5 = $2;
  $6 = $5;
  $7 = HEAP32[$6>>2]|0;
  $8 = (($5) + 4)|0;
  $9 = $8;
  $10 = HEAP32[$9>>2]|0;
  $11 = $4;
  $12 = $11;
  HEAP32[$12>>2] = $7;
  $13 = (($11) + 4)|0;
  $14 = $13;
  HEAP32[$14>>2] = $10;
  $15 = HEAP32[$3>>2]|0;
  $16 = ((($15)) + 8|0);
  HEAP32[$3>>2] = $16;
  $17 = (($$0) + -1)|0;
  $18 = ($17|0)==(0);
  if ($18) {
   break;
  } else {
   $$0 = $17;
  }
 }
 return;
}
function __ZNKSt3__26vectorI7ChunkIdNS_9allocatorIS1_EEE17__annotate_shrinkEj($0,$1) {
 $0 = $0|0;
 $1 = $1|0;
 var $$cast = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $2 = HEAP32[$0>>2]|0;
 $3 = ((($0)) + 8|0);
 $4 = HEAP32[$3>>2]|0;
 $$cast = $2;
 $5 = (($4) - ($$cast))|0;
 $6 = $5 >> 3;
 $7 = (($2) + ($6<<3)|0);
 $8 = (($2) + ($1<<3)|0);
 $9 = ((($0)) + 4|0);
 $10 = HEAP32[$9>>2]|0;
 $11 = (($10) - ($$cast))|0;
 $12 = $11 >> 3;
 $13 = (($2) + ($12<<3)|0);
 __ZNKSt3__26vectorI7ChunkIdNS_9allocatorIS1_EEE31__annotate_contiguous_containerEPKvS6_S6_S6_($0,$2,$7,$8,$13);
 return;
}
function __ZN10emscripten8internal11NoBaseClass6verifyINSt3__26vectorI7ChunkIdNS3_9allocatorIS5_EEEEEEvv() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 return;
}
function __ZN10emscripten8internal13getActualTypeINSt3__26vectorI7ChunkIdNS2_9allocatorIS4_EEEEEEPKvPT_($0) {
 $0 = $0|0;
 var $1 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $1 = (__ZN10emscripten8internal14getLightTypeIDINSt3__26vectorI7ChunkIdNS2_9allocatorIS4_EEEEEEPKvRKT_($0)|0);
 return ($1|0);
}
function __ZN10emscripten8internal11NoBaseClass11getUpcasterINSt3__26vectorI7ChunkIdNS3_9allocatorIS5_EEEEEEPFvvEv() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 return (0|0);
}
function __ZN10emscripten8internal11NoBaseClass13getDowncasterINSt3__26vectorI7ChunkIdNS3_9allocatorIS5_EEEEEEPFvvEv() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 return (0|0);
}
function __ZN10emscripten8internal14raw_destructorINSt3__26vectorI7ChunkIdNS2_9allocatorIS4_EEEEEEvPT_($0) {
 $0 = $0|0;
 var $1 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $1 = ($0|0)==(0|0);
 if ($1) {
  return;
 }
 __ZNSt3__213__vector_baseI7ChunkIdNS_9allocatorIS1_EEED2Ev($0);
 __ZdlPv($0);
 return;
}
function __ZN10emscripten8internal6TypeIDINSt3__26vectorI7ChunkIdNS2_9allocatorIS4_EEEEE3getEv() {
 var $0 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = (__ZN10emscripten8internal11LightTypeIDINSt3__26vectorI7ChunkIdNS2_9allocatorIS4_EEEEE3getEv()|0);
 return ($0|0);
}
function __ZN10emscripten8internal6TypeIDINS0_17AllowedRawPointerINSt3__26vectorI7ChunkIdNS3_9allocatorIS5_EEEEEEE3getEv() {
 var $0 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = (__ZN10emscripten8internal11LightTypeIDIPNSt3__26vectorI7ChunkIdNS2_9allocatorIS4_EEEEE3getEv()|0);
 return ($0|0);
}
function __ZN10emscripten8internal6TypeIDINS0_17AllowedRawPointerIKNSt3__26vectorI7ChunkIdNS3_9allocatorIS5_EEEEEEE3getEv() {
 var $0 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = (__ZN10emscripten8internal11LightTypeIDIPKNSt3__26vectorI7ChunkIdNS2_9allocatorIS4_EEEEE3getEv()|0);
 return ($0|0);
}
function __ZN10emscripten8internal14getLightTypeIDINSt3__26vectorI7ChunkIdNS2_9allocatorIS4_EEEEEEPKvRKT_($0) {
 $0 = $0|0;
 var label = 0, sp = 0;
 sp = STACKTOP;
 return (112|0);
}
function __ZN10emscripten8internal11LightTypeIDINSt3__26vectorI7ChunkIdNS2_9allocatorIS4_EEEEE3getEv() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 return (112|0);
}
function __ZN10emscripten8internal11LightTypeIDIPNSt3__26vectorI7ChunkIdNS2_9allocatorIS4_EEEEE3getEv() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 return (200|0);
}
function __ZN10emscripten8internal11LightTypeIDIPKNSt3__26vectorI7ChunkIdNS2_9allocatorIS4_EEEEE3getEv() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 return (216|0);
}
function __ZN10emscripten8internal12operator_newINSt3__26vectorI7ChunkIdNS2_9allocatorIS4_EEEEJEEEPT_DpOT0_() {
 var $0 = 0, $1 = 0, $2 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = (__Znwj(12)|0);
 HEAP32[$0>>2] = 0;
 $1 = ((($0)) + 4|0);
 HEAP32[$1>>2] = 0;
 $2 = ((($0)) + 8|0);
 HEAP32[$2>>2] = 0;
 return ($0|0);
}
function __ZN10emscripten8internal7InvokerIPNSt3__26vectorI7ChunkIdNS2_9allocatorIS4_EEEEJEE6invokeEPFS8_vE($0) {
 $0 = $0|0;
 var $1 = 0, $2 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $1 = (FUNCTION_TABLE_i[$0 & 7]()|0);
 $2 = (__ZN10emscripten8internal11BindingTypeIPNSt3__26vectorI7ChunkIdNS2_9allocatorIS4_EEEEE10toWireTypeES8_($1)|0);
 return ($2|0);
}
function __ZNK10emscripten8internal12WithPoliciesIJNS_18allow_raw_pointersEEE11ArgTypeListIJPNSt3__26vectorI7ChunkIdNS5_9allocatorIS7_EEEEEE8getCountEv($0) {
 $0 = $0|0;
 var label = 0, sp = 0;
 sp = STACKTOP;
 return 1;
}
function __ZNK10emscripten8internal12WithPoliciesIJNS_18allow_raw_pointersEEE11ArgTypeListIJPNSt3__26vectorI7ChunkIdNS5_9allocatorIS7_EEEEEE8getTypesEv($0) {
 $0 = $0|0;
 var $1 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $1 = (__ZN10emscripten8internal14ArgArrayGetterINS0_8TypeListIJNS0_17AllowedRawPointerINSt3__26vectorI7ChunkIdNS4_9allocatorIS6_EEEEEEEEEE3getEv()|0);
 return ($1|0);
}
function __ZN10emscripten8internal11BindingTypeIPNSt3__26vectorI7ChunkIdNS2_9allocatorIS4_EEEEE10toWireTypeES8_($0) {
 $0 = $0|0;
 var label = 0, sp = 0;
 sp = STACKTOP;
 return ($0|0);
}
function __ZN10emscripten8internal14ArgArrayGetterINS0_8TypeListIJNS0_17AllowedRawPointerINSt3__26vectorI7ChunkIdNS4_9allocatorIS6_EEEEEEEEEE3getEv() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 return (800|0);
}
function __ZN10emscripten8internal13MethodInvokerIMNSt3__26vectorI7ChunkIdNS2_9allocatorIS4_EEEEFvRKS4_EvPS7_JS9_EE6invokeERKSB_SC_PS4_($0,$1,$2) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 var $$elt3 = 0, $$unpack = 0, $$unpack4 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $$unpack = HEAP32[$0>>2]|0;
 $$elt3 = ((($0)) + 4|0);
 $$unpack4 = HEAP32[$$elt3>>2]|0;
 $3 = (__ZN10emscripten8internal11BindingTypeIPNSt3__26vectorI7ChunkIdNS2_9allocatorIS4_EEEEE12fromWireTypeES8_($1)|0);
 $4 = $$unpack4 >> 1;
 $5 = (($3) + ($4)|0);
 $6 = $$unpack4 & 1;
 $7 = ($6|0)==(0);
 if ($7) {
  $11 = $$unpack;
  $13 = $11;
 } else {
  $8 = HEAP32[$5>>2]|0;
  $9 = (($8) + ($$unpack)|0);
  $10 = HEAP32[$9>>2]|0;
  $13 = $10;
 }
 $12 = (__ZN10emscripten8internal18GenericBindingTypeI7ChunkIdE12fromWireTypeEPS2_($2)|0);
 FUNCTION_TABLE_vii[$13 & 7]($5,$12);
 return;
}
function __ZNK10emscripten8internal12WithPoliciesIJEE11ArgTypeListIJvNS0_17AllowedRawPointerINSt3__26vectorI7ChunkIdNS5_9allocatorIS7_EEEEEERKS7_EE8getCountEv($0) {
 $0 = $0|0;
 var label = 0, sp = 0;
 sp = STACKTOP;
 return 3;
}
function __ZNK10emscripten8internal12WithPoliciesIJEE11ArgTypeListIJvNS0_17AllowedRawPointerINSt3__26vectorI7ChunkIdNS5_9allocatorIS7_EEEEEERKS7_EE8getTypesEv($0) {
 $0 = $0|0;
 var $1 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $1 = (__ZN10emscripten8internal14ArgArrayGetterINS0_8TypeListIJvNS0_17AllowedRawPointerINSt3__26vectorI7ChunkIdNS4_9allocatorIS6_EEEEEERKS6_EEEE3getEv()|0);
 return ($1|0);
}
function __ZN10emscripten8internal10getContextIMNSt3__26vectorI7ChunkIdNS2_9allocatorIS4_EEEEFvRKS4_EEEPT_RKSC_($0) {
 $0 = $0|0;
 var $$elt1 = 0, $$repack4 = 0, $$unpack = 0, $$unpack2 = 0, $1 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $1 = (__Znwj(8)|0);
 $$unpack = HEAP32[$0>>2]|0;
 $$elt1 = ((($0)) + 4|0);
 $$unpack2 = HEAP32[$$elt1>>2]|0;
 HEAP32[$1>>2] = $$unpack;
 $$repack4 = ((($1)) + 4|0);
 HEAP32[$$repack4>>2] = $$unpack2;
 return ($1|0);
}
function __ZN10emscripten8internal11BindingTypeIPNSt3__26vectorI7ChunkIdNS2_9allocatorIS4_EEEEE12fromWireTypeES8_($0) {
 $0 = $0|0;
 var label = 0, sp = 0;
 sp = STACKTOP;
 return ($0|0);
}
function __ZN10emscripten8internal18GenericBindingTypeI7ChunkIdE12fromWireTypeEPS2_($0) {
 $0 = $0|0;
 var label = 0, sp = 0;
 sp = STACKTOP;
 return ($0|0);
}
function __ZN10emscripten8internal14ArgArrayGetterINS0_8TypeListIJvNS0_17AllowedRawPointerINSt3__26vectorI7ChunkIdNS4_9allocatorIS6_EEEEEERKS6_EEEE3getEv() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 return (804|0);
}
function __ZN10emscripten8internal13MethodInvokerIMNSt3__26vectorI7ChunkIdNS2_9allocatorIS4_EEEEFvjRKS4_EvPS7_JjS9_EE6invokeERKSB_SC_jPS4_($0,$1,$2,$3) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 $3 = $3|0;
 var $$elt3 = 0, $$unpack = 0, $$unpack4 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $$unpack = HEAP32[$0>>2]|0;
 $$elt3 = ((($0)) + 4|0);
 $$unpack4 = HEAP32[$$elt3>>2]|0;
 $4 = (__ZN10emscripten8internal11BindingTypeIPNSt3__26vectorI7ChunkIdNS2_9allocatorIS4_EEEEE12fromWireTypeES8_($1)|0);
 $5 = $$unpack4 >> 1;
 $6 = (($4) + ($5)|0);
 $7 = $$unpack4 & 1;
 $8 = ($7|0)==(0);
 if ($8) {
  $12 = $$unpack;
  $15 = $12;
 } else {
  $9 = HEAP32[$6>>2]|0;
  $10 = (($9) + ($$unpack)|0);
  $11 = HEAP32[$10>>2]|0;
  $15 = $11;
 }
 $13 = (__ZN10emscripten8internal11BindingTypeIjE12fromWireTypeEj($2)|0);
 $14 = (__ZN10emscripten8internal18GenericBindingTypeI7ChunkIdE12fromWireTypeEPS2_($3)|0);
 FUNCTION_TABLE_viii[$15 & 7]($6,$13,$14);
 return;
}
function __ZNK10emscripten8internal12WithPoliciesIJEE11ArgTypeListIJvNS0_17AllowedRawPointerINSt3__26vectorI7ChunkIdNS5_9allocatorIS7_EEEEEEjRKS7_EE8getCountEv($0) {
 $0 = $0|0;
 var label = 0, sp = 0;
 sp = STACKTOP;
 return 4;
}
function __ZNK10emscripten8internal12WithPoliciesIJEE11ArgTypeListIJvNS0_17AllowedRawPointerINSt3__26vectorI7ChunkIdNS5_9allocatorIS7_EEEEEEjRKS7_EE8getTypesEv($0) {
 $0 = $0|0;
 var $1 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $1 = (__ZN10emscripten8internal14ArgArrayGetterINS0_8TypeListIJvNS0_17AllowedRawPointerINSt3__26vectorI7ChunkIdNS4_9allocatorIS6_EEEEEEjRKS6_EEEE3getEv()|0);
 return ($1|0);
}
function __ZN10emscripten8internal10getContextIMNSt3__26vectorI7ChunkIdNS2_9allocatorIS4_EEEEFvjRKS4_EEEPT_RKSC_($0) {
 $0 = $0|0;
 var $$elt1 = 0, $$repack4 = 0, $$unpack = 0, $$unpack2 = 0, $1 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $1 = (__Znwj(8)|0);
 $$unpack = HEAP32[$0>>2]|0;
 $$elt1 = ((($0)) + 4|0);
 $$unpack2 = HEAP32[$$elt1>>2]|0;
 HEAP32[$1>>2] = $$unpack;
 $$repack4 = ((($1)) + 4|0);
 HEAP32[$$repack4>>2] = $$unpack2;
 return ($1|0);
}
function __ZN10emscripten8internal14ArgArrayGetterINS0_8TypeListIJvNS0_17AllowedRawPointerINSt3__26vectorI7ChunkIdNS4_9allocatorIS6_EEEEEEjRKS6_EEEE3getEv() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 return (816|0);
}
function __ZN10emscripten8internal19getGenericSignatureIJviiiiEEEPKcv() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 return (1981|0);
}
function __ZN10emscripten8internal13MethodInvokerIMNSt3__26vectorI7ChunkIdNS2_9allocatorIS4_EEEEKFjvEjPKS7_JEE6invokeERKS9_SB_($0,$1) {
 $0 = $0|0;
 $1 = $1|0;
 var $$elt2 = 0, $$unpack = 0, $$unpack3 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0;
 $2 = sp;
 $$unpack = HEAP32[$0>>2]|0;
 $$elt2 = ((($0)) + 4|0);
 $$unpack3 = HEAP32[$$elt2>>2]|0;
 $3 = (__ZN10emscripten8internal11BindingTypeIPKNSt3__26vectorI7ChunkIdNS2_9allocatorIS4_EEEEE12fromWireTypeES9_($1)|0);
 $4 = $$unpack3 >> 1;
 $5 = (($3) + ($4)|0);
 $6 = $$unpack3 & 1;
 $7 = ($6|0)==(0);
 if ($7) {
  $11 = $$unpack;
  $12 = $11;
 } else {
  $8 = HEAP32[$5>>2]|0;
  $9 = (($8) + ($$unpack)|0);
  $10 = HEAP32[$9>>2]|0;
  $12 = $10;
 }
 $13 = (FUNCTION_TABLE_ii[$12 & 15]($5)|0);
 HEAP32[$2>>2] = $13;
 $14 = (__ZN10emscripten8internal11BindingTypeIjE10toWireTypeERKj($2)|0);
 STACKTOP = sp;return ($14|0);
}
function __ZNK10emscripten8internal12WithPoliciesIJEE11ArgTypeListIJjNS0_17AllowedRawPointerIKNSt3__26vectorI7ChunkIdNS5_9allocatorIS7_EEEEEEEE8getCountEv($0) {
 $0 = $0|0;
 var label = 0, sp = 0;
 sp = STACKTOP;
 return 2;
}
function __ZNK10emscripten8internal12WithPoliciesIJEE11ArgTypeListIJjNS0_17AllowedRawPointerIKNSt3__26vectorI7ChunkIdNS5_9allocatorIS7_EEEEEEEE8getTypesEv($0) {
 $0 = $0|0;
 var $1 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $1 = (__ZN10emscripten8internal14ArgArrayGetterINS0_8TypeListIJjNS0_17AllowedRawPointerIKNSt3__26vectorI7ChunkIdNS4_9allocatorIS6_EEEEEEEEEE3getEv()|0);
 return ($1|0);
}
function __ZN10emscripten8internal10getContextIMNSt3__26vectorI7ChunkIdNS2_9allocatorIS4_EEEEKFjvEEEPT_RKSA_($0) {
 $0 = $0|0;
 var $$elt1 = 0, $$repack4 = 0, $$unpack = 0, $$unpack2 = 0, $1 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $1 = (__Znwj(8)|0);
 $$unpack = HEAP32[$0>>2]|0;
 $$elt1 = ((($0)) + 4|0);
 $$unpack2 = HEAP32[$$elt1>>2]|0;
 HEAP32[$1>>2] = $$unpack;
 $$repack4 = ((($1)) + 4|0);
 HEAP32[$$repack4>>2] = $$unpack2;
 return ($1|0);
}
function __ZN10emscripten8internal11BindingTypeIPKNSt3__26vectorI7ChunkIdNS2_9allocatorIS4_EEEEE12fromWireTypeES9_($0) {
 $0 = $0|0;
 var label = 0, sp = 0;
 sp = STACKTOP;
 return ($0|0);
}
function __ZN10emscripten8internal14ArgArrayGetterINS0_8TypeListIJjNS0_17AllowedRawPointerIKNSt3__26vectorI7ChunkIdNS4_9allocatorIS6_EEEEEEEEEE3getEv() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 return (832|0);
}
function __ZN10emscripten8internal15FunctionInvokerIPFNS_3valERKNSt3__26vectorI7ChunkIdNS3_9allocatorIS5_EEEEjES2_SA_JjEE6invokeEPSC_PS8_j($0,$1,$2) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 var $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0;
 $3 = sp;
 $4 = HEAP32[$0>>2]|0;
 $5 = (__ZN10emscripten8internal18GenericBindingTypeINSt3__26vectorI7ChunkIdNS2_9allocatorIS4_EEEEE12fromWireTypeEPS7_($1)|0);
 $6 = (__ZN10emscripten8internal11BindingTypeIjE12fromWireTypeEj($2)|0);
 $7 = (FUNCTION_TABLE_iii[$4 & 7]($5,$6)|0);
 HEAP32[$3>>2] = $7;
 $8 = (__ZN10emscripten8internal11BindingTypeINS_3valEE10toWireTypeERKS2_($3)|0);
 __ZN10emscripten3valD2Ev($3);
 STACKTOP = sp;return ($8|0);
}
function __ZNK10emscripten8internal12WithPoliciesIJEE11ArgTypeListIJNS_3valERKNSt3__26vectorI7ChunkIdNS5_9allocatorIS7_EEEEjEE8getCountEv($0) {
 $0 = $0|0;
 var label = 0, sp = 0;
 sp = STACKTOP;
 return 3;
}
function __ZNK10emscripten8internal12WithPoliciesIJEE11ArgTypeListIJNS_3valERKNSt3__26vectorI7ChunkIdNS5_9allocatorIS7_EEEEjEE8getTypesEv($0) {
 $0 = $0|0;
 var $1 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $1 = (__ZN10emscripten8internal14ArgArrayGetterINS0_8TypeListIJNS_3valERKNSt3__26vectorI7ChunkIdNS4_9allocatorIS6_EEEEjEEEE3getEv()|0);
 return ($1|0);
}
function __ZN10emscripten8internal10getContextIPFNS_3valERKNSt3__26vectorI7ChunkIdNS3_9allocatorIS5_EEEEjEEEPT_RKSD_($0) {
 $0 = $0|0;
 var $1 = 0, $2 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $1 = (__Znwj(4)|0);
 $2 = HEAP32[$0>>2]|0;
 HEAP32[$1>>2] = $2;
 return ($1|0);
}
function __ZN10emscripten8internal11BindingTypeINS_3valEE10toWireTypeERKS2_($0) {
 $0 = $0|0;
 var $1 = 0, $2 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $1 = HEAP32[$0>>2]|0;
 __emval_incref(($1|0));
 $2 = HEAP32[$0>>2]|0;
 return ($2|0);
}
function __ZN10emscripten3valD2Ev($0) {
 $0 = $0|0;
 var $1 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $1 = HEAP32[$0>>2]|0;
 __emval_decref(($1|0));
 return;
}
function __ZN10emscripten8internal14ArgArrayGetterINS0_8TypeListIJNS_3valERKNSt3__26vectorI7ChunkIdNS4_9allocatorIS6_EEEEjEEEE3getEv() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 return (840|0);
}
function __ZN10emscripten8internal19getGenericSignatureIJiiiiEEEPKcv() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 return (2006|0);
}
function __ZN10emscripten3valC2IRK7ChunkIdEEOT_($0,$1) {
 $0 = $0|0;
 $1 = $1|0;
 var $2 = 0, $3 = 0, $4 = 0, $5 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0;
 $2 = sp;
 __ZN10emscripten8internal12WireTypePackIJRK7ChunkIdEEC2ES4_($2,$1);
 $3 = (__ZN10emscripten8internal6TypeIDIRK7ChunkIdE3getEv()|0);
 $4 = (__ZNK10emscripten8internal12WireTypePackIJRK7ChunkIdEEcvPKvEv($2)|0);
 $5 = (__emval_take_value(($3|0),($4|0))|0);
 HEAP32[$0>>2] = $5;
 STACKTOP = sp;return;
}
function __ZN10emscripten3val9undefinedEv() {
 var $0 = 0, $1 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0;
 $0 = sp;
 __ZN10emscripten3valC2EPNS_8internal7_EM_VALE($0,(1));
 $1 = HEAP32[$0>>2]|0;
 STACKTOP = sp;return ($1|0);
}
function __ZN10emscripten8internal12WireTypePackIJRK7ChunkIdEEC2ES4_($0,$1) {
 $0 = $0|0;
 $1 = $1|0;
 var $2 = 0, $3 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0;
 $2 = sp;
 HEAP32[$2>>2] = $0;
 $3 = (__ZN10emscripten8internal18GenericBindingTypeI7ChunkIdE10toWireTypeERKS2_($1)|0);
 __ZN10emscripten8internal20writeGenericWireTypeI7ChunkIdEEvRPNS0_15GenericWireTypeEPT_($2,$3);
 __ZN10emscripten8internal21writeGenericWireTypesERPNS0_15GenericWireTypeE($2);
 STACKTOP = sp;return;
}
function __ZN10emscripten8internal6TypeIDIRK7ChunkIdE3getEv() {
 var $0 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = (__ZN10emscripten8internal11LightTypeIDIRK7ChunkIdE3getEv()|0);
 return ($0|0);
}
function __ZNK10emscripten8internal12WireTypePackIJRK7ChunkIdEEcvPKvEv($0) {
 $0 = $0|0;
 var label = 0, sp = 0;
 sp = STACKTOP;
 return ($0|0);
}
function __ZN10emscripten8internal20writeGenericWireTypeI7ChunkIdEEvRPNS0_15GenericWireTypeEPT_($0,$1) {
 $0 = $0|0;
 $1 = $1|0;
 var $2 = 0, $3 = 0, $4 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $2 = HEAP32[$0>>2]|0;
 HEAP32[$2>>2] = $1;
 $3 = HEAP32[$0>>2]|0;
 $4 = ((($3)) + 8|0);
 HEAP32[$0>>2] = $4;
 return;
}
function __ZN10emscripten8internal18GenericBindingTypeI7ChunkIdE10toWireTypeERKS2_($0) {
 $0 = $0|0;
 var $1 = 0, $10 = 0, $11 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $1 = (__Znwj(8)|0);
 $2 = $0;
 $3 = $2;
 $4 = HEAP32[$3>>2]|0;
 $5 = (($2) + 4)|0;
 $6 = $5;
 $7 = HEAP32[$6>>2]|0;
 $8 = $1;
 $9 = $8;
 HEAP32[$9>>2] = $4;
 $10 = (($8) + 4)|0;
 $11 = $10;
 HEAP32[$11>>2] = $7;
 return ($1|0);
}
function __ZN10emscripten8internal21writeGenericWireTypesERPNS0_15GenericWireTypeE($0) {
 $0 = $0|0;
 var label = 0, sp = 0;
 sp = STACKTOP;
 return;
}
function __ZN10emscripten8internal11LightTypeIDIRK7ChunkIdE3getEv() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 return (184|0);
}
function __ZN10emscripten3valC2EPNS_8internal7_EM_VALE($0,$1) {
 $0 = $0|0;
 $1 = $1|0;
 var label = 0, sp = 0;
 sp = STACKTOP;
 HEAP32[$0>>2] = $1;
 return;
}
function __ZN10emscripten8internal15FunctionInvokerIPFbRNSt3__26vectorI7ChunkIdNS2_9allocatorIS4_EEEEjRKS4_EbS8_JjSA_EE6invokeEPSC_PS7_jPS4_($0,$1,$2,$3) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 $3 = $3|0;
 var $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $4 = HEAP32[$0>>2]|0;
 $5 = (__ZN10emscripten8internal18GenericBindingTypeINSt3__26vectorI7ChunkIdNS2_9allocatorIS4_EEEEE12fromWireTypeEPS7_($1)|0);
 $6 = (__ZN10emscripten8internal11BindingTypeIjE12fromWireTypeEj($2)|0);
 $7 = (__ZN10emscripten8internal18GenericBindingTypeI7ChunkIdE12fromWireTypeEPS2_($3)|0);
 $8 = (FUNCTION_TABLE_iiii[$4 & 15]($5,$6,$7)|0);
 $9 = (__ZN10emscripten8internal11BindingTypeIbE10toWireTypeEb($8)|0);
 return ($9|0);
}
function __ZNK10emscripten8internal12WithPoliciesIJEE11ArgTypeListIJbRNSt3__26vectorI7ChunkIdNS4_9allocatorIS6_EEEEjRKS6_EE8getCountEv($0) {
 $0 = $0|0;
 var label = 0, sp = 0;
 sp = STACKTOP;
 return 4;
}
function __ZNK10emscripten8internal12WithPoliciesIJEE11ArgTypeListIJbRNSt3__26vectorI7ChunkIdNS4_9allocatorIS6_EEEEjRKS6_EE8getTypesEv($0) {
 $0 = $0|0;
 var $1 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $1 = (__ZN10emscripten8internal14ArgArrayGetterINS0_8TypeListIJbRNSt3__26vectorI7ChunkIdNS3_9allocatorIS5_EEEEjRKS5_EEEE3getEv()|0);
 return ($1|0);
}
function __ZN10emscripten8internal10getContextIPFbRNSt3__26vectorI7ChunkIdNS2_9allocatorIS4_EEEEjRKS4_EEEPT_RKSD_($0) {
 $0 = $0|0;
 var $1 = 0, $2 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $1 = (__Znwj(4)|0);
 $2 = HEAP32[$0>>2]|0;
 HEAP32[$1>>2] = $2;
 return ($1|0);
}
function __ZN10emscripten8internal11BindingTypeIbE10toWireTypeEb($0) {
 $0 = $0|0;
 var label = 0, sp = 0;
 sp = STACKTOP;
 return ($0|0);
}
function __ZN10emscripten8internal14ArgArrayGetterINS0_8TypeListIJbRNSt3__26vectorI7ChunkIdNS3_9allocatorIS5_EEEEjRKS5_EEEE3getEv() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 return (852|0);
}
function __ZN10emscripten8internal19getGenericSignatureIJiiiiiEEEPKcv() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 return (2011|0);
}
function __ZNSt3__26vectorI4vec9NS_9allocatorIS1_EEE9push_backERKS1_($0,$1) {
 $0 = $0|0;
 $1 = $1|0;
 var $10 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, dest = 0, label = 0, sp = 0, src = 0, stop = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0;
 $2 = sp;
 $3 = ((($0)) + 4|0);
 $4 = HEAP32[$3>>2]|0;
 $5 = ((($0)) + 8|0);
 $6 = HEAP32[$5>>2]|0;
 $7 = ($4|0)==($6|0);
 if ($7) {
  __ZNSt3__26vectorI4vec9NS_9allocatorIS1_EEE21__push_back_slow_pathIRKS1_EEvOT_($0,$1);
  STACKTOP = sp;return;
 } else {
  __ZNSt3__26vectorI4vec9NS_9allocatorIS1_EEE24__RAII_IncreaseAnnotatorC2ERKS4_j($2,$0,1);
  $8 = HEAP32[$3>>2]|0;
  dest=$8; src=$1; stop=dest+36|0; do { HEAP32[dest>>2]=HEAP32[src>>2]|0; dest=dest+4|0; src=src+4|0; } while ((dest|0) < (stop|0));
  __ZNSt3__26vectorI4vec9NS_9allocatorIS1_EEE24__RAII_IncreaseAnnotator6__doneEv($2);
  $9 = HEAP32[$3>>2]|0;
  $10 = ((($9)) + 36|0);
  HEAP32[$3>>2] = $10;
  STACKTOP = sp;return;
 }
}
function __ZNSt3__26vectorI4vec9NS_9allocatorIS1_EEE6resizeEjRKS1_($0,$1,$2) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 var $$cast$i = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, $scevgep$i$i = 0, $scevgep4$i$i = 0, label = 0;
 var sp = 0;
 sp = STACKTOP;
 $3 = ((($0)) + 4|0);
 $4 = HEAP32[$3>>2]|0;
 $5 = HEAP32[$0>>2]|0;
 $6 = (($4) - ($5))|0;
 $7 = (($6|0) / 36)&-1;
 $8 = ($7>>>0)<($1>>>0);
 if ($8) {
  $9 = (($1) - ($7))|0;
  __ZNSt3__26vectorI4vec9NS_9allocatorIS1_EEE8__appendEjRKS1_($0,$9,$2);
  return;
 }
 $10 = ($7>>>0)>($1>>>0);
 if (!($10)) {
  return;
 }
 $11 = HEAP32[$0>>2]|0;
 $12 = (($11) + (($1*36)|0)|0);
 $$cast$i = $4;
 $13 = ($$cast$i|0)==($12|0);
 if (!($13)) {
  $scevgep$i$i = ((($$cast$i)) + -36|0);
  $14 = $scevgep$i$i;
  $15 = $12;
  $16 = (($14) - ($15))|0;
  $17 = (($16>>>0) / 36)&-1;
  $18 = $17 ^ -1;
  $scevgep4$i$i = (($$cast$i) + (($18*36)|0)|0);
  HEAP32[$3>>2] = $scevgep4$i$i;
 }
 __ZNKSt3__26vectorI4vec9NS_9allocatorIS1_EEE17__annotate_shrinkEj($0,$7);
 return;
}
function __ZN10emscripten8internal12VectorAccessINSt3__26vectorI4vec9NS2_9allocatorIS4_EEEEE3getERKS7_j($0,$1) {
 $0 = $0|0;
 $1 = $1|0;
 var $10 = 0, $11 = 0, $12 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0;
 $2 = sp;
 $3 = ((($0)) + 4|0);
 $4 = HEAP32[$3>>2]|0;
 $5 = HEAP32[$0>>2]|0;
 $6 = (($4) - ($5))|0;
 $7 = (($6|0) / 36)&-1;
 $8 = ($7>>>0)>($1>>>0);
 if ($8) {
  $9 = HEAP32[$0>>2]|0;
  $10 = (($9) + (($1*36)|0)|0);
  __ZN10emscripten3valC2IRK4vec9EEOT_($2,$10);
  $12 = HEAP32[$2>>2]|0;
  STACKTOP = sp;return ($12|0);
 } else {
  $11 = (__ZN10emscripten3val9undefinedEv()|0);
  HEAP32[$2>>2] = $11;
  $12 = HEAP32[$2>>2]|0;
  STACKTOP = sp;return ($12|0);
 }
 return (0)|0;
}
function __ZN10emscripten8internal12VectorAccessINSt3__26vectorI4vec9NS2_9allocatorIS4_EEEEE3setERS7_jRKS4_($0,$1,$2) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 var $3 = 0, $4 = 0, dest = 0, label = 0, sp = 0, src = 0, stop = 0;
 sp = STACKTOP;
 $3 = HEAP32[$0>>2]|0;
 $4 = (($3) + (($1*36)|0)|0);
 dest=$4; src=$2; stop=dest+36|0; do { HEAP32[dest>>2]=HEAP32[src>>2]|0; dest=dest+4|0; src=src+4|0; } while ((dest|0) < (stop|0));
 return 1;
}
function __ZNSt3__26vectorI4vec9NS_9allocatorIS1_EEE21__push_back_slow_pathIRKS1_EEvOT_($0,$1) {
 $0 = $0|0;
 $1 = $1|0;
 var $$0$i = 0, $$sroa$speculated$i = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0;
 var $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, dest = 0, label = 0, sp = 0, src = 0, stop = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 32|0;
 $2 = sp;
 $3 = ((($0)) + 8|0);
 $4 = ((($0)) + 4|0);
 $5 = HEAP32[$4>>2]|0;
 $6 = HEAP32[$0>>2]|0;
 $7 = (($5) - ($6))|0;
 $8 = (($7|0) / 36)&-1;
 $9 = (($8) + 1)|0;
 $10 = (__ZNKSt3__26vectorI4vec9NS_9allocatorIS1_EEE8max_sizeEv($0)|0);
 $11 = ($10>>>0)<($9>>>0);
 if ($11) {
  __ZNKSt3__220__vector_base_commonILb1EE20__throw_length_errorEv($0);
  // unreachable;
 } else {
  $12 = ((($0)) + 8|0);
  $13 = HEAP32[$12>>2]|0;
  $14 = HEAP32[$0>>2]|0;
  $15 = (($13) - ($14))|0;
  $16 = (($15|0) / 36)&-1;
  $17 = $10 >>> 1;
  $18 = ($16>>>0)<($17>>>0);
  $19 = $16 << 1;
  $20 = ($19>>>0)<($9>>>0);
  $$sroa$speculated$i = $20 ? $9 : $19;
  $$0$i = $18 ? $$sroa$speculated$i : $10;
  $21 = HEAP32[$4>>2]|0;
  $22 = (($21) - ($14))|0;
  $23 = (($22|0) / 36)&-1;
  __ZNSt3__214__split_bufferI4vec9RNS_9allocatorIS1_EEEC2EjjS4_($2,$$0$i,$23,$3);
  $24 = ((($2)) + 8|0);
  $25 = HEAP32[$24>>2]|0;
  dest=$25; src=$1; stop=dest+36|0; do { HEAP32[dest>>2]=HEAP32[src>>2]|0; dest=dest+4|0; src=src+4|0; } while ((dest|0) < (stop|0));
  $26 = ((($25)) + 36|0);
  HEAP32[$24>>2] = $26;
  __ZNSt3__26vectorI4vec9NS_9allocatorIS1_EEE26__swap_out_circular_bufferERNS_14__split_bufferIS1_RS3_EE($0,$2);
  __ZNSt3__214__split_bufferI4vec9RNS_9allocatorIS1_EEED2Ev($2);
  STACKTOP = sp;return;
 }
}
function __ZNSt3__26vectorI4vec9NS_9allocatorIS1_EEE8__appendEjRKS1_($0,$1,$2) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 var $$0$i = 0, $$0$i11 = 0, $$sroa$speculated$i = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0;
 var $27 = 0, $28 = 0, $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, dest = 0, label = 0, sp = 0, src = 0;
 var stop = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 32|0;
 $3 = sp;
 $4 = ((($0)) + 8|0);
 $5 = HEAP32[$4>>2]|0;
 $6 = ((($0)) + 4|0);
 $7 = HEAP32[$6>>2]|0;
 $8 = (($5) - ($7))|0;
 $9 = (($8|0) / 36)&-1;
 $10 = ($9>>>0)<($1>>>0);
 if (!($10)) {
  $$0$i = $1;
  while(1) {
   __ZNSt3__26vectorI4vec9NS_9allocatorIS1_EEE24__RAII_IncreaseAnnotatorC2ERKS4_j($3,$0,1);
   $11 = HEAP32[$6>>2]|0;
   dest=$11; src=$2; stop=dest+36|0; do { HEAP32[dest>>2]=HEAP32[src>>2]|0; dest=dest+4|0; src=src+4|0; } while ((dest|0) < (stop|0));
   $12 = HEAP32[$6>>2]|0;
   $13 = ((($12)) + 36|0);
   HEAP32[$6>>2] = $13;
   $14 = (($$0$i) + -1)|0;
   __ZNSt3__26vectorI4vec9NS_9allocatorIS1_EEE24__RAII_IncreaseAnnotator6__doneEv($3);
   $15 = ($14|0)==(0);
   if ($15) {
    break;
   } else {
    $$0$i = $14;
   }
  }
  STACKTOP = sp;return;
 }
 $16 = ((($0)) + 8|0);
 $17 = HEAP32[$6>>2]|0;
 $18 = HEAP32[$0>>2]|0;
 $19 = (($17) - ($18))|0;
 $20 = (($19|0) / 36)&-1;
 $21 = (($20) + ($1))|0;
 $22 = (__ZNKSt3__26vectorI4vec9NS_9allocatorIS1_EEE8max_sizeEv($0)|0);
 $23 = ($22>>>0)<($21>>>0);
 if ($23) {
  __ZNKSt3__220__vector_base_commonILb1EE20__throw_length_errorEv($0);
  // unreachable;
 }
 $24 = ((($0)) + 8|0);
 $25 = HEAP32[$24>>2]|0;
 $26 = HEAP32[$0>>2]|0;
 $27 = (($25) - ($26))|0;
 $28 = (($27|0) / 36)&-1;
 $29 = $22 >>> 1;
 $30 = ($28>>>0)<($29>>>0);
 $31 = $28 << 1;
 $32 = ($31>>>0)<($21>>>0);
 $$sroa$speculated$i = $32 ? $21 : $31;
 $$0$i11 = $30 ? $$sroa$speculated$i : $22;
 $33 = HEAP32[$6>>2]|0;
 $34 = (($33) - ($26))|0;
 $35 = (($34|0) / 36)&-1;
 __ZNSt3__214__split_bufferI4vec9RNS_9allocatorIS1_EEEC2EjjS4_($3,$$0$i11,$35,$16);
 __ZNSt3__214__split_bufferI4vec9RNS_9allocatorIS1_EEE18__construct_at_endEjRKS1_($3,$1,$2);
 __ZNSt3__26vectorI4vec9NS_9allocatorIS1_EEE26__swap_out_circular_bufferERNS_14__split_bufferIS1_RS3_EE($0,$3);
 __ZNSt3__214__split_bufferI4vec9RNS_9allocatorIS1_EEED2Ev($3);
 STACKTOP = sp;return;
}
function __ZNSt3__214__split_bufferI4vec9RNS_9allocatorIS1_EEE18__construct_at_endEjRKS1_($0,$1,$2) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 var $$0 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, dest = 0, label = 0, sp = 0, src = 0, stop = 0;
 sp = STACKTOP;
 $3 = ((($0)) + 8|0);
 $$0 = $1;
 while(1) {
  $4 = HEAP32[$3>>2]|0;
  dest=$4; src=$2; stop=dest+36|0; do { HEAP32[dest>>2]=HEAP32[src>>2]|0; dest=dest+4|0; src=src+4|0; } while ((dest|0) < (stop|0));
  $5 = HEAP32[$3>>2]|0;
  $6 = ((($5)) + 36|0);
  HEAP32[$3>>2] = $6;
  $7 = (($$0) + -1)|0;
  $8 = ($7|0)==(0);
  if ($8) {
   break;
  } else {
   $$0 = $7;
  }
 }
 return;
}
function __ZN10emscripten8internal11NoBaseClass6verifyINSt3__26vectorI4vec9NS3_9allocatorIS5_EEEEEEvv() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 return;
}
function __ZN10emscripten8internal13getActualTypeINSt3__26vectorI4vec9NS2_9allocatorIS4_EEEEEEPKvPT_($0) {
 $0 = $0|0;
 var $1 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $1 = (__ZN10emscripten8internal14getLightTypeIDINSt3__26vectorI4vec9NS2_9allocatorIS4_EEEEEEPKvRKT_($0)|0);
 return ($1|0);
}
function __ZN10emscripten8internal11NoBaseClass11getUpcasterINSt3__26vectorI4vec9NS3_9allocatorIS5_EEEEEEPFvvEv() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 return (0|0);
}
function __ZN10emscripten8internal11NoBaseClass13getDowncasterINSt3__26vectorI4vec9NS3_9allocatorIS5_EEEEEEPFvvEv() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 return (0|0);
}
function __ZN10emscripten8internal14raw_destructorINSt3__26vectorI4vec9NS2_9allocatorIS4_EEEEEEvPT_($0) {
 $0 = $0|0;
 var $1 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $1 = ($0|0)==(0|0);
 if ($1) {
  return;
 }
 __ZNSt3__213__vector_baseI4vec9NS_9allocatorIS1_EEED2Ev($0);
 __ZdlPv($0);
 return;
}
function __ZN10emscripten8internal6TypeIDINSt3__26vectorI4vec9NS2_9allocatorIS4_EEEEE3getEv() {
 var $0 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = (__ZN10emscripten8internal11LightTypeIDINSt3__26vectorI4vec9NS2_9allocatorIS4_EEEEE3getEv()|0);
 return ($0|0);
}
function __ZN10emscripten8internal6TypeIDINS0_17AllowedRawPointerINSt3__26vectorI4vec9NS3_9allocatorIS5_EEEEEEE3getEv() {
 var $0 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = (__ZN10emscripten8internal11LightTypeIDIPNSt3__26vectorI4vec9NS2_9allocatorIS4_EEEEE3getEv()|0);
 return ($0|0);
}
function __ZN10emscripten8internal6TypeIDINS0_17AllowedRawPointerIKNSt3__26vectorI4vec9NS3_9allocatorIS5_EEEEEEE3getEv() {
 var $0 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = (__ZN10emscripten8internal11LightTypeIDIPKNSt3__26vectorI4vec9NS2_9allocatorIS4_EEEEE3getEv()|0);
 return ($0|0);
}
function __ZN10emscripten8internal14getLightTypeIDINSt3__26vectorI4vec9NS2_9allocatorIS4_EEEEEEPKvRKT_($0) {
 $0 = $0|0;
 var label = 0, sp = 0;
 sp = STACKTOP;
 return (160|0);
}
function __ZN10emscripten8internal11LightTypeIDINSt3__26vectorI4vec9NS2_9allocatorIS4_EEEEE3getEv() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 return (160|0);
}
function __ZN10emscripten8internal11LightTypeIDIPNSt3__26vectorI4vec9NS2_9allocatorIS4_EEEEE3getEv() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 return (240|0);
}
function __ZN10emscripten8internal11LightTypeIDIPKNSt3__26vectorI4vec9NS2_9allocatorIS4_EEEEE3getEv() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 return (256|0);
}
function __ZN10emscripten8internal12operator_newINSt3__26vectorI4vec9NS2_9allocatorIS4_EEEEJEEEPT_DpOT0_() {
 var $0 = 0, $1 = 0, $2 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = (__Znwj(12)|0);
 HEAP32[$0>>2] = 0;
 $1 = ((($0)) + 4|0);
 HEAP32[$1>>2] = 0;
 $2 = ((($0)) + 8|0);
 HEAP32[$2>>2] = 0;
 return ($0|0);
}
function __ZN10emscripten8internal7InvokerIPNSt3__26vectorI4vec9NS2_9allocatorIS4_EEEEJEE6invokeEPFS8_vE($0) {
 $0 = $0|0;
 var $1 = 0, $2 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $1 = (FUNCTION_TABLE_i[$0 & 7]()|0);
 $2 = (__ZN10emscripten8internal11BindingTypeIPNSt3__26vectorI4vec9NS2_9allocatorIS4_EEEEE10toWireTypeES8_($1)|0);
 return ($2|0);
}
function __ZNK10emscripten8internal12WithPoliciesIJNS_18allow_raw_pointersEEE11ArgTypeListIJPNSt3__26vectorI4vec9NS5_9allocatorIS7_EEEEEE8getCountEv($0) {
 $0 = $0|0;
 var label = 0, sp = 0;
 sp = STACKTOP;
 return 1;
}
function __ZNK10emscripten8internal12WithPoliciesIJNS_18allow_raw_pointersEEE11ArgTypeListIJPNSt3__26vectorI4vec9NS5_9allocatorIS7_EEEEEE8getTypesEv($0) {
 $0 = $0|0;
 var $1 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $1 = (__ZN10emscripten8internal14ArgArrayGetterINS0_8TypeListIJNS0_17AllowedRawPointerINSt3__26vectorI4vec9NS4_9allocatorIS6_EEEEEEEEEE3getEv()|0);
 return ($1|0);
}
function __ZN10emscripten8internal11BindingTypeIPNSt3__26vectorI4vec9NS2_9allocatorIS4_EEEEE10toWireTypeES8_($0) {
 $0 = $0|0;
 var label = 0, sp = 0;
 sp = STACKTOP;
 return ($0|0);
}
function __ZN10emscripten8internal14ArgArrayGetterINS0_8TypeListIJNS0_17AllowedRawPointerINSt3__26vectorI4vec9NS4_9allocatorIS6_EEEEEEEEEE3getEv() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 return (868|0);
}
function __ZN10emscripten8internal13MethodInvokerIMNSt3__26vectorI4vec9NS2_9allocatorIS4_EEEEFvRKS4_EvPS7_JS9_EE6invokeERKSB_SC_PS4_($0,$1,$2) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 var $$elt3 = 0, $$unpack = 0, $$unpack4 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $$unpack = HEAP32[$0>>2]|0;
 $$elt3 = ((($0)) + 4|0);
 $$unpack4 = HEAP32[$$elt3>>2]|0;
 $3 = (__ZN10emscripten8internal11BindingTypeIPNSt3__26vectorI4vec9NS2_9allocatorIS4_EEEEE12fromWireTypeES8_($1)|0);
 $4 = $$unpack4 >> 1;
 $5 = (($3) + ($4)|0);
 $6 = $$unpack4 & 1;
 $7 = ($6|0)==(0);
 if ($7) {
  $11 = $$unpack;
  $13 = $11;
 } else {
  $8 = HEAP32[$5>>2]|0;
  $9 = (($8) + ($$unpack)|0);
  $10 = HEAP32[$9>>2]|0;
  $13 = $10;
 }
 $12 = (__ZN10emscripten8internal18GenericBindingTypeI4vec9E12fromWireTypeEPS2_($2)|0);
 FUNCTION_TABLE_vii[$13 & 7]($5,$12);
 return;
}
function __ZNK10emscripten8internal12WithPoliciesIJEE11ArgTypeListIJvNS0_17AllowedRawPointerINSt3__26vectorI4vec9NS5_9allocatorIS7_EEEEEERKS7_EE8getCountEv($0) {
 $0 = $0|0;
 var label = 0, sp = 0;
 sp = STACKTOP;
 return 3;
}
function __ZNK10emscripten8internal12WithPoliciesIJEE11ArgTypeListIJvNS0_17AllowedRawPointerINSt3__26vectorI4vec9NS5_9allocatorIS7_EEEEEERKS7_EE8getTypesEv($0) {
 $0 = $0|0;
 var $1 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $1 = (__ZN10emscripten8internal14ArgArrayGetterINS0_8TypeListIJvNS0_17AllowedRawPointerINSt3__26vectorI4vec9NS4_9allocatorIS6_EEEEEERKS6_EEEE3getEv()|0);
 return ($1|0);
}
function __ZN10emscripten8internal10getContextIMNSt3__26vectorI4vec9NS2_9allocatorIS4_EEEEFvRKS4_EEEPT_RKSC_($0) {
 $0 = $0|0;
 var $$elt1 = 0, $$repack4 = 0, $$unpack = 0, $$unpack2 = 0, $1 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $1 = (__Znwj(8)|0);
 $$unpack = HEAP32[$0>>2]|0;
 $$elt1 = ((($0)) + 4|0);
 $$unpack2 = HEAP32[$$elt1>>2]|0;
 HEAP32[$1>>2] = $$unpack;
 $$repack4 = ((($1)) + 4|0);
 HEAP32[$$repack4>>2] = $$unpack2;
 return ($1|0);
}
function __ZN10emscripten8internal11BindingTypeIPNSt3__26vectorI4vec9NS2_9allocatorIS4_EEEEE12fromWireTypeES8_($0) {
 $0 = $0|0;
 var label = 0, sp = 0;
 sp = STACKTOP;
 return ($0|0);
}
function __ZN10emscripten8internal18GenericBindingTypeI4vec9E12fromWireTypeEPS2_($0) {
 $0 = $0|0;
 var label = 0, sp = 0;
 sp = STACKTOP;
 return ($0|0);
}
function __ZN10emscripten8internal14ArgArrayGetterINS0_8TypeListIJvNS0_17AllowedRawPointerINSt3__26vectorI4vec9NS4_9allocatorIS6_EEEEEERKS6_EEEE3getEv() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 return (872|0);
}
function __ZN10emscripten8internal13MethodInvokerIMNSt3__26vectorI4vec9NS2_9allocatorIS4_EEEEFvjRKS4_EvPS7_JjS9_EE6invokeERKSB_SC_jPS4_($0,$1,$2,$3) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 $3 = $3|0;
 var $$elt3 = 0, $$unpack = 0, $$unpack4 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $$unpack = HEAP32[$0>>2]|0;
 $$elt3 = ((($0)) + 4|0);
 $$unpack4 = HEAP32[$$elt3>>2]|0;
 $4 = (__ZN10emscripten8internal11BindingTypeIPNSt3__26vectorI4vec9NS2_9allocatorIS4_EEEEE12fromWireTypeES8_($1)|0);
 $5 = $$unpack4 >> 1;
 $6 = (($4) + ($5)|0);
 $7 = $$unpack4 & 1;
 $8 = ($7|0)==(0);
 if ($8) {
  $12 = $$unpack;
  $15 = $12;
 } else {
  $9 = HEAP32[$6>>2]|0;
  $10 = (($9) + ($$unpack)|0);
  $11 = HEAP32[$10>>2]|0;
  $15 = $11;
 }
 $13 = (__ZN10emscripten8internal11BindingTypeIjE12fromWireTypeEj($2)|0);
 $14 = (__ZN10emscripten8internal18GenericBindingTypeI4vec9E12fromWireTypeEPS2_($3)|0);
 FUNCTION_TABLE_viii[$15 & 7]($6,$13,$14);
 return;
}
function __ZNK10emscripten8internal12WithPoliciesIJEE11ArgTypeListIJvNS0_17AllowedRawPointerINSt3__26vectorI4vec9NS5_9allocatorIS7_EEEEEEjRKS7_EE8getCountEv($0) {
 $0 = $0|0;
 var label = 0, sp = 0;
 sp = STACKTOP;
 return 4;
}
function __ZNK10emscripten8internal12WithPoliciesIJEE11ArgTypeListIJvNS0_17AllowedRawPointerINSt3__26vectorI4vec9NS5_9allocatorIS7_EEEEEEjRKS7_EE8getTypesEv($0) {
 $0 = $0|0;
 var $1 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $1 = (__ZN10emscripten8internal14ArgArrayGetterINS0_8TypeListIJvNS0_17AllowedRawPointerINSt3__26vectorI4vec9NS4_9allocatorIS6_EEEEEEjRKS6_EEEE3getEv()|0);
 return ($1|0);
}
function __ZN10emscripten8internal10getContextIMNSt3__26vectorI4vec9NS2_9allocatorIS4_EEEEFvjRKS4_EEEPT_RKSC_($0) {
 $0 = $0|0;
 var $$elt1 = 0, $$repack4 = 0, $$unpack = 0, $$unpack2 = 0, $1 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $1 = (__Znwj(8)|0);
 $$unpack = HEAP32[$0>>2]|0;
 $$elt1 = ((($0)) + 4|0);
 $$unpack2 = HEAP32[$$elt1>>2]|0;
 HEAP32[$1>>2] = $$unpack;
 $$repack4 = ((($1)) + 4|0);
 HEAP32[$$repack4>>2] = $$unpack2;
 return ($1|0);
}
function __ZN10emscripten8internal14ArgArrayGetterINS0_8TypeListIJvNS0_17AllowedRawPointerINSt3__26vectorI4vec9NS4_9allocatorIS6_EEEEEEjRKS6_EEEE3getEv() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 return (884|0);
}
function __ZN10emscripten8internal13MethodInvokerIMNSt3__26vectorI4vec9NS2_9allocatorIS4_EEEEKFjvEjPKS7_JEE6invokeERKS9_SB_($0,$1) {
 $0 = $0|0;
 $1 = $1|0;
 var $$elt2 = 0, $$unpack = 0, $$unpack3 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0;
 $2 = sp;
 $$unpack = HEAP32[$0>>2]|0;
 $$elt2 = ((($0)) + 4|0);
 $$unpack3 = HEAP32[$$elt2>>2]|0;
 $3 = (__ZN10emscripten8internal11BindingTypeIPKNSt3__26vectorI4vec9NS2_9allocatorIS4_EEEEE12fromWireTypeES9_($1)|0);
 $4 = $$unpack3 >> 1;
 $5 = (($3) + ($4)|0);
 $6 = $$unpack3 & 1;
 $7 = ($6|0)==(0);
 if ($7) {
  $11 = $$unpack;
  $12 = $11;
 } else {
  $8 = HEAP32[$5>>2]|0;
  $9 = (($8) + ($$unpack)|0);
  $10 = HEAP32[$9>>2]|0;
  $12 = $10;
 }
 $13 = (FUNCTION_TABLE_ii[$12 & 15]($5)|0);
 HEAP32[$2>>2] = $13;
 $14 = (__ZN10emscripten8internal11BindingTypeIjE10toWireTypeERKj($2)|0);
 STACKTOP = sp;return ($14|0);
}
function __ZNK10emscripten8internal12WithPoliciesIJEE11ArgTypeListIJjNS0_17AllowedRawPointerIKNSt3__26vectorI4vec9NS5_9allocatorIS7_EEEEEEEE8getCountEv($0) {
 $0 = $0|0;
 var label = 0, sp = 0;
 sp = STACKTOP;
 return 2;
}
function __ZNK10emscripten8internal12WithPoliciesIJEE11ArgTypeListIJjNS0_17AllowedRawPointerIKNSt3__26vectorI4vec9NS5_9allocatorIS7_EEEEEEEE8getTypesEv($0) {
 $0 = $0|0;
 var $1 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $1 = (__ZN10emscripten8internal14ArgArrayGetterINS0_8TypeListIJjNS0_17AllowedRawPointerIKNSt3__26vectorI4vec9NS4_9allocatorIS6_EEEEEEEEEE3getEv()|0);
 return ($1|0);
}
function __ZN10emscripten8internal10getContextIMNSt3__26vectorI4vec9NS2_9allocatorIS4_EEEEKFjvEEEPT_RKSA_($0) {
 $0 = $0|0;
 var $$elt1 = 0, $$repack4 = 0, $$unpack = 0, $$unpack2 = 0, $1 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $1 = (__Znwj(8)|0);
 $$unpack = HEAP32[$0>>2]|0;
 $$elt1 = ((($0)) + 4|0);
 $$unpack2 = HEAP32[$$elt1>>2]|0;
 HEAP32[$1>>2] = $$unpack;
 $$repack4 = ((($1)) + 4|0);
 HEAP32[$$repack4>>2] = $$unpack2;
 return ($1|0);
}
function __ZN10emscripten8internal11BindingTypeIPKNSt3__26vectorI4vec9NS2_9allocatorIS4_EEEEE12fromWireTypeES9_($0) {
 $0 = $0|0;
 var label = 0, sp = 0;
 sp = STACKTOP;
 return ($0|0);
}
function __ZN10emscripten8internal14ArgArrayGetterINS0_8TypeListIJjNS0_17AllowedRawPointerIKNSt3__26vectorI4vec9NS4_9allocatorIS6_EEEEEEEEEE3getEv() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 return (900|0);
}
function __ZN10emscripten8internal15FunctionInvokerIPFNS_3valERKNSt3__26vectorI4vec9NS3_9allocatorIS5_EEEEjES2_SA_JjEE6invokeEPSC_PS8_j($0,$1,$2) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 var $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0;
 $3 = sp;
 $4 = HEAP32[$0>>2]|0;
 $5 = (__ZN10emscripten8internal18GenericBindingTypeINSt3__26vectorI4vec9NS2_9allocatorIS4_EEEEE12fromWireTypeEPS7_($1)|0);
 $6 = (__ZN10emscripten8internal11BindingTypeIjE12fromWireTypeEj($2)|0);
 $7 = (FUNCTION_TABLE_iii[$4 & 7]($5,$6)|0);
 HEAP32[$3>>2] = $7;
 $8 = (__ZN10emscripten8internal11BindingTypeINS_3valEE10toWireTypeERKS2_($3)|0);
 __ZN10emscripten3valD2Ev($3);
 STACKTOP = sp;return ($8|0);
}
function __ZNK10emscripten8internal12WithPoliciesIJEE11ArgTypeListIJNS_3valERKNSt3__26vectorI4vec9NS5_9allocatorIS7_EEEEjEE8getCountEv($0) {
 $0 = $0|0;
 var label = 0, sp = 0;
 sp = STACKTOP;
 return 3;
}
function __ZNK10emscripten8internal12WithPoliciesIJEE11ArgTypeListIJNS_3valERKNSt3__26vectorI4vec9NS5_9allocatorIS7_EEEEjEE8getTypesEv($0) {
 $0 = $0|0;
 var $1 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $1 = (__ZN10emscripten8internal14ArgArrayGetterINS0_8TypeListIJNS_3valERKNSt3__26vectorI4vec9NS4_9allocatorIS6_EEEEjEEEE3getEv()|0);
 return ($1|0);
}
function __ZN10emscripten8internal10getContextIPFNS_3valERKNSt3__26vectorI4vec9NS3_9allocatorIS5_EEEEjEEEPT_RKSD_($0) {
 $0 = $0|0;
 var $1 = 0, $2 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $1 = (__Znwj(4)|0);
 $2 = HEAP32[$0>>2]|0;
 HEAP32[$1>>2] = $2;
 return ($1|0);
}
function __ZN10emscripten8internal18GenericBindingTypeINSt3__26vectorI4vec9NS2_9allocatorIS4_EEEEE12fromWireTypeEPS7_($0) {
 $0 = $0|0;
 var label = 0, sp = 0;
 sp = STACKTOP;
 return ($0|0);
}
function __ZN10emscripten8internal14ArgArrayGetterINS0_8TypeListIJNS_3valERKNSt3__26vectorI4vec9NS4_9allocatorIS6_EEEEjEEEE3getEv() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 return (908|0);
}
function __ZN10emscripten3valC2IRK4vec9EEOT_($0,$1) {
 $0 = $0|0;
 $1 = $1|0;
 var $2 = 0, $3 = 0, $4 = 0, $5 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0;
 $2 = sp;
 __ZN10emscripten8internal12WireTypePackIJRK4vec9EEC2ES4_($2,$1);
 $3 = (__ZN10emscripten8internal6TypeIDIRK4vec9E3getEv()|0);
 $4 = (__ZNK10emscripten8internal12WireTypePackIJRK4vec9EEcvPKvEv($2)|0);
 $5 = (__emval_take_value(($3|0),($4|0))|0);
 HEAP32[$0>>2] = $5;
 STACKTOP = sp;return;
}
function __ZN10emscripten8internal12WireTypePackIJRK4vec9EEC2ES4_($0,$1) {
 $0 = $0|0;
 $1 = $1|0;
 var $2 = 0, $3 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0;
 $2 = sp;
 HEAP32[$2>>2] = $0;
 $3 = (__ZN10emscripten8internal18GenericBindingTypeI4vec9E10toWireTypeERKS2_($1)|0);
 __ZN10emscripten8internal20writeGenericWireTypeI4vec9EEvRPNS0_15GenericWireTypeEPT_($2,$3);
 __ZN10emscripten8internal21writeGenericWireTypesERPNS0_15GenericWireTypeE($2);
 STACKTOP = sp;return;
}
function __ZN10emscripten8internal6TypeIDIRK4vec9E3getEv() {
 var $0 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = (__ZN10emscripten8internal11LightTypeIDIRK4vec9E3getEv()|0);
 return ($0|0);
}
function __ZNK10emscripten8internal12WireTypePackIJRK4vec9EEcvPKvEv($0) {
 $0 = $0|0;
 var label = 0, sp = 0;
 sp = STACKTOP;
 return ($0|0);
}
function __ZN10emscripten8internal20writeGenericWireTypeI4vec9EEvRPNS0_15GenericWireTypeEPT_($0,$1) {
 $0 = $0|0;
 $1 = $1|0;
 var $2 = 0, $3 = 0, $4 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $2 = HEAP32[$0>>2]|0;
 HEAP32[$2>>2] = $1;
 $3 = HEAP32[$0>>2]|0;
 $4 = ((($3)) + 8|0);
 HEAP32[$0>>2] = $4;
 return;
}
function __ZN10emscripten8internal18GenericBindingTypeI4vec9E10toWireTypeERKS2_($0) {
 $0 = $0|0;
 var $1 = 0, dest = 0, label = 0, sp = 0, src = 0, stop = 0;
 sp = STACKTOP;
 $1 = (__Znwj(36)|0);
 dest=$1; src=$0; stop=dest+36|0; do { HEAP32[dest>>2]=HEAP32[src>>2]|0; dest=dest+4|0; src=src+4|0; } while ((dest|0) < (stop|0));
 return ($1|0);
}
function __ZN10emscripten8internal11LightTypeIDIRK4vec9E3getEv() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 return (192|0);
}
function __ZN10emscripten8internal15FunctionInvokerIPFbRNSt3__26vectorI4vec9NS2_9allocatorIS4_EEEEjRKS4_EbS8_JjSA_EE6invokeEPSC_PS7_jPS4_($0,$1,$2,$3) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 $3 = $3|0;
 var $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $4 = HEAP32[$0>>2]|0;
 $5 = (__ZN10emscripten8internal18GenericBindingTypeINSt3__26vectorI4vec9NS2_9allocatorIS4_EEEEE12fromWireTypeEPS7_($1)|0);
 $6 = (__ZN10emscripten8internal11BindingTypeIjE12fromWireTypeEj($2)|0);
 $7 = (__ZN10emscripten8internal18GenericBindingTypeI4vec9E12fromWireTypeEPS2_($3)|0);
 $8 = (FUNCTION_TABLE_iiii[$4 & 15]($5,$6,$7)|0);
 $9 = (__ZN10emscripten8internal11BindingTypeIbE10toWireTypeEb($8)|0);
 return ($9|0);
}
function __ZNK10emscripten8internal12WithPoliciesIJEE11ArgTypeListIJbRNSt3__26vectorI4vec9NS4_9allocatorIS6_EEEEjRKS6_EE8getCountEv($0) {
 $0 = $0|0;
 var label = 0, sp = 0;
 sp = STACKTOP;
 return 4;
}
function __ZNK10emscripten8internal12WithPoliciesIJEE11ArgTypeListIJbRNSt3__26vectorI4vec9NS4_9allocatorIS6_EEEEjRKS6_EE8getTypesEv($0) {
 $0 = $0|0;
 var $1 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $1 = (__ZN10emscripten8internal14ArgArrayGetterINS0_8TypeListIJbRNSt3__26vectorI4vec9NS3_9allocatorIS5_EEEEjRKS5_EEEE3getEv()|0);
 return ($1|0);
}
function __ZN10emscripten8internal10getContextIPFbRNSt3__26vectorI4vec9NS2_9allocatorIS4_EEEEjRKS4_EEEPT_RKSD_($0) {
 $0 = $0|0;
 var $1 = 0, $2 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $1 = (__Znwj(4)|0);
 $2 = HEAP32[$0>>2]|0;
 HEAP32[$1>>2] = $2;
 return ($1|0);
}
function __ZN10emscripten8internal14ArgArrayGetterINS0_8TypeListIJbRNSt3__26vectorI4vec9NS3_9allocatorIS5_EEEEjRKS5_EEEE3getEv() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 return (920|0);
}
function __GLOBAL__sub_I_em_cpp() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 ___cxx_global_var_init();
 return;
}
function __GLOBAL__sub_I_bind_cpp() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 ___cxx_global_var_init_2();
 return;
}
function ___cxx_global_var_init_2() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 __ZN53EmscriptenBindingInitializer_native_and_builtin_typesC2Ev(0);
 return;
}
function __ZN53EmscriptenBindingInitializer_native_and_builtin_typesC2Ev($0) {
 $0 = $0|0;
 var $1 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $1 = (__ZN10emscripten8internal6TypeIDIvE3getEv()|0);
 __embind_register_void(($1|0),(2104|0));
 $2 = (__ZN10emscripten8internal6TypeIDIbE3getEv()|0);
 __embind_register_bool(($2|0),(2109|0),1,1,0);
 __ZN12_GLOBAL__N_1L16register_integerIcEEvPKc();
 __ZN12_GLOBAL__N_1L16register_integerIaEEvPKc();
 __ZN12_GLOBAL__N_1L16register_integerIhEEvPKc();
 __ZN12_GLOBAL__N_1L16register_integerIsEEvPKc();
 __ZN12_GLOBAL__N_1L16register_integerItEEvPKc();
 __ZN12_GLOBAL__N_1L16register_integerIiEEvPKc();
 __ZN12_GLOBAL__N_1L16register_integerIjEEvPKc();
 __ZN12_GLOBAL__N_1L16register_integerIlEEvPKc();
 __ZN12_GLOBAL__N_1L16register_integerImEEvPKc();
 __ZN12_GLOBAL__N_1L14register_floatIfEEvPKc();
 __ZN12_GLOBAL__N_1L14register_floatIdEEvPKc();
 $3 = (__ZN10emscripten8internal6TypeIDINSt3__212basic_stringIcNS2_11char_traitsIcEENS2_9allocatorIcEEEEE3getEv()|0);
 __embind_register_std_string(($3|0),(2114|0));
 $4 = (__ZN10emscripten8internal6TypeIDINSt3__212basic_stringIhNS2_11char_traitsIhEENS2_9allocatorIhEEEEE3getEv()|0);
 __embind_register_std_string(($4|0),(2126|0));
 $5 = (__ZN10emscripten8internal6TypeIDINSt3__212basic_stringIwNS2_11char_traitsIwEENS2_9allocatorIwEEEEE3getEv()|0);
 __embind_register_std_wstring(($5|0),4,(2159|0));
 $6 = (__ZN10emscripten8internal6TypeIDINS_3valEE3getEv()|0);
 __embind_register_emval(($6|0),(2172|0));
 __ZN12_GLOBAL__N_1L20register_memory_viewIcEEvPKc();
 __ZN12_GLOBAL__N_1L20register_memory_viewIaEEvPKc(2188);
 __ZN12_GLOBAL__N_1L20register_memory_viewIhEEvPKc(2225);
 __ZN12_GLOBAL__N_1L20register_memory_viewIsEEvPKc(2264);
 __ZN12_GLOBAL__N_1L20register_memory_viewItEEvPKc(2295);
 __ZN12_GLOBAL__N_1L20register_memory_viewIiEEvPKc(2335);
 __ZN12_GLOBAL__N_1L20register_memory_viewIjEEvPKc(2364);
 __ZN12_GLOBAL__N_1L20register_memory_viewIlEEvPKc();
 __ZN12_GLOBAL__N_1L20register_memory_viewImEEvPKc();
 __ZN12_GLOBAL__N_1L20register_memory_viewIaEEvPKc(2402);
 __ZN12_GLOBAL__N_1L20register_memory_viewIhEEvPKc(2434);
 __ZN12_GLOBAL__N_1L20register_memory_viewIsEEvPKc(2467);
 __ZN12_GLOBAL__N_1L20register_memory_viewItEEvPKc(2500);
 __ZN12_GLOBAL__N_1L20register_memory_viewIiEEvPKc(2534);
 __ZN12_GLOBAL__N_1L20register_memory_viewIjEEvPKc(2567);
 __ZN12_GLOBAL__N_1L20register_memory_viewIfEEvPKc();
 __ZN12_GLOBAL__N_1L20register_memory_viewIdEEvPKc();
 __ZN12_GLOBAL__N_1L20register_memory_viewIeEEvPKc();
 return;
}
function __ZN10emscripten8internal6TypeIDIvE3getEv() {
 var $0 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = (__ZN10emscripten8internal11LightTypeIDIvE3getEv()|0);
 return ($0|0);
}
function __ZN10emscripten8internal6TypeIDIbE3getEv() {
 var $0 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = (__ZN10emscripten8internal11LightTypeIDIbE3getEv()|0);
 return ($0|0);
}
function __ZN12_GLOBAL__N_1L16register_integerIcEEvPKc() {
 var $0 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = (__ZN10emscripten8internal6TypeIDIcE3getEv()|0);
 __embind_register_integer(($0|0),(3495|0),1,-128,127);
 return;
}
function __ZN12_GLOBAL__N_1L16register_integerIaEEvPKc() {
 var $0 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = (__ZN10emscripten8internal6TypeIDIaE3getEv()|0);
 __embind_register_integer(($0|0),(3483|0),1,-128,127);
 return;
}
function __ZN12_GLOBAL__N_1L16register_integerIhEEvPKc() {
 var $0 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = (__ZN10emscripten8internal6TypeIDIhE3getEv()|0);
 __embind_register_integer(($0|0),(3469|0),1,0,255);
 return;
}
function __ZN12_GLOBAL__N_1L16register_integerIsEEvPKc() {
 var $0 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = (__ZN10emscripten8internal6TypeIDIsE3getEv()|0);
 __embind_register_integer(($0|0),(3463|0),2,-32768,32767);
 return;
}
function __ZN12_GLOBAL__N_1L16register_integerItEEvPKc() {
 var $0 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = (__ZN10emscripten8internal6TypeIDItE3getEv()|0);
 __embind_register_integer(($0|0),(3448|0),2,0,65535);
 return;
}
function __ZN12_GLOBAL__N_1L16register_integerIiEEvPKc() {
 var $0 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = (__ZN10emscripten8internal6TypeIDIiE3getEv()|0);
 __embind_register_integer(($0|0),(3444|0),4,-2147483648,2147483647);
 return;
}
function __ZN12_GLOBAL__N_1L16register_integerIjEEvPKc() {
 var $0 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = (__ZN10emscripten8internal6TypeIDIjE3getEv()|0);
 __embind_register_integer(($0|0),(3431|0),4,0,-1);
 return;
}
function __ZN12_GLOBAL__N_1L16register_integerIlEEvPKc() {
 var $0 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = (__ZN10emscripten8internal6TypeIDIlE3getEv()|0);
 __embind_register_integer(($0|0),(3426|0),4,-2147483648,2147483647);
 return;
}
function __ZN12_GLOBAL__N_1L16register_integerImEEvPKc() {
 var $0 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = (__ZN10emscripten8internal6TypeIDImE3getEv()|0);
 __embind_register_integer(($0|0),(3412|0),4,0,-1);
 return;
}
function __ZN12_GLOBAL__N_1L14register_floatIfEEvPKc() {
 var $0 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = (__ZN10emscripten8internal6TypeIDIfE3getEv()|0);
 __embind_register_float(($0|0),(3406|0),4);
 return;
}
function __ZN12_GLOBAL__N_1L14register_floatIdEEvPKc() {
 var $0 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = (__ZN10emscripten8internal6TypeIDIdE3getEv()|0);
 __embind_register_float(($0|0),(3399|0),8);
 return;
}
function __ZN10emscripten8internal6TypeIDINSt3__212basic_stringIcNS2_11char_traitsIcEENS2_9allocatorIcEEEEE3getEv() {
 var $0 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = (__ZN10emscripten8internal11LightTypeIDINSt3__212basic_stringIcNS2_11char_traitsIcEENS2_9allocatorIcEEEEE3getEv()|0);
 return ($0|0);
}
function __ZN10emscripten8internal6TypeIDINSt3__212basic_stringIhNS2_11char_traitsIhEENS2_9allocatorIhEEEEE3getEv() {
 var $0 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = (__ZN10emscripten8internal11LightTypeIDINSt3__212basic_stringIhNS2_11char_traitsIhEENS2_9allocatorIhEEEEE3getEv()|0);
 return ($0|0);
}
function __ZN10emscripten8internal6TypeIDINSt3__212basic_stringIwNS2_11char_traitsIwEENS2_9allocatorIwEEEEE3getEv() {
 var $0 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = (__ZN10emscripten8internal11LightTypeIDINSt3__212basic_stringIwNS2_11char_traitsIwEENS2_9allocatorIwEEEEE3getEv()|0);
 return ($0|0);
}
function __ZN10emscripten8internal6TypeIDINS_3valEE3getEv() {
 var $0 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = (__ZN10emscripten8internal11LightTypeIDINS_3valEE3getEv()|0);
 return ($0|0);
}
function __ZN12_GLOBAL__N_1L20register_memory_viewIcEEvPKc() {
 var $0 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = (__ZN10emscripten8internal6TypeIDINS_11memory_viewIcEEE3getEv()|0);
 __embind_register_memory_view(($0|0),0,(3111|0));
 return;
}
function __ZN12_GLOBAL__N_1L20register_memory_viewIaEEvPKc($0) {
 $0 = $0|0;
 var $1 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $1 = (__ZN10emscripten8internal6TypeIDINS_11memory_viewIaEEE3getEv()|0);
 __embind_register_memory_view(($1|0),0,($0|0));
 return;
}
function __ZN12_GLOBAL__N_1L20register_memory_viewIhEEvPKc($0) {
 $0 = $0|0;
 var $1 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $1 = (__ZN10emscripten8internal6TypeIDINS_11memory_viewIhEEE3getEv()|0);
 __embind_register_memory_view(($1|0),1,($0|0));
 return;
}
function __ZN12_GLOBAL__N_1L20register_memory_viewIsEEvPKc($0) {
 $0 = $0|0;
 var $1 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $1 = (__ZN10emscripten8internal6TypeIDINS_11memory_viewIsEEE3getEv()|0);
 __embind_register_memory_view(($1|0),2,($0|0));
 return;
}
function __ZN12_GLOBAL__N_1L20register_memory_viewItEEvPKc($0) {
 $0 = $0|0;
 var $1 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $1 = (__ZN10emscripten8internal6TypeIDINS_11memory_viewItEEE3getEv()|0);
 __embind_register_memory_view(($1|0),3,($0|0));
 return;
}
function __ZN12_GLOBAL__N_1L20register_memory_viewIiEEvPKc($0) {
 $0 = $0|0;
 var $1 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $1 = (__ZN10emscripten8internal6TypeIDINS_11memory_viewIiEEE3getEv()|0);
 __embind_register_memory_view(($1|0),4,($0|0));
 return;
}
function __ZN12_GLOBAL__N_1L20register_memory_viewIjEEvPKc($0) {
 $0 = $0|0;
 var $1 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $1 = (__ZN10emscripten8internal6TypeIDINS_11memory_viewIjEEE3getEv()|0);
 __embind_register_memory_view(($1|0),5,($0|0));
 return;
}
function __ZN12_GLOBAL__N_1L20register_memory_viewIlEEvPKc() {
 var $0 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = (__ZN10emscripten8internal6TypeIDINS_11memory_viewIlEEE3getEv()|0);
 __embind_register_memory_view(($0|0),4,(2864|0));
 return;
}
function __ZN12_GLOBAL__N_1L20register_memory_viewImEEvPKc() {
 var $0 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = (__ZN10emscripten8internal6TypeIDINS_11memory_viewImEEE3getEv()|0);
 __embind_register_memory_view(($0|0),5,(2794|0));
 return;
}
function __ZN12_GLOBAL__N_1L20register_memory_viewIfEEvPKc() {
 var $0 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = (__ZN10emscripten8internal6TypeIDINS_11memory_viewIfEEE3getEv()|0);
 __embind_register_memory_view(($0|0),6,(2732|0));
 return;
}
function __ZN12_GLOBAL__N_1L20register_memory_viewIdEEvPKc() {
 var $0 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = (__ZN10emscripten8internal6TypeIDINS_11memory_viewIdEEE3getEv()|0);
 __embind_register_memory_view(($0|0),7,(2669|0));
 return;
}
function __ZN12_GLOBAL__N_1L20register_memory_viewIeEEvPKc() {
 var $0 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = (__ZN10emscripten8internal6TypeIDINS_11memory_viewIeEEE3getEv()|0);
 __embind_register_memory_view(($0|0),7,(2601|0));
 return;
}
function __ZN10emscripten8internal6TypeIDINS_11memory_viewIeEEE3getEv() {
 var $0 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = (__ZN10emscripten8internal11LightTypeIDINS_11memory_viewIeEEE3getEv()|0);
 return ($0|0);
}
function __ZN10emscripten8internal11LightTypeIDINS_11memory_viewIeEEE3getEv() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 return (272|0);
}
function __ZN10emscripten8internal6TypeIDINS_11memory_viewIdEEE3getEv() {
 var $0 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = (__ZN10emscripten8internal11LightTypeIDINS_11memory_viewIdEEE3getEv()|0);
 return ($0|0);
}
function __ZN10emscripten8internal11LightTypeIDINS_11memory_viewIdEEE3getEv() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 return (280|0);
}
function __ZN10emscripten8internal6TypeIDINS_11memory_viewIfEEE3getEv() {
 var $0 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = (__ZN10emscripten8internal11LightTypeIDINS_11memory_viewIfEEE3getEv()|0);
 return ($0|0);
}
function __ZN10emscripten8internal11LightTypeIDINS_11memory_viewIfEEE3getEv() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 return (288|0);
}
function __ZN10emscripten8internal6TypeIDINS_11memory_viewImEEE3getEv() {
 var $0 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = (__ZN10emscripten8internal11LightTypeIDINS_11memory_viewImEEE3getEv()|0);
 return ($0|0);
}
function __ZN10emscripten8internal11LightTypeIDINS_11memory_viewImEEE3getEv() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 return (296|0);
}
function __ZN10emscripten8internal6TypeIDINS_11memory_viewIlEEE3getEv() {
 var $0 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = (__ZN10emscripten8internal11LightTypeIDINS_11memory_viewIlEEE3getEv()|0);
 return ($0|0);
}
function __ZN10emscripten8internal11LightTypeIDINS_11memory_viewIlEEE3getEv() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 return (304|0);
}
function __ZN10emscripten8internal6TypeIDINS_11memory_viewIjEEE3getEv() {
 var $0 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = (__ZN10emscripten8internal11LightTypeIDINS_11memory_viewIjEEE3getEv()|0);
 return ($0|0);
}
function __ZN10emscripten8internal11LightTypeIDINS_11memory_viewIjEEE3getEv() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 return (312|0);
}
function __ZN10emscripten8internal6TypeIDINS_11memory_viewIiEEE3getEv() {
 var $0 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = (__ZN10emscripten8internal11LightTypeIDINS_11memory_viewIiEEE3getEv()|0);
 return ($0|0);
}
function __ZN10emscripten8internal11LightTypeIDINS_11memory_viewIiEEE3getEv() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 return (320|0);
}
function __ZN10emscripten8internal6TypeIDINS_11memory_viewItEEE3getEv() {
 var $0 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = (__ZN10emscripten8internal11LightTypeIDINS_11memory_viewItEEE3getEv()|0);
 return ($0|0);
}
function __ZN10emscripten8internal11LightTypeIDINS_11memory_viewItEEE3getEv() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 return (328|0);
}
function __ZN10emscripten8internal6TypeIDINS_11memory_viewIsEEE3getEv() {
 var $0 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = (__ZN10emscripten8internal11LightTypeIDINS_11memory_viewIsEEE3getEv()|0);
 return ($0|0);
}
function __ZN10emscripten8internal11LightTypeIDINS_11memory_viewIsEEE3getEv() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 return (336|0);
}
function __ZN10emscripten8internal6TypeIDINS_11memory_viewIhEEE3getEv() {
 var $0 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = (__ZN10emscripten8internal11LightTypeIDINS_11memory_viewIhEEE3getEv()|0);
 return ($0|0);
}
function __ZN10emscripten8internal11LightTypeIDINS_11memory_viewIhEEE3getEv() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 return (344|0);
}
function __ZN10emscripten8internal6TypeIDINS_11memory_viewIaEEE3getEv() {
 var $0 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = (__ZN10emscripten8internal11LightTypeIDINS_11memory_viewIaEEE3getEv()|0);
 return ($0|0);
}
function __ZN10emscripten8internal11LightTypeIDINS_11memory_viewIaEEE3getEv() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 return (352|0);
}
function __ZN10emscripten8internal6TypeIDINS_11memory_viewIcEEE3getEv() {
 var $0 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = (__ZN10emscripten8internal11LightTypeIDINS_11memory_viewIcEEE3getEv()|0);
 return ($0|0);
}
function __ZN10emscripten8internal11LightTypeIDINS_11memory_viewIcEEE3getEv() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 return (360|0);
}
function __ZN10emscripten8internal11LightTypeIDINS_3valEE3getEv() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 return (232|0);
}
function __ZN10emscripten8internal11LightTypeIDINSt3__212basic_stringIwNS2_11char_traitsIwEENS2_9allocatorIwEEEEE3getEv() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 return (368|0);
}
function __ZN10emscripten8internal11LightTypeIDINSt3__212basic_stringIhNS2_11char_traitsIhEENS2_9allocatorIhEEEEE3getEv() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 return (400|0);
}
function __ZN10emscripten8internal11LightTypeIDINSt3__212basic_stringIcNS2_11char_traitsIcEENS2_9allocatorIcEEEEE3getEv() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 return (424|0);
}
function __ZN10emscripten8internal6TypeIDIdE3getEv() {
 var $0 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = (__ZN10emscripten8internal11LightTypeIDIdE3getEv()|0);
 return ($0|0);
}
function __ZN10emscripten8internal11LightTypeIDIdE3getEv() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 return (680|0);
}
function __ZN10emscripten8internal6TypeIDImE3getEv() {
 var $0 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = (__ZN10emscripten8internal11LightTypeIDImE3getEv()|0);
 return ($0|0);
}
function __ZN10emscripten8internal11LightTypeIDImE3getEv() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 return (664|0);
}
function __ZN10emscripten8internal6TypeIDIlE3getEv() {
 var $0 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = (__ZN10emscripten8internal11LightTypeIDIlE3getEv()|0);
 return ($0|0);
}
function __ZN10emscripten8internal11LightTypeIDIlE3getEv() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 return (656|0);
}
function __ZN10emscripten8internal6TypeIDIiE3getEv() {
 var $0 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = (__ZN10emscripten8internal11LightTypeIDIiE3getEv()|0);
 return ($0|0);
}
function __ZN10emscripten8internal11LightTypeIDIiE3getEv() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 return (640|0);
}
function __ZN10emscripten8internal6TypeIDItE3getEv() {
 var $0 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = (__ZN10emscripten8internal11LightTypeIDItE3getEv()|0);
 return ($0|0);
}
function __ZN10emscripten8internal11LightTypeIDItE3getEv() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 return (632|0);
}
function __ZN10emscripten8internal6TypeIDIsE3getEv() {
 var $0 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = (__ZN10emscripten8internal11LightTypeIDIsE3getEv()|0);
 return ($0|0);
}
function __ZN10emscripten8internal11LightTypeIDIsE3getEv() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 return (624|0);
}
function __ZN10emscripten8internal6TypeIDIhE3getEv() {
 var $0 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = (__ZN10emscripten8internal11LightTypeIDIhE3getEv()|0);
 return ($0|0);
}
function __ZN10emscripten8internal11LightTypeIDIhE3getEv() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 return (608|0);
}
function __ZN10emscripten8internal6TypeIDIaE3getEv() {
 var $0 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = (__ZN10emscripten8internal11LightTypeIDIaE3getEv()|0);
 return ($0|0);
}
function __ZN10emscripten8internal11LightTypeIDIaE3getEv() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 return (616|0);
}
function __ZN10emscripten8internal6TypeIDIcE3getEv() {
 var $0 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = (__ZN10emscripten8internal11LightTypeIDIcE3getEv()|0);
 return ($0|0);
}
function __ZN10emscripten8internal11LightTypeIDIcE3getEv() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 return (600|0);
}
function __ZN10emscripten8internal11LightTypeIDIbE3getEv() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 return (592|0);
}
function __ZN10emscripten8internal11LightTypeIDIvE3getEv() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 return (576|0);
}
function ___getTypeName($0) {
 $0 = $0|0;
 var $1 = 0, $2 = 0, $3 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $1 = ((($0)) + 4|0);
 $2 = HEAP32[$1>>2]|0;
 $3 = (___strdup($2)|0);
 return ($3|0);
}
function ___stdio_close($0) {
 $0 = $0|0;
 var $1 = 0, $2 = 0, $3 = 0, $4 = 0, $vararg_buffer = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0;
 $vararg_buffer = sp;
 $1 = ((($0)) + 60|0);
 $2 = HEAP32[$1>>2]|0;
 HEAP32[$vararg_buffer>>2] = $2;
 $3 = (___syscall6(6,($vararg_buffer|0))|0);
 $4 = (___syscall_ret($3)|0);
 STACKTOP = sp;return ($4|0);
}
function ___stdio_write($0,$1,$2) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 var $$0 = 0, $$056 = 0, $$058 = 0, $$059 = 0, $$061 = 0, $$1 = 0, $$157 = 0, $$160 = 0, $$phi$trans$insert = 0, $$pre = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0;
 var $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0, $27 = 0, $28 = 0, $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0;
 var $39 = 0, $4 = 0, $40 = 0, $41 = 0, $42 = 0, $43 = 0, $44 = 0, $45 = 0, $46 = 0, $47 = 0, $48 = 0, $49 = 0, $5 = 0, $50 = 0, $51 = 0, $52 = 0, $53 = 0, $6 = 0, $7 = 0, $8 = 0;
 var $9 = 0, $vararg_buffer = 0, $vararg_buffer3 = 0, $vararg_ptr1 = 0, $vararg_ptr2 = 0, $vararg_ptr6 = 0, $vararg_ptr7 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 48|0;
 $vararg_buffer3 = sp + 16|0;
 $vararg_buffer = sp;
 $3 = sp + 32|0;
 $4 = ((($0)) + 28|0);
 $5 = HEAP32[$4>>2]|0;
 HEAP32[$3>>2] = $5;
 $6 = ((($3)) + 4|0);
 $7 = ((($0)) + 20|0);
 $8 = HEAP32[$7>>2]|0;
 $9 = (($8) - ($5))|0;
 HEAP32[$6>>2] = $9;
 $10 = ((($3)) + 8|0);
 HEAP32[$10>>2] = $1;
 $11 = ((($3)) + 12|0);
 HEAP32[$11>>2] = $2;
 $12 = (($9) + ($2))|0;
 $13 = ((($0)) + 60|0);
 $14 = ((($0)) + 44|0);
 $$056 = 2;$$058 = $12;$$059 = $3;
 while(1) {
  $15 = HEAP32[1678]|0;
  $16 = ($15|0)==(0|0);
  if ($16) {
   $20 = HEAP32[$13>>2]|0;
   HEAP32[$vararg_buffer3>>2] = $20;
   $vararg_ptr6 = ((($vararg_buffer3)) + 4|0);
   HEAP32[$vararg_ptr6>>2] = $$059;
   $vararg_ptr7 = ((($vararg_buffer3)) + 8|0);
   HEAP32[$vararg_ptr7>>2] = $$056;
   $21 = (___syscall146(146,($vararg_buffer3|0))|0);
   $22 = (___syscall_ret($21)|0);
   $$0 = $22;
  } else {
   _pthread_cleanup_push((18|0),($0|0));
   $17 = HEAP32[$13>>2]|0;
   HEAP32[$vararg_buffer>>2] = $17;
   $vararg_ptr1 = ((($vararg_buffer)) + 4|0);
   HEAP32[$vararg_ptr1>>2] = $$059;
   $vararg_ptr2 = ((($vararg_buffer)) + 8|0);
   HEAP32[$vararg_ptr2>>2] = $$056;
   $18 = (___syscall146(146,($vararg_buffer|0))|0);
   $19 = (___syscall_ret($18)|0);
   _pthread_cleanup_pop(0);
   $$0 = $19;
  }
  $23 = ($$058|0)==($$0|0);
  if ($23) {
   label = 6;
   break;
  }
  $30 = ($$0|0)<(0);
  if ($30) {
   label = 8;
   break;
  }
  $38 = (($$058) - ($$0))|0;
  $39 = ((($$059)) + 4|0);
  $40 = HEAP32[$39>>2]|0;
  $41 = ($$0>>>0)>($40>>>0);
  if ($41) {
   $42 = HEAP32[$14>>2]|0;
   HEAP32[$4>>2] = $42;
   HEAP32[$7>>2] = $42;
   $43 = (($$0) - ($40))|0;
   $44 = ((($$059)) + 8|0);
   $45 = (($$056) + -1)|0;
   $$phi$trans$insert = ((($$059)) + 12|0);
   $$pre = HEAP32[$$phi$trans$insert>>2]|0;
   $$1 = $43;$$157 = $45;$$160 = $44;$53 = $$pre;
  } else {
   $46 = ($$056|0)==(2);
   if ($46) {
    $47 = HEAP32[$4>>2]|0;
    $48 = (($47) + ($$0)|0);
    HEAP32[$4>>2] = $48;
    $$1 = $$0;$$157 = 2;$$160 = $$059;$53 = $40;
   } else {
    $$1 = $$0;$$157 = $$056;$$160 = $$059;$53 = $40;
   }
  }
  $49 = HEAP32[$$160>>2]|0;
  $50 = (($49) + ($$1)|0);
  HEAP32[$$160>>2] = $50;
  $51 = ((($$160)) + 4|0);
  $52 = (($53) - ($$1))|0;
  HEAP32[$51>>2] = $52;
  $$056 = $$157;$$058 = $38;$$059 = $$160;
 }
 if ((label|0) == 6) {
  $24 = HEAP32[$14>>2]|0;
  $25 = ((($0)) + 48|0);
  $26 = HEAP32[$25>>2]|0;
  $27 = (($24) + ($26)|0);
  $28 = ((($0)) + 16|0);
  HEAP32[$28>>2] = $27;
  $29 = $24;
  HEAP32[$4>>2] = $29;
  HEAP32[$7>>2] = $29;
  $$061 = $2;
 }
 else if ((label|0) == 8) {
  $31 = ((($0)) + 16|0);
  HEAP32[$31>>2] = 0;
  HEAP32[$4>>2] = 0;
  HEAP32[$7>>2] = 0;
  $32 = HEAP32[$0>>2]|0;
  $33 = $32 | 32;
  HEAP32[$0>>2] = $33;
  $34 = ($$056|0)==(2);
  if ($34) {
   $$061 = 0;
  } else {
   $35 = ((($$059)) + 4|0);
   $36 = HEAP32[$35>>2]|0;
   $37 = (($2) - ($36))|0;
   $$061 = $37;
  }
 }
 STACKTOP = sp;return ($$061|0);
}
function ___stdio_seek($0,$1,$2) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 var $$pre = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, $vararg_buffer = 0, $vararg_ptr1 = 0, $vararg_ptr2 = 0, $vararg_ptr3 = 0, $vararg_ptr4 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 32|0;
 $vararg_buffer = sp;
 $3 = sp + 20|0;
 $4 = ((($0)) + 60|0);
 $5 = HEAP32[$4>>2]|0;
 HEAP32[$vararg_buffer>>2] = $5;
 $vararg_ptr1 = ((($vararg_buffer)) + 4|0);
 HEAP32[$vararg_ptr1>>2] = 0;
 $vararg_ptr2 = ((($vararg_buffer)) + 8|0);
 HEAP32[$vararg_ptr2>>2] = $1;
 $vararg_ptr3 = ((($vararg_buffer)) + 12|0);
 HEAP32[$vararg_ptr3>>2] = $3;
 $vararg_ptr4 = ((($vararg_buffer)) + 16|0);
 HEAP32[$vararg_ptr4>>2] = $2;
 $6 = (___syscall140(140,($vararg_buffer|0))|0);
 $7 = (___syscall_ret($6)|0);
 $8 = ($7|0)<(0);
 if ($8) {
  HEAP32[$3>>2] = -1;
  $9 = -1;
 } else {
  $$pre = HEAP32[$3>>2]|0;
  $9 = $$pre;
 }
 STACKTOP = sp;return ($9|0);
}
function ___syscall_ret($0) {
 $0 = $0|0;
 var $$0 = 0, $1 = 0, $2 = 0, $3 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $1 = ($0>>>0)>(4294963200);
 if ($1) {
  $2 = (0 - ($0))|0;
  $3 = (___errno_location()|0);
  HEAP32[$3>>2] = $2;
  $$0 = -1;
 } else {
  $$0 = $0;
 }
 return ($$0|0);
}
function ___errno_location() {
 var $$0 = 0, $0 = 0, $1 = 0, $2 = 0, $3 = 0, $4 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = HEAP32[1678]|0;
 $1 = ($0|0)==(0|0);
 if ($1) {
  $$0 = 6756;
 } else {
  $2 = (_pthread_self()|0);
  $3 = ((($2)) + 64|0);
  $4 = HEAP32[$3>>2]|0;
  $$0 = $4;
 }
 return ($$0|0);
}
function _cleanup($0) {
 $0 = $0|0;
 var $1 = 0, $2 = 0, $3 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $1 = ((($0)) + 68|0);
 $2 = HEAP32[$1>>2]|0;
 $3 = ($2|0)==(0);
 if ($3) {
  ___unlockfile($0);
 }
 return;
}
function ___unlockfile($0) {
 $0 = $0|0;
 var label = 0, sp = 0;
 sp = STACKTOP;
 return;
}
function ___stdout_write($0,$1,$2) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 var $10 = 0, $11 = 0, $12 = 0, $13 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, $vararg_buffer = 0, $vararg_ptr1 = 0, $vararg_ptr2 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 80|0;
 $vararg_buffer = sp;
 $3 = sp + 12|0;
 $4 = ((($0)) + 36|0);
 HEAP32[$4>>2] = 1;
 $5 = HEAP32[$0>>2]|0;
 $6 = $5 & 64;
 $7 = ($6|0)==(0);
 if ($7) {
  $8 = ((($0)) + 60|0);
  $9 = HEAP32[$8>>2]|0;
  HEAP32[$vararg_buffer>>2] = $9;
  $vararg_ptr1 = ((($vararg_buffer)) + 4|0);
  HEAP32[$vararg_ptr1>>2] = 21505;
  $vararg_ptr2 = ((($vararg_buffer)) + 8|0);
  HEAP32[$vararg_ptr2>>2] = $3;
  $10 = (___syscall54(54,($vararg_buffer|0))|0);
  $11 = ($10|0)==(0);
  if (!($11)) {
   $12 = ((($0)) + 75|0);
   HEAP8[$12>>0] = -1;
  }
 }
 $13 = (___stdio_write($0,$1,$2)|0);
 STACKTOP = sp;return ($13|0);
}
function _strerror($0) {
 $0 = $0|0;
 var $$011$lcssa = 0, $$01113 = 0, $$015 = 0, $$112 = 0, $$114 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $$015 = 0;
 while(1) {
  $2 = (3500 + ($$015)|0);
  $3 = HEAP8[$2>>0]|0;
  $4 = $3&255;
  $5 = ($4|0)==($0|0);
  if ($5) {
   label = 2;
   break;
  }
  $6 = (($$015) + 1)|0;
  $7 = ($6|0)==(87);
  if ($7) {
   $$01113 = 3588;$$114 = 87;
   label = 5;
   break;
  } else {
   $$015 = $6;
  }
 }
 if ((label|0) == 2) {
  $1 = ($$015|0)==(0);
  if ($1) {
   $$011$lcssa = 3588;
  } else {
   $$01113 = 3588;$$114 = $$015;
   label = 5;
  }
 }
 if ((label|0) == 5) {
  while(1) {
   label = 0;
   $$112 = $$01113;
   while(1) {
    $8 = HEAP8[$$112>>0]|0;
    $9 = ($8<<24>>24)==(0);
    $10 = ((($$112)) + 1|0);
    if ($9) {
     break;
    } else {
     $$112 = $10;
    }
   }
   $11 = (($$114) + -1)|0;
   $12 = ($11|0)==(0);
   if ($12) {
    $$011$lcssa = $10;
    break;
   } else {
    $$01113 = $10;$$114 = $11;
    label = 5;
   }
  }
 }
 return ($$011$lcssa|0);
}
function _frexpl($0,$1) {
 $0 = +$0;
 $1 = $1|0;
 var $2 = 0.0, label = 0, sp = 0;
 sp = STACKTOP;
 $2 = (+_frexp($0,$1));
 return (+$2);
}
function _frexp($0,$1) {
 $0 = +$0;
 $1 = $1|0;
 var $$0 = 0.0, $$016 = 0.0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0.0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0.0, $9 = 0.0, $storemerge = 0, $trunc$clear = 0, label = 0;
 var sp = 0;
 sp = STACKTOP;
 HEAPF64[tempDoublePtr>>3] = $0;$2 = HEAP32[tempDoublePtr>>2]|0;
 $3 = HEAP32[tempDoublePtr+4>>2]|0;
 $4 = (_bitshift64Lshr(($2|0),($3|0),52)|0);
 $5 = tempRet0;
 $6 = $4&65535;
 $trunc$clear = $6 & 2047;
 switch ($trunc$clear<<16>>16) {
 case 0:  {
  $7 = $0 != 0.0;
  if ($7) {
   $8 = $0 * 1.8446744073709552E+19;
   $9 = (+_frexp($8,$1));
   $10 = HEAP32[$1>>2]|0;
   $11 = (($10) + -64)|0;
   $$016 = $9;$storemerge = $11;
  } else {
   $$016 = $0;$storemerge = 0;
  }
  HEAP32[$1>>2] = $storemerge;
  $$0 = $$016;
  break;
 }
 case 2047:  {
  $$0 = $0;
  break;
 }
 default: {
  $12 = $4 & 2047;
  $13 = (($12) + -1022)|0;
  HEAP32[$1>>2] = $13;
  $14 = $3 & -2146435073;
  $15 = $14 | 1071644672;
  HEAP32[tempDoublePtr>>2] = $2;HEAP32[tempDoublePtr+4>>2] = $15;$16 = +HEAPF64[tempDoublePtr>>3];
  $$0 = $16;
 }
 }
 return (+$$0);
}
function _vfprintf($0,$1,$2) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 var $$ = 0, $$0 = 0, $$1 = 0, $$1$ = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0;
 var $26 = 0, $27 = 0, $28 = 0, $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0, $5 = 0, $6 = 0, $7 = 0;
 var $8 = 0, $9 = 0, $vacopy_currentptr = 0, dest = 0, label = 0, sp = 0, stop = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 224|0;
 $3 = sp + 120|0;
 $4 = sp + 80|0;
 $5 = sp;
 $6 = sp + 136|0;
 dest=$4; stop=dest+40|0; do { HEAP32[dest>>2]=0|0; dest=dest+4|0; } while ((dest|0) < (stop|0));
 $vacopy_currentptr = HEAP32[$2>>2]|0;
 HEAP32[$3>>2] = $vacopy_currentptr;
 $7 = (_printf_core(0,$1,$3,$5,$4)|0);
 $8 = ($7|0)<(0);
 if ($8) {
  $$0 = -1;
 } else {
  $9 = ((($0)) + 76|0);
  $10 = HEAP32[$9>>2]|0;
  $11 = ($10|0)>(-1);
  if ($11) {
   $12 = (___lockfile($0)|0);
   $39 = $12;
  } else {
   $39 = 0;
  }
  $13 = HEAP32[$0>>2]|0;
  $14 = $13 & 32;
  $15 = ((($0)) + 74|0);
  $16 = HEAP8[$15>>0]|0;
  $17 = ($16<<24>>24)<(1);
  if ($17) {
   $18 = $13 & -33;
   HEAP32[$0>>2] = $18;
  }
  $19 = ((($0)) + 48|0);
  $20 = HEAP32[$19>>2]|0;
  $21 = ($20|0)==(0);
  if ($21) {
   $23 = ((($0)) + 44|0);
   $24 = HEAP32[$23>>2]|0;
   HEAP32[$23>>2] = $6;
   $25 = ((($0)) + 28|0);
   HEAP32[$25>>2] = $6;
   $26 = ((($0)) + 20|0);
   HEAP32[$26>>2] = $6;
   HEAP32[$19>>2] = 80;
   $27 = ((($6)) + 80|0);
   $28 = ((($0)) + 16|0);
   HEAP32[$28>>2] = $27;
   $29 = (_printf_core($0,$1,$3,$5,$4)|0);
   $30 = ($24|0)==(0|0);
   if ($30) {
    $$1 = $29;
   } else {
    $31 = ((($0)) + 36|0);
    $32 = HEAP32[$31>>2]|0;
    (FUNCTION_TABLE_iiii[$32 & 15]($0,0,0)|0);
    $33 = HEAP32[$26>>2]|0;
    $34 = ($33|0)==(0|0);
    $$ = $34 ? -1 : $29;
    HEAP32[$23>>2] = $24;
    HEAP32[$19>>2] = 0;
    HEAP32[$28>>2] = 0;
    HEAP32[$25>>2] = 0;
    HEAP32[$26>>2] = 0;
    $$1 = $$;
   }
  } else {
   $22 = (_printf_core($0,$1,$3,$5,$4)|0);
   $$1 = $22;
  }
  $35 = HEAP32[$0>>2]|0;
  $36 = $35 & 32;
  $37 = ($36|0)==(0);
  $$1$ = $37 ? $$1 : -1;
  $38 = $35 | $14;
  HEAP32[$0>>2] = $38;
  $40 = ($39|0)==(0);
  if (!($40)) {
   ___unlockfile($0);
  }
  $$0 = $$1$;
 }
 STACKTOP = sp;return ($$0|0);
}
function _printf_core($0,$1,$2,$3,$4) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 $3 = $3|0;
 $4 = $4|0;
 var $$ = 0, $$$0259 = 0, $$$0262 = 0, $$$0269 = 0, $$$3484$i = 0, $$$3484705$i = 0, $$$3484706$i = 0, $$$3501$i = 0, $$$4266 = 0, $$$4502$i = 0, $$$5 = 0, $$$i = 0, $$0 = 0, $$0$i = 0, $$0$lcssa$i300 = 0, $$0228 = 0, $$0229396 = 0, $$0232 = 0, $$0235 = 0, $$0237 = 0;
 var $$0240$lcssa = 0, $$0240$lcssa460 = 0, $$0240395 = 0, $$0243 = 0, $$0247 = 0, $$0249$lcssa = 0, $$0249383 = 0, $$0252 = 0, $$0253 = 0, $$0254 = 0, $$0254$ = 0, $$0259 = 0, $$0262342 = 0, $$0262390 = 0, $$0269 = 0, $$0269$phi = 0, $$0321 = 0, $$0463$lcssa$i = 0, $$0463594$i = 0, $$0464603$i = 0;
 var $$0466$i = 0.0, $$0470$i = 0, $$0471$i = 0.0, $$0479$i = 0, $$0487652$i = 0, $$0488$i = 0, $$0488663$i = 0, $$0488665$i = 0, $$0496$$9$i = 0, $$0497664$i = 0, $$0498$i = 0, $$05$lcssa$i = 0, $$0509592$i = 0.0, $$0510$i = 0, $$0511$i = 0, $$0514647$i = 0, $$0520$i = 0, $$0522$$i = 0, $$0522$i = 0, $$0524$i = 0;
 var $$0526$i = 0, $$0528$i = 0, $$0528639$i = 0, $$0528641$i = 0, $$0531646$i = 0, $$056$i = 0, $$06$i = 0, $$06$i290 = 0, $$06$i298 = 0, $$1 = 0, $$1230407 = 0, $$1233 = 0, $$1236 = 0, $$1238 = 0, $$1241406 = 0, $$1244394 = 0, $$1248 = 0, $$1250 = 0, $$1255 = 0, $$1260 = 0;
 var $$1263 = 0, $$1263$ = 0, $$1270 = 0, $$1322 = 0, $$1465$i = 0, $$1467$i = 0.0, $$1469$i = 0.0, $$1472$i = 0.0, $$1480$i = 0, $$1482$lcssa$i = 0, $$1482671$i = 0, $$1489651$i = 0, $$1499$lcssa$i = 0, $$1499670$i = 0, $$1508593$i = 0, $$1512$lcssa$i = 0, $$1512617$i = 0, $$1515$i = 0, $$1521$i = 0, $$1525$i = 0;
 var $$1527$i = 0, $$1529624$i = 0, $$1532$lcssa$i = 0, $$1532640$i = 0, $$1607$i = 0, $$2 = 0, $$2$i = 0, $$2234 = 0, $$2239 = 0, $$2242381 = 0, $$2245 = 0, $$2251 = 0, $$2256 = 0, $$2256$ = 0, $$2261 = 0, $$2271 = 0, $$2323$lcssa = 0, $$2323382 = 0, $$2473$i = 0.0, $$2476$$545$i = 0;
 var $$2476$$547$i = 0, $$2476$i = 0, $$2483$ph$i = 0, $$2490$lcssa$i = 0, $$2490632$i = 0, $$2500$i = 0, $$2513$i = 0, $$2516628$i = 0, $$2530$i = 0, $$2533627$i = 0, $$3$i = 0.0, $$3257 = 0, $$3265 = 0, $$3272 = 0, $$331 = 0, $$332 = 0, $$333 = 0, $$3379 = 0, $$3477$i = 0, $$3484$lcssa$i = 0;
 var $$3484658$i = 0, $$3501$lcssa$i = 0, $$3501657$i = 0, $$3534623$i = 0, $$4$i = 0.0, $$4258458 = 0, $$4266 = 0, $$4325 = 0, $$4478$lcssa$i = 0, $$4478600$i = 0, $$4492$i = 0, $$4502$i = 0, $$4518$i = 0, $$5 = 0, $$5$lcssa$i = 0, $$537$i = 0, $$538$$i = 0, $$538$i = 0, $$541$i = 0.0, $$544$i = 0;
 var $$546$i = 0, $$5486$lcssa$i = 0, $$5486633$i = 0, $$5493606$i = 0, $$5519$ph$i = 0, $$553$i = 0, $$554$i = 0, $$557$i = 0.0, $$5611$i = 0, $$6 = 0, $$6$i = 0, $$6268 = 0, $$6494599$i = 0, $$7 = 0, $$7495610$i = 0, $$7505$$i = 0, $$7505$i = 0, $$7505$ph$i = 0, $$8$i = 0, $$9$ph$i = 0;
 var $$lcssa683$i = 0, $$neg$i = 0, $$neg572$i = 0, $$pn$i = 0, $$pr = 0, $$pr$i = 0, $$pr571$i = 0, $$pre = 0, $$pre$i = 0, $$pre$phi704$iZ2D = 0, $$pre452 = 0, $$pre453 = 0, $$pre454 = 0, $$pre697$i = 0, $$pre700$i = 0, $$pre703$i = 0, $10 = 0, $100 = 0, $101 = 0, $102 = 0;
 var $103 = 0, $104 = 0, $105 = 0, $106 = 0, $107 = 0, $108 = 0, $109 = 0, $11 = 0, $110 = 0, $111 = 0, $112 = 0, $113 = 0, $114 = 0, $115 = 0, $116 = 0, $117 = 0, $118 = 0, $119 = 0, $12 = 0, $120 = 0;
 var $121 = 0, $122 = 0, $123 = 0, $124 = 0, $125 = 0, $126 = 0, $127 = 0, $128 = 0, $129 = 0, $13 = 0, $130 = 0, $131 = 0, $132 = 0, $133 = 0, $134 = 0, $135 = 0, $136 = 0, $137 = 0, $138 = 0, $139 = 0;
 var $14 = 0, $140 = 0, $141 = 0, $142 = 0, $143 = 0, $144 = 0, $145 = 0, $146 = 0, $147 = 0, $148 = 0, $149 = 0, $15 = 0, $150 = 0, $151 = 0, $152 = 0, $153 = 0, $154 = 0, $155 = 0, $156 = 0, $157 = 0;
 var $158 = 0, $159 = 0, $16 = 0, $160 = 0, $161 = 0, $162 = 0, $163 = 0, $164 = 0, $165 = 0, $166 = 0, $167 = 0, $168 = 0, $169 = 0, $17 = 0, $170 = 0, $171 = 0, $172 = 0, $173 = 0, $174 = 0, $175 = 0;
 var $176 = 0, $177 = 0, $178 = 0, $179 = 0, $18 = 0, $180 = 0, $181 = 0, $182 = 0, $183 = 0, $184 = 0, $185 = 0, $186 = 0, $187 = 0, $188 = 0, $189 = 0, $19 = 0, $190 = 0, $191 = 0, $192 = 0, $193 = 0;
 var $194 = 0, $195 = 0, $196 = 0, $197 = 0, $198 = 0, $199 = 0, $20 = 0, $200 = 0, $201 = 0, $202 = 0, $203 = 0, $204 = 0, $205 = 0, $206 = 0, $207 = 0, $208 = 0, $209 = 0, $21 = 0, $210 = 0, $211 = 0;
 var $212 = 0, $213 = 0, $214 = 0, $215 = 0, $216 = 0, $217 = 0, $218 = 0, $219 = 0, $22 = 0, $220 = 0, $221 = 0, $222 = 0, $223 = 0, $224 = 0, $225 = 0, $226 = 0, $227 = 0, $228 = 0, $229 = 0, $23 = 0;
 var $230 = 0, $231 = 0, $232 = 0, $233 = 0, $234 = 0, $235 = 0, $236 = 0, $237 = 0, $238 = 0, $239 = 0, $24 = 0, $240 = 0, $241 = 0, $242 = 0, $243 = 0, $244 = 0, $245 = 0, $246 = 0, $247 = 0, $248 = 0;
 var $249 = 0, $25 = 0, $250 = 0, $251 = 0, $252 = 0, $253 = 0, $254 = 0, $255 = 0, $256 = 0, $257 = 0, $258 = 0, $259 = 0, $26 = 0, $260 = 0, $261 = 0, $262 = 0, $263 = 0, $264 = 0, $265 = 0, $266 = 0;
 var $267 = 0, $268 = 0, $269 = 0, $27 = 0, $270 = 0, $271 = 0, $272 = 0, $273 = 0, $274 = 0, $275 = 0, $276 = 0, $277 = 0, $278 = 0, $279 = 0, $28 = 0, $280 = 0, $281 = 0, $282 = 0, $283 = 0, $284 = 0;
 var $285 = 0, $286 = 0, $287 = 0, $288 = 0, $289 = 0, $29 = 0, $290 = 0, $291 = 0, $292 = 0, $293 = 0, $294 = 0, $295 = 0, $296 = 0, $297 = 0, $298 = 0, $299 = 0, $30 = 0, $300 = 0, $301 = 0, $302 = 0;
 var $303 = 0, $304 = 0, $305 = 0, $306 = 0, $307 = 0, $308 = 0, $309 = 0, $31 = 0, $310 = 0, $311 = 0, $312 = 0, $313 = 0, $314 = 0, $315 = 0, $316 = 0, $317 = 0, $318 = 0, $319 = 0, $32 = 0, $320 = 0;
 var $321 = 0, $322 = 0, $323 = 0, $324 = 0, $325 = 0, $326 = 0, $327 = 0, $328 = 0, $329 = 0, $33 = 0, $330 = 0, $331 = 0, $332 = 0, $333 = 0, $334 = 0, $335 = 0, $336 = 0, $337 = 0, $338 = 0, $339 = 0;
 var $34 = 0, $340 = 0, $341 = 0, $342 = 0, $343 = 0, $344 = 0, $345 = 0, $346 = 0, $347 = 0, $348 = 0, $349 = 0, $35 = 0, $350 = 0, $351 = 0, $352 = 0, $353 = 0, $354 = 0, $355 = 0, $356 = 0, $357 = 0;
 var $358 = 0, $359 = 0, $36 = 0, $360 = 0, $361 = 0, $362 = 0, $363 = 0, $364 = 0, $365 = 0, $366 = 0, $367 = 0, $368 = 0, $369 = 0, $37 = 0, $370 = 0, $371 = 0.0, $372 = 0, $373 = 0, $374 = 0, $375 = 0.0;
 var $376 = 0, $377 = 0, $378 = 0, $379 = 0, $38 = 0, $380 = 0, $381 = 0, $382 = 0, $383 = 0, $384 = 0, $385 = 0, $386 = 0, $387 = 0, $388 = 0, $389 = 0, $39 = 0, $390 = 0, $391 = 0, $392 = 0, $393 = 0;
 var $394 = 0, $395 = 0, $396 = 0, $397 = 0, $398 = 0, $399 = 0, $40 = 0, $400 = 0, $401 = 0, $402 = 0, $403 = 0.0, $404 = 0.0, $405 = 0, $406 = 0, $407 = 0, $408 = 0, $409 = 0, $41 = 0, $410 = 0, $411 = 0;
 var $412 = 0, $413 = 0, $414 = 0, $415 = 0, $416 = 0, $417 = 0, $418 = 0, $419 = 0.0, $42 = 0, $420 = 0, $421 = 0, $422 = 0, $423 = 0.0, $424 = 0.0, $425 = 0.0, $426 = 0.0, $427 = 0.0, $428 = 0.0, $429 = 0, $43 = 0;
 var $430 = 0, $431 = 0, $432 = 0, $433 = 0, $434 = 0, $435 = 0, $436 = 0, $437 = 0, $438 = 0, $439 = 0, $44 = 0, $440 = 0, $441 = 0, $442 = 0, $443 = 0, $444 = 0, $445 = 0, $446 = 0, $447 = 0, $448 = 0;
 var $449 = 0, $45 = 0, $450 = 0, $451 = 0, $452 = 0, $453 = 0, $454 = 0.0, $455 = 0.0, $456 = 0.0, $457 = 0, $458 = 0, $459 = 0, $46 = 0, $460 = 0, $461 = 0, $462 = 0, $463 = 0, $464 = 0, $465 = 0, $466 = 0;
 var $467 = 0, $468 = 0, $469 = 0, $47 = 0, $470 = 0, $471 = 0, $472 = 0, $473 = 0, $474 = 0, $475 = 0, $476 = 0, $477 = 0, $478 = 0, $479 = 0, $48 = 0, $480 = 0, $481 = 0, $482 = 0, $483 = 0, $484 = 0;
 var $485 = 0, $486 = 0, $487 = 0.0, $488 = 0, $489 = 0, $49 = 0, $490 = 0, $491 = 0, $492 = 0, $493 = 0.0, $494 = 0.0, $495 = 0.0, $496 = 0, $497 = 0, $498 = 0, $499 = 0, $5 = 0, $50 = 0, $500 = 0, $501 = 0;
 var $502 = 0, $503 = 0, $504 = 0, $505 = 0, $506 = 0, $507 = 0, $508 = 0, $509 = 0, $51 = 0, $510 = 0, $511 = 0, $512 = 0, $513 = 0, $514 = 0, $515 = 0, $516 = 0, $517 = 0, $518 = 0, $519 = 0, $52 = 0;
 var $520 = 0, $521 = 0, $522 = 0, $523 = 0, $524 = 0, $525 = 0, $526 = 0, $527 = 0, $528 = 0, $529 = 0, $53 = 0, $530 = 0, $531 = 0, $532 = 0, $533 = 0, $534 = 0, $535 = 0, $536 = 0, $537 = 0, $538 = 0;
 var $539 = 0, $54 = 0, $540 = 0, $541 = 0, $542 = 0, $543 = 0, $544 = 0, $545 = 0, $546 = 0, $547 = 0, $548 = 0, $549 = 0, $55 = 0, $550 = 0, $551 = 0, $552 = 0, $553 = 0, $554 = 0, $555 = 0, $556 = 0;
 var $557 = 0, $558 = 0, $559 = 0, $56 = 0, $560 = 0, $561 = 0, $562 = 0, $563 = 0, $564 = 0, $565 = 0, $566 = 0, $567 = 0, $568 = 0, $569 = 0, $57 = 0, $570 = 0, $571 = 0, $572 = 0, $573 = 0, $574 = 0;
 var $575 = 0, $576 = 0, $577 = 0, $578 = 0, $579 = 0, $58 = 0, $580 = 0, $581 = 0, $582 = 0, $583 = 0, $584 = 0, $585 = 0, $586 = 0, $587 = 0, $588 = 0, $589 = 0, $59 = 0, $590 = 0, $591 = 0, $592 = 0;
 var $593 = 0, $594 = 0, $595 = 0, $596 = 0, $597 = 0, $598 = 0, $599 = 0, $6 = 0, $60 = 0, $600 = 0, $601 = 0, $602 = 0, $603 = 0, $604 = 0, $605 = 0.0, $606 = 0.0, $607 = 0, $608 = 0.0, $609 = 0, $61 = 0;
 var $610 = 0, $611 = 0, $612 = 0, $613 = 0, $614 = 0, $615 = 0, $616 = 0, $617 = 0, $618 = 0, $619 = 0, $62 = 0, $620 = 0, $621 = 0, $622 = 0, $623 = 0, $624 = 0, $625 = 0, $626 = 0, $627 = 0, $628 = 0;
 var $629 = 0, $63 = 0, $630 = 0, $631 = 0, $632 = 0, $633 = 0, $634 = 0, $635 = 0, $636 = 0, $637 = 0, $638 = 0, $639 = 0, $64 = 0, $640 = 0, $641 = 0, $642 = 0, $643 = 0, $644 = 0, $645 = 0, $646 = 0;
 var $647 = 0, $648 = 0, $649 = 0, $65 = 0, $650 = 0, $651 = 0, $652 = 0, $653 = 0, $654 = 0, $655 = 0, $656 = 0, $657 = 0, $658 = 0, $659 = 0, $66 = 0, $660 = 0, $661 = 0, $662 = 0, $663 = 0, $664 = 0;
 var $665 = 0, $666 = 0, $667 = 0, $668 = 0, $669 = 0, $67 = 0, $670 = 0, $671 = 0, $672 = 0, $673 = 0, $674 = 0, $675 = 0, $676 = 0, $677 = 0, $678 = 0, $679 = 0, $68 = 0, $680 = 0, $681 = 0, $682 = 0;
 var $683 = 0, $684 = 0, $685 = 0, $686 = 0, $687 = 0, $688 = 0, $689 = 0, $69 = 0, $690 = 0, $691 = 0, $692 = 0, $693 = 0, $694 = 0, $695 = 0, $696 = 0, $697 = 0, $698 = 0, $699 = 0, $7 = 0, $70 = 0;
 var $700 = 0, $701 = 0, $702 = 0, $703 = 0, $704 = 0, $705 = 0, $706 = 0, $707 = 0, $708 = 0, $709 = 0, $71 = 0, $710 = 0, $711 = 0, $712 = 0, $713 = 0, $714 = 0, $715 = 0, $716 = 0, $717 = 0, $718 = 0;
 var $719 = 0, $72 = 0, $720 = 0, $721 = 0, $722 = 0, $723 = 0, $724 = 0, $725 = 0, $726 = 0, $727 = 0, $728 = 0, $729 = 0, $73 = 0, $730 = 0, $731 = 0, $732 = 0, $733 = 0, $734 = 0, $735 = 0, $736 = 0;
 var $737 = 0, $738 = 0, $739 = 0, $74 = 0, $740 = 0, $741 = 0, $742 = 0, $743 = 0, $744 = 0, $745 = 0, $746 = 0, $747 = 0, $748 = 0, $749 = 0, $75 = 0, $750 = 0, $751 = 0, $752 = 0, $753 = 0, $754 = 0;
 var $755 = 0, $756 = 0, $757 = 0, $758 = 0, $759 = 0, $76 = 0, $760 = 0, $761 = 0, $762 = 0, $763 = 0, $764 = 0, $765 = 0, $766 = 0, $767 = 0, $768 = 0, $769 = 0, $77 = 0, $770 = 0, $771 = 0, $772 = 0;
 var $773 = 0, $774 = 0, $775 = 0, $776 = 0, $777 = 0, $778 = 0, $779 = 0, $78 = 0, $780 = 0, $781 = 0, $782 = 0, $783 = 0, $784 = 0, $785 = 0, $786 = 0, $787 = 0, $788 = 0, $789 = 0, $79 = 0, $790 = 0;
 var $791 = 0, $792 = 0, $793 = 0, $794 = 0, $795 = 0, $796 = 0, $797 = 0, $798 = 0, $799 = 0, $8 = 0, $80 = 0, $800 = 0, $801 = 0, $802 = 0, $803 = 0, $804 = 0, $805 = 0, $806 = 0, $807 = 0, $808 = 0;
 var $809 = 0, $81 = 0, $82 = 0, $83 = 0, $84 = 0, $85 = 0, $86 = 0, $87 = 0, $88 = 0, $89 = 0, $9 = 0, $90 = 0, $91 = 0, $92 = 0, $93 = 0, $94 = 0, $95 = 0, $96 = 0, $97 = 0, $98 = 0;
 var $99 = 0, $arglist_current = 0, $arglist_current2 = 0, $arglist_next = 0, $arglist_next3 = 0, $exitcond$i = 0, $expanded = 0, $expanded10 = 0, $expanded11 = 0, $expanded13 = 0, $expanded14 = 0, $expanded15 = 0, $expanded4 = 0, $expanded6 = 0, $expanded7 = 0, $expanded8 = 0, $isdigit = 0, $isdigit$i = 0, $isdigit$i292 = 0, $isdigit275 = 0;
 var $isdigit277 = 0, $isdigit5$i = 0, $isdigit5$i288 = 0, $isdigittmp = 0, $isdigittmp$ = 0, $isdigittmp$i = 0, $isdigittmp$i291 = 0, $isdigittmp274 = 0, $isdigittmp276 = 0, $isdigittmp4$i = 0, $isdigittmp4$i287 = 0, $isdigittmp7$i = 0, $isdigittmp7$i289 = 0, $notlhs$i = 0, $notrhs$i = 0, $or$cond = 0, $or$cond$i = 0, $or$cond280 = 0, $or$cond282 = 0, $or$cond285 = 0;
 var $or$cond3$not$i = 0, $or$cond412 = 0, $or$cond540$i = 0, $or$cond543$i = 0, $or$cond552$i = 0, $or$cond6$i = 0, $scevgep694$i = 0, $scevgep694695$i = 0, $storemerge = 0, $storemerge273345 = 0, $storemerge273389 = 0, $storemerge278 = 0, $sum = 0, $trunc = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 624|0;
 $5 = sp + 24|0;
 $6 = sp + 16|0;
 $7 = sp + 588|0;
 $8 = sp + 576|0;
 $9 = sp;
 $10 = sp + 536|0;
 $11 = sp + 8|0;
 $12 = sp + 528|0;
 $13 = ($0|0)!=(0|0);
 $14 = ((($10)) + 40|0);
 $15 = $14;
 $16 = ((($10)) + 39|0);
 $17 = ((($11)) + 4|0);
 $18 = $7;
 $19 = (0 - ($18))|0;
 $20 = ((($8)) + 12|0);
 $21 = ((($8)) + 11|0);
 $22 = $20;
 $23 = (($22) - ($18))|0;
 $24 = (-2 - ($18))|0;
 $25 = (($22) + 2)|0;
 $26 = ((($5)) + 288|0);
 $27 = ((($7)) + 9|0);
 $28 = $27;
 $29 = ((($7)) + 8|0);
 $$0243 = 0;$$0247 = 0;$$0269 = 0;$$0321 = $1;
 L1: while(1) {
  $30 = ($$0247|0)>(-1);
  do {
   if ($30) {
    $31 = (2147483647 - ($$0247))|0;
    $32 = ($$0243|0)>($31|0);
    if ($32) {
     $33 = (___errno_location()|0);
     HEAP32[$33>>2] = 75;
     $$1248 = -1;
     break;
    } else {
     $34 = (($$0243) + ($$0247))|0;
     $$1248 = $34;
     break;
    }
   } else {
    $$1248 = $$0247;
   }
  } while(0);
  $35 = HEAP8[$$0321>>0]|0;
  $36 = ($35<<24>>24)==(0);
  if ($36) {
   label = 243;
   break;
  } else {
   $$1322 = $$0321;$37 = $35;
  }
  L9: while(1) {
   switch ($37<<24>>24) {
   case 37:  {
    $$0249383 = $$1322;$$2323382 = $$1322;
    label = 9;
    break L9;
    break;
   }
   case 0:  {
    $$0249$lcssa = $$1322;$$2323$lcssa = $$1322;
    break L9;
    break;
   }
   default: {
   }
   }
   $38 = ((($$1322)) + 1|0);
   $$pre = HEAP8[$38>>0]|0;
   $$1322 = $38;$37 = $$pre;
  }
  L12: do {
   if ((label|0) == 9) {
    while(1) {
     label = 0;
     $39 = ((($$2323382)) + 1|0);
     $40 = HEAP8[$39>>0]|0;
     $41 = ($40<<24>>24)==(37);
     if (!($41)) {
      $$0249$lcssa = $$0249383;$$2323$lcssa = $$2323382;
      break L12;
     }
     $42 = ((($$0249383)) + 1|0);
     $43 = ((($$2323382)) + 2|0);
     $44 = HEAP8[$43>>0]|0;
     $45 = ($44<<24>>24)==(37);
     if ($45) {
      $$0249383 = $42;$$2323382 = $43;
      label = 9;
     } else {
      $$0249$lcssa = $42;$$2323$lcssa = $43;
      break;
     }
    }
   }
  } while(0);
  $46 = $$0249$lcssa;
  $47 = $$0321;
  $48 = (($46) - ($47))|0;
  if ($13) {
   $49 = HEAP32[$0>>2]|0;
   $50 = $49 & 32;
   $51 = ($50|0)==(0);
   if ($51) {
    (___fwritex($$0321,$48,$0)|0);
   }
  }
  $52 = ($48|0)==(0);
  if (!($52)) {
   $$0269$phi = $$0269;$$0243 = $48;$$0247 = $$1248;$$0321 = $$2323$lcssa;$$0269 = $$0269$phi;
   continue;
  }
  $53 = ((($$2323$lcssa)) + 1|0);
  $54 = HEAP8[$53>>0]|0;
  $55 = $54 << 24 >> 24;
  $isdigittmp = (($55) + -48)|0;
  $isdigit = ($isdigittmp>>>0)<(10);
  if ($isdigit) {
   $56 = ((($$2323$lcssa)) + 2|0);
   $57 = HEAP8[$56>>0]|0;
   $58 = ($57<<24>>24)==(36);
   $59 = ((($$2323$lcssa)) + 3|0);
   $$331 = $58 ? $59 : $53;
   $$$0269 = $58 ? 1 : $$0269;
   $isdigittmp$ = $58 ? $isdigittmp : -1;
   $$pre452 = HEAP8[$$331>>0]|0;
   $$0253 = $isdigittmp$;$$1270 = $$$0269;$61 = $$pre452;$storemerge = $$331;
  } else {
   $$0253 = -1;$$1270 = $$0269;$61 = $54;$storemerge = $53;
  }
  $60 = $61 << 24 >> 24;
  $62 = (($60) + -32)|0;
  $63 = ($62>>>0)<(32);
  L25: do {
   if ($63) {
    $$0262390 = 0;$65 = $62;$69 = $61;$storemerge273389 = $storemerge;
    while(1) {
     $64 = 1 << $65;
     $66 = $64 & 75913;
     $67 = ($66|0)==(0);
     if ($67) {
      $$0262342 = $$0262390;$78 = $69;$storemerge273345 = $storemerge273389;
      break L25;
     }
     $68 = $69 << 24 >> 24;
     $70 = (($68) + -32)|0;
     $71 = 1 << $70;
     $72 = $71 | $$0262390;
     $73 = ((($storemerge273389)) + 1|0);
     $74 = HEAP8[$73>>0]|0;
     $75 = $74 << 24 >> 24;
     $76 = (($75) + -32)|0;
     $77 = ($76>>>0)<(32);
     if ($77) {
      $$0262390 = $72;$65 = $76;$69 = $74;$storemerge273389 = $73;
     } else {
      $$0262342 = $72;$78 = $74;$storemerge273345 = $73;
      break;
     }
    }
   } else {
    $$0262342 = 0;$78 = $61;$storemerge273345 = $storemerge;
   }
  } while(0);
  $79 = ($78<<24>>24)==(42);
  do {
   if ($79) {
    $80 = ((($storemerge273345)) + 1|0);
    $81 = HEAP8[$80>>0]|0;
    $82 = $81 << 24 >> 24;
    $isdigittmp276 = (($82) + -48)|0;
    $isdigit277 = ($isdigittmp276>>>0)<(10);
    if ($isdigit277) {
     $83 = ((($storemerge273345)) + 2|0);
     $84 = HEAP8[$83>>0]|0;
     $85 = ($84<<24>>24)==(36);
     if ($85) {
      $86 = (($4) + ($isdigittmp276<<2)|0);
      HEAP32[$86>>2] = 10;
      $87 = HEAP8[$80>>0]|0;
      $88 = $87 << 24 >> 24;
      $89 = (($88) + -48)|0;
      $90 = (($3) + ($89<<3)|0);
      $91 = $90;
      $92 = $91;
      $93 = HEAP32[$92>>2]|0;
      $94 = (($91) + 4)|0;
      $95 = $94;
      $96 = HEAP32[$95>>2]|0;
      $97 = ((($storemerge273345)) + 3|0);
      $$0259 = $93;$$2271 = 1;$storemerge278 = $97;
     } else {
      label = 24;
     }
    } else {
     label = 24;
    }
    if ((label|0) == 24) {
     label = 0;
     $98 = ($$1270|0)==(0);
     if (!($98)) {
      $$0 = -1;
      break L1;
     }
     if (!($13)) {
      $$1260 = 0;$$1263 = $$0262342;$$3272 = 0;$$4325 = $80;$$pr = $81;
      break;
     }
     $arglist_current = HEAP32[$2>>2]|0;
     $99 = $arglist_current;
     $100 = ((0) + 4|0);
     $expanded4 = $100;
     $expanded = (($expanded4) - 1)|0;
     $101 = (($99) + ($expanded))|0;
     $102 = ((0) + 4|0);
     $expanded8 = $102;
     $expanded7 = (($expanded8) - 1)|0;
     $expanded6 = $expanded7 ^ -1;
     $103 = $101 & $expanded6;
     $104 = $103;
     $105 = HEAP32[$104>>2]|0;
     $arglist_next = ((($104)) + 4|0);
     HEAP32[$2>>2] = $arglist_next;
     $$0259 = $105;$$2271 = 0;$storemerge278 = $80;
    }
    $106 = ($$0259|0)<(0);
    $107 = $$0262342 | 8192;
    $108 = (0 - ($$0259))|0;
    $$$0262 = $106 ? $107 : $$0262342;
    $$$0259 = $106 ? $108 : $$0259;
    $$pre453 = HEAP8[$storemerge278>>0]|0;
    $$1260 = $$$0259;$$1263 = $$$0262;$$3272 = $$2271;$$4325 = $storemerge278;$$pr = $$pre453;
   } else {
    $109 = $78 << 24 >> 24;
    $isdigittmp4$i = (($109) + -48)|0;
    $isdigit5$i = ($isdigittmp4$i>>>0)<(10);
    if ($isdigit5$i) {
     $$06$i = 0;$113 = $storemerge273345;$isdigittmp7$i = $isdigittmp4$i;
     while(1) {
      $110 = ($$06$i*10)|0;
      $111 = (($110) + ($isdigittmp7$i))|0;
      $112 = ((($113)) + 1|0);
      $114 = HEAP8[$112>>0]|0;
      $115 = $114 << 24 >> 24;
      $isdigittmp$i = (($115) + -48)|0;
      $isdigit$i = ($isdigittmp$i>>>0)<(10);
      if ($isdigit$i) {
       $$06$i = $111;$113 = $112;$isdigittmp7$i = $isdigittmp$i;
      } else {
       break;
      }
     }
     $116 = ($111|0)<(0);
     if ($116) {
      $$0 = -1;
      break L1;
     } else {
      $$1260 = $111;$$1263 = $$0262342;$$3272 = $$1270;$$4325 = $112;$$pr = $114;
     }
    } else {
     $$1260 = 0;$$1263 = $$0262342;$$3272 = $$1270;$$4325 = $storemerge273345;$$pr = $78;
    }
   }
  } while(0);
  $117 = ($$pr<<24>>24)==(46);
  L45: do {
   if ($117) {
    $118 = ((($$4325)) + 1|0);
    $119 = HEAP8[$118>>0]|0;
    $120 = ($119<<24>>24)==(42);
    if (!($120)) {
     $147 = $119 << 24 >> 24;
     $isdigittmp4$i287 = (($147) + -48)|0;
     $isdigit5$i288 = ($isdigittmp4$i287>>>0)<(10);
     if ($isdigit5$i288) {
      $$06$i290 = 0;$151 = $118;$isdigittmp7$i289 = $isdigittmp4$i287;
     } else {
      $$0254 = 0;$$6 = $118;
      break;
     }
     while(1) {
      $148 = ($$06$i290*10)|0;
      $149 = (($148) + ($isdigittmp7$i289))|0;
      $150 = ((($151)) + 1|0);
      $152 = HEAP8[$150>>0]|0;
      $153 = $152 << 24 >> 24;
      $isdigittmp$i291 = (($153) + -48)|0;
      $isdigit$i292 = ($isdigittmp$i291>>>0)<(10);
      if ($isdigit$i292) {
       $$06$i290 = $149;$151 = $150;$isdigittmp7$i289 = $isdigittmp$i291;
      } else {
       $$0254 = $149;$$6 = $150;
       break L45;
      }
     }
    }
    $121 = ((($$4325)) + 2|0);
    $122 = HEAP8[$121>>0]|0;
    $123 = $122 << 24 >> 24;
    $isdigittmp274 = (($123) + -48)|0;
    $isdigit275 = ($isdigittmp274>>>0)<(10);
    if ($isdigit275) {
     $124 = ((($$4325)) + 3|0);
     $125 = HEAP8[$124>>0]|0;
     $126 = ($125<<24>>24)==(36);
     if ($126) {
      $127 = (($4) + ($isdigittmp274<<2)|0);
      HEAP32[$127>>2] = 10;
      $128 = HEAP8[$121>>0]|0;
      $129 = $128 << 24 >> 24;
      $130 = (($129) + -48)|0;
      $131 = (($3) + ($130<<3)|0);
      $132 = $131;
      $133 = $132;
      $134 = HEAP32[$133>>2]|0;
      $135 = (($132) + 4)|0;
      $136 = $135;
      $137 = HEAP32[$136>>2]|0;
      $138 = ((($$4325)) + 4|0);
      $$0254 = $134;$$6 = $138;
      break;
     }
    }
    $139 = ($$3272|0)==(0);
    if (!($139)) {
     $$0 = -1;
     break L1;
    }
    if ($13) {
     $arglist_current2 = HEAP32[$2>>2]|0;
     $140 = $arglist_current2;
     $141 = ((0) + 4|0);
     $expanded11 = $141;
     $expanded10 = (($expanded11) - 1)|0;
     $142 = (($140) + ($expanded10))|0;
     $143 = ((0) + 4|0);
     $expanded15 = $143;
     $expanded14 = (($expanded15) - 1)|0;
     $expanded13 = $expanded14 ^ -1;
     $144 = $142 & $expanded13;
     $145 = $144;
     $146 = HEAP32[$145>>2]|0;
     $arglist_next3 = ((($145)) + 4|0);
     HEAP32[$2>>2] = $arglist_next3;
     $$0254 = $146;$$6 = $121;
    } else {
     $$0254 = 0;$$6 = $121;
    }
   } else {
    $$0254 = -1;$$6 = $$4325;
   }
  } while(0);
  $$0252 = 0;$$7 = $$6;
  while(1) {
   $154 = HEAP8[$$7>>0]|0;
   $155 = $154 << 24 >> 24;
   $156 = (($155) + -65)|0;
   $157 = ($156>>>0)>(57);
   if ($157) {
    $$0 = -1;
    break L1;
   }
   $158 = ((($$7)) + 1|0);
   $159 = ((5392 + (($$0252*58)|0)|0) + ($156)|0);
   $160 = HEAP8[$159>>0]|0;
   $161 = $160&255;
   $162 = (($161) + -1)|0;
   $163 = ($162>>>0)<(8);
   if ($163) {
    $$0252 = $161;$$7 = $158;
   } else {
    break;
   }
  }
  $164 = ($160<<24>>24)==(0);
  if ($164) {
   $$0 = -1;
   break;
  }
  $165 = ($160<<24>>24)==(19);
  $166 = ($$0253|0)>(-1);
  do {
   if ($165) {
    if ($166) {
     $$0 = -1;
     break L1;
    } else {
     label = 51;
    }
   } else {
    if ($166) {
     $167 = (($4) + ($$0253<<2)|0);
     HEAP32[$167>>2] = $161;
     $168 = (($3) + ($$0253<<3)|0);
     $169 = $168;
     $170 = $169;
     $171 = HEAP32[$170>>2]|0;
     $172 = (($169) + 4)|0;
     $173 = $172;
     $174 = HEAP32[$173>>2]|0;
     $175 = $9;
     $176 = $175;
     HEAP32[$176>>2] = $171;
     $177 = (($175) + 4)|0;
     $178 = $177;
     HEAP32[$178>>2] = $174;
     label = 51;
     break;
    }
    if (!($13)) {
     $$0 = 0;
     break L1;
    }
    _pop_arg_291($9,$161,$2);
   }
  } while(0);
  if ((label|0) == 51) {
   label = 0;
   if (!($13)) {
    $$0243 = 0;$$0247 = $$1248;$$0269 = $$3272;$$0321 = $158;
    continue;
   }
  }
  $179 = HEAP8[$$7>>0]|0;
  $180 = $179 << 24 >> 24;
  $181 = ($$0252|0)!=(0);
  $182 = $180 & 15;
  $183 = ($182|0)==(3);
  $or$cond280 = $181 & $183;
  $184 = $180 & -33;
  $$0235 = $or$cond280 ? $184 : $180;
  $185 = $$1263 & 8192;
  $186 = ($185|0)==(0);
  $187 = $$1263 & -65537;
  $$1263$ = $186 ? $$1263 : $187;
  L74: do {
   switch ($$0235|0) {
   case 110:  {
    $trunc = $$0252&255;
    switch ($trunc<<24>>24) {
    case 0:  {
     $194 = HEAP32[$9>>2]|0;
     HEAP32[$194>>2] = $$1248;
     $$0243 = 0;$$0247 = $$1248;$$0269 = $$3272;$$0321 = $158;
     continue L1;
     break;
    }
    case 1:  {
     $195 = HEAP32[$9>>2]|0;
     HEAP32[$195>>2] = $$1248;
     $$0243 = 0;$$0247 = $$1248;$$0269 = $$3272;$$0321 = $158;
     continue L1;
     break;
    }
    case 2:  {
     $196 = ($$1248|0)<(0);
     $197 = $196 << 31 >> 31;
     $198 = HEAP32[$9>>2]|0;
     $199 = $198;
     $200 = $199;
     HEAP32[$200>>2] = $$1248;
     $201 = (($199) + 4)|0;
     $202 = $201;
     HEAP32[$202>>2] = $197;
     $$0243 = 0;$$0247 = $$1248;$$0269 = $$3272;$$0321 = $158;
     continue L1;
     break;
    }
    case 3:  {
     $203 = $$1248&65535;
     $204 = HEAP32[$9>>2]|0;
     HEAP16[$204>>1] = $203;
     $$0243 = 0;$$0247 = $$1248;$$0269 = $$3272;$$0321 = $158;
     continue L1;
     break;
    }
    case 4:  {
     $205 = $$1248&255;
     $206 = HEAP32[$9>>2]|0;
     HEAP8[$206>>0] = $205;
     $$0243 = 0;$$0247 = $$1248;$$0269 = $$3272;$$0321 = $158;
     continue L1;
     break;
    }
    case 6:  {
     $207 = HEAP32[$9>>2]|0;
     HEAP32[$207>>2] = $$1248;
     $$0243 = 0;$$0247 = $$1248;$$0269 = $$3272;$$0321 = $158;
     continue L1;
     break;
    }
    case 7:  {
     $208 = ($$1248|0)<(0);
     $209 = $208 << 31 >> 31;
     $210 = HEAP32[$9>>2]|0;
     $211 = $210;
     $212 = $211;
     HEAP32[$212>>2] = $$1248;
     $213 = (($211) + 4)|0;
     $214 = $213;
     HEAP32[$214>>2] = $209;
     $$0243 = 0;$$0247 = $$1248;$$0269 = $$3272;$$0321 = $158;
     continue L1;
     break;
    }
    default: {
     $$0243 = 0;$$0247 = $$1248;$$0269 = $$3272;$$0321 = $158;
     continue L1;
    }
    }
    break;
   }
   case 112:  {
    $215 = ($$0254>>>0)>(8);
    $216 = $215 ? $$0254 : 8;
    $217 = $$1263$ | 8;
    $$1236 = 120;$$1255 = $216;$$3265 = $217;
    label = 63;
    break;
   }
   case 88: case 120:  {
    $$1236 = $$0235;$$1255 = $$0254;$$3265 = $$1263$;
    label = 63;
    break;
   }
   case 111:  {
    $257 = $9;
    $258 = $257;
    $259 = HEAP32[$258>>2]|0;
    $260 = (($257) + 4)|0;
    $261 = $260;
    $262 = HEAP32[$261>>2]|0;
    $263 = ($259|0)==(0);
    $264 = ($262|0)==(0);
    $265 = $263 & $264;
    if ($265) {
     $$0$lcssa$i300 = $14;
    } else {
     $$06$i298 = $14;$267 = $259;$271 = $262;
     while(1) {
      $266 = $267 & 7;
      $268 = $266 | 48;
      $269 = $268&255;
      $270 = ((($$06$i298)) + -1|0);
      HEAP8[$270>>0] = $269;
      $272 = (_bitshift64Lshr(($267|0),($271|0),3)|0);
      $273 = tempRet0;
      $274 = ($272|0)==(0);
      $275 = ($273|0)==(0);
      $276 = $274 & $275;
      if ($276) {
       $$0$lcssa$i300 = $270;
       break;
      } else {
       $$06$i298 = $270;$267 = $272;$271 = $273;
      }
     }
    }
    $277 = $$1263$ & 8;
    $278 = ($277|0)==(0);
    if ($278) {
     $$0228 = $$0$lcssa$i300;$$1233 = 0;$$1238 = 5872;$$2256 = $$0254;$$4266 = $$1263$;
     label = 76;
    } else {
     $279 = $$0$lcssa$i300;
     $280 = (($15) - ($279))|0;
     $281 = ($$0254|0)>($280|0);
     $282 = (($280) + 1)|0;
     $$0254$ = $281 ? $$0254 : $282;
     $$0228 = $$0$lcssa$i300;$$1233 = 0;$$1238 = 5872;$$2256 = $$0254$;$$4266 = $$1263$;
     label = 76;
    }
    break;
   }
   case 105: case 100:  {
    $283 = $9;
    $284 = $283;
    $285 = HEAP32[$284>>2]|0;
    $286 = (($283) + 4)|0;
    $287 = $286;
    $288 = HEAP32[$287>>2]|0;
    $289 = ($288|0)<(0);
    if ($289) {
     $290 = (_i64Subtract(0,0,($285|0),($288|0))|0);
     $291 = tempRet0;
     $292 = $9;
     $293 = $292;
     HEAP32[$293>>2] = $290;
     $294 = (($292) + 4)|0;
     $295 = $294;
     HEAP32[$295>>2] = $291;
     $$0232 = 1;$$0237 = 5872;$300 = $290;$301 = $291;
     label = 75;
     break L74;
    }
    $296 = $$1263$ & 2048;
    $297 = ($296|0)==(0);
    if ($297) {
     $298 = $$1263$ & 1;
     $299 = ($298|0)==(0);
     $$ = $299 ? 5872 : (5874);
     $$0232 = $298;$$0237 = $$;$300 = $285;$301 = $288;
     label = 75;
    } else {
     $$0232 = 1;$$0237 = (5873);$300 = $285;$301 = $288;
     label = 75;
    }
    break;
   }
   case 117:  {
    $188 = $9;
    $189 = $188;
    $190 = HEAP32[$189>>2]|0;
    $191 = (($188) + 4)|0;
    $192 = $191;
    $193 = HEAP32[$192>>2]|0;
    $$0232 = 0;$$0237 = 5872;$300 = $190;$301 = $193;
    label = 75;
    break;
   }
   case 99:  {
    $321 = $9;
    $322 = $321;
    $323 = HEAP32[$322>>2]|0;
    $324 = (($321) + 4)|0;
    $325 = $324;
    $326 = HEAP32[$325>>2]|0;
    $327 = $323&255;
    HEAP8[$16>>0] = $327;
    $$2 = $16;$$2234 = 0;$$2239 = 5872;$$2251 = $14;$$5 = 1;$$6268 = $187;
    break;
   }
   case 109:  {
    $328 = (___errno_location()|0);
    $329 = HEAP32[$328>>2]|0;
    $330 = (_strerror($329)|0);
    $$1 = $330;
    label = 81;
    break;
   }
   case 115:  {
    $331 = HEAP32[$9>>2]|0;
    $332 = ($331|0)!=(0|0);
    $333 = $332 ? $331 : 5882;
    $$1 = $333;
    label = 81;
    break;
   }
   case 67:  {
    $340 = $9;
    $341 = $340;
    $342 = HEAP32[$341>>2]|0;
    $343 = (($340) + 4)|0;
    $344 = $343;
    $345 = HEAP32[$344>>2]|0;
    HEAP32[$11>>2] = $342;
    HEAP32[$17>>2] = 0;
    HEAP32[$9>>2] = $11;
    $$4258458 = -1;$809 = $11;
    label = 85;
    break;
   }
   case 83:  {
    $$pre454 = HEAP32[$9>>2]|0;
    $346 = ($$0254|0)==(0);
    if ($346) {
     _pad($0,32,$$1260,0,$$1263$);
     $$0240$lcssa460 = 0;
     label = 96;
    } else {
     $$4258458 = $$0254;$809 = $$pre454;
     label = 85;
    }
    break;
   }
   case 65: case 71: case 70: case 69: case 97: case 103: case 102: case 101:  {
    $371 = +HEAPF64[$9>>3];
    HEAP32[$6>>2] = 0;
    HEAPF64[tempDoublePtr>>3] = $371;$372 = HEAP32[tempDoublePtr>>2]|0;
    $373 = HEAP32[tempDoublePtr+4>>2]|0;
    $374 = ($373|0)<(0);
    if ($374) {
     $375 = -$371;
     $$0471$i = $375;$$0520$i = 1;$$0522$i = 5889;
    } else {
     $376 = $$1263$ & 2048;
     $377 = ($376|0)==(0);
     $378 = $$1263$ & 1;
     if ($377) {
      $379 = ($378|0)==(0);
      $$$i = $379 ? (5890) : (5895);
      $$0471$i = $371;$$0520$i = $378;$$0522$i = $$$i;
     } else {
      $$0471$i = $371;$$0520$i = 1;$$0522$i = (5892);
     }
    }
    HEAPF64[tempDoublePtr>>3] = $$0471$i;$380 = HEAP32[tempDoublePtr>>2]|0;
    $381 = HEAP32[tempDoublePtr+4>>2]|0;
    $382 = $381 & 2146435072;
    $383 = ($382>>>0)<(2146435072);
    $384 = (0)<(0);
    $385 = ($382|0)==(2146435072);
    $386 = $385 & $384;
    $387 = $383 | $386;
    do {
     if ($387) {
      $403 = (+_frexpl($$0471$i,$6));
      $404 = $403 * 2.0;
      $405 = $404 != 0.0;
      if ($405) {
       $406 = HEAP32[$6>>2]|0;
       $407 = (($406) + -1)|0;
       HEAP32[$6>>2] = $407;
      }
      $408 = $$0235 | 32;
      $409 = ($408|0)==(97);
      if ($409) {
       $410 = $$0235 & 32;
       $411 = ($410|0)==(0);
       $412 = ((($$0522$i)) + 9|0);
       $$0522$$i = $411 ? $$0522$i : $412;
       $413 = $$0520$i | 2;
       $414 = ($$0254>>>0)>(11);
       $415 = (12 - ($$0254))|0;
       $416 = ($415|0)==(0);
       $417 = $414 | $416;
       do {
        if ($417) {
         $$1472$i = $404;
        } else {
         $$0509592$i = 8.0;$$1508593$i = $415;
         while(1) {
          $418 = (($$1508593$i) + -1)|0;
          $419 = $$0509592$i * 16.0;
          $420 = ($418|0)==(0);
          if ($420) {
           break;
          } else {
           $$0509592$i = $419;$$1508593$i = $418;
          }
         }
         $421 = HEAP8[$$0522$$i>>0]|0;
         $422 = ($421<<24>>24)==(45);
         if ($422) {
          $423 = -$404;
          $424 = $423 - $419;
          $425 = $419 + $424;
          $426 = -$425;
          $$1472$i = $426;
          break;
         } else {
          $427 = $404 + $419;
          $428 = $427 - $419;
          $$1472$i = $428;
          break;
         }
        }
       } while(0);
       $429 = HEAP32[$6>>2]|0;
       $430 = ($429|0)<(0);
       $431 = (0 - ($429))|0;
       $432 = $430 ? $431 : $429;
       $433 = ($432|0)<(0);
       $434 = $433 << 31 >> 31;
       $435 = (_fmt_u($432,$434,$20)|0);
       $436 = ($435|0)==($20|0);
       if ($436) {
        HEAP8[$21>>0] = 48;
        $$0511$i = $21;
       } else {
        $$0511$i = $435;
       }
       $437 = $429 >> 31;
       $438 = $437 & 2;
       $439 = (($438) + 43)|0;
       $440 = $439&255;
       $441 = ((($$0511$i)) + -1|0);
       HEAP8[$441>>0] = $440;
       $442 = (($$0235) + 15)|0;
       $443 = $442&255;
       $444 = ((($$0511$i)) + -2|0);
       HEAP8[$444>>0] = $443;
       $notrhs$i = ($$0254|0)<(1);
       $445 = $$1263$ & 8;
       $446 = ($445|0)==(0);
       $$0524$i = $7;$$2473$i = $$1472$i;
       while(1) {
        $447 = (~~(($$2473$i)));
        $448 = (5856 + ($447)|0);
        $449 = HEAP8[$448>>0]|0;
        $450 = $449&255;
        $451 = $450 | $410;
        $452 = $451&255;
        $453 = ((($$0524$i)) + 1|0);
        HEAP8[$$0524$i>>0] = $452;
        $454 = (+($447|0));
        $455 = $$2473$i - $454;
        $456 = $455 * 16.0;
        $457 = $453;
        $458 = (($457) - ($18))|0;
        $459 = ($458|0)==(1);
        do {
         if ($459) {
          $notlhs$i = $456 == 0.0;
          $or$cond3$not$i = $notrhs$i & $notlhs$i;
          $or$cond$i = $446 & $or$cond3$not$i;
          if ($or$cond$i) {
           $$1525$i = $453;
           break;
          }
          $460 = ((($$0524$i)) + 2|0);
          HEAP8[$453>>0] = 46;
          $$1525$i = $460;
         } else {
          $$1525$i = $453;
         }
        } while(0);
        $461 = $456 != 0.0;
        if ($461) {
         $$0524$i = $$1525$i;$$2473$i = $456;
        } else {
         break;
        }
       }
       $462 = ($$0254|0)!=(0);
       $$pre700$i = $$1525$i;
       $463 = (($24) + ($$pre700$i))|0;
       $464 = ($463|0)<($$0254|0);
       $or$cond412 = $462 & $464;
       $465 = $444;
       $466 = (($25) + ($$0254))|0;
       $467 = (($466) - ($465))|0;
       $468 = (($23) - ($465))|0;
       $469 = (($468) + ($$pre700$i))|0;
       $$0526$i = $or$cond412 ? $467 : $469;
       $470 = (($$0526$i) + ($413))|0;
       _pad($0,32,$$1260,$470,$$1263$);
       $471 = HEAP32[$0>>2]|0;
       $472 = $471 & 32;
       $473 = ($472|0)==(0);
       if ($473) {
        (___fwritex($$0522$$i,$413,$0)|0);
       }
       $474 = $$1263$ ^ 65536;
       _pad($0,48,$$1260,$470,$474);
       $475 = (($$pre700$i) - ($18))|0;
       $476 = HEAP32[$0>>2]|0;
       $477 = $476 & 32;
       $478 = ($477|0)==(0);
       if ($478) {
        (___fwritex($7,$475,$0)|0);
       }
       $479 = (($22) - ($465))|0;
       $sum = (($475) + ($479))|0;
       $480 = (($$0526$i) - ($sum))|0;
       _pad($0,48,$480,0,0);
       $481 = HEAP32[$0>>2]|0;
       $482 = $481 & 32;
       $483 = ($482|0)==(0);
       if ($483) {
        (___fwritex($444,$479,$0)|0);
       }
       $484 = $$1263$ ^ 8192;
       _pad($0,32,$$1260,$470,$484);
       $485 = ($470|0)<($$1260|0);
       $$537$i = $485 ? $$1260 : $470;
       $$0470$i = $$537$i;
       break;
      }
      $486 = ($$0254|0)<(0);
      $$538$i = $486 ? 6 : $$0254;
      if ($405) {
       $487 = $404 * 268435456.0;
       $488 = HEAP32[$6>>2]|0;
       $489 = (($488) + -28)|0;
       HEAP32[$6>>2] = $489;
       $$3$i = $487;$$pr$i = $489;
      } else {
       $$pre697$i = HEAP32[$6>>2]|0;
       $$3$i = $404;$$pr$i = $$pre697$i;
      }
      $490 = ($$pr$i|0)<(0);
      $$554$i = $490 ? $5 : $26;
      $$0498$i = $$554$i;$$4$i = $$3$i;
      while(1) {
       $491 = (~~(($$4$i))>>>0);
       HEAP32[$$0498$i>>2] = $491;
       $492 = ((($$0498$i)) + 4|0);
       $493 = (+($491>>>0));
       $494 = $$4$i - $493;
       $495 = $494 * 1.0E+9;
       $496 = $495 != 0.0;
       if ($496) {
        $$0498$i = $492;$$4$i = $495;
       } else {
        break;
       }
      }
      $497 = ($$pr$i|0)>(0);
      if ($497) {
       $$1482671$i = $$554$i;$$1499670$i = $492;$498 = $$pr$i;
       while(1) {
        $499 = ($498|0)>(29);
        $500 = $499 ? 29 : $498;
        $$0488663$i = ((($$1499670$i)) + -4|0);
        $501 = ($$0488663$i>>>0)<($$1482671$i>>>0);
        do {
         if ($501) {
          $$2483$ph$i = $$1482671$i;
         } else {
          $$0488665$i = $$0488663$i;$$0497664$i = 0;
          while(1) {
           $502 = HEAP32[$$0488665$i>>2]|0;
           $503 = (_bitshift64Shl(($502|0),0,($500|0))|0);
           $504 = tempRet0;
           $505 = (_i64Add(($503|0),($504|0),($$0497664$i|0),0)|0);
           $506 = tempRet0;
           $507 = (___uremdi3(($505|0),($506|0),1000000000,0)|0);
           $508 = tempRet0;
           HEAP32[$$0488665$i>>2] = $507;
           $509 = (___udivdi3(($505|0),($506|0),1000000000,0)|0);
           $510 = tempRet0;
           $$0488$i = ((($$0488665$i)) + -4|0);
           $511 = ($$0488$i>>>0)<($$1482671$i>>>0);
           if ($511) {
            break;
           } else {
            $$0488665$i = $$0488$i;$$0497664$i = $509;
           }
          }
          $512 = ($509|0)==(0);
          if ($512) {
           $$2483$ph$i = $$1482671$i;
           break;
          }
          $513 = ((($$1482671$i)) + -4|0);
          HEAP32[$513>>2] = $509;
          $$2483$ph$i = $513;
         }
        } while(0);
        $$2500$i = $$1499670$i;
        while(1) {
         $514 = ($$2500$i>>>0)>($$2483$ph$i>>>0);
         if (!($514)) {
          break;
         }
         $515 = ((($$2500$i)) + -4|0);
         $516 = HEAP32[$515>>2]|0;
         $517 = ($516|0)==(0);
         if ($517) {
          $$2500$i = $515;
         } else {
          break;
         }
        }
        $518 = HEAP32[$6>>2]|0;
        $519 = (($518) - ($500))|0;
        HEAP32[$6>>2] = $519;
        $520 = ($519|0)>(0);
        if ($520) {
         $$1482671$i = $$2483$ph$i;$$1499670$i = $$2500$i;$498 = $519;
        } else {
         $$1482$lcssa$i = $$2483$ph$i;$$1499$lcssa$i = $$2500$i;$$pr571$i = $519;
         break;
        }
       }
      } else {
       $$1482$lcssa$i = $$554$i;$$1499$lcssa$i = $492;$$pr571$i = $$pr$i;
      }
      $521 = ($$pr571$i|0)<(0);
      if ($521) {
       $522 = (($$538$i) + 25)|0;
       $523 = (($522|0) / 9)&-1;
       $524 = (($523) + 1)|0;
       $525 = ($408|0)==(102);
       $$3484658$i = $$1482$lcssa$i;$$3501657$i = $$1499$lcssa$i;$527 = $$pr571$i;
       while(1) {
        $526 = (0 - ($527))|0;
        $528 = ($526|0)>(9);
        $529 = $528 ? 9 : $526;
        $530 = ($$3484658$i>>>0)<($$3501657$i>>>0);
        do {
         if ($530) {
          $534 = 1 << $529;
          $535 = (($534) + -1)|0;
          $536 = 1000000000 >>> $529;
          $$0487652$i = 0;$$1489651$i = $$3484658$i;
          while(1) {
           $537 = HEAP32[$$1489651$i>>2]|0;
           $538 = $537 & $535;
           $539 = $537 >>> $529;
           $540 = (($539) + ($$0487652$i))|0;
           HEAP32[$$1489651$i>>2] = $540;
           $541 = Math_imul($538, $536)|0;
           $542 = ((($$1489651$i)) + 4|0);
           $543 = ($542>>>0)<($$3501657$i>>>0);
           if ($543) {
            $$0487652$i = $541;$$1489651$i = $542;
           } else {
            break;
           }
          }
          $544 = HEAP32[$$3484658$i>>2]|0;
          $545 = ($544|0)==(0);
          $546 = ((($$3484658$i)) + 4|0);
          $$$3484$i = $545 ? $546 : $$3484658$i;
          $547 = ($541|0)==(0);
          if ($547) {
           $$$3484706$i = $$$3484$i;$$4502$i = $$3501657$i;
           break;
          }
          $548 = ((($$3501657$i)) + 4|0);
          HEAP32[$$3501657$i>>2] = $541;
          $$$3484706$i = $$$3484$i;$$4502$i = $548;
         } else {
          $531 = HEAP32[$$3484658$i>>2]|0;
          $532 = ($531|0)==(0);
          $533 = ((($$3484658$i)) + 4|0);
          $$$3484705$i = $532 ? $533 : $$3484658$i;
          $$$3484706$i = $$$3484705$i;$$4502$i = $$3501657$i;
         }
        } while(0);
        $549 = $525 ? $$554$i : $$$3484706$i;
        $550 = $$4502$i;
        $551 = $549;
        $552 = (($550) - ($551))|0;
        $553 = $552 >> 2;
        $554 = ($553|0)>($524|0);
        $555 = (($549) + ($524<<2)|0);
        $$$4502$i = $554 ? $555 : $$4502$i;
        $556 = HEAP32[$6>>2]|0;
        $557 = (($556) + ($529))|0;
        HEAP32[$6>>2] = $557;
        $558 = ($557|0)<(0);
        if ($558) {
         $$3484658$i = $$$3484706$i;$$3501657$i = $$$4502$i;$527 = $557;
        } else {
         $$3484$lcssa$i = $$$3484706$i;$$3501$lcssa$i = $$$4502$i;
         break;
        }
       }
      } else {
       $$3484$lcssa$i = $$1482$lcssa$i;$$3501$lcssa$i = $$1499$lcssa$i;
      }
      $559 = ($$3484$lcssa$i>>>0)<($$3501$lcssa$i>>>0);
      $560 = $$554$i;
      do {
       if ($559) {
        $561 = $$3484$lcssa$i;
        $562 = (($560) - ($561))|0;
        $563 = $562 >> 2;
        $564 = ($563*9)|0;
        $565 = HEAP32[$$3484$lcssa$i>>2]|0;
        $566 = ($565>>>0)<(10);
        if ($566) {
         $$1515$i = $564;
         break;
        } else {
         $$0514647$i = $564;$$0531646$i = 10;
        }
        while(1) {
         $567 = ($$0531646$i*10)|0;
         $568 = (($$0514647$i) + 1)|0;
         $569 = ($565>>>0)<($567>>>0);
         if ($569) {
          $$1515$i = $568;
          break;
         } else {
          $$0514647$i = $568;$$0531646$i = $567;
         }
        }
       } else {
        $$1515$i = 0;
       }
      } while(0);
      $570 = ($408|0)!=(102);
      $571 = $570 ? $$1515$i : 0;
      $572 = (($$538$i) - ($571))|0;
      $573 = ($408|0)==(103);
      $574 = ($$538$i|0)!=(0);
      $575 = $574 & $573;
      $$neg$i = $575 << 31 >> 31;
      $576 = (($572) + ($$neg$i))|0;
      $577 = $$3501$lcssa$i;
      $578 = (($577) - ($560))|0;
      $579 = $578 >> 2;
      $580 = ($579*9)|0;
      $581 = (($580) + -9)|0;
      $582 = ($576|0)<($581|0);
      if ($582) {
       $583 = ((($$554$i)) + 4|0);
       $584 = (($576) + 9216)|0;
       $585 = (($584|0) / 9)&-1;
       $586 = (($585) + -1024)|0;
       $587 = (($583) + ($586<<2)|0);
       $588 = (($584|0) % 9)&-1;
       $$0528639$i = (($588) + 1)|0;
       $589 = ($$0528639$i|0)<(9);
       if ($589) {
        $$0528641$i = $$0528639$i;$$1532640$i = 10;
        while(1) {
         $590 = ($$1532640$i*10)|0;
         $$0528$i = (($$0528641$i) + 1)|0;
         $exitcond$i = ($$0528$i|0)==(9);
         if ($exitcond$i) {
          $$1532$lcssa$i = $590;
          break;
         } else {
          $$0528641$i = $$0528$i;$$1532640$i = $590;
         }
        }
       } else {
        $$1532$lcssa$i = 10;
       }
       $591 = HEAP32[$587>>2]|0;
       $592 = (($591>>>0) % ($$1532$lcssa$i>>>0))&-1;
       $593 = ($592|0)==(0);
       $594 = ((($587)) + 4|0);
       $595 = ($594|0)==($$3501$lcssa$i|0);
       $or$cond540$i = $595 & $593;
       do {
        if ($or$cond540$i) {
         $$4492$i = $587;$$4518$i = $$1515$i;$$8$i = $$3484$lcssa$i;
        } else {
         $596 = (($591>>>0) / ($$1532$lcssa$i>>>0))&-1;
         $597 = $596 & 1;
         $598 = ($597|0)==(0);
         $$541$i = $598 ? 9007199254740992.0 : 9007199254740994.0;
         $599 = (($$1532$lcssa$i|0) / 2)&-1;
         $600 = ($592>>>0)<($599>>>0);
         if ($600) {
          $$0466$i = 0.5;
         } else {
          $601 = ($592|0)==($599|0);
          $or$cond543$i = $595 & $601;
          $$557$i = $or$cond543$i ? 1.0 : 1.5;
          $$0466$i = $$557$i;
         }
         $602 = ($$0520$i|0)==(0);
         do {
          if ($602) {
           $$1467$i = $$0466$i;$$1469$i = $$541$i;
          } else {
           $603 = HEAP8[$$0522$i>>0]|0;
           $604 = ($603<<24>>24)==(45);
           if (!($604)) {
            $$1467$i = $$0466$i;$$1469$i = $$541$i;
            break;
           }
           $605 = -$$541$i;
           $606 = -$$0466$i;
           $$1467$i = $606;$$1469$i = $605;
          }
         } while(0);
         $607 = (($591) - ($592))|0;
         HEAP32[$587>>2] = $607;
         $608 = $$1469$i + $$1467$i;
         $609 = $608 != $$1469$i;
         if (!($609)) {
          $$4492$i = $587;$$4518$i = $$1515$i;$$8$i = $$3484$lcssa$i;
          break;
         }
         $610 = (($607) + ($$1532$lcssa$i))|0;
         HEAP32[$587>>2] = $610;
         $611 = ($610>>>0)>(999999999);
         if ($611) {
          $$2490632$i = $587;$$5486633$i = $$3484$lcssa$i;
          while(1) {
           $612 = ((($$2490632$i)) + -4|0);
           HEAP32[$$2490632$i>>2] = 0;
           $613 = ($612>>>0)<($$5486633$i>>>0);
           if ($613) {
            $614 = ((($$5486633$i)) + -4|0);
            HEAP32[$614>>2] = 0;
            $$6$i = $614;
           } else {
            $$6$i = $$5486633$i;
           }
           $615 = HEAP32[$612>>2]|0;
           $616 = (($615) + 1)|0;
           HEAP32[$612>>2] = $616;
           $617 = ($616>>>0)>(999999999);
           if ($617) {
            $$2490632$i = $612;$$5486633$i = $$6$i;
           } else {
            $$2490$lcssa$i = $612;$$5486$lcssa$i = $$6$i;
            break;
           }
          }
         } else {
          $$2490$lcssa$i = $587;$$5486$lcssa$i = $$3484$lcssa$i;
         }
         $618 = $$5486$lcssa$i;
         $619 = (($560) - ($618))|0;
         $620 = $619 >> 2;
         $621 = ($620*9)|0;
         $622 = HEAP32[$$5486$lcssa$i>>2]|0;
         $623 = ($622>>>0)<(10);
         if ($623) {
          $$4492$i = $$2490$lcssa$i;$$4518$i = $621;$$8$i = $$5486$lcssa$i;
          break;
         } else {
          $$2516628$i = $621;$$2533627$i = 10;
         }
         while(1) {
          $624 = ($$2533627$i*10)|0;
          $625 = (($$2516628$i) + 1)|0;
          $626 = ($622>>>0)<($624>>>0);
          if ($626) {
           $$4492$i = $$2490$lcssa$i;$$4518$i = $625;$$8$i = $$5486$lcssa$i;
           break;
          } else {
           $$2516628$i = $625;$$2533627$i = $624;
          }
         }
        }
       } while(0);
       $627 = ((($$4492$i)) + 4|0);
       $628 = ($$3501$lcssa$i>>>0)>($627>>>0);
       $$$3501$i = $628 ? $627 : $$3501$lcssa$i;
       $$5519$ph$i = $$4518$i;$$7505$ph$i = $$$3501$i;$$9$ph$i = $$8$i;
      } else {
       $$5519$ph$i = $$1515$i;$$7505$ph$i = $$3501$lcssa$i;$$9$ph$i = $$3484$lcssa$i;
      }
      $629 = (0 - ($$5519$ph$i))|0;
      $$7505$i = $$7505$ph$i;
      while(1) {
       $630 = ($$7505$i>>>0)>($$9$ph$i>>>0);
       if (!($630)) {
        $$lcssa683$i = 0;
        break;
       }
       $631 = ((($$7505$i)) + -4|0);
       $632 = HEAP32[$631>>2]|0;
       $633 = ($632|0)==(0);
       if ($633) {
        $$7505$i = $631;
       } else {
        $$lcssa683$i = 1;
        break;
       }
      }
      do {
       if ($573) {
        $634 = $574&1;
        $635 = $634 ^ 1;
        $$538$$i = (($635) + ($$538$i))|0;
        $636 = ($$538$$i|0)>($$5519$ph$i|0);
        $637 = ($$5519$ph$i|0)>(-5);
        $or$cond6$i = $636 & $637;
        if ($or$cond6$i) {
         $638 = (($$0235) + -1)|0;
         $$neg572$i = (($$538$$i) + -1)|0;
         $639 = (($$neg572$i) - ($$5519$ph$i))|0;
         $$0479$i = $638;$$2476$i = $639;
        } else {
         $640 = (($$0235) + -2)|0;
         $641 = (($$538$$i) + -1)|0;
         $$0479$i = $640;$$2476$i = $641;
        }
        $642 = $$1263$ & 8;
        $643 = ($642|0)==(0);
        if (!($643)) {
         $$1480$i = $$0479$i;$$3477$i = $$2476$i;$$pre$phi704$iZ2D = $642;
         break;
        }
        do {
         if ($$lcssa683$i) {
          $644 = ((($$7505$i)) + -4|0);
          $645 = HEAP32[$644>>2]|0;
          $646 = ($645|0)==(0);
          if ($646) {
           $$2530$i = 9;
           break;
          }
          $647 = (($645>>>0) % 10)&-1;
          $648 = ($647|0)==(0);
          if ($648) {
           $$1529624$i = 0;$$3534623$i = 10;
          } else {
           $$2530$i = 0;
           break;
          }
          while(1) {
           $649 = ($$3534623$i*10)|0;
           $650 = (($$1529624$i) + 1)|0;
           $651 = (($645>>>0) % ($649>>>0))&-1;
           $652 = ($651|0)==(0);
           if ($652) {
            $$1529624$i = $650;$$3534623$i = $649;
           } else {
            $$2530$i = $650;
            break;
           }
          }
         } else {
          $$2530$i = 9;
         }
        } while(0);
        $653 = $$0479$i | 32;
        $654 = ($653|0)==(102);
        $655 = $$7505$i;
        $656 = (($655) - ($560))|0;
        $657 = $656 >> 2;
        $658 = ($657*9)|0;
        $659 = (($658) + -9)|0;
        if ($654) {
         $660 = (($659) - ($$2530$i))|0;
         $661 = ($660|0)<(0);
         $$544$i = $661 ? 0 : $660;
         $662 = ($$2476$i|0)<($$544$i|0);
         $$2476$$545$i = $662 ? $$2476$i : $$544$i;
         $$1480$i = $$0479$i;$$3477$i = $$2476$$545$i;$$pre$phi704$iZ2D = 0;
         break;
        } else {
         $663 = (($659) + ($$5519$ph$i))|0;
         $664 = (($663) - ($$2530$i))|0;
         $665 = ($664|0)<(0);
         $$546$i = $665 ? 0 : $664;
         $666 = ($$2476$i|0)<($$546$i|0);
         $$2476$$547$i = $666 ? $$2476$i : $$546$i;
         $$1480$i = $$0479$i;$$3477$i = $$2476$$547$i;$$pre$phi704$iZ2D = 0;
         break;
        }
       } else {
        $$pre703$i = $$1263$ & 8;
        $$1480$i = $$0235;$$3477$i = $$538$i;$$pre$phi704$iZ2D = $$pre703$i;
       }
      } while(0);
      $667 = $$3477$i | $$pre$phi704$iZ2D;
      $668 = ($667|0)!=(0);
      $669 = $668&1;
      $670 = $$1480$i | 32;
      $671 = ($670|0)==(102);
      if ($671) {
       $672 = ($$5519$ph$i|0)>(0);
       $673 = $672 ? $$5519$ph$i : 0;
       $$2513$i = 0;$$pn$i = $673;
      } else {
       $674 = ($$5519$ph$i|0)<(0);
       $675 = $674 ? $629 : $$5519$ph$i;
       $676 = ($675|0)<(0);
       $677 = $676 << 31 >> 31;
       $678 = (_fmt_u($675,$677,$20)|0);
       $679 = $678;
       $680 = (($22) - ($679))|0;
       $681 = ($680|0)<(2);
       if ($681) {
        $$1512617$i = $678;
        while(1) {
         $682 = ((($$1512617$i)) + -1|0);
         HEAP8[$682>>0] = 48;
         $683 = $682;
         $684 = (($22) - ($683))|0;
         $685 = ($684|0)<(2);
         if ($685) {
          $$1512617$i = $682;
         } else {
          $$1512$lcssa$i = $682;
          break;
         }
        }
       } else {
        $$1512$lcssa$i = $678;
       }
       $686 = $$5519$ph$i >> 31;
       $687 = $686 & 2;
       $688 = (($687) + 43)|0;
       $689 = $688&255;
       $690 = ((($$1512$lcssa$i)) + -1|0);
       HEAP8[$690>>0] = $689;
       $691 = $$1480$i&255;
       $692 = ((($$1512$lcssa$i)) + -2|0);
       HEAP8[$692>>0] = $691;
       $693 = $692;
       $694 = (($22) - ($693))|0;
       $$2513$i = $692;$$pn$i = $694;
      }
      $695 = (($$0520$i) + 1)|0;
      $696 = (($695) + ($$3477$i))|0;
      $$1527$i = (($696) + ($669))|0;
      $697 = (($$1527$i) + ($$pn$i))|0;
      _pad($0,32,$$1260,$697,$$1263$);
      $698 = HEAP32[$0>>2]|0;
      $699 = $698 & 32;
      $700 = ($699|0)==(0);
      if ($700) {
       (___fwritex($$0522$i,$$0520$i,$0)|0);
      }
      $701 = $$1263$ ^ 65536;
      _pad($0,48,$$1260,$697,$701);
      do {
       if ($671) {
        $702 = ($$9$ph$i>>>0)>($$554$i>>>0);
        $$0496$$9$i = $702 ? $$554$i : $$9$ph$i;
        $$5493606$i = $$0496$$9$i;
        while(1) {
         $703 = HEAP32[$$5493606$i>>2]|0;
         $704 = (_fmt_u($703,0,$27)|0);
         $705 = ($$5493606$i|0)==($$0496$$9$i|0);
         do {
          if ($705) {
           $711 = ($704|0)==($27|0);
           if (!($711)) {
            $$1465$i = $704;
            break;
           }
           HEAP8[$29>>0] = 48;
           $$1465$i = $29;
          } else {
           $706 = ($704>>>0)>($7>>>0);
           if (!($706)) {
            $$1465$i = $704;
            break;
           }
           $707 = $704;
           $708 = (($707) - ($18))|0;
           _memset(($7|0),48,($708|0))|0;
           $$0464603$i = $704;
           while(1) {
            $709 = ((($$0464603$i)) + -1|0);
            $710 = ($709>>>0)>($7>>>0);
            if ($710) {
             $$0464603$i = $709;
            } else {
             $$1465$i = $709;
             break;
            }
           }
          }
         } while(0);
         $712 = HEAP32[$0>>2]|0;
         $713 = $712 & 32;
         $714 = ($713|0)==(0);
         if ($714) {
          $715 = $$1465$i;
          $716 = (($28) - ($715))|0;
          (___fwritex($$1465$i,$716,$0)|0);
         }
         $717 = ((($$5493606$i)) + 4|0);
         $718 = ($717>>>0)>($$554$i>>>0);
         if ($718) {
          break;
         } else {
          $$5493606$i = $717;
         }
        }
        $719 = ($667|0)==(0);
        do {
         if (!($719)) {
          $720 = HEAP32[$0>>2]|0;
          $721 = $720 & 32;
          $722 = ($721|0)==(0);
          if (!($722)) {
           break;
          }
          (___fwritex(5924,1,$0)|0);
         }
        } while(0);
        $723 = ($717>>>0)<($$7505$i>>>0);
        $724 = ($$3477$i|0)>(0);
        $725 = $724 & $723;
        if ($725) {
         $$4478600$i = $$3477$i;$$6494599$i = $717;
         while(1) {
          $726 = HEAP32[$$6494599$i>>2]|0;
          $727 = (_fmt_u($726,0,$27)|0);
          $728 = ($727>>>0)>($7>>>0);
          if ($728) {
           $729 = $727;
           $730 = (($729) - ($18))|0;
           _memset(($7|0),48,($730|0))|0;
           $$0463594$i = $727;
           while(1) {
            $731 = ((($$0463594$i)) + -1|0);
            $732 = ($731>>>0)>($7>>>0);
            if ($732) {
             $$0463594$i = $731;
            } else {
             $$0463$lcssa$i = $731;
             break;
            }
           }
          } else {
           $$0463$lcssa$i = $727;
          }
          $733 = HEAP32[$0>>2]|0;
          $734 = $733 & 32;
          $735 = ($734|0)==(0);
          if ($735) {
           $736 = ($$4478600$i|0)>(9);
           $737 = $736 ? 9 : $$4478600$i;
           (___fwritex($$0463$lcssa$i,$737,$0)|0);
          }
          $738 = ((($$6494599$i)) + 4|0);
          $739 = (($$4478600$i) + -9)|0;
          $740 = ($738>>>0)<($$7505$i>>>0);
          $741 = ($$4478600$i|0)>(9);
          $742 = $741 & $740;
          if ($742) {
           $$4478600$i = $739;$$6494599$i = $738;
          } else {
           $$4478$lcssa$i = $739;
           break;
          }
         }
        } else {
         $$4478$lcssa$i = $$3477$i;
        }
        $743 = (($$4478$lcssa$i) + 9)|0;
        _pad($0,48,$743,9,0);
       } else {
        $744 = ((($$9$ph$i)) + 4|0);
        $$7505$$i = $$lcssa683$i ? $$7505$i : $744;
        $745 = ($$3477$i|0)>(-1);
        if ($745) {
         $746 = ($$pre$phi704$iZ2D|0)==(0);
         $$5611$i = $$3477$i;$$7495610$i = $$9$ph$i;
         while(1) {
          $747 = HEAP32[$$7495610$i>>2]|0;
          $748 = (_fmt_u($747,0,$27)|0);
          $749 = ($748|0)==($27|0);
          if ($749) {
           HEAP8[$29>>0] = 48;
           $$0$i = $29;
          } else {
           $$0$i = $748;
          }
          $750 = ($$7495610$i|0)==($$9$ph$i|0);
          do {
           if ($750) {
            $754 = ((($$0$i)) + 1|0);
            $755 = HEAP32[$0>>2]|0;
            $756 = $755 & 32;
            $757 = ($756|0)==(0);
            if ($757) {
             (___fwritex($$0$i,1,$0)|0);
            }
            $758 = ($$5611$i|0)<(1);
            $or$cond552$i = $746 & $758;
            if ($or$cond552$i) {
             $$2$i = $754;
             break;
            }
            $759 = HEAP32[$0>>2]|0;
            $760 = $759 & 32;
            $761 = ($760|0)==(0);
            if (!($761)) {
             $$2$i = $754;
             break;
            }
            (___fwritex(5924,1,$0)|0);
            $$2$i = $754;
           } else {
            $751 = ($$0$i>>>0)>($7>>>0);
            if (!($751)) {
             $$2$i = $$0$i;
             break;
            }
            $scevgep694$i = (($$0$i) + ($19)|0);
            $scevgep694695$i = $scevgep694$i;
            _memset(($7|0),48,($scevgep694695$i|0))|0;
            $$1607$i = $$0$i;
            while(1) {
             $752 = ((($$1607$i)) + -1|0);
             $753 = ($752>>>0)>($7>>>0);
             if ($753) {
              $$1607$i = $752;
             } else {
              $$2$i = $752;
              break;
             }
            }
           }
          } while(0);
          $762 = $$2$i;
          $763 = (($28) - ($762))|0;
          $764 = HEAP32[$0>>2]|0;
          $765 = $764 & 32;
          $766 = ($765|0)==(0);
          if ($766) {
           $767 = ($$5611$i|0)>($763|0);
           $768 = $767 ? $763 : $$5611$i;
           (___fwritex($$2$i,$768,$0)|0);
          }
          $769 = (($$5611$i) - ($763))|0;
          $770 = ((($$7495610$i)) + 4|0);
          $771 = ($770>>>0)<($$7505$$i>>>0);
          $772 = ($769|0)>(-1);
          $773 = $771 & $772;
          if ($773) {
           $$5611$i = $769;$$7495610$i = $770;
          } else {
           $$5$lcssa$i = $769;
           break;
          }
         }
        } else {
         $$5$lcssa$i = $$3477$i;
        }
        $774 = (($$5$lcssa$i) + 18)|0;
        _pad($0,48,$774,18,0);
        $775 = HEAP32[$0>>2]|0;
        $776 = $775 & 32;
        $777 = ($776|0)==(0);
        if (!($777)) {
         break;
        }
        $778 = $$2513$i;
        $779 = (($22) - ($778))|0;
        (___fwritex($$2513$i,$779,$0)|0);
       }
      } while(0);
      $780 = $$1263$ ^ 8192;
      _pad($0,32,$$1260,$697,$780);
      $781 = ($697|0)<($$1260|0);
      $$553$i = $781 ? $$1260 : $697;
      $$0470$i = $$553$i;
     } else {
      $388 = $$0235 & 32;
      $389 = ($388|0)!=(0);
      $390 = $389 ? 5908 : 5912;
      $391 = ($$0471$i != $$0471$i) | (0.0 != 0.0);
      $392 = $389 ? 5916 : 5920;
      $$1521$i = $391 ? 0 : $$0520$i;
      $$0510$i = $391 ? $392 : $390;
      $393 = (($$1521$i) + 3)|0;
      _pad($0,32,$$1260,$393,$187);
      $394 = HEAP32[$0>>2]|0;
      $395 = $394 & 32;
      $396 = ($395|0)==(0);
      if ($396) {
       (___fwritex($$0522$i,$$1521$i,$0)|0);
       $$pre$i = HEAP32[$0>>2]|0;
       $398 = $$pre$i;
      } else {
       $398 = $394;
      }
      $397 = $398 & 32;
      $399 = ($397|0)==(0);
      if ($399) {
       (___fwritex($$0510$i,3,$0)|0);
      }
      $400 = $$1263$ ^ 8192;
      _pad($0,32,$$1260,$393,$400);
      $401 = ($393|0)<($$1260|0);
      $402 = $401 ? $$1260 : $393;
      $$0470$i = $402;
     }
    } while(0);
    $$0243 = $$0470$i;$$0247 = $$1248;$$0269 = $$3272;$$0321 = $158;
    continue L1;
    break;
   }
   default: {
    $$2 = $$0321;$$2234 = 0;$$2239 = 5872;$$2251 = $14;$$5 = $$0254;$$6268 = $$1263$;
   }
   }
  } while(0);
  L310: do {
   if ((label|0) == 63) {
    label = 0;
    $218 = $9;
    $219 = $218;
    $220 = HEAP32[$219>>2]|0;
    $221 = (($218) + 4)|0;
    $222 = $221;
    $223 = HEAP32[$222>>2]|0;
    $224 = $$1236 & 32;
    $225 = ($220|0)==(0);
    $226 = ($223|0)==(0);
    $227 = $225 & $226;
    if ($227) {
     $$05$lcssa$i = $14;$248 = 0;$250 = 0;
    } else {
     $$056$i = $14;$229 = $220;$236 = $223;
     while(1) {
      $228 = $229 & 15;
      $230 = (5856 + ($228)|0);
      $231 = HEAP8[$230>>0]|0;
      $232 = $231&255;
      $233 = $232 | $224;
      $234 = $233&255;
      $235 = ((($$056$i)) + -1|0);
      HEAP8[$235>>0] = $234;
      $237 = (_bitshift64Lshr(($229|0),($236|0),4)|0);
      $238 = tempRet0;
      $239 = ($237|0)==(0);
      $240 = ($238|0)==(0);
      $241 = $239 & $240;
      if ($241) {
       break;
      } else {
       $$056$i = $235;$229 = $237;$236 = $238;
      }
     }
     $242 = $9;
     $243 = $242;
     $244 = HEAP32[$243>>2]|0;
     $245 = (($242) + 4)|0;
     $246 = $245;
     $247 = HEAP32[$246>>2]|0;
     $$05$lcssa$i = $235;$248 = $244;$250 = $247;
    }
    $249 = ($248|0)==(0);
    $251 = ($250|0)==(0);
    $252 = $249 & $251;
    $253 = $$3265 & 8;
    $254 = ($253|0)==(0);
    $or$cond282 = $254 | $252;
    $255 = $$1236 >> 4;
    $256 = (5872 + ($255)|0);
    $$332 = $or$cond282 ? 5872 : $256;
    $$333 = $or$cond282 ? 0 : 2;
    $$0228 = $$05$lcssa$i;$$1233 = $$333;$$1238 = $$332;$$2256 = $$1255;$$4266 = $$3265;
    label = 76;
   }
   else if ((label|0) == 75) {
    label = 0;
    $302 = (_fmt_u($300,$301,$14)|0);
    $$0228 = $302;$$1233 = $$0232;$$1238 = $$0237;$$2256 = $$0254;$$4266 = $$1263$;
    label = 76;
   }
   else if ((label|0) == 81) {
    label = 0;
    $334 = (_memchr($$1,0,$$0254)|0);
    $335 = ($334|0)==(0|0);
    $336 = $334;
    $337 = $$1;
    $338 = (($336) - ($337))|0;
    $339 = (($$1) + ($$0254)|0);
    $$3257 = $335 ? $$0254 : $338;
    $$1250 = $335 ? $339 : $334;
    $$2 = $$1;$$2234 = 0;$$2239 = 5872;$$2251 = $$1250;$$5 = $$3257;$$6268 = $187;
   }
   else if ((label|0) == 85) {
    label = 0;
    $$0229396 = $809;$$0240395 = 0;$$1244394 = 0;
    while(1) {
     $347 = HEAP32[$$0229396>>2]|0;
     $348 = ($347|0)==(0);
     if ($348) {
      $$0240$lcssa = $$0240395;$$2245 = $$1244394;
      break;
     }
     $349 = (_wctomb($12,$347)|0);
     $350 = ($349|0)<(0);
     $351 = (($$4258458) - ($$0240395))|0;
     $352 = ($349>>>0)>($351>>>0);
     $or$cond285 = $350 | $352;
     if ($or$cond285) {
      $$0240$lcssa = $$0240395;$$2245 = $349;
      break;
     }
     $353 = ((($$0229396)) + 4|0);
     $354 = (($349) + ($$0240395))|0;
     $355 = ($$4258458>>>0)>($354>>>0);
     if ($355) {
      $$0229396 = $353;$$0240395 = $354;$$1244394 = $349;
     } else {
      $$0240$lcssa = $354;$$2245 = $349;
      break;
     }
    }
    $356 = ($$2245|0)<(0);
    if ($356) {
     $$0 = -1;
     break L1;
    }
    _pad($0,32,$$1260,$$0240$lcssa,$$1263$);
    $357 = ($$0240$lcssa|0)==(0);
    if ($357) {
     $$0240$lcssa460 = 0;
     label = 96;
    } else {
     $$1230407 = $809;$$1241406 = 0;
     while(1) {
      $358 = HEAP32[$$1230407>>2]|0;
      $359 = ($358|0)==(0);
      if ($359) {
       $$0240$lcssa460 = $$0240$lcssa;
       label = 96;
       break L310;
      }
      $360 = ((($$1230407)) + 4|0);
      $361 = (_wctomb($12,$358)|0);
      $362 = (($361) + ($$1241406))|0;
      $363 = ($362|0)>($$0240$lcssa|0);
      if ($363) {
       $$0240$lcssa460 = $$0240$lcssa;
       label = 96;
       break L310;
      }
      $364 = HEAP32[$0>>2]|0;
      $365 = $364 & 32;
      $366 = ($365|0)==(0);
      if ($366) {
       (___fwritex($12,$361,$0)|0);
      }
      $367 = ($362>>>0)<($$0240$lcssa>>>0);
      if ($367) {
       $$1230407 = $360;$$1241406 = $362;
      } else {
       $$0240$lcssa460 = $$0240$lcssa;
       label = 96;
       break;
      }
     }
    }
   }
  } while(0);
  if ((label|0) == 96) {
   label = 0;
   $368 = $$1263$ ^ 8192;
   _pad($0,32,$$1260,$$0240$lcssa460,$368);
   $369 = ($$1260|0)>($$0240$lcssa460|0);
   $370 = $369 ? $$1260 : $$0240$lcssa460;
   $$0243 = $370;$$0247 = $$1248;$$0269 = $$3272;$$0321 = $158;
   continue;
  }
  if ((label|0) == 76) {
   label = 0;
   $303 = ($$2256|0)>(-1);
   $304 = $$4266 & -65537;
   $$$4266 = $303 ? $304 : $$4266;
   $305 = $9;
   $306 = $305;
   $307 = HEAP32[$306>>2]|0;
   $308 = (($305) + 4)|0;
   $309 = $308;
   $310 = HEAP32[$309>>2]|0;
   $311 = ($307|0)!=(0);
   $312 = ($310|0)!=(0);
   $313 = $311 | $312;
   $314 = ($$2256|0)!=(0);
   $or$cond = $314 | $313;
   if ($or$cond) {
    $315 = $$0228;
    $316 = (($15) - ($315))|0;
    $317 = $313&1;
    $318 = $317 ^ 1;
    $319 = (($318) + ($316))|0;
    $320 = ($$2256|0)>($319|0);
    $$2256$ = $320 ? $$2256 : $319;
    $$2 = $$0228;$$2234 = $$1233;$$2239 = $$1238;$$2251 = $14;$$5 = $$2256$;$$6268 = $$$4266;
   } else {
    $$2 = $14;$$2234 = $$1233;$$2239 = $$1238;$$2251 = $14;$$5 = 0;$$6268 = $$$4266;
   }
  }
  $782 = $$2251;
  $783 = $$2;
  $784 = (($782) - ($783))|0;
  $785 = ($$5|0)<($784|0);
  $$$5 = $785 ? $784 : $$5;
  $786 = (($$$5) + ($$2234))|0;
  $787 = ($$1260|0)<($786|0);
  $$2261 = $787 ? $786 : $$1260;
  _pad($0,32,$$2261,$786,$$6268);
  $788 = HEAP32[$0>>2]|0;
  $789 = $788 & 32;
  $790 = ($789|0)==(0);
  if ($790) {
   (___fwritex($$2239,$$2234,$0)|0);
  }
  $791 = $$6268 ^ 65536;
  _pad($0,48,$$2261,$786,$791);
  _pad($0,48,$$$5,$784,0);
  $792 = HEAP32[$0>>2]|0;
  $793 = $792 & 32;
  $794 = ($793|0)==(0);
  if ($794) {
   (___fwritex($$2,$784,$0)|0);
  }
  $795 = $$6268 ^ 8192;
  _pad($0,32,$$2261,$786,$795);
  $$0243 = $$2261;$$0247 = $$1248;$$0269 = $$3272;$$0321 = $158;
 }
 L345: do {
  if ((label|0) == 243) {
   $796 = ($0|0)==(0|0);
   if ($796) {
    $797 = ($$0269|0)==(0);
    if ($797) {
     $$0 = 0;
    } else {
     $$2242381 = 1;
     while(1) {
      $798 = (($4) + ($$2242381<<2)|0);
      $799 = HEAP32[$798>>2]|0;
      $800 = ($799|0)==(0);
      if ($800) {
       $$3379 = $$2242381;
       break;
      }
      $801 = (($3) + ($$2242381<<3)|0);
      _pop_arg_291($801,$799,$2);
      $802 = (($$2242381) + 1)|0;
      $803 = ($802|0)<(10);
      if ($803) {
       $$2242381 = $802;
      } else {
       $$0 = 1;
       break L345;
      }
     }
     while(1) {
      $806 = (($4) + ($$3379<<2)|0);
      $807 = HEAP32[$806>>2]|0;
      $808 = ($807|0)==(0);
      $804 = (($$3379) + 1)|0;
      if (!($808)) {
       $$0 = -1;
       break L345;
      }
      $805 = ($804|0)<(10);
      if ($805) {
       $$3379 = $804;
      } else {
       $$0 = 1;
       break;
      }
     }
    }
   } else {
    $$0 = $$1248;
   }
  }
 } while(0);
 STACKTOP = sp;return ($$0|0);
}
function ___lockfile($0) {
 $0 = $0|0;
 var label = 0, sp = 0;
 sp = STACKTOP;
 return 0;
}
function ___fwritex($0,$1,$2) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 var $$0 = 0, $$032 = 0, $$033 = 0, $$034 = 0, $$1 = 0, $$pre = 0, $$pre38 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $20 = 0, $21 = 0, $22 = 0;
 var $23 = 0, $24 = 0, $25 = 0, $26 = 0, $27 = 0, $28 = 0, $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0;
 var label = 0, sp = 0;
 sp = STACKTOP;
 $3 = ((($2)) + 16|0);
 $4 = HEAP32[$3>>2]|0;
 $5 = ($4|0)==(0|0);
 if ($5) {
  $7 = (___towrite($2)|0);
  $8 = ($7|0)==(0);
  if ($8) {
   $$pre = HEAP32[$3>>2]|0;
   $12 = $$pre;
   label = 5;
  } else {
   $$032 = 0;
  }
 } else {
  $6 = $4;
  $12 = $6;
  label = 5;
 }
 L5: do {
  if ((label|0) == 5) {
   $9 = ((($2)) + 20|0);
   $10 = HEAP32[$9>>2]|0;
   $11 = (($12) - ($10))|0;
   $13 = ($11>>>0)<($1>>>0);
   $14 = $10;
   if ($13) {
    $15 = ((($2)) + 36|0);
    $16 = HEAP32[$15>>2]|0;
    $17 = (FUNCTION_TABLE_iiii[$16 & 15]($2,$0,$1)|0);
    $$032 = $17;
    break;
   }
   $18 = ((($2)) + 75|0);
   $19 = HEAP8[$18>>0]|0;
   $20 = ($19<<24>>24)>(-1);
   L10: do {
    if ($20) {
     $$0 = $1;
     while(1) {
      $21 = ($$0|0)==(0);
      if ($21) {
       $$033 = $1;$$034 = $0;$$1 = 0;$32 = $14;
       break L10;
      }
      $22 = (($$0) + -1)|0;
      $23 = (($0) + ($22)|0);
      $24 = HEAP8[$23>>0]|0;
      $25 = ($24<<24>>24)==(10);
      if ($25) {
       break;
      } else {
       $$0 = $22;
      }
     }
     $26 = ((($2)) + 36|0);
     $27 = HEAP32[$26>>2]|0;
     $28 = (FUNCTION_TABLE_iiii[$27 & 15]($2,$0,$$0)|0);
     $29 = ($28>>>0)<($$0>>>0);
     if ($29) {
      $$032 = $$0;
      break L5;
     }
     $30 = (($0) + ($$0)|0);
     $31 = (($1) - ($$0))|0;
     $$pre38 = HEAP32[$9>>2]|0;
     $$033 = $31;$$034 = $30;$$1 = $$0;$32 = $$pre38;
    } else {
     $$033 = $1;$$034 = $0;$$1 = 0;$32 = $14;
    }
   } while(0);
   _memcpy(($32|0),($$034|0),($$033|0))|0;
   $33 = HEAP32[$9>>2]|0;
   $34 = (($33) + ($$033)|0);
   HEAP32[$9>>2] = $34;
   $35 = (($$1) + ($$033))|0;
   $$032 = $35;
  }
 } while(0);
 return ($$032|0);
}
function _pop_arg_291($0,$1,$2) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 var $$mask = 0, $$mask31 = 0, $10 = 0, $100 = 0, $101 = 0, $102 = 0, $103 = 0, $104 = 0, $105 = 0, $106 = 0, $107 = 0, $108 = 0, $109 = 0.0, $11 = 0, $110 = 0, $111 = 0, $112 = 0, $113 = 0, $114 = 0, $115 = 0;
 var $116 = 0.0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0, $27 = 0, $28 = 0, $29 = 0, $3 = 0;
 var $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0, $41 = 0, $42 = 0, $43 = 0, $44 = 0, $45 = 0, $46 = 0, $47 = 0, $48 = 0;
 var $49 = 0, $5 = 0, $50 = 0, $51 = 0, $52 = 0, $53 = 0, $54 = 0, $55 = 0, $56 = 0, $57 = 0, $58 = 0, $59 = 0, $6 = 0, $60 = 0, $61 = 0, $62 = 0, $63 = 0, $64 = 0, $65 = 0, $66 = 0;
 var $67 = 0, $68 = 0, $69 = 0, $7 = 0, $70 = 0, $71 = 0, $72 = 0, $73 = 0, $74 = 0, $75 = 0, $76 = 0, $77 = 0, $78 = 0, $79 = 0, $8 = 0, $80 = 0, $81 = 0, $82 = 0, $83 = 0, $84 = 0;
 var $85 = 0, $86 = 0, $87 = 0, $88 = 0, $89 = 0, $9 = 0, $90 = 0, $91 = 0, $92 = 0, $93 = 0, $94 = 0, $95 = 0, $96 = 0, $97 = 0, $98 = 0, $99 = 0, $arglist_current = 0, $arglist_current11 = 0, $arglist_current14 = 0, $arglist_current17 = 0;
 var $arglist_current2 = 0, $arglist_current20 = 0, $arglist_current23 = 0, $arglist_current26 = 0, $arglist_current5 = 0, $arglist_current8 = 0, $arglist_next = 0, $arglist_next12 = 0, $arglist_next15 = 0, $arglist_next18 = 0, $arglist_next21 = 0, $arglist_next24 = 0, $arglist_next27 = 0, $arglist_next3 = 0, $arglist_next6 = 0, $arglist_next9 = 0, $expanded = 0, $expanded28 = 0, $expanded30 = 0, $expanded31 = 0;
 var $expanded32 = 0, $expanded34 = 0, $expanded35 = 0, $expanded37 = 0, $expanded38 = 0, $expanded39 = 0, $expanded41 = 0, $expanded42 = 0, $expanded44 = 0, $expanded45 = 0, $expanded46 = 0, $expanded48 = 0, $expanded49 = 0, $expanded51 = 0, $expanded52 = 0, $expanded53 = 0, $expanded55 = 0, $expanded56 = 0, $expanded58 = 0, $expanded59 = 0;
 var $expanded60 = 0, $expanded62 = 0, $expanded63 = 0, $expanded65 = 0, $expanded66 = 0, $expanded67 = 0, $expanded69 = 0, $expanded70 = 0, $expanded72 = 0, $expanded73 = 0, $expanded74 = 0, $expanded76 = 0, $expanded77 = 0, $expanded79 = 0, $expanded80 = 0, $expanded81 = 0, $expanded83 = 0, $expanded84 = 0, $expanded86 = 0, $expanded87 = 0;
 var $expanded88 = 0, $expanded90 = 0, $expanded91 = 0, $expanded93 = 0, $expanded94 = 0, $expanded95 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $3 = ($1>>>0)>(20);
 L1: do {
  if (!($3)) {
   do {
    switch ($1|0) {
    case 9:  {
     $arglist_current = HEAP32[$2>>2]|0;
     $4 = $arglist_current;
     $5 = ((0) + 4|0);
     $expanded28 = $5;
     $expanded = (($expanded28) - 1)|0;
     $6 = (($4) + ($expanded))|0;
     $7 = ((0) + 4|0);
     $expanded32 = $7;
     $expanded31 = (($expanded32) - 1)|0;
     $expanded30 = $expanded31 ^ -1;
     $8 = $6 & $expanded30;
     $9 = $8;
     $10 = HEAP32[$9>>2]|0;
     $arglist_next = ((($9)) + 4|0);
     HEAP32[$2>>2] = $arglist_next;
     HEAP32[$0>>2] = $10;
     break L1;
     break;
    }
    case 10:  {
     $arglist_current2 = HEAP32[$2>>2]|0;
     $11 = $arglist_current2;
     $12 = ((0) + 4|0);
     $expanded35 = $12;
     $expanded34 = (($expanded35) - 1)|0;
     $13 = (($11) + ($expanded34))|0;
     $14 = ((0) + 4|0);
     $expanded39 = $14;
     $expanded38 = (($expanded39) - 1)|0;
     $expanded37 = $expanded38 ^ -1;
     $15 = $13 & $expanded37;
     $16 = $15;
     $17 = HEAP32[$16>>2]|0;
     $arglist_next3 = ((($16)) + 4|0);
     HEAP32[$2>>2] = $arglist_next3;
     $18 = ($17|0)<(0);
     $19 = $18 << 31 >> 31;
     $20 = $0;
     $21 = $20;
     HEAP32[$21>>2] = $17;
     $22 = (($20) + 4)|0;
     $23 = $22;
     HEAP32[$23>>2] = $19;
     break L1;
     break;
    }
    case 11:  {
     $arglist_current5 = HEAP32[$2>>2]|0;
     $24 = $arglist_current5;
     $25 = ((0) + 4|0);
     $expanded42 = $25;
     $expanded41 = (($expanded42) - 1)|0;
     $26 = (($24) + ($expanded41))|0;
     $27 = ((0) + 4|0);
     $expanded46 = $27;
     $expanded45 = (($expanded46) - 1)|0;
     $expanded44 = $expanded45 ^ -1;
     $28 = $26 & $expanded44;
     $29 = $28;
     $30 = HEAP32[$29>>2]|0;
     $arglist_next6 = ((($29)) + 4|0);
     HEAP32[$2>>2] = $arglist_next6;
     $31 = $0;
     $32 = $31;
     HEAP32[$32>>2] = $30;
     $33 = (($31) + 4)|0;
     $34 = $33;
     HEAP32[$34>>2] = 0;
     break L1;
     break;
    }
    case 12:  {
     $arglist_current8 = HEAP32[$2>>2]|0;
     $35 = $arglist_current8;
     $36 = ((0) + 8|0);
     $expanded49 = $36;
     $expanded48 = (($expanded49) - 1)|0;
     $37 = (($35) + ($expanded48))|0;
     $38 = ((0) + 8|0);
     $expanded53 = $38;
     $expanded52 = (($expanded53) - 1)|0;
     $expanded51 = $expanded52 ^ -1;
     $39 = $37 & $expanded51;
     $40 = $39;
     $41 = $40;
     $42 = $41;
     $43 = HEAP32[$42>>2]|0;
     $44 = (($41) + 4)|0;
     $45 = $44;
     $46 = HEAP32[$45>>2]|0;
     $arglist_next9 = ((($40)) + 8|0);
     HEAP32[$2>>2] = $arglist_next9;
     $47 = $0;
     $48 = $47;
     HEAP32[$48>>2] = $43;
     $49 = (($47) + 4)|0;
     $50 = $49;
     HEAP32[$50>>2] = $46;
     break L1;
     break;
    }
    case 13:  {
     $arglist_current11 = HEAP32[$2>>2]|0;
     $51 = $arglist_current11;
     $52 = ((0) + 4|0);
     $expanded56 = $52;
     $expanded55 = (($expanded56) - 1)|0;
     $53 = (($51) + ($expanded55))|0;
     $54 = ((0) + 4|0);
     $expanded60 = $54;
     $expanded59 = (($expanded60) - 1)|0;
     $expanded58 = $expanded59 ^ -1;
     $55 = $53 & $expanded58;
     $56 = $55;
     $57 = HEAP32[$56>>2]|0;
     $arglist_next12 = ((($56)) + 4|0);
     HEAP32[$2>>2] = $arglist_next12;
     $58 = $57&65535;
     $59 = $58 << 16 >> 16;
     $60 = ($59|0)<(0);
     $61 = $60 << 31 >> 31;
     $62 = $0;
     $63 = $62;
     HEAP32[$63>>2] = $59;
     $64 = (($62) + 4)|0;
     $65 = $64;
     HEAP32[$65>>2] = $61;
     break L1;
     break;
    }
    case 14:  {
     $arglist_current14 = HEAP32[$2>>2]|0;
     $66 = $arglist_current14;
     $67 = ((0) + 4|0);
     $expanded63 = $67;
     $expanded62 = (($expanded63) - 1)|0;
     $68 = (($66) + ($expanded62))|0;
     $69 = ((0) + 4|0);
     $expanded67 = $69;
     $expanded66 = (($expanded67) - 1)|0;
     $expanded65 = $expanded66 ^ -1;
     $70 = $68 & $expanded65;
     $71 = $70;
     $72 = HEAP32[$71>>2]|0;
     $arglist_next15 = ((($71)) + 4|0);
     HEAP32[$2>>2] = $arglist_next15;
     $$mask31 = $72 & 65535;
     $73 = $0;
     $74 = $73;
     HEAP32[$74>>2] = $$mask31;
     $75 = (($73) + 4)|0;
     $76 = $75;
     HEAP32[$76>>2] = 0;
     break L1;
     break;
    }
    case 15:  {
     $arglist_current17 = HEAP32[$2>>2]|0;
     $77 = $arglist_current17;
     $78 = ((0) + 4|0);
     $expanded70 = $78;
     $expanded69 = (($expanded70) - 1)|0;
     $79 = (($77) + ($expanded69))|0;
     $80 = ((0) + 4|0);
     $expanded74 = $80;
     $expanded73 = (($expanded74) - 1)|0;
     $expanded72 = $expanded73 ^ -1;
     $81 = $79 & $expanded72;
     $82 = $81;
     $83 = HEAP32[$82>>2]|0;
     $arglist_next18 = ((($82)) + 4|0);
     HEAP32[$2>>2] = $arglist_next18;
     $84 = $83&255;
     $85 = $84 << 24 >> 24;
     $86 = ($85|0)<(0);
     $87 = $86 << 31 >> 31;
     $88 = $0;
     $89 = $88;
     HEAP32[$89>>2] = $85;
     $90 = (($88) + 4)|0;
     $91 = $90;
     HEAP32[$91>>2] = $87;
     break L1;
     break;
    }
    case 16:  {
     $arglist_current20 = HEAP32[$2>>2]|0;
     $92 = $arglist_current20;
     $93 = ((0) + 4|0);
     $expanded77 = $93;
     $expanded76 = (($expanded77) - 1)|0;
     $94 = (($92) + ($expanded76))|0;
     $95 = ((0) + 4|0);
     $expanded81 = $95;
     $expanded80 = (($expanded81) - 1)|0;
     $expanded79 = $expanded80 ^ -1;
     $96 = $94 & $expanded79;
     $97 = $96;
     $98 = HEAP32[$97>>2]|0;
     $arglist_next21 = ((($97)) + 4|0);
     HEAP32[$2>>2] = $arglist_next21;
     $$mask = $98 & 255;
     $99 = $0;
     $100 = $99;
     HEAP32[$100>>2] = $$mask;
     $101 = (($99) + 4)|0;
     $102 = $101;
     HEAP32[$102>>2] = 0;
     break L1;
     break;
    }
    case 17:  {
     $arglist_current23 = HEAP32[$2>>2]|0;
     $103 = $arglist_current23;
     $104 = ((0) + 8|0);
     $expanded84 = $104;
     $expanded83 = (($expanded84) - 1)|0;
     $105 = (($103) + ($expanded83))|0;
     $106 = ((0) + 8|0);
     $expanded88 = $106;
     $expanded87 = (($expanded88) - 1)|0;
     $expanded86 = $expanded87 ^ -1;
     $107 = $105 & $expanded86;
     $108 = $107;
     $109 = +HEAPF64[$108>>3];
     $arglist_next24 = ((($108)) + 8|0);
     HEAP32[$2>>2] = $arglist_next24;
     HEAPF64[$0>>3] = $109;
     break L1;
     break;
    }
    case 18:  {
     $arglist_current26 = HEAP32[$2>>2]|0;
     $110 = $arglist_current26;
     $111 = ((0) + 8|0);
     $expanded91 = $111;
     $expanded90 = (($expanded91) - 1)|0;
     $112 = (($110) + ($expanded90))|0;
     $113 = ((0) + 8|0);
     $expanded95 = $113;
     $expanded94 = (($expanded95) - 1)|0;
     $expanded93 = $expanded94 ^ -1;
     $114 = $112 & $expanded93;
     $115 = $114;
     $116 = +HEAPF64[$115>>3];
     $arglist_next27 = ((($115)) + 8|0);
     HEAP32[$2>>2] = $arglist_next27;
     HEAPF64[$0>>3] = $116;
     break L1;
     break;
    }
    default: {
     break L1;
    }
    }
   } while(0);
  }
 } while(0);
 return;
}
function _fmt_u($0,$1,$2) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 var $$010$lcssa$off0 = 0, $$012 = 0, $$09$lcssa = 0, $$0914 = 0, $$1$lcssa = 0, $$111 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0;
 var $24 = 0, $25 = 0, $26 = 0, $27 = 0, $28 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $3 = ($1>>>0)>(0);
 $4 = ($0>>>0)>(4294967295);
 $5 = ($1|0)==(0);
 $6 = $5 & $4;
 $7 = $3 | $6;
 if ($7) {
  $$0914 = $2;$8 = $0;$9 = $1;
  while(1) {
   $10 = (___uremdi3(($8|0),($9|0),10,0)|0);
   $11 = tempRet0;
   $12 = $10 | 48;
   $13 = $12&255;
   $14 = ((($$0914)) + -1|0);
   HEAP8[$14>>0] = $13;
   $15 = (___udivdi3(($8|0),($9|0),10,0)|0);
   $16 = tempRet0;
   $17 = ($9>>>0)>(9);
   $18 = ($8>>>0)>(4294967295);
   $19 = ($9|0)==(9);
   $20 = $19 & $18;
   $21 = $17 | $20;
   if ($21) {
    $$0914 = $14;$8 = $15;$9 = $16;
   } else {
    break;
   }
  }
  $$010$lcssa$off0 = $15;$$09$lcssa = $14;
 } else {
  $$010$lcssa$off0 = $0;$$09$lcssa = $2;
 }
 $22 = ($$010$lcssa$off0|0)==(0);
 if ($22) {
  $$1$lcssa = $$09$lcssa;
 } else {
  $$012 = $$010$lcssa$off0;$$111 = $$09$lcssa;
  while(1) {
   $23 = (($$012>>>0) % 10)&-1;
   $24 = $23 | 48;
   $25 = $24&255;
   $26 = ((($$111)) + -1|0);
   HEAP8[$26>>0] = $25;
   $27 = (($$012>>>0) / 10)&-1;
   $28 = ($$012>>>0)<(10);
   if ($28) {
    $$1$lcssa = $26;
    break;
   } else {
    $$012 = $27;$$111 = $26;
   }
  }
 }
 return ($$1$lcssa|0);
}
function _memchr($0,$1,$2) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 var $$0$lcssa = 0, $$035$lcssa = 0, $$035$lcssa65 = 0, $$03555 = 0, $$036$lcssa = 0, $$036$lcssa64 = 0, $$03654 = 0, $$046 = 0, $$137$lcssa = 0, $$13745 = 0, $$140 = 0, $$2 = 0, $$23839 = 0, $$3 = 0, $$lcssa = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0;
 var $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0, $27 = 0, $28 = 0, $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0;
 var $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, $or$cond = 0, $or$cond53 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $3 = $1 & 255;
 $4 = $0;
 $5 = $4 & 3;
 $6 = ($5|0)!=(0);
 $7 = ($2|0)!=(0);
 $or$cond53 = $7 & $6;
 L1: do {
  if ($or$cond53) {
   $8 = $1&255;
   $$03555 = $0;$$03654 = $2;
   while(1) {
    $9 = HEAP8[$$03555>>0]|0;
    $10 = ($9<<24>>24)==($8<<24>>24);
    if ($10) {
     $$035$lcssa65 = $$03555;$$036$lcssa64 = $$03654;
     label = 6;
     break L1;
    }
    $11 = ((($$03555)) + 1|0);
    $12 = (($$03654) + -1)|0;
    $13 = $11;
    $14 = $13 & 3;
    $15 = ($14|0)!=(0);
    $16 = ($12|0)!=(0);
    $or$cond = $16 & $15;
    if ($or$cond) {
     $$03555 = $11;$$03654 = $12;
    } else {
     $$035$lcssa = $11;$$036$lcssa = $12;$$lcssa = $16;
     label = 5;
     break;
    }
   }
  } else {
   $$035$lcssa = $0;$$036$lcssa = $2;$$lcssa = $7;
   label = 5;
  }
 } while(0);
 if ((label|0) == 5) {
  if ($$lcssa) {
   $$035$lcssa65 = $$035$lcssa;$$036$lcssa64 = $$036$lcssa;
   label = 6;
  } else {
   $$2 = $$035$lcssa;$$3 = 0;
  }
 }
 L8: do {
  if ((label|0) == 6) {
   $17 = HEAP8[$$035$lcssa65>>0]|0;
   $18 = $1&255;
   $19 = ($17<<24>>24)==($18<<24>>24);
   if ($19) {
    $$2 = $$035$lcssa65;$$3 = $$036$lcssa64;
   } else {
    $20 = Math_imul($3, 16843009)|0;
    $21 = ($$036$lcssa64>>>0)>(3);
    L11: do {
     if ($21) {
      $$046 = $$035$lcssa65;$$13745 = $$036$lcssa64;
      while(1) {
       $22 = HEAP32[$$046>>2]|0;
       $23 = $22 ^ $20;
       $24 = (($23) + -16843009)|0;
       $25 = $23 & -2139062144;
       $26 = $25 ^ -2139062144;
       $27 = $26 & $24;
       $28 = ($27|0)==(0);
       if (!($28)) {
        break;
       }
       $29 = ((($$046)) + 4|0);
       $30 = (($$13745) + -4)|0;
       $31 = ($30>>>0)>(3);
       if ($31) {
        $$046 = $29;$$13745 = $30;
       } else {
        $$0$lcssa = $29;$$137$lcssa = $30;
        label = 11;
        break L11;
       }
      }
      $$140 = $$046;$$23839 = $$13745;
     } else {
      $$0$lcssa = $$035$lcssa65;$$137$lcssa = $$036$lcssa64;
      label = 11;
     }
    } while(0);
    if ((label|0) == 11) {
     $32 = ($$137$lcssa|0)==(0);
     if ($32) {
      $$2 = $$0$lcssa;$$3 = 0;
      break;
     } else {
      $$140 = $$0$lcssa;$$23839 = $$137$lcssa;
     }
    }
    while(1) {
     $33 = HEAP8[$$140>>0]|0;
     $34 = ($33<<24>>24)==($18<<24>>24);
     if ($34) {
      $$2 = $$140;$$3 = $$23839;
      break L8;
     }
     $35 = ((($$140)) + 1|0);
     $36 = (($$23839) + -1)|0;
     $37 = ($36|0)==(0);
     if ($37) {
      $$2 = $35;$$3 = 0;
      break;
     } else {
      $$140 = $35;$$23839 = $36;
     }
    }
   }
  }
 } while(0);
 $38 = ($$3|0)!=(0);
 $39 = $38 ? $$2 : 0;
 return ($39|0);
}
function _pad($0,$1,$2,$3,$4) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 $3 = $3|0;
 $4 = $4|0;
 var $$0$lcssa16 = 0, $$012 = 0, $$pre = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $5 = 0, $6 = 0;
 var $7 = 0, $8 = 0, $9 = 0, $or$cond = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 256|0;
 $5 = sp;
 $6 = $4 & 73728;
 $7 = ($6|0)==(0);
 $8 = ($2|0)>($3|0);
 $or$cond = $8 & $7;
 do {
  if ($or$cond) {
   $9 = (($2) - ($3))|0;
   $10 = ($9>>>0)>(256);
   $11 = $10 ? 256 : $9;
   _memset(($5|0),($1|0),($11|0))|0;
   $12 = ($9>>>0)>(255);
   $13 = HEAP32[$0>>2]|0;
   $14 = $13 & 32;
   $15 = ($14|0)==(0);
   if ($12) {
    $16 = (($2) - ($3))|0;
    $$012 = $9;$23 = $13;$24 = $15;
    while(1) {
     if ($24) {
      (___fwritex($5,256,$0)|0);
      $$pre = HEAP32[$0>>2]|0;
      $20 = $$pre;
     } else {
      $20 = $23;
     }
     $17 = (($$012) + -256)|0;
     $18 = ($17>>>0)>(255);
     $19 = $20 & 32;
     $21 = ($19|0)==(0);
     if ($18) {
      $$012 = $17;$23 = $20;$24 = $21;
     } else {
      break;
     }
    }
    $22 = $16 & 255;
    if ($21) {
     $$0$lcssa16 = $22;
    } else {
     break;
    }
   } else {
    if ($15) {
     $$0$lcssa16 = $9;
    } else {
     break;
    }
   }
   (___fwritex($5,$$0$lcssa16,$0)|0);
  }
 } while(0);
 STACKTOP = sp;return;
}
function _wctomb($0,$1) {
 $0 = $0|0;
 $1 = $1|0;
 var $$0 = 0, $2 = 0, $3 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $2 = ($0|0)==(0|0);
 if ($2) {
  $$0 = 0;
 } else {
  $3 = (_wcrtomb($0,$1,0)|0);
  $$0 = $3;
 }
 return ($$0|0);
}
function _wcrtomb($0,$1,$2) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 var $$0 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0, $27 = 0, $28 = 0;
 var $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0, $41 = 0, $42 = 0, $43 = 0, $44 = 0, $45 = 0, $46 = 0;
 var $47 = 0, $48 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, $or$cond = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $3 = ($0|0)==(0|0);
 do {
  if ($3) {
   $$0 = 1;
  } else {
   $4 = ($1>>>0)<(128);
   if ($4) {
    $5 = $1&255;
    HEAP8[$0>>0] = $5;
    $$0 = 1;
    break;
   }
   $6 = ($1>>>0)<(2048);
   if ($6) {
    $7 = $1 >>> 6;
    $8 = $7 | 192;
    $9 = $8&255;
    $10 = ((($0)) + 1|0);
    HEAP8[$0>>0] = $9;
    $11 = $1 & 63;
    $12 = $11 | 128;
    $13 = $12&255;
    HEAP8[$10>>0] = $13;
    $$0 = 2;
    break;
   }
   $14 = ($1>>>0)<(55296);
   $15 = $1 & -8192;
   $16 = ($15|0)==(57344);
   $or$cond = $14 | $16;
   if ($or$cond) {
    $17 = $1 >>> 12;
    $18 = $17 | 224;
    $19 = $18&255;
    $20 = ((($0)) + 1|0);
    HEAP8[$0>>0] = $19;
    $21 = $1 >>> 6;
    $22 = $21 & 63;
    $23 = $22 | 128;
    $24 = $23&255;
    $25 = ((($0)) + 2|0);
    HEAP8[$20>>0] = $24;
    $26 = $1 & 63;
    $27 = $26 | 128;
    $28 = $27&255;
    HEAP8[$25>>0] = $28;
    $$0 = 3;
    break;
   }
   $29 = (($1) + -65536)|0;
   $30 = ($29>>>0)<(1048576);
   if ($30) {
    $31 = $1 >>> 18;
    $32 = $31 | 240;
    $33 = $32&255;
    $34 = ((($0)) + 1|0);
    HEAP8[$0>>0] = $33;
    $35 = $1 >>> 12;
    $36 = $35 & 63;
    $37 = $36 | 128;
    $38 = $37&255;
    $39 = ((($0)) + 2|0);
    HEAP8[$34>>0] = $38;
    $40 = $1 >>> 6;
    $41 = $40 & 63;
    $42 = $41 | 128;
    $43 = $42&255;
    $44 = ((($0)) + 3|0);
    HEAP8[$39>>0] = $43;
    $45 = $1 & 63;
    $46 = $45 | 128;
    $47 = $46&255;
    HEAP8[$44>>0] = $47;
    $$0 = 4;
    break;
   } else {
    $48 = (___errno_location()|0);
    HEAP32[$48>>2] = 84;
    $$0 = -1;
    break;
   }
  }
 } while(0);
 return ($$0|0);
}
function ___towrite($0) {
 $0 = $0|0;
 var $$0 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0;
 var $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $1 = ((($0)) + 74|0);
 $2 = HEAP8[$1>>0]|0;
 $3 = $2 << 24 >> 24;
 $4 = (($3) + 255)|0;
 $5 = $4 | $3;
 $6 = $5&255;
 HEAP8[$1>>0] = $6;
 $7 = HEAP32[$0>>2]|0;
 $8 = $7 & 8;
 $9 = ($8|0)==(0);
 if ($9) {
  $11 = ((($0)) + 8|0);
  HEAP32[$11>>2] = 0;
  $12 = ((($0)) + 4|0);
  HEAP32[$12>>2] = 0;
  $13 = ((($0)) + 44|0);
  $14 = HEAP32[$13>>2]|0;
  $15 = ((($0)) + 28|0);
  HEAP32[$15>>2] = $14;
  $16 = ((($0)) + 20|0);
  HEAP32[$16>>2] = $14;
  $17 = $14;
  $18 = ((($0)) + 48|0);
  $19 = HEAP32[$18>>2]|0;
  $20 = (($17) + ($19)|0);
  $21 = ((($0)) + 16|0);
  HEAP32[$21>>2] = $20;
  $$0 = 0;
 } else {
  $10 = $7 | 32;
  HEAP32[$0>>2] = $10;
  $$0 = -1;
 }
 return ($$0|0);
}
function _fflush($0) {
 $0 = $0|0;
 var $$0 = 0, $$023 = 0, $$02325 = 0, $$02327 = 0, $$024$lcssa = 0, $$02426 = 0, $$1 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0;
 var $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0, $27 = 0, $28 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, $phitmp = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $1 = ($0|0)==(0|0);
 do {
  if ($1) {
   $8 = HEAP32[291]|0;
   $9 = ($8|0)==(0|0);
   if ($9) {
    $28 = 0;
   } else {
    $10 = HEAP32[291]|0;
    $11 = (_fflush($10)|0);
    $28 = $11;
   }
   ___lock(((6740)|0));
   $$02325 = HEAP32[(6736)>>2]|0;
   $12 = ($$02325|0)==(0|0);
   if ($12) {
    $$024$lcssa = $28;
   } else {
    $$02327 = $$02325;$$02426 = $28;
    while(1) {
     $13 = ((($$02327)) + 76|0);
     $14 = HEAP32[$13>>2]|0;
     $15 = ($14|0)>(-1);
     if ($15) {
      $16 = (___lockfile($$02327)|0);
      $24 = $16;
     } else {
      $24 = 0;
     }
     $17 = ((($$02327)) + 20|0);
     $18 = HEAP32[$17>>2]|0;
     $19 = ((($$02327)) + 28|0);
     $20 = HEAP32[$19>>2]|0;
     $21 = ($18>>>0)>($20>>>0);
     if ($21) {
      $22 = (___fflush_unlocked($$02327)|0);
      $23 = $22 | $$02426;
      $$1 = $23;
     } else {
      $$1 = $$02426;
     }
     $25 = ($24|0)==(0);
     if (!($25)) {
      ___unlockfile($$02327);
     }
     $26 = ((($$02327)) + 56|0);
     $$023 = HEAP32[$26>>2]|0;
     $27 = ($$023|0)==(0|0);
     if ($27) {
      $$024$lcssa = $$1;
      break;
     } else {
      $$02327 = $$023;$$02426 = $$1;
     }
    }
   }
   ___unlock(((6740)|0));
   $$0 = $$024$lcssa;
  } else {
   $2 = ((($0)) + 76|0);
   $3 = HEAP32[$2>>2]|0;
   $4 = ($3|0)>(-1);
   if (!($4)) {
    $5 = (___fflush_unlocked($0)|0);
    $$0 = $5;
    break;
   }
   $6 = (___lockfile($0)|0);
   $phitmp = ($6|0)==(0);
   $7 = (___fflush_unlocked($0)|0);
   if ($phitmp) {
    $$0 = $7;
   } else {
    ___unlockfile($0);
    $$0 = $7;
   }
  }
 } while(0);
 return ($$0|0);
}
function ___fflush_unlocked($0) {
 $0 = $0|0;
 var $$0 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0;
 var $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $1 = ((($0)) + 20|0);
 $2 = HEAP32[$1>>2]|0;
 $3 = ((($0)) + 28|0);
 $4 = HEAP32[$3>>2]|0;
 $5 = ($2>>>0)>($4>>>0);
 if ($5) {
  $6 = ((($0)) + 36|0);
  $7 = HEAP32[$6>>2]|0;
  (FUNCTION_TABLE_iiii[$7 & 15]($0,0,0)|0);
  $8 = HEAP32[$1>>2]|0;
  $9 = ($8|0)==(0|0);
  if ($9) {
   $$0 = -1;
  } else {
   label = 3;
  }
 } else {
  label = 3;
 }
 if ((label|0) == 3) {
  $10 = ((($0)) + 4|0);
  $11 = HEAP32[$10>>2]|0;
  $12 = ((($0)) + 8|0);
  $13 = HEAP32[$12>>2]|0;
  $14 = ($11>>>0)<($13>>>0);
  if ($14) {
   $15 = ((($0)) + 40|0);
   $16 = HEAP32[$15>>2]|0;
   $17 = $11;
   $18 = $13;
   $19 = (($17) - ($18))|0;
   (FUNCTION_TABLE_iiii[$16 & 15]($0,$19,1)|0);
  }
  $20 = ((($0)) + 16|0);
  HEAP32[$20>>2] = 0;
  HEAP32[$3>>2] = 0;
  HEAP32[$1>>2] = 0;
  HEAP32[$12>>2] = 0;
  HEAP32[$10>>2] = 0;
  $$0 = 0;
 }
 return ($$0|0);
}
function ___overflow($0,$1) {
 $0 = $0|0;
 $1 = $1|0;
 var $$0 = 0, $$pre = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $3 = 0, $4 = 0;
 var $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0;
 $2 = sp;
 $3 = $1&255;
 HEAP8[$2>>0] = $3;
 $4 = ((($0)) + 16|0);
 $5 = HEAP32[$4>>2]|0;
 $6 = ($5|0)==(0|0);
 if ($6) {
  $7 = (___towrite($0)|0);
  $8 = ($7|0)==(0);
  if ($8) {
   $$pre = HEAP32[$4>>2]|0;
   $12 = $$pre;
   label = 4;
  } else {
   $$0 = -1;
  }
 } else {
  $12 = $5;
  label = 4;
 }
 do {
  if ((label|0) == 4) {
   $9 = ((($0)) + 20|0);
   $10 = HEAP32[$9>>2]|0;
   $11 = ($10>>>0)<($12>>>0);
   if ($11) {
    $13 = $1 & 255;
    $14 = ((($0)) + 75|0);
    $15 = HEAP8[$14>>0]|0;
    $16 = $15 << 24 >> 24;
    $17 = ($13|0)==($16|0);
    if (!($17)) {
     $18 = ((($10)) + 1|0);
     HEAP32[$9>>2] = $18;
     HEAP8[$10>>0] = $3;
     $$0 = $13;
     break;
    }
   }
   $19 = ((($0)) + 36|0);
   $20 = HEAP32[$19>>2]|0;
   $21 = (FUNCTION_TABLE_iiii[$20 & 15]($0,$2,1)|0);
   $22 = ($21|0)==(1);
   if ($22) {
    $23 = HEAP8[$2>>0]|0;
    $24 = $23&255;
    $$0 = $24;
   } else {
    $$0 = -1;
   }
  }
 } while(0);
 STACKTOP = sp;return ($$0|0);
}
function _strlen($0) {
 $0 = $0|0;
 var $$0 = 0, $$014 = 0, $$015$lcssa = 0, $$01518 = 0, $$1$lcssa = 0, $$pn = 0, $$pn29 = 0, $$pre = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0;
 var $20 = 0, $21 = 0, $22 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $1 = $0;
 $2 = $1 & 3;
 $3 = ($2|0)==(0);
 L1: do {
  if ($3) {
   $$015$lcssa = $0;
   label = 4;
  } else {
   $$01518 = $0;$22 = $1;
   while(1) {
    $4 = HEAP8[$$01518>>0]|0;
    $5 = ($4<<24>>24)==(0);
    if ($5) {
     $$pn = $22;
     break L1;
    }
    $6 = ((($$01518)) + 1|0);
    $7 = $6;
    $8 = $7 & 3;
    $9 = ($8|0)==(0);
    if ($9) {
     $$015$lcssa = $6;
     label = 4;
     break;
    } else {
     $$01518 = $6;$22 = $7;
    }
   }
  }
 } while(0);
 if ((label|0) == 4) {
  $$0 = $$015$lcssa;
  while(1) {
   $10 = HEAP32[$$0>>2]|0;
   $11 = (($10) + -16843009)|0;
   $12 = $10 & -2139062144;
   $13 = $12 ^ -2139062144;
   $14 = $13 & $11;
   $15 = ($14|0)==(0);
   $16 = ((($$0)) + 4|0);
   if ($15) {
    $$0 = $16;
   } else {
    break;
   }
  }
  $17 = $10&255;
  $18 = ($17<<24>>24)==(0);
  if ($18) {
   $$1$lcssa = $$0;
  } else {
   $$pn29 = $$0;
   while(1) {
    $19 = ((($$pn29)) + 1|0);
    $$pre = HEAP8[$19>>0]|0;
    $20 = ($$pre<<24>>24)==(0);
    if ($20) {
     $$1$lcssa = $19;
     break;
    } else {
     $$pn29 = $19;
    }
   }
  }
  $21 = $$1$lcssa;
  $$pn = $21;
 }
 $$014 = (($$pn) - ($1))|0;
 return ($$014|0);
}
function _fputc($0,$1) {
 $0 = $0|0;
 $1 = $1|0;
 var $$0 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0, $27 = 0;
 var $28 = 0, $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $2 = ((($1)) + 76|0);
 $3 = HEAP32[$2>>2]|0;
 $4 = ($3|0)<(0);
 if ($4) {
  label = 3;
 } else {
  $5 = (___lockfile($1)|0);
  $6 = ($5|0)==(0);
  if ($6) {
   label = 3;
  } else {
   $20 = ((($1)) + 75|0);
   $21 = HEAP8[$20>>0]|0;
   $22 = $21 << 24 >> 24;
   $23 = ($22|0)==($0|0);
   if ($23) {
    label = 10;
   } else {
    $24 = ((($1)) + 20|0);
    $25 = HEAP32[$24>>2]|0;
    $26 = ((($1)) + 16|0);
    $27 = HEAP32[$26>>2]|0;
    $28 = ($25>>>0)<($27>>>0);
    if ($28) {
     $29 = $0&255;
     $30 = ((($25)) + 1|0);
     HEAP32[$24>>2] = $30;
     HEAP8[$25>>0] = $29;
     $31 = $0 & 255;
     $33 = $31;
    } else {
     label = 10;
    }
   }
   if ((label|0) == 10) {
    $32 = (___overflow($1,$0)|0);
    $33 = $32;
   }
   ___unlockfile($1);
   $$0 = $33;
  }
 }
 do {
  if ((label|0) == 3) {
   $7 = ((($1)) + 75|0);
   $8 = HEAP8[$7>>0]|0;
   $9 = $8 << 24 >> 24;
   $10 = ($9|0)==($0|0);
   if (!($10)) {
    $11 = ((($1)) + 20|0);
    $12 = HEAP32[$11>>2]|0;
    $13 = ((($1)) + 16|0);
    $14 = HEAP32[$13>>2]|0;
    $15 = ($12>>>0)<($14>>>0);
    if ($15) {
     $16 = $0&255;
     $17 = ((($12)) + 1|0);
     HEAP32[$11>>2] = $17;
     HEAP8[$12>>0] = $16;
     $18 = $0 & 255;
     $$0 = $18;
     break;
    }
   }
   $19 = (___overflow($1,$0)|0);
   $$0 = $19;
  }
 } while(0);
 return ($$0|0);
}
function ___strdup($0) {
 $0 = $0|0;
 var $$0 = 0, $1 = 0, $2 = 0, $3 = 0, $4 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $1 = (_strlen($0)|0);
 $2 = (($1) + 1)|0;
 $3 = (_malloc($2)|0);
 $4 = ($3|0)==(0|0);
 if ($4) {
  $$0 = 0;
 } else {
  _memcpy(($3|0),($0|0),($2|0))|0;
  $$0 = $3;
 }
 return ($$0|0);
}
function _malloc($0) {
 $0 = $0|0;
 var $$$0190$i = 0, $$$0191$i = 0, $$$4349$i = 0, $$$i = 0, $$0 = 0, $$0$i$i = 0, $$0$i$i$i = 0, $$0$i17$i = 0, $$0$i18$i = 0, $$01$i$i = 0, $$0187$i = 0, $$0189$i = 0, $$0190$i = 0, $$0191$i = 0, $$0197 = 0, $$0199 = 0, $$0206$i$i = 0, $$0207$i$i = 0, $$0211$i$i = 0, $$0212$i$i = 0;
 var $$024370$i = 0, $$0286$i$i = 0, $$0287$i$i = 0, $$0288$i$i = 0, $$0294$i$i = 0, $$0295$i$i = 0, $$0340$i = 0, $$0342$i = 0, $$0343$i = 0, $$0345$i = 0, $$0351$i = 0, $$0356$i = 0, $$0357$$i = 0, $$0357$i = 0, $$0359$i = 0, $$0360$i = 0, $$0366$i = 0, $$1194$i = 0, $$1196$i = 0, $$124469$i = 0;
 var $$1290$i$i = 0, $$1292$i$i = 0, $$1341$i = 0, $$1346$i = 0, $$1361$i = 0, $$1368$i = 0, $$1372$i = 0, $$2247$ph$i = 0, $$2253$ph$i = 0, $$2353$i = 0, $$3$i = 0, $$3$i$i = 0, $$3$i201 = 0, $$3348$i = 0, $$3370$i = 0, $$4$lcssa$i = 0, $$413$i = 0, $$4349$lcssa$i = 0, $$434912$i = 0, $$4355$$4$i = 0;
 var $$4355$ph$i = 0, $$435511$i = 0, $$5256$i = 0, $$723947$i = 0, $$748$i = 0, $$not$i = 0, $$pre = 0, $$pre$i = 0, $$pre$i$i = 0, $$pre$i19$i = 0, $$pre$i205 = 0, $$pre$i208 = 0, $$pre$phi$i$iZ2D = 0, $$pre$phi$i20$iZ2D = 0, $$pre$phi$i206Z2D = 0, $$pre$phi$iZ2D = 0, $$pre$phi10$i$iZ2D = 0, $$pre$phiZ2D = 0, $$pre9$i$i = 0, $1 = 0;
 var $10 = 0, $100 = 0, $1000 = 0, $1001 = 0, $1002 = 0, $1003 = 0, $1004 = 0, $1005 = 0, $1006 = 0, $1007 = 0, $1008 = 0, $1009 = 0, $101 = 0, $1010 = 0, $1011 = 0, $1012 = 0, $1013 = 0, $1014 = 0, $1015 = 0, $1016 = 0;
 var $1017 = 0, $1018 = 0, $1019 = 0, $102 = 0, $1020 = 0, $1021 = 0, $1022 = 0, $1023 = 0, $1024 = 0, $1025 = 0, $1026 = 0, $1027 = 0, $1028 = 0, $1029 = 0, $103 = 0, $1030 = 0, $1031 = 0, $1032 = 0, $1033 = 0, $1034 = 0;
 var $1035 = 0, $1036 = 0, $1037 = 0, $1038 = 0, $1039 = 0, $104 = 0, $1040 = 0, $1041 = 0, $1042 = 0, $1043 = 0, $1044 = 0, $1045 = 0, $1046 = 0, $1047 = 0, $1048 = 0, $1049 = 0, $105 = 0, $1050 = 0, $1051 = 0, $1052 = 0;
 var $1053 = 0, $1054 = 0, $1055 = 0, $106 = 0, $107 = 0, $108 = 0, $109 = 0, $11 = 0, $110 = 0, $111 = 0, $112 = 0, $113 = 0, $114 = 0, $115 = 0, $116 = 0, $117 = 0, $118 = 0, $119 = 0, $12 = 0, $120 = 0;
 var $121 = 0, $122 = 0, $123 = 0, $124 = 0, $125 = 0, $126 = 0, $127 = 0, $128 = 0, $129 = 0, $13 = 0, $130 = 0, $131 = 0, $132 = 0, $133 = 0, $134 = 0, $135 = 0, $136 = 0, $137 = 0, $138 = 0, $139 = 0;
 var $14 = 0, $140 = 0, $141 = 0, $142 = 0, $143 = 0, $144 = 0, $145 = 0, $146 = 0, $147 = 0, $148 = 0, $149 = 0, $15 = 0, $150 = 0, $151 = 0, $152 = 0, $153 = 0, $154 = 0, $155 = 0, $156 = 0, $157 = 0;
 var $158 = 0, $159 = 0, $16 = 0, $160 = 0, $161 = 0, $162 = 0, $163 = 0, $164 = 0, $165 = 0, $166 = 0, $167 = 0, $168 = 0, $169 = 0, $17 = 0, $170 = 0, $171 = 0, $172 = 0, $173 = 0, $174 = 0, $175 = 0;
 var $176 = 0, $177 = 0, $178 = 0, $179 = 0, $18 = 0, $180 = 0, $181 = 0, $182 = 0, $183 = 0, $184 = 0, $185 = 0, $186 = 0, $187 = 0, $188 = 0, $189 = 0, $19 = 0, $190 = 0, $191 = 0, $192 = 0, $193 = 0;
 var $194 = 0, $195 = 0, $196 = 0, $197 = 0, $198 = 0, $199 = 0, $2 = 0, $20 = 0, $200 = 0, $201 = 0, $202 = 0, $203 = 0, $204 = 0, $205 = 0, $206 = 0, $207 = 0, $208 = 0, $209 = 0, $21 = 0, $210 = 0;
 var $211 = 0, $212 = 0, $213 = 0, $214 = 0, $215 = 0, $216 = 0, $217 = 0, $218 = 0, $219 = 0, $22 = 0, $220 = 0, $221 = 0, $222 = 0, $223 = 0, $224 = 0, $225 = 0, $226 = 0, $227 = 0, $228 = 0, $229 = 0;
 var $23 = 0, $230 = 0, $231 = 0, $232 = 0, $233 = 0, $234 = 0, $235 = 0, $236 = 0, $237 = 0, $238 = 0, $239 = 0, $24 = 0, $240 = 0, $241 = 0, $242 = 0, $243 = 0, $244 = 0, $245 = 0, $246 = 0, $247 = 0;
 var $248 = 0, $249 = 0, $25 = 0, $250 = 0, $251 = 0, $252 = 0, $253 = 0, $254 = 0, $255 = 0, $256 = 0, $257 = 0, $258 = 0, $259 = 0, $26 = 0, $260 = 0, $261 = 0, $262 = 0, $263 = 0, $264 = 0, $265 = 0;
 var $266 = 0, $267 = 0, $268 = 0, $269 = 0, $27 = 0, $270 = 0, $271 = 0, $272 = 0, $273 = 0, $274 = 0, $275 = 0, $276 = 0, $277 = 0, $278 = 0, $279 = 0, $28 = 0, $280 = 0, $281 = 0, $282 = 0, $283 = 0;
 var $284 = 0, $285 = 0, $286 = 0, $287 = 0, $288 = 0, $289 = 0, $29 = 0, $290 = 0, $291 = 0, $292 = 0, $293 = 0, $294 = 0, $295 = 0, $296 = 0, $297 = 0, $298 = 0, $299 = 0, $3 = 0, $30 = 0, $300 = 0;
 var $301 = 0, $302 = 0, $303 = 0, $304 = 0, $305 = 0, $306 = 0, $307 = 0, $308 = 0, $309 = 0, $31 = 0, $310 = 0, $311 = 0, $312 = 0, $313 = 0, $314 = 0, $315 = 0, $316 = 0, $317 = 0, $318 = 0, $319 = 0;
 var $32 = 0, $320 = 0, $321 = 0, $322 = 0, $323 = 0, $324 = 0, $325 = 0, $326 = 0, $327 = 0, $328 = 0, $329 = 0, $33 = 0, $330 = 0, $331 = 0, $332 = 0, $333 = 0, $334 = 0, $335 = 0, $336 = 0, $337 = 0;
 var $338 = 0, $339 = 0, $34 = 0, $340 = 0, $341 = 0, $342 = 0, $343 = 0, $344 = 0, $345 = 0, $346 = 0, $347 = 0, $348 = 0, $349 = 0, $35 = 0, $350 = 0, $351 = 0, $352 = 0, $353 = 0, $354 = 0, $355 = 0;
 var $356 = 0, $357 = 0, $358 = 0, $359 = 0, $36 = 0, $360 = 0, $361 = 0, $362 = 0, $363 = 0, $364 = 0, $365 = 0, $366 = 0, $367 = 0, $368 = 0, $369 = 0, $37 = 0, $370 = 0, $371 = 0, $372 = 0, $373 = 0;
 var $374 = 0, $375 = 0, $376 = 0, $377 = 0, $378 = 0, $379 = 0, $38 = 0, $380 = 0, $381 = 0, $382 = 0, $383 = 0, $384 = 0, $385 = 0, $386 = 0, $387 = 0, $388 = 0, $389 = 0, $39 = 0, $390 = 0, $391 = 0;
 var $392 = 0, $393 = 0, $394 = 0, $395 = 0, $396 = 0, $397 = 0, $398 = 0, $399 = 0, $4 = 0, $40 = 0, $400 = 0, $401 = 0, $402 = 0, $403 = 0, $404 = 0, $405 = 0, $406 = 0, $407 = 0, $408 = 0, $409 = 0;
 var $41 = 0, $410 = 0, $411 = 0, $412 = 0, $413 = 0, $414 = 0, $415 = 0, $416 = 0, $417 = 0, $418 = 0, $419 = 0, $42 = 0, $420 = 0, $421 = 0, $422 = 0, $423 = 0, $424 = 0, $425 = 0, $426 = 0, $427 = 0;
 var $428 = 0, $429 = 0, $43 = 0, $430 = 0, $431 = 0, $432 = 0, $433 = 0, $434 = 0, $435 = 0, $436 = 0, $437 = 0, $438 = 0, $439 = 0, $44 = 0, $440 = 0, $441 = 0, $442 = 0, $443 = 0, $444 = 0, $445 = 0;
 var $446 = 0, $447 = 0, $448 = 0, $449 = 0, $45 = 0, $450 = 0, $451 = 0, $452 = 0, $453 = 0, $454 = 0, $455 = 0, $456 = 0, $457 = 0, $458 = 0, $459 = 0, $46 = 0, $460 = 0, $461 = 0, $462 = 0, $463 = 0;
 var $464 = 0, $465 = 0, $466 = 0, $467 = 0, $468 = 0, $469 = 0, $47 = 0, $470 = 0, $471 = 0, $472 = 0, $473 = 0, $474 = 0, $475 = 0, $476 = 0, $477 = 0, $478 = 0, $479 = 0, $48 = 0, $480 = 0, $481 = 0;
 var $482 = 0, $483 = 0, $484 = 0, $485 = 0, $486 = 0, $487 = 0, $488 = 0, $489 = 0, $49 = 0, $490 = 0, $491 = 0, $492 = 0, $493 = 0, $494 = 0, $495 = 0, $496 = 0, $497 = 0, $498 = 0, $499 = 0, $5 = 0;
 var $50 = 0, $500 = 0, $501 = 0, $502 = 0, $503 = 0, $504 = 0, $505 = 0, $506 = 0, $507 = 0, $508 = 0, $509 = 0, $51 = 0, $510 = 0, $511 = 0, $512 = 0, $513 = 0, $514 = 0, $515 = 0, $516 = 0, $517 = 0;
 var $518 = 0, $519 = 0, $52 = 0, $520 = 0, $521 = 0, $522 = 0, $523 = 0, $524 = 0, $525 = 0, $526 = 0, $527 = 0, $528 = 0, $529 = 0, $53 = 0, $530 = 0, $531 = 0, $532 = 0, $533 = 0, $534 = 0, $535 = 0;
 var $536 = 0, $537 = 0, $538 = 0, $539 = 0, $54 = 0, $540 = 0, $541 = 0, $542 = 0, $543 = 0, $544 = 0, $545 = 0, $546 = 0, $547 = 0, $548 = 0, $549 = 0, $55 = 0, $550 = 0, $551 = 0, $552 = 0, $553 = 0;
 var $554 = 0, $555 = 0, $556 = 0, $557 = 0, $558 = 0, $559 = 0, $56 = 0, $560 = 0, $561 = 0, $562 = 0, $563 = 0, $564 = 0, $565 = 0, $566 = 0, $567 = 0, $568 = 0, $569 = 0, $57 = 0, $570 = 0, $571 = 0;
 var $572 = 0, $573 = 0, $574 = 0, $575 = 0, $576 = 0, $577 = 0, $578 = 0, $579 = 0, $58 = 0, $580 = 0, $581 = 0, $582 = 0, $583 = 0, $584 = 0, $585 = 0, $586 = 0, $587 = 0, $588 = 0, $589 = 0, $59 = 0;
 var $590 = 0, $591 = 0, $592 = 0, $593 = 0, $594 = 0, $595 = 0, $596 = 0, $597 = 0, $598 = 0, $599 = 0, $6 = 0, $60 = 0, $600 = 0, $601 = 0, $602 = 0, $603 = 0, $604 = 0, $605 = 0, $606 = 0, $607 = 0;
 var $608 = 0, $609 = 0, $61 = 0, $610 = 0, $611 = 0, $612 = 0, $613 = 0, $614 = 0, $615 = 0, $616 = 0, $617 = 0, $618 = 0, $619 = 0, $62 = 0, $620 = 0, $621 = 0, $622 = 0, $623 = 0, $624 = 0, $625 = 0;
 var $626 = 0, $627 = 0, $628 = 0, $629 = 0, $63 = 0, $630 = 0, $631 = 0, $632 = 0, $633 = 0, $634 = 0, $635 = 0, $636 = 0, $637 = 0, $638 = 0, $639 = 0, $64 = 0, $640 = 0, $641 = 0, $642 = 0, $643 = 0;
 var $644 = 0, $645 = 0, $646 = 0, $647 = 0, $648 = 0, $649 = 0, $65 = 0, $650 = 0, $651 = 0, $652 = 0, $653 = 0, $654 = 0, $655 = 0, $656 = 0, $657 = 0, $658 = 0, $659 = 0, $66 = 0, $660 = 0, $661 = 0;
 var $662 = 0, $663 = 0, $664 = 0, $665 = 0, $666 = 0, $667 = 0, $668 = 0, $669 = 0, $67 = 0, $670 = 0, $671 = 0, $672 = 0, $673 = 0, $674 = 0, $675 = 0, $676 = 0, $677 = 0, $678 = 0, $679 = 0, $68 = 0;
 var $680 = 0, $681 = 0, $682 = 0, $683 = 0, $684 = 0, $685 = 0, $686 = 0, $687 = 0, $688 = 0, $689 = 0, $69 = 0, $690 = 0, $691 = 0, $692 = 0, $693 = 0, $694 = 0, $695 = 0, $696 = 0, $697 = 0, $698 = 0;
 var $699 = 0, $7 = 0, $70 = 0, $700 = 0, $701 = 0, $702 = 0, $703 = 0, $704 = 0, $705 = 0, $706 = 0, $707 = 0, $708 = 0, $709 = 0, $71 = 0, $710 = 0, $711 = 0, $712 = 0, $713 = 0, $714 = 0, $715 = 0;
 var $716 = 0, $717 = 0, $718 = 0, $719 = 0, $72 = 0, $720 = 0, $721 = 0, $722 = 0, $723 = 0, $724 = 0, $725 = 0, $726 = 0, $727 = 0, $728 = 0, $729 = 0, $73 = 0, $730 = 0, $731 = 0, $732 = 0, $733 = 0;
 var $734 = 0, $735 = 0, $736 = 0, $737 = 0, $738 = 0, $739 = 0, $74 = 0, $740 = 0, $741 = 0, $742 = 0, $743 = 0, $744 = 0, $745 = 0, $746 = 0, $747 = 0, $748 = 0, $749 = 0, $75 = 0, $750 = 0, $751 = 0;
 var $752 = 0, $753 = 0, $754 = 0, $755 = 0, $756 = 0, $757 = 0, $758 = 0, $759 = 0, $76 = 0, $760 = 0, $761 = 0, $762 = 0, $763 = 0, $764 = 0, $765 = 0, $766 = 0, $767 = 0, $768 = 0, $769 = 0, $77 = 0;
 var $770 = 0, $771 = 0, $772 = 0, $773 = 0, $774 = 0, $775 = 0, $776 = 0, $777 = 0, $778 = 0, $779 = 0, $78 = 0, $780 = 0, $781 = 0, $782 = 0, $783 = 0, $784 = 0, $785 = 0, $786 = 0, $787 = 0, $788 = 0;
 var $789 = 0, $79 = 0, $790 = 0, $791 = 0, $792 = 0, $793 = 0, $794 = 0, $795 = 0, $796 = 0, $797 = 0, $798 = 0, $799 = 0, $8 = 0, $80 = 0, $800 = 0, $801 = 0, $802 = 0, $803 = 0, $804 = 0, $805 = 0;
 var $806 = 0, $807 = 0, $808 = 0, $809 = 0, $81 = 0, $810 = 0, $811 = 0, $812 = 0, $813 = 0, $814 = 0, $815 = 0, $816 = 0, $817 = 0, $818 = 0, $819 = 0, $82 = 0, $820 = 0, $821 = 0, $822 = 0, $823 = 0;
 var $824 = 0, $825 = 0, $826 = 0, $827 = 0, $828 = 0, $829 = 0, $83 = 0, $830 = 0, $831 = 0, $832 = 0, $833 = 0, $834 = 0, $835 = 0, $836 = 0, $837 = 0, $838 = 0, $839 = 0, $84 = 0, $840 = 0, $841 = 0;
 var $842 = 0, $843 = 0, $844 = 0, $845 = 0, $846 = 0, $847 = 0, $848 = 0, $849 = 0, $85 = 0, $850 = 0, $851 = 0, $852 = 0, $853 = 0, $854 = 0, $855 = 0, $856 = 0, $857 = 0, $858 = 0, $859 = 0, $86 = 0;
 var $860 = 0, $861 = 0, $862 = 0, $863 = 0, $864 = 0, $865 = 0, $866 = 0, $867 = 0, $868 = 0, $869 = 0, $87 = 0, $870 = 0, $871 = 0, $872 = 0, $873 = 0, $874 = 0, $875 = 0, $876 = 0, $877 = 0, $878 = 0;
 var $879 = 0, $88 = 0, $880 = 0, $881 = 0, $882 = 0, $883 = 0, $884 = 0, $885 = 0, $886 = 0, $887 = 0, $888 = 0, $889 = 0, $89 = 0, $890 = 0, $891 = 0, $892 = 0, $893 = 0, $894 = 0, $895 = 0, $896 = 0;
 var $897 = 0, $898 = 0, $899 = 0, $9 = 0, $90 = 0, $900 = 0, $901 = 0, $902 = 0, $903 = 0, $904 = 0, $905 = 0, $906 = 0, $907 = 0, $908 = 0, $909 = 0, $91 = 0, $910 = 0, $911 = 0, $912 = 0, $913 = 0;
 var $914 = 0, $915 = 0, $916 = 0, $917 = 0, $918 = 0, $919 = 0, $92 = 0, $920 = 0, $921 = 0, $922 = 0, $923 = 0, $924 = 0, $925 = 0, $926 = 0, $927 = 0, $928 = 0, $929 = 0, $93 = 0, $930 = 0, $931 = 0;
 var $932 = 0, $933 = 0, $934 = 0, $935 = 0, $936 = 0, $937 = 0, $938 = 0, $939 = 0, $94 = 0, $940 = 0, $941 = 0, $942 = 0, $943 = 0, $944 = 0, $945 = 0, $946 = 0, $947 = 0, $948 = 0, $949 = 0, $95 = 0;
 var $950 = 0, $951 = 0, $952 = 0, $953 = 0, $954 = 0, $955 = 0, $956 = 0, $957 = 0, $958 = 0, $959 = 0, $96 = 0, $960 = 0, $961 = 0, $962 = 0, $963 = 0, $964 = 0, $965 = 0, $966 = 0, $967 = 0, $968 = 0;
 var $969 = 0, $97 = 0, $970 = 0, $971 = 0, $972 = 0, $973 = 0, $974 = 0, $975 = 0, $976 = 0, $977 = 0, $978 = 0, $979 = 0, $98 = 0, $980 = 0, $981 = 0, $982 = 0, $983 = 0, $984 = 0, $985 = 0, $986 = 0;
 var $987 = 0, $988 = 0, $989 = 0, $99 = 0, $990 = 0, $991 = 0, $992 = 0, $993 = 0, $994 = 0, $995 = 0, $996 = 0, $997 = 0, $998 = 0, $999 = 0, $cond$i = 0, $cond$i$i = 0, $cond$i204 = 0, $exitcond$i$i = 0, $not$$i$i = 0, $not$$i22$i = 0;
 var $not$7$i = 0, $or$cond$i = 0, $or$cond$i211 = 0, $or$cond1$i = 0, $or$cond1$i210 = 0, $or$cond10$i = 0, $or$cond11$i = 0, $or$cond12$i = 0, $or$cond2$i = 0, $or$cond5$i = 0, $or$cond50$i = 0, $or$cond7$i = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0;
 $1 = sp;
 $2 = ($0>>>0)<(245);
 do {
  if ($2) {
   $3 = ($0>>>0)<(11);
   $4 = (($0) + 11)|0;
   $5 = $4 & -8;
   $6 = $3 ? 16 : $5;
   $7 = $6 >>> 3;
   $8 = HEAP32[1690]|0;
   $9 = $8 >>> $7;
   $10 = $9 & 3;
   $11 = ($10|0)==(0);
   if (!($11)) {
    $12 = $9 & 1;
    $13 = $12 ^ 1;
    $14 = (($13) + ($7))|0;
    $15 = $14 << 1;
    $16 = (6800 + ($15<<2)|0);
    $17 = ((($16)) + 8|0);
    $18 = HEAP32[$17>>2]|0;
    $19 = ((($18)) + 8|0);
    $20 = HEAP32[$19>>2]|0;
    $21 = ($16|0)==($20|0);
    do {
     if ($21) {
      $22 = 1 << $14;
      $23 = $22 ^ -1;
      $24 = $8 & $23;
      HEAP32[1690] = $24;
     } else {
      $25 = HEAP32[(6776)>>2]|0;
      $26 = ($20>>>0)<($25>>>0);
      if ($26) {
       _abort();
       // unreachable;
      }
      $27 = ((($20)) + 12|0);
      $28 = HEAP32[$27>>2]|0;
      $29 = ($28|0)==($18|0);
      if ($29) {
       HEAP32[$27>>2] = $16;
       HEAP32[$17>>2] = $20;
       break;
      } else {
       _abort();
       // unreachable;
      }
     }
    } while(0);
    $30 = $14 << 3;
    $31 = $30 | 3;
    $32 = ((($18)) + 4|0);
    HEAP32[$32>>2] = $31;
    $33 = (($18) + ($30)|0);
    $34 = ((($33)) + 4|0);
    $35 = HEAP32[$34>>2]|0;
    $36 = $35 | 1;
    HEAP32[$34>>2] = $36;
    $$0 = $19;
    STACKTOP = sp;return ($$0|0);
   }
   $37 = HEAP32[(6768)>>2]|0;
   $38 = ($6>>>0)>($37>>>0);
   if ($38) {
    $39 = ($9|0)==(0);
    if (!($39)) {
     $40 = $9 << $7;
     $41 = 2 << $7;
     $42 = (0 - ($41))|0;
     $43 = $41 | $42;
     $44 = $40 & $43;
     $45 = (0 - ($44))|0;
     $46 = $44 & $45;
     $47 = (($46) + -1)|0;
     $48 = $47 >>> 12;
     $49 = $48 & 16;
     $50 = $47 >>> $49;
     $51 = $50 >>> 5;
     $52 = $51 & 8;
     $53 = $52 | $49;
     $54 = $50 >>> $52;
     $55 = $54 >>> 2;
     $56 = $55 & 4;
     $57 = $53 | $56;
     $58 = $54 >>> $56;
     $59 = $58 >>> 1;
     $60 = $59 & 2;
     $61 = $57 | $60;
     $62 = $58 >>> $60;
     $63 = $62 >>> 1;
     $64 = $63 & 1;
     $65 = $61 | $64;
     $66 = $62 >>> $64;
     $67 = (($65) + ($66))|0;
     $68 = $67 << 1;
     $69 = (6800 + ($68<<2)|0);
     $70 = ((($69)) + 8|0);
     $71 = HEAP32[$70>>2]|0;
     $72 = ((($71)) + 8|0);
     $73 = HEAP32[$72>>2]|0;
     $74 = ($69|0)==($73|0);
     do {
      if ($74) {
       $75 = 1 << $67;
       $76 = $75 ^ -1;
       $77 = $8 & $76;
       HEAP32[1690] = $77;
       $98 = $77;
      } else {
       $78 = HEAP32[(6776)>>2]|0;
       $79 = ($73>>>0)<($78>>>0);
       if ($79) {
        _abort();
        // unreachable;
       }
       $80 = ((($73)) + 12|0);
       $81 = HEAP32[$80>>2]|0;
       $82 = ($81|0)==($71|0);
       if ($82) {
        HEAP32[$80>>2] = $69;
        HEAP32[$70>>2] = $73;
        $98 = $8;
        break;
       } else {
        _abort();
        // unreachable;
       }
      }
     } while(0);
     $83 = $67 << 3;
     $84 = (($83) - ($6))|0;
     $85 = $6 | 3;
     $86 = ((($71)) + 4|0);
     HEAP32[$86>>2] = $85;
     $87 = (($71) + ($6)|0);
     $88 = $84 | 1;
     $89 = ((($87)) + 4|0);
     HEAP32[$89>>2] = $88;
     $90 = (($87) + ($84)|0);
     HEAP32[$90>>2] = $84;
     $91 = ($37|0)==(0);
     if (!($91)) {
      $92 = HEAP32[(6780)>>2]|0;
      $93 = $37 >>> 3;
      $94 = $93 << 1;
      $95 = (6800 + ($94<<2)|0);
      $96 = 1 << $93;
      $97 = $98 & $96;
      $99 = ($97|0)==(0);
      if ($99) {
       $100 = $98 | $96;
       HEAP32[1690] = $100;
       $$pre = ((($95)) + 8|0);
       $$0199 = $95;$$pre$phiZ2D = $$pre;
      } else {
       $101 = ((($95)) + 8|0);
       $102 = HEAP32[$101>>2]|0;
       $103 = HEAP32[(6776)>>2]|0;
       $104 = ($102>>>0)<($103>>>0);
       if ($104) {
        _abort();
        // unreachable;
       } else {
        $$0199 = $102;$$pre$phiZ2D = $101;
       }
      }
      HEAP32[$$pre$phiZ2D>>2] = $92;
      $105 = ((($$0199)) + 12|0);
      HEAP32[$105>>2] = $92;
      $106 = ((($92)) + 8|0);
      HEAP32[$106>>2] = $$0199;
      $107 = ((($92)) + 12|0);
      HEAP32[$107>>2] = $95;
     }
     HEAP32[(6768)>>2] = $84;
     HEAP32[(6780)>>2] = $87;
     $$0 = $72;
     STACKTOP = sp;return ($$0|0);
    }
    $108 = HEAP32[(6764)>>2]|0;
    $109 = ($108|0)==(0);
    if ($109) {
     $$0197 = $6;
    } else {
     $110 = (0 - ($108))|0;
     $111 = $108 & $110;
     $112 = (($111) + -1)|0;
     $113 = $112 >>> 12;
     $114 = $113 & 16;
     $115 = $112 >>> $114;
     $116 = $115 >>> 5;
     $117 = $116 & 8;
     $118 = $117 | $114;
     $119 = $115 >>> $117;
     $120 = $119 >>> 2;
     $121 = $120 & 4;
     $122 = $118 | $121;
     $123 = $119 >>> $121;
     $124 = $123 >>> 1;
     $125 = $124 & 2;
     $126 = $122 | $125;
     $127 = $123 >>> $125;
     $128 = $127 >>> 1;
     $129 = $128 & 1;
     $130 = $126 | $129;
     $131 = $127 >>> $129;
     $132 = (($130) + ($131))|0;
     $133 = (7064 + ($132<<2)|0);
     $134 = HEAP32[$133>>2]|0;
     $135 = ((($134)) + 4|0);
     $136 = HEAP32[$135>>2]|0;
     $137 = $136 & -8;
     $138 = (($137) - ($6))|0;
     $$0189$i = $134;$$0190$i = $134;$$0191$i = $138;
     while(1) {
      $139 = ((($$0189$i)) + 16|0);
      $140 = HEAP32[$139>>2]|0;
      $141 = ($140|0)==(0|0);
      if ($141) {
       $142 = ((($$0189$i)) + 20|0);
       $143 = HEAP32[$142>>2]|0;
       $144 = ($143|0)==(0|0);
       if ($144) {
        break;
       } else {
        $146 = $143;
       }
      } else {
       $146 = $140;
      }
      $145 = ((($146)) + 4|0);
      $147 = HEAP32[$145>>2]|0;
      $148 = $147 & -8;
      $149 = (($148) - ($6))|0;
      $150 = ($149>>>0)<($$0191$i>>>0);
      $$$0191$i = $150 ? $149 : $$0191$i;
      $$$0190$i = $150 ? $146 : $$0190$i;
      $$0189$i = $146;$$0190$i = $$$0190$i;$$0191$i = $$$0191$i;
     }
     $151 = HEAP32[(6776)>>2]|0;
     $152 = ($$0190$i>>>0)<($151>>>0);
     if ($152) {
      _abort();
      // unreachable;
     }
     $153 = (($$0190$i) + ($6)|0);
     $154 = ($$0190$i>>>0)<($153>>>0);
     if (!($154)) {
      _abort();
      // unreachable;
     }
     $155 = ((($$0190$i)) + 24|0);
     $156 = HEAP32[$155>>2]|0;
     $157 = ((($$0190$i)) + 12|0);
     $158 = HEAP32[$157>>2]|0;
     $159 = ($158|0)==($$0190$i|0);
     do {
      if ($159) {
       $169 = ((($$0190$i)) + 20|0);
       $170 = HEAP32[$169>>2]|0;
       $171 = ($170|0)==(0|0);
       if ($171) {
        $172 = ((($$0190$i)) + 16|0);
        $173 = HEAP32[$172>>2]|0;
        $174 = ($173|0)==(0|0);
        if ($174) {
         $$3$i = 0;
         break;
        } else {
         $$1194$i = $173;$$1196$i = $172;
        }
       } else {
        $$1194$i = $170;$$1196$i = $169;
       }
       while(1) {
        $175 = ((($$1194$i)) + 20|0);
        $176 = HEAP32[$175>>2]|0;
        $177 = ($176|0)==(0|0);
        if (!($177)) {
         $$1194$i = $176;$$1196$i = $175;
         continue;
        }
        $178 = ((($$1194$i)) + 16|0);
        $179 = HEAP32[$178>>2]|0;
        $180 = ($179|0)==(0|0);
        if ($180) {
         break;
        } else {
         $$1194$i = $179;$$1196$i = $178;
        }
       }
       $181 = ($$1196$i>>>0)<($151>>>0);
       if ($181) {
        _abort();
        // unreachable;
       } else {
        HEAP32[$$1196$i>>2] = 0;
        $$3$i = $$1194$i;
        break;
       }
      } else {
       $160 = ((($$0190$i)) + 8|0);
       $161 = HEAP32[$160>>2]|0;
       $162 = ($161>>>0)<($151>>>0);
       if ($162) {
        _abort();
        // unreachable;
       }
       $163 = ((($161)) + 12|0);
       $164 = HEAP32[$163>>2]|0;
       $165 = ($164|0)==($$0190$i|0);
       if (!($165)) {
        _abort();
        // unreachable;
       }
       $166 = ((($158)) + 8|0);
       $167 = HEAP32[$166>>2]|0;
       $168 = ($167|0)==($$0190$i|0);
       if ($168) {
        HEAP32[$163>>2] = $158;
        HEAP32[$166>>2] = $161;
        $$3$i = $158;
        break;
       } else {
        _abort();
        // unreachable;
       }
      }
     } while(0);
     $182 = ($156|0)==(0|0);
     do {
      if (!($182)) {
       $183 = ((($$0190$i)) + 28|0);
       $184 = HEAP32[$183>>2]|0;
       $185 = (7064 + ($184<<2)|0);
       $186 = HEAP32[$185>>2]|0;
       $187 = ($$0190$i|0)==($186|0);
       if ($187) {
        HEAP32[$185>>2] = $$3$i;
        $cond$i = ($$3$i|0)==(0|0);
        if ($cond$i) {
         $188 = 1 << $184;
         $189 = $188 ^ -1;
         $190 = $108 & $189;
         HEAP32[(6764)>>2] = $190;
         break;
        }
       } else {
        $191 = HEAP32[(6776)>>2]|0;
        $192 = ($156>>>0)<($191>>>0);
        if ($192) {
         _abort();
         // unreachable;
        }
        $193 = ((($156)) + 16|0);
        $194 = HEAP32[$193>>2]|0;
        $195 = ($194|0)==($$0190$i|0);
        if ($195) {
         HEAP32[$193>>2] = $$3$i;
        } else {
         $196 = ((($156)) + 20|0);
         HEAP32[$196>>2] = $$3$i;
        }
        $197 = ($$3$i|0)==(0|0);
        if ($197) {
         break;
        }
       }
       $198 = HEAP32[(6776)>>2]|0;
       $199 = ($$3$i>>>0)<($198>>>0);
       if ($199) {
        _abort();
        // unreachable;
       }
       $200 = ((($$3$i)) + 24|0);
       HEAP32[$200>>2] = $156;
       $201 = ((($$0190$i)) + 16|0);
       $202 = HEAP32[$201>>2]|0;
       $203 = ($202|0)==(0|0);
       do {
        if (!($203)) {
         $204 = ($202>>>0)<($198>>>0);
         if ($204) {
          _abort();
          // unreachable;
         } else {
          $205 = ((($$3$i)) + 16|0);
          HEAP32[$205>>2] = $202;
          $206 = ((($202)) + 24|0);
          HEAP32[$206>>2] = $$3$i;
          break;
         }
        }
       } while(0);
       $207 = ((($$0190$i)) + 20|0);
       $208 = HEAP32[$207>>2]|0;
       $209 = ($208|0)==(0|0);
       if (!($209)) {
        $210 = HEAP32[(6776)>>2]|0;
        $211 = ($208>>>0)<($210>>>0);
        if ($211) {
         _abort();
         // unreachable;
        } else {
         $212 = ((($$3$i)) + 20|0);
         HEAP32[$212>>2] = $208;
         $213 = ((($208)) + 24|0);
         HEAP32[$213>>2] = $$3$i;
         break;
        }
       }
      }
     } while(0);
     $214 = ($$0191$i>>>0)<(16);
     if ($214) {
      $215 = (($$0191$i) + ($6))|0;
      $216 = $215 | 3;
      $217 = ((($$0190$i)) + 4|0);
      HEAP32[$217>>2] = $216;
      $218 = (($$0190$i) + ($215)|0);
      $219 = ((($218)) + 4|0);
      $220 = HEAP32[$219>>2]|0;
      $221 = $220 | 1;
      HEAP32[$219>>2] = $221;
     } else {
      $222 = $6 | 3;
      $223 = ((($$0190$i)) + 4|0);
      HEAP32[$223>>2] = $222;
      $224 = $$0191$i | 1;
      $225 = ((($153)) + 4|0);
      HEAP32[$225>>2] = $224;
      $226 = (($153) + ($$0191$i)|0);
      HEAP32[$226>>2] = $$0191$i;
      $227 = ($37|0)==(0);
      if (!($227)) {
       $228 = HEAP32[(6780)>>2]|0;
       $229 = $37 >>> 3;
       $230 = $229 << 1;
       $231 = (6800 + ($230<<2)|0);
       $232 = 1 << $229;
       $233 = $8 & $232;
       $234 = ($233|0)==(0);
       if ($234) {
        $235 = $8 | $232;
        HEAP32[1690] = $235;
        $$pre$i = ((($231)) + 8|0);
        $$0187$i = $231;$$pre$phi$iZ2D = $$pre$i;
       } else {
        $236 = ((($231)) + 8|0);
        $237 = HEAP32[$236>>2]|0;
        $238 = HEAP32[(6776)>>2]|0;
        $239 = ($237>>>0)<($238>>>0);
        if ($239) {
         _abort();
         // unreachable;
        } else {
         $$0187$i = $237;$$pre$phi$iZ2D = $236;
        }
       }
       HEAP32[$$pre$phi$iZ2D>>2] = $228;
       $240 = ((($$0187$i)) + 12|0);
       HEAP32[$240>>2] = $228;
       $241 = ((($228)) + 8|0);
       HEAP32[$241>>2] = $$0187$i;
       $242 = ((($228)) + 12|0);
       HEAP32[$242>>2] = $231;
      }
      HEAP32[(6768)>>2] = $$0191$i;
      HEAP32[(6780)>>2] = $153;
     }
     $243 = ((($$0190$i)) + 8|0);
     $$0 = $243;
     STACKTOP = sp;return ($$0|0);
    }
   } else {
    $$0197 = $6;
   }
  } else {
   $244 = ($0>>>0)>(4294967231);
   if ($244) {
    $$0197 = -1;
   } else {
    $245 = (($0) + 11)|0;
    $246 = $245 & -8;
    $247 = HEAP32[(6764)>>2]|0;
    $248 = ($247|0)==(0);
    if ($248) {
     $$0197 = $246;
    } else {
     $249 = (0 - ($246))|0;
     $250 = $245 >>> 8;
     $251 = ($250|0)==(0);
     if ($251) {
      $$0356$i = 0;
     } else {
      $252 = ($246>>>0)>(16777215);
      if ($252) {
       $$0356$i = 31;
      } else {
       $253 = (($250) + 1048320)|0;
       $254 = $253 >>> 16;
       $255 = $254 & 8;
       $256 = $250 << $255;
       $257 = (($256) + 520192)|0;
       $258 = $257 >>> 16;
       $259 = $258 & 4;
       $260 = $259 | $255;
       $261 = $256 << $259;
       $262 = (($261) + 245760)|0;
       $263 = $262 >>> 16;
       $264 = $263 & 2;
       $265 = $260 | $264;
       $266 = (14 - ($265))|0;
       $267 = $261 << $264;
       $268 = $267 >>> 15;
       $269 = (($266) + ($268))|0;
       $270 = $269 << 1;
       $271 = (($269) + 7)|0;
       $272 = $246 >>> $271;
       $273 = $272 & 1;
       $274 = $273 | $270;
       $$0356$i = $274;
      }
     }
     $275 = (7064 + ($$0356$i<<2)|0);
     $276 = HEAP32[$275>>2]|0;
     $277 = ($276|0)==(0|0);
     L123: do {
      if ($277) {
       $$2353$i = 0;$$3$i201 = 0;$$3348$i = $249;
       label = 86;
      } else {
       $278 = ($$0356$i|0)==(31);
       $279 = $$0356$i >>> 1;
       $280 = (25 - ($279))|0;
       $281 = $278 ? 0 : $280;
       $282 = $246 << $281;
       $$0340$i = 0;$$0345$i = $249;$$0351$i = $276;$$0357$i = $282;$$0360$i = 0;
       while(1) {
        $283 = ((($$0351$i)) + 4|0);
        $284 = HEAP32[$283>>2]|0;
        $285 = $284 & -8;
        $286 = (($285) - ($246))|0;
        $287 = ($286>>>0)<($$0345$i>>>0);
        if ($287) {
         $288 = ($286|0)==(0);
         if ($288) {
          $$413$i = $$0351$i;$$434912$i = 0;$$435511$i = $$0351$i;
          label = 90;
          break L123;
         } else {
          $$1341$i = $$0351$i;$$1346$i = $286;
         }
        } else {
         $$1341$i = $$0340$i;$$1346$i = $$0345$i;
        }
        $289 = ((($$0351$i)) + 20|0);
        $290 = HEAP32[$289>>2]|0;
        $291 = $$0357$i >>> 31;
        $292 = (((($$0351$i)) + 16|0) + ($291<<2)|0);
        $293 = HEAP32[$292>>2]|0;
        $294 = ($290|0)==(0|0);
        $295 = ($290|0)==($293|0);
        $or$cond1$i = $294 | $295;
        $$1361$i = $or$cond1$i ? $$0360$i : $290;
        $296 = ($293|0)==(0|0);
        $297 = $296&1;
        $298 = $297 ^ 1;
        $$0357$$i = $$0357$i << $298;
        if ($296) {
         $$2353$i = $$1361$i;$$3$i201 = $$1341$i;$$3348$i = $$1346$i;
         label = 86;
         break;
        } else {
         $$0340$i = $$1341$i;$$0345$i = $$1346$i;$$0351$i = $293;$$0357$i = $$0357$$i;$$0360$i = $$1361$i;
        }
       }
      }
     } while(0);
     if ((label|0) == 86) {
      $299 = ($$2353$i|0)==(0|0);
      $300 = ($$3$i201|0)==(0|0);
      $or$cond$i = $299 & $300;
      if ($or$cond$i) {
       $301 = 2 << $$0356$i;
       $302 = (0 - ($301))|0;
       $303 = $301 | $302;
       $304 = $247 & $303;
       $305 = ($304|0)==(0);
       if ($305) {
        $$0197 = $246;
        break;
       }
       $306 = (0 - ($304))|0;
       $307 = $304 & $306;
       $308 = (($307) + -1)|0;
       $309 = $308 >>> 12;
       $310 = $309 & 16;
       $311 = $308 >>> $310;
       $312 = $311 >>> 5;
       $313 = $312 & 8;
       $314 = $313 | $310;
       $315 = $311 >>> $313;
       $316 = $315 >>> 2;
       $317 = $316 & 4;
       $318 = $314 | $317;
       $319 = $315 >>> $317;
       $320 = $319 >>> 1;
       $321 = $320 & 2;
       $322 = $318 | $321;
       $323 = $319 >>> $321;
       $324 = $323 >>> 1;
       $325 = $324 & 1;
       $326 = $322 | $325;
       $327 = $323 >>> $325;
       $328 = (($326) + ($327))|0;
       $329 = (7064 + ($328<<2)|0);
       $330 = HEAP32[$329>>2]|0;
       $$4355$ph$i = $330;
      } else {
       $$4355$ph$i = $$2353$i;
      }
      $331 = ($$4355$ph$i|0)==(0|0);
      if ($331) {
       $$4$lcssa$i = $$3$i201;$$4349$lcssa$i = $$3348$i;
      } else {
       $$413$i = $$3$i201;$$434912$i = $$3348$i;$$435511$i = $$4355$ph$i;
       label = 90;
      }
     }
     if ((label|0) == 90) {
      while(1) {
       label = 0;
       $332 = ((($$435511$i)) + 4|0);
       $333 = HEAP32[$332>>2]|0;
       $334 = $333 & -8;
       $335 = (($334) - ($246))|0;
       $336 = ($335>>>0)<($$434912$i>>>0);
       $$$4349$i = $336 ? $335 : $$434912$i;
       $$4355$$4$i = $336 ? $$435511$i : $$413$i;
       $337 = ((($$435511$i)) + 16|0);
       $338 = HEAP32[$337>>2]|0;
       $339 = ($338|0)==(0|0);
       if (!($339)) {
        $$413$i = $$4355$$4$i;$$434912$i = $$$4349$i;$$435511$i = $338;
        label = 90;
        continue;
       }
       $340 = ((($$435511$i)) + 20|0);
       $341 = HEAP32[$340>>2]|0;
       $342 = ($341|0)==(0|0);
       if ($342) {
        $$4$lcssa$i = $$4355$$4$i;$$4349$lcssa$i = $$$4349$i;
        break;
       } else {
        $$413$i = $$4355$$4$i;$$434912$i = $$$4349$i;$$435511$i = $341;
        label = 90;
       }
      }
     }
     $343 = ($$4$lcssa$i|0)==(0|0);
     if ($343) {
      $$0197 = $246;
     } else {
      $344 = HEAP32[(6768)>>2]|0;
      $345 = (($344) - ($246))|0;
      $346 = ($$4349$lcssa$i>>>0)<($345>>>0);
      if ($346) {
       $347 = HEAP32[(6776)>>2]|0;
       $348 = ($$4$lcssa$i>>>0)<($347>>>0);
       if ($348) {
        _abort();
        // unreachable;
       }
       $349 = (($$4$lcssa$i) + ($246)|0);
       $350 = ($$4$lcssa$i>>>0)<($349>>>0);
       if (!($350)) {
        _abort();
        // unreachable;
       }
       $351 = ((($$4$lcssa$i)) + 24|0);
       $352 = HEAP32[$351>>2]|0;
       $353 = ((($$4$lcssa$i)) + 12|0);
       $354 = HEAP32[$353>>2]|0;
       $355 = ($354|0)==($$4$lcssa$i|0);
       do {
        if ($355) {
         $365 = ((($$4$lcssa$i)) + 20|0);
         $366 = HEAP32[$365>>2]|0;
         $367 = ($366|0)==(0|0);
         if ($367) {
          $368 = ((($$4$lcssa$i)) + 16|0);
          $369 = HEAP32[$368>>2]|0;
          $370 = ($369|0)==(0|0);
          if ($370) {
           $$3370$i = 0;
           break;
          } else {
           $$1368$i = $369;$$1372$i = $368;
          }
         } else {
          $$1368$i = $366;$$1372$i = $365;
         }
         while(1) {
          $371 = ((($$1368$i)) + 20|0);
          $372 = HEAP32[$371>>2]|0;
          $373 = ($372|0)==(0|0);
          if (!($373)) {
           $$1368$i = $372;$$1372$i = $371;
           continue;
          }
          $374 = ((($$1368$i)) + 16|0);
          $375 = HEAP32[$374>>2]|0;
          $376 = ($375|0)==(0|0);
          if ($376) {
           break;
          } else {
           $$1368$i = $375;$$1372$i = $374;
          }
         }
         $377 = ($$1372$i>>>0)<($347>>>0);
         if ($377) {
          _abort();
          // unreachable;
         } else {
          HEAP32[$$1372$i>>2] = 0;
          $$3370$i = $$1368$i;
          break;
         }
        } else {
         $356 = ((($$4$lcssa$i)) + 8|0);
         $357 = HEAP32[$356>>2]|0;
         $358 = ($357>>>0)<($347>>>0);
         if ($358) {
          _abort();
          // unreachable;
         }
         $359 = ((($357)) + 12|0);
         $360 = HEAP32[$359>>2]|0;
         $361 = ($360|0)==($$4$lcssa$i|0);
         if (!($361)) {
          _abort();
          // unreachable;
         }
         $362 = ((($354)) + 8|0);
         $363 = HEAP32[$362>>2]|0;
         $364 = ($363|0)==($$4$lcssa$i|0);
         if ($364) {
          HEAP32[$359>>2] = $354;
          HEAP32[$362>>2] = $357;
          $$3370$i = $354;
          break;
         } else {
          _abort();
          // unreachable;
         }
        }
       } while(0);
       $378 = ($352|0)==(0|0);
       do {
        if ($378) {
         $470 = $247;
        } else {
         $379 = ((($$4$lcssa$i)) + 28|0);
         $380 = HEAP32[$379>>2]|0;
         $381 = (7064 + ($380<<2)|0);
         $382 = HEAP32[$381>>2]|0;
         $383 = ($$4$lcssa$i|0)==($382|0);
         if ($383) {
          HEAP32[$381>>2] = $$3370$i;
          $cond$i204 = ($$3370$i|0)==(0|0);
          if ($cond$i204) {
           $384 = 1 << $380;
           $385 = $384 ^ -1;
           $386 = $247 & $385;
           HEAP32[(6764)>>2] = $386;
           $470 = $386;
           break;
          }
         } else {
          $387 = HEAP32[(6776)>>2]|0;
          $388 = ($352>>>0)<($387>>>0);
          if ($388) {
           _abort();
           // unreachable;
          }
          $389 = ((($352)) + 16|0);
          $390 = HEAP32[$389>>2]|0;
          $391 = ($390|0)==($$4$lcssa$i|0);
          if ($391) {
           HEAP32[$389>>2] = $$3370$i;
          } else {
           $392 = ((($352)) + 20|0);
           HEAP32[$392>>2] = $$3370$i;
          }
          $393 = ($$3370$i|0)==(0|0);
          if ($393) {
           $470 = $247;
           break;
          }
         }
         $394 = HEAP32[(6776)>>2]|0;
         $395 = ($$3370$i>>>0)<($394>>>0);
         if ($395) {
          _abort();
          // unreachable;
         }
         $396 = ((($$3370$i)) + 24|0);
         HEAP32[$396>>2] = $352;
         $397 = ((($$4$lcssa$i)) + 16|0);
         $398 = HEAP32[$397>>2]|0;
         $399 = ($398|0)==(0|0);
         do {
          if (!($399)) {
           $400 = ($398>>>0)<($394>>>0);
           if ($400) {
            _abort();
            // unreachable;
           } else {
            $401 = ((($$3370$i)) + 16|0);
            HEAP32[$401>>2] = $398;
            $402 = ((($398)) + 24|0);
            HEAP32[$402>>2] = $$3370$i;
            break;
           }
          }
         } while(0);
         $403 = ((($$4$lcssa$i)) + 20|0);
         $404 = HEAP32[$403>>2]|0;
         $405 = ($404|0)==(0|0);
         if ($405) {
          $470 = $247;
         } else {
          $406 = HEAP32[(6776)>>2]|0;
          $407 = ($404>>>0)<($406>>>0);
          if ($407) {
           _abort();
           // unreachable;
          } else {
           $408 = ((($$3370$i)) + 20|0);
           HEAP32[$408>>2] = $404;
           $409 = ((($404)) + 24|0);
           HEAP32[$409>>2] = $$3370$i;
           $470 = $247;
           break;
          }
         }
        }
       } while(0);
       $410 = ($$4349$lcssa$i>>>0)<(16);
       do {
        if ($410) {
         $411 = (($$4349$lcssa$i) + ($246))|0;
         $412 = $411 | 3;
         $413 = ((($$4$lcssa$i)) + 4|0);
         HEAP32[$413>>2] = $412;
         $414 = (($$4$lcssa$i) + ($411)|0);
         $415 = ((($414)) + 4|0);
         $416 = HEAP32[$415>>2]|0;
         $417 = $416 | 1;
         HEAP32[$415>>2] = $417;
        } else {
         $418 = $246 | 3;
         $419 = ((($$4$lcssa$i)) + 4|0);
         HEAP32[$419>>2] = $418;
         $420 = $$4349$lcssa$i | 1;
         $421 = ((($349)) + 4|0);
         HEAP32[$421>>2] = $420;
         $422 = (($349) + ($$4349$lcssa$i)|0);
         HEAP32[$422>>2] = $$4349$lcssa$i;
         $423 = $$4349$lcssa$i >>> 3;
         $424 = ($$4349$lcssa$i>>>0)<(256);
         if ($424) {
          $425 = $423 << 1;
          $426 = (6800 + ($425<<2)|0);
          $427 = HEAP32[1690]|0;
          $428 = 1 << $423;
          $429 = $427 & $428;
          $430 = ($429|0)==(0);
          if ($430) {
           $431 = $427 | $428;
           HEAP32[1690] = $431;
           $$pre$i205 = ((($426)) + 8|0);
           $$0366$i = $426;$$pre$phi$i206Z2D = $$pre$i205;
          } else {
           $432 = ((($426)) + 8|0);
           $433 = HEAP32[$432>>2]|0;
           $434 = HEAP32[(6776)>>2]|0;
           $435 = ($433>>>0)<($434>>>0);
           if ($435) {
            _abort();
            // unreachable;
           } else {
            $$0366$i = $433;$$pre$phi$i206Z2D = $432;
           }
          }
          HEAP32[$$pre$phi$i206Z2D>>2] = $349;
          $436 = ((($$0366$i)) + 12|0);
          HEAP32[$436>>2] = $349;
          $437 = ((($349)) + 8|0);
          HEAP32[$437>>2] = $$0366$i;
          $438 = ((($349)) + 12|0);
          HEAP32[$438>>2] = $426;
          break;
         }
         $439 = $$4349$lcssa$i >>> 8;
         $440 = ($439|0)==(0);
         if ($440) {
          $$0359$i = 0;
         } else {
          $441 = ($$4349$lcssa$i>>>0)>(16777215);
          if ($441) {
           $$0359$i = 31;
          } else {
           $442 = (($439) + 1048320)|0;
           $443 = $442 >>> 16;
           $444 = $443 & 8;
           $445 = $439 << $444;
           $446 = (($445) + 520192)|0;
           $447 = $446 >>> 16;
           $448 = $447 & 4;
           $449 = $448 | $444;
           $450 = $445 << $448;
           $451 = (($450) + 245760)|0;
           $452 = $451 >>> 16;
           $453 = $452 & 2;
           $454 = $449 | $453;
           $455 = (14 - ($454))|0;
           $456 = $450 << $453;
           $457 = $456 >>> 15;
           $458 = (($455) + ($457))|0;
           $459 = $458 << 1;
           $460 = (($458) + 7)|0;
           $461 = $$4349$lcssa$i >>> $460;
           $462 = $461 & 1;
           $463 = $462 | $459;
           $$0359$i = $463;
          }
         }
         $464 = (7064 + ($$0359$i<<2)|0);
         $465 = ((($349)) + 28|0);
         HEAP32[$465>>2] = $$0359$i;
         $466 = ((($349)) + 16|0);
         $467 = ((($466)) + 4|0);
         HEAP32[$467>>2] = 0;
         HEAP32[$466>>2] = 0;
         $468 = 1 << $$0359$i;
         $469 = $470 & $468;
         $471 = ($469|0)==(0);
         if ($471) {
          $472 = $470 | $468;
          HEAP32[(6764)>>2] = $472;
          HEAP32[$464>>2] = $349;
          $473 = ((($349)) + 24|0);
          HEAP32[$473>>2] = $464;
          $474 = ((($349)) + 12|0);
          HEAP32[$474>>2] = $349;
          $475 = ((($349)) + 8|0);
          HEAP32[$475>>2] = $349;
          break;
         }
         $476 = HEAP32[$464>>2]|0;
         $477 = ($$0359$i|0)==(31);
         $478 = $$0359$i >>> 1;
         $479 = (25 - ($478))|0;
         $480 = $477 ? 0 : $479;
         $481 = $$4349$lcssa$i << $480;
         $$0342$i = $481;$$0343$i = $476;
         while(1) {
          $482 = ((($$0343$i)) + 4|0);
          $483 = HEAP32[$482>>2]|0;
          $484 = $483 & -8;
          $485 = ($484|0)==($$4349$lcssa$i|0);
          if ($485) {
           label = 148;
           break;
          }
          $486 = $$0342$i >>> 31;
          $487 = (((($$0343$i)) + 16|0) + ($486<<2)|0);
          $488 = $$0342$i << 1;
          $489 = HEAP32[$487>>2]|0;
          $490 = ($489|0)==(0|0);
          if ($490) {
           label = 145;
           break;
          } else {
           $$0342$i = $488;$$0343$i = $489;
          }
         }
         if ((label|0) == 145) {
          $491 = HEAP32[(6776)>>2]|0;
          $492 = ($487>>>0)<($491>>>0);
          if ($492) {
           _abort();
           // unreachable;
          } else {
           HEAP32[$487>>2] = $349;
           $493 = ((($349)) + 24|0);
           HEAP32[$493>>2] = $$0343$i;
           $494 = ((($349)) + 12|0);
           HEAP32[$494>>2] = $349;
           $495 = ((($349)) + 8|0);
           HEAP32[$495>>2] = $349;
           break;
          }
         }
         else if ((label|0) == 148) {
          $496 = ((($$0343$i)) + 8|0);
          $497 = HEAP32[$496>>2]|0;
          $498 = HEAP32[(6776)>>2]|0;
          $499 = ($497>>>0)>=($498>>>0);
          $not$7$i = ($$0343$i>>>0)>=($498>>>0);
          $500 = $499 & $not$7$i;
          if ($500) {
           $501 = ((($497)) + 12|0);
           HEAP32[$501>>2] = $349;
           HEAP32[$496>>2] = $349;
           $502 = ((($349)) + 8|0);
           HEAP32[$502>>2] = $497;
           $503 = ((($349)) + 12|0);
           HEAP32[$503>>2] = $$0343$i;
           $504 = ((($349)) + 24|0);
           HEAP32[$504>>2] = 0;
           break;
          } else {
           _abort();
           // unreachable;
          }
         }
        }
       } while(0);
       $505 = ((($$4$lcssa$i)) + 8|0);
       $$0 = $505;
       STACKTOP = sp;return ($$0|0);
      } else {
       $$0197 = $246;
      }
     }
    }
   }
  }
 } while(0);
 $506 = HEAP32[(6768)>>2]|0;
 $507 = ($506>>>0)<($$0197>>>0);
 if (!($507)) {
  $508 = (($506) - ($$0197))|0;
  $509 = HEAP32[(6780)>>2]|0;
  $510 = ($508>>>0)>(15);
  if ($510) {
   $511 = (($509) + ($$0197)|0);
   HEAP32[(6780)>>2] = $511;
   HEAP32[(6768)>>2] = $508;
   $512 = $508 | 1;
   $513 = ((($511)) + 4|0);
   HEAP32[$513>>2] = $512;
   $514 = (($511) + ($508)|0);
   HEAP32[$514>>2] = $508;
   $515 = $$0197 | 3;
   $516 = ((($509)) + 4|0);
   HEAP32[$516>>2] = $515;
  } else {
   HEAP32[(6768)>>2] = 0;
   HEAP32[(6780)>>2] = 0;
   $517 = $506 | 3;
   $518 = ((($509)) + 4|0);
   HEAP32[$518>>2] = $517;
   $519 = (($509) + ($506)|0);
   $520 = ((($519)) + 4|0);
   $521 = HEAP32[$520>>2]|0;
   $522 = $521 | 1;
   HEAP32[$520>>2] = $522;
  }
  $523 = ((($509)) + 8|0);
  $$0 = $523;
  STACKTOP = sp;return ($$0|0);
 }
 $524 = HEAP32[(6772)>>2]|0;
 $525 = ($524>>>0)>($$0197>>>0);
 if ($525) {
  $526 = (($524) - ($$0197))|0;
  HEAP32[(6772)>>2] = $526;
  $527 = HEAP32[(6784)>>2]|0;
  $528 = (($527) + ($$0197)|0);
  HEAP32[(6784)>>2] = $528;
  $529 = $526 | 1;
  $530 = ((($528)) + 4|0);
  HEAP32[$530>>2] = $529;
  $531 = $$0197 | 3;
  $532 = ((($527)) + 4|0);
  HEAP32[$532>>2] = $531;
  $533 = ((($527)) + 8|0);
  $$0 = $533;
  STACKTOP = sp;return ($$0|0);
 }
 $534 = HEAP32[1808]|0;
 $535 = ($534|0)==(0);
 if ($535) {
  HEAP32[(7240)>>2] = 4096;
  HEAP32[(7236)>>2] = 4096;
  HEAP32[(7244)>>2] = -1;
  HEAP32[(7248)>>2] = -1;
  HEAP32[(7252)>>2] = 0;
  HEAP32[(7204)>>2] = 0;
  $536 = $1;
  $537 = $536 & -16;
  $538 = $537 ^ 1431655768;
  HEAP32[$1>>2] = $538;
  HEAP32[1808] = $538;
  $542 = 4096;
 } else {
  $$pre$i208 = HEAP32[(7240)>>2]|0;
  $542 = $$pre$i208;
 }
 $539 = (($$0197) + 48)|0;
 $540 = (($$0197) + 47)|0;
 $541 = (($542) + ($540))|0;
 $543 = (0 - ($542))|0;
 $544 = $541 & $543;
 $545 = ($544>>>0)>($$0197>>>0);
 if (!($545)) {
  $$0 = 0;
  STACKTOP = sp;return ($$0|0);
 }
 $546 = HEAP32[(7200)>>2]|0;
 $547 = ($546|0)==(0);
 if (!($547)) {
  $548 = HEAP32[(7192)>>2]|0;
  $549 = (($548) + ($544))|0;
  $550 = ($549>>>0)<=($548>>>0);
  $551 = ($549>>>0)>($546>>>0);
  $or$cond1$i210 = $550 | $551;
  if ($or$cond1$i210) {
   $$0 = 0;
   STACKTOP = sp;return ($$0|0);
  }
 }
 $552 = HEAP32[(7204)>>2]|0;
 $553 = $552 & 4;
 $554 = ($553|0)==(0);
 L255: do {
  if ($554) {
   $555 = HEAP32[(6784)>>2]|0;
   $556 = ($555|0)==(0|0);
   L257: do {
    if ($556) {
     label = 172;
    } else {
     $$0$i17$i = (7208);
     while(1) {
      $557 = HEAP32[$$0$i17$i>>2]|0;
      $558 = ($557>>>0)>($555>>>0);
      if (!($558)) {
       $559 = ((($$0$i17$i)) + 4|0);
       $560 = HEAP32[$559>>2]|0;
       $561 = (($557) + ($560)|0);
       $562 = ($561>>>0)>($555>>>0);
       if ($562) {
        break;
       }
      }
      $563 = ((($$0$i17$i)) + 8|0);
      $564 = HEAP32[$563>>2]|0;
      $565 = ($564|0)==(0|0);
      if ($565) {
       label = 172;
       break L257;
      } else {
       $$0$i17$i = $564;
      }
     }
     $588 = (($541) - ($524))|0;
     $589 = $588 & $543;
     $590 = ($589>>>0)<(2147483647);
     if ($590) {
      $591 = (_sbrk(($589|0))|0);
      $592 = HEAP32[$$0$i17$i>>2]|0;
      $593 = HEAP32[$559>>2]|0;
      $594 = (($592) + ($593)|0);
      $595 = ($591|0)==($594|0);
      if ($595) {
       $596 = ($591|0)==((-1)|0);
       if (!($596)) {
        $$723947$i = $589;$$748$i = $591;
        label = 190;
        break L255;
       }
      } else {
       $$2247$ph$i = $591;$$2253$ph$i = $589;
       label = 180;
      }
     }
    }
   } while(0);
   do {
    if ((label|0) == 172) {
     $566 = (_sbrk(0)|0);
     $567 = ($566|0)==((-1)|0);
     if (!($567)) {
      $568 = $566;
      $569 = HEAP32[(7236)>>2]|0;
      $570 = (($569) + -1)|0;
      $571 = $570 & $568;
      $572 = ($571|0)==(0);
      $573 = (($570) + ($568))|0;
      $574 = (0 - ($569))|0;
      $575 = $573 & $574;
      $576 = (($575) - ($568))|0;
      $577 = $572 ? 0 : $576;
      $$$i = (($577) + ($544))|0;
      $578 = HEAP32[(7192)>>2]|0;
      $579 = (($$$i) + ($578))|0;
      $580 = ($$$i>>>0)>($$0197>>>0);
      $581 = ($$$i>>>0)<(2147483647);
      $or$cond$i211 = $580 & $581;
      if ($or$cond$i211) {
       $582 = HEAP32[(7200)>>2]|0;
       $583 = ($582|0)==(0);
       if (!($583)) {
        $584 = ($579>>>0)<=($578>>>0);
        $585 = ($579>>>0)>($582>>>0);
        $or$cond2$i = $584 | $585;
        if ($or$cond2$i) {
         break;
        }
       }
       $586 = (_sbrk(($$$i|0))|0);
       $587 = ($586|0)==($566|0);
       if ($587) {
        $$723947$i = $$$i;$$748$i = $566;
        label = 190;
        break L255;
       } else {
        $$2247$ph$i = $586;$$2253$ph$i = $$$i;
        label = 180;
       }
      }
     }
    }
   } while(0);
   L274: do {
    if ((label|0) == 180) {
     $597 = (0 - ($$2253$ph$i))|0;
     $598 = ($$2247$ph$i|0)!=((-1)|0);
     $599 = ($$2253$ph$i>>>0)<(2147483647);
     $or$cond7$i = $599 & $598;
     $600 = ($539>>>0)>($$2253$ph$i>>>0);
     $or$cond10$i = $600 & $or$cond7$i;
     do {
      if ($or$cond10$i) {
       $601 = HEAP32[(7240)>>2]|0;
       $602 = (($540) - ($$2253$ph$i))|0;
       $603 = (($602) + ($601))|0;
       $604 = (0 - ($601))|0;
       $605 = $603 & $604;
       $606 = ($605>>>0)<(2147483647);
       if ($606) {
        $607 = (_sbrk(($605|0))|0);
        $608 = ($607|0)==((-1)|0);
        if ($608) {
         (_sbrk(($597|0))|0);
         break L274;
        } else {
         $609 = (($605) + ($$2253$ph$i))|0;
         $$5256$i = $609;
         break;
        }
       } else {
        $$5256$i = $$2253$ph$i;
       }
      } else {
       $$5256$i = $$2253$ph$i;
      }
     } while(0);
     $610 = ($$2247$ph$i|0)==((-1)|0);
     if (!($610)) {
      $$723947$i = $$5256$i;$$748$i = $$2247$ph$i;
      label = 190;
      break L255;
     }
    }
   } while(0);
   $611 = HEAP32[(7204)>>2]|0;
   $612 = $611 | 4;
   HEAP32[(7204)>>2] = $612;
   label = 187;
  } else {
   label = 187;
  }
 } while(0);
 if ((label|0) == 187) {
  $613 = ($544>>>0)<(2147483647);
  if ($613) {
   $614 = (_sbrk(($544|0))|0);
   $615 = (_sbrk(0)|0);
   $616 = ($614|0)!=((-1)|0);
   $617 = ($615|0)!=((-1)|0);
   $or$cond5$i = $616 & $617;
   $618 = ($614>>>0)<($615>>>0);
   $or$cond11$i = $618 & $or$cond5$i;
   if ($or$cond11$i) {
    $619 = $615;
    $620 = $614;
    $621 = (($619) - ($620))|0;
    $622 = (($$0197) + 40)|0;
    $$not$i = ($621>>>0)>($622>>>0);
    if ($$not$i) {
     $$723947$i = $621;$$748$i = $614;
     label = 190;
    }
   }
  }
 }
 if ((label|0) == 190) {
  $623 = HEAP32[(7192)>>2]|0;
  $624 = (($623) + ($$723947$i))|0;
  HEAP32[(7192)>>2] = $624;
  $625 = HEAP32[(7196)>>2]|0;
  $626 = ($624>>>0)>($625>>>0);
  if ($626) {
   HEAP32[(7196)>>2] = $624;
  }
  $627 = HEAP32[(6784)>>2]|0;
  $628 = ($627|0)==(0|0);
  do {
   if ($628) {
    $629 = HEAP32[(6776)>>2]|0;
    $630 = ($629|0)==(0|0);
    $631 = ($$748$i>>>0)<($629>>>0);
    $or$cond12$i = $630 | $631;
    if ($or$cond12$i) {
     HEAP32[(6776)>>2] = $$748$i;
    }
    HEAP32[(7208)>>2] = $$748$i;
    HEAP32[(7212)>>2] = $$723947$i;
    HEAP32[(7220)>>2] = 0;
    $632 = HEAP32[1808]|0;
    HEAP32[(6796)>>2] = $632;
    HEAP32[(6792)>>2] = -1;
    $$01$i$i = 0;
    while(1) {
     $633 = $$01$i$i << 1;
     $634 = (6800 + ($633<<2)|0);
     $635 = ((($634)) + 12|0);
     HEAP32[$635>>2] = $634;
     $636 = ((($634)) + 8|0);
     HEAP32[$636>>2] = $634;
     $637 = (($$01$i$i) + 1)|0;
     $exitcond$i$i = ($637|0)==(32);
     if ($exitcond$i$i) {
      break;
     } else {
      $$01$i$i = $637;
     }
    }
    $638 = (($$723947$i) + -40)|0;
    $639 = ((($$748$i)) + 8|0);
    $640 = $639;
    $641 = $640 & 7;
    $642 = ($641|0)==(0);
    $643 = (0 - ($640))|0;
    $644 = $643 & 7;
    $645 = $642 ? 0 : $644;
    $646 = (($$748$i) + ($645)|0);
    $647 = (($638) - ($645))|0;
    HEAP32[(6784)>>2] = $646;
    HEAP32[(6772)>>2] = $647;
    $648 = $647 | 1;
    $649 = ((($646)) + 4|0);
    HEAP32[$649>>2] = $648;
    $650 = (($646) + ($647)|0);
    $651 = ((($650)) + 4|0);
    HEAP32[$651>>2] = 40;
    $652 = HEAP32[(7248)>>2]|0;
    HEAP32[(6788)>>2] = $652;
   } else {
    $$024370$i = (7208);
    while(1) {
     $653 = HEAP32[$$024370$i>>2]|0;
     $654 = ((($$024370$i)) + 4|0);
     $655 = HEAP32[$654>>2]|0;
     $656 = (($653) + ($655)|0);
     $657 = ($$748$i|0)==($656|0);
     if ($657) {
      label = 200;
      break;
     }
     $658 = ((($$024370$i)) + 8|0);
     $659 = HEAP32[$658>>2]|0;
     $660 = ($659|0)==(0|0);
     if ($660) {
      break;
     } else {
      $$024370$i = $659;
     }
    }
    if ((label|0) == 200) {
     $661 = ((($$024370$i)) + 12|0);
     $662 = HEAP32[$661>>2]|0;
     $663 = $662 & 8;
     $664 = ($663|0)==(0);
     if ($664) {
      $665 = ($627>>>0)>=($653>>>0);
      $666 = ($627>>>0)<($$748$i>>>0);
      $or$cond50$i = $666 & $665;
      if ($or$cond50$i) {
       $667 = (($655) + ($$723947$i))|0;
       HEAP32[$654>>2] = $667;
       $668 = HEAP32[(6772)>>2]|0;
       $669 = ((($627)) + 8|0);
       $670 = $669;
       $671 = $670 & 7;
       $672 = ($671|0)==(0);
       $673 = (0 - ($670))|0;
       $674 = $673 & 7;
       $675 = $672 ? 0 : $674;
       $676 = (($627) + ($675)|0);
       $677 = (($$723947$i) - ($675))|0;
       $678 = (($677) + ($668))|0;
       HEAP32[(6784)>>2] = $676;
       HEAP32[(6772)>>2] = $678;
       $679 = $678 | 1;
       $680 = ((($676)) + 4|0);
       HEAP32[$680>>2] = $679;
       $681 = (($676) + ($678)|0);
       $682 = ((($681)) + 4|0);
       HEAP32[$682>>2] = 40;
       $683 = HEAP32[(7248)>>2]|0;
       HEAP32[(6788)>>2] = $683;
       break;
      }
     }
    }
    $684 = HEAP32[(6776)>>2]|0;
    $685 = ($$748$i>>>0)<($684>>>0);
    if ($685) {
     HEAP32[(6776)>>2] = $$748$i;
     $749 = $$748$i;
    } else {
     $749 = $684;
    }
    $686 = (($$748$i) + ($$723947$i)|0);
    $$124469$i = (7208);
    while(1) {
     $687 = HEAP32[$$124469$i>>2]|0;
     $688 = ($687|0)==($686|0);
     if ($688) {
      label = 208;
      break;
     }
     $689 = ((($$124469$i)) + 8|0);
     $690 = HEAP32[$689>>2]|0;
     $691 = ($690|0)==(0|0);
     if ($691) {
      $$0$i$i$i = (7208);
      break;
     } else {
      $$124469$i = $690;
     }
    }
    if ((label|0) == 208) {
     $692 = ((($$124469$i)) + 12|0);
     $693 = HEAP32[$692>>2]|0;
     $694 = $693 & 8;
     $695 = ($694|0)==(0);
     if ($695) {
      HEAP32[$$124469$i>>2] = $$748$i;
      $696 = ((($$124469$i)) + 4|0);
      $697 = HEAP32[$696>>2]|0;
      $698 = (($697) + ($$723947$i))|0;
      HEAP32[$696>>2] = $698;
      $699 = ((($$748$i)) + 8|0);
      $700 = $699;
      $701 = $700 & 7;
      $702 = ($701|0)==(0);
      $703 = (0 - ($700))|0;
      $704 = $703 & 7;
      $705 = $702 ? 0 : $704;
      $706 = (($$748$i) + ($705)|0);
      $707 = ((($686)) + 8|0);
      $708 = $707;
      $709 = $708 & 7;
      $710 = ($709|0)==(0);
      $711 = (0 - ($708))|0;
      $712 = $711 & 7;
      $713 = $710 ? 0 : $712;
      $714 = (($686) + ($713)|0);
      $715 = $714;
      $716 = $706;
      $717 = (($715) - ($716))|0;
      $718 = (($706) + ($$0197)|0);
      $719 = (($717) - ($$0197))|0;
      $720 = $$0197 | 3;
      $721 = ((($706)) + 4|0);
      HEAP32[$721>>2] = $720;
      $722 = ($714|0)==($627|0);
      do {
       if ($722) {
        $723 = HEAP32[(6772)>>2]|0;
        $724 = (($723) + ($719))|0;
        HEAP32[(6772)>>2] = $724;
        HEAP32[(6784)>>2] = $718;
        $725 = $724 | 1;
        $726 = ((($718)) + 4|0);
        HEAP32[$726>>2] = $725;
       } else {
        $727 = HEAP32[(6780)>>2]|0;
        $728 = ($714|0)==($727|0);
        if ($728) {
         $729 = HEAP32[(6768)>>2]|0;
         $730 = (($729) + ($719))|0;
         HEAP32[(6768)>>2] = $730;
         HEAP32[(6780)>>2] = $718;
         $731 = $730 | 1;
         $732 = ((($718)) + 4|0);
         HEAP32[$732>>2] = $731;
         $733 = (($718) + ($730)|0);
         HEAP32[$733>>2] = $730;
         break;
        }
        $734 = ((($714)) + 4|0);
        $735 = HEAP32[$734>>2]|0;
        $736 = $735 & 3;
        $737 = ($736|0)==(1);
        if ($737) {
         $738 = $735 & -8;
         $739 = $735 >>> 3;
         $740 = ($735>>>0)<(256);
         L326: do {
          if ($740) {
           $741 = ((($714)) + 8|0);
           $742 = HEAP32[$741>>2]|0;
           $743 = ((($714)) + 12|0);
           $744 = HEAP32[$743>>2]|0;
           $745 = $739 << 1;
           $746 = (6800 + ($745<<2)|0);
           $747 = ($742|0)==($746|0);
           do {
            if (!($747)) {
             $748 = ($742>>>0)<($749>>>0);
             if ($748) {
              _abort();
              // unreachable;
             }
             $750 = ((($742)) + 12|0);
             $751 = HEAP32[$750>>2]|0;
             $752 = ($751|0)==($714|0);
             if ($752) {
              break;
             }
             _abort();
             // unreachable;
            }
           } while(0);
           $753 = ($744|0)==($742|0);
           if ($753) {
            $754 = 1 << $739;
            $755 = $754 ^ -1;
            $756 = HEAP32[1690]|0;
            $757 = $756 & $755;
            HEAP32[1690] = $757;
            break;
           }
           $758 = ($744|0)==($746|0);
           do {
            if ($758) {
             $$pre9$i$i = ((($744)) + 8|0);
             $$pre$phi10$i$iZ2D = $$pre9$i$i;
            } else {
             $759 = ($744>>>0)<($749>>>0);
             if ($759) {
              _abort();
              // unreachable;
             }
             $760 = ((($744)) + 8|0);
             $761 = HEAP32[$760>>2]|0;
             $762 = ($761|0)==($714|0);
             if ($762) {
              $$pre$phi10$i$iZ2D = $760;
              break;
             }
             _abort();
             // unreachable;
            }
           } while(0);
           $763 = ((($742)) + 12|0);
           HEAP32[$763>>2] = $744;
           HEAP32[$$pre$phi10$i$iZ2D>>2] = $742;
          } else {
           $764 = ((($714)) + 24|0);
           $765 = HEAP32[$764>>2]|0;
           $766 = ((($714)) + 12|0);
           $767 = HEAP32[$766>>2]|0;
           $768 = ($767|0)==($714|0);
           do {
            if ($768) {
             $778 = ((($714)) + 16|0);
             $779 = ((($778)) + 4|0);
             $780 = HEAP32[$779>>2]|0;
             $781 = ($780|0)==(0|0);
             if ($781) {
              $782 = HEAP32[$778>>2]|0;
              $783 = ($782|0)==(0|0);
              if ($783) {
               $$3$i$i = 0;
               break;
              } else {
               $$1290$i$i = $782;$$1292$i$i = $778;
              }
             } else {
              $$1290$i$i = $780;$$1292$i$i = $779;
             }
             while(1) {
              $784 = ((($$1290$i$i)) + 20|0);
              $785 = HEAP32[$784>>2]|0;
              $786 = ($785|0)==(0|0);
              if (!($786)) {
               $$1290$i$i = $785;$$1292$i$i = $784;
               continue;
              }
              $787 = ((($$1290$i$i)) + 16|0);
              $788 = HEAP32[$787>>2]|0;
              $789 = ($788|0)==(0|0);
              if ($789) {
               break;
              } else {
               $$1290$i$i = $788;$$1292$i$i = $787;
              }
             }
             $790 = ($$1292$i$i>>>0)<($749>>>0);
             if ($790) {
              _abort();
              // unreachable;
             } else {
              HEAP32[$$1292$i$i>>2] = 0;
              $$3$i$i = $$1290$i$i;
              break;
             }
            } else {
             $769 = ((($714)) + 8|0);
             $770 = HEAP32[$769>>2]|0;
             $771 = ($770>>>0)<($749>>>0);
             if ($771) {
              _abort();
              // unreachable;
             }
             $772 = ((($770)) + 12|0);
             $773 = HEAP32[$772>>2]|0;
             $774 = ($773|0)==($714|0);
             if (!($774)) {
              _abort();
              // unreachable;
             }
             $775 = ((($767)) + 8|0);
             $776 = HEAP32[$775>>2]|0;
             $777 = ($776|0)==($714|0);
             if ($777) {
              HEAP32[$772>>2] = $767;
              HEAP32[$775>>2] = $770;
              $$3$i$i = $767;
              break;
             } else {
              _abort();
              // unreachable;
             }
            }
           } while(0);
           $791 = ($765|0)==(0|0);
           if ($791) {
            break;
           }
           $792 = ((($714)) + 28|0);
           $793 = HEAP32[$792>>2]|0;
           $794 = (7064 + ($793<<2)|0);
           $795 = HEAP32[$794>>2]|0;
           $796 = ($714|0)==($795|0);
           do {
            if ($796) {
             HEAP32[$794>>2] = $$3$i$i;
             $cond$i$i = ($$3$i$i|0)==(0|0);
             if (!($cond$i$i)) {
              break;
             }
             $797 = 1 << $793;
             $798 = $797 ^ -1;
             $799 = HEAP32[(6764)>>2]|0;
             $800 = $799 & $798;
             HEAP32[(6764)>>2] = $800;
             break L326;
            } else {
             $801 = HEAP32[(6776)>>2]|0;
             $802 = ($765>>>0)<($801>>>0);
             if ($802) {
              _abort();
              // unreachable;
             }
             $803 = ((($765)) + 16|0);
             $804 = HEAP32[$803>>2]|0;
             $805 = ($804|0)==($714|0);
             if ($805) {
              HEAP32[$803>>2] = $$3$i$i;
             } else {
              $806 = ((($765)) + 20|0);
              HEAP32[$806>>2] = $$3$i$i;
             }
             $807 = ($$3$i$i|0)==(0|0);
             if ($807) {
              break L326;
             }
            }
           } while(0);
           $808 = HEAP32[(6776)>>2]|0;
           $809 = ($$3$i$i>>>0)<($808>>>0);
           if ($809) {
            _abort();
            // unreachable;
           }
           $810 = ((($$3$i$i)) + 24|0);
           HEAP32[$810>>2] = $765;
           $811 = ((($714)) + 16|0);
           $812 = HEAP32[$811>>2]|0;
           $813 = ($812|0)==(0|0);
           do {
            if (!($813)) {
             $814 = ($812>>>0)<($808>>>0);
             if ($814) {
              _abort();
              // unreachable;
             } else {
              $815 = ((($$3$i$i)) + 16|0);
              HEAP32[$815>>2] = $812;
              $816 = ((($812)) + 24|0);
              HEAP32[$816>>2] = $$3$i$i;
              break;
             }
            }
           } while(0);
           $817 = ((($811)) + 4|0);
           $818 = HEAP32[$817>>2]|0;
           $819 = ($818|0)==(0|0);
           if ($819) {
            break;
           }
           $820 = HEAP32[(6776)>>2]|0;
           $821 = ($818>>>0)<($820>>>0);
           if ($821) {
            _abort();
            // unreachable;
           } else {
            $822 = ((($$3$i$i)) + 20|0);
            HEAP32[$822>>2] = $818;
            $823 = ((($818)) + 24|0);
            HEAP32[$823>>2] = $$3$i$i;
            break;
           }
          }
         } while(0);
         $824 = (($714) + ($738)|0);
         $825 = (($738) + ($719))|0;
         $$0$i18$i = $824;$$0286$i$i = $825;
        } else {
         $$0$i18$i = $714;$$0286$i$i = $719;
        }
        $826 = ((($$0$i18$i)) + 4|0);
        $827 = HEAP32[$826>>2]|0;
        $828 = $827 & -2;
        HEAP32[$826>>2] = $828;
        $829 = $$0286$i$i | 1;
        $830 = ((($718)) + 4|0);
        HEAP32[$830>>2] = $829;
        $831 = (($718) + ($$0286$i$i)|0);
        HEAP32[$831>>2] = $$0286$i$i;
        $832 = $$0286$i$i >>> 3;
        $833 = ($$0286$i$i>>>0)<(256);
        if ($833) {
         $834 = $832 << 1;
         $835 = (6800 + ($834<<2)|0);
         $836 = HEAP32[1690]|0;
         $837 = 1 << $832;
         $838 = $836 & $837;
         $839 = ($838|0)==(0);
         do {
          if ($839) {
           $840 = $836 | $837;
           HEAP32[1690] = $840;
           $$pre$i19$i = ((($835)) + 8|0);
           $$0294$i$i = $835;$$pre$phi$i20$iZ2D = $$pre$i19$i;
          } else {
           $841 = ((($835)) + 8|0);
           $842 = HEAP32[$841>>2]|0;
           $843 = HEAP32[(6776)>>2]|0;
           $844 = ($842>>>0)<($843>>>0);
           if (!($844)) {
            $$0294$i$i = $842;$$pre$phi$i20$iZ2D = $841;
            break;
           }
           _abort();
           // unreachable;
          }
         } while(0);
         HEAP32[$$pre$phi$i20$iZ2D>>2] = $718;
         $845 = ((($$0294$i$i)) + 12|0);
         HEAP32[$845>>2] = $718;
         $846 = ((($718)) + 8|0);
         HEAP32[$846>>2] = $$0294$i$i;
         $847 = ((($718)) + 12|0);
         HEAP32[$847>>2] = $835;
         break;
        }
        $848 = $$0286$i$i >>> 8;
        $849 = ($848|0)==(0);
        do {
         if ($849) {
          $$0295$i$i = 0;
         } else {
          $850 = ($$0286$i$i>>>0)>(16777215);
          if ($850) {
           $$0295$i$i = 31;
           break;
          }
          $851 = (($848) + 1048320)|0;
          $852 = $851 >>> 16;
          $853 = $852 & 8;
          $854 = $848 << $853;
          $855 = (($854) + 520192)|0;
          $856 = $855 >>> 16;
          $857 = $856 & 4;
          $858 = $857 | $853;
          $859 = $854 << $857;
          $860 = (($859) + 245760)|0;
          $861 = $860 >>> 16;
          $862 = $861 & 2;
          $863 = $858 | $862;
          $864 = (14 - ($863))|0;
          $865 = $859 << $862;
          $866 = $865 >>> 15;
          $867 = (($864) + ($866))|0;
          $868 = $867 << 1;
          $869 = (($867) + 7)|0;
          $870 = $$0286$i$i >>> $869;
          $871 = $870 & 1;
          $872 = $871 | $868;
          $$0295$i$i = $872;
         }
        } while(0);
        $873 = (7064 + ($$0295$i$i<<2)|0);
        $874 = ((($718)) + 28|0);
        HEAP32[$874>>2] = $$0295$i$i;
        $875 = ((($718)) + 16|0);
        $876 = ((($875)) + 4|0);
        HEAP32[$876>>2] = 0;
        HEAP32[$875>>2] = 0;
        $877 = HEAP32[(6764)>>2]|0;
        $878 = 1 << $$0295$i$i;
        $879 = $877 & $878;
        $880 = ($879|0)==(0);
        if ($880) {
         $881 = $877 | $878;
         HEAP32[(6764)>>2] = $881;
         HEAP32[$873>>2] = $718;
         $882 = ((($718)) + 24|0);
         HEAP32[$882>>2] = $873;
         $883 = ((($718)) + 12|0);
         HEAP32[$883>>2] = $718;
         $884 = ((($718)) + 8|0);
         HEAP32[$884>>2] = $718;
         break;
        }
        $885 = HEAP32[$873>>2]|0;
        $886 = ($$0295$i$i|0)==(31);
        $887 = $$0295$i$i >>> 1;
        $888 = (25 - ($887))|0;
        $889 = $886 ? 0 : $888;
        $890 = $$0286$i$i << $889;
        $$0287$i$i = $890;$$0288$i$i = $885;
        while(1) {
         $891 = ((($$0288$i$i)) + 4|0);
         $892 = HEAP32[$891>>2]|0;
         $893 = $892 & -8;
         $894 = ($893|0)==($$0286$i$i|0);
         if ($894) {
          label = 278;
          break;
         }
         $895 = $$0287$i$i >>> 31;
         $896 = (((($$0288$i$i)) + 16|0) + ($895<<2)|0);
         $897 = $$0287$i$i << 1;
         $898 = HEAP32[$896>>2]|0;
         $899 = ($898|0)==(0|0);
         if ($899) {
          label = 275;
          break;
         } else {
          $$0287$i$i = $897;$$0288$i$i = $898;
         }
        }
        if ((label|0) == 275) {
         $900 = HEAP32[(6776)>>2]|0;
         $901 = ($896>>>0)<($900>>>0);
         if ($901) {
          _abort();
          // unreachable;
         } else {
          HEAP32[$896>>2] = $718;
          $902 = ((($718)) + 24|0);
          HEAP32[$902>>2] = $$0288$i$i;
          $903 = ((($718)) + 12|0);
          HEAP32[$903>>2] = $718;
          $904 = ((($718)) + 8|0);
          HEAP32[$904>>2] = $718;
          break;
         }
        }
        else if ((label|0) == 278) {
         $905 = ((($$0288$i$i)) + 8|0);
         $906 = HEAP32[$905>>2]|0;
         $907 = HEAP32[(6776)>>2]|0;
         $908 = ($906>>>0)>=($907>>>0);
         $not$$i22$i = ($$0288$i$i>>>0)>=($907>>>0);
         $909 = $908 & $not$$i22$i;
         if ($909) {
          $910 = ((($906)) + 12|0);
          HEAP32[$910>>2] = $718;
          HEAP32[$905>>2] = $718;
          $911 = ((($718)) + 8|0);
          HEAP32[$911>>2] = $906;
          $912 = ((($718)) + 12|0);
          HEAP32[$912>>2] = $$0288$i$i;
          $913 = ((($718)) + 24|0);
          HEAP32[$913>>2] = 0;
          break;
         } else {
          _abort();
          // unreachable;
         }
        }
       }
      } while(0);
      $1044 = ((($706)) + 8|0);
      $$0 = $1044;
      STACKTOP = sp;return ($$0|0);
     } else {
      $$0$i$i$i = (7208);
     }
    }
    while(1) {
     $914 = HEAP32[$$0$i$i$i>>2]|0;
     $915 = ($914>>>0)>($627>>>0);
     if (!($915)) {
      $916 = ((($$0$i$i$i)) + 4|0);
      $917 = HEAP32[$916>>2]|0;
      $918 = (($914) + ($917)|0);
      $919 = ($918>>>0)>($627>>>0);
      if ($919) {
       break;
      }
     }
     $920 = ((($$0$i$i$i)) + 8|0);
     $921 = HEAP32[$920>>2]|0;
     $$0$i$i$i = $921;
    }
    $922 = ((($918)) + -47|0);
    $923 = ((($922)) + 8|0);
    $924 = $923;
    $925 = $924 & 7;
    $926 = ($925|0)==(0);
    $927 = (0 - ($924))|0;
    $928 = $927 & 7;
    $929 = $926 ? 0 : $928;
    $930 = (($922) + ($929)|0);
    $931 = ((($627)) + 16|0);
    $932 = ($930>>>0)<($931>>>0);
    $933 = $932 ? $627 : $930;
    $934 = ((($933)) + 8|0);
    $935 = ((($933)) + 24|0);
    $936 = (($$723947$i) + -40)|0;
    $937 = ((($$748$i)) + 8|0);
    $938 = $937;
    $939 = $938 & 7;
    $940 = ($939|0)==(0);
    $941 = (0 - ($938))|0;
    $942 = $941 & 7;
    $943 = $940 ? 0 : $942;
    $944 = (($$748$i) + ($943)|0);
    $945 = (($936) - ($943))|0;
    HEAP32[(6784)>>2] = $944;
    HEAP32[(6772)>>2] = $945;
    $946 = $945 | 1;
    $947 = ((($944)) + 4|0);
    HEAP32[$947>>2] = $946;
    $948 = (($944) + ($945)|0);
    $949 = ((($948)) + 4|0);
    HEAP32[$949>>2] = 40;
    $950 = HEAP32[(7248)>>2]|0;
    HEAP32[(6788)>>2] = $950;
    $951 = ((($933)) + 4|0);
    HEAP32[$951>>2] = 27;
    ;HEAP32[$934>>2]=HEAP32[(7208)>>2]|0;HEAP32[$934+4>>2]=HEAP32[(7208)+4>>2]|0;HEAP32[$934+8>>2]=HEAP32[(7208)+8>>2]|0;HEAP32[$934+12>>2]=HEAP32[(7208)+12>>2]|0;
    HEAP32[(7208)>>2] = $$748$i;
    HEAP32[(7212)>>2] = $$723947$i;
    HEAP32[(7220)>>2] = 0;
    HEAP32[(7216)>>2] = $934;
    $$0$i$i = $935;
    while(1) {
     $952 = ((($$0$i$i)) + 4|0);
     HEAP32[$952>>2] = 7;
     $953 = ((($952)) + 4|0);
     $954 = ($953>>>0)<($918>>>0);
     if ($954) {
      $$0$i$i = $952;
     } else {
      break;
     }
    }
    $955 = ($933|0)==($627|0);
    if (!($955)) {
     $956 = $933;
     $957 = $627;
     $958 = (($956) - ($957))|0;
     $959 = HEAP32[$951>>2]|0;
     $960 = $959 & -2;
     HEAP32[$951>>2] = $960;
     $961 = $958 | 1;
     $962 = ((($627)) + 4|0);
     HEAP32[$962>>2] = $961;
     HEAP32[$933>>2] = $958;
     $963 = $958 >>> 3;
     $964 = ($958>>>0)<(256);
     if ($964) {
      $965 = $963 << 1;
      $966 = (6800 + ($965<<2)|0);
      $967 = HEAP32[1690]|0;
      $968 = 1 << $963;
      $969 = $967 & $968;
      $970 = ($969|0)==(0);
      if ($970) {
       $971 = $967 | $968;
       HEAP32[1690] = $971;
       $$pre$i$i = ((($966)) + 8|0);
       $$0211$i$i = $966;$$pre$phi$i$iZ2D = $$pre$i$i;
      } else {
       $972 = ((($966)) + 8|0);
       $973 = HEAP32[$972>>2]|0;
       $974 = HEAP32[(6776)>>2]|0;
       $975 = ($973>>>0)<($974>>>0);
       if ($975) {
        _abort();
        // unreachable;
       } else {
        $$0211$i$i = $973;$$pre$phi$i$iZ2D = $972;
       }
      }
      HEAP32[$$pre$phi$i$iZ2D>>2] = $627;
      $976 = ((($$0211$i$i)) + 12|0);
      HEAP32[$976>>2] = $627;
      $977 = ((($627)) + 8|0);
      HEAP32[$977>>2] = $$0211$i$i;
      $978 = ((($627)) + 12|0);
      HEAP32[$978>>2] = $966;
      break;
     }
     $979 = $958 >>> 8;
     $980 = ($979|0)==(0);
     if ($980) {
      $$0212$i$i = 0;
     } else {
      $981 = ($958>>>0)>(16777215);
      if ($981) {
       $$0212$i$i = 31;
      } else {
       $982 = (($979) + 1048320)|0;
       $983 = $982 >>> 16;
       $984 = $983 & 8;
       $985 = $979 << $984;
       $986 = (($985) + 520192)|0;
       $987 = $986 >>> 16;
       $988 = $987 & 4;
       $989 = $988 | $984;
       $990 = $985 << $988;
       $991 = (($990) + 245760)|0;
       $992 = $991 >>> 16;
       $993 = $992 & 2;
       $994 = $989 | $993;
       $995 = (14 - ($994))|0;
       $996 = $990 << $993;
       $997 = $996 >>> 15;
       $998 = (($995) + ($997))|0;
       $999 = $998 << 1;
       $1000 = (($998) + 7)|0;
       $1001 = $958 >>> $1000;
       $1002 = $1001 & 1;
       $1003 = $1002 | $999;
       $$0212$i$i = $1003;
      }
     }
     $1004 = (7064 + ($$0212$i$i<<2)|0);
     $1005 = ((($627)) + 28|0);
     HEAP32[$1005>>2] = $$0212$i$i;
     $1006 = ((($627)) + 20|0);
     HEAP32[$1006>>2] = 0;
     HEAP32[$931>>2] = 0;
     $1007 = HEAP32[(6764)>>2]|0;
     $1008 = 1 << $$0212$i$i;
     $1009 = $1007 & $1008;
     $1010 = ($1009|0)==(0);
     if ($1010) {
      $1011 = $1007 | $1008;
      HEAP32[(6764)>>2] = $1011;
      HEAP32[$1004>>2] = $627;
      $1012 = ((($627)) + 24|0);
      HEAP32[$1012>>2] = $1004;
      $1013 = ((($627)) + 12|0);
      HEAP32[$1013>>2] = $627;
      $1014 = ((($627)) + 8|0);
      HEAP32[$1014>>2] = $627;
      break;
     }
     $1015 = HEAP32[$1004>>2]|0;
     $1016 = ($$0212$i$i|0)==(31);
     $1017 = $$0212$i$i >>> 1;
     $1018 = (25 - ($1017))|0;
     $1019 = $1016 ? 0 : $1018;
     $1020 = $958 << $1019;
     $$0206$i$i = $1020;$$0207$i$i = $1015;
     while(1) {
      $1021 = ((($$0207$i$i)) + 4|0);
      $1022 = HEAP32[$1021>>2]|0;
      $1023 = $1022 & -8;
      $1024 = ($1023|0)==($958|0);
      if ($1024) {
       label = 304;
       break;
      }
      $1025 = $$0206$i$i >>> 31;
      $1026 = (((($$0207$i$i)) + 16|0) + ($1025<<2)|0);
      $1027 = $$0206$i$i << 1;
      $1028 = HEAP32[$1026>>2]|0;
      $1029 = ($1028|0)==(0|0);
      if ($1029) {
       label = 301;
       break;
      } else {
       $$0206$i$i = $1027;$$0207$i$i = $1028;
      }
     }
     if ((label|0) == 301) {
      $1030 = HEAP32[(6776)>>2]|0;
      $1031 = ($1026>>>0)<($1030>>>0);
      if ($1031) {
       _abort();
       // unreachable;
      } else {
       HEAP32[$1026>>2] = $627;
       $1032 = ((($627)) + 24|0);
       HEAP32[$1032>>2] = $$0207$i$i;
       $1033 = ((($627)) + 12|0);
       HEAP32[$1033>>2] = $627;
       $1034 = ((($627)) + 8|0);
       HEAP32[$1034>>2] = $627;
       break;
      }
     }
     else if ((label|0) == 304) {
      $1035 = ((($$0207$i$i)) + 8|0);
      $1036 = HEAP32[$1035>>2]|0;
      $1037 = HEAP32[(6776)>>2]|0;
      $1038 = ($1036>>>0)>=($1037>>>0);
      $not$$i$i = ($$0207$i$i>>>0)>=($1037>>>0);
      $1039 = $1038 & $not$$i$i;
      if ($1039) {
       $1040 = ((($1036)) + 12|0);
       HEAP32[$1040>>2] = $627;
       HEAP32[$1035>>2] = $627;
       $1041 = ((($627)) + 8|0);
       HEAP32[$1041>>2] = $1036;
       $1042 = ((($627)) + 12|0);
       HEAP32[$1042>>2] = $$0207$i$i;
       $1043 = ((($627)) + 24|0);
       HEAP32[$1043>>2] = 0;
       break;
      } else {
       _abort();
       // unreachable;
      }
     }
    }
   }
  } while(0);
  $1045 = HEAP32[(6772)>>2]|0;
  $1046 = ($1045>>>0)>($$0197>>>0);
  if ($1046) {
   $1047 = (($1045) - ($$0197))|0;
   HEAP32[(6772)>>2] = $1047;
   $1048 = HEAP32[(6784)>>2]|0;
   $1049 = (($1048) + ($$0197)|0);
   HEAP32[(6784)>>2] = $1049;
   $1050 = $1047 | 1;
   $1051 = ((($1049)) + 4|0);
   HEAP32[$1051>>2] = $1050;
   $1052 = $$0197 | 3;
   $1053 = ((($1048)) + 4|0);
   HEAP32[$1053>>2] = $1052;
   $1054 = ((($1048)) + 8|0);
   $$0 = $1054;
   STACKTOP = sp;return ($$0|0);
  }
 }
 $1055 = (___errno_location()|0);
 HEAP32[$1055>>2] = 12;
 $$0 = 0;
 STACKTOP = sp;return ($$0|0);
}
function _free($0) {
 $0 = $0|0;
 var $$0211$i = 0, $$0211$in$i = 0, $$0381 = 0, $$0382 = 0, $$0394 = 0, $$0401 = 0, $$1 = 0, $$1380 = 0, $$1385 = 0, $$1388 = 0, $$1396 = 0, $$1400 = 0, $$2 = 0, $$3 = 0, $$3398 = 0, $$pre = 0, $$pre$phi439Z2D = 0, $$pre$phi441Z2D = 0, $$pre$phiZ2D = 0, $$pre438 = 0;
 var $$pre440 = 0, $1 = 0, $10 = 0, $100 = 0, $101 = 0, $102 = 0, $103 = 0, $104 = 0, $105 = 0, $106 = 0, $107 = 0, $108 = 0, $109 = 0, $11 = 0, $110 = 0, $111 = 0, $112 = 0, $113 = 0, $114 = 0, $115 = 0;
 var $116 = 0, $117 = 0, $118 = 0, $119 = 0, $12 = 0, $120 = 0, $121 = 0, $122 = 0, $123 = 0, $124 = 0, $125 = 0, $126 = 0, $127 = 0, $128 = 0, $129 = 0, $13 = 0, $130 = 0, $131 = 0, $132 = 0, $133 = 0;
 var $134 = 0, $135 = 0, $136 = 0, $137 = 0, $138 = 0, $139 = 0, $14 = 0, $140 = 0, $141 = 0, $142 = 0, $143 = 0, $144 = 0, $145 = 0, $146 = 0, $147 = 0, $148 = 0, $149 = 0, $15 = 0, $150 = 0, $151 = 0;
 var $152 = 0, $153 = 0, $154 = 0, $155 = 0, $156 = 0, $157 = 0, $158 = 0, $159 = 0, $16 = 0, $160 = 0, $161 = 0, $162 = 0, $163 = 0, $164 = 0, $165 = 0, $166 = 0, $167 = 0, $168 = 0, $169 = 0, $17 = 0;
 var $170 = 0, $171 = 0, $172 = 0, $173 = 0, $174 = 0, $175 = 0, $176 = 0, $177 = 0, $178 = 0, $179 = 0, $18 = 0, $180 = 0, $181 = 0, $182 = 0, $183 = 0, $184 = 0, $185 = 0, $186 = 0, $187 = 0, $188 = 0;
 var $189 = 0, $19 = 0, $190 = 0, $191 = 0, $192 = 0, $193 = 0, $194 = 0, $195 = 0, $196 = 0, $197 = 0, $198 = 0, $199 = 0, $2 = 0, $20 = 0, $200 = 0, $201 = 0, $202 = 0, $203 = 0, $204 = 0, $205 = 0;
 var $206 = 0, $207 = 0, $208 = 0, $209 = 0, $21 = 0, $210 = 0, $211 = 0, $212 = 0, $213 = 0, $214 = 0, $215 = 0, $216 = 0, $217 = 0, $218 = 0, $219 = 0, $22 = 0, $220 = 0, $221 = 0, $222 = 0, $223 = 0;
 var $224 = 0, $225 = 0, $226 = 0, $227 = 0, $228 = 0, $229 = 0, $23 = 0, $230 = 0, $231 = 0, $232 = 0, $233 = 0, $234 = 0, $235 = 0, $236 = 0, $237 = 0, $238 = 0, $239 = 0, $24 = 0, $240 = 0, $241 = 0;
 var $242 = 0, $243 = 0, $244 = 0, $245 = 0, $246 = 0, $247 = 0, $248 = 0, $249 = 0, $25 = 0, $250 = 0, $251 = 0, $252 = 0, $253 = 0, $254 = 0, $255 = 0, $256 = 0, $257 = 0, $258 = 0, $259 = 0, $26 = 0;
 var $260 = 0, $261 = 0, $262 = 0, $263 = 0, $264 = 0, $265 = 0, $266 = 0, $267 = 0, $268 = 0, $269 = 0, $27 = 0, $270 = 0, $271 = 0, $272 = 0, $273 = 0, $274 = 0, $275 = 0, $276 = 0, $277 = 0, $278 = 0;
 var $279 = 0, $28 = 0, $280 = 0, $281 = 0, $282 = 0, $283 = 0, $284 = 0, $285 = 0, $286 = 0, $287 = 0, $288 = 0, $289 = 0, $29 = 0, $290 = 0, $291 = 0, $292 = 0, $293 = 0, $294 = 0, $295 = 0, $296 = 0;
 var $297 = 0, $298 = 0, $299 = 0, $3 = 0, $30 = 0, $300 = 0, $301 = 0, $302 = 0, $303 = 0, $304 = 0, $305 = 0, $306 = 0, $307 = 0, $308 = 0, $309 = 0, $31 = 0, $310 = 0, $311 = 0, $312 = 0, $313 = 0;
 var $314 = 0, $315 = 0, $316 = 0, $317 = 0, $318 = 0, $319 = 0, $32 = 0, $320 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0, $41 = 0, $42 = 0, $43 = 0;
 var $44 = 0, $45 = 0, $46 = 0, $47 = 0, $48 = 0, $49 = 0, $5 = 0, $50 = 0, $51 = 0, $52 = 0, $53 = 0, $54 = 0, $55 = 0, $56 = 0, $57 = 0, $58 = 0, $59 = 0, $6 = 0, $60 = 0, $61 = 0;
 var $62 = 0, $63 = 0, $64 = 0, $65 = 0, $66 = 0, $67 = 0, $68 = 0, $69 = 0, $7 = 0, $70 = 0, $71 = 0, $72 = 0, $73 = 0, $74 = 0, $75 = 0, $76 = 0, $77 = 0, $78 = 0, $79 = 0, $8 = 0;
 var $80 = 0, $81 = 0, $82 = 0, $83 = 0, $84 = 0, $85 = 0, $86 = 0, $87 = 0, $88 = 0, $89 = 0, $9 = 0, $90 = 0, $91 = 0, $92 = 0, $93 = 0, $94 = 0, $95 = 0, $96 = 0, $97 = 0, $98 = 0;
 var $99 = 0, $cond418 = 0, $cond419 = 0, $not$ = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $1 = ($0|0)==(0|0);
 if ($1) {
  return;
 }
 $2 = ((($0)) + -8|0);
 $3 = HEAP32[(6776)>>2]|0;
 $4 = ($2>>>0)<($3>>>0);
 if ($4) {
  _abort();
  // unreachable;
 }
 $5 = ((($0)) + -4|0);
 $6 = HEAP32[$5>>2]|0;
 $7 = $6 & 3;
 $8 = ($7|0)==(1);
 if ($8) {
  _abort();
  // unreachable;
 }
 $9 = $6 & -8;
 $10 = (($2) + ($9)|0);
 $11 = $6 & 1;
 $12 = ($11|0)==(0);
 do {
  if ($12) {
   $13 = HEAP32[$2>>2]|0;
   $14 = ($7|0)==(0);
   if ($14) {
    return;
   }
   $15 = (0 - ($13))|0;
   $16 = (($2) + ($15)|0);
   $17 = (($13) + ($9))|0;
   $18 = ($16>>>0)<($3>>>0);
   if ($18) {
    _abort();
    // unreachable;
   }
   $19 = HEAP32[(6780)>>2]|0;
   $20 = ($16|0)==($19|0);
   if ($20) {
    $105 = ((($10)) + 4|0);
    $106 = HEAP32[$105>>2]|0;
    $107 = $106 & 3;
    $108 = ($107|0)==(3);
    if (!($108)) {
     $$1 = $16;$$1380 = $17;
     break;
    }
    HEAP32[(6768)>>2] = $17;
    $109 = $106 & -2;
    HEAP32[$105>>2] = $109;
    $110 = $17 | 1;
    $111 = ((($16)) + 4|0);
    HEAP32[$111>>2] = $110;
    $112 = (($16) + ($17)|0);
    HEAP32[$112>>2] = $17;
    return;
   }
   $21 = $13 >>> 3;
   $22 = ($13>>>0)<(256);
   if ($22) {
    $23 = ((($16)) + 8|0);
    $24 = HEAP32[$23>>2]|0;
    $25 = ((($16)) + 12|0);
    $26 = HEAP32[$25>>2]|0;
    $27 = $21 << 1;
    $28 = (6800 + ($27<<2)|0);
    $29 = ($24|0)==($28|0);
    if (!($29)) {
     $30 = ($24>>>0)<($3>>>0);
     if ($30) {
      _abort();
      // unreachable;
     }
     $31 = ((($24)) + 12|0);
     $32 = HEAP32[$31>>2]|0;
     $33 = ($32|0)==($16|0);
     if (!($33)) {
      _abort();
      // unreachable;
     }
    }
    $34 = ($26|0)==($24|0);
    if ($34) {
     $35 = 1 << $21;
     $36 = $35 ^ -1;
     $37 = HEAP32[1690]|0;
     $38 = $37 & $36;
     HEAP32[1690] = $38;
     $$1 = $16;$$1380 = $17;
     break;
    }
    $39 = ($26|0)==($28|0);
    if ($39) {
     $$pre440 = ((($26)) + 8|0);
     $$pre$phi441Z2D = $$pre440;
    } else {
     $40 = ($26>>>0)<($3>>>0);
     if ($40) {
      _abort();
      // unreachable;
     }
     $41 = ((($26)) + 8|0);
     $42 = HEAP32[$41>>2]|0;
     $43 = ($42|0)==($16|0);
     if ($43) {
      $$pre$phi441Z2D = $41;
     } else {
      _abort();
      // unreachable;
     }
    }
    $44 = ((($24)) + 12|0);
    HEAP32[$44>>2] = $26;
    HEAP32[$$pre$phi441Z2D>>2] = $24;
    $$1 = $16;$$1380 = $17;
    break;
   }
   $45 = ((($16)) + 24|0);
   $46 = HEAP32[$45>>2]|0;
   $47 = ((($16)) + 12|0);
   $48 = HEAP32[$47>>2]|0;
   $49 = ($48|0)==($16|0);
   do {
    if ($49) {
     $59 = ((($16)) + 16|0);
     $60 = ((($59)) + 4|0);
     $61 = HEAP32[$60>>2]|0;
     $62 = ($61|0)==(0|0);
     if ($62) {
      $63 = HEAP32[$59>>2]|0;
      $64 = ($63|0)==(0|0);
      if ($64) {
       $$3 = 0;
       break;
      } else {
       $$1385 = $63;$$1388 = $59;
      }
     } else {
      $$1385 = $61;$$1388 = $60;
     }
     while(1) {
      $65 = ((($$1385)) + 20|0);
      $66 = HEAP32[$65>>2]|0;
      $67 = ($66|0)==(0|0);
      if (!($67)) {
       $$1385 = $66;$$1388 = $65;
       continue;
      }
      $68 = ((($$1385)) + 16|0);
      $69 = HEAP32[$68>>2]|0;
      $70 = ($69|0)==(0|0);
      if ($70) {
       break;
      } else {
       $$1385 = $69;$$1388 = $68;
      }
     }
     $71 = ($$1388>>>0)<($3>>>0);
     if ($71) {
      _abort();
      // unreachable;
     } else {
      HEAP32[$$1388>>2] = 0;
      $$3 = $$1385;
      break;
     }
    } else {
     $50 = ((($16)) + 8|0);
     $51 = HEAP32[$50>>2]|0;
     $52 = ($51>>>0)<($3>>>0);
     if ($52) {
      _abort();
      // unreachable;
     }
     $53 = ((($51)) + 12|0);
     $54 = HEAP32[$53>>2]|0;
     $55 = ($54|0)==($16|0);
     if (!($55)) {
      _abort();
      // unreachable;
     }
     $56 = ((($48)) + 8|0);
     $57 = HEAP32[$56>>2]|0;
     $58 = ($57|0)==($16|0);
     if ($58) {
      HEAP32[$53>>2] = $48;
      HEAP32[$56>>2] = $51;
      $$3 = $48;
      break;
     } else {
      _abort();
      // unreachable;
     }
    }
   } while(0);
   $72 = ($46|0)==(0|0);
   if ($72) {
    $$1 = $16;$$1380 = $17;
   } else {
    $73 = ((($16)) + 28|0);
    $74 = HEAP32[$73>>2]|0;
    $75 = (7064 + ($74<<2)|0);
    $76 = HEAP32[$75>>2]|0;
    $77 = ($16|0)==($76|0);
    if ($77) {
     HEAP32[$75>>2] = $$3;
     $cond418 = ($$3|0)==(0|0);
     if ($cond418) {
      $78 = 1 << $74;
      $79 = $78 ^ -1;
      $80 = HEAP32[(6764)>>2]|0;
      $81 = $80 & $79;
      HEAP32[(6764)>>2] = $81;
      $$1 = $16;$$1380 = $17;
      break;
     }
    } else {
     $82 = HEAP32[(6776)>>2]|0;
     $83 = ($46>>>0)<($82>>>0);
     if ($83) {
      _abort();
      // unreachable;
     }
     $84 = ((($46)) + 16|0);
     $85 = HEAP32[$84>>2]|0;
     $86 = ($85|0)==($16|0);
     if ($86) {
      HEAP32[$84>>2] = $$3;
     } else {
      $87 = ((($46)) + 20|0);
      HEAP32[$87>>2] = $$3;
     }
     $88 = ($$3|0)==(0|0);
     if ($88) {
      $$1 = $16;$$1380 = $17;
      break;
     }
    }
    $89 = HEAP32[(6776)>>2]|0;
    $90 = ($$3>>>0)<($89>>>0);
    if ($90) {
     _abort();
     // unreachable;
    }
    $91 = ((($$3)) + 24|0);
    HEAP32[$91>>2] = $46;
    $92 = ((($16)) + 16|0);
    $93 = HEAP32[$92>>2]|0;
    $94 = ($93|0)==(0|0);
    do {
     if (!($94)) {
      $95 = ($93>>>0)<($89>>>0);
      if ($95) {
       _abort();
       // unreachable;
      } else {
       $96 = ((($$3)) + 16|0);
       HEAP32[$96>>2] = $93;
       $97 = ((($93)) + 24|0);
       HEAP32[$97>>2] = $$3;
       break;
      }
     }
    } while(0);
    $98 = ((($92)) + 4|0);
    $99 = HEAP32[$98>>2]|0;
    $100 = ($99|0)==(0|0);
    if ($100) {
     $$1 = $16;$$1380 = $17;
    } else {
     $101 = HEAP32[(6776)>>2]|0;
     $102 = ($99>>>0)<($101>>>0);
     if ($102) {
      _abort();
      // unreachable;
     } else {
      $103 = ((($$3)) + 20|0);
      HEAP32[$103>>2] = $99;
      $104 = ((($99)) + 24|0);
      HEAP32[$104>>2] = $$3;
      $$1 = $16;$$1380 = $17;
      break;
     }
    }
   }
  } else {
   $$1 = $2;$$1380 = $9;
  }
 } while(0);
 $113 = ($$1>>>0)<($10>>>0);
 if (!($113)) {
  _abort();
  // unreachable;
 }
 $114 = ((($10)) + 4|0);
 $115 = HEAP32[$114>>2]|0;
 $116 = $115 & 1;
 $117 = ($116|0)==(0);
 if ($117) {
  _abort();
  // unreachable;
 }
 $118 = $115 & 2;
 $119 = ($118|0)==(0);
 if ($119) {
  $120 = HEAP32[(6784)>>2]|0;
  $121 = ($10|0)==($120|0);
  if ($121) {
   $122 = HEAP32[(6772)>>2]|0;
   $123 = (($122) + ($$1380))|0;
   HEAP32[(6772)>>2] = $123;
   HEAP32[(6784)>>2] = $$1;
   $124 = $123 | 1;
   $125 = ((($$1)) + 4|0);
   HEAP32[$125>>2] = $124;
   $126 = HEAP32[(6780)>>2]|0;
   $127 = ($$1|0)==($126|0);
   if (!($127)) {
    return;
   }
   HEAP32[(6780)>>2] = 0;
   HEAP32[(6768)>>2] = 0;
   return;
  }
  $128 = HEAP32[(6780)>>2]|0;
  $129 = ($10|0)==($128|0);
  if ($129) {
   $130 = HEAP32[(6768)>>2]|0;
   $131 = (($130) + ($$1380))|0;
   HEAP32[(6768)>>2] = $131;
   HEAP32[(6780)>>2] = $$1;
   $132 = $131 | 1;
   $133 = ((($$1)) + 4|0);
   HEAP32[$133>>2] = $132;
   $134 = (($$1) + ($131)|0);
   HEAP32[$134>>2] = $131;
   return;
  }
  $135 = $115 & -8;
  $136 = (($135) + ($$1380))|0;
  $137 = $115 >>> 3;
  $138 = ($115>>>0)<(256);
  do {
   if ($138) {
    $139 = ((($10)) + 8|0);
    $140 = HEAP32[$139>>2]|0;
    $141 = ((($10)) + 12|0);
    $142 = HEAP32[$141>>2]|0;
    $143 = $137 << 1;
    $144 = (6800 + ($143<<2)|0);
    $145 = ($140|0)==($144|0);
    if (!($145)) {
     $146 = HEAP32[(6776)>>2]|0;
     $147 = ($140>>>0)<($146>>>0);
     if ($147) {
      _abort();
      // unreachable;
     }
     $148 = ((($140)) + 12|0);
     $149 = HEAP32[$148>>2]|0;
     $150 = ($149|0)==($10|0);
     if (!($150)) {
      _abort();
      // unreachable;
     }
    }
    $151 = ($142|0)==($140|0);
    if ($151) {
     $152 = 1 << $137;
     $153 = $152 ^ -1;
     $154 = HEAP32[1690]|0;
     $155 = $154 & $153;
     HEAP32[1690] = $155;
     break;
    }
    $156 = ($142|0)==($144|0);
    if ($156) {
     $$pre438 = ((($142)) + 8|0);
     $$pre$phi439Z2D = $$pre438;
    } else {
     $157 = HEAP32[(6776)>>2]|0;
     $158 = ($142>>>0)<($157>>>0);
     if ($158) {
      _abort();
      // unreachable;
     }
     $159 = ((($142)) + 8|0);
     $160 = HEAP32[$159>>2]|0;
     $161 = ($160|0)==($10|0);
     if ($161) {
      $$pre$phi439Z2D = $159;
     } else {
      _abort();
      // unreachable;
     }
    }
    $162 = ((($140)) + 12|0);
    HEAP32[$162>>2] = $142;
    HEAP32[$$pre$phi439Z2D>>2] = $140;
   } else {
    $163 = ((($10)) + 24|0);
    $164 = HEAP32[$163>>2]|0;
    $165 = ((($10)) + 12|0);
    $166 = HEAP32[$165>>2]|0;
    $167 = ($166|0)==($10|0);
    do {
     if ($167) {
      $178 = ((($10)) + 16|0);
      $179 = ((($178)) + 4|0);
      $180 = HEAP32[$179>>2]|0;
      $181 = ($180|0)==(0|0);
      if ($181) {
       $182 = HEAP32[$178>>2]|0;
       $183 = ($182|0)==(0|0);
       if ($183) {
        $$3398 = 0;
        break;
       } else {
        $$1396 = $182;$$1400 = $178;
       }
      } else {
       $$1396 = $180;$$1400 = $179;
      }
      while(1) {
       $184 = ((($$1396)) + 20|0);
       $185 = HEAP32[$184>>2]|0;
       $186 = ($185|0)==(0|0);
       if (!($186)) {
        $$1396 = $185;$$1400 = $184;
        continue;
       }
       $187 = ((($$1396)) + 16|0);
       $188 = HEAP32[$187>>2]|0;
       $189 = ($188|0)==(0|0);
       if ($189) {
        break;
       } else {
        $$1396 = $188;$$1400 = $187;
       }
      }
      $190 = HEAP32[(6776)>>2]|0;
      $191 = ($$1400>>>0)<($190>>>0);
      if ($191) {
       _abort();
       // unreachable;
      } else {
       HEAP32[$$1400>>2] = 0;
       $$3398 = $$1396;
       break;
      }
     } else {
      $168 = ((($10)) + 8|0);
      $169 = HEAP32[$168>>2]|0;
      $170 = HEAP32[(6776)>>2]|0;
      $171 = ($169>>>0)<($170>>>0);
      if ($171) {
       _abort();
       // unreachable;
      }
      $172 = ((($169)) + 12|0);
      $173 = HEAP32[$172>>2]|0;
      $174 = ($173|0)==($10|0);
      if (!($174)) {
       _abort();
       // unreachable;
      }
      $175 = ((($166)) + 8|0);
      $176 = HEAP32[$175>>2]|0;
      $177 = ($176|0)==($10|0);
      if ($177) {
       HEAP32[$172>>2] = $166;
       HEAP32[$175>>2] = $169;
       $$3398 = $166;
       break;
      } else {
       _abort();
       // unreachable;
      }
     }
    } while(0);
    $192 = ($164|0)==(0|0);
    if (!($192)) {
     $193 = ((($10)) + 28|0);
     $194 = HEAP32[$193>>2]|0;
     $195 = (7064 + ($194<<2)|0);
     $196 = HEAP32[$195>>2]|0;
     $197 = ($10|0)==($196|0);
     if ($197) {
      HEAP32[$195>>2] = $$3398;
      $cond419 = ($$3398|0)==(0|0);
      if ($cond419) {
       $198 = 1 << $194;
       $199 = $198 ^ -1;
       $200 = HEAP32[(6764)>>2]|0;
       $201 = $200 & $199;
       HEAP32[(6764)>>2] = $201;
       break;
      }
     } else {
      $202 = HEAP32[(6776)>>2]|0;
      $203 = ($164>>>0)<($202>>>0);
      if ($203) {
       _abort();
       // unreachable;
      }
      $204 = ((($164)) + 16|0);
      $205 = HEAP32[$204>>2]|0;
      $206 = ($205|0)==($10|0);
      if ($206) {
       HEAP32[$204>>2] = $$3398;
      } else {
       $207 = ((($164)) + 20|0);
       HEAP32[$207>>2] = $$3398;
      }
      $208 = ($$3398|0)==(0|0);
      if ($208) {
       break;
      }
     }
     $209 = HEAP32[(6776)>>2]|0;
     $210 = ($$3398>>>0)<($209>>>0);
     if ($210) {
      _abort();
      // unreachable;
     }
     $211 = ((($$3398)) + 24|0);
     HEAP32[$211>>2] = $164;
     $212 = ((($10)) + 16|0);
     $213 = HEAP32[$212>>2]|0;
     $214 = ($213|0)==(0|0);
     do {
      if (!($214)) {
       $215 = ($213>>>0)<($209>>>0);
       if ($215) {
        _abort();
        // unreachable;
       } else {
        $216 = ((($$3398)) + 16|0);
        HEAP32[$216>>2] = $213;
        $217 = ((($213)) + 24|0);
        HEAP32[$217>>2] = $$3398;
        break;
       }
      }
     } while(0);
     $218 = ((($212)) + 4|0);
     $219 = HEAP32[$218>>2]|0;
     $220 = ($219|0)==(0|0);
     if (!($220)) {
      $221 = HEAP32[(6776)>>2]|0;
      $222 = ($219>>>0)<($221>>>0);
      if ($222) {
       _abort();
       // unreachable;
      } else {
       $223 = ((($$3398)) + 20|0);
       HEAP32[$223>>2] = $219;
       $224 = ((($219)) + 24|0);
       HEAP32[$224>>2] = $$3398;
       break;
      }
     }
    }
   }
  } while(0);
  $225 = $136 | 1;
  $226 = ((($$1)) + 4|0);
  HEAP32[$226>>2] = $225;
  $227 = (($$1) + ($136)|0);
  HEAP32[$227>>2] = $136;
  $228 = HEAP32[(6780)>>2]|0;
  $229 = ($$1|0)==($228|0);
  if ($229) {
   HEAP32[(6768)>>2] = $136;
   return;
  } else {
   $$2 = $136;
  }
 } else {
  $230 = $115 & -2;
  HEAP32[$114>>2] = $230;
  $231 = $$1380 | 1;
  $232 = ((($$1)) + 4|0);
  HEAP32[$232>>2] = $231;
  $233 = (($$1) + ($$1380)|0);
  HEAP32[$233>>2] = $$1380;
  $$2 = $$1380;
 }
 $234 = $$2 >>> 3;
 $235 = ($$2>>>0)<(256);
 if ($235) {
  $236 = $234 << 1;
  $237 = (6800 + ($236<<2)|0);
  $238 = HEAP32[1690]|0;
  $239 = 1 << $234;
  $240 = $238 & $239;
  $241 = ($240|0)==(0);
  if ($241) {
   $242 = $238 | $239;
   HEAP32[1690] = $242;
   $$pre = ((($237)) + 8|0);
   $$0401 = $237;$$pre$phiZ2D = $$pre;
  } else {
   $243 = ((($237)) + 8|0);
   $244 = HEAP32[$243>>2]|0;
   $245 = HEAP32[(6776)>>2]|0;
   $246 = ($244>>>0)<($245>>>0);
   if ($246) {
    _abort();
    // unreachable;
   } else {
    $$0401 = $244;$$pre$phiZ2D = $243;
   }
  }
  HEAP32[$$pre$phiZ2D>>2] = $$1;
  $247 = ((($$0401)) + 12|0);
  HEAP32[$247>>2] = $$1;
  $248 = ((($$1)) + 8|0);
  HEAP32[$248>>2] = $$0401;
  $249 = ((($$1)) + 12|0);
  HEAP32[$249>>2] = $237;
  return;
 }
 $250 = $$2 >>> 8;
 $251 = ($250|0)==(0);
 if ($251) {
  $$0394 = 0;
 } else {
  $252 = ($$2>>>0)>(16777215);
  if ($252) {
   $$0394 = 31;
  } else {
   $253 = (($250) + 1048320)|0;
   $254 = $253 >>> 16;
   $255 = $254 & 8;
   $256 = $250 << $255;
   $257 = (($256) + 520192)|0;
   $258 = $257 >>> 16;
   $259 = $258 & 4;
   $260 = $259 | $255;
   $261 = $256 << $259;
   $262 = (($261) + 245760)|0;
   $263 = $262 >>> 16;
   $264 = $263 & 2;
   $265 = $260 | $264;
   $266 = (14 - ($265))|0;
   $267 = $261 << $264;
   $268 = $267 >>> 15;
   $269 = (($266) + ($268))|0;
   $270 = $269 << 1;
   $271 = (($269) + 7)|0;
   $272 = $$2 >>> $271;
   $273 = $272 & 1;
   $274 = $273 | $270;
   $$0394 = $274;
  }
 }
 $275 = (7064 + ($$0394<<2)|0);
 $276 = ((($$1)) + 28|0);
 HEAP32[$276>>2] = $$0394;
 $277 = ((($$1)) + 16|0);
 $278 = ((($$1)) + 20|0);
 HEAP32[$278>>2] = 0;
 HEAP32[$277>>2] = 0;
 $279 = HEAP32[(6764)>>2]|0;
 $280 = 1 << $$0394;
 $281 = $279 & $280;
 $282 = ($281|0)==(0);
 do {
  if ($282) {
   $283 = $279 | $280;
   HEAP32[(6764)>>2] = $283;
   HEAP32[$275>>2] = $$1;
   $284 = ((($$1)) + 24|0);
   HEAP32[$284>>2] = $275;
   $285 = ((($$1)) + 12|0);
   HEAP32[$285>>2] = $$1;
   $286 = ((($$1)) + 8|0);
   HEAP32[$286>>2] = $$1;
  } else {
   $287 = HEAP32[$275>>2]|0;
   $288 = ($$0394|0)==(31);
   $289 = $$0394 >>> 1;
   $290 = (25 - ($289))|0;
   $291 = $288 ? 0 : $290;
   $292 = $$2 << $291;
   $$0381 = $292;$$0382 = $287;
   while(1) {
    $293 = ((($$0382)) + 4|0);
    $294 = HEAP32[$293>>2]|0;
    $295 = $294 & -8;
    $296 = ($295|0)==($$2|0);
    if ($296) {
     label = 130;
     break;
    }
    $297 = $$0381 >>> 31;
    $298 = (((($$0382)) + 16|0) + ($297<<2)|0);
    $299 = $$0381 << 1;
    $300 = HEAP32[$298>>2]|0;
    $301 = ($300|0)==(0|0);
    if ($301) {
     label = 127;
     break;
    } else {
     $$0381 = $299;$$0382 = $300;
    }
   }
   if ((label|0) == 127) {
    $302 = HEAP32[(6776)>>2]|0;
    $303 = ($298>>>0)<($302>>>0);
    if ($303) {
     _abort();
     // unreachable;
    } else {
     HEAP32[$298>>2] = $$1;
     $304 = ((($$1)) + 24|0);
     HEAP32[$304>>2] = $$0382;
     $305 = ((($$1)) + 12|0);
     HEAP32[$305>>2] = $$1;
     $306 = ((($$1)) + 8|0);
     HEAP32[$306>>2] = $$1;
     break;
    }
   }
   else if ((label|0) == 130) {
    $307 = ((($$0382)) + 8|0);
    $308 = HEAP32[$307>>2]|0;
    $309 = HEAP32[(6776)>>2]|0;
    $310 = ($308>>>0)>=($309>>>0);
    $not$ = ($$0382>>>0)>=($309>>>0);
    $311 = $310 & $not$;
    if ($311) {
     $312 = ((($308)) + 12|0);
     HEAP32[$312>>2] = $$1;
     HEAP32[$307>>2] = $$1;
     $313 = ((($$1)) + 8|0);
     HEAP32[$313>>2] = $308;
     $314 = ((($$1)) + 12|0);
     HEAP32[$314>>2] = $$0382;
     $315 = ((($$1)) + 24|0);
     HEAP32[$315>>2] = 0;
     break;
    } else {
     _abort();
     // unreachable;
    }
   }
  }
 } while(0);
 $316 = HEAP32[(6792)>>2]|0;
 $317 = (($316) + -1)|0;
 HEAP32[(6792)>>2] = $317;
 $318 = ($317|0)==(0);
 if ($318) {
  $$0211$in$i = (7216);
 } else {
  return;
 }
 while(1) {
  $$0211$i = HEAP32[$$0211$in$i>>2]|0;
  $319 = ($$0211$i|0)==(0|0);
  $320 = ((($$0211$i)) + 8|0);
  if ($319) {
   break;
  } else {
   $$0211$in$i = $320;
  }
 }
 HEAP32[(6792)>>2] = -1;
 return;
}
function __ZNSt3__26__sortIRNS_6__lessIxxEEPxEEvT0_S5_T_($0,$1,$2) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 var $$$0174 = 0, $$0 = 0, $$0$ph = 0, $$0154 = 0, $$0160 = 0, $$0167 = 0, $$0174 = 0, $$0180$ph = 0, $$1 = 0, $$1155 = 0, $$1161 = 0, $$2156 = 0, $$2162 = 0, $$2176 = 0, $$3157 = 0, $$3163 = 0, $$3170 = 0, $$4158 = 0, $$4164 = 0, $$4171 = 0;
 var $$5159 = 0, $$5165 = 0, $$5172 = 0, $$6166 = 0, $$6173 = 0, $10 = 0, $100 = 0, $101 = 0, $102 = 0, $103 = 0, $104 = 0, $105 = 0, $106 = 0, $107 = 0, $108 = 0, $109 = 0, $11 = 0, $110 = 0, $111 = 0, $112 = 0;
 var $113 = 0, $114 = 0, $115 = 0, $116 = 0, $117 = 0, $118 = 0, $119 = 0, $12 = 0, $120 = 0, $121 = 0, $122 = 0, $123 = 0, $124 = 0, $125 = 0, $126 = 0, $127 = 0, $128 = 0, $129 = 0, $13 = 0, $130 = 0;
 var $131 = 0, $132 = 0, $133 = 0, $134 = 0, $135 = 0, $136 = 0, $137 = 0, $138 = 0, $139 = 0, $14 = 0, $140 = 0, $141 = 0, $142 = 0, $143 = 0, $144 = 0, $145 = 0, $146 = 0, $147 = 0, $148 = 0, $149 = 0;
 var $15 = 0, $150 = 0, $151 = 0, $152 = 0, $153 = 0, $154 = 0, $155 = 0, $156 = 0, $157 = 0, $158 = 0, $159 = 0, $16 = 0, $160 = 0, $161 = 0, $162 = 0, $163 = 0, $164 = 0, $165 = 0, $166 = 0, $167 = 0;
 var $168 = 0, $169 = 0, $17 = 0, $170 = 0, $171 = 0, $172 = 0, $173 = 0, $174 = 0, $175 = 0, $176 = 0, $177 = 0, $178 = 0, $179 = 0, $18 = 0, $180 = 0, $181 = 0, $182 = 0, $183 = 0, $184 = 0, $185 = 0;
 var $186 = 0, $187 = 0, $188 = 0, $189 = 0, $19 = 0, $190 = 0, $191 = 0, $192 = 0, $193 = 0, $194 = 0, $195 = 0, $196 = 0, $197 = 0, $198 = 0, $199 = 0, $20 = 0, $200 = 0, $201 = 0, $202 = 0, $203 = 0;
 var $204 = 0, $205 = 0, $206 = 0, $207 = 0, $208 = 0, $209 = 0, $21 = 0, $210 = 0, $211 = 0, $212 = 0, $213 = 0, $214 = 0, $215 = 0, $216 = 0, $217 = 0, $218 = 0, $219 = 0, $22 = 0, $220 = 0, $221 = 0;
 var $222 = 0, $223 = 0, $224 = 0, $225 = 0, $226 = 0, $227 = 0, $228 = 0, $229 = 0, $23 = 0, $230 = 0, $231 = 0, $232 = 0, $233 = 0, $234 = 0, $235 = 0, $236 = 0, $237 = 0, $238 = 0, $239 = 0, $24 = 0;
 var $240 = 0, $25 = 0, $26 = 0, $27 = 0, $28 = 0, $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0, $41 = 0;
 var $42 = 0, $43 = 0, $44 = 0, $45 = 0, $46 = 0, $47 = 0, $48 = 0, $49 = 0, $5 = 0, $50 = 0, $51 = 0, $52 = 0, $53 = 0, $54 = 0, $55 = 0, $56 = 0, $57 = 0, $58 = 0, $59 = 0, $6 = 0;
 var $60 = 0, $61 = 0, $62 = 0, $63 = 0, $64 = 0, $65 = 0, $66 = 0, $67 = 0, $68 = 0, $69 = 0, $7 = 0, $70 = 0, $71 = 0, $72 = 0, $73 = 0, $74 = 0, $75 = 0, $76 = 0, $77 = 0, $78 = 0;
 var $79 = 0, $8 = 0, $80 = 0, $81 = 0, $82 = 0, $83 = 0, $84 = 0, $85 = 0, $86 = 0, $87 = 0, $88 = 0, $89 = 0, $9 = 0, $90 = 0, $91 = 0, $92 = 0, $93 = 0, $94 = 0, $95 = 0, $96 = 0;
 var $97 = 0, $98 = 0, $99 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $$0$ph = $0;$$0180$ph = $1;
 L1: while(1) {
  $3 = $$0180$ph;
  $4 = ((($$0180$ph)) + -8|0);
  $$0 = $$0$ph;
  while(1) {
   $$1 = $$0;
   L5: while(1) {
    $5 = $$1;
    $6 = (($3) - ($5))|0;
    $7 = $6 >> 3;
    switch ($7|0) {
    case 1: case 0:  {
     break L1;
     break;
    }
    case 2:  {
     label = 5;
     break L1;
     break;
    }
    case 3:  {
     label = 7;
     break L1;
     break;
    }
    case 4:  {
     label = 8;
     break L1;
     break;
    }
    case 5:  {
     label = 9;
     break L1;
     break;
    }
    default: {
    }
    }
    $39 = ($6|0)<(248);
    if ($39) {
     label = 11;
     break L1;
    }
    $40 = ($6|0)>(7992);
    $41 = (($7|0) / 2)&-1;
    $42 = (($$1) + ($41<<3)|0);
    if ($40) {
     $43 = (($7|0) / 4)&-1;
     $44 = (($$1) + ($43<<3)|0);
     $45 = (($42) + ($43<<3)|0);
     $46 = (__ZNSt3__27__sort5IRNS_6__lessIxxEEPxEEjT0_S5_S5_S5_S5_T_($$1,$44,$42,$45,$4,$2)|0);
     $$0167 = $46;
    } else {
     $47 = (__ZNSt3__27__sort3IRNS_6__lessIxxEEPxEEjT0_S5_S5_T_($$1,$42,$4,$2)|0);
     $$0167 = $47;
    }
    $48 = $$1;
    $49 = $48;
    $50 = HEAP32[$49>>2]|0;
    $51 = (($48) + 4)|0;
    $52 = $51;
    $53 = HEAP32[$52>>2]|0;
    $54 = $42;
    $55 = $54;
    $56 = HEAP32[$55>>2]|0;
    $57 = (($54) + 4)|0;
    $58 = $57;
    $59 = HEAP32[$58>>2]|0;
    $60 = ($53|0)<($59|0);
    $61 = ($50>>>0)<($56>>>0);
    $62 = ($53|0)==($59|0);
    $63 = $62 & $61;
    $64 = $60 | $63;
    if ($64) {
     $$3157 = $4;$$3170 = $$0167;
     break;
    } else {
     $$0154 = $4;
    }
    while(1) {
     $65 = ((($$0154)) + -8|0);
     $66 = ($$1|0)==($65|0);
     if ($66) {
      break;
     }
     $141 = $65;
     $142 = $141;
     $143 = HEAP32[$142>>2]|0;
     $144 = (($141) + 4)|0;
     $145 = $144;
     $146 = HEAP32[$145>>2]|0;
     $147 = ($146|0)<($59|0);
     $148 = ($143>>>0)<($56>>>0);
     $149 = ($146|0)==($59|0);
     $150 = $149 & $148;
     $151 = $147 | $150;
     if ($151) {
      label = 29;
      break L5;
     } else {
      $$0154 = $65;
     }
    }
    $67 = ((($$1)) + 8|0);
    $68 = $4;
    $69 = $68;
    $70 = HEAP32[$69>>2]|0;
    $71 = (($68) + 4)|0;
    $72 = $71;
    $73 = HEAP32[$72>>2]|0;
    $74 = ($53|0)<($73|0);
    $75 = ($50>>>0)<($70>>>0);
    $76 = ($53|0)==($73|0);
    $77 = $76 & $75;
    $78 = $74 | $77;
    if ($78) {
     $$1161 = $67;
    } else {
     $$0160 = $67;
     while(1) {
      $79 = ($$0160|0)==($4|0);
      if ($79) {
       break L1;
      }
      $80 = $$0160;
      $81 = $80;
      $82 = HEAP32[$81>>2]|0;
      $83 = (($80) + 4)|0;
      $84 = $83;
      $85 = HEAP32[$84>>2]|0;
      $86 = ($53|0)<($85|0);
      $87 = ($50>>>0)<($82>>>0);
      $88 = ($53|0)==($85|0);
      $89 = $88 & $87;
      $90 = $86 | $89;
      if ($90) {
       break;
      }
      $100 = ((($$0160)) + 8|0);
      $$0160 = $100;
     }
     $91 = $$0160;
     $92 = $91;
     HEAP32[$92>>2] = $70;
     $93 = (($91) + 4)|0;
     $94 = $93;
     HEAP32[$94>>2] = $73;
     $95 = $4;
     $96 = $95;
     HEAP32[$96>>2] = $82;
     $97 = (($95) + 4)|0;
     $98 = $97;
     HEAP32[$98>>2] = $85;
     $99 = ((($$0160)) + 8|0);
     $$1161 = $99;
    }
    $101 = ($$1161|0)==($4|0);
    if ($101) {
     break L1;
    } else {
     $$1155 = $4;$$2162 = $$1161;
    }
    while(1) {
     $102 = $$1;
     $103 = $102;
     $104 = HEAP32[$103>>2]|0;
     $105 = (($102) + 4)|0;
     $106 = $105;
     $107 = HEAP32[$106>>2]|0;
     $$3163 = $$2162;
     while(1) {
      $108 = $$3163;
      $109 = $108;
      $110 = HEAP32[$109>>2]|0;
      $111 = (($108) + 4)|0;
      $112 = $111;
      $113 = HEAP32[$112>>2]|0;
      $114 = ($107|0)<($113|0);
      $115 = ($104>>>0)<($110>>>0);
      $116 = ($107|0)==($113|0);
      $117 = $116 & $115;
      $118 = $114 | $117;
      $119 = ((($$3163)) + 8|0);
      if ($118) {
       $$2156 = $$1155;
       break;
      } else {
       $$3163 = $119;
      }
     }
     while(1) {
      $120 = ((($$2156)) + -8|0);
      $121 = $120;
      $122 = $121;
      $123 = HEAP32[$122>>2]|0;
      $124 = (($121) + 4)|0;
      $125 = $124;
      $126 = HEAP32[$125>>2]|0;
      $127 = ($107|0)<($126|0);
      $128 = ($104>>>0)<($123>>>0);
      $129 = ($107|0)==($126|0);
      $130 = $129 & $128;
      $131 = $127 | $130;
      if ($131) {
       $$2156 = $120;
      } else {
       break;
      }
     }
     $132 = ($$3163>>>0)<($120>>>0);
     if (!($132)) {
      $$1 = $$3163;
      continue L5;
     }
     $133 = $$3163;
     $134 = $133;
     HEAP32[$134>>2] = $123;
     $135 = (($133) + 4)|0;
     $136 = $135;
     HEAP32[$136>>2] = $126;
     $137 = $120;
     $138 = $137;
     HEAP32[$138>>2] = $110;
     $139 = (($137) + 4)|0;
     $140 = $139;
     HEAP32[$140>>2] = $113;
     $$1155 = $120;$$2162 = $119;
    }
   }
   if ((label|0) == 29) {
    label = 0;
    $152 = $$1;
    $153 = $152;
    HEAP32[$153>>2] = $143;
    $154 = (($152) + 4)|0;
    $155 = $154;
    HEAP32[$155>>2] = $146;
    $156 = $65;
    $157 = $156;
    HEAP32[$157>>2] = $50;
    $158 = (($156) + 4)|0;
    $159 = $158;
    HEAP32[$159>>2] = $53;
    $160 = (($$0167) + 1)|0;
    $$3157 = $65;$$3170 = $160;
   }
   $161 = ((($$1)) + 8|0);
   $162 = ($161>>>0)<($$3157>>>0);
   L35: do {
    if ($162) {
     $$0174 = $42;$$4158 = $$3157;$$4164 = $161;$$4171 = $$3170;
     while(1) {
      $163 = $$0174;
      $164 = $163;
      $165 = HEAP32[$164>>2]|0;
      $166 = (($163) + 4)|0;
      $167 = $166;
      $168 = HEAP32[$167>>2]|0;
      $$5165 = $$4164;
      while(1) {
       $169 = $$5165;
       $170 = $169;
       $171 = HEAP32[$170>>2]|0;
       $172 = (($169) + 4)|0;
       $173 = $172;
       $174 = HEAP32[$173>>2]|0;
       $175 = ($174|0)<($168|0);
       $176 = ($171>>>0)<($165>>>0);
       $177 = ($174|0)==($168|0);
       $178 = $177 & $176;
       $179 = $175 | $178;
       $180 = ((($$5165)) + 8|0);
       if ($179) {
        $$5165 = $180;
       } else {
        $$5159 = $$4158;
        break;
       }
      }
      while(1) {
       $181 = ((($$5159)) + -8|0);
       $182 = $181;
       $183 = $182;
       $184 = HEAP32[$183>>2]|0;
       $185 = (($182) + 4)|0;
       $186 = $185;
       $187 = HEAP32[$186>>2]|0;
       $188 = ($187|0)<($168|0);
       $189 = ($184>>>0)<($165>>>0);
       $190 = ($187|0)==($168|0);
       $191 = $190 & $189;
       $192 = $188 | $191;
       if ($192) {
        break;
       } else {
        $$5159 = $181;
       }
      }
      $193 = ($$5165>>>0)>($181>>>0);
      if ($193) {
       $$2176 = $$0174;$$5172 = $$4171;$$6166 = $$5165;
       break L35;
      }
      $194 = $$5165;
      $195 = $194;
      HEAP32[$195>>2] = $184;
      $196 = (($194) + 4)|0;
      $197 = $196;
      HEAP32[$197>>2] = $187;
      $198 = $181;
      $199 = $198;
      HEAP32[$199>>2] = $171;
      $200 = (($198) + 4)|0;
      $201 = $200;
      HEAP32[$201>>2] = $174;
      $202 = (($$4171) + 1)|0;
      $203 = ($$0174|0)==($$5165|0);
      $$$0174 = $203 ? $181 : $$0174;
      $$0174 = $$$0174;$$4158 = $181;$$4164 = $180;$$4171 = $202;
     }
    } else {
     $$2176 = $42;$$5172 = $$3170;$$6166 = $161;
    }
   } while(0);
   $204 = ($$6166|0)==($$2176|0);
   if ($204) {
    $$6173 = $$5172;
   } else {
    $205 = $$2176;
    $206 = $205;
    $207 = HEAP32[$206>>2]|0;
    $208 = (($205) + 4)|0;
    $209 = $208;
    $210 = HEAP32[$209>>2]|0;
    $211 = $$6166;
    $212 = $211;
    $213 = HEAP32[$212>>2]|0;
    $214 = (($211) + 4)|0;
    $215 = $214;
    $216 = HEAP32[$215>>2]|0;
    $217 = ($210|0)<($216|0);
    $218 = ($207>>>0)<($213>>>0);
    $219 = ($210|0)==($216|0);
    $220 = $219 & $218;
    $221 = $217 | $220;
    if ($221) {
     $222 = (($$5172) + 1)|0;
     $223 = $$6166;
     $224 = $223;
     HEAP32[$224>>2] = $207;
     $225 = (($223) + 4)|0;
     $226 = $225;
     HEAP32[$226>>2] = $210;
     $227 = $$2176;
     $228 = $227;
     HEAP32[$228>>2] = $213;
     $229 = (($227) + 4)|0;
     $230 = $229;
     HEAP32[$230>>2] = $216;
     $$6173 = $222;
    } else {
     $$6173 = $$5172;
    }
   }
   $231 = ($$6173|0)==(0);
   if ($231) {
    $232 = (__ZNSt3__227__insertion_sort_incompleteIRNS_6__lessIxxEEPxEEbT0_S5_T_($$1,$$6166,$2)|0);
    $233 = ((($$6166)) + 8|0);
    $234 = (__ZNSt3__227__insertion_sort_incompleteIRNS_6__lessIxxEEPxEEbT0_S5_T_($233,$$0180$ph,$2)|0);
    if ($234) {
     label = 45;
     break;
    }
    if ($232) {
     $$0 = $233;
     continue;
    }
   }
   $235 = $$6166;
   $236 = (($235) - ($5))|0;
   $237 = (($3) - ($235))|0;
   $238 = ($236|0)<($237|0);
   if (!($238)) {
    label = 44;
    break;
   }
   __ZNSt3__26__sortIRNS_6__lessIxxEEPxEEvT0_S5_T_($$1,$$6166,$2);
   $239 = ((($$6166)) + 8|0);
   $$0 = $239;
  }
  if ((label|0) == 44) {
   label = 0;
   $240 = ((($$6166)) + 8|0);
   __ZNSt3__26__sortIRNS_6__lessIxxEEPxEEvT0_S5_T_($240,$$0180$ph,$2);
   $$0$ph = $$1;$$0180$ph = $$6166;
   continue;
  }
  else if ((label|0) == 45) {
   label = 0;
   if ($232) {
    break;
   } else {
    $$0$ph = $$1;$$0180$ph = $$6166;
    continue;
   }
  }
 }
 if ((label|0) == 5) {
  $8 = $4;
  $9 = $8;
  $10 = HEAP32[$9>>2]|0;
  $11 = (($8) + 4)|0;
  $12 = $11;
  $13 = HEAP32[$12>>2]|0;
  $14 = $$1;
  $15 = $14;
  $16 = HEAP32[$15>>2]|0;
  $17 = (($14) + 4)|0;
  $18 = $17;
  $19 = HEAP32[$18>>2]|0;
  $20 = ($13|0)<($19|0);
  $21 = ($10>>>0)<($16>>>0);
  $22 = ($13|0)==($19|0);
  $23 = $22 & $21;
  $24 = $20 | $23;
  if ($24) {
   $25 = $$1;
   $26 = $25;
   HEAP32[$26>>2] = $10;
   $27 = (($25) + 4)|0;
   $28 = $27;
   HEAP32[$28>>2] = $13;
   $29 = $4;
   $30 = $29;
   HEAP32[$30>>2] = $16;
   $31 = (($29) + 4)|0;
   $32 = $31;
   HEAP32[$32>>2] = $19;
  }
 }
 else if ((label|0) == 7) {
  $33 = ((($$1)) + 8|0);
  (__ZNSt3__27__sort3IRNS_6__lessIxxEEPxEEjT0_S5_S5_T_($$1,$33,$4,$2)|0);
 }
 else if ((label|0) == 8) {
  $34 = ((($$1)) + 8|0);
  $35 = ((($$1)) + 16|0);
  (__ZNSt3__27__sort4IRNS_6__lessIxxEEPxEEjT0_S5_S5_S5_T_($$1,$34,$35,$4,$2)|0);
 }
 else if ((label|0) == 9) {
  $36 = ((($$1)) + 8|0);
  $37 = ((($$1)) + 16|0);
  $38 = ((($$1)) + 24|0);
  (__ZNSt3__27__sort5IRNS_6__lessIxxEEPxEEjT0_S5_S5_S5_S5_T_($$1,$36,$37,$38,$4,$2)|0);
 }
 else if ((label|0) == 11) {
  __ZNSt3__218__insertion_sort_3IRNS_6__lessIxxEEPxEEvT0_S5_T_($$1,$$0180$ph,$2);
 }
 return;
}
function __ZNSt3__27__sort3IRNS_6__lessIxxEEPxEEjT0_S5_S5_T_($0,$1,$2,$3) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 $3 = $3|0;
 var $$026 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0, $27 = 0, $28 = 0;
 var $29 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0, $41 = 0, $42 = 0, $43 = 0, $44 = 0, $45 = 0, $46 = 0, $47 = 0;
 var $48 = 0, $49 = 0, $5 = 0, $50 = 0, $51 = 0, $52 = 0, $53 = 0, $54 = 0, $55 = 0, $56 = 0, $57 = 0, $58 = 0, $59 = 0, $6 = 0, $60 = 0, $61 = 0, $62 = 0, $63 = 0, $64 = 0, $65 = 0;
 var $66 = 0, $67 = 0, $68 = 0, $69 = 0, $7 = 0, $70 = 0, $71 = 0, $72 = 0, $73 = 0, $74 = 0, $75 = 0, $76 = 0, $77 = 0, $78 = 0, $79 = 0, $8 = 0, $80 = 0, $81 = 0, $82 = 0, $83 = 0;
 var $84 = 0, $85 = 0, $86 = 0, $87 = 0, $88 = 0, $89 = 0, $9 = 0, $90 = 0, $91 = 0, $92 = 0, $93 = 0, $94 = 0, $95 = 0, $96 = 0, $97 = 0, $98 = 0, $99 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $4 = $1;
 $5 = $4;
 $6 = HEAP32[$5>>2]|0;
 $7 = (($4) + 4)|0;
 $8 = $7;
 $9 = HEAP32[$8>>2]|0;
 $10 = $0;
 $11 = $10;
 $12 = HEAP32[$11>>2]|0;
 $13 = (($10) + 4)|0;
 $14 = $13;
 $15 = HEAP32[$14>>2]|0;
 $16 = ($9|0)<($15|0);
 $17 = ($6>>>0)<($12>>>0);
 $18 = ($9|0)==($15|0);
 $19 = $18 & $17;
 $20 = $16 | $19;
 $21 = $2;
 $22 = $21;
 $23 = HEAP32[$22>>2]|0;
 $24 = (($21) + 4)|0;
 $25 = $24;
 $26 = HEAP32[$25>>2]|0;
 $27 = ($26|0)<($9|0);
 $28 = ($23>>>0)<($6>>>0);
 $29 = ($26|0)==($9|0);
 $30 = $29 & $28;
 $31 = $27 | $30;
 do {
  if ($20) {
   if ($31) {
    $65 = $0;
    $66 = $65;
    HEAP32[$66>>2] = $23;
    $67 = (($65) + 4)|0;
    $68 = $67;
    HEAP32[$68>>2] = $26;
    $69 = $2;
    $70 = $69;
    HEAP32[$70>>2] = $12;
    $71 = (($69) + 4)|0;
    $72 = $71;
    HEAP32[$72>>2] = $15;
    $$026 = 1;
    break;
   }
   $73 = $0;
   $74 = $73;
   HEAP32[$74>>2] = $6;
   $75 = (($73) + 4)|0;
   $76 = $75;
   HEAP32[$76>>2] = $9;
   $77 = $1;
   $78 = $77;
   HEAP32[$78>>2] = $12;
   $79 = (($77) + 4)|0;
   $80 = $79;
   HEAP32[$80>>2] = $15;
   $81 = $2;
   $82 = $81;
   $83 = HEAP32[$82>>2]|0;
   $84 = (($81) + 4)|0;
   $85 = $84;
   $86 = HEAP32[$85>>2]|0;
   $87 = ($86|0)<($15|0);
   $88 = ($83>>>0)<($12>>>0);
   $89 = ($86|0)==($15|0);
   $90 = $89 & $88;
   $91 = $87 | $90;
   if ($91) {
    $92 = $1;
    $93 = $92;
    HEAP32[$93>>2] = $83;
    $94 = (($92) + 4)|0;
    $95 = $94;
    HEAP32[$95>>2] = $86;
    $96 = $2;
    $97 = $96;
    HEAP32[$97>>2] = $12;
    $98 = (($96) + 4)|0;
    $99 = $98;
    HEAP32[$99>>2] = $15;
    $$026 = 2;
   } else {
    $$026 = 1;
   }
  } else {
   if ($31) {
    $32 = $1;
    $33 = $32;
    HEAP32[$33>>2] = $23;
    $34 = (($32) + 4)|0;
    $35 = $34;
    HEAP32[$35>>2] = $26;
    $36 = $2;
    $37 = $36;
    HEAP32[$37>>2] = $6;
    $38 = (($36) + 4)|0;
    $39 = $38;
    HEAP32[$39>>2] = $9;
    $40 = $1;
    $41 = $40;
    $42 = HEAP32[$41>>2]|0;
    $43 = (($40) + 4)|0;
    $44 = $43;
    $45 = HEAP32[$44>>2]|0;
    $46 = $0;
    $47 = $46;
    $48 = HEAP32[$47>>2]|0;
    $49 = (($46) + 4)|0;
    $50 = $49;
    $51 = HEAP32[$50>>2]|0;
    $52 = ($45|0)<($51|0);
    $53 = ($42>>>0)<($48>>>0);
    $54 = ($45|0)==($51|0);
    $55 = $54 & $53;
    $56 = $52 | $55;
    if ($56) {
     $57 = $0;
     $58 = $57;
     HEAP32[$58>>2] = $42;
     $59 = (($57) + 4)|0;
     $60 = $59;
     HEAP32[$60>>2] = $45;
     $61 = $1;
     $62 = $61;
     HEAP32[$62>>2] = $48;
     $63 = (($61) + 4)|0;
     $64 = $63;
     HEAP32[$64>>2] = $51;
     $$026 = 2;
    } else {
     $$026 = 1;
    }
   } else {
    $$026 = 0;
   }
  }
 } while(0);
 return ($$026|0);
}
function __ZNSt3__27__sort4IRNS_6__lessIxxEEPxEEjT0_S5_S5_S5_T_($0,$1,$2,$3,$4) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 $3 = $3|0;
 $4 = $4|0;
 var $$0 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0, $27 = 0, $28 = 0;
 var $29 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $40 = 0, $41 = 0, $42 = 0, $43 = 0, $44 = 0, $45 = 0, $46 = 0, $47 = 0, $48 = 0;
 var $49 = 0, $5 = 0, $50 = 0, $51 = 0, $52 = 0, $53 = 0, $54 = 0, $55 = 0, $56 = 0, $57 = 0, $58 = 0, $59 = 0, $6 = 0, $60 = 0, $61 = 0, $62 = 0, $63 = 0, $64 = 0, $65 = 0, $66 = 0;
 var $67 = 0, $68 = 0, $69 = 0, $7 = 0, $70 = 0, $71 = 0, $72 = 0, $73 = 0, $74 = 0, $75 = 0, $76 = 0, $77 = 0, $78 = 0, $79 = 0, $8 = 0, $80 = 0, $81 = 0, $82 = 0, $83 = 0, $9 = 0;
 var label = 0, sp = 0;
 sp = STACKTOP;
 $5 = (__ZNSt3__27__sort3IRNS_6__lessIxxEEPxEEjT0_S5_S5_T_($0,$1,$2,$4)|0);
 $6 = $3;
 $7 = $6;
 $8 = HEAP32[$7>>2]|0;
 $9 = (($6) + 4)|0;
 $10 = $9;
 $11 = HEAP32[$10>>2]|0;
 $12 = $2;
 $13 = $12;
 $14 = HEAP32[$13>>2]|0;
 $15 = (($12) + 4)|0;
 $16 = $15;
 $17 = HEAP32[$16>>2]|0;
 $18 = ($11|0)<($17|0);
 $19 = ($8>>>0)<($14>>>0);
 $20 = ($11|0)==($17|0);
 $21 = $20 & $19;
 $22 = $18 | $21;
 if ($22) {
  $23 = $2;
  $24 = $23;
  HEAP32[$24>>2] = $8;
  $25 = (($23) + 4)|0;
  $26 = $25;
  HEAP32[$26>>2] = $11;
  $27 = $3;
  $28 = $27;
  HEAP32[$28>>2] = $14;
  $29 = (($27) + 4)|0;
  $30 = $29;
  HEAP32[$30>>2] = $17;
  $31 = (($5) + 1)|0;
  $32 = $2;
  $33 = $32;
  $34 = HEAP32[$33>>2]|0;
  $35 = (($32) + 4)|0;
  $36 = $35;
  $37 = HEAP32[$36>>2]|0;
  $38 = $1;
  $39 = $38;
  $40 = HEAP32[$39>>2]|0;
  $41 = (($38) + 4)|0;
  $42 = $41;
  $43 = HEAP32[$42>>2]|0;
  $44 = ($37|0)<($43|0);
  $45 = ($34>>>0)<($40>>>0);
  $46 = ($37|0)==($43|0);
  $47 = $46 & $45;
  $48 = $44 | $47;
  if ($48) {
   $49 = $1;
   $50 = $49;
   HEAP32[$50>>2] = $34;
   $51 = (($49) + 4)|0;
   $52 = $51;
   HEAP32[$52>>2] = $37;
   $53 = $2;
   $54 = $53;
   HEAP32[$54>>2] = $40;
   $55 = (($53) + 4)|0;
   $56 = $55;
   HEAP32[$56>>2] = $43;
   $57 = (($5) + 2)|0;
   $58 = $1;
   $59 = $58;
   $60 = HEAP32[$59>>2]|0;
   $61 = (($58) + 4)|0;
   $62 = $61;
   $63 = HEAP32[$62>>2]|0;
   $64 = $0;
   $65 = $64;
   $66 = HEAP32[$65>>2]|0;
   $67 = (($64) + 4)|0;
   $68 = $67;
   $69 = HEAP32[$68>>2]|0;
   $70 = ($63|0)<($69|0);
   $71 = ($60>>>0)<($66>>>0);
   $72 = ($63|0)==($69|0);
   $73 = $72 & $71;
   $74 = $70 | $73;
   if ($74) {
    $75 = (($5) + 3)|0;
    $76 = $0;
    $77 = $76;
    HEAP32[$77>>2] = $60;
    $78 = (($76) + 4)|0;
    $79 = $78;
    HEAP32[$79>>2] = $63;
    $80 = $1;
    $81 = $80;
    HEAP32[$81>>2] = $66;
    $82 = (($80) + 4)|0;
    $83 = $82;
    HEAP32[$83>>2] = $69;
    $$0 = $75;
   } else {
    $$0 = $57;
   }
  } else {
   $$0 = $31;
  }
 } else {
  $$0 = $5;
 }
 return ($$0|0);
}
function __ZNSt3__27__sort5IRNS_6__lessIxxEEPxEEjT0_S5_S5_S5_S5_T_($0,$1,$2,$3,$4,$5) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 $3 = $3|0;
 $4 = $4|0;
 $5 = $5|0;
 var $$0 = 0, $10 = 0, $100 = 0, $101 = 0, $102 = 0, $103 = 0, $104 = 0, $105 = 0, $106 = 0, $107 = 0, $108 = 0, $109 = 0, $11 = 0, $110 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0;
 var $18 = 0, $19 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0, $27 = 0, $28 = 0, $29 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0;
 var $38 = 0, $39 = 0, $40 = 0, $41 = 0, $42 = 0, $43 = 0, $44 = 0, $45 = 0, $46 = 0, $47 = 0, $48 = 0, $49 = 0, $50 = 0, $51 = 0, $52 = 0, $53 = 0, $54 = 0, $55 = 0, $56 = 0, $57 = 0;
 var $58 = 0, $59 = 0, $6 = 0, $60 = 0, $61 = 0, $62 = 0, $63 = 0, $64 = 0, $65 = 0, $66 = 0, $67 = 0, $68 = 0, $69 = 0, $7 = 0, $70 = 0, $71 = 0, $72 = 0, $73 = 0, $74 = 0, $75 = 0;
 var $76 = 0, $77 = 0, $78 = 0, $79 = 0, $8 = 0, $80 = 0, $81 = 0, $82 = 0, $83 = 0, $84 = 0, $85 = 0, $86 = 0, $87 = 0, $88 = 0, $89 = 0, $9 = 0, $90 = 0, $91 = 0, $92 = 0, $93 = 0;
 var $94 = 0, $95 = 0, $96 = 0, $97 = 0, $98 = 0, $99 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $6 = (__ZNSt3__27__sort4IRNS_6__lessIxxEEPxEEjT0_S5_S5_S5_T_($0,$1,$2,$3,$5)|0);
 $7 = $4;
 $8 = $7;
 $9 = HEAP32[$8>>2]|0;
 $10 = (($7) + 4)|0;
 $11 = $10;
 $12 = HEAP32[$11>>2]|0;
 $13 = $3;
 $14 = $13;
 $15 = HEAP32[$14>>2]|0;
 $16 = (($13) + 4)|0;
 $17 = $16;
 $18 = HEAP32[$17>>2]|0;
 $19 = ($12|0)<($18|0);
 $20 = ($9>>>0)<($15>>>0);
 $21 = ($12|0)==($18|0);
 $22 = $21 & $20;
 $23 = $19 | $22;
 if ($23) {
  $24 = $3;
  $25 = $24;
  HEAP32[$25>>2] = $9;
  $26 = (($24) + 4)|0;
  $27 = $26;
  HEAP32[$27>>2] = $12;
  $28 = $4;
  $29 = $28;
  HEAP32[$29>>2] = $15;
  $30 = (($28) + 4)|0;
  $31 = $30;
  HEAP32[$31>>2] = $18;
  $32 = (($6) + 1)|0;
  $33 = $3;
  $34 = $33;
  $35 = HEAP32[$34>>2]|0;
  $36 = (($33) + 4)|0;
  $37 = $36;
  $38 = HEAP32[$37>>2]|0;
  $39 = $2;
  $40 = $39;
  $41 = HEAP32[$40>>2]|0;
  $42 = (($39) + 4)|0;
  $43 = $42;
  $44 = HEAP32[$43>>2]|0;
  $45 = ($38|0)<($44|0);
  $46 = ($35>>>0)<($41>>>0);
  $47 = ($38|0)==($44|0);
  $48 = $47 & $46;
  $49 = $45 | $48;
  if ($49) {
   $50 = $2;
   $51 = $50;
   HEAP32[$51>>2] = $35;
   $52 = (($50) + 4)|0;
   $53 = $52;
   HEAP32[$53>>2] = $38;
   $54 = $3;
   $55 = $54;
   HEAP32[$55>>2] = $41;
   $56 = (($54) + 4)|0;
   $57 = $56;
   HEAP32[$57>>2] = $44;
   $58 = (($6) + 2)|0;
   $59 = $2;
   $60 = $59;
   $61 = HEAP32[$60>>2]|0;
   $62 = (($59) + 4)|0;
   $63 = $62;
   $64 = HEAP32[$63>>2]|0;
   $65 = $1;
   $66 = $65;
   $67 = HEAP32[$66>>2]|0;
   $68 = (($65) + 4)|0;
   $69 = $68;
   $70 = HEAP32[$69>>2]|0;
   $71 = ($64|0)<($70|0);
   $72 = ($61>>>0)<($67>>>0);
   $73 = ($64|0)==($70|0);
   $74 = $73 & $72;
   $75 = $71 | $74;
   if ($75) {
    $76 = $1;
    $77 = $76;
    HEAP32[$77>>2] = $61;
    $78 = (($76) + 4)|0;
    $79 = $78;
    HEAP32[$79>>2] = $64;
    $80 = $2;
    $81 = $80;
    HEAP32[$81>>2] = $67;
    $82 = (($80) + 4)|0;
    $83 = $82;
    HEAP32[$83>>2] = $70;
    $84 = (($6) + 3)|0;
    $85 = $1;
    $86 = $85;
    $87 = HEAP32[$86>>2]|0;
    $88 = (($85) + 4)|0;
    $89 = $88;
    $90 = HEAP32[$89>>2]|0;
    $91 = $0;
    $92 = $91;
    $93 = HEAP32[$92>>2]|0;
    $94 = (($91) + 4)|0;
    $95 = $94;
    $96 = HEAP32[$95>>2]|0;
    $97 = ($90|0)<($96|0);
    $98 = ($87>>>0)<($93>>>0);
    $99 = ($90|0)==($96|0);
    $100 = $99 & $98;
    $101 = $97 | $100;
    if ($101) {
     $102 = (($6) + 4)|0;
     $103 = $0;
     $104 = $103;
     HEAP32[$104>>2] = $87;
     $105 = (($103) + 4)|0;
     $106 = $105;
     HEAP32[$106>>2] = $90;
     $107 = $1;
     $108 = $107;
     HEAP32[$108>>2] = $93;
     $109 = (($107) + 4)|0;
     $110 = $109;
     HEAP32[$110>>2] = $96;
     $$0 = $102;
    } else {
     $$0 = $84;
    }
   } else {
    $$0 = $58;
   }
  } else {
   $$0 = $32;
  }
 } else {
  $$0 = $6;
 }
 return ($$0|0);
}
function __ZNSt3__218__insertion_sort_3IRNS_6__lessIxxEEPxEEvT0_S5_T_($0,$1,$2) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 var $$0 = 0, $$0$lcssa = 0, $$029 = 0, $$030 = 0, $$030$phi = 0, $$1 = 0, $$1$phi = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $20 = 0, $21 = 0, $22 = 0;
 var $23 = 0, $24 = 0, $25 = 0, $26 = 0, $27 = 0, $28 = 0, $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0;
 var $41 = 0, $42 = 0, $43 = 0, $44 = 0, $45 = 0, $46 = 0, $47 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $3 = ((($0)) + 16|0);
 $4 = ((($0)) + 8|0);
 (__ZNSt3__27__sort3IRNS_6__lessIxxEEPxEEjT0_S5_S5_T_($0,$4,$3,$2)|0);
 $5 = ((($0)) + 24|0);
 $$029 = $5;$$030 = $3;
 while(1) {
  $6 = ($$029|0)==($1|0);
  if ($6) {
   break;
  }
  $7 = $$029;
  $8 = $7;
  $9 = HEAP32[$8>>2]|0;
  $10 = (($7) + 4)|0;
  $11 = $10;
  $12 = HEAP32[$11>>2]|0;
  $13 = $$030;
  $14 = $13;
  $15 = HEAP32[$14>>2]|0;
  $16 = (($13) + 4)|0;
  $17 = $16;
  $18 = HEAP32[$17>>2]|0;
  $19 = ($12|0)<($18|0);
  $20 = ($9>>>0)<($15>>>0);
  $21 = ($12|0)==($18|0);
  $22 = $21 & $20;
  $23 = $19 | $22;
  if ($23) {
   $$0 = $$030;$$1 = $$029;$26 = $15;$29 = $18;
   while(1) {
    $24 = $$1;
    $25 = $24;
    HEAP32[$25>>2] = $26;
    $27 = (($24) + 4)|0;
    $28 = $27;
    HEAP32[$28>>2] = $29;
    $30 = ($$0|0)==($0|0);
    if ($30) {
     $$0$lcssa = $0;
     break;
    }
    $31 = ((($$0)) + -8|0);
    $32 = $31;
    $33 = $32;
    $34 = HEAP32[$33>>2]|0;
    $35 = (($32) + 4)|0;
    $36 = $35;
    $37 = HEAP32[$36>>2]|0;
    $38 = ($12|0)<($37|0);
    $39 = ($9>>>0)<($34>>>0);
    $40 = ($12|0)==($37|0);
    $41 = $40 & $39;
    $42 = $38 | $41;
    if ($42) {
     $$1$phi = $$0;$$0 = $31;$26 = $34;$29 = $37;$$1 = $$1$phi;
    } else {
     $$0$lcssa = $$0;
     break;
    }
   }
   $43 = $$0$lcssa;
   $44 = $43;
   HEAP32[$44>>2] = $9;
   $45 = (($43) + 4)|0;
   $46 = $45;
   HEAP32[$46>>2] = $12;
  }
  $47 = ((($$029)) + 8|0);
  $$030$phi = $$029;$$029 = $47;$$030 = $$030$phi;
 }
 return;
}
function __ZNSt3__227__insertion_sort_incompleteIRNS_6__lessIxxEEPxEEbT0_S5_T_($0,$1,$2) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 var $$$3 = 0, $$0 = 0, $$0$lcssa = 0, $$062 = 0, $$064 = 0, $$069 = 0, $$069$phi = 0, $$1 = 0, $$165 = 0, $$170 = 0, $$170$phi = 0, $$3 = 0, $$5 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0;
 var $17 = 0, $18 = 0, $19 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0, $27 = 0, $28 = 0, $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0;
 var $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0, $41 = 0, $42 = 0, $43 = 0, $44 = 0, $45 = 0, $46 = 0, $47 = 0, $48 = 0, $49 = 0, $5 = 0, $50 = 0, $51 = 0, $52 = 0, $53 = 0;
 var $54 = 0, $55 = 0, $56 = 0, $57 = 0, $58 = 0, $59 = 0, $6 = 0, $60 = 0, $61 = 0, $62 = 0, $63 = 0, $64 = 0, $65 = 0, $66 = 0, $67 = 0, $68 = 0, $69 = 0, $7 = 0, $70 = 0, $71 = 0;
 var $72 = 0, $73 = 0, $74 = 0, $75 = 0, $76 = 0, $77 = 0, $78 = 0, $79 = 0, $8 = 0, $80 = 0, $81 = 0, $82 = 0, $83 = 0, $84 = 0, $85 = 0, $86 = 0, $87 = 0, $88 = 0, $89 = 0, $9 = 0;
 var $90 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $3 = $1;
 $4 = $0;
 $5 = (($3) - ($4))|0;
 $6 = $5 >> 3;
 switch ($6|0) {
 case 1: case 0:  {
  $$5 = 1;
  break;
 }
 case 2:  {
  $7 = ((($1)) + -8|0);
  $8 = $7;
  $9 = $8;
  $10 = HEAP32[$9>>2]|0;
  $11 = (($8) + 4)|0;
  $12 = $11;
  $13 = HEAP32[$12>>2]|0;
  $14 = $0;
  $15 = $14;
  $16 = HEAP32[$15>>2]|0;
  $17 = (($14) + 4)|0;
  $18 = $17;
  $19 = HEAP32[$18>>2]|0;
  $20 = ($13|0)<($19|0);
  $21 = ($10>>>0)<($16>>>0);
  $22 = ($13|0)==($19|0);
  $23 = $22 & $21;
  $24 = $20 | $23;
  if ($24) {
   $25 = $0;
   $26 = $25;
   HEAP32[$26>>2] = $10;
   $27 = (($25) + 4)|0;
   $28 = $27;
   HEAP32[$28>>2] = $13;
   $29 = $7;
   $30 = $29;
   HEAP32[$30>>2] = $16;
   $31 = (($29) + 4)|0;
   $32 = $31;
   HEAP32[$32>>2] = $19;
   $$5 = 1;
  } else {
   $$5 = 1;
  }
  break;
 }
 case 3:  {
  $33 = ((($0)) + 8|0);
  $34 = ((($1)) + -8|0);
  (__ZNSt3__27__sort3IRNS_6__lessIxxEEPxEEjT0_S5_S5_T_($0,$33,$34,$2)|0);
  $$5 = 1;
  break;
 }
 case 4:  {
  $35 = ((($0)) + 8|0);
  $36 = ((($0)) + 16|0);
  $37 = ((($1)) + -8|0);
  (__ZNSt3__27__sort4IRNS_6__lessIxxEEPxEEjT0_S5_S5_S5_T_($0,$35,$36,$37,$2)|0);
  $$5 = 1;
  break;
 }
 case 5:  {
  $38 = ((($0)) + 8|0);
  $39 = ((($0)) + 16|0);
  $40 = ((($0)) + 24|0);
  $41 = ((($1)) + -8|0);
  (__ZNSt3__27__sort5IRNS_6__lessIxxEEPxEEjT0_S5_S5_S5_S5_T_($0,$38,$39,$40,$41,$2)|0);
  $$5 = 1;
  break;
 }
 default: {
  $42 = ((($0)) + 16|0);
  $43 = ((($0)) + 8|0);
  (__ZNSt3__27__sort3IRNS_6__lessIxxEEPxEEjT0_S5_S5_T_($0,$43,$42,$2)|0);
  $44 = ((($0)) + 24|0);
  $$062 = $44;$$064 = 0;$$069 = $42;
  while(1) {
   $45 = ($$062|0)==($1|0);
   if ($45) {
    $$1 = 1;$$3 = 0;
    break;
   }
   $46 = $$062;
   $47 = $46;
   $48 = HEAP32[$47>>2]|0;
   $49 = (($46) + 4)|0;
   $50 = $49;
   $51 = HEAP32[$50>>2]|0;
   $52 = $$069;
   $53 = $52;
   $54 = HEAP32[$53>>2]|0;
   $55 = (($52) + 4)|0;
   $56 = $55;
   $57 = HEAP32[$56>>2]|0;
   $58 = ($51|0)<($57|0);
   $59 = ($48>>>0)<($54>>>0);
   $60 = ($51|0)==($57|0);
   $61 = $60 & $59;
   $62 = $58 | $61;
   if ($62) {
    $$0 = $$069;$$170 = $$062;$65 = $54;$68 = $57;
    while(1) {
     $63 = $$170;
     $64 = $63;
     HEAP32[$64>>2] = $65;
     $66 = (($63) + 4)|0;
     $67 = $66;
     HEAP32[$67>>2] = $68;
     $69 = ($$0|0)==($0|0);
     if ($69) {
      $$0$lcssa = $0;
      break;
     }
     $70 = ((($$0)) + -8|0);
     $71 = $70;
     $72 = $71;
     $73 = HEAP32[$72>>2]|0;
     $74 = (($71) + 4)|0;
     $75 = $74;
     $76 = HEAP32[$75>>2]|0;
     $77 = ($51|0)<($76|0);
     $78 = ($48>>>0)<($73>>>0);
     $79 = ($51|0)==($76|0);
     $80 = $79 & $78;
     $81 = $77 | $80;
     if ($81) {
      $$170$phi = $$0;$$0 = $70;$65 = $73;$68 = $76;$$170 = $$170$phi;
     } else {
      $$0$lcssa = $$0;
      break;
     }
    }
    $82 = $$0$lcssa;
    $83 = $82;
    HEAP32[$83>>2] = $48;
    $84 = (($82) + 4)|0;
    $85 = $84;
    HEAP32[$85>>2] = $51;
    $86 = (($$064) + 1)|0;
    $87 = ($86|0)==(8);
    $88 = ((($$062)) + 8|0);
    $89 = ($88|0)==($1|0);
    if ($87) {
     $$1 = 0;$$3 = $89;
     break;
    } else {
     $$165 = $86;
    }
   } else {
    $$165 = $$064;
   }
   $90 = ((($$062)) + 8|0);
   $$069$phi = $$062;$$062 = $90;$$064 = $$165;$$069 = $$069$phi;
  }
  $$$3 = $$3 | $$1;
  $$5 = $$$3;
 }
 }
 return ($$5|0);
}
function __ZNKSt3__220__vector_base_commonILb1EE20__throw_length_errorEv($0) {
 $0 = $0|0;
 var label = 0, sp = 0;
 sp = STACKTOP;
 ___assert_fail((5926|0),(5949|0),304,(6016|0));
 // unreachable;
}
function __Znwj($0) {
 $0 = $0|0;
 var $$ = 0, $$lcssa = 0, $1 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $1 = ($0|0)==(0);
 $$ = $1 ? 1 : $0;
 while(1) {
  $2 = (_malloc($$)|0);
  $3 = ($2|0)==(0|0);
  if (!($3)) {
   $$lcssa = $2;
   break;
  }
  $4 = (__ZSt15get_new_handlerv()|0);
  $5 = ($4|0)==(0|0);
  if ($5) {
   $$lcssa = 0;
   break;
  }
  FUNCTION_TABLE_v[$4 & 3]();
 }
 return ($$lcssa|0);
}
function __ZdlPv($0) {
 $0 = $0|0;
 var label = 0, sp = 0;
 sp = STACKTOP;
 _free($0);
 return;
}
function __ZL25default_terminate_handlerv() {
 var $0 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0;
 var $27 = 0, $28 = 0, $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, $vararg_buffer = 0, $vararg_buffer10 = 0;
 var $vararg_buffer3 = 0, $vararg_buffer7 = 0, $vararg_ptr1 = 0, $vararg_ptr2 = 0, $vararg_ptr6 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 48|0;
 $vararg_buffer10 = sp + 32|0;
 $vararg_buffer7 = sp + 24|0;
 $vararg_buffer3 = sp + 16|0;
 $vararg_buffer = sp;
 $0 = sp + 36|0;
 $1 = (___cxa_get_globals_fast()|0);
 $2 = ($1|0)==(0|0);
 if (!($2)) {
  $3 = HEAP32[$1>>2]|0;
  $4 = ($3|0)==(0|0);
  if (!($4)) {
   $5 = ((($3)) + 80|0);
   $6 = ((($3)) + 48|0);
   $7 = $6;
   $8 = $7;
   $9 = HEAP32[$8>>2]|0;
   $10 = (($7) + 4)|0;
   $11 = $10;
   $12 = HEAP32[$11>>2]|0;
   $13 = $9 & -256;
   $14 = ($13|0)==(1126902528);
   $15 = ($12|0)==(1129074247);
   $16 = $14 & $15;
   if (!($16)) {
    $37 = HEAP32[293]|0;
    HEAP32[$vararg_buffer7>>2] = $37;
    _abort_message(6123,$vararg_buffer7);
    // unreachable;
   }
   $17 = ($9|0)==(1126902529);
   $18 = ($12|0)==(1129074247);
   $19 = $17 & $18;
   if ($19) {
    $20 = ((($3)) + 44|0);
    $21 = HEAP32[$20>>2]|0;
    $22 = $21;
   } else {
    $22 = $5;
   }
   HEAP32[$0>>2] = $22;
   $23 = HEAP32[$3>>2]|0;
   $24 = ((($23)) + 4|0);
   $25 = HEAP32[$24>>2]|0;
   $26 = HEAP32[112]|0;
   $27 = ((($26)) + 16|0);
   $28 = HEAP32[$27>>2]|0;
   $29 = (FUNCTION_TABLE_iiii[$28 & 15](448,$23,$0)|0);
   if ($29) {
    $30 = HEAP32[$0>>2]|0;
    $31 = HEAP32[293]|0;
    $32 = HEAP32[$30>>2]|0;
    $33 = ((($32)) + 8|0);
    $34 = HEAP32[$33>>2]|0;
    $35 = (FUNCTION_TABLE_ii[$34 & 15]($30)|0);
    HEAP32[$vararg_buffer>>2] = $31;
    $vararg_ptr1 = ((($vararg_buffer)) + 4|0);
    HEAP32[$vararg_ptr1>>2] = $25;
    $vararg_ptr2 = ((($vararg_buffer)) + 8|0);
    HEAP32[$vararg_ptr2>>2] = $35;
    _abort_message(6037,$vararg_buffer);
    // unreachable;
   } else {
    $36 = HEAP32[293]|0;
    HEAP32[$vararg_buffer3>>2] = $36;
    $vararg_ptr6 = ((($vararg_buffer3)) + 4|0);
    HEAP32[$vararg_ptr6>>2] = $25;
    _abort_message(6082,$vararg_buffer3);
    // unreachable;
   }
  }
 }
 _abort_message(6161,$vararg_buffer10);
 // unreachable;
}
function ___cxa_get_globals_fast() {
 var $0 = 0, $1 = 0, $2 = 0, $3 = 0, $vararg_buffer = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0;
 $vararg_buffer = sp;
 $0 = (_pthread_once((7256|0),(2|0))|0);
 $1 = ($0|0)==(0);
 if ($1) {
  $2 = HEAP32[1815]|0;
  $3 = (_pthread_getspecific(($2|0))|0);
  STACKTOP = sp;return ($3|0);
 } else {
  _abort_message(6312,$vararg_buffer);
  // unreachable;
 }
 return (0)|0;
}
function _abort_message($0,$varargs) {
 $0 = $0|0;
 $varargs = $varargs|0;
 var $1 = 0, $2 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0;
 $1 = sp;
 HEAP32[$1>>2] = $varargs;
 $2 = HEAP32[234]|0;
 (_vfprintf($2,$0,$1)|0);
 (_fputc(10,$2)|0);
 _abort();
 // unreachable;
}
function __ZN10__cxxabiv116__shim_type_infoD2Ev($0) {
 $0 = $0|0;
 var label = 0, sp = 0;
 sp = STACKTOP;
 return;
}
function __ZN10__cxxabiv117__class_type_infoD0Ev($0) {
 $0 = $0|0;
 var label = 0, sp = 0;
 sp = STACKTOP;
 __ZdlPv($0);
 return;
}
function __ZNK10__cxxabiv116__shim_type_info5noop1Ev($0) {
 $0 = $0|0;
 var label = 0, sp = 0;
 sp = STACKTOP;
 return;
}
function __ZNK10__cxxabiv116__shim_type_info5noop2Ev($0) {
 $0 = $0|0;
 var label = 0, sp = 0;
 sp = STACKTOP;
 return;
}
function __ZNK10__cxxabiv117__class_type_info9can_catchEPKNS_16__shim_type_infoERPv($0,$1,$2) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 var $$0 = 0, $$2 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $20 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0;
 var dest = 0, label = 0, sp = 0, stop = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 64|0;
 $3 = sp;
 $4 = ($0|0)==($1|0);
 if ($4) {
  $$2 = 1;
 } else {
  $5 = ($1|0)==(0|0);
  if ($5) {
   $$2 = 0;
  } else {
   $6 = (___dynamic_cast($1,472,456,0)|0);
   $7 = ($6|0)==(0|0);
   if ($7) {
    $$2 = 0;
   } else {
    $8 = ((($3)) + 4|0);
    dest=$8; stop=dest+52|0; do { HEAP32[dest>>2]=0|0; dest=dest+4|0; } while ((dest|0) < (stop|0));
    HEAP32[$3>>2] = $6;
    $9 = ((($3)) + 8|0);
    HEAP32[$9>>2] = $0;
    $10 = ((($3)) + 12|0);
    HEAP32[$10>>2] = -1;
    $11 = ((($3)) + 48|0);
    HEAP32[$11>>2] = 1;
    $12 = HEAP32[$6>>2]|0;
    $13 = ((($12)) + 28|0);
    $14 = HEAP32[$13>>2]|0;
    $15 = HEAP32[$2>>2]|0;
    FUNCTION_TABLE_viiii[$14 & 7]($6,$3,$15,1);
    $16 = ((($3)) + 24|0);
    $17 = HEAP32[$16>>2]|0;
    $18 = ($17|0)==(1);
    if ($18) {
     $19 = ((($3)) + 16|0);
     $20 = HEAP32[$19>>2]|0;
     HEAP32[$2>>2] = $20;
     $$0 = 1;
    } else {
     $$0 = 0;
    }
    $$2 = $$0;
   }
  }
 }
 STACKTOP = sp;return ($$2|0);
}
function __ZNK10__cxxabiv117__class_type_info16search_above_dstEPNS_19__dynamic_cast_infoEPKvS4_ib($0,$1,$2,$3,$4,$5) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 $3 = $3|0;
 $4 = $4|0;
 $5 = $5|0;
 var $6 = 0, $7 = 0, $8 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $6 = ((($1)) + 8|0);
 $7 = HEAP32[$6>>2]|0;
 $8 = ($0|0)==($7|0);
 if ($8) {
  __ZNK10__cxxabiv117__class_type_info29process_static_type_above_dstEPNS_19__dynamic_cast_infoEPKvS4_i(0,$1,$2,$3,$4);
 }
 return;
}
function __ZNK10__cxxabiv117__class_type_info16search_below_dstEPNS_19__dynamic_cast_infoEPKvib($0,$1,$2,$3,$4) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 $3 = $3|0;
 $4 = $4|0;
 var $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0, $27 = 0, $28 = 0, $29 = 0;
 var $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $5 = ((($1)) + 8|0);
 $6 = HEAP32[$5>>2]|0;
 $7 = ($0|0)==($6|0);
 do {
  if ($7) {
   $8 = ((($1)) + 4|0);
   $9 = HEAP32[$8>>2]|0;
   $10 = ($9|0)==($2|0);
   if ($10) {
    $11 = ((($1)) + 28|0);
    $12 = HEAP32[$11>>2]|0;
    $13 = ($12|0)==(1);
    if (!($13)) {
     HEAP32[$11>>2] = $3;
    }
   }
  } else {
   $14 = HEAP32[$1>>2]|0;
   $15 = ($0|0)==($14|0);
   if ($15) {
    $16 = ((($1)) + 16|0);
    $17 = HEAP32[$16>>2]|0;
    $18 = ($17|0)==($2|0);
    if (!($18)) {
     $19 = ((($1)) + 20|0);
     $20 = HEAP32[$19>>2]|0;
     $21 = ($20|0)==($2|0);
     if (!($21)) {
      $24 = ((($1)) + 32|0);
      HEAP32[$24>>2] = $3;
      HEAP32[$19>>2] = $2;
      $25 = ((($1)) + 40|0);
      $26 = HEAP32[$25>>2]|0;
      $27 = (($26) + 1)|0;
      HEAP32[$25>>2] = $27;
      $28 = ((($1)) + 36|0);
      $29 = HEAP32[$28>>2]|0;
      $30 = ($29|0)==(1);
      if ($30) {
       $31 = ((($1)) + 24|0);
       $32 = HEAP32[$31>>2]|0;
       $33 = ($32|0)==(2);
       if ($33) {
        $34 = ((($1)) + 54|0);
        HEAP8[$34>>0] = 1;
       }
      }
      $35 = ((($1)) + 44|0);
      HEAP32[$35>>2] = 4;
      break;
     }
    }
    $22 = ($3|0)==(1);
    if ($22) {
     $23 = ((($1)) + 32|0);
     HEAP32[$23>>2] = 1;
    }
   }
  }
 } while(0);
 return;
}
function __ZNK10__cxxabiv117__class_type_info27has_unambiguous_public_baseEPNS_19__dynamic_cast_infoEPvi($0,$1,$2,$3) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 $3 = $3|0;
 var $4 = 0, $5 = 0, $6 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $4 = ((($1)) + 8|0);
 $5 = HEAP32[$4>>2]|0;
 $6 = ($0|0)==($5|0);
 if ($6) {
  __ZNK10__cxxabiv117__class_type_info24process_found_base_classEPNS_19__dynamic_cast_infoEPvi(0,$1,$2,$3);
 }
 return;
}
function __ZNK10__cxxabiv117__class_type_info24process_found_base_classEPNS_19__dynamic_cast_infoEPvi($0,$1,$2,$3) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 $3 = $3|0;
 var $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $4 = ((($1)) + 16|0);
 $5 = HEAP32[$4>>2]|0;
 $6 = ($5|0)==(0|0);
 do {
  if ($6) {
   HEAP32[$4>>2] = $2;
   $7 = ((($1)) + 24|0);
   HEAP32[$7>>2] = $3;
   $8 = ((($1)) + 36|0);
   HEAP32[$8>>2] = 1;
  } else {
   $9 = ($5|0)==($2|0);
   if (!($9)) {
    $13 = ((($1)) + 36|0);
    $14 = HEAP32[$13>>2]|0;
    $15 = (($14) + 1)|0;
    HEAP32[$13>>2] = $15;
    $16 = ((($1)) + 24|0);
    HEAP32[$16>>2] = 2;
    $17 = ((($1)) + 54|0);
    HEAP8[$17>>0] = 1;
    break;
   }
   $10 = ((($1)) + 24|0);
   $11 = HEAP32[$10>>2]|0;
   $12 = ($11|0)==(2);
   if ($12) {
    HEAP32[$10>>2] = $3;
   }
  }
 } while(0);
 return;
}
function __ZNK10__cxxabiv117__class_type_info29process_static_type_above_dstEPNS_19__dynamic_cast_infoEPKvS4_i($0,$1,$2,$3,$4) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 $3 = $3|0;
 $4 = $4|0;
 var $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0, $27 = 0, $28 = 0, $29 = 0;
 var $30 = 0, $31 = 0, $32 = 0, $33 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, $or$cond = 0, $or$cond22 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $5 = ((($1)) + 53|0);
 HEAP8[$5>>0] = 1;
 $6 = ((($1)) + 4|0);
 $7 = HEAP32[$6>>2]|0;
 $8 = ($7|0)==($3|0);
 do {
  if ($8) {
   $9 = ((($1)) + 52|0);
   HEAP8[$9>>0] = 1;
   $10 = ((($1)) + 16|0);
   $11 = HEAP32[$10>>2]|0;
   $12 = ($11|0)==(0|0);
   if ($12) {
    HEAP32[$10>>2] = $2;
    $13 = ((($1)) + 24|0);
    HEAP32[$13>>2] = $4;
    $14 = ((($1)) + 36|0);
    HEAP32[$14>>2] = 1;
    $15 = ((($1)) + 48|0);
    $16 = HEAP32[$15>>2]|0;
    $17 = ($16|0)==(1);
    $18 = ($4|0)==(1);
    $or$cond = $17 & $18;
    if (!($or$cond)) {
     break;
    }
    $19 = ((($1)) + 54|0);
    HEAP8[$19>>0] = 1;
    break;
   }
   $20 = ($11|0)==($2|0);
   if (!($20)) {
    $30 = ((($1)) + 36|0);
    $31 = HEAP32[$30>>2]|0;
    $32 = (($31) + 1)|0;
    HEAP32[$30>>2] = $32;
    $33 = ((($1)) + 54|0);
    HEAP8[$33>>0] = 1;
    break;
   }
   $21 = ((($1)) + 24|0);
   $22 = HEAP32[$21>>2]|0;
   $23 = ($22|0)==(2);
   if ($23) {
    HEAP32[$21>>2] = $4;
    $27 = $4;
   } else {
    $27 = $22;
   }
   $24 = ((($1)) + 48|0);
   $25 = HEAP32[$24>>2]|0;
   $26 = ($25|0)==(1);
   $28 = ($27|0)==(1);
   $or$cond22 = $26 & $28;
   if ($or$cond22) {
    $29 = ((($1)) + 54|0);
    HEAP8[$29>>0] = 1;
   }
  }
 } while(0);
 return;
}
function ___dynamic_cast($0,$1,$2,$3) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 $3 = $3|0;
 var $$ = 0, $$0 = 0, $$33 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0;
 var $27 = 0, $28 = 0, $29 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0, $41 = 0, $42 = 0, $43 = 0, $44 = 0, $45 = 0;
 var $46 = 0, $47 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, $or$cond = 0, $or$cond28 = 0, $or$cond30 = 0, $or$cond32 = 0, dest = 0, label = 0, sp = 0, stop = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 64|0;
 $4 = sp;
 $5 = HEAP32[$0>>2]|0;
 $6 = ((($5)) + -8|0);
 $7 = HEAP32[$6>>2]|0;
 $8 = (($0) + ($7)|0);
 $9 = ((($5)) + -4|0);
 $10 = HEAP32[$9>>2]|0;
 HEAP32[$4>>2] = $2;
 $11 = ((($4)) + 4|0);
 HEAP32[$11>>2] = $0;
 $12 = ((($4)) + 8|0);
 HEAP32[$12>>2] = $1;
 $13 = ((($4)) + 12|0);
 HEAP32[$13>>2] = $3;
 $14 = ((($4)) + 16|0);
 $15 = ((($4)) + 20|0);
 $16 = ((($4)) + 24|0);
 $17 = ((($4)) + 28|0);
 $18 = ((($4)) + 32|0);
 $19 = ((($4)) + 40|0);
 $20 = ($10|0)==($2|0);
 dest=$14; stop=dest+36|0; do { HEAP32[dest>>2]=0|0; dest=dest+4|0; } while ((dest|0) < (stop|0));HEAP16[$14+36>>1]=0|0;HEAP8[$14+38>>0]=0|0;
 L1: do {
  if ($20) {
   $21 = ((($4)) + 48|0);
   HEAP32[$21>>2] = 1;
   $22 = HEAP32[$2>>2]|0;
   $23 = ((($22)) + 20|0);
   $24 = HEAP32[$23>>2]|0;
   FUNCTION_TABLE_viiiiii[$24 & 3]($2,$4,$8,$8,1,0);
   $25 = HEAP32[$16>>2]|0;
   $26 = ($25|0)==(1);
   $$ = $26 ? $8 : 0;
   $$0 = $$;
  } else {
   $27 = ((($4)) + 36|0);
   $28 = HEAP32[$10>>2]|0;
   $29 = ((($28)) + 24|0);
   $30 = HEAP32[$29>>2]|0;
   FUNCTION_TABLE_viiiii[$30 & 7]($10,$4,$8,1,0);
   $31 = HEAP32[$27>>2]|0;
   switch ($31|0) {
   case 0:  {
    $32 = HEAP32[$19>>2]|0;
    $33 = ($32|0)==(1);
    $34 = HEAP32[$17>>2]|0;
    $35 = ($34|0)==(1);
    $or$cond = $33 & $35;
    $36 = HEAP32[$18>>2]|0;
    $37 = ($36|0)==(1);
    $or$cond28 = $or$cond & $37;
    $38 = HEAP32[$15>>2]|0;
    $$33 = $or$cond28 ? $38 : 0;
    $$0 = $$33;
    break L1;
    break;
   }
   case 1:  {
    break;
   }
   default: {
    $$0 = 0;
    break L1;
   }
   }
   $39 = HEAP32[$16>>2]|0;
   $40 = ($39|0)==(1);
   if (!($40)) {
    $41 = HEAP32[$19>>2]|0;
    $42 = ($41|0)==(0);
    $43 = HEAP32[$17>>2]|0;
    $44 = ($43|0)==(1);
    $or$cond30 = $42 & $44;
    $45 = HEAP32[$18>>2]|0;
    $46 = ($45|0)==(1);
    $or$cond32 = $or$cond30 & $46;
    if (!($or$cond32)) {
     $$0 = 0;
     break;
    }
   }
   $47 = HEAP32[$14>>2]|0;
   $$0 = $47;
  }
 } while(0);
 STACKTOP = sp;return ($$0|0);
}
function __ZN10__cxxabiv120__si_class_type_infoD0Ev($0) {
 $0 = $0|0;
 var label = 0, sp = 0;
 sp = STACKTOP;
 __ZdlPv($0);
 return;
}
function __ZNK10__cxxabiv120__si_class_type_info16search_above_dstEPNS_19__dynamic_cast_infoEPKvS4_ib($0,$1,$2,$3,$4,$5) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 $3 = $3|0;
 $4 = $4|0;
 $5 = $5|0;
 var $10 = 0, $11 = 0, $12 = 0, $13 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $6 = ((($1)) + 8|0);
 $7 = HEAP32[$6>>2]|0;
 $8 = ($0|0)==($7|0);
 if ($8) {
  __ZNK10__cxxabiv117__class_type_info29process_static_type_above_dstEPNS_19__dynamic_cast_infoEPKvS4_i(0,$1,$2,$3,$4);
 } else {
  $9 = ((($0)) + 8|0);
  $10 = HEAP32[$9>>2]|0;
  $11 = HEAP32[$10>>2]|0;
  $12 = ((($11)) + 20|0);
  $13 = HEAP32[$12>>2]|0;
  FUNCTION_TABLE_viiiiii[$13 & 3]($10,$1,$2,$3,$4,$5);
 }
 return;
}
function __ZNK10__cxxabiv120__si_class_type_info16search_below_dstEPNS_19__dynamic_cast_infoEPKvib($0,$1,$2,$3,$4) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 $3 = $3|0;
 $4 = $4|0;
 var $$037$off039 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0, $27 = 0, $28 = 0;
 var $29 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $40 = 0, $41 = 0, $42 = 0, $43 = 0, $44 = 0, $45 = 0, $46 = 0, $47 = 0, $48 = 0;
 var $49 = 0, $5 = 0, $50 = 0, $51 = 0, $52 = 0, $53 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, $not$ = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $5 = ((($1)) + 8|0);
 $6 = HEAP32[$5>>2]|0;
 $7 = ($0|0)==($6|0);
 do {
  if ($7) {
   $8 = ((($1)) + 4|0);
   $9 = HEAP32[$8>>2]|0;
   $10 = ($9|0)==($2|0);
   if ($10) {
    $11 = ((($1)) + 28|0);
    $12 = HEAP32[$11>>2]|0;
    $13 = ($12|0)==(1);
    if (!($13)) {
     HEAP32[$11>>2] = $3;
    }
   }
  } else {
   $14 = HEAP32[$1>>2]|0;
   $15 = ($0|0)==($14|0);
   if (!($15)) {
    $49 = ((($0)) + 8|0);
    $50 = HEAP32[$49>>2]|0;
    $51 = HEAP32[$50>>2]|0;
    $52 = ((($51)) + 24|0);
    $53 = HEAP32[$52>>2]|0;
    FUNCTION_TABLE_viiiii[$53 & 7]($50,$1,$2,$3,$4);
    break;
   }
   $16 = ((($1)) + 16|0);
   $17 = HEAP32[$16>>2]|0;
   $18 = ($17|0)==($2|0);
   if (!($18)) {
    $19 = ((($1)) + 20|0);
    $20 = HEAP32[$19>>2]|0;
    $21 = ($20|0)==($2|0);
    if (!($21)) {
     $24 = ((($1)) + 32|0);
     HEAP32[$24>>2] = $3;
     $25 = ((($1)) + 44|0);
     $26 = HEAP32[$25>>2]|0;
     $27 = ($26|0)==(4);
     if ($27) {
      break;
     }
     $28 = ((($1)) + 52|0);
     HEAP8[$28>>0] = 0;
     $29 = ((($1)) + 53|0);
     HEAP8[$29>>0] = 0;
     $30 = ((($0)) + 8|0);
     $31 = HEAP32[$30>>2]|0;
     $32 = HEAP32[$31>>2]|0;
     $33 = ((($32)) + 20|0);
     $34 = HEAP32[$33>>2]|0;
     FUNCTION_TABLE_viiiiii[$34 & 3]($31,$1,$2,$2,1,$4);
     $35 = HEAP8[$29>>0]|0;
     $36 = ($35<<24>>24)==(0);
     if ($36) {
      $$037$off039 = 0;
      label = 13;
     } else {
      $37 = HEAP8[$28>>0]|0;
      $not$ = ($37<<24>>24)==(0);
      if ($not$) {
       $$037$off039 = 1;
       label = 13;
      } else {
       label = 17;
      }
     }
     do {
      if ((label|0) == 13) {
       HEAP32[$19>>2] = $2;
       $38 = ((($1)) + 40|0);
       $39 = HEAP32[$38>>2]|0;
       $40 = (($39) + 1)|0;
       HEAP32[$38>>2] = $40;
       $41 = ((($1)) + 36|0);
       $42 = HEAP32[$41>>2]|0;
       $43 = ($42|0)==(1);
       if ($43) {
        $44 = ((($1)) + 24|0);
        $45 = HEAP32[$44>>2]|0;
        $46 = ($45|0)==(2);
        if ($46) {
         $47 = ((($1)) + 54|0);
         HEAP8[$47>>0] = 1;
         if ($$037$off039) {
          label = 17;
          break;
         } else {
          $48 = 4;
          break;
         }
        }
       }
       if ($$037$off039) {
        label = 17;
       } else {
        $48 = 4;
       }
      }
     } while(0);
     if ((label|0) == 17) {
      $48 = 3;
     }
     HEAP32[$25>>2] = $48;
     break;
    }
   }
   $22 = ($3|0)==(1);
   if ($22) {
    $23 = ((($1)) + 32|0);
    HEAP32[$23>>2] = 1;
   }
  }
 } while(0);
 return;
}
function __ZNK10__cxxabiv120__si_class_type_info27has_unambiguous_public_baseEPNS_19__dynamic_cast_infoEPvi($0,$1,$2,$3) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 $3 = $3|0;
 var $10 = 0, $11 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $4 = ((($1)) + 8|0);
 $5 = HEAP32[$4>>2]|0;
 $6 = ($0|0)==($5|0);
 if ($6) {
  __ZNK10__cxxabiv117__class_type_info24process_found_base_classEPNS_19__dynamic_cast_infoEPvi(0,$1,$2,$3);
 } else {
  $7 = ((($0)) + 8|0);
  $8 = HEAP32[$7>>2]|0;
  $9 = HEAP32[$8>>2]|0;
  $10 = ((($9)) + 28|0);
  $11 = HEAP32[$10>>2]|0;
  FUNCTION_TABLE_viiii[$11 & 7]($8,$1,$2,$3);
 }
 return;
}
function __ZNSt9type_infoD2Ev($0) {
 $0 = $0|0;
 var label = 0, sp = 0;
 sp = STACKTOP;
 return;
}
function __ZN10__cxxabiv112_GLOBAL__N_110construct_Ev() {
 var $0 = 0, $1 = 0, $vararg_buffer = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0;
 $vararg_buffer = sp;
 $0 = (_pthread_key_create((7260|0),(19|0))|0);
 $1 = ($0|0)==(0);
 if ($1) {
  STACKTOP = sp;return;
 } else {
  _abort_message(6361,$vararg_buffer);
  // unreachable;
 }
}
function __ZN10__cxxabiv112_GLOBAL__N_19destruct_EPv($0) {
 $0 = $0|0;
 var $1 = 0, $2 = 0, $3 = 0, $vararg_buffer = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0;
 $vararg_buffer = sp;
 _free($0);
 $1 = HEAP32[1815]|0;
 $2 = (_pthread_setspecific(($1|0),(0|0))|0);
 $3 = ($2|0)==(0);
 if ($3) {
  STACKTOP = sp;return;
 } else {
  _abort_message(6411,$vararg_buffer);
  // unreachable;
 }
}
function __ZSt9terminatev() {
 var $0 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = (___cxa_get_globals_fast()|0);
 $1 = ($0|0)==(0|0);
 if (!($1)) {
  $2 = HEAP32[$0>>2]|0;
  $3 = ($2|0)==(0|0);
  if (!($3)) {
   $4 = ((($2)) + 48|0);
   $5 = $4;
   $6 = $5;
   $7 = HEAP32[$6>>2]|0;
   $8 = (($5) + 4)|0;
   $9 = $8;
   $10 = HEAP32[$9>>2]|0;
   $11 = $7 & -256;
   $12 = ($11|0)==(1126902528);
   $13 = ($10|0)==(1129074247);
   $14 = $12 & $13;
   if ($14) {
    $15 = ((($2)) + 12|0);
    $16 = HEAP32[$15>>2]|0;
    __ZSt11__terminatePFvvE($16);
    // unreachable;
   }
  }
 }
 $17 = (__ZSt13get_terminatev()|0);
 __ZSt11__terminatePFvvE($17);
 // unreachable;
}
function __ZSt11__terminatePFvvE($0) {
 $0 = $0|0;
 var $vararg_buffer = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0;
 $vararg_buffer = sp;
 FUNCTION_TABLE_v[$0 & 3]();
 _abort_message(6464,$vararg_buffer);
 // unreachable;
}
function __ZSt13get_terminatev() {
 var $0 = 0, $1 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = HEAP32[292]|0;HEAP32[292] = (($0+0)|0);
 $1 = $0;
 return ($1|0);
}
function __ZNSt9bad_allocD2Ev($0) {
 $0 = $0|0;
 var label = 0, sp = 0;
 sp = STACKTOP;
 return;
}
function __ZNSt9bad_allocD0Ev($0) {
 $0 = $0|0;
 var label = 0, sp = 0;
 sp = STACKTOP;
 __ZdlPv($0);
 return;
}
function __ZNKSt9bad_alloc4whatEv($0) {
 $0 = $0|0;
 var label = 0, sp = 0;
 sp = STACKTOP;
 return (6504|0);
}
function __ZNSt9exceptionD2Ev($0) {
 $0 = $0|0;
 var label = 0, sp = 0;
 sp = STACKTOP;
 return;
}
function __ZN10__cxxabiv123__fundamental_type_infoD0Ev($0) {
 $0 = $0|0;
 var label = 0, sp = 0;
 sp = STACKTOP;
 __ZdlPv($0);
 return;
}
function __ZNK10__cxxabiv123__fundamental_type_info9can_catchEPKNS_16__shim_type_infoERPv($0,$1,$2) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 var $3 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $3 = ($0|0)==($1|0);
 return ($3|0);
}
function __ZN10__cxxabiv119__pointer_type_infoD0Ev($0) {
 $0 = $0|0;
 var label = 0, sp = 0;
 sp = STACKTOP;
 __ZdlPv($0);
 return;
}
function __ZNK10__cxxabiv119__pointer_type_info9can_catchEPKNS_16__shim_type_infoERPv($0,$1,$2) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 var $$$i = 0, $$0 = 0, $$4 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0;
 var $27 = 0, $28 = 0, $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0, $41 = 0, $42 = 0, $43 = 0, $5 = 0;
 var $6 = 0, $7 = 0, $8 = 0, $9 = 0, $or$cond = 0, dest = 0, label = 0, sp = 0, stop = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 64|0;
 $3 = sp;
 $4 = HEAP32[$2>>2]|0;
 $5 = HEAP32[$4>>2]|0;
 HEAP32[$2>>2] = $5;
 $6 = ($0|0)==($1|0);
 $7 = ($1|0)==(584|0);
 $$$i = $6 | $7;
 if ($$$i) {
  $$4 = 1;
 } else {
  $8 = ($1|0)==(0|0);
  if ($8) {
   $$4 = 0;
  } else {
   $9 = (___dynamic_cast($1,472,544,0)|0);
   $10 = ($9|0)==(0|0);
   if ($10) {
    $$4 = 0;
   } else {
    $11 = ((($9)) + 8|0);
    $12 = HEAP32[$11>>2]|0;
    $13 = ((($0)) + 8|0);
    $14 = HEAP32[$13>>2]|0;
    $15 = $14 ^ -1;
    $16 = $12 & $15;
    $17 = ($16|0)==(0);
    if ($17) {
     $18 = ((($0)) + 12|0);
     $19 = HEAP32[$18>>2]|0;
     $20 = ((($9)) + 12|0);
     $21 = HEAP32[$20>>2]|0;
     $22 = ($19|0)==($21|0);
     $23 = ($19|0)==(576|0);
     $or$cond = $23 | $22;
     if ($or$cond) {
      $$4 = 1;
     } else {
      $24 = ($19|0)==(0|0);
      if ($24) {
       $$4 = 0;
      } else {
       $25 = (___dynamic_cast($19,472,456,0)|0);
       $26 = ($25|0)==(0|0);
       if ($26) {
        $$4 = 0;
       } else {
        $27 = HEAP32[$20>>2]|0;
        $28 = ($27|0)==(0|0);
        if ($28) {
         $$4 = 0;
        } else {
         $29 = (___dynamic_cast($27,472,456,0)|0);
         $30 = ($29|0)==(0|0);
         if ($30) {
          $$4 = 0;
         } else {
          $31 = ((($3)) + 4|0);
          dest=$31; stop=dest+52|0; do { HEAP32[dest>>2]=0|0; dest=dest+4|0; } while ((dest|0) < (stop|0));
          HEAP32[$3>>2] = $29;
          $32 = ((($3)) + 8|0);
          HEAP32[$32>>2] = $25;
          $33 = ((($3)) + 12|0);
          HEAP32[$33>>2] = -1;
          $34 = ((($3)) + 48|0);
          HEAP32[$34>>2] = 1;
          $35 = HEAP32[$29>>2]|0;
          $36 = ((($35)) + 28|0);
          $37 = HEAP32[$36>>2]|0;
          $38 = HEAP32[$2>>2]|0;
          FUNCTION_TABLE_viiii[$37 & 7]($29,$3,$38,1);
          $39 = ((($3)) + 24|0);
          $40 = HEAP32[$39>>2]|0;
          $41 = ($40|0)==(1);
          if ($41) {
           $42 = ((($3)) + 16|0);
           $43 = HEAP32[$42>>2]|0;
           HEAP32[$2>>2] = $43;
           $$0 = 1;
          } else {
           $$0 = 0;
          }
          $$4 = $$0;
         }
        }
       }
      }
     }
    } else {
     $$4 = 0;
    }
   }
  }
 }
 STACKTOP = sp;return ($$4|0);
}
function __ZN10__cxxabiv121__vmi_class_type_infoD0Ev($0) {
 $0 = $0|0;
 var label = 0, sp = 0;
 sp = STACKTOP;
 __ZdlPv($0);
 return;
}
function __ZNK10__cxxabiv121__vmi_class_type_info16search_above_dstEPNS_19__dynamic_cast_infoEPKvS4_ib($0,$1,$2,$3,$4,$5) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 $3 = $3|0;
 $4 = $4|0;
 $5 = $5|0;
 var $$0 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0, $27 = 0, $28 = 0;
 var $29 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $6 = ((($1)) + 8|0);
 $7 = HEAP32[$6>>2]|0;
 $8 = ($0|0)==($7|0);
 if ($8) {
  __ZNK10__cxxabiv117__class_type_info29process_static_type_above_dstEPNS_19__dynamic_cast_infoEPKvS4_i(0,$1,$2,$3,$4);
 } else {
  $9 = ((($1)) + 52|0);
  $10 = HEAP16[$9>>1]|0;
  $11 = $10&255;
  $12 = ((($1)) + 53|0);
  $13 = ($10&65535) >>> 8;
  $14 = $13&255;
  $15 = ((($0)) + 16|0);
  $16 = ((($0)) + 12|0);
  $17 = HEAP32[$16>>2]|0;
  $18 = (((($0)) + 16|0) + ($17<<3)|0);
  HEAP8[$9>>0] = 0;
  HEAP8[$12>>0] = 0;
  __ZNK10__cxxabiv122__base_class_type_info16search_above_dstEPNS_19__dynamic_cast_infoEPKvS4_ib($15,$1,$2,$3,$4,$5);
  $19 = ($17|0)>(1);
  L4: do {
   if ($19) {
    $20 = ((($0)) + 24|0);
    $21 = ((($1)) + 24|0);
    $22 = ((($0)) + 8|0);
    $23 = ((($1)) + 54|0);
    $$0 = $20;
    while(1) {
     $24 = HEAP8[$23>>0]|0;
     $25 = ($24<<24>>24)==(0);
     if (!($25)) {
      break L4;
     }
     $26 = HEAP16[$9>>1]|0;
     $27 = $26&255;
     $28 = ($27<<24>>24)==(0);
     if ($28) {
      $34 = ($26&65535)<(256);
      if (!($34)) {
       $35 = HEAP32[$22>>2]|0;
       $36 = $35 & 1;
       $37 = ($36|0)==(0);
       if ($37) {
        break L4;
       }
      }
     } else {
      $29 = HEAP32[$21>>2]|0;
      $30 = ($29|0)==(1);
      if ($30) {
       break L4;
      }
      $31 = HEAP32[$22>>2]|0;
      $32 = $31 & 2;
      $33 = ($32|0)==(0);
      if ($33) {
       break L4;
      }
     }
     HEAP8[$9>>0] = 0;
     HEAP8[$12>>0] = 0;
     __ZNK10__cxxabiv122__base_class_type_info16search_above_dstEPNS_19__dynamic_cast_infoEPKvS4_ib($$0,$1,$2,$3,$4,$5);
     $38 = ((($$0)) + 8|0);
     $39 = ($38>>>0)<($18>>>0);
     if ($39) {
      $$0 = $38;
     } else {
      break;
     }
    }
   }
  } while(0);
  HEAP8[$9>>0] = $11;
  HEAP8[$12>>0] = $14;
 }
 return;
}
function __ZNK10__cxxabiv121__vmi_class_type_info16search_below_dstEPNS_19__dynamic_cast_infoEPKvib($0,$1,$2,$3,$4) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 $3 = $3|0;
 $4 = $4|0;
 var $$0 = 0, $$081$off0 = 0, $$084 = 0, $$085$off0 = 0, $$1 = 0, $$182$off0 = 0, $$186$off0 = 0, $$2 = 0, $$283$off0 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $20 = 0;
 var $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0, $27 = 0, $28 = 0, $29 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $40 = 0;
 var $41 = 0, $42 = 0, $43 = 0, $44 = 0, $45 = 0, $46 = 0, $47 = 0, $48 = 0, $49 = 0, $5 = 0, $50 = 0, $51 = 0, $52 = 0, $53 = 0, $54 = 0, $55 = 0, $56 = 0, $57 = 0, $58 = 0, $59 = 0;
 var $6 = 0, $60 = 0, $61 = 0, $62 = 0, $63 = 0, $64 = 0, $65 = 0, $66 = 0, $67 = 0, $68 = 0, $69 = 0, $7 = 0, $70 = 0, $71 = 0, $72 = 0, $73 = 0, $74 = 0, $75 = 0, $76 = 0, $77 = 0;
 var $78 = 0, $79 = 0, $8 = 0, $80 = 0, $81 = 0, $82 = 0, $83 = 0, $84 = 0, $85 = 0, $86 = 0, $87 = 0, $88 = 0, $89 = 0, $9 = 0, $90 = 0, $91 = 0, $92 = 0, $93 = 0, $94 = 0, $95 = 0;
 var $96 = 0, $97 = 0, $98 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $5 = ((($1)) + 8|0);
 $6 = HEAP32[$5>>2]|0;
 $7 = ($0|0)==($6|0);
 L1: do {
  if ($7) {
   $8 = ((($1)) + 4|0);
   $9 = HEAP32[$8>>2]|0;
   $10 = ($9|0)==($2|0);
   if ($10) {
    $11 = ((($1)) + 28|0);
    $12 = HEAP32[$11>>2]|0;
    $13 = ($12|0)==(1);
    if (!($13)) {
     HEAP32[$11>>2] = $3;
    }
   }
  } else {
   $14 = HEAP32[$1>>2]|0;
   $15 = ($0|0)==($14|0);
   if (!($15)) {
    $62 = ((($0)) + 16|0);
    $63 = ((($0)) + 12|0);
    $64 = HEAP32[$63>>2]|0;
    $65 = (((($0)) + 16|0) + ($64<<3)|0);
    __ZNK10__cxxabiv122__base_class_type_info16search_below_dstEPNS_19__dynamic_cast_infoEPKvib($62,$1,$2,$3,$4);
    $66 = ((($0)) + 24|0);
    $67 = ($64|0)>(1);
    if (!($67)) {
     break;
    }
    $68 = ((($0)) + 8|0);
    $69 = HEAP32[$68>>2]|0;
    $70 = $69 & 2;
    $71 = ($70|0)==(0);
    if ($71) {
     $72 = ((($1)) + 36|0);
     $73 = HEAP32[$72>>2]|0;
     $74 = ($73|0)==(1);
     if (!($74)) {
      $80 = $69 & 1;
      $81 = ($80|0)==(0);
      if ($81) {
       $84 = ((($1)) + 54|0);
       $$2 = $66;
       while(1) {
        $93 = HEAP8[$84>>0]|0;
        $94 = ($93<<24>>24)==(0);
        if (!($94)) {
         break L1;
        }
        $95 = HEAP32[$72>>2]|0;
        $96 = ($95|0)==(1);
        if ($96) {
         break L1;
        }
        __ZNK10__cxxabiv122__base_class_type_info16search_below_dstEPNS_19__dynamic_cast_infoEPKvib($$2,$1,$2,$3,$4);
        $97 = ((($$2)) + 8|0);
        $98 = ($97>>>0)<($65>>>0);
        if ($98) {
         $$2 = $97;
        } else {
         break L1;
        }
       }
      }
      $82 = ((($1)) + 24|0);
      $83 = ((($1)) + 54|0);
      $$1 = $66;
      while(1) {
       $85 = HEAP8[$83>>0]|0;
       $86 = ($85<<24>>24)==(0);
       if (!($86)) {
        break L1;
       }
       $87 = HEAP32[$72>>2]|0;
       $88 = ($87|0)==(1);
       if ($88) {
        $89 = HEAP32[$82>>2]|0;
        $90 = ($89|0)==(1);
        if ($90) {
         break L1;
        }
       }
       __ZNK10__cxxabiv122__base_class_type_info16search_below_dstEPNS_19__dynamic_cast_infoEPKvib($$1,$1,$2,$3,$4);
       $91 = ((($$1)) + 8|0);
       $92 = ($91>>>0)<($65>>>0);
       if ($92) {
        $$1 = $91;
       } else {
        break L1;
       }
      }
     }
    }
    $75 = ((($1)) + 54|0);
    $$0 = $66;
    while(1) {
     $76 = HEAP8[$75>>0]|0;
     $77 = ($76<<24>>24)==(0);
     if (!($77)) {
      break L1;
     }
     __ZNK10__cxxabiv122__base_class_type_info16search_below_dstEPNS_19__dynamic_cast_infoEPKvib($$0,$1,$2,$3,$4);
     $78 = ((($$0)) + 8|0);
     $79 = ($78>>>0)<($65>>>0);
     if ($79) {
      $$0 = $78;
     } else {
      break L1;
     }
    }
   }
   $16 = ((($1)) + 16|0);
   $17 = HEAP32[$16>>2]|0;
   $18 = ($17|0)==($2|0);
   if (!($18)) {
    $19 = ((($1)) + 20|0);
    $20 = HEAP32[$19>>2]|0;
    $21 = ($20|0)==($2|0);
    if (!($21)) {
     $24 = ((($1)) + 32|0);
     HEAP32[$24>>2] = $3;
     $25 = ((($1)) + 44|0);
     $26 = HEAP32[$25>>2]|0;
     $27 = ($26|0)==(4);
     if ($27) {
      break;
     }
     $28 = ((($0)) + 16|0);
     $29 = ((($0)) + 12|0);
     $30 = HEAP32[$29>>2]|0;
     $31 = (((($0)) + 16|0) + ($30<<3)|0);
     $32 = ((($1)) + 52|0);
     $33 = ((($1)) + 53|0);
     $34 = ((($1)) + 54|0);
     $35 = ((($0)) + 8|0);
     $36 = ((($1)) + 24|0);
     $$081$off0 = 0;$$084 = $28;$$085$off0 = 0;
     L34: while(1) {
      $37 = ($$084>>>0)<($31>>>0);
      if (!($37)) {
       $$283$off0 = $$081$off0;
       label = 20;
       break;
      }
      HEAP8[$32>>0] = 0;
      HEAP8[$33>>0] = 0;
      __ZNK10__cxxabiv122__base_class_type_info16search_above_dstEPNS_19__dynamic_cast_infoEPKvS4_ib($$084,$1,$2,$2,1,$4);
      $38 = HEAP8[$34>>0]|0;
      $39 = ($38<<24>>24)==(0);
      if (!($39)) {
       $$283$off0 = $$081$off0;
       label = 20;
       break;
      }
      $40 = HEAP8[$33>>0]|0;
      $41 = ($40<<24>>24)==(0);
      do {
       if ($41) {
        $$182$off0 = $$081$off0;$$186$off0 = $$085$off0;
       } else {
        $42 = HEAP8[$32>>0]|0;
        $43 = ($42<<24>>24)==(0);
        if ($43) {
         $49 = HEAP32[$35>>2]|0;
         $50 = $49 & 1;
         $51 = ($50|0)==(0);
         if ($51) {
          $$283$off0 = 1;
          label = 20;
          break L34;
         } else {
          $$182$off0 = 1;$$186$off0 = $$085$off0;
          break;
         }
        }
        $44 = HEAP32[$36>>2]|0;
        $45 = ($44|0)==(1);
        if ($45) {
         label = 25;
         break L34;
        }
        $46 = HEAP32[$35>>2]|0;
        $47 = $46 & 2;
        $48 = ($47|0)==(0);
        if ($48) {
         label = 25;
         break L34;
        } else {
         $$182$off0 = 1;$$186$off0 = 1;
        }
       }
      } while(0);
      $52 = ((($$084)) + 8|0);
      $$081$off0 = $$182$off0;$$084 = $52;$$085$off0 = $$186$off0;
     }
     do {
      if ((label|0) == 20) {
       if (!($$085$off0)) {
        HEAP32[$19>>2] = $2;
        $53 = ((($1)) + 40|0);
        $54 = HEAP32[$53>>2]|0;
        $55 = (($54) + 1)|0;
        HEAP32[$53>>2] = $55;
        $56 = ((($1)) + 36|0);
        $57 = HEAP32[$56>>2]|0;
        $58 = ($57|0)==(1);
        if ($58) {
         $59 = HEAP32[$36>>2]|0;
         $60 = ($59|0)==(2);
         if ($60) {
          HEAP8[$34>>0] = 1;
          if ($$283$off0) {
           label = 25;
           break;
          } else {
           $61 = 4;
           break;
          }
         }
        }
       }
       if ($$283$off0) {
        label = 25;
       } else {
        $61 = 4;
       }
      }
     } while(0);
     if ((label|0) == 25) {
      $61 = 3;
     }
     HEAP32[$25>>2] = $61;
     break;
    }
   }
   $22 = ($3|0)==(1);
   if ($22) {
    $23 = ((($1)) + 32|0);
    HEAP32[$23>>2] = 1;
   }
  }
 } while(0);
 return;
}
function __ZNK10__cxxabiv121__vmi_class_type_info27has_unambiguous_public_baseEPNS_19__dynamic_cast_infoEPvi($0,$1,$2,$3) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 $3 = $3|0;
 var $$0 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $4 = ((($1)) + 8|0);
 $5 = HEAP32[$4>>2]|0;
 $6 = ($0|0)==($5|0);
 L1: do {
  if ($6) {
   __ZNK10__cxxabiv117__class_type_info24process_found_base_classEPNS_19__dynamic_cast_infoEPvi(0,$1,$2,$3);
  } else {
   $7 = ((($0)) + 16|0);
   $8 = ((($0)) + 12|0);
   $9 = HEAP32[$8>>2]|0;
   $10 = (((($0)) + 16|0) + ($9<<3)|0);
   __ZNK10__cxxabiv122__base_class_type_info27has_unambiguous_public_baseEPNS_19__dynamic_cast_infoEPvi($7,$1,$2,$3);
   $11 = ($9|0)>(1);
   if ($11) {
    $12 = ((($0)) + 24|0);
    $13 = ((($1)) + 54|0);
    $$0 = $12;
    while(1) {
     __ZNK10__cxxabiv122__base_class_type_info27has_unambiguous_public_baseEPNS_19__dynamic_cast_infoEPvi($$0,$1,$2,$3);
     $14 = HEAP8[$13>>0]|0;
     $15 = ($14<<24>>24)==(0);
     if (!($15)) {
      break L1;
     }
     $16 = ((($$0)) + 8|0);
     $17 = ($16>>>0)<($10>>>0);
     if ($17) {
      $$0 = $16;
     } else {
      break;
     }
    }
   }
  }
 } while(0);
 return;
}
function __ZNK10__cxxabiv122__base_class_type_info27has_unambiguous_public_baseEPNS_19__dynamic_cast_infoEPvi($0,$1,$2,$3) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 $3 = $3|0;
 var $$0 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $4 = ((($0)) + 4|0);
 $5 = HEAP32[$4>>2]|0;
 $6 = $5 >> 8;
 $7 = $5 & 1;
 $8 = ($7|0)==(0);
 if ($8) {
  $$0 = $6;
 } else {
  $9 = HEAP32[$2>>2]|0;
  $10 = (($9) + ($6)|0);
  $11 = HEAP32[$10>>2]|0;
  $$0 = $11;
 }
 $12 = HEAP32[$0>>2]|0;
 $13 = HEAP32[$12>>2]|0;
 $14 = ((($13)) + 28|0);
 $15 = HEAP32[$14>>2]|0;
 $16 = (($2) + ($$0)|0);
 $17 = $5 & 2;
 $18 = ($17|0)!=(0);
 $19 = $18 ? $3 : 2;
 FUNCTION_TABLE_viiii[$15 & 7]($12,$1,$16,$19);
 return;
}
function __ZNK10__cxxabiv122__base_class_type_info16search_above_dstEPNS_19__dynamic_cast_infoEPKvS4_ib($0,$1,$2,$3,$4,$5) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 $3 = $3|0;
 $4 = $4|0;
 $5 = $5|0;
 var $$0 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $20 = 0, $21 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $6 = ((($0)) + 4|0);
 $7 = HEAP32[$6>>2]|0;
 $8 = $7 >> 8;
 $9 = $7 & 1;
 $10 = ($9|0)==(0);
 if ($10) {
  $$0 = $8;
 } else {
  $11 = HEAP32[$3>>2]|0;
  $12 = (($11) + ($8)|0);
  $13 = HEAP32[$12>>2]|0;
  $$0 = $13;
 }
 $14 = HEAP32[$0>>2]|0;
 $15 = HEAP32[$14>>2]|0;
 $16 = ((($15)) + 20|0);
 $17 = HEAP32[$16>>2]|0;
 $18 = (($3) + ($$0)|0);
 $19 = $7 & 2;
 $20 = ($19|0)!=(0);
 $21 = $20 ? $4 : 2;
 FUNCTION_TABLE_viiiiii[$17 & 3]($14,$1,$2,$18,$21,$5);
 return;
}
function __ZNK10__cxxabiv122__base_class_type_info16search_below_dstEPNS_19__dynamic_cast_infoEPKvib($0,$1,$2,$3,$4) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 $3 = $3|0;
 $4 = $4|0;
 var $$0 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $20 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $5 = ((($0)) + 4|0);
 $6 = HEAP32[$5>>2]|0;
 $7 = $6 >> 8;
 $8 = $6 & 1;
 $9 = ($8|0)==(0);
 if ($9) {
  $$0 = $7;
 } else {
  $10 = HEAP32[$2>>2]|0;
  $11 = (($10) + ($7)|0);
  $12 = HEAP32[$11>>2]|0;
  $$0 = $12;
 }
 $13 = HEAP32[$0>>2]|0;
 $14 = HEAP32[$13>>2]|0;
 $15 = ((($14)) + 24|0);
 $16 = HEAP32[$15>>2]|0;
 $17 = (($2) + ($$0)|0);
 $18 = $6 & 2;
 $19 = ($18|0)!=(0);
 $20 = $19 ? $3 : 2;
 FUNCTION_TABLE_viiiii[$16 & 7]($13,$1,$17,$20,$4);
 return;
}
function __ZNSt9bad_allocC2Ev($0) {
 $0 = $0|0;
 var label = 0, sp = 0;
 sp = STACKTOP;
 HEAP32[$0>>2] = (1264);
 return;
}
function __ZSt15get_new_handlerv() {
 var $0 = 0, $1 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = HEAP32[1816]|0;HEAP32[1816] = (($0+0)|0);
 $1 = $0;
 return ($1|0);
}
function ___cxa_can_catch($0,$1,$2) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 var $10 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0;
 $3 = sp;
 $4 = HEAP32[$2>>2]|0;
 HEAP32[$3>>2] = $4;
 $5 = HEAP32[$0>>2]|0;
 $6 = ((($5)) + 16|0);
 $7 = HEAP32[$6>>2]|0;
 $8 = (FUNCTION_TABLE_iiii[$7 & 15]($0,$1,$3)|0);
 $9 = $8&1;
 if ($8) {
  $10 = HEAP32[$3>>2]|0;
  HEAP32[$2>>2] = $10;
 }
 STACKTOP = sp;return ($9|0);
}
function ___cxa_is_pointer_type($0) {
 $0 = $0|0;
 var $1 = 0, $2 = 0, $3 = 0, $4 = 0, $phitmp = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $1 = ($0|0)==(0|0);
 if ($1) {
  $4 = 0;
 } else {
  $2 = (___dynamic_cast($0,472,544,0)|0);
  $phitmp = ($2|0)!=(0|0);
  $4 = $phitmp;
 }
 $3 = $4&1;
 return ($3|0);
}
function runPostSets() {
}
function _i64Subtract(a, b, c, d) {
    a = a|0; b = b|0; c = c|0; d = d|0;
    var l = 0, h = 0;
    l = (a - c)>>>0;
    h = (b - d)>>>0;
    h = (b - d - (((c>>>0) > (a>>>0))|0))>>>0; // Borrow one from high word to low word on underflow.
    return ((tempRet0 = h,l|0)|0);
}
function _memset(ptr, value, num) {
    ptr = ptr|0; value = value|0; num = num|0;
    var end = 0, aligned_end = 0, block_aligned_end = 0, value4 = 0;
    end = (ptr + num)|0;

    value = value & 0xff;
    if ((num|0) >= 67 /* 64 bytes for an unrolled loop + 3 bytes for unaligned head*/) {
      while ((ptr&3) != 0) {
        HEAP8[((ptr)>>0)]=value;
        ptr = (ptr+1)|0;
      }

      aligned_end = (end & -4)|0;
      block_aligned_end = (aligned_end - 64)|0;
      value4 = value | (value << 8) | (value << 16) | (value << 24);

      while((ptr|0) <= (block_aligned_end|0)) {
        HEAP32[((ptr)>>2)]=value4;
        HEAP32[(((ptr)+(4))>>2)]=value4;
        HEAP32[(((ptr)+(8))>>2)]=value4;
        HEAP32[(((ptr)+(12))>>2)]=value4;
        HEAP32[(((ptr)+(16))>>2)]=value4;
        HEAP32[(((ptr)+(20))>>2)]=value4;
        HEAP32[(((ptr)+(24))>>2)]=value4;
        HEAP32[(((ptr)+(28))>>2)]=value4;
        HEAP32[(((ptr)+(32))>>2)]=value4;
        HEAP32[(((ptr)+(36))>>2)]=value4;
        HEAP32[(((ptr)+(40))>>2)]=value4;
        HEAP32[(((ptr)+(44))>>2)]=value4;
        HEAP32[(((ptr)+(48))>>2)]=value4;
        HEAP32[(((ptr)+(52))>>2)]=value4;
        HEAP32[(((ptr)+(56))>>2)]=value4;
        HEAP32[(((ptr)+(60))>>2)]=value4;
        ptr = (ptr + 64)|0;
      }

      while ((ptr|0) < (aligned_end|0) ) {
        HEAP32[((ptr)>>2)]=value4;
        ptr = (ptr+4)|0;
      }
    }
    // The remaining bytes.
    while ((ptr|0) < (end|0)) {
      HEAP8[((ptr)>>0)]=value;
      ptr = (ptr+1)|0;
    }
    return (end-num)|0;
}
function _bitshift64Shl(low, high, bits) {
    low = low|0; high = high|0; bits = bits|0;
    var ander = 0;
    if ((bits|0) < 32) {
      ander = ((1 << bits) - 1)|0;
      tempRet0 = (high << bits) | ((low&(ander << (32 - bits))) >>> (32 - bits));
      return low << bits;
    }
    tempRet0 = low << (bits - 32);
    return 0;
}
function _i64Add(a, b, c, d) {
    /*
      x = a + b*2^32
      y = c + d*2^32
      result = l + h*2^32
    */
    a = a|0; b = b|0; c = c|0; d = d|0;
    var l = 0, h = 0;
    l = (a + c)>>>0;
    h = (b + d + (((l>>>0) < (a>>>0))|0))>>>0; // Add carry from low word to high word on overflow.
    return ((tempRet0 = h,l|0)|0);
}
function _bitshift64Ashr(low, high, bits) {
    low = low|0; high = high|0; bits = bits|0;
    var ander = 0;
    if ((bits|0) < 32) {
      ander = ((1 << bits) - 1)|0;
      tempRet0 = high >> bits;
      return (low >>> bits) | ((high&ander) << (32 - bits));
    }
    tempRet0 = (high|0) < 0 ? -1 : 0;
    return (high >> (bits - 32))|0;
}
function _bitshift64Lshr(low, high, bits) {
    low = low|0; high = high|0; bits = bits|0;
    var ander = 0;
    if ((bits|0) < 32) {
      ander = ((1 << bits) - 1)|0;
      tempRet0 = high >>> bits;
      return (low >>> bits) | ((high&ander) << (32 - bits));
    }
    tempRet0 = 0;
    return (high >>> (bits - 32))|0;
}
function _memcpy(dest, src, num) {
    dest = dest|0; src = src|0; num = num|0;
    var ret = 0;
    var aligned_dest_end = 0;
    var block_aligned_dest_end = 0;
    var dest_end = 0;
    // Test against a benchmarked cutoff limit for when HEAPU8.set() becomes faster to use.
    if ((num|0) >=
      8192
    ) {
      return _emscripten_memcpy_big(dest|0, src|0, num|0)|0;
    }

    ret = dest|0;
    dest_end = (dest + num)|0;
    if ((dest&3) == (src&3)) {
      // The initial unaligned < 4-byte front.
      while (dest & 3) {
        if ((num|0) == 0) return ret|0;
        HEAP8[((dest)>>0)]=((HEAP8[((src)>>0)])|0);
        dest = (dest+1)|0;
        src = (src+1)|0;
        num = (num-1)|0;
      }
      aligned_dest_end = (dest_end & -4)|0;
      block_aligned_dest_end = (aligned_dest_end - 64)|0;
      while ((dest|0) <= (block_aligned_dest_end|0) ) {
        HEAP32[((dest)>>2)]=((HEAP32[((src)>>2)])|0);
        HEAP32[(((dest)+(4))>>2)]=((HEAP32[(((src)+(4))>>2)])|0);
        HEAP32[(((dest)+(8))>>2)]=((HEAP32[(((src)+(8))>>2)])|0);
        HEAP32[(((dest)+(12))>>2)]=((HEAP32[(((src)+(12))>>2)])|0);
        HEAP32[(((dest)+(16))>>2)]=((HEAP32[(((src)+(16))>>2)])|0);
        HEAP32[(((dest)+(20))>>2)]=((HEAP32[(((src)+(20))>>2)])|0);
        HEAP32[(((dest)+(24))>>2)]=((HEAP32[(((src)+(24))>>2)])|0);
        HEAP32[(((dest)+(28))>>2)]=((HEAP32[(((src)+(28))>>2)])|0);
        HEAP32[(((dest)+(32))>>2)]=((HEAP32[(((src)+(32))>>2)])|0);
        HEAP32[(((dest)+(36))>>2)]=((HEAP32[(((src)+(36))>>2)])|0);
        HEAP32[(((dest)+(40))>>2)]=((HEAP32[(((src)+(40))>>2)])|0);
        HEAP32[(((dest)+(44))>>2)]=((HEAP32[(((src)+(44))>>2)])|0);
        HEAP32[(((dest)+(48))>>2)]=((HEAP32[(((src)+(48))>>2)])|0);
        HEAP32[(((dest)+(52))>>2)]=((HEAP32[(((src)+(52))>>2)])|0);
        HEAP32[(((dest)+(56))>>2)]=((HEAP32[(((src)+(56))>>2)])|0);
        HEAP32[(((dest)+(60))>>2)]=((HEAP32[(((src)+(60))>>2)])|0);
        dest = (dest+64)|0;
        src = (src+64)|0;
      }
      while ((dest|0) < (aligned_dest_end|0) ) {
        HEAP32[((dest)>>2)]=((HEAP32[((src)>>2)])|0);
        dest = (dest+4)|0;
        src = (src+4)|0;
      }
    } else {
      // In the unaligned copy case, unroll a bit as well.
      aligned_dest_end = (dest_end - 4)|0;
      while ((dest|0) < (aligned_dest_end|0) ) {
        HEAP8[((dest)>>0)]=((HEAP8[((src)>>0)])|0);
        HEAP8[(((dest)+(1))>>0)]=((HEAP8[(((src)+(1))>>0)])|0);
        HEAP8[(((dest)+(2))>>0)]=((HEAP8[(((src)+(2))>>0)])|0);
        HEAP8[(((dest)+(3))>>0)]=((HEAP8[(((src)+(3))>>0)])|0);
        dest = (dest+4)|0;
        src = (src+4)|0;
      }
    }
    // The remaining unaligned < 4 byte tail.
    while ((dest|0) < (dest_end|0)) {
      HEAP8[((dest)>>0)]=((HEAP8[((src)>>0)])|0);
      dest = (dest+1)|0;
      src = (src+1)|0;
    }
    return ret|0;
}
function _llvm_cttz_i32(x) {
    x = x|0;
    var ret = 0;
    ret = ((HEAP8[(((cttz_i8)+(x & 0xff))>>0)])|0);
    if ((ret|0) < 8) return ret|0;
    ret = ((HEAP8[(((cttz_i8)+((x >> 8)&0xff))>>0)])|0);
    if ((ret|0) < 8) return (ret + 8)|0;
    ret = ((HEAP8[(((cttz_i8)+((x >> 16)&0xff))>>0)])|0);
    if ((ret|0) < 8) return (ret + 16)|0;
    return (((HEAP8[(((cttz_i8)+(x >>> 24))>>0)])|0) + 24)|0;
}
function ___udivmoddi4($a$0, $a$1, $b$0, $b$1, $rem) {
    $a$0 = $a$0 | 0;
    $a$1 = $a$1 | 0;
    $b$0 = $b$0 | 0;
    $b$1 = $b$1 | 0;
    $rem = $rem | 0;
    var $n_sroa_0_0_extract_trunc = 0, $n_sroa_1_4_extract_shift$0 = 0, $n_sroa_1_4_extract_trunc = 0, $d_sroa_0_0_extract_trunc = 0, $d_sroa_1_4_extract_shift$0 = 0, $d_sroa_1_4_extract_trunc = 0, $4 = 0, $17 = 0, $37 = 0, $49 = 0, $51 = 0, $57 = 0, $58 = 0, $66 = 0, $78 = 0, $86 = 0, $88 = 0, $89 = 0, $91 = 0, $92 = 0, $95 = 0, $105 = 0, $117 = 0, $119 = 0, $125 = 0, $126 = 0, $130 = 0, $q_sroa_1_1_ph = 0, $q_sroa_0_1_ph = 0, $r_sroa_1_1_ph = 0, $r_sroa_0_1_ph = 0, $sr_1_ph = 0, $d_sroa_0_0_insert_insert99$0 = 0, $d_sroa_0_0_insert_insert99$1 = 0, $137$0 = 0, $137$1 = 0, $carry_0203 = 0, $sr_1202 = 0, $r_sroa_0_1201 = 0, $r_sroa_1_1200 = 0, $q_sroa_0_1199 = 0, $q_sroa_1_1198 = 0, $147 = 0, $149 = 0, $r_sroa_0_0_insert_insert42$0 = 0, $r_sroa_0_0_insert_insert42$1 = 0, $150$1 = 0, $151$0 = 0, $152 = 0, $154$0 = 0, $r_sroa_0_0_extract_trunc = 0, $r_sroa_1_4_extract_trunc = 0, $155 = 0, $carry_0_lcssa$0 = 0, $carry_0_lcssa$1 = 0, $r_sroa_0_1_lcssa = 0, $r_sroa_1_1_lcssa = 0, $q_sroa_0_1_lcssa = 0, $q_sroa_1_1_lcssa = 0, $q_sroa_0_0_insert_ext75$0 = 0, $q_sroa_0_0_insert_ext75$1 = 0, $q_sroa_0_0_insert_insert77$1 = 0, $_0$0 = 0, $_0$1 = 0;
    $n_sroa_0_0_extract_trunc = $a$0;
    $n_sroa_1_4_extract_shift$0 = $a$1;
    $n_sroa_1_4_extract_trunc = $n_sroa_1_4_extract_shift$0;
    $d_sroa_0_0_extract_trunc = $b$0;
    $d_sroa_1_4_extract_shift$0 = $b$1;
    $d_sroa_1_4_extract_trunc = $d_sroa_1_4_extract_shift$0;
    if (($n_sroa_1_4_extract_trunc | 0) == 0) {
      $4 = ($rem | 0) != 0;
      if (($d_sroa_1_4_extract_trunc | 0) == 0) {
        if ($4) {
          HEAP32[$rem >> 2] = ($n_sroa_0_0_extract_trunc >>> 0) % ($d_sroa_0_0_extract_trunc >>> 0);
          HEAP32[$rem + 4 >> 2] = 0;
        }
        $_0$1 = 0;
        $_0$0 = ($n_sroa_0_0_extract_trunc >>> 0) / ($d_sroa_0_0_extract_trunc >>> 0) >>> 0;
        return (tempRet0 = $_0$1, $_0$0) | 0;
      } else {
        if (!$4) {
          $_0$1 = 0;
          $_0$0 = 0;
          return (tempRet0 = $_0$1, $_0$0) | 0;
        }
        HEAP32[$rem >> 2] = $a$0 & -1;
        HEAP32[$rem + 4 >> 2] = $a$1 & 0;
        $_0$1 = 0;
        $_0$0 = 0;
        return (tempRet0 = $_0$1, $_0$0) | 0;
      }
    }
    $17 = ($d_sroa_1_4_extract_trunc | 0) == 0;
    do {
      if (($d_sroa_0_0_extract_trunc | 0) == 0) {
        if ($17) {
          if (($rem | 0) != 0) {
            HEAP32[$rem >> 2] = ($n_sroa_1_4_extract_trunc >>> 0) % ($d_sroa_0_0_extract_trunc >>> 0);
            HEAP32[$rem + 4 >> 2] = 0;
          }
          $_0$1 = 0;
          $_0$0 = ($n_sroa_1_4_extract_trunc >>> 0) / ($d_sroa_0_0_extract_trunc >>> 0) >>> 0;
          return (tempRet0 = $_0$1, $_0$0) | 0;
        }
        if (($n_sroa_0_0_extract_trunc | 0) == 0) {
          if (($rem | 0) != 0) {
            HEAP32[$rem >> 2] = 0;
            HEAP32[$rem + 4 >> 2] = ($n_sroa_1_4_extract_trunc >>> 0) % ($d_sroa_1_4_extract_trunc >>> 0);
          }
          $_0$1 = 0;
          $_0$0 = ($n_sroa_1_4_extract_trunc >>> 0) / ($d_sroa_1_4_extract_trunc >>> 0) >>> 0;
          return (tempRet0 = $_0$1, $_0$0) | 0;
        }
        $37 = $d_sroa_1_4_extract_trunc - 1 | 0;
        if (($37 & $d_sroa_1_4_extract_trunc | 0) == 0) {
          if (($rem | 0) != 0) {
            HEAP32[$rem >> 2] = 0 | $a$0 & -1;
            HEAP32[$rem + 4 >> 2] = $37 & $n_sroa_1_4_extract_trunc | $a$1 & 0;
          }
          $_0$1 = 0;
          $_0$0 = $n_sroa_1_4_extract_trunc >>> ((_llvm_cttz_i32($d_sroa_1_4_extract_trunc | 0) | 0) >>> 0);
          return (tempRet0 = $_0$1, $_0$0) | 0;
        }
        $49 = Math_clz32($d_sroa_1_4_extract_trunc | 0) | 0;
        $51 = $49 - (Math_clz32($n_sroa_1_4_extract_trunc | 0) | 0) | 0;
        if ($51 >>> 0 <= 30) {
          $57 = $51 + 1 | 0;
          $58 = 31 - $51 | 0;
          $sr_1_ph = $57;
          $r_sroa_0_1_ph = $n_sroa_1_4_extract_trunc << $58 | $n_sroa_0_0_extract_trunc >>> ($57 >>> 0);
          $r_sroa_1_1_ph = $n_sroa_1_4_extract_trunc >>> ($57 >>> 0);
          $q_sroa_0_1_ph = 0;
          $q_sroa_1_1_ph = $n_sroa_0_0_extract_trunc << $58;
          break;
        }
        if (($rem | 0) == 0) {
          $_0$1 = 0;
          $_0$0 = 0;
          return (tempRet0 = $_0$1, $_0$0) | 0;
        }
        HEAP32[$rem >> 2] = 0 | $a$0 & -1;
        HEAP32[$rem + 4 >> 2] = $n_sroa_1_4_extract_shift$0 | $a$1 & 0;
        $_0$1 = 0;
        $_0$0 = 0;
        return (tempRet0 = $_0$1, $_0$0) | 0;
      } else {
        if (!$17) {
          $117 = Math_clz32($d_sroa_1_4_extract_trunc | 0) | 0;
          $119 = $117 - (Math_clz32($n_sroa_1_4_extract_trunc | 0) | 0) | 0;
          if ($119 >>> 0 <= 31) {
            $125 = $119 + 1 | 0;
            $126 = 31 - $119 | 0;
            $130 = $119 - 31 >> 31;
            $sr_1_ph = $125;
            $r_sroa_0_1_ph = $n_sroa_0_0_extract_trunc >>> ($125 >>> 0) & $130 | $n_sroa_1_4_extract_trunc << $126;
            $r_sroa_1_1_ph = $n_sroa_1_4_extract_trunc >>> ($125 >>> 0) & $130;
            $q_sroa_0_1_ph = 0;
            $q_sroa_1_1_ph = $n_sroa_0_0_extract_trunc << $126;
            break;
          }
          if (($rem | 0) == 0) {
            $_0$1 = 0;
            $_0$0 = 0;
            return (tempRet0 = $_0$1, $_0$0) | 0;
          }
          HEAP32[$rem >> 2] = 0 | $a$0 & -1;
          HEAP32[$rem + 4 >> 2] = $n_sroa_1_4_extract_shift$0 | $a$1 & 0;
          $_0$1 = 0;
          $_0$0 = 0;
          return (tempRet0 = $_0$1, $_0$0) | 0;
        }
        $66 = $d_sroa_0_0_extract_trunc - 1 | 0;
        if (($66 & $d_sroa_0_0_extract_trunc | 0) != 0) {
          $86 = (Math_clz32($d_sroa_0_0_extract_trunc | 0) | 0) + 33 | 0;
          $88 = $86 - (Math_clz32($n_sroa_1_4_extract_trunc | 0) | 0) | 0;
          $89 = 64 - $88 | 0;
          $91 = 32 - $88 | 0;
          $92 = $91 >> 31;
          $95 = $88 - 32 | 0;
          $105 = $95 >> 31;
          $sr_1_ph = $88;
          $r_sroa_0_1_ph = $91 - 1 >> 31 & $n_sroa_1_4_extract_trunc >>> ($95 >>> 0) | ($n_sroa_1_4_extract_trunc << $91 | $n_sroa_0_0_extract_trunc >>> ($88 >>> 0)) & $105;
          $r_sroa_1_1_ph = $105 & $n_sroa_1_4_extract_trunc >>> ($88 >>> 0);
          $q_sroa_0_1_ph = $n_sroa_0_0_extract_trunc << $89 & $92;
          $q_sroa_1_1_ph = ($n_sroa_1_4_extract_trunc << $89 | $n_sroa_0_0_extract_trunc >>> ($95 >>> 0)) & $92 | $n_sroa_0_0_extract_trunc << $91 & $88 - 33 >> 31;
          break;
        }
        if (($rem | 0) != 0) {
          HEAP32[$rem >> 2] = $66 & $n_sroa_0_0_extract_trunc;
          HEAP32[$rem + 4 >> 2] = 0;
        }
        if (($d_sroa_0_0_extract_trunc | 0) == 1) {
          $_0$1 = $n_sroa_1_4_extract_shift$0 | $a$1 & 0;
          $_0$0 = 0 | $a$0 & -1;
          return (tempRet0 = $_0$1, $_0$0) | 0;
        } else {
          $78 = _llvm_cttz_i32($d_sroa_0_0_extract_trunc | 0) | 0;
          $_0$1 = 0 | $n_sroa_1_4_extract_trunc >>> ($78 >>> 0);
          $_0$0 = $n_sroa_1_4_extract_trunc << 32 - $78 | $n_sroa_0_0_extract_trunc >>> ($78 >>> 0) | 0;
          return (tempRet0 = $_0$1, $_0$0) | 0;
        }
      }
    } while (0);
    if (($sr_1_ph | 0) == 0) {
      $q_sroa_1_1_lcssa = $q_sroa_1_1_ph;
      $q_sroa_0_1_lcssa = $q_sroa_0_1_ph;
      $r_sroa_1_1_lcssa = $r_sroa_1_1_ph;
      $r_sroa_0_1_lcssa = $r_sroa_0_1_ph;
      $carry_0_lcssa$1 = 0;
      $carry_0_lcssa$0 = 0;
    } else {
      $d_sroa_0_0_insert_insert99$0 = 0 | $b$0 & -1;
      $d_sroa_0_0_insert_insert99$1 = $d_sroa_1_4_extract_shift$0 | $b$1 & 0;
      $137$0 = _i64Add($d_sroa_0_0_insert_insert99$0 | 0, $d_sroa_0_0_insert_insert99$1 | 0, -1, -1) | 0;
      $137$1 = tempRet0;
      $q_sroa_1_1198 = $q_sroa_1_1_ph;
      $q_sroa_0_1199 = $q_sroa_0_1_ph;
      $r_sroa_1_1200 = $r_sroa_1_1_ph;
      $r_sroa_0_1201 = $r_sroa_0_1_ph;
      $sr_1202 = $sr_1_ph;
      $carry_0203 = 0;
      while (1) {
        $147 = $q_sroa_0_1199 >>> 31 | $q_sroa_1_1198 << 1;
        $149 = $carry_0203 | $q_sroa_0_1199 << 1;
        $r_sroa_0_0_insert_insert42$0 = 0 | ($r_sroa_0_1201 << 1 | $q_sroa_1_1198 >>> 31);
        $r_sroa_0_0_insert_insert42$1 = $r_sroa_0_1201 >>> 31 | $r_sroa_1_1200 << 1 | 0;
        _i64Subtract($137$0 | 0, $137$1 | 0, $r_sroa_0_0_insert_insert42$0 | 0, $r_sroa_0_0_insert_insert42$1 | 0) | 0;
        $150$1 = tempRet0;
        $151$0 = $150$1 >> 31 | (($150$1 | 0) < 0 ? -1 : 0) << 1;
        $152 = $151$0 & 1;
        $154$0 = _i64Subtract($r_sroa_0_0_insert_insert42$0 | 0, $r_sroa_0_0_insert_insert42$1 | 0, $151$0 & $d_sroa_0_0_insert_insert99$0 | 0, ((($150$1 | 0) < 0 ? -1 : 0) >> 31 | (($150$1 | 0) < 0 ? -1 : 0) << 1) & $d_sroa_0_0_insert_insert99$1 | 0) | 0;
        $r_sroa_0_0_extract_trunc = $154$0;
        $r_sroa_1_4_extract_trunc = tempRet0;
        $155 = $sr_1202 - 1 | 0;
        if (($155 | 0) == 0) {
          break;
        } else {
          $q_sroa_1_1198 = $147;
          $q_sroa_0_1199 = $149;
          $r_sroa_1_1200 = $r_sroa_1_4_extract_trunc;
          $r_sroa_0_1201 = $r_sroa_0_0_extract_trunc;
          $sr_1202 = $155;
          $carry_0203 = $152;
        }
      }
      $q_sroa_1_1_lcssa = $147;
      $q_sroa_0_1_lcssa = $149;
      $r_sroa_1_1_lcssa = $r_sroa_1_4_extract_trunc;
      $r_sroa_0_1_lcssa = $r_sroa_0_0_extract_trunc;
      $carry_0_lcssa$1 = 0;
      $carry_0_lcssa$0 = $152;
    }
    $q_sroa_0_0_insert_ext75$0 = $q_sroa_0_1_lcssa;
    $q_sroa_0_0_insert_ext75$1 = 0;
    $q_sroa_0_0_insert_insert77$1 = $q_sroa_1_1_lcssa | $q_sroa_0_0_insert_ext75$1;
    if (($rem | 0) != 0) {
      HEAP32[$rem >> 2] = 0 | $r_sroa_0_1_lcssa;
      HEAP32[$rem + 4 >> 2] = $r_sroa_1_1_lcssa | 0;
    }
    $_0$1 = (0 | $q_sroa_0_0_insert_ext75$0) >>> 31 | $q_sroa_0_0_insert_insert77$1 << 1 | ($q_sroa_0_0_insert_ext75$1 << 1 | $q_sroa_0_0_insert_ext75$0 >>> 31) & 0 | $carry_0_lcssa$1;
    $_0$0 = ($q_sroa_0_0_insert_ext75$0 << 1 | 0 >>> 31) & -2 | $carry_0_lcssa$0;
    return (tempRet0 = $_0$1, $_0$0) | 0;
}
function ___udivdi3($a$0, $a$1, $b$0, $b$1) {
    $a$0 = $a$0 | 0;
    $a$1 = $a$1 | 0;
    $b$0 = $b$0 | 0;
    $b$1 = $b$1 | 0;
    var $1$0 = 0;
    $1$0 = ___udivmoddi4($a$0, $a$1, $b$0, $b$1, 0) | 0;
    return $1$0 | 0;
}
function _sbrk(increment) {
    increment = increment|0;
    var oldDynamicTop = 0;
    var oldDynamicTopOnChange = 0;
    var newDynamicTop = 0;
    var totalMemory = 0;
    increment = ((increment + 15) & -16)|0;
    oldDynamicTop = HEAP32[DYNAMICTOP_PTR>>2]|0;
    newDynamicTop = oldDynamicTop + increment | 0;

    if (((increment|0) > 0 & (newDynamicTop|0) < (oldDynamicTop|0)) // Detect and fail if we would wrap around signed 32-bit int.
      | (newDynamicTop|0) < 0) { // Also underflow, sbrk() should be able to be used to subtract.
      abortOnCannotGrowMemory()|0;
      ___setErrNo(12);
      return -1;
    }

    HEAP32[DYNAMICTOP_PTR>>2] = newDynamicTop;
    totalMemory = getTotalMemory()|0;
    if ((newDynamicTop|0) > (totalMemory|0)) {
      if ((enlargeMemory()|0) == 0) {
        ___setErrNo(12);
        HEAP32[DYNAMICTOP_PTR>>2] = oldDynamicTop;
        return -1;
      }
    }
    return oldDynamicTop|0;
}
function _memmove(dest, src, num) {
    dest = dest|0; src = src|0; num = num|0;
    var ret = 0;
    if (((src|0) < (dest|0)) & ((dest|0) < ((src + num)|0))) {
      // Unlikely case: Copy backwards in a safe manner
      ret = dest;
      src = (src + num)|0;
      dest = (dest + num)|0;
      while ((num|0) > 0) {
        dest = (dest - 1)|0;
        src = (src - 1)|0;
        num = (num - 1)|0;
        HEAP8[((dest)>>0)]=((HEAP8[((src)>>0)])|0);
      }
      dest = ret;
    } else {
      _memcpy(dest, src, num) | 0;
    }
    return dest | 0;
}
function ___uremdi3($a$0, $a$1, $b$0, $b$1) {
    $a$0 = $a$0 | 0;
    $a$1 = $a$1 | 0;
    $b$0 = $b$0 | 0;
    $b$1 = $b$1 | 0;
    var $rem = 0, __stackBase__ = 0;
    __stackBase__ = STACKTOP;
    STACKTOP = STACKTOP + 16 | 0;
    $rem = __stackBase__ | 0;
    ___udivmoddi4($a$0, $a$1, $b$0, $b$1, $rem) | 0;
    STACKTOP = __stackBase__;
    return (tempRet0 = HEAP32[$rem + 4 >> 2] | 0, HEAP32[$rem >> 2] | 0) | 0;
}
function _pthread_self() {
    return 0;
}

  
function dynCall_vi(index,a1) {
  index = index|0;
  a1=a1|0;
  FUNCTION_TABLE_vi[index&31](a1|0);
}


function dynCall_iiii(index,a1,a2,a3) {
  index = index|0;
  a1=a1|0; a2=a2|0; a3=a3|0;
  return FUNCTION_TABLE_iiii[index&15](a1|0,a2|0,a3|0)|0;
}


function dynCall_iididi(index,a1,a2,a3,a4,a5) {
  index = index|0;
  a1=a1|0; a2=+a2; a3=a3|0; a4=+a4; a5=a5|0;
  return FUNCTION_TABLE_iididi[index&1](a1|0,+a2,a3|0,+a4,a5|0)|0;
}


function dynCall_dii(index,a1,a2) {
  index = index|0;
  a1=a1|0; a2=a2|0;
  return +FUNCTION_TABLE_dii[index&3](a1|0,a2|0);
}


function dynCall_viiiii(index,a1,a2,a3,a4,a5) {
  index = index|0;
  a1=a1|0; a2=a2|0; a3=a3|0; a4=a4|0; a5=a5|0;
  FUNCTION_TABLE_viiiii[index&7](a1|0,a2|0,a3|0,a4|0,a5|0);
}


function dynCall_i(index) {
  index = index|0;
  
  return FUNCTION_TABLE_i[index&7]()|0;
}


function dynCall_iii(index,a1,a2) {
  index = index|0;
  a1=a1|0; a2=a2|0;
  return FUNCTION_TABLE_iii[index&7](a1|0,a2|0)|0;
}


function dynCall_vii(index,a1,a2) {
  index = index|0;
  a1=a1|0; a2=a2|0;
  FUNCTION_TABLE_vii[index&7](a1|0,a2|0);
}


function dynCall_ii(index,a1) {
  index = index|0;
  a1=a1|0;
  return FUNCTION_TABLE_ii[index&15](a1|0)|0;
}


function dynCall_iididii(index,a1,a2,a3,a4,a5,a6) {
  index = index|0;
  a1=a1|0; a2=+a2; a3=a3|0; a4=+a4; a5=a5|0; a6=a6|0;
  return FUNCTION_TABLE_iididii[index&1](a1|0,+a2,a3|0,+a4,a5|0,a6|0)|0;
}


function dynCall_viii(index,a1,a2,a3) {
  index = index|0;
  a1=a1|0; a2=a2|0; a3=a3|0;
  FUNCTION_TABLE_viii[index&7](a1|0,a2|0,a3|0);
}


function dynCall_v(index) {
  index = index|0;
  
  FUNCTION_TABLE_v[index&3]();
}


function dynCall_viid(index,a1,a2,a3) {
  index = index|0;
  a1=a1|0; a2=a2|0; a3=+a3;
  FUNCTION_TABLE_viid[index&3](a1|0,a2|0,+a3);
}


function dynCall_iiiii(index,a1,a2,a3,a4) {
  index = index|0;
  a1=a1|0; a2=a2|0; a3=a3|0; a4=a4|0;
  return FUNCTION_TABLE_iiiii[index&3](a1|0,a2|0,a3|0,a4|0)|0;
}


function dynCall_viiiiii(index,a1,a2,a3,a4,a5,a6) {
  index = index|0;
  a1=a1|0; a2=a2|0; a3=a3|0; a4=a4|0; a5=a5|0; a6=a6|0;
  FUNCTION_TABLE_viiiiii[index&3](a1|0,a2|0,a3|0,a4|0,a5|0,a6|0);
}


function dynCall_iidid(index,a1,a2,a3,a4) {
  index = index|0;
  a1=a1|0; a2=+a2; a3=a3|0; a4=+a4;
  return FUNCTION_TABLE_iidid[index&1](a1|0,+a2,a3|0,+a4)|0;
}


function dynCall_iiiiii(index,a1,a2,a3,a4,a5) {
  index = index|0;
  a1=a1|0; a2=a2|0; a3=a3|0; a4=a4|0; a5=a5|0;
  return FUNCTION_TABLE_iiiiii[index&1](a1|0,a2|0,a3|0,a4|0,a5|0)|0;
}


function dynCall_viiii(index,a1,a2,a3,a4) {
  index = index|0;
  a1=a1|0; a2=a2|0; a3=a3|0; a4=a4|0;
  FUNCTION_TABLE_viiii[index&7](a1|0,a2|0,a3|0,a4|0);
}

function b0(p0) {
 p0 = p0|0; abort(0);
}
function b1(p0,p1,p2) {
 p0 = p0|0;p1 = p1|0;p2 = p2|0; abort(1);return 0;
}
function b2(p0,p1,p2,p3,p4) {
 p0 = p0|0;p1 = +p1;p2 = p2|0;p3 = +p3;p4 = p4|0; abort(2);return 0;
}
function b3(p0,p1) {
 p0 = p0|0;p1 = p1|0; abort(3);return +0;
}
function b4(p0,p1,p2,p3,p4) {
 p0 = p0|0;p1 = p1|0;p2 = p2|0;p3 = p3|0;p4 = p4|0; abort(4);
}
function b5() {
 ; abort(5);return 0;
}
function b6(p0,p1) {
 p0 = p0|0;p1 = p1|0; abort(6);return 0;
}
function b7(p0,p1) {
 p0 = p0|0;p1 = p1|0; abort(7);
}
function b8(p0) {
 p0 = p0|0; abort(8);return 0;
}
function b9(p0,p1,p2,p3,p4,p5) {
 p0 = p0|0;p1 = +p1;p2 = p2|0;p3 = +p3;p4 = p4|0;p5 = p5|0; abort(9);return 0;
}
function b10(p0,p1,p2) {
 p0 = p0|0;p1 = p1|0;p2 = p2|0; abort(10);
}
function b11() {
 ; abort(11);
}
function b12(p0,p1,p2) {
 p0 = p0|0;p1 = p1|0;p2 = +p2; abort(12);
}
function b13(p0,p1,p2,p3) {
 p0 = p0|0;p1 = p1|0;p2 = p2|0;p3 = p3|0; abort(13);return 0;
}
function b14(p0,p1,p2,p3,p4,p5) {
 p0 = p0|0;p1 = p1|0;p2 = p2|0;p3 = p3|0;p4 = p4|0;p5 = p5|0; abort(14);
}
function b15(p0,p1,p2,p3) {
 p0 = p0|0;p1 = +p1;p2 = p2|0;p3 = +p3; abort(15);return 0;
}
function b16(p0,p1,p2,p3,p4) {
 p0 = p0|0;p1 = p1|0;p2 = p2|0;p3 = p3|0;p4 = p4|0; abort(16);return 0;
}
function b17(p0,p1,p2,p3) {
 p0 = p0|0;p1 = p1|0;p2 = p2|0;p3 = p3|0; abort(17);
}

// EMSCRIPTEN_END_FUNCS
var FUNCTION_TABLE_vi = [b0,__ZN10__cxxabiv116__shim_type_infoD2Ev,__ZN10__cxxabiv117__class_type_infoD0Ev,__ZNK10__cxxabiv116__shim_type_info5noop1Ev,__ZNK10__cxxabiv116__shim_type_info5noop2Ev,__ZN10__cxxabiv120__si_class_type_infoD0Ev,__ZNSt9bad_allocD2Ev,__ZNSt9bad_allocD0Ev,__ZN10__cxxabiv123__fundamental_type_infoD0Ev,__ZN10__cxxabiv119__pointer_type_infoD0Ev,__ZN10__cxxabiv121__vmi_class_type_infoD0Ev,__ZN10emscripten8internal14raw_destructorI13emOctaTerrainEEvPT_,__ZN10emscripten8internal14raw_destructorI7ChunkIdEEvPT_,__ZN10emscripten8internal14raw_destructorI4vec3EEvPT_,__ZN10emscripten8internal14raw_destructorI4vec9EEvPT_,__ZN10emscripten8internal14raw_destructorI4mat4EEvPT_,__ZN10emscripten8internal14raw_destructorINSt3__26vectorI7ChunkIdNS2_9allocatorIS4_EEEEEEvPT_,__ZN10emscripten8internal14raw_destructorINSt3__26vectorI4vec9NS2_9allocatorIS4_EEEEEEvPT_,_cleanup,__ZN10__cxxabiv112_GLOBAL__N_19destruct_EPv,b0,b0,b0,b0,b0,b0,b0,b0,b0
,b0,b0,b0];
var FUNCTION_TABLE_iiii = [b1,___stdio_write,___stdio_seek,___stdout_write,__ZNK10__cxxabiv117__class_type_info9can_catchEPKNS_16__shim_type_infoERPv,__ZNK10__cxxabiv123__fundamental_type_info9can_catchEPKNS_16__shim_type_infoERPv,__ZNK10__cxxabiv119__pointer_type_info9can_catchEPKNS_16__shim_type_infoERPv,__ZN10emscripten8internal12operator_newI13emOctaTerrainJfifEEEPT_DpOT0_,__ZN10emscripten8internal15FunctionInvokerIPFNS_3valERKNSt3__26vectorI7ChunkIdNS3_9allocatorIS5_EEEEjES2_SA_JjEE6invokeEPSC_PS8_j,__ZN10emscripten8internal12VectorAccessINSt3__26vectorI7ChunkIdNS2_9allocatorIS4_EEEEE3setERS7_jRKS4_,__ZN10emscripten8internal15FunctionInvokerIPFNS_3valERKNSt3__26vectorI4vec9NS3_9allocatorIS5_EEEEjES2_SA_JjEE6invokeEPSC_PS8_j,__ZN10emscripten8internal12VectorAccessINSt3__26vectorI4vec9NS2_9allocatorIS4_EEEEE3setERS7_jRKS4_,b1,b1,b1,b1];
var FUNCTION_TABLE_iididi = [b2,__ZN10emscripten8internal7InvokerIP13emOctaTerrainJOfOiS4_ObEE6invokeEPFS3_S4_S5_S4_S6_Efifb];
var FUNCTION_TABLE_dii = [b3,__ZN10emscripten8internal12get_by_indexI4vec3fEENS0_11BindingTypeIT0_E8WireTypeEiRT_,__ZN10emscripten8internal12get_by_indexI4vec9fEENS0_11BindingTypeIT0_E8WireTypeEiRT_,__ZN10emscripten8internal12get_by_indexI4mat4fEENS0_11BindingTypeIT0_E8WireTypeEiRT_];
var FUNCTION_TABLE_viiiii = [b4,__ZNK10__cxxabiv117__class_type_info16search_below_dstEPNS_19__dynamic_cast_infoEPKvib,__ZNK10__cxxabiv120__si_class_type_info16search_below_dstEPNS_19__dynamic_cast_infoEPKvib,__ZNK10__cxxabiv121__vmi_class_type_info16search_below_dstEPNS_19__dynamic_cast_infoEPKvib,__ZN10emscripten8internal13MethodInvokerIM13emOctaTerrainFv4vec34mat4NSt3__26vectorI7ChunkIdNS5_9allocatorIS7_EEEEEvPS2_JS3_S4_SA_EE6invokeERKSC_SD_PS3_PS4_PSA_,b4,b4,b4];
var FUNCTION_TABLE_i = [b5,__ZN10emscripten8internal15raw_constructorI7ChunkIdJEEEPT_DpNS0_11BindingTypeIT0_E8WireTypeE,__ZN10emscripten8internal15raw_constructorI4vec3JEEEPT_DpNS0_11BindingTypeIT0_E8WireTypeE,__ZN10emscripten8internal15raw_constructorI4vec9JEEEPT_DpNS0_11BindingTypeIT0_E8WireTypeE,__ZN10emscripten8internal15raw_constructorI4mat4JEEEPT_DpNS0_11BindingTypeIT0_E8WireTypeE,__ZN10emscripten8internal12operator_newINSt3__26vectorI7ChunkIdNS2_9allocatorIS4_EEEEJEEEPT_DpOT0_,__ZN10emscripten8internal12operator_newINSt3__26vectorI4vec9NS2_9allocatorIS4_EEEEJEEEPT_DpOT0_,b5];
var FUNCTION_TABLE_iii = [b6,__ZN10emscripten8internal13MethodInvokerIM13emOctaTerrainFNSt3__26vectorI7ChunkIdNS3_9allocatorIS5_EEEEvES8_PS2_JEE6invokeERKSA_SB_,__ZN10emscripten8internal13MethodInvokerIM13emOctaTerrainFNSt3__26vectorI4vec9NS3_9allocatorIS5_EEEEvES8_PS2_JEE6invokeERKSA_SB_,__ZN10emscripten8internal12MemberAccessI7ChunkIdjE7getWireIS2_EEjRKMS2_jRKT_,__ZN10emscripten8internal13MethodInvokerIMNSt3__26vectorI7ChunkIdNS2_9allocatorIS4_EEEEKFjvEjPKS7_JEE6invokeERKS9_SB_,__ZN10emscripten8internal12VectorAccessINSt3__26vectorI7ChunkIdNS2_9allocatorIS4_EEEEE3getERKS7_j,__ZN10emscripten8internal13MethodInvokerIMNSt3__26vectorI4vec9NS2_9allocatorIS4_EEEEKFjvEjPKS7_JEE6invokeERKS9_SB_,__ZN10emscripten8internal12VectorAccessINSt3__26vectorI4vec9NS2_9allocatorIS4_EEEEE3getERKS7_j];
var FUNCTION_TABLE_vii = [b7,__ZN13emOctaTerrain8getAddedEv,__ZN13emOctaTerrain10getRemovedEv,__ZN13emOctaTerrain9getKeepedEv,__ZN13emOctaTerrain11getVerticesEv,__ZNSt3__26vectorI7ChunkIdNS_9allocatorIS1_EEE9push_backERKS1_,__ZNSt3__26vectorI4vec9NS_9allocatorIS1_EEE9push_backERKS1_,b7];
var FUNCTION_TABLE_ii = [b8,___stdio_close,__ZNKSt9bad_alloc4whatEv,__ZN10emscripten8internal13getActualTypeI13emOctaTerrainEEPKvPT_,__ZN10emscripten8internal13getActualTypeINSt3__26vectorI7ChunkIdNS2_9allocatorIS4_EEEEEEPKvPT_,__ZN10emscripten8internal7InvokerIPNSt3__26vectorI7ChunkIdNS2_9allocatorIS4_EEEEJEE6invokeEPFS8_vE,__ZNKSt3__26vectorI7ChunkIdNS_9allocatorIS1_EEE4sizeEv,__ZN10emscripten8internal13getActualTypeINSt3__26vectorI4vec9NS2_9allocatorIS4_EEEEEEPKvPT_,__ZN10emscripten8internal7InvokerIPNSt3__26vectorI4vec9NS2_9allocatorIS4_EEEEJEE6invokeEPFS8_vE,__ZNKSt3__26vectorI4vec9NS_9allocatorIS1_EEE4sizeEv,b8,b8,b8,b8,b8,b8];
var FUNCTION_TABLE_iididii = [b9,__ZN10emscripten8internal7InvokerIP13emOctaTerrainJOfOiS4_ObS6_EE6invokeEPFS3_S4_S5_S4_S6_S6_Efifbb];
var FUNCTION_TABLE_viii = [b10,__ZN10emscripten8internal12MemberAccessI7ChunkIdjE7setWireIS2_EEvRKMS2_jRT_j,__ZN10emscripten8internal13MethodInvokerIMNSt3__26vectorI7ChunkIdNS2_9allocatorIS4_EEEEFvRKS4_EvPS7_JS9_EE6invokeERKSB_SC_PS4_,__ZNSt3__26vectorI7ChunkIdNS_9allocatorIS1_EEE6resizeEjRKS1_,__ZN10emscripten8internal13MethodInvokerIMNSt3__26vectorI4vec9NS2_9allocatorIS4_EEEEFvRKS4_EvPS7_JS9_EE6invokeERKSB_SC_PS4_,__ZNSt3__26vectorI4vec9NS_9allocatorIS1_EEE6resizeEjRKS1_,b10,b10];
var FUNCTION_TABLE_v = [b11,__ZL25default_terminate_handlerv,__ZN10__cxxabiv112_GLOBAL__N_110construct_Ev,b11];
var FUNCTION_TABLE_viid = [b12,__ZN10emscripten8internal12set_by_indexI4vec3fEEviRT_NS0_11BindingTypeIT0_E8WireTypeE,__ZN10emscripten8internal12set_by_indexI4vec9fEEviRT_NS0_11BindingTypeIT0_E8WireTypeE,__ZN10emscripten8internal12set_by_indexI4mat4fEEviRT_NS0_11BindingTypeIT0_E8WireTypeE];
var FUNCTION_TABLE_iiiii = [b13,__ZN10emscripten8internal12operator_newI13emOctaTerrainJfifbEEEPT_DpOT0_,__ZN10emscripten8internal15FunctionInvokerIPFbRNSt3__26vectorI7ChunkIdNS2_9allocatorIS4_EEEEjRKS4_EbS8_JjSA_EE6invokeEPSC_PS7_jPS4_,__ZN10emscripten8internal15FunctionInvokerIPFbRNSt3__26vectorI4vec9NS2_9allocatorIS4_EEEEjRKS4_EbS8_JjSA_EE6invokeEPSC_PS7_jPS4_];
var FUNCTION_TABLE_viiiiii = [b14,__ZNK10__cxxabiv117__class_type_info16search_above_dstEPNS_19__dynamic_cast_infoEPKvS4_ib,__ZNK10__cxxabiv120__si_class_type_info16search_above_dstEPNS_19__dynamic_cast_infoEPKvS4_ib,__ZNK10__cxxabiv121__vmi_class_type_info16search_above_dstEPNS_19__dynamic_cast_infoEPKvS4_ib];
var FUNCTION_TABLE_iidid = [b15,__ZN10emscripten8internal7InvokerIP13emOctaTerrainJOfOiS4_EE6invokeEPFS3_S4_S5_S4_Efif];
var FUNCTION_TABLE_iiiiii = [b16,__ZN10emscripten8internal12operator_newI13emOctaTerrainJfifbbEEEPT_DpOT0_];
var FUNCTION_TABLE_viiii = [b17,__ZNK10__cxxabiv117__class_type_info27has_unambiguous_public_baseEPNS_19__dynamic_cast_infoEPvi,__ZNK10__cxxabiv120__si_class_type_info27has_unambiguous_public_baseEPNS_19__dynamic_cast_infoEPvi,__ZNK10__cxxabiv121__vmi_class_type_info27has_unambiguous_public_baseEPNS_19__dynamic_cast_infoEPvi,__ZN13emOctaTerrain8generateE4vec34mat4NSt3__26vectorI7ChunkIdNS2_9allocatorIS4_EEEE,__ZN10emscripten8internal13MethodInvokerIMNSt3__26vectorI7ChunkIdNS2_9allocatorIS4_EEEEFvjRKS4_EvPS7_JjS9_EE6invokeERKSB_SC_jPS4_,__ZN10emscripten8internal13MethodInvokerIMNSt3__26vectorI4vec9NS2_9allocatorIS4_EEEEFvjRKS4_EvPS7_JjS9_EE6invokeERKSB_SC_jPS4_,b17];

  return { _llvm_cttz_i32: _llvm_cttz_i32, ___cxa_can_catch: ___cxa_can_catch, _bitshift64Ashr: _bitshift64Ashr, _fflush: _fflush, ___udivmoddi4: ___udivmoddi4, ___cxa_is_pointer_type: ___cxa_is_pointer_type, _i64Add: _i64Add, _memmove: _memmove, _pthread_self: _pthread_self, _i64Subtract: _i64Subtract, _memset: _memset, _malloc: _malloc, _memcpy: _memcpy, ___getTypeName: ___getTypeName, _sbrk: _sbrk, _bitshift64Lshr: _bitshift64Lshr, _free: _free, ___udivdi3: ___udivdi3, ___uremdi3: ___uremdi3, ___errno_location: ___errno_location, _bitshift64Shl: _bitshift64Shl, __GLOBAL__sub_I_em_cpp: __GLOBAL__sub_I_em_cpp, __GLOBAL__sub_I_bind_cpp: __GLOBAL__sub_I_bind_cpp, runPostSets: runPostSets, stackAlloc: stackAlloc, stackSave: stackSave, stackRestore: stackRestore, establishStackSpace: establishStackSpace, setThrew: setThrew, setTempRet0: setTempRet0, getTempRet0: getTempRet0, dynCall_vi: dynCall_vi, dynCall_iiii: dynCall_iiii, dynCall_iididi: dynCall_iididi, dynCall_dii: dynCall_dii, dynCall_viiiii: dynCall_viiiii, dynCall_i: dynCall_i, dynCall_iii: dynCall_iii, dynCall_vii: dynCall_vii, dynCall_ii: dynCall_ii, dynCall_iididii: dynCall_iididii, dynCall_viii: dynCall_viii, dynCall_v: dynCall_v, dynCall_viid: dynCall_viid, dynCall_iiiii: dynCall_iiiii, dynCall_viiiiii: dynCall_viiiiii, dynCall_iidid: dynCall_iidid, dynCall_iiiiii: dynCall_iiiiii, dynCall_viiii: dynCall_viiii };
})
// EMSCRIPTEN_END_ASM
(Module.asmGlobalArg, Module.asmLibraryArg, buffer);

var _memset = Module["_memset"] = asm["_memset"];
var _bitshift64Lshr = Module["_bitshift64Lshr"] = asm["_bitshift64Lshr"];
var _bitshift64Shl = Module["_bitshift64Shl"] = asm["_bitshift64Shl"];
var _fflush = Module["_fflush"] = asm["_fflush"];
var __GLOBAL__sub_I_em_cpp = Module["__GLOBAL__sub_I_em_cpp"] = asm["__GLOBAL__sub_I_em_cpp"];
var ___cxa_is_pointer_type = Module["___cxa_is_pointer_type"] = asm["___cxa_is_pointer_type"];
var _bitshift64Ashr = Module["_bitshift64Ashr"] = asm["_bitshift64Ashr"];
var _llvm_cttz_i32 = Module["_llvm_cttz_i32"] = asm["_llvm_cttz_i32"];
var _sbrk = Module["_sbrk"] = asm["_sbrk"];
var _memcpy = Module["_memcpy"] = asm["_memcpy"];
var ___uremdi3 = Module["___uremdi3"] = asm["___uremdi3"];
var _i64Subtract = Module["_i64Subtract"] = asm["_i64Subtract"];
var __GLOBAL__sub_I_bind_cpp = Module["__GLOBAL__sub_I_bind_cpp"] = asm["__GLOBAL__sub_I_bind_cpp"];
var ___udivmoddi4 = Module["___udivmoddi4"] = asm["___udivmoddi4"];
var _i64Add = Module["_i64Add"] = asm["_i64Add"];
var _pthread_self = Module["_pthread_self"] = asm["_pthread_self"];
var ___getTypeName = Module["___getTypeName"] = asm["___getTypeName"];
var ___udivdi3 = Module["___udivdi3"] = asm["___udivdi3"];
var ___errno_location = Module["___errno_location"] = asm["___errno_location"];
var ___cxa_can_catch = Module["___cxa_can_catch"] = asm["___cxa_can_catch"];
var _free = Module["_free"] = asm["_free"];
var runPostSets = Module["runPostSets"] = asm["runPostSets"];
var _memmove = Module["_memmove"] = asm["_memmove"];
var _malloc = Module["_malloc"] = asm["_malloc"];
var dynCall_vi = Module["dynCall_vi"] = asm["dynCall_vi"];
var dynCall_iiii = Module["dynCall_iiii"] = asm["dynCall_iiii"];
var dynCall_iididi = Module["dynCall_iididi"] = asm["dynCall_iididi"];
var dynCall_dii = Module["dynCall_dii"] = asm["dynCall_dii"];
var dynCall_viiiii = Module["dynCall_viiiii"] = asm["dynCall_viiiii"];
var dynCall_i = Module["dynCall_i"] = asm["dynCall_i"];
var dynCall_iii = Module["dynCall_iii"] = asm["dynCall_iii"];
var dynCall_vii = Module["dynCall_vii"] = asm["dynCall_vii"];
var dynCall_ii = Module["dynCall_ii"] = asm["dynCall_ii"];
var dynCall_iididii = Module["dynCall_iididii"] = asm["dynCall_iididii"];
var dynCall_viii = Module["dynCall_viii"] = asm["dynCall_viii"];
var dynCall_v = Module["dynCall_v"] = asm["dynCall_v"];
var dynCall_viid = Module["dynCall_viid"] = asm["dynCall_viid"];
var dynCall_iiiii = Module["dynCall_iiiii"] = asm["dynCall_iiiii"];
var dynCall_viiiiii = Module["dynCall_viiiiii"] = asm["dynCall_viiiiii"];
var dynCall_iidid = Module["dynCall_iidid"] = asm["dynCall_iidid"];
var dynCall_iiiiii = Module["dynCall_iiiiii"] = asm["dynCall_iiiiii"];
var dynCall_viiii = Module["dynCall_viiii"] = asm["dynCall_viiii"];
;

Runtime.stackAlloc = asm['stackAlloc'];
Runtime.stackSave = asm['stackSave'];
Runtime.stackRestore = asm['stackRestore'];
Runtime.establishStackSpace = asm['establishStackSpace'];

Runtime.setTempRet0 = asm['setTempRet0'];
Runtime.getTempRet0 = asm['getTempRet0'];



// === Auto-generated postamble setup entry stuff ===

Module['asm'] = asm;





function ExitStatus(status) {
  this.name = "ExitStatus";
  this.message = "Program terminated with exit(" + status + ")";
  this.status = status;
};
ExitStatus.prototype = new Error();
ExitStatus.prototype.constructor = ExitStatus;

var initialStackTop;
var preloadStartTime = null;
var calledMain = false;

dependenciesFulfilled = function runCaller() {
  // If run has never been called, and we should call run (INVOKE_RUN is true, and Module.noInitialRun is not false)
  if (!Module['calledRun']) run();
  if (!Module['calledRun']) dependenciesFulfilled = runCaller; // try this again later, after new deps are fulfilled
}

Module['callMain'] = Module.callMain = function callMain(args) {

  args = args || [];

  ensureInitRuntime();

  var argc = args.length+1;
  function pad() {
    for (var i = 0; i < 4-1; i++) {
      argv.push(0);
    }
  }
  var argv = [allocate(intArrayFromString(Module['thisProgram']), 'i8', ALLOC_NORMAL) ];
  pad();
  for (var i = 0; i < argc-1; i = i + 1) {
    argv.push(allocate(intArrayFromString(args[i]), 'i8', ALLOC_NORMAL));
    pad();
  }
  argv.push(0);
  argv = allocate(argv, 'i32', ALLOC_NORMAL);


  try {

    var ret = Module['_main'](argc, argv, 0);


    // if we're not running an evented main loop, it's time to exit
    exit(ret, /* implicit = */ true);
  }
  catch(e) {
    if (e instanceof ExitStatus) {
      // exit() throws this once it's done to make sure execution
      // has been stopped completely
      return;
    } else if (e == 'SimulateInfiniteLoop') {
      // running an evented main loop, don't immediately exit
      Module['noExitRuntime'] = true;
      return;
    } else {
      if (e && typeof e === 'object' && e.stack) Module.printErr('exception thrown: ' + [e, e.stack]);
      throw e;
    }
  } finally {
    calledMain = true;
  }
}




function run(args) {
  args = args || Module['arguments'];

  if (preloadStartTime === null) preloadStartTime = Date.now();

  if (runDependencies > 0) {
    return;
  }


  preRun();

  if (runDependencies > 0) return; // a preRun added a dependency, run will be called later
  if (Module['calledRun']) return; // run may have just been called through dependencies being fulfilled just in this very frame

  function doRun() {
    if (Module['calledRun']) return; // run may have just been called while the async setStatus time below was happening
    Module['calledRun'] = true;

    if (ABORT) return;

    ensureInitRuntime();

    preMain();


    if (Module['onRuntimeInitialized']) Module['onRuntimeInitialized']();

    if (Module['_main'] && shouldRunNow) Module['callMain'](args);

    postRun();
  }

  if (Module['setStatus']) {
    Module['setStatus']('Running...');
    setTimeout(function() {
      setTimeout(function() {
        Module['setStatus']('');
      }, 1);
      doRun();
    }, 1);
  } else {
    doRun();
  }
}
Module['run'] = Module.run = run;

function exit(status, implicit) {
  if (implicit && Module['noExitRuntime']) {
    return;
  }

  if (Module['noExitRuntime']) {
  } else {

    ABORT = true;
    EXITSTATUS = status;
    STACKTOP = initialStackTop;

    exitRuntime();

    if (Module['onExit']) Module['onExit'](status);
  }

  if (ENVIRONMENT_IS_NODE) {
    process['exit'](status);
  } else if (ENVIRONMENT_IS_SHELL && typeof quit === 'function') {
    quit(status);
  }
  // if we reach here, we must throw an exception to halt the current execution
  throw new ExitStatus(status);
}
Module['exit'] = Module.exit = exit;

var abortDecorators = [];

function abort(what) {
  if (what !== undefined) {
    Module.print(what);
    Module.printErr(what);
    what = JSON.stringify(what)
  } else {
    what = '';
  }

  ABORT = true;
  EXITSTATUS = 1;

  var extra = '\nIf this abort() is unexpected, build with -s ASSERTIONS=1 which can give more information.';

  var output = 'abort(' + what + ') at ' + stackTrace() + extra;
  if (abortDecorators) {
    abortDecorators.forEach(function(decorator) {
      output = decorator(output, what);
    });
  }
  throw output;
}
Module['abort'] = Module.abort = abort;

// {{PRE_RUN_ADDITIONS}}

if (Module['preInit']) {
  if (typeof Module['preInit'] == 'function') Module['preInit'] = [Module['preInit']];
  while (Module['preInit'].length > 0) {
    Module['preInit'].pop()();
  }
}

// shouldRunNow refers to calling main(), not run().
var shouldRunNow = true;
if (Module['noInitialRun']) {
  shouldRunNow = false;
}


run();

// {{POST_RUN_ADDITIONS}}





// {{MODULE_ADDITIONS}}



