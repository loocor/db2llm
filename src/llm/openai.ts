import OpenAI from 'openai'
import { getDatabaseDescription } from '../db/metadata'
import { getConfig } from '../utils/config'

let openaiClient: OpenAI | null = null

/**
 * 初始化 OpenAI 客户端
 * @param apiKey OpenAI API 密钥
 * @param apiUrl OpenAI API 地址（可选，用于自定义 API 端点）
 */
export function initializeOpenAI(apiKey: string, apiUrl?: string): void {
  const config = getConfig()
  const openaiConfig = config.llm.openai

  const options: any = { apiKey }

  // 使用提供的 API URL 或配置中的默认值
  if (apiUrl) {
    options.baseURL = apiUrl
  } else if (openaiConfig.defaultApiUrl) {
    options.baseURL = openaiConfig.defaultApiUrl
  }

  openaiClient = new OpenAI(options)
  console.log('OpenAI 客户端已初始化')
}

/**
 * 获取 OpenAI 客户端实例
 * @returns OpenAI 客户端实例
 */
export function getOpenAIClient(): OpenAI {
  if (!openaiClient) {
    throw new Error('OpenAI 客户端未初始化，请先调用 initializeOpenAI')
  }
  return openaiClient
}

/**
 * 生成系统提示信息
 * @returns 包含数据库描述的系统提示
 */
export async function generateSystemPrompt(): Promise<string> {
  const dbDescription = await getDatabaseDescription()

  return `你是一个数据库助手，可以帮助用户查询和操作数据库。
以下是数据库的结构描述：

${dbDescription}

当用户询问可查询的信息或打招呼时（比如："你好，我可以查什么？"，"有什么数据？"等），请直接返回数据库中的表名，优先使用表的中文注释说明，如果没有注释则翻译表名为中文。
例如：
{
  "thoughts": "让我告诉你数据库中有哪些信息可以查询",
  "tables": [
    "用户信息表 (users) - 存储用户基本信息",
    "订单记录 (orders) - 用户的订单数据",
    "商品目录 (products) - 可购买的商品信息"
  ]
}

如果是具体的查询请求，你可以通过调用 RESTful API 来查询和操作数据库。API 的基本格式如下：

1. 获取所有记录：GET /api/{表名}
2. 获取单个记录：GET /api/{表名}/{id}
3. 创建记录：POST /api/{表名} (带有 JSON 请求体)
4. 更新记录：PUT /api/{表名}/{id} (带有 JSON 请求体)
5. 删除记录：DELETE /api/{表名}/{id}
6. 获取数据库元数据：GET /api/metadata

对于具体查询，请使用 JSON 格式响应，包含以下字段：
{
  "thoughts": "你的思考过程",
  "requests": [
    {
      "method": "GET|POST|PUT|DELETE",
      "url": "/api/...",
      "body": {} // 可选，用于 POST 和 PUT 请求
    }
  ]
}`
}

/**
 * 处理用户查询
 * @param userQuery 用户查询文本
 * @returns LLM 的响应
 */
export async function processUserQuery(userQuery: string): Promise<any> {
  const client = getOpenAIClient()
  const systemPrompt = await generateSystemPrompt()
  const config = getConfig()
  const openaiConfig = config.llm.openai

  try {
    const response = await client.chat.completions.create({
      model: openaiConfig.model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userQuery },
      ],
      temperature: openaiConfig.temperature,
    })

    const content = response.choices[0].message.content

    // 尝试解析 JSON 响应
    try {
      return JSON.parse(content || '{}')
    } catch (error) {
      console.error('无法解析 LLM 响应为 JSON:', error)
      return {
        error: '无法解析响应',
        rawContent: content,
      }
    }
  } catch (error) {
    console.error('调用 LLM API 失败:', error)
    throw new Error('调用 LLM API 失败')
  }
}
