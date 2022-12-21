/**
 * 自定义序列化函数
 */
export const serializationFunctionSymbol = Symbol("serialization function");
/**
 * 自定义反序列化函数
 */
export const deserializationFunctionSymbol = Symbol("deserialization function");


/**
 * JSOBin操作上下文
 */
export class JSOBin
{
    /**
     * 类映射
     * 类名字符串标识 到 类(构造函数)
     * @private
     * @type {Map<string, object>}
     */
    nameToClass = new Map();

    /**
     * 类映射
     * 类(构造函数) 到 类名字符串标识
     * @private
     * @type {Map<object, string>}
     */
    classToName = new Map();

    /**
     * 安全函数映射
     * 安全函数字符串标识 到 函数
     * @private
     * @type {Map<string, function>}
     */
    nameToSFunction = new Map();

    /**
     * 安全函数映射
     * 函数 到 安全函数字符串标识
     * @private
     * @type {Map<function, string>}
     */
    sFunctionToName = new Map();

    static textEncoder = new TextEncoder();
    static textDecoder = new TextDecoder("utf-8");

    /**
     * 添加类到上下文
     * 注册标识符和类(构造器)的相互映射
     * @param {string} identifier 类标识符
     * @param {function} classConstructor 类的构造器
     */
    addClass(identifier, classConstructor)
    {
        this.nameToClass.set(identifier, classConstructor);
        this.classToName.set(classConstructor, identifier);
    }

    /**
     * 添加安全函数到上下文
     * 允许确保安全的函数注册标识符和函数的相互映射
     * @param {string} identifier 安全函数标识符
     * @param {function} safetyFunction 函数
     */
    addSafetyFunction(identifier, safetyFunction)
    {
        this.nameToSFunction.set(identifier, safetyFunction);
        this.sFunctionToName.set(safetyFunction, identifier);
    }

    /**
     * 编码
     * @param {object | number | string} obj
     * @returns {Uint8Array}
     */
    encode(obj)
    {
        /**
         * 输出结果由此数组拼接
         * @type {Array<Uint8Array | number>}
         */
        let retList = [];

        /**
         * 写入字符串
         * @param {string} str
         */
        const pushStr = str =>
        {
            let strBin = JSOBin.textEncoder.encode(str);
            retList.push(JSOBin.writeVint(strBin.byteLength));
            retList.push(strBin);
        };

        let referenceIndCount = -1;
        let referenceIndMap = new Map();

        /**
         * 遍历处理对象
         * @param {object | number | string} now 
         */
        const tr = now =>
        {
            if (!referenceIndMap.has(now))
                referenceIndMap.set(now, ++referenceIndCount);
            let nowType = typeof (now);
            if (nowType == "number") // 数值型(整数或小数)
            {
                if (Number.isInteger(now)) // 整数
                {
                    retList.push(1);
                    retList.push(JSOBin.writeVint(now));
                }
                else // 浮点数
                {
                    retList.push(2);
                    let dataView = new DataView(new ArrayBuffer(8));
                    dataView.setFloat64(0, now, true);
                    retList.push(new Uint8Array(dataView.buffer));
                }
            }
            else if (nowType == "string") // 字符串
            {
                retList.push(3);
                pushStr(now);
            }
            else if (nowType == "object") // 对象 数组 类 null
            {
                if (now == null) // null
                    retList.push(11);
                else if (referenceIndMap.get(now) < referenceIndCount) // 需要引用的对象
                {
                    retList.push(14);
                    retList.push(JSOBin.writeVint(referenceIndMap.get(now)));
                }
                else if (Array.isArray(now)) // 数组
                {
                    retList.push(5);
                    now.forEach(tr);
                    retList.push(0);
                }
                else if (this.classToName.has(Object.getPrototypeOf(now)?.constructor)) // 类(自定义类)
                {
                    retList.push(4);
                    pushStr(this.classToName.get(Object.getPrototypeOf(now)?.constructor));
                    let obj = now[serializationFunctionSymbol] ? now[serializationFunctionSymbol].call(now) : now; // 处理自定义序列化函数
                    let keys = Object.getOwnPropertyNames(obj);
                    retList.push(JSOBin.writeVint(keys.length));
                    keys.forEach(key =>
                    {
                        pushStr(key);
                        tr(obj[key]);
                    });
                }
                else // 对象
                {
                    retList.push(4);
                    let keys = Object.keys(now);
                    retList.push(JSOBin.writeVint(keys.length));
                    keys.forEach(key =>
                    {
                        pushStr(key);
                        tr(now[key]);
                    });
                }
            }
            else if (nowType == "undefined") // 未定义(undefined)
                retList.push(7);
            else if (nowType == "boolean") // 布尔值
                retList.push(now ? 9 : 8);
            else if (nowType == "bigint") // bigint类型
            {
                /** @type {Uint8Array} */
                let bigintBuf = null;
                if (now >= 0n) // bigint正数和0
                {
                    retList.push(12);
                    if (now > 0n) // bigint正数
                        bigintBuf = JSOBin.writeBigint(now);
                    else // bigint 0
                        bigintBuf = new Uint8Array(0);
                }
                else // bigint负数
                {
                    retList.push(13);
                    bigintBuf = JSOBin.writeBigint(-(/** @type {bigint} */(now)));
                }
                retList.push(JSOBin.writeVint(bigintBuf.byteLength));
                retList.push(bigintBuf);
            }
            else if (nowType == "symbol") // symbol类型
            {
                if (referenceIndMap.get(now) < referenceIndCount) // 需要引用的symbol
                {
                    retList.push(14);
                    retList.push(JSOBin.writeVint(referenceIndMap.get(now)));
                }
                else // 新的symbol
                {
                    retList.push(10);
                    pushStr(now.description ? now.description : "");
                }
            }
            else if (nowType == "function") // 函数
            {
                if (this.sFunctionToName.has(now)) // 安全函数
                {
                    retList.push(17);
                    pushStr(this.sFunctionToName.get(now));
                }
                else
                    retList.push(7); // 目前不处理其他函数
            }
            else
                throw "JSObin(encode): The type of value that cannot be processed.";
        };
        tr(obj);

        let retLen = 0;
        retList.forEach(o =>
        {
            if (typeof (o) == "number")
                retLen++;
            else
                retLen += o.byteLength;
        });
        let ret = new Uint8Array(retLen);
        let retInd = 0;
        retList.forEach(o =>
        {
            if (typeof (o) == "number")
                ret[retInd++] = o;
            else
            {
                ret.set(o, retInd);
                retInd += o.byteLength;
            }
        });
        return ret;
    }

    /**
     * 解码
     * @param {Uint8Array} bin
     * @returns {object | number | string}
     */
    decode(bin)
    {
        /**
         * 当前读到的位置
         * @type {number}
         */
        let ind = 0;

        /**
         * 读一个vint
         * @returns {number}
         */
        const getVInt = () =>
        {
            let r = JSOBin.readVint(bin, ind);
            ind = r.ind;
            return r.num;
        };

        /**
         * 获取一个字符串(带有表示长度的vint)
         * @returns {string}
         */
        const getStr = () =>
        {
            let len = getVInt();
            let str = JSOBin.textDecoder.decode(bin.subarray(ind, ind + len));
            ind += len;
            return str;
        };

        let referenceIndList = [];

        /**
         * 遍历处理对象
         * @returns {object | number | string}
         */
        const tr = () =>
        {
            if (ind >= bin.length)
                throw "JSOBin Decode: Wrong format";
            let typeId = bin[ind++];
            switch (typeId)
            {
                case 1: { // 变长型整数
                    let num = getVInt();
                    referenceIndList.push(num);
                    return num;
                }
                case 2: { // 浮点数
                    let num = (new DataView(bin.buffer, ind, 8)).getFloat64(0, true);
                    referenceIndList.push(num);
                    ind += 8;
                    return num;
                }
                case 3: { // 字符串
                    let str = getStr();
                    referenceIndList.push(str);
                    return str;
                }
                case 4: { // 对象
                    let ret = {};
                    let childCount = getVInt();
                    referenceIndList.push(ret);
                    for (let i = 0; i < childCount; i++)
                    {
                        let key = getStr();
                        ret[key] = tr();
                    }
                    return ret;
                }
                case 5: { // 数组
                    let ret = [];
                    referenceIndList.push(ret);
                    while (bin[ind])
                        ret.push(tr());
                    ind++;
                    return ret;
                }
                case 6: { // 类
                    let className = getStr();
                    let classConstructor = this.nameToClass.get(className);
                    if (classConstructor == undefined)
                        throw `JSOBin Decode: (class) "${className}" is unregistered class in the current context in the parsing jsobin`;
                    if (classConstructor?.[deserializationFunctionSymbol]) // 存在自定义反序列化函数
                    {
                        let dataObj = Object.create(classConstructor.prototype);
                        let childCount = getVInt();
                        referenceIndList.push(dataObj);
                        for (let i = 0; i < childCount; i++)
                        {
                            let key = getStr();
                            dataObj[key] = tr();
                        }
                        return classConstructor[deserializationFunctionSymbol](dataObj);
                    }
                    else
                    {
                        let ret = Object.create(classConstructor.prototype);
                        let childCount = getVInt();
                        referenceIndList.push(ret);
                        for (let i = 0; i < childCount; i++)
                        {
                            let key = getStr();
                            ret[key] = tr();
                        }
                        return ret;
                    }
                }
                case 7: { // 未定义(undefined)
                    referenceIndList.push(undefined);
                    return undefined;
                }
                case 8: { // 布尔值假
                    referenceIndList.push(false);
                    return false;
                }
                case 9: { // 布尔值真
                    referenceIndList.push(true);
                    return true;
                }
                case 10: { // symbol类型
                    let symbol = Symbol(getStr());
                    referenceIndList.push(symbol);
                    return symbol;
                }
                case 11: { // 无效对象(null)
                    referenceIndList.push(null);
                    return null;
                }
                case 12: { // bigint类型(正数)
                    let len = getVInt();
                    let num = JSOBin.readBigInt(bin, ind, len);
                    referenceIndList.push(num);
                    ind += len;
                    return num;
                }
                case 13: { // bigint类型(负数)
                    let len = getVInt();
                    let num = JSOBin.readBigInt(bin, ind, len);
                    referenceIndList.push(num);
                    ind += len;
                    return -num;
                }
                case 14: { // 引用
                    let referenceInd = getVInt();
                    let ret = referenceIndList[referenceInd];
                    referenceIndList.push(ret);
                    return ret;
                }
                case 15: { // js内置类
                    throw "JSOBin Decode: JS built-in object is not supported in the current version";
                }
                case 16: { // 函数 目前不支持
                    throw "JSOBin Decode: Function is not supported in the current version";
                }
                case 17: { // 安全函数
                    let func = this.nameToSFunction.get(getStr());
                    referenceIndList.push(func);
                    return func;
                }
                default:
                    throw "JSOBin Decode: Wrong format";
            }
        };
        return tr();
    }

    /**
     * 序列化一个vint
     * @param {number} num
     * @returns {Uint8Array}
     */
    static writeVint(num)
    {
        let buf = new Uint8Array(5);
        let ind = 0;
        while (true)
        {
            buf[ind] = (num & ((1 << 7) - 1));
            num >>>= 7;
            if (!num)
            {
                buf[ind] |= (1 << 7);
                return buf.subarray(0, ind + 1);
            }
            ind++;
        }
    }

    /**
     * 反序列化一个vint
     * @param {Uint8Array} buf
     * @param {number} ind
     * @returns {{ num: number, ind: number }}
     */
    static readVint(buf, ind)
    {
        let ret = 0;
        let bitPointer = 0;
        while (!(buf[ind] & (1 << 7)))
        {
            ret |= buf[ind++] << bitPointer;
            bitPointer += 7;
            if (bitPointer > 32) // (bitPointer > 28)
                throw "Unexpected vint length";
        }
        ret |= (buf[ind++] & ((1 << 7) - 1)) << bitPointer;
        return ({
            num: ret,
            ind: ind
        });
    }

    /**
     * 序列化一个bigint
     * @param {bigint} num
     * @returns {Uint8Array}
     */
    static writeBigint(num)
    {
        let buf = [];
        while (true)
        {
            buf.push(Number(num & BigInt((1 << 8) - 1)));
            num >>= 8n;
            if (num == 0n)
                return new Uint8Array(buf);
        }
    }

    /**
     * 反序列化一个Bigint
     * @param {Uint8Array} buf
     * @param {number} startInd
     * @param {number} len
     * @returns {bigint}
     */
    static readBigInt(buf, startInd, len)
    {
        let ret = 0n;
        for (let ptr = startInd + len - 1; ptr >= startInd; ptr--)
        {
            ret <<= 8n;
            ret += BigInt(buf[ptr]);
        }
        return ret;
    }
}