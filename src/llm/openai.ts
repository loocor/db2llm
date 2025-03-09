import OpenAI from 'openai'
import { getDatabaseDescription } from '../db/metadata'
import { getConfig } from '../utils/config'
import { getConversationContext, updateConversationContext } from './conversation'
import { LLMResponse } from './types'

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
  console.log('数据库描述:', dbDescription)

  return `你是一个数据库助手，可以帮助用户查询和操作数据库。
以下是数据库的结构描述：

${dbDescription}

特别说明：
1. 对于包含枚举值的字段，请注意其可能的取值：
   - 性别(sex)字段：使用"女"表示女性，"男"表示男性
   - 其他枚举字段会在字段描述中说明可能的取值

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

如果是需要多个步骤才能完成的查询，请将查询拆分为多个子任务，并在每个子任务中处理和总结结果。使用以下格式：
{
  "thoughts": "这个查询需要分两步完成",
  "subtasks": [
    {
      "thoughts": "第一步：获取所有客户记录以统计数量",
      "requests": [
        {
          "method": "GET",
          "url": "/api/customer"
        }
      ],
      "process_results": true,
      "result_summary": "根据查询结果生成的摘要说明"
    },
    {
      "thoughts": "第二步：获取特定客户的详细信息",
      "requests": [
        {
          "method": "GET",
          "url": "/api/customer/1"
        }
      ],
      "process_results": true,
      "result_summary": "根据查询结果生成的摘要说明"
    }
  ],
  "summary": "所有步骤完成后的最终总结"
}

如果是简单的查询请求，也需要处理和总结结果。使用以下格式：
{
  "thoughts": "你的思考过程",
  "requests": [
    {
      "method": "GET|POST|PUT|DELETE",
      "url": "/api/...",
      "body": {} // 可选，用于 POST 和 PUT 请求
    }
  ],
  "process_results": true,
  "result_summary": "根据查询结果生成的摘要说明"
}

在处理结果时，请遵循以下规则：
1. 对于统计类查询（如查询数量），直接给出具体数字
2. 对于列表类查询，总结关键信息而不是显示全部原始数据
3. 对于详细信息查询，以易读的格式展示重要字段
4. 始终使用中文回复，使用自然语言描述结果
5. 如果查询结果为空，明确说明"未找到相关数据"
6. 必须严格按照以下 JSON 格式返回响应：
{
  "thoughts": "你的思考过程",
  "requests": [
    {
      "method": "GET",
      "url": "/api/user?sex=female"
    }
  ],
  "process_results": true,
  "result_summary": "根据查询结果生成的摘要说明"
}

API 的基本格式如下：
1. 获取所有记录：GET /api/{表名}
2. 获取单个记录：GET /api/{表名}/{id}
3. 创建记录：POST /api/{表名} (带有 JSON 请求体)
4. 更新记录：PUT /api/{表名}/{id} (带有 JSON 请求体)
5. 删除记录：DELETE /api/{表名}/{id}
6. 获取数据库元数据：GET /api/metadata`
}

/**
 * 处理用户查询
 * @param userQuery 用户查询文本
 * @param sessionId 会话 ID
 * @returns LLM 的响应
 */
export async function processUserQuery(userQuery: string, sessionId: string): Promise<LLMResponse> {
  const client = getOpenAIClient()
  const systemPrompt = await generateSystemPrompt()
  const config = getConfig()
  const openaiConfig = config.llm.openai

  // 获取会话上下文
  const context = getConversationContext(sessionId)

  console.log('=== LLM 调用开始 ===')
  console.log('用户查询:', userQuery)
  console.log('会话上下文:', context)
  console.log('系统提示:', systemPrompt)
  console.log('LLM 配置:', {
    model: openaiConfig.model,
    temperature: openaiConfig.temperature,
    provider: config.llm.provider,
    apiUrl: openaiConfig.defaultApiUrl,
  })

  try {
    console.log('正在调用 LLM API...')

    // 构建消息列表
    const messages = [{ role: 'system', content: systemPrompt }] as any[]

    // 如果有上下文，添加到消息中
    if (context) {
      messages.push(
        { role: 'user', content: context.lastQuery },
        {
          role: 'assistant',
          content: `我执行了查询，结果如下：\n${JSON.stringify(context.lastResults, null, 2)}`,
        },
      )
    }

    // 添加当前查询
    messages.push({ role: 'user', content: userQuery })

    const response = await client.chat.completions.create({
      model: openaiConfig.model,
      messages,
      temperature: openaiConfig.temperature,
    })

    const content = response.choices[0].message.content
    console.log('LLM 原始响应:', content)

    // 尝试解析 JSON 响应
    try {
      if (!content) {
        throw new Error('LLM 响应内容为空')
      }

      // 提取第一个完整的 JSON 对象
      let jsonStr = content
      const startIdx = content.indexOf('{')
      if (startIdx !== -1) {
        let bracketCount = 0
        let endIdx = -1

        for (let i = startIdx; i < content.length; i++) {
          if (content[i] === '{') bracketCount++
          if (content[i] === '}') bracketCount--

          if (bracketCount === 0) {
            endIdx = i + 1
            break
          }
        }

        if (endIdx !== -1) {
          jsonStr = content.substring(startIdx, endIdx)
        }
      }

      const parsedResponse = JSON.parse(jsonStr) as LLMResponse
      console.log('解析后的响应:', parsedResponse)
      console.log('=== LLM 调用结束 ===')

      // 更新会话上下文
      updateConversationContext(sessionId, {
        lastQuery: userQuery,
        lastIntent: parsedResponse.thoughts,
        lastRequest: parsedResponse.requests?.[0],
      })

      return parsedResponse
    } catch (error) {
      console.error('JSON 解析错误:', error)
      console.log('无法解析的内容:', content)
      console.log('=== LLM 调用异常结束 ===')
      return {
        error: '无法解析响应',
        rawContent: content,
      } as any
    }
  } catch (error) {
    console.error('LLM API 调用错误:', error)
    console.log('=== LLM 调用异常结束 ===')
    throw new Error('调用 LLM API 失败')
  }
}
