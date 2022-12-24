// 这是一个测试脚本 以确保JSOBin实现(这个库)工作正常

import { deserializationFunctionSymbol, JSOBin, serializationFunctionSymbol } from "../src/main.js";


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




(() =>
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
        }
    };
    srcObj.cycle = srcObj;
    srcObj.directedAcyclic = srcObj.array[0];
    console.log("srcObj", srcObj);

    let targetObj = jsob.decode(jsob.encode(srcObj));
    console.log("targetObj", targetObj);
})();