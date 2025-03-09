# DB2LLM 最小化原型

## 概述
DB2LLM 是一个将 SQLite 数据库的元数据与 RESTful API 和大型语言模型（LLM）结合的最小化原型。它允许用户通过自然语言与数据库进行交互，无需编写 SQL 查询或了解数据库结构。

## 功能特点
- 提供用户对话窗口，支持配置 LLM 的 API 地址和授权密钥
- 支持用户指定 SQLite 数据库文件
- 自动分析数据库结构，提取元数据信息
- 动态生成 RESTful API，用于数据库操作
- 将用户自然语言查询转换为 API 请求
- 执行 API 请求并返回结果

## 技术栈
- **运行时**: Bun
- **Web 框架**: Hono
- **数据库**: SQLite
- **ORM**: TypeORM
- **LLM 集成**: OpenAI API

## 快速开始

### 前提条件
- 安装 [Bun](https://bun.sh/) 运行时
- 准备一个 SQLite 数据库文件
- 获取 OpenAI API 密钥或其他兼容的 LLM API 密钥

### 安装
1. 克隆仓库
```bash
git clone https://github.com/yourusername/db2llm.git
cd db2llm
```

2. 安装依赖
```bash
bun install
```

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
- "查找名为张三的用户"
- "添加一个新用户，姓名为李四，年龄30岁"
- "更新ID为5的用户的电话号码为13812345678"
- "删除ID为10的用户"

## 注意事项
- 本项目是一个概念验证原型，不建议在生产环境中使用
- 未实现用户认证和授权机制
- 未优化大型数据库的性能
- API 密钥直接在前端输入，存在安全风险

## 许可证
MIT

## 贡献
欢迎提交 Issue 和 Pull Request！ 