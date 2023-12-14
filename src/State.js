/**
 * 状态
 */
export class State
{
    /**
     * 类映射
     * 类名字符串标识 到 类(构造函数)
     * @package
     * @type {Map<string, object>}
     */
    nameToClass = new Map();

    /**
     * 类映射
     * 类(构造函数) 到 类名字符串标识
     * @package
     * @type {Map<object, string>}
     */
    classToName = new Map();

    /**
     * 安全函数映射
     * 安全函数字符串标识 到 函数
     * @package
     * @type {Map<string, function>}
     */
    nameToSafetyFunction = new Map();

    /**
     * 安全函数映射
     * 函数 到 安全函数字符串标识
     * @package
     * @type {Map<function, string>}
     */
    safetyFunctionToName = new Map();

    /**
     * 命名的symbol映射
     * 命名的symbol字符串标识 到 函数
     * @package
     * @type {Map<string, symbol>}
     */
    nameToNamedSymbol = new Map();

    /**
     * 命名的symbol映射
     * 函数 到 命名的symbol字符串标识
     * @package
     * @type {Map<symbol, string>}
     */
    namedSymbolToName = new Map();
}