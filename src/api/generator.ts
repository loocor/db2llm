import { Hono } from 'hono'
import { getDataSource } from '../db/connection'
import { TableMetadata, getAllTablesMetadata } from '../db/metadata'

// 存储当前的表元数据
let currentTables: TableMetadata[] | null = null

/**
 * 为数据库中的每个表生成 RESTful API
 * @param app Hono 应用实例
 */
export async function generateRestApi(app: Hono): Promise<void> {
  // 获取表元数据
  currentTables = await getAllTablesMetadata()
  console.log(`已为 ${currentTables.length} 个表生成 RESTful API`)
}

/**
 * 创建动态路由中间件
 */
export function createDynamicRouteMiddleware() {
  return async (c: any, next: () => Promise<void>) => {
    const path = c.req.path
    const method = c.req.method

    console.log('\n=== 动态路由请求开始 ===')
    console.log('请求路径:', path)
    console.log('请求方法:', method)

    // 如果不是 API 请求，继续下一个中间件
    if (
      !path.startsWith('/api/') ||
      path === '/api/config' ||
      path === '/api/connect' ||
      path === '/api/query'
    ) {
      console.log('非动态 API 请求，跳过')
      console.log('=== 动态路由请求结束 ===\n')
      return next()
    }

    // 检查是否已初始化
    if (!currentTables) {
      console.log('错误: 数据库 API 未初始化')
      console.log('=== 动态路由请求结束 ===\n')
      return c.json({ success: false, error: '数据库 API 未初始化' }, 503)
    }

    const dataSource = getDataSource()
    const segments = path.split('/').filter(Boolean)
    console.log('路径段:', segments)

    // 处理 /api/metadata 请求
    if (segments.length === 2 && segments[1] === 'metadata') {
      console.log('请求类型: 获取元数据')
      console.log('=== 动态路由请求结束 ===\n')
      return c.json({ success: true, data: currentTables })
    }

    // 确保路径格式正确
    if (segments.length < 2 || segments.length > 3) {
      console.log('错误: 无效的路径格式')
      console.log('=== 动态路由请求结束 ===\n')
      return next()
    }

    const tableName = segments[1]
    const id = segments[2]
    console.log('目标表:', tableName)
    console.log('记录 ID:', id || '无')

    // 检查表是否存在
    const table = currentTables.find(t => t.name.toLowerCase() === tableName.toLowerCase())
    if (!table) {
      console.log('错误: 表不存在')
      console.log('=== 动态路由请求结束 ===\n')
      return c.json({ success: false, error: `表 ${tableName} 不存在` }, 404)
    }

    // 获取主键
    const primaryKey = table.columns.find(col => col.isPrimary)?.name || 'id'
    console.log('使用主键:', primaryKey)

    try {
      let result: any[]

      switch (method) {
        case 'GET': {
          if (id) {
            console.log('操作: 获取单条记录')
            // 获取单个记录
            const query = `SELECT * FROM "${tableName}" WHERE ${primaryKey} = ?`
            console.log('SQL:', query)
            console.log('参数:', [id])

            result = await dataSource.query(query, [id])
            console.log('查询结果:', result)

            if (result.length === 0) {
              console.log('错误: 记录不存在')
              console.log('=== 动态路由请求结束 ===\n')
              return c.json({ success: false, error: '记录不存在' }, 404)
            }

            console.log('=== 动态路由请求结束 ===\n')
            return c.json({ success: true, data: result[0] })
          }

          console.log('操作: 获取记录列表')

          // 获取查询参数
          const queryParams = c.req.query()

          // 构建 SQL 查询
          let sql = `SELECT * FROM "${tableName}"`
          const params: any[] = []

          // 如果有 ID，使用 ID 查询
          if (id) {
            sql += ` WHERE "${primaryKey}" = ?`
            params.push(id)
          }
          // 否则，处理查询参数
          else if (Object.keys(queryParams).length > 0) {
            const conditions = []
            for (const [key, value] of Object.entries(queryParams)) {
              conditions.push(`"${key}" = ?`)
              params.push(value)
            }
            if (conditions.length > 0) {
              sql += ` WHERE ${conditions.join(' AND ')}`
            }
          }

          console.log('SQL:', sql)
          console.log('参数:', params)

          // 执行查询
          result = await dataSource.query(sql, params)
          console.log('查询结果数量:', result.length)

          console.log('=== 动态路由请求结束 ===\n')
          return c.json({
            success: true,
            data: result,
          })
        }

        case 'POST':
          if (id) {
            console.log('错误: 创建记录时不需要指定 ID')
            console.log('=== 动态路由请求结束 ===\n')
            return c.json({ success: false, error: '创建记录时不需要指定 ID' }, 400)
          }

          // 创建记录
          const body = await c.req.json()
          console.log('操作: 创建记录')
          console.log('请求体:', body)

          const columns = Object.keys(body).filter(key =>
            table.columns.some(col => col.name === key),
          )

          if (columns.length === 0) {
            console.log('错误: 没有提供有效的字段')
            console.log('=== 动态路由请求结束 ===\n')
            return c.json({ success: false, error: '没有提供有效的字段' }, 400)
          }

          const placeholders = columns.map(() => '?').join(', ')
          const values = columns.map(col => body[col])
          const insertQuery = `
            INSERT INTO "${tableName}" (${columns.join(', ')})
            VALUES (${placeholders})
          `
          console.log('SQL:', insertQuery)
          console.log('参数:', values)

          result = await dataSource.query(insertQuery, values)
          console.log('插入结果:', result)
          console.log('=== 动态路由请求结束 ===\n')

          return c.json(
            {
              success: true,
              message: '记录创建成功',
              id: result.lastID,
            },
            201,
          )

        case 'PUT':
          if (!id) {
            console.log('错误: 更新记录时需要指定 ID')
            console.log('=== 动态路由请求结束 ===\n')
            return c.json({ success: false, error: '更新记录时需要指定 ID' }, 400)
          }

          // 更新记录
          const updateBody = await c.req.json()
          console.log('操作: 更新记录')
          console.log('请求体:', updateBody)

          const updateColumns = Object.keys(updateBody).filter(key =>
            table.columns.some(col => col.name === key),
          )

          if (updateColumns.length === 0) {
            console.log('错误: 没有提供有效的字段')
            console.log('=== 动态路由请求结束 ===\n')
            return c.json({ success: false, error: '没有提供有效的字段' }, 400)
          }

          const setClause = updateColumns.map(col => `${col} = ?`).join(', ')
          const updateValues = [...updateColumns.map(col => updateBody[col]), id]
          const updateQuery = `
            UPDATE "${tableName}"
            SET ${setClause}
            WHERE ${primaryKey} = ?
          `
          console.log('SQL:', updateQuery)
          console.log('参数:', updateValues)

          result = await dataSource.query(updateQuery, updateValues)
          console.log('更新结果:', result)

          if (result.changes === 0) {
            console.log('错误: 记录不存在或未更改')
            console.log('=== 动态路由请求结束 ===\n')
            return c.json({ success: false, error: '记录不存在或未更改' }, 404)
          }

          console.log('=== 动态路由请求结束 ===\n')
          return c.json({
            success: true,
            message: '记录更新成功',
          })

        case 'DELETE':
          if (!id) {
            console.log('错误: 删除记录时需要指定 ID')
            console.log('=== 动态路由请求结束 ===\n')
            return c.json({ success: false, error: '删除记录时需要指定 ID' }, 400)
          }

          console.log('操作: 删除记录')
          // 删除记录
          const deleteQuery = `DELETE FROM "${tableName}" WHERE ${primaryKey} = ?`
          console.log('SQL:', deleteQuery)
          console.log('参数:', [id])

          result = await dataSource.query(deleteQuery, [id])
          console.log('删除结果:', result)

          if (result.changes === 0) {
            console.log('错误: 记录不存在')
            console.log('=== 动态路由请求结束 ===\n')
            return c.json({ success: false, error: '记录不存在' }, 404)
          }

          console.log('=== 动态路由请求结束 ===\n')
          return c.json({
            success: true,
            message: '记录删除成功',
          })

        default:
          console.log('错误: 不支持的请求方法')
          console.log('=== 动态路由请求结束 ===\n')
          return next()
      }
    } catch (error) {
      console.error('处理请求时发生错误:', error)
      console.log('=== 动态路由请求异常结束 ===\n')
      return c.json(
        {
          success: false,
          error: error instanceof Error ? error.message : '未知错误',
        },
        500,
      )
    }
  }
}
