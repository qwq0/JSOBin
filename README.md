# JSOBin
JSOBin是一个用于序列化javascript对象的规范和实现   

+ 优点 对比json
    + 更小
        + 使用二进制格式
        + 对整数进行变长压缩
    + 更好的支持
        + 支持 循环引用
        + 支持 Bigint
        + 支持 自定义类
        + 支持 symbol (有限制)
        + 支持 undefined

## 使用 JSOBin

1 导入JSOBin

```javascript
import { JSOBin } from "jsobin";
```


2 创建用于操作的上下文

```javascript
let jsob = new JSOBin();
```


3 序列化 (编码)

```javascript
let serializedBinaryFormat = jsob.encode({
    testObjectKey: "test object value"
});
```

4 反序列化 (解码)

```javascript
let deserializedObject = jsob.decode(serializedBinaryFormat);
```
