import { State } from "./State.js";
import { builtInClassConstructorMap } from "./jsBuiltInClassSet.js";
import { serializationFunctionSymbol } from "./symbols.js";

const textEncoder = new TextEncoder();

/**
 * JSOBin编码器
 */
export class Encoder
{
    /**
     * @type {State}
     */
    #state = null;

    /**
     * 缓冲区
     * @type {Uint8Array}
     */
    buffer = new Uint8Array(128);
    /**
     * 缓冲区结束索引
     * 不包括该值
     * @type {number}
     */
    endInd = 0;

    /**
     * 引用索引计数
     * @type {number}
     */
    referenceIndCount = -1;
    /**
     * 
     */
    referenceIndMap = new Map();


    /**
     * @param {State} state
     */
    constructor(state)
    {
        this.#state = state;
    }

    /**
     * 向缓冲区加入单个值
     * @param {number} c
     */
    push(c)
    {
        if (this.endInd >= this.buffer.length)
        {
            let old = this.buffer;
            this.buffer = new Uint8Array(this.buffer.length * 2);
            this.buffer.set(old);
        }
        this.buffer[this.endInd++] = c;
    }

    /**
     * 向缓冲区加入数组
     * @param {Uint8Array} a 
     */
    pushArr(a)
    {
        if (this.endInd + a.length > this.buffer.length)
        {
            let old = this.buffer;
            let newLen = old.length * 2;
            while (this.endInd + a.length > newLen)
                newLen *= 2;
            this.buffer = new Uint8Array(newLen);
            this.buffer.set(old);
        }
        this.buffer.set(a, this.endInd);
        this.endInd += a.length;
    }

    /**
     * 序列化一个vint
     * @param {number} num
     */
    pushVint(num)
    {
        while (true)
        {
            let c = (num & ((1 << 7) - 1));
            num >>>= 7;
            if (!num)
            {
                this.push(c | (1 << 7));
                return;
            }
            this.push(c);
        }
    }

    /**
     * 写入字符串
     * @param {string} str
     */
    pushStr(str)
    {
        let strBin = textEncoder.encode(str);
        this.pushVint(strBin.byteLength);
        this.pushArr(strBin);
    }

    /**
     * 遍历编码
     * @param {object | number | string} now
     */
    traversal(now)
    {
        ++this.referenceIndCount;
        if (!this.referenceIndMap.has(now))
            this.referenceIndMap.set(now, this.referenceIndCount);
        switch (typeof (now))
        {
            case "number": { // 数值型(整数或小数)
                if (Number.isInteger(now)) // 整数
                {
                    this.push(1);
                    this.pushVint(now);
                }
                else // 浮点数
                {
                    this.push(2);
                    this.pushArr(new Uint8Array(new Float64Array([now]).buffer));
                }
                break;
            }

            case "string": { // 字符串
                this.push(3);
                this.pushStr(now);
                break;
            }

            case "object": { // 对象 数组 类 null
                if (now == null) // null
                    this.push(11);
                else if (this.referenceIndMap.get(now) < this.referenceIndCount) // 需要引用的对象
                {
                    this.push(14);
                    this.pushVint(this.referenceIndMap.get(now));
                }
                else if (Array.isArray(now)) // 数组
                {
                    this.push(5);
                    now.forEach(o =>
                    {
                        this.traversal(o);
                    });
                    this.push(0);
                }
                else if (this.#state.classToName.has(Object.getPrototypeOf(now)?.constructor)) // 类(自定义类)
                { // TODO 类的自定义处理需要大改版 目前无法在自定义序列化下使用循环引用
                    this.push(6);
                    this.pushStr(this.#state.classToName.get(Object.getPrototypeOf(now)?.constructor));
                    let obj = now[serializationFunctionSymbol] ? now[serializationFunctionSymbol].call(now) : now; // 处理自定义序列化函数
                    let keys = Object.getOwnPropertyNames(obj);
                    this.pushVint(keys.length);
                    keys.forEach(key =>
                    {
                        this.pushStr(key);
                        this.traversal(obj[key]);
                    });
                }
                else if (builtInClassConstructorMap.has(Object.getPrototypeOf(now)?.constructor)) // js内置类
                {
                    this.push(15);
                    let classInfo = builtInClassConstructorMap.get(Object.getPrototypeOf(now)?.constructor);
                    this.pushVint(classInfo.typeId);
                    classInfo.encode(this, now);
                }
                else // 对象
                {
                    this.push(4);
                    let keys = Object.keys(now);
                    this.pushVint(keys.length);
                    keys.forEach(key =>
                    {
                        this.pushStr(key);
                        this.traversal(now[key]);
                    });
                }
                break;
            }

            case "undefined": { // 未定义(undefined)
                this.push(7);
                break;
            }

            case "boolean": { // 布尔值
                this.push(now ? 9 : 8);
                break;
            }

            case "bigint": { // bigint类型
                /** @type {Uint8Array} */
                let bigintBuf = null;
                if (now >= 0n) // bigint正数和0
                {
                    this.push(12);
                    if (now == 0n) // bigint 0
                        bigintBuf = new Uint8Array(0);
                    else // bigint 正数
                        bigintBuf = Encoder.writeBigint(now);
                }
                else // bigint负数
                {
                    this.push(13);
                    bigintBuf = Encoder.writeBigint(-(/** @type {bigint} */(now)));
                }
                this.pushVint(bigintBuf.byteLength);
                this.pushArr(bigintBuf);
                break;
            }

            case "symbol": { // symbol类型
                if (this.referenceIndMap.get(now) < this.referenceIndCount) // 需要引用的symbol
                {
                    this.push(14);
                    this.pushVint(this.referenceIndMap.get(now));
                }
                else // 新的symbol
                {
                    this.push(10);
                    this.pushStr(now.description ? now.description : "");
                }
                break;
            }

            case "function": { // 函数
                if (this.#state.safetyFunctionToName.has(now)) // 安全函数
                {
                    this.push(17);
                    this.pushStr(this.#state.safetyFunctionToName.get(now));
                }
                else
                    this.push(7); // 目前不处理其他函数
                break;
            }

            default:
                throw "JSObin(encode): The type of value that cannot be processed.";
        }
    }

    /**
     * 获取最终缓冲区
     * @returns {Uint8Array}
     */
    getFinalBuffer()
    {
        return this.buffer.slice(0, this.endInd);
    }

    /**
     * 编码
     * @param {object | number | string} obj
     */
    encode(obj)
    {
        this.traversal(obj);
        return this.getFinalBuffer();
    }

    /**
     * 序列化一个bigint
     * @param {bigint} num 一个正数
     * @returns {Uint8Array}
     */
    static writeBigint(num)
    {
        let buf = [];
        while (true)
        {
            buf.push(Number(num & 255n));
            num >>= 8n;
            if (num == 0n)
                return new Uint8Array(buf);
        }
    }
}