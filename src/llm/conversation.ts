import { LLMRequest } from './types'

interface ConversationContext {
  lastQuery: string // 上一次的用户查询
  lastIntent?: string // 上一次的意图
  lastRequest?: LLMRequest // 上一次的 API 请求
  lastResults?: any[] // 上一次的查询结果
  timestamp: number // 最后更新时间
}

// 使用 Map 存储会话上下文，key 为会话 ID
const conversations = new Map<string, ConversationContext>()

// 会话过期时间（30分钟）
const CONVERSATION_TIMEOUT = 30 * 60 * 1000

/**
 * 获取或创建会话上下文
 * @param sessionId 会话 ID
 * @returns 会话上下文
 */
export function getConversationContext(sessionId: string): ConversationContext | null {
  const context = conversations.get(sessionId)
  if (!context) return null

  // 检查是否过期
  if (Date.now() - context.timestamp > CONVERSATION_TIMEOUT) {
    conversations.delete(sessionId)
    return null
  }

  return context
}

/**
 * 更新会话上下文
 * @param sessionId 会话 ID
 * @param context 部分上下文数据
 */
export function updateConversationContext(
  sessionId: string,
  context: Partial<ConversationContext>,
): void {
  const currentContext = conversations.get(sessionId) || {
    lastQuery: '',
    timestamp: Date.now(),
  }

  conversations.set(sessionId, {
    ...currentContext,
    ...context,
    timestamp: Date.now(),
  })
}

/**
 * 清理过期的会话
 */
export function cleanupExpiredConversations(): void {
  const now = Date.now()
  for (const [sessionId, context] of conversations.entries()) {
    if (now - context.timestamp > CONVERSATION_TIMEOUT) {
      conversations.delete(sessionId)
    }
  }
}

// 定期清理过期会话（每5分钟）
setInterval(cleanupExpiredConversations, 5 * 60 * 1000)
