import fs from 'fs'
import os from 'os'
import path from 'path'
import { Hono } from 'hono'
import { serveStatic } from 'hono/bun'
import { cors } from 'hono/cors'
import { executeApiRequests } from './api/executor'
import { generateRestApi, createDynamicRouteMiddleware } from './api/generator'
import { closeConnection, connectToDatabase } from './db/connection'
import { processUserQuery } from './llm/openai'
import { initializeOpenAI } from './llm/openai'
import { getConfig, loadConfig } from './utils/config'

// 加载配置文件
loadConfig()
const config = getConfig()

// 创建 Hono 应用
const app = new Hono()

// 启用 CORS
app.use(cors())

// 提供静态文件
app.use('/*', serveStatic({ root: './src/public' }))

// 临时目录，用于存储上传的数据库文件
const tempDir = path.join(os.tmpdir(), config.database.tempDir)
if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir, { recursive: true })
}

// 提供配置信息
app.get('/api/config', c => {
  return c.json({
    ui: config.ui,
    llm: {
      provider: config.llm.provider,
      openai: {
        defaultApiUrl: config.llm.openai.defaultApiUrl,
        apiKey: config.llm.openai.apiKey,
        model: config.llm.openai.model,
      },
    },
    database: {
      defaultName: config.database.defaultName,
    },
  })
})

// 连接数据库和初始化 API
app.post('/api/connect', async c => {
  try {
    const formData = await c.req.formData()

    // 获取数据库文件
    const dbFile = formData.get('dbFile') as File
    if (!dbFile) {
      return c.json({ success: false, error: '未提供数据库文件' }, 400)
    }

    // 获取 API 密钥（优先使用配置文件中的密钥）
    const apiKey = config.llm.openai.apiKey || (formData.get('apiKey') as string)
    if (!apiKey) {
      return c.json({ success: false, error: '未提供 API 密钥' }, 400)
    }

    // 可选的 API URL
    const apiUrl = formData.get('apiUrl') as string

    // 保存数据库文件到临时目录，使用默认名称或原始文件名
    const fileName =
      dbFile.name === config.database.defaultName
        ? `${Date.now()}_${config.database.defaultName}`
        : config.database.defaultName

    const dbFilePath = path.join(tempDir, fileName)
    const buffer = await dbFile.arrayBuffer()
    fs.writeFileSync(dbFilePath, Buffer.from(buffer))

    // 连接到数据库
    const dataSource = await connectToDatabase(dbFilePath)

    // 初始化 OpenAI 客户端
    initializeOpenAI(apiKey, apiUrl)

    // 生成 RESTful API
    await generateRestApi(app)

    return c.json({ success: true })
  } catch (error) {
    console.error('连接数据库失败:', error)
    return c.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '未知错误',
      },
      500,
    )
  }
})

// 处理用户查询
app.post('/api/query', async c => {
  try {
    const { query } = await c.req.json()

    if (!query) {
      return c.json({ success: false, error: '未提供查询内容' }, 400)
    }

    // 处理用户查询，获取 LLM 响应
    const llmResponse = await processUserQuery(query)

    // 检查响应是否包含请求
    if (
      !llmResponse.requests ||
      !Array.isArray(llmResponse.requests) ||
      llmResponse.requests.length === 0
    ) {
      return c.json({
        success: false,
        error: '无法理解查询或生成 API 请求',
        rawResponse: llmResponse,
      })
    }

    // 执行 API 请求
    const results = await executeApiRequests(app, llmResponse.requests)

    return c.json({
      success: true,
      thoughts: llmResponse.thoughts,
      results,
    })
  } catch (error) {
    console.error('处理查询失败:', error)
    return c.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '未知错误',
      },
      500,
    )
  }
})

// 添加动态路由中间件
app.use('*', createDynamicRouteMiddleware())

// 启动服务器
const port = config.server.port || process.env.PORT || 3000
const host = config.server.host || 'localhost'
console.log(`启动服务器，监听 ${host}:${port}...`)

export default {
  port,
  fetch: app.fetch,
  async close() {
    // 关闭数据库连接
    await closeConnection()

    // 清理临时文件
    try {
      if (fs.existsSync(tempDir)) {
        const files = fs.readdirSync(tempDir)
        for (const file of files) {
          fs.unlinkSync(path.join(tempDir, file))
        }
      }
    } catch (error) {
      console.error('清理临时文件失败:', error)
    }
  },
}
