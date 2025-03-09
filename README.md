# DB2LLM 最小化原型

## 概述
DB2LLM 是一个将 SQLite 数据库的元数据与 RESTful API 和大型语言模型（LLM）结合的最小化原型。它允许用户通过自然语言与数据库进行交互，无需编写 SQL 查询或了解数据库结构。当前为便于演示，使用 SQLite 数据库，实际使用时，请使用自己的数据库并更新相关的配置。

## 功能特点
- 提供用户对话窗口，支持配置 LLM 的 API 地址和授权密钥
- 支持用户指定 SQLite 数据库文件
- 自动分析数据库结构，提取元数据信息
  - 表结构和字段信息
  - 字段枚举值映射（如性别：男/女、male/female 等）
  - 主键、外键和索引信息
- 动态生成 RESTful API，用于数据库操作
- 智能会话管理
  - 支持上下文记忆，理解后续查询
  - 会话超时自动清理（30分钟）
  - 结果摘要生成
- 将用户自然语言查询转换为 API 请求
- 执行 API 请求并返回结果
- 支持多步骤复杂查询

## 技术栈
- **运行时**: Bun
- **Web 框架**: Hono
- **数据库**: SQLite
- **ORM**: TypeORM
- **LLM 集成**: OpenAI API 及兼容接口

## 快速开始

### 前提条件
- 安装 [Bun](https://bun.sh/) 运行时
- 准备一个 SQLite 数据库文件
- 获取 OpenAI API 密钥或其他兼容的 LLM API 密钥

### 安装
1. 克隆仓库
```bash
git clone https://github.com/loocor/db2llm.git
cd db2llm
```

2. 安装依赖
```bash
bun install
```

3. 配置 LLM
修改 `config/config.yaml` 文件：
```yaml
server:
  port: 3000
  host: "localhost"

database:
  tempDir: "db2llm"
  defaultName: "db2llm.sqlite"
  connection:
    synchronize: false
    logging: ["error", "warn"]

llm:
  provider: "deepseek"
  openai:
    model: "deepseek-chat"
    temperature: 0.3
    defaultApiUrl: "https://api.deepseek.com/v1"
    apiKey: "sk-4c907ed3eed5468db793b6f431e9a28c"

ui:
  title: "DB2LLM - 数据库对话助手"
  welcomeMessage: "欢迎使用 DB2LLM 数据库对话助手！请先连接数据库和配置 LLM API。"
  readyMessage: "我已准备好，跟我来聊吧！"
```

支持的 LLM 提供商：
- DeepSeek API（默认）
- OpenAI API
- Azure OpenAI
- Claude API
- 其他兼容 OpenAI API 格式的服务

### 运行
```bash
bun run dev
```

应用将在 http://localhost:3000 启动。

### 使用方法
1. 打开浏览器访问 http://localhost:3000
2. 上传 SQLite 数据库文件
3. 输入 LLM API 密钥（和可选的 API 地址）
4. 点击"连接"按钮
5. 连接成功后，在对话框中输入自然语言查询
6. 系统将自动处理查询并返回结果

## 示例查询
- "显示所有用户信息"
- "查找所有女性用户"
- "统计男性用户数量"
- "添加一个新用户，姓名为李四，性别男，年龄30岁"
- "更新ID为5的用户的电话号码为13812345678"
- "删除ID为10的用户"
- "再找找看"（基于上下文的后续查询）

## 数据库支持
### 字段类型
- 基本类型：INTEGER, TEXT, NUMBER 等
- 支持自定义枚举值映射，如：
  - 性别：['女', 'female', 'f', '2', '0'] -> 女性
  - 状态：['active', '1', '启用'] -> 启用

### 元数据
- 表结构信息
- 字段属性（主键、非空等）
- 字段枚举值映射
- 外键关系
- 索引信息

## 注意事项
- 本项目是一个概念验证原型，不建议在生产环境中使用
- 未实现用户认证和授权机制
- 未优化大型数据库的性能
- API 密钥直接在前端输入，存在安全风险
- 会话数据存储在内存中，服务重启后会丢失

## 许可证
MIT

## 贡献
欢迎提交 Issue 和 Pull Request！