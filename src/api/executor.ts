import type { Hono } from 'hono'

interface ApiRequest {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE'
  url: string
  body?: any
}

/**
 * 执行 API 请求
 * @param app Hono 应用实例
 * @param request API 请求对象
 * @returns API 响应结果
 */
export async function executeApiRequest(app: Hono, request: ApiRequest): Promise<any> {
  const { method, url, body } = request

  // 构建请求对象
  const requestInit: RequestInit = {
    method,
    headers: {
      'Content-Type': 'application/json',
    },
  }

  // 添加请求体（如果有）
  if (body && (method === 'POST' || method === 'PUT')) {
    requestInit.body = JSON.stringify(body)
  }

  // 创建请求
  const req = new Request(`http://localhost${url}`, requestInit)

  try {
    // 使用 Hono 的请求处理机制执行请求
    const res = await app.fetch(req)

    if (!res.ok) {
      console.error(`API 请求失败: ${method} ${url}`, await res.text())
      return {
        success: false,
        error: `API 请求失败: ${res.status} ${res.statusText}`,
      }
    }

    // 解析响应
    const data = await res.json()
    return data
  } catch (error) {
    console.error(`执行 API 请求时出错: ${method} ${url}`, error)
    return {
      success: false,
      error: `执行 API 请求时出错: ${error instanceof Error ? error.message : String(error)}`,
    }
  }
}

/**
 * 执行多个 API 请求
 * @param app Hono 应用实例
 * @param requests API 请求对象数组
 * @returns 所有 API 响应结果
 */
export async function executeApiRequests(app: Hono, requests: ApiRequest[]): Promise<any[]> {
  const results = []

  for (const request of requests) {
    const result = await executeApiRequest(app, request)
    results.push(result)

    // 如果请求失败，停止执行后续请求
    if (result.success === false) {
      break
    }
  }

  return results
}
