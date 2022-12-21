# JSOBin格式规范

若仅需要使用用于序列化和反序列化的js库   
则无需阅读此文档   

此文档描述JSOBin序列化后的二进制格式规范   
便于进行js以外语言的JSOBin处理库开发   


## 格式

数据格式   
一个byte表示类型   
+ 类型对应
    + 0 结束标志   
        + 在数组中 作为数组结束标志
    + 1 整数
        + vint变长型整数(32位带符号整数) 小端
    + 2 小数
        + 64位浮点数 小端
    + 3 字符串(string)
        + 一个vint表示长度(byte长度)
        + 字符串(使用utf-8编码)
    + 4 对象 开始标志
        + 一个vint表示成员个数
        + 若干个字符串(不含类型标志)和值
    + 5 数组 开始标志
        + 若干个值
        + 一个 0 作为结束标志
    + 6 自定义类
        + 一个string表示类名
        + 一个vint表示成员个数
        + 若干个字符串(不含类型标志)和值
    + 7 未定义(undefined)
    + 8 布尔假(false)
    + 9 布尔真(true)
    + 10 symbol类型
        + 一个字符串表示此symbol的描述
    + 11 无效对象(null)
    + 12 bigint类型(正数)
        + 一个vint表示长度(单位:字节)
        + 指定长度个byte 小端排列的bigint二进制表示
    + 13 bigint类型(负数)   
        将值乘以-1后与bigint正数相同
    + 14 引用
        + 一个vint表示引用的编号   
        编号从0开始   
        注意此值不可大于当前编号   
        当出现循环引用或重复对象时使用
    + 15 一些js内置类 (TODO) 这些规范还在制定过程种
        + 一个byte表示具体类型
            + 0 未定义
            + 1 Map
                与 对象 相似
            + 2 Set
                与 数组 相似
            + 10 Int8Array   
                与ArrayBuffer相同
            + 11 Uint8Array   
                与ArrayBuffer相同
            + 12 Int16Array   
                与ArrayBuffer相同
            + 13 Uint16Array   
                与ArrayBuffer相同
            + 14 Int32Array   
                与ArrayBuffer相同
            + 15 Uint32Array   
                与ArrayBuffer相同
            + 16 BigInt64Array   
                与ArrayBuffer相同
            + 17 BigUint64Array   
                与ArrayBuffer相同
            + 18 Float32Array   
                与ArrayBuffer相同
            + 19 Float64Array   
                与ArrayBuffer相同
            + 20 ArrayBuffer
                + 一个vint表示长度(单位:字节)
                + 指定长度个byte 表示此buffer
    + 16 函数 (reserve) 为不安全的函数保留
    + 17 安全函数
        + 一个string表示此函数的标识符
