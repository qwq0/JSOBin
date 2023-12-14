import { State } from "./State.js";
import { builtInClassTypeIdMap } from "./jsBuiltInClassSet.js";
import { deserializationFunctionSymbol } from "./symbols.js";

const textDecoder = new TextDecoder("utf-8");

/**
 * JSOBin解码器
 */
export class Decoder
{
    /**
     * @type {State}
     */
    #state = null;

    /**
     * 缓冲区
     * @type {Uint8Array}
     */
    buffer = null;
    /**
     * 缓冲区对应的DataView
     * @type {DataView}
     */
    dataView = null;
    /**
     * 当前读取到的位置
     */
    index = 0;

    /**
     * 引用列表
     * 用于记录引用索引对应的内容
     * @type {Array}
     */
    referenceIndList = [];

    /**
     * @param {State} state
     * @param {Uint8Array} buffer
     */
    constructor(state, buffer)
    {
        this.#state = state;
        this.buffer = buffer;
        this.dataView = new DataView(buffer.buffer);
    }

    /**
     * 获取当前位置的byte
     * @returns {number}
     */
    peekByte()
    {
        if (this.index >= this.buffer.length)
            throw "JSOBin Decode: Wrong format";
        return this.buffer[this.index];
    }

    /**
     * 弹出当前位置的byte
     * 将移动索引位置
     * @returns {number}
     */
    popByte()
    {
        if (this.index >= this.buffer.length)
            throw "JSOBin Decode: Wrong format";
        return this.buffer[this.index++];
    }

    /**
     * 获取缓冲区中的一段
     * @param {number} len 
     * @returns {Uint8Array}
     */
    getArr(len)
    {
        if (len < 0 || this.index + len > this.buffer.length)
            throw "JSOBin Decode: Wrong format";
        let slice = this.buffer.slice(this.index, this.index + len);
        this.index += len;
        return slice;
    }

    /**
     * 读一个vint
     * @returns {number}
     */
    getVInt()
    {
        let ret = 0;
        let bitPointer = 0;
        while (!(this.peekByte() & (1 << 7)))
        {
            ret |= this.popByte() << bitPointer;
            bitPointer += 7;
            if (bitPointer > 32) // (bitPointer > 28)
                throw "JSOBin Decode: Unexpected vint length";
        }
        ret |= (this.popByte() & ((1 << 7) - 1)) << bitPointer;
        return ret;
    }

    /**
    * 获取一个字符串(带有表示长度的vint)
    * @returns {string}
    */
    getStr()
    {
        let len = this.getVInt();
        if (len < 0 || this.index + len > this.buffer.length)
            throw "JSOBin Decode: Wrong format";
        let str = textDecoder.decode(this.buffer.subarray(this.index, this.index + len));
        this.index += len;
        return str;
    }

    /**
     * 遍历解码
     * @returns {any}
     */
    traversal()
    {
        if (this.index >= this.buffer.length)
            throw "JSOBin Decode: Wrong format";
        let typeId = this.popByte();
        switch (typeId)
        {
            case 1: { // 变长型整数
                let num = this.getVInt();
                this.referenceIndList.push(num);
                return num;
            }

            case 2: { // 浮点数
                let num = this.dataView.getFloat64(this.index, true);
                this.referenceIndList.push(num);
                this.index += 8;
                return num;
            }

            case 3: { // 字符串
                let str = this.getStr();
                this.referenceIndList.push(str);
                return str;
            }

            case 4: { // 对象
                let ret = {};
                let childCount = this.getVInt();
                if (childCount < 0)
                    throw "JSOBin Decode: Wrong format";
                this.referenceIndList.push(ret);
                for (let i = 0; i < childCount; i++)
                {
                    let key = this.getStr();
                    ret[key] = this.traversal();
                }
                return ret;
            }

            case 5: { // 数组
                let ret = [];
                this.referenceIndList.push(ret);
                while (this.peekByte())
                    ret.push(this.traversal());
                this.index++;
                return ret;
            }

            case 6: { // 类
                let className = this.getStr();
                let classConstructor = this.#state.nameToClass.get(className);
                if (classConstructor == undefined)
                    throw `JSOBin Decode: (class) "${className}" is unregistered class in the current context in the parsing jsobin`;
                if (classConstructor?.[deserializationFunctionSymbol]) // 存在自定义反序列化函数
                {
                    let dataObj = {};
                    let childCount = this.getVInt();
                    if (childCount < 0)
                        throw "JSOBin Decode: Wrong format";
                    let refInd = this.referenceIndList.length;
                    this.referenceIndList.push(dataObj);
                    for (let i = 0; i < childCount; i++)
                    {
                        let key = this.getStr();
                        dataObj[key] = this.traversal();
                    }
                    let ret = classConstructor[deserializationFunctionSymbol](dataObj);
                    this.referenceIndList[refInd] = ret;
                    return ret;
                }
                else // 自定义类默认序列化方案
                {
                    let ret = Object.create(classConstructor.prototype);
                    let childCount = this.getVInt();
                    if (childCount < 0)
                        throw "JSOBin Decode: Wrong format";
                    this.referenceIndList.push(ret);
                    for (let i = 0; i < childCount; i++)
                    {
                        let key = this.getStr();
                        ret[key] = this.traversal();
                    }
                    return ret;
                }
            }

            case 7: { // 未定义(undefined)
                this.referenceIndList.push(undefined);
                return undefined;
            }

            case 8: { // 布尔值假
                this.referenceIndList.push(false);
                return false;
            }

            case 9: { // 布尔值真
                this.referenceIndList.push(true);
                return true;
            }

            case 10: { // symbol类型
                let symbol = Symbol(this.getStr());
                this.referenceIndList.push(symbol);
                return symbol;
            }

            case 11: { // 无效对象(null)
                this.referenceIndList.push(null);
                return null;
            }

            case 12: { // bigint类型(正数)
                let len = this.getVInt();
                let num = this.readBigInt(len);
                this.referenceIndList.push(num);
                return num;
            }

            case 13: { // bigint类型(负数)
                let len = this.getVInt();
                let num = this.readBigInt(len);
                this.referenceIndList.push(num);
                return -num;
            }

            case 14: { // 引用
                let referenceInd = this.getVInt();
                if (referenceInd < 0 || referenceInd >= this.referenceIndList.length)
                    throw "JSOBin Decode: Wrong format";
                let ret = this.referenceIndList[referenceInd];
                this.referenceIndList.push(ret);
                return ret;
            }

            case 15: { // js内置类
                let builtInClassId = this.getVInt();
                let decodeFunction = builtInClassTypeIdMap.get(builtInClassId);
                if (decodeFunction)
                    return decodeFunction(this);
                else
                    throw "JSOBin Decode: Unsupported js built-in class type.";
            }

            case 16: { // 函数 目前不支持
                throw "JSOBin Decode: Function is not supported in the current version";
            }

            case 17: { // 安全函数
                let func = this.#state.nameToSafetyFunction.get(this.getStr());
                if (!func)
                    throw "JSOBin Decode: A non-existent security function was used";
                this.referenceIndList.push(func);
                return func;
            }

            case 18: { // 命名的symbol
                let symbol = this.#state.nameToNamedSymbol.get(this.getStr());
                if (!symbol)
                    throw "JSOBin Decode: A non-existent named symbol was used";
                this.referenceIndList.push(symbol);
                return symbol;
            }

            default:
                throw "JSOBin Decode: Wrong format";
        }
    }

    /**
     * 解码
     * @returns {object | number | string}
     */
    decode()
    {
        return this.traversal();
    }

    /**
     * 反序列化一个Bigint
     * @param {number} len
     * @returns {bigint} 正数bigint 或 负数bigint的相反数
     */
    readBigInt(len)
    {
        if (len < 0)
            throw "JSOBin Decode: Wrong format";
        let ret = 0n;
        let endPtr = this.index + len - 1;
        if (this.index >= this.buffer.length)
            throw "JSOBin Decode: Wrong format";
        for (let ptr = endPtr; ptr >= this.index; ptr--)
        {
            ret <<= 8n;
            ret += BigInt(this.buffer[ptr]);
        }
        this.index += len;
        return ret;
    }
}