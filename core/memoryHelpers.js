/* Memory helpers for finding windows in Windows, v0.3.
 Trying to save some typing in the plugin files.
 Created by nugarp/spazzy. Last Updated 3/1/24.
 
 v0.3: Now supports new memoryHelpers/memoryjs interface
 that natively supports 64-bit addresses. Recommended
 using memoryjs >= 3.5.1.

 v0.2: Add support for pattern match searching. We will do
 so using one of my own external Dlls and calling them
 via edge-js. The DLL is MemHelpers64. Needed for Yuzu or
 other games where pointers are difficult to obtain.

 */
 
 /*
 Modified by SamRevolt
 - Added UINT8 Type in module.exports
 Last updated 21/09/2024.  
 */

let memoryjs = require('memoryjs'); // memory searching lib
const edge = require('edge-js'); // call into c#	
let pscan = edge.func({ assemblyFile: 'core/lib/MemHelpers64.dll', typeName:'MemHelpers64', methodName: 'PatternScanMappedMemoryByProcessId' });
let rscan = edge.func({ assemblyFile: 'core/lib/MemHelpers64.dll', typeName:'MemHelpers64', methodName: 'FindBaseAddressByProcessId' });

class MemoryHelper {
    #process = null;
    constructor(process) {
        this.#process = process;
    };

    read = (address, type) => {
        // with the updated memoryjs, we still can't put in BigInt values as addresses
        // although we can still use Number types with a range above 32-bit limitations
        // because js numbers are up to 2^53-1, which gives PLENTY of room for computers
        // with multiple petabytes of RAM. This seems like an OK tradeoff just so folks
        // don't have to use an older version or keep patching my fixes for memoryjs.
        //
        // readMemory doesn't handle reading BigInt so we'll just parseInt(address)
        return memoryjs.readMemory(this.#process.handle, parseInt(address), type);
    };

    // baseAddress, uint64[]
    // originally based on Argonlefou's DemulShooter "ReadPtrChain" method.
    // in an ideal world, we return and manipulate BigInt only - I feel dirty, here -
    // but in a realistic world, memoryjs is still missing that functionality for some params,
    // so we'll instead just settle for a rounded address (in theory, it still seems fully
    // accurate for PCs with many PB of RAM so we'll cross that bridge when we get there).
    // I don't want to expose this method to the outside world since it would encourage bad
    // coding for plugins, so we'll mark it protected (#) instead of public.
    // input: Number(address), Number[] offsets, Number(maxDigits)
    // returns: Number
    #readChain64AsNumber = (address, offsets, maxDigits) => {
        let ptr = this.read(parseInt(address), memoryjs.UINT64);
        if (ptr === 0 || ptr === 0n) { return 0; }
        for (let i = 0; i < offsets.length; i++) {
            ptr = this.read(parseInt(ptr + BigInt(offsets[i])), memoryjs.UINT64);
            if (ptr === 0 || ptr === 0n || ptr === 0xffffffffffffffffn) { return 0; }
            if (maxDigits && ptr.toString(16).length > maxDigits) { return 0; } // use maxDigits to establish an upper bound on a valid address
        }
        return parseInt(ptr);
    };

    // for compatibility reasons for plugins that expect a BigInt
    // return value. And because eventually, we'll want all plugins
    // to use this method instead of "AsNumber" since that is technically
    // correct.
    readChain64 = (address, offsets, maxDigits) => {
        return BigInt(this.#readChain64AsNumber(address, offsets, maxDigits));
    };

    readChain32 = (address, offsets) => {
        let ptr = this.read(address, memoryjs.UINT32);
        if (ptr === 0) { return 0; }
        for (let i = 0; i < offsets.length; i++) {
            ptr = this.read(ptr + offsets[i], memoryjs.UINT32);
            if (ptr === 0) { return 0; }
        };
        return ptr;
    };

    findPattern = (pattern) => {
        // return memoryjs.findPattern(this.#process.handle, pattern, memoryjs.READ, 0);
        let p = memoryjs.findPattern(this.#process.handle, pattern, memoryjs.NORMAL, 0);
        // let p = memoryjs.findPattern(this.#process.handle, this.#process.szExeFile, pattern, memoryjs.READ, 0, 0);
        return p;
    };

    // 64bit searches mapped memory. Useful for emulators like Yuzu. Default is that the system region must be at least 2GB. May consider lowering in the future.	
    // This will avoid unnecessarily scanning smaller allocated regions of memory.	
    findPatternInMappedMemory = (patternString, startAddress = 0) => {
        let p = new Promise((res, rej) => {
            let pattern = Buffer.from(patternString, "hex")
            let processId = this.#process.th32ProcessID
            pscan({ processId: processId, pattern: pattern, minRegionBytes: 2 * 1024 * 1024 * 1024, maxBufferSize: 16 * 1024 * 1024, startAddress: startAddress }, (err, result) => {
                if (err) {
                    res(0);
                } else {
                    res(result);
                }
            });
        });
        return p;
    };

    findBaseAddressInMappedMemory = (minRegionBytes = 2 * 1024 * 1024 * 1024, startAddress = 0) => {
        let p = new Promise((res, rej) => {
            rscan({ processId: this.#process.th32ProcessID, minRegionBytes: minRegionBytes, startAddress: startAddress }, (err, result) => {
                if (err) {
                    res(0);
                } else {
                    res(result);
                }
            });
        });
        return p;
    };

    readBuffer = (address, size) => {
        return memoryjs.readBuffer(this.#process.handle, address, size);
    };
    
    write = (value, address, type) => {
        return memoryjs.writeMemory(this.#process.handle, address, value, type);
    };
}

module.exports = {
    TYPE: {
        BOOLEAN: memoryjs.BOOLEAN, // 1 byte
        BYTE: memoryjs.BYTE, // 1 byte
		UINT8: memoryjs.UINT8, // 1 byte Unsigned
        SHORT: memoryjs.SHORT, // 2 bytes
        FLOAT: memoryjs.FLOAT, // 4 bytes
        DOUBLE: memoryjs.DOUBLE, // 8 bytes
        INT32: memoryjs.INT32, // 4 bytes
        INT64: memoryjs.INT64, // 8 bytes
        UINT32: memoryjs.UINT32, // 4 bytes
        UINT64: memoryjs.UINT64, // 8 bytes
        STRING: memoryjs.STRING // n bytes
    },
    MemoryHelper: MemoryHelper
};