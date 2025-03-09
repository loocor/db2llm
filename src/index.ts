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
import { updateConversationContext } from './llm/conversation'

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

    // 获取或生成会话 ID
    let sessionId = c.req.header('X-Session-ID')
    if (!sessionId) {
      sessionId = Math.random().toString(36).substring(2, 15)
      c.header('X-Session-ID', sessionId)
    }

    // 处理用户查询，获取 LLM 响应
    const llmResponse = await processUserQuery(query, sessionId)

    // 如果是表信息查询（没有具体的 API 请求）
    if (llmResponse.tables) {
      return c.json({
        success: true,
        response: llmResponse,
      })
    }

    // 检查是否包含子任务
    if (llmResponse.subtasks && Array.isArray(llmResponse.subtasks)) {
      const subtaskResults = []

      // 依次执行每个子任务
      for (const subtask of llmResponse.subtasks) {
        if (subtask.requests && Array.isArray(subtask.requests)) {
          // 执行子任务的 API 请求
          const results = await executeApiRequests(app, subtask.requests)

          // 如果需要处理结果，再次调用 LLM 生成摘要
          if (subtask.process_results) {
            const processResponse = await processUserQuery(
              `请根据以下查询结果生成摘要：\n${JSON.stringify(results, null, 2)}\n\n请遵循以下规则：
              1. 对于统计类查询，直接给出具体数字
              2. 对于列表类查询，总结关键信息而不是显示全部原始数据
              3. 对于详细信息查询，以易读的格式展示重要字段
              4. 使用自然语言描述结果
              5. 如果查询结果为空，明确说明"未找到相关数据"`,
              sessionId,
            )

            subtaskResults.push({
              thought: subtask.thoughts,
              results,
              summary: processResponse.result_summary || processResponse.thoughts,
            })
          } else {
            subtaskResults.push({
              thought: subtask.thoughts,
              results,
            })
          }
        }
      }

      // 更新会话上下文中的结果
      updateConversationContext(sessionId, {
        lastResults: subtaskResults,
      })

      // 如果有最终总结
      if (llmResponse.summary) {
        return c.json({
          success: true,
          response: {
            thoughts: llmResponse.summary,
            subtasks: subtaskResults,
          },
        })
      }

      return c.json({
        success: true,
        response: {
          thoughts: llmResponse.thoughts,
          subtasks: subtaskResults,
        },
      })
    }

    // 检查是否包含单个 API 请求
    if (
      !llmResponse.requests ||
      !Array.isArray(llmResponse.requests) ||
      llmResponse.requests.length === 0
    ) {
      return c.json({
        success: false,
        error: '无法理解查询或生成 API 请求',
        response: llmResponse,
      })
    }

    // 执行单个任务的 API 请求
    const results = await executeApiRequests(app, llmResponse.requests)

    // 更新会话上下文中的结果
    updateConversationContext(sessionId, {
      lastResults: results,
    })

    // 如果需要处理结果，再次调用 LLM 生成摘要
    if (llmResponse.process_results) {
      const processResponse = await processUserQuery(
        `请根据以下查询结果生成摘要：\n${JSON.stringify(results, null, 2)}\n\n请遵循以下规则：
        1. 对于统计类查询，直接给出具体数字
        2. 对于列表类查询，总结关键信息而不是显示全部原始数据
        3. 对于详细信息查询，以易读的格式展示重要字段
        4. 使用自然语言描述结果
        5. 如果查询结果为空，明确说明"未找到相关数据"
        6. 必须返回以下格式的 JSON：
        {
          "thoughts": "结果分析",
          "result_summary": "根据规则生成的摘要"
        }`,
        sessionId,
      )

      return c.json({
        success: true,
        response: {
          thoughts: llmResponse.thoughts,
          result_summary: processResponse.result_summary || processResponse.thoughts,
        },
      })
    }

    return c.json({
      success: true,
      response: llmResponse,
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
