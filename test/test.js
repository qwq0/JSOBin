// 这是一个测试脚本 以确保JSOBin实现(这个库)工作正常

import { deserializationFunctionSymbol, JSOBin, serializationFunctionSymbol } from "../src/index.js";


class TestClass
{
    a = 0;
    b = 0;

    constructor(a, b)
    {
        this.a = a;
        this.b = b;
        console.log("TestClass constructor has been called");
    }
}

class TestClassWithCustomSerializationFunction
{
    a = 0;
    b = 0;

    constructor(a, b)
    {
        this.a = a;
        this.b = b;
        console.log("TestClassWithCustomSerializationFunction constructor has been called");
    }

    [serializationFunctionSymbol]()
    {
        console.log("TestClassWithCustomSerializationFunction serialization function has been called");
        return {
            a: this.a,
            b: this.b
        };
    }

    static [deserializationFunctionSymbol](dataObj)
    {
        console.log("TestClassWithCustomSerializationFunction deserialization function has been called");
        let ret = new TestClassWithCustomSerializationFunction(dataObj.a, dataObj.b);
        return ret;
    }
}




(async () =>
{
    let jsob = new JSOBin();
    jsob.addClass("TestClass", TestClass);
    jsob.addClass("TestClassWithCustomSerializationFunction", TestClassWithCustomSerializationFunction);

    let srcObj = {
        number: {
            a: 0,
            b: 1,
            c: 255,
            d: 256,
            e: -1,
            f: -12345,
            g: Infinity,
            h: -Infinity,
            i: 0.1,
            j: -0.1,
            k: 2147483647,
            l: -2147483648,
            m: 1n,
            n: -1n,
            o: 0n,
            p: 1234567890987654321n,
            q: -1234567890987654321n
        },
        string: "Hello JSOBin!",
        anotherString: "Hi JSOBin!",
        duplicateString: "Hello JSOBin!",
        bool: {
            "true": true,
            "false": false
        },
        cycle: null,
        array: [
            {
                test: "test"
            },
            [0, 1, 2],
            123
        ],
        directedAcyclic: null,
        class: {
            testClass: new TestClass(1, 2),
            testClassWithCustomSerializationFunctions: new TestClassWithCustomSerializationFunction(3, 4),
        },
        jsBuiltInClass: {
            map: (() =>
            {
                let ret = new Map();
                for (let i = 0; i < 10; i++)
                    ret.set("k" + i, "v" + i);
                ret.set("object in map", {
                    test: "object in map"
                });
                return ret;
            })(),
            set: (() =>
            {
                let ret = new Set();
                for (let i = 0; i < 10; i++)
                    ret.add("v" + i);
                ret.add({
                    test: "object in set"
                });
                return ret;
            })(),
            uint8Array: new Uint8Array([1, 2, 3]),
            int8Array: new Int8Array([4, 5, 6]),
            uint16Array: new Uint16Array([7, 8, 9]),
            int16Array: new Int16Array([10, 11, 12]),
            int32Array: new Int32Array([13, 14, 15]),
            uint32Array: new Uint32Array([16, 17, 18]),
            bigInt64Array: new BigInt64Array([19n, 20n, 21n]),
            bigUint64Array: new BigUint64Array([22n, 23n, 24n]),
            float32Array: new Float32Array([25, 26, 27]),
            float64Array: new Float64Array([28, 29, 30])
        }
    };
    srcObj.cycle = srcObj;
    srcObj.directedAcyclic = srcObj.array[0];
    console.log("srcObj", srcObj);

    let targetObj = jsob.decode(jsob.encode(srcObj, { referenceString: true }));
    console.log("targetObj", targetObj);

    if (!globalThis["window"])
    {
        let assert = await import("assert");
        // @ts-ignore
        assert.deepStrictEqual(srcObj, targetObj, "deepEqual");
    }
})();