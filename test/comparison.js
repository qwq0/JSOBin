// 这是一个测试脚本 以比较JSOBin实现(这个库)与JSON性能以及序列化后的大小

import { JSOBin } from "../src/main.js";

(() =>
{
    let jsob = new JSOBin();

    let srcObj = {
        floatArray: (() =>
        {
            let ret = [];
            for (let i = 0; i < 10000; i++)
                ret.push({
                    i: Math.random()
                });
            return ret;
        })(),
        integerArray: (() =>
        {
            let ret = [];
            for (let i = 0; i < 10000; i++)
                ret.push({
                    i: Math.floor(Math.random() * 654321)
                });
            return ret;
        })(),
        stringArray: (() =>
        {
            let ret = [];
            for (let i = 0; i < 10000; i++)
                ret.push({
                    i: "str" + Math.floor(Math.random() * 1000)
                });
            return ret;
        })(),
        objectNesting: (() =>
        {
            let ret = {};
            for (let i = 0; i < 800; i++)
            {
                ret = { obj: ret };
            }
            return ret;
        })(),
    };
    // console.log("srcObj", srcObj);

    const textEncoder = new TextEncoder();
    const textDecoder = new TextDecoder("utf-8");

    console.time("JSON stringify");
    console.time("JSON stringify and utf-8 encode");
    let json = JSON.stringify(srcObj);
    console.timeEnd("JSON stringify");
    let jsonBuf = textEncoder.encode(json);
    console.timeEnd("JSON stringify and utf-8 encode");

    console.time("JSON parse and utf-8 decode");
    let jsonStr = textDecoder.decode(jsonBuf);
    console.time("JSON parse");
    let jsonParsed = JSON.parse(jsonStr);
    console.timeEnd("JSON parse");
    console.timeEnd("JSON parse and utf-8 decode");



    console.time("JSOBin encode");
    let jsobBuf = jsob.encode(srcObj);
    console.timeEnd("JSOBin encode");

    console.time("JSOBin decode");
    let jsobParsed = jsob.decode(jsobBuf);
    console.timeEnd("JSOBin decode");


    console.log("size of JSON:", jsonStr.length + " characters");
    console.log("size of JSOBin:", jsobBuf.byteLength + " bytes");

    console.log("load", jsonStr[0], jsobBuf[0], jsonParsed["test"], jsobParsed["test"]);
})();