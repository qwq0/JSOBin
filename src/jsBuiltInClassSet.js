import { Decoder } from "./Decoder.js";
import { Encoder } from "./Encoder.js";

/**
 * js内置类映射
 * 内置类构造函数 到 内置类id和编码处理函数
 * @type {Map<Function, {
 *  typeId: number,
 *  encode: (encoder: Encoder, obj: Object) => void
 * }>}
 */
const builtInClassConstructorMap = new Map();
/**
 * js内置类映射
 * 内置类id 到 解码处理函数
 * 解码处理函数需要处理引用索引数组
 * @type {Map<number, (decoder: Decoder) => any>}
 */
const builtInClassTypeIdMap = new Map();

([
    {
        constructor: Map,
        typeId: 1,
        encode: (/** @type {Encoder} */ encoder, /** @type {Map} */ obj) =>
        {
            encoder.pushVint(obj.size);
            obj.forEach((value, key) =>
            {
                encoder.traversal(key);
                encoder.traversal(value);
            });
        },
        decode: (/** @type {Decoder} */decoder) =>
        {
            let ret = new Map();
            let childCount = decoder.getVInt();
            decoder.referenceIndList.push(ret);
            for (let i = 0; i < childCount; i++)
            {
                let key = decoder.traversal();
                ret.set(key, decoder.traversal());
            }
            return ret;
        }
    },
    {
        constructor: Set,
        typeId: 2,
        encode: (/** @type {Encoder} */ encoder, /** @type {Set} */ obj) =>
        {
            obj.forEach(o =>
            {
                encoder.traversal(o);
            });
            encoder.push(0);
        },
        decode: (/** @type {Decoder} */decoder) =>
        {
            let ret = new Set();
            decoder.referenceIndList.push(ret);
            while (decoder.peekByte() != 0)
                ret.add(decoder.traversal());
            decoder.index++;
            return ret;
        }
    },
    {
        constructor: ArrayBuffer,
        typeId: 20,
        encode: (/** @type {Encoder} */ encoder, /** @type {ArrayBuffer} */ obj) =>
        {
            encoder.pushVint(obj.byteLength);
            encoder.pushArr(new Uint8Array(obj));
        },
        decode: (/** @type {Decoder} */decoder) =>
        {
            let length = decoder.getVInt();
            let ret = decoder.buffer.buffer.slice(decoder.index, decoder.index + length);
            decoder.referenceIndList.push(ret);
            decoder.index += length;
            return ret;
        }
    },
]).forEach(o =>
{
    builtInClassConstructorMap.set(o.constructor, {
        typeId: o.typeId,
        encode: o.encode
    });
    builtInClassTypeIdMap.set(o.typeId, o.decode);
});

([
    {
        constructor: Int8Array,
        typeId: 10
    },
    {
        constructor: Uint8Array,
        typeId: 11
    },
    {
        constructor: Int16Array,
        typeId: 12
    },
    {
        constructor: Uint16Array,
        typeId: 13
    },
    {
        constructor: Int32Array,
        typeId: 14
    },
    {
        constructor: Uint32Array,
        typeId: 15
    },
    {
        constructor: BigInt64Array,
        typeId: 16
    },
    {
        constructor: BigUint64Array,
        typeId: 17
    },
    {
        constructor: Float32Array,
        typeId: 18
    },
    {
        constructor: Float64Array,
        typeId: 19
    }
]).forEach(o =>
{
    builtInClassConstructorMap.set(o.constructor, {
        typeId: o.typeId,
        encode: (encoder, /** @type {InstanceType<typeof o.constructor>} */obj) =>
        {
            let buffer = obj.buffer;
            let byteOffset = obj.byteOffset;
            let length = obj.length;
            encoder.pushVint(byteOffset);
            encoder.pushVint(length);
            encoder.traversal(buffer);
        }
    });
    builtInClassTypeIdMap.set(o.typeId, decode =>
    {
        let refInd = decode.referenceIndList.length;
        decode.referenceIndList.push(null);

        let byteOffset = decode.getVInt();
        let length = decode.getVInt();
        let buffer = decode.traversal();

        let ret = new o.constructor(buffer, byteOffset, length);
        decode.referenceIndList[refInd] = ret;
        return ret;
    });
});

export { builtInClassConstructorMap, builtInClassTypeIdMap };