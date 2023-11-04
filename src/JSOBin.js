import { Decoder } from "./Decoder.js";
import { Encoder } from "./Encoder.js";
import { State } from "./State.js";

/**
 * JSOBin操作上下文
 */
export class JSOBin
{
    /**
     * @type {State}
     */
    #state = new State();

    /**
     * 添加类到上下文
     * 注册标识符和类(构造器)的相互映射
     * @param {string} identifier 类标识符
     * @param {function} classConstructor 类的构造器
     */
    addClass(identifier, classConstructor)
    {
        this.#state.nameToClass.set(identifier, classConstructor);
        this.#state.classToName.set(classConstructor, identifier);
    }

    /**
     * 添加安全函数到上下文
     * 允许确保安全的函数注册标识符和函数的相互映射
     * @param {string} identifier 安全函数标识符
     * @param {function} safetyFunction 函数
     */
    addSafetyFunction(identifier, safetyFunction)
    {
        this.#state.nameToSafetyFunction.set(identifier, safetyFunction);
        this.#state.safetyFunctionToName.set(safetyFunction, identifier);
    }

    /**
     * 编码
     * @param {object | number | string} obj
     * @param {{
     *  referenceString?: boolean
     * }} [config]
     * @returns {Uint8Array}
     */
    encode(obj, config)
    {
        config = Object.assign({
            referenceString: false
        }, config);
        return (new Encoder(this.#state, config.referenceString)).encode(obj);
    }

    /**
     * 解码
     * @param {Uint8Array} bin
     * @returns {object | number | string}
     */
    decode(bin)
    {
        return (new Decoder(this.#state, bin)).decode();
    }
}